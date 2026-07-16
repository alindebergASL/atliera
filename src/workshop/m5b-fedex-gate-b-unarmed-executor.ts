import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  type BigIntStats,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";

import {
  M5B_FEDEX_PRODUCTION_PINS,
  M5B_FEDEX_TRUST_STATUS,
  admitM5bFedExProductionCustodyBytes,
  buildM5bFedExSanitizedSourcePack,
  canonicalM5bFedExJson,
  extractM5bFedExCommittedFixtureSource,
  sha256M5bFedExCanonical,
  type M5bFedExProductionPins,
  type M5bFedExSanitizedSourcePack,
} from "./m5b-fedex-system-acquired-source.ts";
import {
  buildM5bFedExPrewriteCandidate,
  buildM5bFedExReviewPacket,
  type M5bFedExPrewriteCandidate,
  type M5bFedExReviewPacket,
} from "./m5b-fedex-review-composition.ts";
import { renderM5bFedExPrewriteWorkshopHtml } from "./m5b-fedex-prewrite-workshop.ts";

export const M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT =
  "81661693bd0c858a4e0c9400ff68c28cb0b277f3" as const;
export const M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE =
  "e40ff4b3d1a0c394145b9b63ddb5efeaab785a5e" as const;
export const M5B_FEDEX_GATE_B_POST_MERGE_CI_RUN = 29435522041 as const;
export const M5B_FEDEX_GATE_B_AUTHORIZATION_KIND =
  "m5b-fedex-gate-b-private-one-shot-authorization" as const;
export const M5B_FEDEX_GATE_B_CONSUMPTION_KIND =
  "m5b-fedex-gate-b-private-one-shot-consumption" as const;
export const M5B_FEDEX_GATE_B_AUTHORIZATION_MAX_BYTES = 32_768 as const;
export const M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS = 600_000 as const;
export const M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES = 407_195 as const;
export const M5B_FEDEX_GATE_B_CUSTODY_READS_MAXIMUM = 1 as const;
export const M5B_FEDEX_GATE_B_RETRY_BUDGET = 0 as const;

const SAFE_IDENTIFIER = /^[A-Za-z0-9._-]{8,128}$/;
const SAFE_HASH = /^[a-f0-9]{64}$/;
const SAFE_GIT_OBJECT = /^[a-f0-9]{40}$/;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MODULE_PATH = fileURLToPath(import.meta.url);
const MODULE_DIRECTORY = dirname(MODULE_PATH);
const MODULE_REPOSITORY_ROOT = realpathSync(resolve(MODULE_DIRECTORY, "..", ".."));

export class M5bFedExGateBRefusal extends Error {
  constructor(public readonly code: string, public readonly phase: M5bFedExGateBPhase) {
    super(`M5b FedEx Gate B refused: ${code}`);
    this.name = "M5bFedExGateBRefusal";
  }
}

export type M5bFedExGateBPhase =
  | "authorization_preflight"
  | "binding_preflight"
  | "custody_preflight"
  | "durable_consumption"
  | "custody_read"
  | "production_admission"
  | "deterministic_composition"
  | "completed"
  | "synthetic_fixture_generation";

export type M5bFedExGateBConsumptionState =
  | "not_created"
  | "preexisting_replay"
  | "created_fail_closed"
  | "durably_committed";

export interface M5bFedExGateBAuthorization {
  readonly kind: typeof M5B_FEDEX_GATE_B_AUTHORIZATION_KIND;
  readonly schemaVersion: "1";
  readonly authorizationId: string;
  readonly oneShotConsumptionId: string;
  readonly custodyPath: string;
  readonly implementationBaseCommit: typeof M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT;
  readonly implementationBaseTree: typeof M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE;
  readonly reviewedExecutorCommit: string;
  readonly reviewedExecutorTree: string;
  readonly postMergeCiRun: typeof M5B_FEDEX_GATE_B_POST_MERGE_CI_RUN;
  readonly postMergeCiConclusion: "success";
  readonly productionPins: M5bFedExProductionPins;
  readonly authorizedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly currentEffectiveAuthorization: "one-shot-private-custody-read";
  readonly authorizesPrivateCustodyRead: true;
  readonly authorizesProviderCall: false;
  readonly authorizesAcquisition: false;
  readonly authorizesGraphOrDbRead: false;
  readonly authorizesGraphOrDbWrite: false;
  readonly authorizesDeployment: false;
  readonly maximumCustodyReads: typeof M5B_FEDEX_GATE_B_CUSTODY_READS_MAXIMUM;
  readonly retryBudget: typeof M5B_FEDEX_GATE_B_RETRY_BUDGET;
  readonly outputContract: "sanitized-unratified-unverified-prewrite-only";
}

export interface M5bFedExGateBFileIdentity {
  readonly realPath: string;
  readonly regularFile: boolean;
  readonly mode: number;
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: bigint;
  readonly gid: bigint;
  readonly nlink: bigint;
  readonly size: bigint;
}

export interface M5bFedExGateBOwnerIdentity {
  readonly uid: bigint;
  readonly gid: bigint;
}

/**
 * A later reviewed arming wrapper must provide these as literal, fixed pins.
 * This unarmed slice deliberately supplies no values and no wrapper.
 */
export interface M5bFedExGateBTrustPins {
  readonly expectedAuthorizationSha256: string;
  readonly trustedReplayRoot: string;
  readonly reviewedExecutorCommit: string;
  readonly reviewedExecutorTree: string;
  readonly reviewedExecutableSha256: string;
  readonly expectedAuthorizationOwner: Readonly<M5bFedExGateBOwnerIdentity>;
  readonly expectedCustodyOwner: Readonly<M5bFedExGateBOwnerIdentity>;
  readonly expectedReplayRootOwner: Readonly<M5bFedExGateBOwnerIdentity>;
}

export interface M5bFedExGateBImplementationInspection {
  readonly canonicalRoot: string;
  readonly commit: string;
  readonly tree: string;
  readonly baseCommit: string;
  readonly baseTree: string;
  readonly baseIsAncestor: boolean;
  readonly clean: boolean;
  readonly executableSha256: string;
  readonly executableIdentity: Readonly<M5bFedExGateBFileIdentity>;
}

