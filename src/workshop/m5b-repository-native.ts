import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import { GraphStoreConflictError } from "../graph/versioned-store.ts";
import { LocalFileVersionedGraphStore } from "../graph/local-file-versioned-store.ts";
import type { GraphBundle } from "../graph/types.ts";
import { parseGraphBundle } from "../graph/schema.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import { buildWorkshopViewModel } from "./view-model.ts";
import { renderWorkshopHtml } from "./render-html.ts";
import {
  M5B_FEDEX_INPUT_LIMITS,
  admitM5bFedExProductionCustodyBytes,
  buildM5bFedExSanitizedSourcePack,
  canonicalM5bFedExJson,
  extractM5bFedExCommittedFixtureSource,
  sha256M5bFedExCanonical,
  verifyM5bFedExSanitizedSourcePack,
  type M5bFedExSanitizedSourcePack,
} from "./m5b-fedex-system-acquired-source.ts";
import {
  buildM5bFedExPrewriteCandidate,
  buildM5bFedExReviewPacket,
  verifyM5bFedExPrewriteCandidate,
  verifyM5bFedExReviewPacket,
  type M5bFedExPrewriteCandidate,
  type M5bFedExReviewPacket,
} from "./m5b-fedex-review-composition.ts";
import { renderM5bFedExPrewriteWorkshopHtml } from "./m5b-fedex-prewrite-workshop.ts";

export const M5B_REPOSITORY_NATIVE_PREPARE_RESULT_KIND = "m5b-repository-native-prepare-result" as const;
export const M5B_REPOSITORY_NATIVE_RATIFICATION_KIND = "m5b-repository-native-human-ratification" as const;
export const M5B_REPOSITORY_NATIVE_APPLY_RESULT_KIND = "m5b-repository-native-apply-result" as const;

const HASH = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SAFE_AUTHORIZATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_RATIFIER = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SAFE_REASON_CODE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type M5bRepositoryNativeSourceKind = "exact-production-custody" | "committed-synthetic-fixture";

export interface M5bRepositoryNativeSourceIdentity {
  readonly kind: M5bRepositoryNativeSourceKind;
  readonly sha256: string;
  readonly size: number;
}

export interface M5bRepositoryNativePrepareOptions {
  readonly sourcePath: string;
  readonly outputDir: string;
  readonly expectedSource: M5bRepositoryNativeSourceIdentity;
  readonly ownerAuthorizationId: string;
  readonly executionCommit: string;
  readonly executionTree: string;
}

interface PreparedArtifactIdentity {
  readonly name: "source-pack.json" | "candidate.json" | "review-packet.json" | "workshop-pre-ratification.html";
  readonly sha256: string;
  readonly size: number;
}

export interface M5bRepositoryNativePrepareResultContent {
  readonly kind: typeof M5B_REPOSITORY_NATIVE_PREPARE_RESULT_KIND;
  readonly schemaVersion: "1";
  readonly sourceIdentity: M5bRepositoryNativeSourceIdentity;
  readonly sourcePackSha256: string;
  readonly candidateContentSha256: string;
  readonly reviewPacketSha256: string;
  readonly ownerAuthorizationId: string;
  readonly executionCommit: string;
  readonly executionTree: string;
  readonly artifacts: readonly PreparedArtifactIdentity[];
  readonly accounting: {
    readonly explicitSourceReads: 1;
    readonly outputFilesWritten: 5;
    readonly preRatificationWorkshopPages: 1;
    readonly providerCalls: 0;
    readonly acquisitions: 0;
    readonly networkCalls: 0;
    readonly durableLocalGraphWrites: 0;
    readonly deployments: 0;
    readonly retries: 0;
  };
}

export interface M5bRepositoryNativePrepareResult extends M5bRepositoryNativePrepareResultContent {
  readonly resultSha256: string;
}

export interface M5bRepositoryNativeRatificationDecision {
  readonly proposalId: string;
  readonly disposition: "accept" | "reject";
  readonly reasonCode: string;
}

export interface M5bRepositoryNativeRatificationContent {
  readonly kind: typeof M5B_REPOSITORY_NATIVE_RATIFICATION_KIND;
  readonly schemaVersion: "1";
  readonly prepareResultSha256: string;
  readonly sourceSha256: string;
  readonly sourceSize: number;
  readonly sourcePackSha256: string;
  readonly candidateContentSha256: string;
  readonly reviewPacketSha256: string;
  readonly ownerAuthorizationId: string;
  readonly executionCommit: string;
  readonly executionTree: string;
  readonly ratifierId: string;
  readonly ratifiedAt: string;
  readonly retentionDisposition: "accept" | "reject";
  readonly decisions: readonly M5bRepositoryNativeRatificationDecision[];
  readonly currentEffectiveAuthorization: "one-shot-local-durable-graph-write";
  readonly authorizesDurableLocalWrite: true;
  readonly maximumDurableLocalWrites: 1;
  readonly authorizesProviderCall: false;
  readonly authorizesAcquisition: false;
  readonly authorizesNetwork: false;
  readonly authorizesDeployment: false;
  readonly retries: 0;
}

export interface M5bRepositoryNativeRatification extends M5bRepositoryNativeRatificationContent {
  readonly ratificationArtifactSha256: string;
}

export interface M5bRepositoryNativeApplyOptions {
  readonly preparedDir: string;
  readonly ratificationPath: string;
  readonly graphStoreRoot: string;
  readonly outputDir: string;
  /** SHA-256 of the exact ratification file bytes, including formatting and trailing bytes. */
  readonly expectedRatificationSha256: string;
  readonly expectedOwnerAuthorizationId: string;
  readonly expectedExecutionCommit: string;
  readonly expectedExecutionTree: string;
}

export interface M5bRepositoryNativeApplyResultContent {
  readonly kind: typeof M5B_REPOSITORY_NATIVE_APPLY_RESULT_KIND;
  readonly schemaVersion: "1";
  readonly prepareResultSha256: string;
  readonly ratificationRawSha256: string;
  readonly ratificationArtifactSha256: string;
  readonly sourcePackSha256: string;
  readonly candidateContentSha256: string;
  readonly reviewPacketSha256: string;
  readonly sourceKind: M5bRepositoryNativeSourceKind;
  readonly ownerAuthorizationId: string;
  readonly executionCommit: string;
  readonly executionTree: string;
  readonly graphId: string;
  readonly revision: "rev_1";
  readonly graphCommitDisposition: "newly-created" | "existing-exact-finalized-without-write";
  readonly durableBundleSha256: string;
  readonly readBackBundleSha256: string;
  readonly workshopSha256: string;
  readonly decisions: readonly M5bRepositoryNativeRatificationDecision[];
  readonly acceptedProposalIds: readonly string[];
  readonly rejectedProposalIds: readonly string[];
  readonly retentionDecision: {
    readonly retentionDraftId: string;
    readonly deadline: string;
    readonly disposition: "accept" | "reject";
    readonly outcome:
      | "beyond-deadline-retention-approved"
      | "beyond-deadline-retention-not-authorized-external-custody-cleanup-required";
    readonly originalCustodyDeleted: false;
    readonly externalCustodyCleanupRequired: boolean;
  };
  readonly accounting: {
    readonly explicitPreparedArtifactReads: 5;
    readonly explicitRatificationReads: 1;
    readonly durableLocalGraphReads: 1 | 3;
    readonly durableLocalGraphWrites: 0 | 1;
    readonly durableLocalGraphReadBacks: 1;
    readonly workshopPagesRendered: 1 | 2;
    readonly outputFilesWritten: 2;
    readonly providerCalls: 0;
    readonly acquisitions: 0;
    readonly networkCalls: 0;
    readonly deployments: 0;
    readonly retries: 0;
  };
}

export interface M5bRepositoryNativeApplyResult extends M5bRepositoryNativeApplyResultContent {
  readonly resultSha256: string;
}

export class M5bRepositoryNativeRefusal extends Error {
  constructor(public readonly code: string) {
    super(`M5b repository-native flow refused: ${code}`);
    this.name = "M5bRepositoryNativeRefusal";
  }
}

function refuse(code: string): never {
  throw new M5bRepositoryNativeRefusal(code);
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isIso(value: string): boolean {
  if (!ISO.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) refuse(code);
}

function plainRecord(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    refuse(code);
  }
  return value as Record<string, unknown>;
}

function verifySourceIdentity(value: M5bRepositoryNativeSourceIdentity): M5bRepositoryNativeSourceIdentity {
  const record = plainRecord(value, "source_identity");
  exactKeys(record, ["kind", "sha256", "size"], "source_identity");
  if ((value.kind !== "exact-production-custody" && value.kind !== "committed-synthetic-fixture") ||
      typeof value.sha256 !== "string" || !HASH.test(value.sha256) ||
      !Number.isSafeInteger(value.size) || value.size <= 0 || value.size > M5B_FEDEX_INPUT_LIMITS.custodyInputBytes) {
    refuse("source_identity");
  }
  return Object.freeze({ ...value });
}

function verifyExecutionBinding(commit: string, tree: string): void {
  if (!GIT_OID.test(commit) || !GIT_OID.test(tree)) refuse("execution_identity");
}

function verifyOwnerAuthorization(value: string): void {
  if (!SAFE_AUTHORIZATION.test(value)) refuse("owner_authorization");
}

async function assertDestinationAbsent(path: string, code: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  refuse(code);
}