export interface M5bFedExGateBDependencies {
  readonly trustPins: Readonly<M5bFedExGateBTrustPins>;
  readonly nowIso: () => string;
  readonly inspectImplementation: () => Readonly<M5bFedExGateBImplementationInspection>;
  readonly revalidateImplementation: (
    snapshot: Readonly<M5bFedExGateBImplementationInspection>,
  ) => boolean;
  readonly inspectExternalFile: (path: string) => Readonly<M5bFedExGateBFileIdentity>;
  readonly readAuthorizationOnce: (
    path: string,
    identity: Readonly<M5bFedExGateBFileIdentity>,
  ) => Uint8Array;
  readonly commitConsumption: (
    markerName: string,
    prepareMarkerContent: () => string,
    reportTerminalState: (state: "preexisting_replay" | "created_fail_closed") => void,
  ) => void;
  readonly readCustodyOnce: (
    path: string,
    identity: Readonly<M5bFedExGateBFileIdentity>,
  ) => Uint8Array;
}

export interface M5bFedExGateBReceiptContent {
  readonly kind: "m5b-fedex-gate-b-sanitized-execution-receipt";
  readonly schemaVersion: "1";
  readonly executionMode: "future-private-one-shot" | "committed-synthetic-fixture";
  readonly outcome: "completed" | "refused" | "failed" | "synthetic-fixture-generated";
  readonly phase: M5bFedExGateBPhase;
  readonly refusalCode: string | null;
  readonly recordedAt: string;
  readonly authorizationId: string | null;
  readonly oneShotConsumptionId: string | null;
  readonly authorizationArtifactSha256: string | null;
  readonly implementationBaseCommit: typeof M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT;
  readonly implementationBaseTree: typeof M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE;
  readonly reviewedExecutorCommit: string | null;
  readonly reviewedExecutorTree: string | null;
  readonly productionPins: M5bFedExProductionPins;
  readonly oneShotConsumptionState: M5bFedExGateBConsumptionState;
  readonly outputHashes: {
    readonly sourcePackSha256: string | null;
    readonly candidateContentSha256: string | null;
    readonly reviewPacketSha256: string | null;
    readonly workshopHtmlSha256: string | null;
  };
  readonly accounting: {
    readonly authorizationArtifactReads: 0 | 1;
    readonly custodyReadAttempts: 0 | 1;
    readonly custodyReadsCompleted: 0 | 1;
    readonly custodyBytesRead: number;
    readonly retries: 0;
    readonly providerCalls: 0;
    readonly acquisitions: 0;
    readonly graphOrDbReads: 0;
    readonly graphOrDbWrites: 0;
    readonly deployments: 0;
    readonly externalProductEffects: 0;
    readonly localSyntheticOutputsWritten: number;
  };
  readonly trust: {
    readonly sourceTrustStatus: typeof M5B_FEDEX_TRUST_STATUS;
    readonly independentlyVerifiedObjects: 0;
    readonly reviewRatificationState: "unratified-draft";
    readonly humanRatificationSatisfied: false;
  };
  readonly sanitization: {
    readonly privatePathOmitted: true;
    readonly custodyBytesOmitted: true;
    readonly encodedResponseOmitted: true;
    readonly contactOmitted: true;
    readonly credentialsOmitted: true;
    readonly resolvedIpOmitted: true;
  };
}

export interface M5bFedExGateBReceipt extends M5bFedExGateBReceiptContent {
  readonly receiptSha256: string;
}

export interface M5bFedExGateBCompletedOutputs {
  readonly sourcePack: Readonly<M5bFedExSanitizedSourcePack>;
  readonly candidate: Readonly<M5bFedExPrewriteCandidate>;
  readonly reviewPacket: Readonly<M5bFedExReviewPacket>;
  readonly workshopHtml: string;
}

export type M5bFedExGateBExecutionResult =
  | Readonly<{
    ok: true;
    outputs: Readonly<M5bFedExGateBCompletedOutputs>;
    receipt: Readonly<M5bFedExGateBReceipt>;
  }>
  | Readonly<{ ok: false; outputs: null; receipt: Readonly<M5bFedExGateBReceipt> }>;

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fail(code: string, phase: M5bFedExGateBPhase): never {
  throw new M5bFedExGateBRefusal(code, phase);
}

function strictIso(value: unknown, label: string, phase: M5bFedExGateBPhase): string {
  if (typeof value !== "string" || !STRICT_ISO.test(value)) fail(`${label}_timestamp`, phase);
  try {
    if (new Date(value).toISOString() !== value) fail(`${label}_timestamp`, phase);
  } catch {
    fail(`${label}_timestamp`, phase);
  }
  return value;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(code, "authorization_preflight");
  }
}

function isContainedBy(parent: string, child: string): boolean {
  const relation = relative(parent, child);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function requireExternalCanonicalPath(
  path: unknown,
  canonicalRoot: string,
  code: string,
  phase: M5bFedExGateBPhase = "authorization_preflight",
): string {
  if (typeof path !== "string" || !isAbsolute(path) || normalize(path) !== path ||
      isContainedBy(canonicalRoot, path)) fail(code, phase);
  return path;
}

function ownerMatches(
  identity: Readonly<M5bFedExGateBFileIdentity>,
  expectedOwner: Readonly<M5bFedExGateBOwnerIdentity>,
): boolean {
  return identity.uid === expectedOwner.uid && identity.gid === expectedOwner.gid;
}

function requireExternalMode0600RegularFile(
  identity: Readonly<M5bFedExGateBFileIdentity>,
  requestedPath: string,
  canonicalRoot: string,
  expectedOwner: Readonly<M5bFedExGateBOwnerIdentity>,
  code: string,
  phase: M5bFedExGateBPhase,
): void {
  if (!identity.regularFile || identity.mode !== 0o600 || identity.realPath !== requestedPath ||
      identity.nlink !== 1n || !ownerMatches(identity, expectedOwner) ||
      isContainedBy(canonicalRoot, identity.realPath) || identity.size < 0n) {
    fail(code, phase);
  }
}

function validateAuthorization(value: unknown, canonicalRoot: string): Readonly<M5bFedExGateBAuthorization> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("authorization_shape", "authorization_preflight");
  }
  const authorization = value as Readonly<Record<string, unknown>>;
  exactKeys(authorization, [
    "kind", "schemaVersion", "authorizationId", "oneShotConsumptionId", "custodyPath",
    "implementationBaseCommit", "implementationBaseTree", "reviewedExecutorCommit", "reviewedExecutorTree",
    "postMergeCiRun", "postMergeCiConclusion", "productionPins", "authorizedAt", "validFrom", "validUntil",
    "currentEffectiveAuthorization", "authorizesPrivateCustodyRead", "authorizesProviderCall",
    "authorizesAcquisition", "authorizesGraphOrDbRead", "authorizesGraphOrDbWrite", "authorizesDeployment",
    "maximumCustodyReads", "retryBudget", "outputContract",
  ], "authorization_envelope");
  const authorizedAt = strictIso(authorization.authorizedAt, "authorized_at", "authorization_preflight");
  const validFrom = strictIso(authorization.validFrom, "valid_from", "authorization_preflight");
  const validUntil = strictIso(authorization.validUntil, "valid_until", "authorization_preflight");
  const authorizedAtMs = Date.parse(authorizedAt);
  const validFromMs = Date.parse(validFrom);
  const validUntilMs = Date.parse(validUntil);
  const custodyPath = requireExternalCanonicalPath(authorization.custodyPath, canonicalRoot, "custody_path");
  if (authorization.kind !== M5B_FEDEX_GATE_B_AUTHORIZATION_KIND || authorization.schemaVersion !== "1" ||
      typeof authorization.authorizationId !== "string" || !SAFE_IDENTIFIER.test(authorization.authorizationId) ||
      typeof authorization.oneShotConsumptionId !== "string" ||
      !SAFE_IDENTIFIER.test(authorization.oneShotConsumptionId) ||
      authorization.implementationBaseCommit !== M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT ||
      authorization.implementationBaseTree !== M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE ||
      typeof authorization.reviewedExecutorCommit !== "string" ||
      !SAFE_GIT_OBJECT.test(authorization.reviewedExecutorCommit) ||
      typeof authorization.reviewedExecutorTree !== "string" ||
      !SAFE_GIT_OBJECT.test(authorization.reviewedExecutorTree) ||
      authorization.postMergeCiRun !== M5B_FEDEX_GATE_B_POST_MERGE_CI_RUN ||
      authorization.postMergeCiConclusion !== "success" ||
      canonicalM5bFedExJson(authorization.productionPins) !== canonicalM5bFedExJson(M5B_FEDEX_PRODUCTION_PINS) ||
      authorization.currentEffectiveAuthorization !== "one-shot-private-custody-read" ||
      authorization.authorizesPrivateCustodyRead !== true || authorization.authorizesProviderCall !== false ||
      authorization.authorizesAcquisition !== false || authorization.authorizesGraphOrDbRead !== false ||
      authorization.authorizesGraphOrDbWrite !== false || authorization.authorizesDeployment !== false ||
      authorization.maximumCustodyReads !== M5B_FEDEX_GATE_B_CUSTODY_READS_MAXIMUM ||
      authorization.retryBudget !== M5B_FEDEX_GATE_B_RETRY_BUDGET ||
      authorization.outputContract !== "sanitized-unratified-unverified-prewrite-only" ||
      validFromMs < authorizedAtMs || validUntilMs <= authorizedAtMs || validFromMs >= validUntilMs ||
      validUntilMs > Date.parse(M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline)) {
    fail("authorization_binding", "authorization_preflight");
  }
  if (validUntilMs - authorizedAtMs > M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS) {
    fail("authorization_freshness", "authorization_preflight");
  }
  return Object.freeze({ ...(authorization as unknown as M5bFedExGateBAuthorization), custodyPath });
}

function validateTrustPins(pins: Readonly<M5bFedExGateBTrustPins>): void {
  if (!SAFE_HASH.test(pins.expectedAuthorizationSha256) || !SAFE_GIT_OBJECT.test(pins.reviewedExecutorCommit) ||
      !SAFE_GIT_OBJECT.test(pins.reviewedExecutorTree) || !SAFE_HASH.test(pins.reviewedExecutableSha256) ||
      pins.expectedAuthorizationOwner.uid < 0n || pins.expectedAuthorizationOwner.gid < 0n ||
      pins.expectedCustodyOwner.uid < 0n || pins.expectedCustodyOwner.gid < 0n ||
      pins.expectedReplayRootOwner.uid < 0n || pins.expectedReplayRootOwner.gid < 0n) {
    fail("trusted_pins", "binding_preflight");
  }
}

function snapshotTrustPins(pins: Readonly<M5bFedExGateBTrustPins>): Readonly<M5bFedExGateBTrustPins> {
  return Object.freeze({
    expectedAuthorizationSha256: pins.expectedAuthorizationSha256,
    trustedReplayRoot: pins.trustedReplayRoot,
    reviewedExecutorCommit: pins.reviewedExecutorCommit,
    reviewedExecutorTree: pins.reviewedExecutorTree,
    reviewedExecutableSha256: pins.reviewedExecutableSha256,
    expectedAuthorizationOwner: Object.freeze({ ...pins.expectedAuthorizationOwner }),
    expectedCustodyOwner: Object.freeze({ ...pins.expectedCustodyOwner }),
    expectedReplayRootOwner: Object.freeze({ ...pins.expectedReplayRootOwner }),
  });
}

function validateAuthorizationWindow(
  authorization: Readonly<M5bFedExGateBAuthorization>,
  nowIso: string,
  phase: M5bFedExGateBPhase,
): void {
  const now = Date.parse(nowIso);
  const authorizedAt = Date.parse(authorization.authorizedAt);
  if (now < authorizedAt || now - authorizedAt >= M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS) {
    fail("authorization_freshness", phase);
  }
  if (now < Date.parse(authorization.validFrom) || now >= Date.parse(authorization.validUntil) ||
      now >= Date.parse(M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline)) {
    fail("authorization_window", phase);
  }
}