async function canonicalPathWithoutSymlinks(input: string): Promise<string> {
  const absolute = resolve(input);
  const root = parse(absolute).root;
  const segments = absolute.slice(root.length).split(sep).filter((segment) => segment.length > 0);
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    const next = join(cursor, segments[index]!);
    let metadata;
    try {
      metadata = await lstat(next);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const canonicalParent = await realpath(cursor).catch(() => refuse("path_parent"));
        return resolve(canonicalParent, ...segments.slice(index));
      }
      refuse("path_component");
    }
    if (metadata.isSymbolicLink()) refuse("symlink_path");
    if (index < segments.length - 1 && !metadata.isDirectory()) refuse("path_component");
    cursor = next;
  }
  return realpath(absolute).catch(() => refuse("path_component"));
}

async function requireExistingPath(input: string, expected: "file" | "directory", code: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(input);
  let metadata;
  try {
    metadata = await lstat(resolve(input));
  } catch {
    refuse(code);
  }
  if ((expected === "file" && !metadata.isFile()) || (expected === "directory" && !metadata.isDirectory())) {
    refuse(code);
  }
  return canonical;
}

async function requireGraphStoreRoot(input: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(input);
  try {
    const metadata = await lstat(resolve(input));
    if (!metadata.isDirectory()) refuse("graph_store_root");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") refuse("graph_store_root");
  }
  return canonical;
}

async function requireNewOutputDirectory(input: string): Promise<string> {
  const absolute = resolve(input);
  const canonical = await canonicalPathWithoutSymlinks(absolute);
  await assertDestinationAbsent(absolute, "output_exists");
  let parentMetadata;
  try {
    parentMetadata = await lstat(dirname(absolute));
  } catch {
    refuse("output_parent_missing");
  }
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) refuse("output_parent_missing");
  return canonical;
}