function sampleTrustedTime(
  dependencies: Readonly<M5bFedExGateBDependencies>,
  previous: string | null,
  phase: M5bFedExGateBPhase,
): string {
  const next = strictIso(dependencies.nowIso(), "execution_time", phase);
  if (previous !== null && Date.parse(next) < Date.parse(previous)) fail("trusted_time_regression", phase);
  return next;
}

function validateImplementation(
  implementation: Readonly<M5bFedExGateBImplementationInspection>,
  authorization: Readonly<M5bFedExGateBAuthorization>,
  pins: Readonly<M5bFedExGateBTrustPins>,
): void {
  if (implementation.canonicalRoot !== MODULE_REPOSITORY_ROOT ||
      implementation.baseCommit !== M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT ||
      implementation.baseTree !== M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE ||
      implementation.baseCommit !== authorization.implementationBaseCommit ||
      implementation.baseTree !== authorization.implementationBaseTree ||
      implementation.baseIsAncestor !== true || implementation.clean !== true ||
      implementation.commit !== authorization.reviewedExecutorCommit ||
      implementation.tree !== authorization.reviewedExecutorTree ||
      implementation.commit !== pins.reviewedExecutorCommit ||
      implementation.tree !== pins.reviewedExecutorTree ||
      implementation.executableSha256 !== pins.reviewedExecutableSha256 ||
      !implementation.executableIdentity.regularFile || implementation.executableIdentity.nlink !== 1n ||
      implementation.executableIdentity.realPath !== MODULE_PATH) {
    fail("implementation_identity", "binding_preflight");
  }
}

function receipt(content: M5bFedExGateBReceiptContent): Readonly<M5bFedExGateBReceipt> {
  return Object.freeze({ ...content, receiptSha256: sha256M5bFedExCanonical(content) });
}

interface ReceiptState {
  authorizationReads: 0 | 1;
  custodyReadAttempts: 0 | 1;
  custodyReadsCompleted: 0 | 1;
  custodyBytesRead: number;
  consumptionState: M5bFedExGateBConsumptionState;
  authorization: Readonly<M5bFedExGateBAuthorization> | null;
  authorizationSha256: string | null;
  outputs: Readonly<M5bFedExGateBCompletedOutputs> | null;
}

function buildReceipt(
  state: ReceiptState,
  recordedAt: string,
  outcome: M5bFedExGateBReceiptContent["outcome"],
  phase: M5bFedExGateBPhase,
  refusalCode: string | null,
  executionMode: M5bFedExGateBReceiptContent["executionMode"],
  localSyntheticOutputsWritten = 0,
): Readonly<M5bFedExGateBReceipt> {
  const outputHashes = state.outputs === null
    ? Object.freeze({ sourcePackSha256: null, candidateContentSha256: null, reviewPacketSha256: null,
      workshopHtmlSha256: null })
    : Object.freeze({ sourcePackSha256: state.outputs.sourcePack.sourcePackSha256,
      candidateContentSha256: state.outputs.candidate.candidateContentSha256,
      reviewPacketSha256: state.outputs.reviewPacket.packetSha256,
      workshopHtmlSha256: sha256Bytes(state.outputs.workshopHtml) });
  return receipt(Object.freeze({
    kind: "m5b-fedex-gate-b-sanitized-execution-receipt",
    schemaVersion: "1",
    executionMode,
    outcome,
    phase,
    refusalCode,
    recordedAt,
    authorizationId: state.authorization?.authorizationId ?? null,
    oneShotConsumptionId: state.authorization?.oneShotConsumptionId ?? null,
    authorizationArtifactSha256: state.authorizationSha256,
    implementationBaseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
    implementationBaseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
    reviewedExecutorCommit: state.authorization?.reviewedExecutorCommit ?? null,
    reviewedExecutorTree: state.authorization?.reviewedExecutorTree ?? null,
    productionPins: M5B_FEDEX_PRODUCTION_PINS,
    oneShotConsumptionState: state.consumptionState,
    outputHashes,
    accounting: Object.freeze({
      authorizationArtifactReads: state.authorizationReads,
      custodyReadAttempts: state.custodyReadAttempts,
      custodyReadsCompleted: state.custodyReadsCompleted,
      custodyBytesRead: state.custodyBytesRead,
      retries: 0,
      providerCalls: 0,
      acquisitions: 0,
      graphOrDbReads: 0,
      graphOrDbWrites: 0,
      deployments: 0,
      externalProductEffects: 0,
      localSyntheticOutputsWritten,
    }),
    trust: Object.freeze({
      sourceTrustStatus: M5B_FEDEX_TRUST_STATUS,
      independentlyVerifiedObjects: 0,
      reviewRatificationState: "unratified-draft",
      humanRatificationSatisfied: false,
    }),
    sanitization: Object.freeze({
      privatePathOmitted: true,
      custodyBytesOmitted: true,
      encodedResponseOmitted: true,
      contactOmitted: true,
      credentialsOmitted: true,
      resolvedIpOmitted: true,
    }),
  }));
}

function consumptionMarkerName(pins: Readonly<M5bFedExGateBTrustPins>): string {
  const authorityTuple = canonicalM5bFedExJson({
    approvedGoSha256: pins.expectedAuthorizationSha256,
    reviewedExecutorCommit: pins.reviewedExecutorCommit,
    reviewedExecutorTree: pins.reviewedExecutorTree,
    reviewedExecutableSha256: pins.reviewedExecutableSha256,
    custodyArtifactSha256: M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256,
    custodyOwnerUid: pins.expectedCustodyOwner.uid.toString(),
    custodyOwnerGid: pins.expectedCustodyOwner.gid.toString(),
  });
  return `m5b-fedex-gate-b-${sha256Bytes(authorityTuple)}.consumed`;
}

function consumptionContent(
  authorization: Readonly<M5bFedExGateBAuthorization>,
  authorizationSha256: string,
  consumedAt: string,
  reviewedExecutableSha256: string,
): string {
  return `${JSON.stringify({
    kind: M5B_FEDEX_GATE_B_CONSUMPTION_KIND,
    schemaVersion: "1",
    authorizationArtifactSha256: authorizationSha256,
    implementationBaseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
    implementationBaseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
    reviewedExecutorCommit: authorization.reviewedExecutorCommit,
    reviewedExecutorTree: authorization.reviewedExecutorTree,
    reviewedExecutableSha256,
    custodyArtifactSha256: M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256,
    consumedAt,
    maximumCustodyReads: 1,
    retryBudget: 0,
  }, null, 2)}\n`;
}

const SHARED_PREWRITE_BOUNDARY =
  `<section class="boundary"><h2>Pre-write / no-effect boundary</h2>` +
  `<p>Current effective authorization: <strong>none</strong>. Private reads 0 · provider calls 0 · acquisitions 0 · graph/durable writes 0 · deployments 0 · retries 0 · external/product effects 0.</p>` +
  `<p>Every excerpt is proposed and every claim/object remains unverified. Review and retention selections are unratified drafts; a later external ratification artifact is required. Retention beyond ${M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline} is not authorized here.</p>` +
  `<p>Local deterministic fixture outputs written by the generator: 3.</p>`;

const GATE_B_SYNTHETIC_BOUNDARY =
  `<section class="boundary"><h2>Pre-write / no-effect boundary</h2>` +
  `<p>Current effective authorization: <strong>none</strong>. Private reads 0 · provider calls 0 · acquisitions 0 · graph/durable reads 0 · graph/durable writes 0 · deployments 0 · retries 0 · external/product effects 0.</p>` +
  `<p>Every excerpt is proposed and every claim/object remains unverified. Review and retention selections are unratified drafts; a later external ratification artifact is required. Retention beyond ${M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline} is not authorized here.</p>` +
  `<p>Local deterministic synthetic outputs written by the Gate B generator: exactly 5.</p>`;

const GATE_B_FUTURE_PRIVATE_BOUNDARY =
  `<section class="boundary"><h2>Pre-write / no-effect boundary</h2>` +
  `<p>Authorization status: <strong>one-shot authorization consumed before the custody read; no reusable authority remains</strong>. Private custody reads 1 · provider calls 0 · acquisitions 0 · graph/durable reads 0 · graph/durable writes 0 · deployments 0 · retries 0 · external/product effects 0.</p>` +
  `<p>Every excerpt is proposed and every claim/object remains unverified. Review and retention selections are unratified drafts; a later external ratification artifact is required. Retention beyond ${M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline} is not authorized here.</p>` +
  `<p>In-memory review products: exactly 4 (sanitized source pack, validated graph candidate, unratified review packet, and this Workshop HTML), plus the separate sanitized execution receipt.</p>`;

/** Reconciles only the one exact shared boundary section with Gate B's execution mode. */
export function finalizeM5bFedExGateBWorkshopBoundary(
  workshopHtml: string,
  executionMode: M5bFedExGateBReceiptContent["executionMode"],
): string {
  const sections = workshopHtml.match(/<section class="boundary">[\s\S]*?<\/section>/g) ?? [];
  const first = workshopHtml.indexOf(SHARED_PREWRITE_BOUNDARY);
  const expectedTail = /^<p class="mono">Candidate content SHA-256: [a-f0-9]{64}<\/p><\/section>$/;
  if (sections.length !== 1 || first < 0 || !sections[0]!.startsWith(SHARED_PREWRITE_BOUNDARY) ||
      !expectedTail.test(sections[0]!.slice(SHARED_PREWRITE_BOUNDARY.length)) ||
      workshopHtml.indexOf(SHARED_PREWRITE_BOUNDARY, first + SHARED_PREWRITE_BOUNDARY.length) >= 0) {
    fail("shared_workshop_boundary", "deterministic_composition");
  }
  const replacement = executionMode === "committed-synthetic-fixture"
    ? GATE_B_SYNTHETIC_BOUNDARY
    : GATE_B_FUTURE_PRIVATE_BOUNDARY;
  return workshopHtml.slice(0, first) + replacement + workshopHtml.slice(first + SHARED_PREWRITE_BOUNDARY.length);
}

function deterministicOutputs(custodyBytes: Uint8Array): Readonly<M5bFedExGateBCompletedOutputs> {
  let sourcePack: Readonly<M5bFedExSanitizedSourcePack>;
  try {
    sourcePack = buildM5bFedExSanitizedSourcePack(admitM5bFedExProductionCustodyBytes(custodyBytes));
  } catch {
    fail("production_custody_admission", "production_admission");
  }
  try {
    const candidate = buildM5bFedExPrewriteCandidate(sourcePack);
    const reviewPacket = buildM5bFedExReviewPacket(sourcePack, candidate);
    const workshopHtml = finalizeM5bFedExGateBWorkshopBoundary(
      renderM5bFedExPrewriteWorkshopHtml(sourcePack, reviewPacket, candidate),
      "future-private-one-shot",
    );
    return Object.freeze({ sourcePack, candidate, reviewPacket, workshopHtml });
  } catch {
    fail("deterministic_prewrite_composition", "deterministic_composition");
  }
}

/**
 * Internal future-only core. It is deliberately absent from src/index.ts and has
 * no production wrapper. A later reviewed arming slice must bind all trust pins.
 */