function containsPath(parent: string, child: string): boolean {
  const relation = relative(parent, child);
  return relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${sep}`));
}

function pathsOverlap(left: string, right: string): boolean {
  return containsPath(left, right) || containsPath(right, left);
}

async function publishDirectory(outputDir: string, files: Readonly<Record<string, Uint8Array | string>>): Promise<void> {
  const staged = await stageDirectory(outputDir, files);
  try {
    await rename(staged.staging, staged.destination);
  } catch (error) {
    await rm(staged.staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

interface StagedDirectory {
  readonly destination: string;
  readonly staging: string;
}

async function stageDirectory(
  outputDir: string,
  files: Readonly<Record<string, Uint8Array | string>>,
): Promise<StagedDirectory> {
  const destination = resolve(outputDir);
  await assertDestinationAbsent(destination, "output_exists");
  const parent = dirname(destination);
  const staging = join(parent, `.${basename(destination)}.${process.pid}.${randomUUID()}.tmp`);
  await mkdir(staging, { recursive: false, mode: 0o700 });
  try {
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(join(staging, name), contents, { flag: "wx", mode: 0o600 });
    }
    return Object.freeze({ destination, staging });
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function artifactIdentity(name: PreparedArtifactIdentity["name"], bytes: Uint8Array): PreparedArtifactIdentity {
  return Object.freeze({ name, sha256: sha256Bytes(bytes), size: bytes.byteLength });
}

export async function prepareM5bRepositoryNative(
  options: M5bRepositoryNativePrepareOptions,
): Promise<Readonly<M5bRepositoryNativePrepareResult>> {
  if (!options.sourcePath || !options.outputDir) refuse("explicit_paths_required");
  const expectedSource = verifySourceIdentity(options.expectedSource);
  verifyOwnerAuthorization(options.ownerAuthorizationId);
  verifyExecutionBinding(options.executionCommit, options.executionTree);
  const sourcePath = await requireExistingPath(options.sourcePath, "file", "source_path");
  const outputDir = await requireNewOutputDirectory(options.outputDir);
  if (pathsOverlap(sourcePath, outputDir)) refuse("path_overlap");

  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size !== expectedSource.size) refuse("source_size");
  const sourceBytes = await readFile(sourcePath);
  if (sourceBytes.byteLength !== expectedSource.size || sha256Bytes(sourceBytes) !== expectedSource.sha256) {
    refuse("source_identity_mismatch");
  }

  const bounded = expectedSource.kind === "exact-production-custody"
    ? admitM5bFedExProductionCustodyBytes(sourceBytes)
    : extractM5bFedExCommittedFixtureSource(sourceBytes);
  const sourcePack = buildM5bFedExSanitizedSourcePack(bounded);
  const candidate = buildM5bFedExPrewriteCandidate(sourcePack);
  const reviewPacket = buildM5bFedExReviewPacket(sourcePack, candidate);
  const workshop = renderM5bFedExPrewriteWorkshopHtml(sourcePack, reviewPacket, candidate);

  const sourcePackBytes = jsonBytes(sourcePack);
  const candidateBytes = jsonBytes(candidate);
  const reviewPacketBytes = jsonBytes(reviewPacket);
  const workshopBytes = Buffer.from(workshop, "utf8");
  const artifacts = Object.freeze([
    artifactIdentity("source-pack.json", sourcePackBytes),
    artifactIdentity("candidate.json", candidateBytes),
    artifactIdentity("review-packet.json", reviewPacketBytes),
    artifactIdentity("workshop-pre-ratification.html", workshopBytes),
  ]);
  const content: M5bRepositoryNativePrepareResultContent = Object.freeze({
    kind: M5B_REPOSITORY_NATIVE_PREPARE_RESULT_KIND,
    schemaVersion: "1",
    sourceIdentity: expectedSource,
    sourcePackSha256: sourcePack.sourcePackSha256,
    candidateContentSha256: candidate.candidateContentSha256,
    reviewPacketSha256: reviewPacket.packetSha256,
    ownerAuthorizationId: options.ownerAuthorizationId,
    executionCommit: options.executionCommit,
    executionTree: options.executionTree,
    artifacts,
    accounting: Object.freeze({ explicitSourceReads: 1, outputFilesWritten: 5, preRatificationWorkshopPages: 1, providerCalls: 0,
      acquisitions: 0, networkCalls: 0, durableLocalGraphWrites: 0, deployments: 0, retries: 0 }),
  });
  const result: M5bRepositoryNativePrepareResult = Object.freeze({
    ...content,
    resultSha256: sha256M5bFedExCanonical(content),
  });
  await publishDirectory(outputDir, {
    "source-pack.json": sourcePackBytes,
    "candidate.json": candidateBytes,
    "review-packet.json": reviewPacketBytes,
    "workshop-pre-ratification.html": workshopBytes,
    "prepare-result.json": jsonBytes(result),
  });
  return result;
}

async function readJson(path: string, code: string): Promise<unknown> {
  let text: string;
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) refuse(code);
    text = await readFile(path, "utf8");
  } catch { refuse(code); }
  try { return JSON.parse(text); } catch { refuse(code); }
}

function verifyPrepareResult(value: unknown): M5bRepositoryNativePrepareResult {
  const result = plainRecord(value, "prepare_result") as unknown as M5bRepositoryNativePrepareResult;
  exactKeys(result as unknown as Record<string, unknown>, ["kind", "schemaVersion", "sourceIdentity",
    "sourcePackSha256", "candidateContentSha256", "reviewPacketSha256", "ownerAuthorizationId",
    "executionCommit", "executionTree", "artifacts", "accounting", "resultSha256"], "prepare_result");
  const { resultSha256, ...content } = result;
  if (result.kind !== M5B_REPOSITORY_NATIVE_PREPARE_RESULT_KIND || result.schemaVersion !== "1" ||
      !HASH.test(resultSha256) || sha256M5bFedExCanonical(content) !== resultSha256 ||
      !HASH.test(result.sourcePackSha256) || !HASH.test(result.candidateContentSha256) ||
      !HASH.test(result.reviewPacketSha256)) refuse("prepare_result");
  verifySourceIdentity(result.sourceIdentity);
  verifyOwnerAuthorization(result.ownerAuthorizationId);
  verifyExecutionBinding(result.executionCommit, result.executionTree);
  const accounting = plainRecord(result.accounting, "prepare_accounting");
  exactKeys(accounting, ["explicitSourceReads", "outputFilesWritten", "preRatificationWorkshopPages",
    "providerCalls", "acquisitions", "networkCalls", "durableLocalGraphWrites", "deployments", "retries"],
  "prepare_accounting");
  if (!Array.isArray(result.artifacts) || result.artifacts.length !== 4 ||
      result.accounting.explicitSourceReads !== 1 || result.accounting.outputFilesWritten !== 5 ||
      result.accounting.preRatificationWorkshopPages !== 1 ||
      result.accounting.providerCalls !== 0 || result.accounting.acquisitions !== 0 ||
      result.accounting.networkCalls !== 0 || result.accounting.durableLocalGraphWrites !== 0 ||
      result.accounting.deployments !== 0 || result.accounting.retries !== 0) refuse("prepare_result");
  const expectedArtifactNames = ["candidate.json", "review-packet.json", "source-pack.json",
    "workshop-pre-ratification.html"];
  const actualArtifactNames = result.artifacts.map((artifact) => {
    const record = plainRecord(artifact, "prepare_artifact_identity");
    exactKeys(record, ["name", "sha256", "size"], "prepare_artifact_identity");
    if (typeof artifact.name !== "string" || !HASH.test(artifact.sha256) ||
        !Number.isSafeInteger(artifact.size) || artifact.size <= 0) refuse("prepare_artifact_identity");
    return artifact.name;
  }).sort();
  if (canonicalM5bFedExJson(actualArtifactNames) !== canonicalM5bFedExJson(expectedArtifactNames)) {
    refuse("prepare_artifact_identity");
  }
  return result;
}

async function readAndVerifyPreparedArtifact(preparedDir: string, identity: PreparedArtifactIdentity): Promise<Buffer> {
  if (!identity || typeof identity.name !== "string" || !HASH.test(identity.sha256) ||
      !Number.isSafeInteger(identity.size) || identity.size <= 0) refuse("prepared_artifact_identity");
  const path = join(preparedDir, identity.name);
  const metadata = await lstat(path).catch(() => refuse("prepared_artifact_read"));
  if (!metadata.isFile() || metadata.isSymbolicLink()) refuse("prepared_artifact_read");
  const bytes = await readFile(path).catch(() => refuse("prepared_artifact_read"));
  if (bytes.byteLength !== identity.size || sha256Bytes(bytes) !== identity.sha256) refuse("prepared_artifact_tamper");
  return bytes;
}

function verifyRatification(value: unknown, prepare: M5bRepositoryNativePrepareResult,
  packet: M5bFedExReviewPacket): M5bRepositoryNativeRatification {
  const ratification = plainRecord(value, "ratification") as unknown as M5bRepositoryNativeRatification;
  exactKeys(ratification as unknown as Record<string, unknown>, ["kind", "schemaVersion", "prepareResultSha256",
    "sourceSha256", "sourceSize", "sourcePackSha256", "candidateContentSha256", "reviewPacketSha256",
    "ownerAuthorizationId", "executionCommit", "executionTree", "ratifierId", "ratifiedAt",
    "retentionDisposition", "decisions", "currentEffectiveAuthorization", "authorizesDurableLocalWrite",
    "maximumDurableLocalWrites", "authorizesProviderCall", "authorizesAcquisition", "authorizesNetwork",
    "authorizesDeployment", "retries", "ratificationArtifactSha256"], "ratification_envelope");
  const { ratificationArtifactSha256, ...content } = ratification;
  if (ratification.kind !== M5B_REPOSITORY_NATIVE_RATIFICATION_KIND || ratification.schemaVersion !== "1" ||
      !HASH.test(ratificationArtifactSha256) || sha256M5bFedExCanonical(content) !== ratificationArtifactSha256 ||
      ratification.prepareResultSha256 !== prepare.resultSha256 ||
      ratification.sourceSha256 !== prepare.sourceIdentity.sha256 || ratification.sourceSize !== prepare.sourceIdentity.size ||
      ratification.sourcePackSha256 !== prepare.sourcePackSha256 ||
      ratification.candidateContentSha256 !== prepare.candidateContentSha256 ||
      ratification.reviewPacketSha256 !== prepare.reviewPacketSha256 ||
      ratification.ownerAuthorizationId !== prepare.ownerAuthorizationId ||
      ratification.executionCommit !== prepare.executionCommit || ratification.executionTree !== prepare.executionTree ||
      !SAFE_RATIFIER.test(ratification.ratifierId) || !isIso(ratification.ratifiedAt) ||
      (ratification.retentionDisposition !== "accept" && ratification.retentionDisposition !== "reject") ||
      ratification.currentEffectiveAuthorization !== "one-shot-local-durable-graph-write" ||
      ratification.authorizesDurableLocalWrite !== true || ratification.maximumDurableLocalWrites !== 1 ||
      ratification.authorizesProviderCall !== false || ratification.authorizesAcquisition !== false ||
      ratification.authorizesNetwork !== false || ratification.authorizesDeployment !== false ||
      ratification.retries !== 0 || !Array.isArray(ratification.decisions) ||
      ratification.decisions.length !== packet.proposals.length) refuse("ratification_binding");
  const seen = new Set<string>();
  for (const [index, decision] of ratification.decisions.entries()) {
    const record = plainRecord(decision, "ratification_decision");
    exactKeys(record, ["proposalId", "disposition", "reasonCode"], "ratification_decision");
    if (decision.proposalId !== packet.proposals[index]?.proposalId || seen.has(decision.proposalId) ||
        (decision.disposition !== "accept" && decision.disposition !== "reject") ||
        !SAFE_REASON_CODE.test(decision.reasonCode)) refuse("ratification_decision");
    seen.add(decision.proposalId);
  }
  return ratification;
}

function proposalObjectId(proposalId: string): string {
  return `obj_fedex_${proposalId.replace(/^m5b-fedex-/, "").replaceAll("-", "_")}`;
}

function durableBundle(
  candidate: M5bFedExPrewriteCandidate,
  ratification: M5bRepositoryNativeRatification,
  ratificationRawSha256: string,
  packet: M5bFedExReviewPacket,
): GraphBundle {
  const acceptedObjectIds = new Set(ratification.decisions.filter((decision) => decision.disposition === "accept")
    .map((decision) => proposalObjectId(decision.proposalId)));
  const accountObjects = candidate.bundle.account_objects.filter((item) => acceptedObjectIds.has(item.id)).map((item) => ({
    ...item, provenance_status: "source_document_only" as const, updated_at: ratification.ratifiedAt,
    payload_json: { ...item.payload_json, review_state: "human ratified", ratification_artifact_sha256: ratification.ratificationArtifactSha256 },
  }));
  if (accountObjects.length !== acceptedObjectIds.size) refuse("ratification_candidate_mapping");
  const objectClaims = candidate.bundle.account_object_claims.filter((item) => acceptedObjectIds.has(item.account_object_id));
  const acceptedClaimIds = new Set(objectClaims.map((item) => item.claim_id));
  const claims = candidate.bundle.claims.filter((item) => acceptedClaimIds.has(item.id)).map((item) => ({
    ...item, provenance_status: "source_document_only" as const,
  }));
  const claimEvidence = candidate.bundle.claim_evidence.filter((item) => acceptedClaimIds.has(item.claim_id));
  const acceptedExcerptIds = new Set(claimEvidence.map((item) => item.evidence_excerpt_id));
  const excerpts = candidate.bundle.excerpts.filter((item) => acceptedExcerptIds.has(item.id)).map((item) => ({
    ...item, validation_status: "accepted" as const,
  }));
  const auditEvents: GraphBundle["audit_events"] = ratification.decisions.map((decision, index) => ({
    id: `aud_m5b_${ratification.ratificationArtifactSha256.slice(0, 16)}_${index}`,
    team_id: candidate.bundle.account_objects[0]?.team_id ?? "team_local",
    actor_type: "user" as const,
    actor_id: ratification.ratifierId,
    event_type: decision.disposition === "accept" ? "claim.ratified" : "claim.rejected",
    target_type: decision.disposition === "accept" ? "account_object" : "account_object_candidate",
    target_id: proposalObjectId(decision.proposalId),
    payload_json: {
      disposition: decision.disposition,
      reason_code: decision.reasonCode,
      owner_authorization_id: ratification.ownerAuthorizationId,
      ratification_raw_sha256: ratificationRawSha256,
      ratification_artifact_sha256: ratification.ratificationArtifactSha256,
      review_packet_sha256: ratification.reviewPacketSha256,
      candidate_content_sha256: ratification.candidateContentSha256,
      execution_commit: ratification.executionCommit,
      execution_tree: ratification.executionTree,
      ratification_mode: "repository-native-one-shot-local-write",
    },
    created_at: ratification.ratifiedAt,
  }));
  const retentionAccepted = ratification.retentionDisposition === "accept";
  auditEvents.push({
    id: `aud_m5b_${ratification.ratificationArtifactSha256.slice(0, 16)}_retention`,
    team_id: candidate.bundle.sources[0]?.team_id ?? "team_local",
    actor_type: "user" as const,
    actor_id: ratification.ratifierId,
    event_type: "source.retention_decided",
    target_type: "source_custody_retention_draft",
    target_id: packet.retentionDraft.retentionDraftId,
    payload_json: {
      ratifier_id: ratification.ratifierId,
      ratification_raw_sha256: ratificationRawSha256,
      ratification_artifact_sha256: ratification.ratificationArtifactSha256,
      review_packet_sha256: ratification.reviewPacketSha256,
      retention_draft_id: packet.retentionDraft.retentionDraftId,
      deadline: packet.retentionDraft.deadline,
      disposition: ratification.retentionDisposition,
      outcome: retentionAccepted
        ? "beyond-deadline-retention-approved"
        : "beyond-deadline-retention-not-authorized-external-custody-cleanup-required",
      original_custody_deleted: false,
      external_custody_cleanup_required: !retentionAccepted,
    },
    created_at: ratification.ratifiedAt,
  });
  const bundle: GraphBundle = {
    sources: candidate.bundle.sources.map((item) => ({ ...item })),
    excerpts,
    claims,
    claim_evidence: claimEvidence.map((item) => ({ ...item })),
    account_objects: accountObjects,
    account_object_claims: objectClaims.map((item) => ({ ...item })),
    research_runs: [],
    run_artifacts: [],
    audit_events: auditEvents,
  };
  const parsed = parseGraphBundle(bundle);
  if (!parsed.ok || !validateGraphBundle(parsed.value, { mode: "fixture" }).ok) refuse("durable_bundle_validation");
  return parsed.value;
}

export async function applyM5bRepositoryNative(
  options: M5bRepositoryNativeApplyOptions,
): Promise<Readonly<M5bRepositoryNativeApplyResult>> {
  if (!options.preparedDir || !options.ratificationPath || !options.graphStoreRoot || !options.outputDir ||
      !options.expectedRatificationSha256 || !options.expectedOwnerAuthorizationId ||
      !options.expectedExecutionCommit || !options.expectedExecutionTree) {
    refuse("explicit_paths_required");
  }
  if (!HASH.test(options.expectedRatificationSha256)) refuse("expected_ratification_sha256");
  verifyOwnerAuthorization(options.expectedOwnerAuthorizationId);
  verifyExecutionBinding(options.expectedExecutionCommit, options.expectedExecutionTree);

  const preparedDir = await requireExistingPath(options.preparedDir, "directory", "prepared_dir");
  const ratificationPath = await requireExistingPath(options.ratificationPath, "file", "ratification_path");
  const graphStoreRoot = await requireGraphStoreRoot(options.graphStoreRoot);
  const outputDir = await requireNewOutputDirectory(options.outputDir);
  const separatedPaths = [preparedDir, ratificationPath, graphStoreRoot, outputDir];
  if (separatedPaths.some((left, index) =>
    separatedPaths.slice(index + 1).some((right) => pathsOverlap(left, right)))) {
    refuse("explicit_path_overlap");
  }

  const prepare = verifyPrepareResult(await readJson(join(preparedDir, "prepare-result.json"), "prepare_result_read"));
  const identities = new Map(prepare.artifacts.map((item) => [item.name, item]));
  const sourcePackBytes = await readAndVerifyPreparedArtifact(preparedDir, identities.get("source-pack.json")!);
  const candidateBytes = await readAndVerifyPreparedArtifact(preparedDir, identities.get("candidate.json")!);
  const reviewPacketBytes = await readAndVerifyPreparedArtifact(preparedDir, identities.get("review-packet.json")!);
  await readAndVerifyPreparedArtifact(preparedDir, identities.get("workshop-pre-ratification.html")!);

  let sourcePackRaw: unknown; let candidateRaw: unknown; let reviewPacketRaw: unknown;
  try {
    sourcePackRaw = JSON.parse(sourcePackBytes.toString("utf8"));
    candidateRaw = JSON.parse(candidateBytes.toString("utf8"));
    reviewPacketRaw = JSON.parse(reviewPacketBytes.toString("utf8"));
  } catch { refuse("prepared_artifact_json"); }
  const sourcePack = verifyM5bFedExSanitizedSourcePack(sourcePackRaw) as Readonly<M5bFedExSanitizedSourcePack>;
  const candidate = verifyM5bFedExPrewriteCandidate(candidateRaw, sourcePack);
  const packet = verifyM5bFedExReviewPacket(reviewPacketRaw, sourcePack, candidate);
  if (sourcePack.sourcePackSha256 !== prepare.sourcePackSha256 ||
      candidate.candidateContentSha256 !== prepare.candidateContentSha256 || packet.packetSha256 !== prepare.reviewPacketSha256) {
    refuse("prepared_binding");
  }
  const productionSource = prepare.sourceIdentity.kind === "exact-production-custody";
  if (sourcePack.exactProductionCustodyAdmissionCompleted !== productionSource) refuse("prepared_source_kind_binding");

  const ratificationBytes = await readFile(ratificationPath).catch(() => refuse("ratification_read"));
  const ratificationRawSha256 = sha256Bytes(ratificationBytes);
  if (ratificationRawSha256 !== options.expectedRatificationSha256) refuse("ratification_raw_sha256");
  let ratificationRaw: unknown;
  try {
    ratificationRaw = JSON.parse(ratificationBytes.toString("utf8"));
  } catch {
    refuse("ratification_read");
  }
  const ratification = verifyRatification(ratificationRaw, prepare, packet);
  if (prepare.ownerAuthorizationId !== options.expectedOwnerAuthorizationId ||
      ratification.ownerAuthorizationId !== options.expectedOwnerAuthorizationId) {
    refuse("expected_owner_authorization");
  }
  if (prepare.executionCommit !== options.expectedExecutionCommit ||
      ratification.executionCommit !== options.expectedExecutionCommit) {
    refuse("expected_execution_commit");
  }
  if (prepare.executionTree !== options.expectedExecutionTree ||
      ratification.executionTree !== options.expectedExecutionTree) {
    refuse("expected_execution_tree");
  }

  const bundle = durableBundle(candidate, ratification, ratificationRawSha256, packet);
  const durableBundleSha256 = sha256M5bFedExCanonical(bundle);
  const graphId = `accounts/acc_fedex_corp/m5b/${candidate.candidateContentSha256}`;
  const store = new LocalFileVersionedGraphStore(graphStoreRoot);
  const existing = await store.load(graphId);
  if (existing && (existing.revision !== "rev_1" ||
      canonicalM5bFedExJson(existing.bundle) !== canonicalM5bFedExJson(bundle))) {
    refuse("existing_graph_mismatch");
  }
  if (existing) {
    const retentionEvents = existing.bundle.audit_events.filter((event) =>
      event.event_type === "source.retention_decided" &&
      event.target_id === packet.retentionDraft.retentionDraftId);
    const binding = retentionEvents[0]?.payload_json;
    if (retentionEvents.length !== 1 ||
        binding?.ratification_raw_sha256 !== ratificationRawSha256 ||
        binding?.ratification_artifact_sha256 !== ratification.ratificationArtifactSha256) {
      refuse("existing_ratification_mismatch");
    }
  }

  const graphCommitDisposition = existing
    ? "existing-exact-finalized-without-write" as const
    : "newly-created" as const;
  const previewMode = m5bRepositoryNativePreviewModeForSourceKind(prepare.sourceIdentity.kind);
  const workshopBytes = Buffer.from(renderWorkshopHtml(buildWorkshopViewModel(existing?.bundle ?? bundle), {
    previewMode,
  }), "utf8");
  const acceptedProposalIds = Object.freeze(ratification.decisions.filter((item) => item.disposition === "accept").map((item) => item.proposalId));
  const rejectedProposalIds = Object.freeze(ratification.decisions.filter((item) => item.disposition === "reject").map((item) => item.proposalId));
  const decisions = Object.freeze(ratification.decisions.map((decision) => Object.freeze({ ...decision })));
  const retentionAccepted = ratification.retentionDisposition === "accept";
  const retentionDecision = Object.freeze({
    retentionDraftId: packet.retentionDraft.retentionDraftId,
    deadline: packet.retentionDraft.deadline,
    disposition: ratification.retentionDisposition,
    outcome: retentionAccepted
      ? "beyond-deadline-retention-approved" as const
      : "beyond-deadline-retention-not-authorized-external-custody-cleanup-required" as const,
    originalCustodyDeleted: false as const,
    externalCustodyCleanupRequired: !retentionAccepted,
  });
  const content: M5bRepositoryNativeApplyResultContent = Object.freeze({
    kind: M5B_REPOSITORY_NATIVE_APPLY_RESULT_KIND,
    schemaVersion: "1",
    prepareResultSha256: prepare.resultSha256,
    ratificationRawSha256,
    ratificationArtifactSha256: ratification.ratificationArtifactSha256,
    sourcePackSha256: sourcePack.sourcePackSha256,
    candidateContentSha256: candidate.candidateContentSha256,
    reviewPacketSha256: packet.packetSha256,
    sourceKind: prepare.sourceIdentity.kind,
    ownerAuthorizationId: prepare.ownerAuthorizationId,
    executionCommit: prepare.executionCommit,
    executionTree: prepare.executionTree,
    graphId,
    revision: "rev_1",
    graphCommitDisposition,
    durableBundleSha256,
    readBackBundleSha256: durableBundleSha256,
    workshopSha256: sha256Bytes(workshopBytes),
    decisions,
    acceptedProposalIds,
    rejectedProposalIds,
    retentionDecision,
    accounting: Object.freeze({ explicitPreparedArtifactReads: 5, explicitRatificationReads: 1,
      durableLocalGraphReads: existing ? 1 : 3, durableLocalGraphWrites: existing ? 0 : 1,
      durableLocalGraphReadBacks: 1, workshopPagesRendered: existing ? 1 : 2,
      outputFilesWritten: 2, providerCalls: 0, acquisitions: 0, networkCalls: 0, deployments: 0, retries: 0 }),
  });
  const result: M5bRepositoryNativeApplyResult = Object.freeze({ ...content, resultSha256: sha256M5bFedExCanonical(content) });
  const staged = await stageDirectory(outputDir, {
    "workshop-final.html": workshopBytes,
    "apply-result.json": jsonBytes(result),
  });
  try {
    let readBack = existing;
    if (!readBack) {
      let committed;
      try {
        committed = await store.commit(graphId, bundle, { mode: "local-product", expectedRevision: null });
      } catch (error) {
        if (error instanceof GraphStoreConflictError) refuse("graph_commit_conflict");
        throw error;
      }
      if (committed.revision !== "rev_1" ||
          canonicalM5bFedExJson(committed.bundle) !== canonicalM5bFedExJson(bundle)) {
        refuse("unexpected_commit");
      }
      readBack = await store.load(graphId);
      if (!readBack) refuse("read_back_missing");
    }
    const readBackBundleSha256 = sha256M5bFedExCanonical(readBack.bundle);
    if (readBack.revision !== "rev_1" || readBackBundleSha256 !== durableBundleSha256 ||
        canonicalM5bFedExJson(readBack.bundle) !== canonicalM5bFedExJson(bundle)) {
      refuse("read_back_mismatch");
    }
    if (!existing) {
      const readBackWorkshopBytes = Buffer.from(renderWorkshopHtml(buildWorkshopViewModel(readBack.bundle), {
        previewMode,
      }), "utf8");
      if (sha256Bytes(readBackWorkshopBytes) !== result.workshopSha256) {
        refuse("read_back_render_mismatch");
      }
    }
    await rename(staged.staging, staged.destination);
    return result;
  } finally {
    await rm(staged.staging, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function m5bRepositoryNativePreviewModeForSourceKind(
  sourceKind: M5bRepositoryNativeSourceKind,
): "durable-system-acquired" | "durable-synthetic-fixture" {
  if (sourceKind === "exact-production-custody") return "durable-system-acquired";
  if (sourceKind === "committed-synthetic-fixture") return "durable-synthetic-fixture";
  refuse("source_kind");
}

export function verifyM5bRepositoryNativeRatificationArtifactHash(value: M5bRepositoryNativeRatificationContent): string {
  return sha256M5bFedExCanonical(value);
}

export function canonicalM5bRepositoryNativeJson(value: unknown): string {
  return canonicalM5bFedExJson(value);
}