export function executeM5bFedExGateBOneShot(
  authorizationPathInput: string,
  dependencies: Readonly<M5bFedExGateBDependencies>,
): M5bFedExGateBExecutionResult {
  const state: ReceiptState = {
    authorizationReads: 0,
    custodyReadAttempts: 0,
    custodyReadsCompleted: 0,
    custodyBytesRead: 0,
    consumptionState: "not_created",
    authorization: null,
    authorizationSha256: null,
    outputs: null,
  };
  let nowIso = "1970-01-01T00:00:00.000Z";
  try {
    const trustedPins = snapshotTrustPins(dependencies.trustPins);
    validateTrustPins(trustedPins);
    nowIso = sampleTrustedTime(dependencies, null, "authorization_preflight");

    let implementation: Readonly<M5bFedExGateBImplementationInspection>;
    try {
      implementation = dependencies.inspectImplementation();
    } catch {
      fail("implementation_identity", "binding_preflight");
    }
    const canonicalRoot = implementation.canonicalRoot;
    requireExternalCanonicalPath(
      trustedPins.trustedReplayRoot,
      canonicalRoot,
      "trusted_replay_root",
      "binding_preflight",
    );
    const authorizationPath = requireExternalCanonicalPath(
      authorizationPathInput,
      canonicalRoot,
      "authorization_path",
    );
    const authorizationIdentity = dependencies.inspectExternalFile(authorizationPath);
    requireExternalMode0600RegularFile(
      authorizationIdentity,
      authorizationPath,
      canonicalRoot,
      trustedPins.expectedAuthorizationOwner,
      "authorization_file",
      "authorization_preflight",
    );
    if (authorizationIdentity.size > BigInt(M5B_FEDEX_GATE_B_AUTHORIZATION_MAX_BYTES)) {
      fail("authorization_size", "authorization_preflight");
    }
    state.authorizationReads = 1;
    const authorizationBytes = dependencies.readAuthorizationOnce(authorizationPath, authorizationIdentity);
    if (BigInt(authorizationBytes.byteLength) !== authorizationIdentity.size ||
        authorizationBytes.byteLength > M5B_FEDEX_GATE_B_AUTHORIZATION_MAX_BYTES) {
      fail("authorization_read", "authorization_preflight");
    }
    state.authorizationSha256 = sha256Bytes(authorizationBytes);
    if (state.authorizationSha256 !== trustedPins.expectedAuthorizationSha256) {
      fail("authorization_digest", "authorization_preflight");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(authorizationBytes).toString("utf8"));
    } catch {
      fail("authorization_json", "authorization_preflight");
    }
    state.authorization = validateAuthorization(parsed, canonicalRoot);
    validateAuthorizationWindow(state.authorization, nowIso, "authorization_preflight");
    validateImplementation(implementation, state.authorization, trustedPins);

    const custodyIdentity = dependencies.inspectExternalFile(state.authorization.custodyPath);
    requireExternalMode0600RegularFile(
      custodyIdentity,
      state.authorization.custodyPath,
      canonicalRoot,
      trustedPins.expectedCustodyOwner,
      "custody_file",
      "custody_preflight",
    );
    if (custodyIdentity.size !== BigInt(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES)) {
      fail("custody_size", "custody_preflight");
    }

    const markerName = consumptionMarkerName(trustedPins);
    let markerPrepared = false;
    try {
      dependencies.commitConsumption(markerName, () => {
        if (markerPrepared) fail("consumption_state_transition", "durable_consumption");
        markerPrepared = true;
        if (!dependencies.revalidateImplementation(implementation)) {
          fail("implementation_identity", "durable_consumption");
        }
        nowIso = sampleTrustedTime(dependencies, nowIso, "durable_consumption");
        validateAuthorizationWindow(state.authorization!, nowIso, "durable_consumption");
        return consumptionContent(
          state.authorization!,
          state.authorizationSha256!,
          nowIso,
          trustedPins.reviewedExecutableSha256,
        );
      }, (terminalState) => {
        if (state.consumptionState !== "not_created") {
          fail("consumption_state_transition", "durable_consumption");
        }
        state.consumptionState = terminalState;
      });
    } catch (error) {
      if (error instanceof M5bFedExGateBRefusal) throw error;
      fail("consumption_replay_or_durability", "durable_consumption");
    }
    if (state.consumptionState === "preexisting_replay") {
      fail("consumption_replay_or_durability", "durable_consumption");
    }
    if (state.consumptionState !== "created_fail_closed") {
      fail("consumption_state_transition", "durable_consumption");
    }
    state.consumptionState = "durably_committed";

    if (!dependencies.revalidateImplementation(implementation)) {
      fail("implementation_identity", "custody_read");
    }
    nowIso = sampleTrustedTime(dependencies, nowIso, "custody_read");
    validateAuthorizationWindow(state.authorization, nowIso, "custody_read");
    state.custodyReadAttempts = 1;
    let custodyBytes: Uint8Array;
    try {
      custodyBytes = dependencies.readCustodyOnce(state.authorization.custodyPath, custodyIdentity);
    } catch {
      fail("custody_read", "custody_read");
    }
    state.custodyReadsCompleted = 1;
    state.custodyBytesRead = custodyBytes.byteLength;
    if (BigInt(custodyBytes.byteLength) !== custodyIdentity.size) fail("custody_read", "custody_read");
    state.outputs = deterministicOutputs(custodyBytes);
    return Object.freeze({
      ok: true,
      outputs: state.outputs,
      receipt: buildReceipt(state, nowIso, "completed", "completed", null, "future-private-one-shot"),
    });
  } catch (error) {
    const consumed = state.consumptionState === "created_fail_closed" ||
      state.consumptionState === "durably_committed";
    const refusal = error instanceof M5bFedExGateBRefusal
      ? error
      : new M5bFedExGateBRefusal("internal_failure", consumed ? "custody_read" : "authorization_preflight");
    return Object.freeze({
      ok: false,
      outputs: null,
      receipt: buildReceipt(
        state,
        nowIso,
        consumed ? "failed" : "refused",
        refusal.phase,
        refusal.code,
        "future-private-one-shot",
      ),
    });
  }
}

function sameIdentity(
  left: Readonly<M5bFedExGateBFileIdentity>,
  right: BigIntStats,
): boolean {
  return left.device === right.dev && left.inode === right.ino && left.uid === right.uid &&
    left.gid === right.gid && left.nlink === right.nlink && left.size === right.size &&
    left.mode === Number(right.mode & 0o7777n) && right.isFile();
}

function equalFileIdentities(
  left: Readonly<M5bFedExGateBFileIdentity>,
  right: Readonly<M5bFedExGateBFileIdentity>,
): boolean {
  return left.realPath === right.realPath && left.regularFile === right.regularFile &&
    left.mode === right.mode && left.device === right.device && left.inode === right.inode &&
    left.uid === right.uid && left.gid === right.gid && left.nlink === right.nlink && left.size === right.size;
}

function nodeIdentity(path: string): Readonly<M5bFedExGateBFileIdentity> {
  const metadata = lstatSync(path, { bigint: true });
  return Object.freeze({
    realPath: realpathSync(path),
    regularFile: metadata.isFile(),
    mode: Number(metadata.mode & 0o7777n),
    device: metadata.dev,
    inode: metadata.ino,
    uid: metadata.uid,
    gid: metadata.gid,
    nlink: metadata.nlink,
    size: metadata.size,
  });
}

function readIdentityBoundFileOnce(
  path: string,
  identity: Readonly<M5bFedExGateBFileIdentity>,
  phase: M5bFedExGateBPhase,
): Uint8Array {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    if (!sameIdentity(identity, fstatSync(descriptor, { bigint: true }))) fail("file_identity_drift", phase);
    const bytes = readFileSync(descriptor);
    if (!sameIdentity(identity, fstatSync(descriptor, { bigint: true }))) fail("file_identity_drift", phase);
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function deriveCanonicalRepositoryRoot(): string {
  const gitTopLevel = realpathSync(gitValue(MODULE_DIRECTORY, ["rev-parse", "--show-toplevel"]));
  if (gitTopLevel !== MODULE_REPOSITORY_ROOT) fail("repository_identity", "binding_preflight");
  return gitTopLevel;
}

function gitValue(canonicalRoot: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [...args], { cwd: canonicalRoot, encoding: "utf8" }).trim();
  } catch (error) {
    const completed = error as Error & { status?: number | null; stdout?: string | Buffer };
    if (completed.status === 0 && completed.stdout !== undefined) return String(completed.stdout).trim();
    throw error;
  }
}

function gitIsClean(canonicalRoot: string): boolean {
  return gitValue(canonicalRoot, ["status", "--porcelain=v1", "--untracked-files=all"]) === "";
}

function inspectSnapshottedCommit(canonicalRoot: string, commit: string): Readonly<{
  tree: string;
  parents: readonly string[];
}> {
  const rawCommit = gitValue(canonicalRoot, ["cat-file", "commit", commit]);
  const headerEnd = rawCommit.indexOf("\n\n");
  if (headerEnd < 0) throw new Error("invalid snapshotted executor commit object");
  const headers = rawCommit.slice(0, headerEnd).split("\n");
  const trees = headers.filter((header) => header.startsWith("tree ")).map((header) => header.slice(5));
  const parents = headers.filter((header) => header.startsWith("parent ")).map((header) => header.slice(7));
  if (trees.length !== 1 || !SAFE_GIT_OBJECT.test(trees[0]!)) {
    throw new Error("invalid snapshotted executor commit metadata");
  }
  if (parents.some((parent) => !SAFE_GIT_OBJECT.test(parent))) {
    throw new Error("invalid snapshotted executor parent metadata");
  }
  return Object.freeze({ tree: trees[0]!, parents: Object.freeze(parents) });
}

function inspectExecutable(): Readonly<{
  identity: Readonly<M5bFedExGateBFileIdentity>;
  sha256: string;
}> {
  const identity = nodeIdentity(MODULE_PATH);
  return Object.freeze({
    identity,
    sha256: sha256Bytes(readIdentityBoundFileOnce(MODULE_PATH, identity, "binding_preflight")),
  });
}

export interface M5bFedExGateBNodeTestHooks {
  readonly afterReplayDirectoryValidation?: () => void;
  readonly beforeMarkerWrite?: () => void;
  readonly beforeMarkerFsync?: () => void;
  readonly beforeMarkerClose?: () => void;
  readonly beforeDirectoryFsync?: () => void;
  readonly beforeDirectoryClose?: () => void;
}

/** Internal Linux filesystem bindings; a later arming wrapper must provide fixed pins. */
export function createM5bFedExGateBNodeDependencies(
  trustPins: Readonly<M5bFedExGateBTrustPins>,
  clock: () => string = () => new Date().toISOString(),
  testHooks: Readonly<M5bFedExGateBNodeTestHooks> = {},
): Readonly<M5bFedExGateBDependencies> {
  const fixedTrustPins = snapshotTrustPins(trustPins);
  const canonicalRoot = deriveCanonicalRepositoryRoot();
  const dependencies: M5bFedExGateBDependencies = {
    trustPins: fixedTrustPins,
    nowIso: clock,
    inspectImplementation: () => {
      const commit = gitValue(canonicalRoot, ["rev-parse", "HEAD"]);
      const { tree, parents } = inspectSnapshottedCommit(canonicalRoot, commit);
      const executable = inspectExecutable();
      return Object.freeze({
        canonicalRoot,
        commit,
        tree,
        baseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
        baseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
        baseIsAncestor: parents.length === 1 &&
          parents[0] === M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
        clean: gitIsClean(canonicalRoot),
        executableSha256: executable.sha256,
        executableIdentity: executable.identity,
      });
    },
    revalidateImplementation: (snapshot) => {
      try {
        if (deriveCanonicalRepositoryRoot() !== snapshot.canonicalRoot ||
            gitValue(canonicalRoot, ["rev-parse", "HEAD"]) !== snapshot.commit || !gitIsClean(canonicalRoot)) {
          return false;
        }
        const executable = inspectExecutable();
        return executable.sha256 === snapshot.executableSha256 &&
          equalFileIdentities(snapshot.executableIdentity, executable.identity);
      } catch {
        return false;
      }
    },
    inspectExternalFile: nodeIdentity,
    readAuthorizationOnce: (path, identity) =>
      readIdentityBoundFileOnce(path, identity, "authorization_preflight"),
    commitConsumption: (markerName, prepareMarkerContent, reportTerminalState) => {
      if (process.platform !== "linux" || !/^m5b-fedex-gate-b-[a-f0-9]{64}\.consumed$/.test(markerName)) {
        fail("consumption_state_directory", "durable_consumption");
      }
      const stateDirectory = requireExternalCanonicalPath(
        fixedTrustPins.trustedReplayRoot,
        canonicalRoot,
        "trusted_replay_root",
        "durable_consumption",
      );
      const metadata = lstatSync(stateDirectory, { bigint: true });
      if (!metadata.isDirectory() || (metadata.mode & 0o7777n) !== 0o700n ||
          metadata.uid !== fixedTrustPins.expectedReplayRootOwner.uid ||
          metadata.gid !== fixedTrustPins.expectedReplayRootOwner.gid || realpathSync(stateDirectory) !== stateDirectory) {
        fail("consumption_state_directory", "durable_consumption");
      }
      let directoryDescriptor: number | undefined;
      let markerDescriptor: number | undefined;
      let pendingError: unknown;
      try {
        directoryDescriptor = openSync(
          stateDirectory,
          fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
        );
        const directoryMetadata = fstatSync(directoryDescriptor, { bigint: true });
        if (!directoryMetadata.isDirectory() || directoryMetadata.dev !== metadata.dev ||
            directoryMetadata.ino !== metadata.ino || (directoryMetadata.mode & 0o7777n) !== 0o700n ||
            directoryMetadata.uid !== fixedTrustPins.expectedReplayRootOwner.uid ||
            directoryMetadata.gid !== fixedTrustPins.expectedReplayRootOwner.gid) {
          fail("consumption_state_directory", "durable_consumption");
        }
        testHooks.afterReplayDirectoryValidation?.();
        const content = prepareMarkerContent();
        const descriptorRelativeMarker = `/proc/self/fd/${directoryDescriptor}/${markerName}`;
        try {
          markerDescriptor = openSync(
            descriptorRelativeMarker,
            fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
            0o600,
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            reportTerminalState("preexisting_replay");
            fail("consumption_replay_or_durability", "durable_consumption");
          }
          throw error;
        }
        reportTerminalState("created_fail_closed");
        const markerMetadata = fstatSync(markerDescriptor, { bigint: true });
        if (!markerMetadata.isFile() || (markerMetadata.mode & 0o7777n) !== 0o600n ||
            markerMetadata.nlink !== 1n || markerMetadata.uid !== fixedTrustPins.expectedReplayRootOwner.uid ||
            markerMetadata.gid !== fixedTrustPins.expectedReplayRootOwner.gid) {
          fail("consumption_replay_or_durability", "durable_consumption");
        }
        testHooks.beforeMarkerWrite?.();
        writeFileSync(markerDescriptor, content, "utf8");
        testHooks.beforeMarkerFsync?.();
        fsyncSync(markerDescriptor);
        testHooks.beforeMarkerClose?.();
        closeSync(markerDescriptor);
        markerDescriptor = undefined;
        testHooks.beforeDirectoryFsync?.();
        fsyncSync(directoryDescriptor);
        testHooks.beforeDirectoryClose?.();
        closeSync(directoryDescriptor);
        directoryDescriptor = undefined;
      } catch (error) {
        pendingError = error;
      }
      if (markerDescriptor !== undefined) {
        try {
          closeSync(markerDescriptor);
        } catch (error) {
          pendingError ??= error;
        }
      }
      if (directoryDescriptor !== undefined) {
        try {
          closeSync(directoryDescriptor);
        } catch (error) {
          pendingError ??= error;
        }
      }
      if (pendingError !== undefined) throw pendingError;
    },
    readCustodyOnce: (path, identity) => readIdentityBoundFileOnce(path, identity, "custody_read"),
  };
  return Object.freeze(dependencies);
}

export interface M5bFedExGateBSyntheticArtifacts extends M5bFedExGateBCompletedOutputs {
  readonly sourcePackJson: string;
  readonly candidateJson: string;
  readonly reviewPacketJson: string;
  readonly executionReceiptJson: string;
}

/** Fixture-only proof path. It cannot validate or consume private authorization. */
export function generateM5bFedExGateBSyntheticArtifacts(
  fixtureJsonText: string,
): Readonly<M5bFedExGateBSyntheticArtifacts> {
  const sourcePack = buildM5bFedExSanitizedSourcePack(
    extractM5bFedExCommittedFixtureSource(Buffer.from(fixtureJsonText, "utf8")),
  );
  const candidate = buildM5bFedExPrewriteCandidate(sourcePack);
  const reviewPacket = buildM5bFedExReviewPacket(sourcePack, candidate);
  const workshopHtml = finalizeM5bFedExGateBWorkshopBoundary(
    renderM5bFedExPrewriteWorkshopHtml(sourcePack, reviewPacket, candidate),
    "committed-synthetic-fixture",
  );
  const state: ReceiptState = {
    authorizationReads: 0,
    custodyReadAttempts: 0,
    custodyReadsCompleted: 0,
    custodyBytesRead: 0,
    consumptionState: "not_created",
    authorization: null,
    authorizationSha256: null,
    outputs: Object.freeze({ sourcePack, candidate, reviewPacket, workshopHtml }),
  };
  const fixtureTime = M5B_FEDEX_PRODUCTION_PINS.acquiredAt;
  const executionReceipt = buildReceipt(
    state,
    fixtureTime,
    "synthetic-fixture-generated",
    "synthetic_fixture_generation",
    null,
    "committed-synthetic-fixture",
    5,
  );
  return Object.freeze({
    sourcePack,
    candidate,
    reviewPacket,
    workshopHtml,
    sourcePackJson: `${JSON.stringify(sourcePack, null, 2)}\n`,
    candidateJson: `${JSON.stringify(candidate, null, 2)}\n`,
    reviewPacketJson: `${JSON.stringify(reviewPacket, null, 2)}\n`,
    executionReceiptJson: `${JSON.stringify(executionReceipt, null, 2)}\n`,
  });
}

// Public serialized constants are identity, never present-tense authority.
if (!SAFE_HASH.test(M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256) ||
    M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT.length !== 40 ||
    M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE.length !== 40) {
  throw new Error("M5b FedEx Gate B static binding drift");
}
