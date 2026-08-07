import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeSync,
} from "node:fs";
import { basename, isAbsolute, join, normalize } from "node:path";

import {
  assertExactKeys,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "./strict-json.ts";

export const M5B_PRODUCT_EFFECT_GO_KIND = "m5b-product-effect-one-shot-go" as const;
export const M5B_PRODUCT_EFFECT_GO_VERSION = "1" as const;
export const M5B_PRODUCT_EFFECT_LEDGER_RECORD_KIND = "m5b-product-effect-consumption" as const;

export type M5bProductEffectOperation = "retained_custody_read" | "exact_sec_archive_acquisition";

export interface M5bProductEffectSourceIdentity {
  readonly sourceId: string;
  readonly canonicalUrl: string;
  readonly targetPolicySha256: string;
  readonly outerSha256: string | null;
  readonly outerByteSize: number | null;
  readonly decodedSha256: string | null;
  readonly decodedByteSize: number | null;
}

export interface M5bProductEffectExpectedAuthority {
  readonly operation: M5bProductEffectOperation;
  readonly authorityId: string;
  readonly consumptionId: string;
  readonly ledgerRootSha256: string;
  readonly implementationCommit: string;
  readonly implementationTree: string;
  readonly targetPolicySha256: string;
  readonly sourceIdentities: readonly M5bProductEffectSourceIdentity[];
}

export interface M5bProductEffectConsumption {
  readonly operation: M5bProductEffectOperation;
  readonly authorityId: string;
  readonly consumptionId: string;
  readonly ledgerRootSha256: string;
  readonly implementationCommit: string;
  readonly implementationTree: string;
  readonly targetPolicySha256: string;
  readonly sourceIdentities: readonly M5bProductEffectSourceIdentity[];
  readonly authorizedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly consumedAt: string;
  readonly ledgerNamespaceSha256: string;
  readonly ledgerRecordSha256: string;
  readonly goCanonicalSha256: string;
}

export interface M5bProductEffectLedger {
  readonly kind: "m5b-product-effect-ledger";
  readonly ledgerRootSha256: string;
}

export interface M5bProductEffectAttempt {
  readonly kind: "m5b-product-effect-attempt";
}

export class M5bProductEffectAuthorityRefusal extends Error {
  constructor(public readonly code: string) {
    super(`M5b product effect authority refused: ${code}`);
    this.name = "M5bProductEffectAuthorityRefusal";
  }
}

function refuse(code: string): never {
  throw new M5bProductEffectAuthorityRefusal(code);
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_OID = /^[a-f0-9]{40}$/u;
const AUTHORITY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/u;
const STRICT_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const GO_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 16,
  max_depth: 8,
  max_expanded_json_value_occurrences: 512,
  max_nodes: 96,
  max_object_fields: 20,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 48 * 1024,
});
const EXPECTED_LIMITS: StrictJsonLimits = GO_LIMITS;

interface ValidatedGo extends M5bProductEffectExpectedAuthority {
  readonly authorizedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly goCanonicalSha256: string;
}

interface FileIdentity {
  readonly dev: number;
  readonly ino: number;
}

interface LedgerState {
  readonly root: string;
  readonly ledgerRootSha256: string;
  readonly rootIdentity: FileIdentity;
}

interface AttemptState {
  readonly ledger: LedgerState;
  readonly go: ValidatedGo;
  status: "available" | "claimed";
}

interface ConsumptionState {
  readonly ledger: LedgerState;
  readonly path: string;
  readonly recordIdentity: FileIdentity;
  readonly recordSha256: string;
}

const LEDGERS = new WeakMap<object, LedgerState>();
const ATTEMPTS = new WeakMap<object, AttemptState>();
const CONSUMPTIONS = new WeakMap<object, ConsumptionState>();

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !STRICT_TIMESTAMP.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function identity(value: { readonly dev: number | bigint; readonly ino: number | bigint } | undefined): FileIdentity {
  if (value === undefined || typeof value.dev !== "number" || typeof value.ino !== "number") {
    return refuse("filesystem_identity");
  }
  return Object.freeze({ dev: value.dev, ino: value.ino });
}

function sameIdentity(
  left: FileIdentity,
  right: { readonly dev: number | bigint; readonly ino: number | bigint } | undefined,
): boolean {
  return right !== undefined && typeof right.dev === "number" && typeof right.ino === "number" &&
    left.dev === right.dev && left.ino === right.ino;
}

function objectAt(value: StrictJsonValue | undefined, keys: readonly string[], code: string): Record<string, StrictJsonValue> {
  let object: Record<string, StrictJsonValue>;
  try {
    object = strictJsonObject(value as StrictJsonValue, code);
    assertExactKeys(object, keys, code);
  } catch {
    refuse(code);
  }
  return object;
}

function sourceIdentitiesAt(value: StrictJsonValue | undefined, operation: M5bProductEffectOperation): readonly M5bProductEffectSourceIdentity[] {
  let array: StrictJsonValue[];
  try {
    array = strictJsonArray(value, "source_identities", 16, true);
  } catch {
    refuse("source_identities");
  }
  const identities = array.map((item) => {
    const source = objectAt(item, ["sourceId", "canonicalUrl", "targetPolicySha256", "outerSha256", "outerByteSize", "decodedSha256",
      "decodedByteSize"], "source_identity");
    if (typeof source.sourceId !== "string" || !SOURCE_ID.test(source.sourceId) ||
        typeof source.canonicalUrl !== "string" || source.canonicalUrl.length > 2_048 ||
        typeof source.targetPolicySha256 !== "string" || !SHA256.test(source.targetPolicySha256) ||
        (source.outerSha256 !== null && (typeof source.outerSha256 !== "string" || !SHA256.test(source.outerSha256))) ||
        (source.decodedSha256 !== null && (typeof source.decodedSha256 !== "string" || !SHA256.test(source.decodedSha256))) ||
        (source.outerByteSize !== null && (!Number.isSafeInteger(source.outerByteSize) || (source.outerByteSize as number) <= 0)) ||
        (source.decodedByteSize !== null && (!Number.isSafeInteger(source.decodedByteSize) || (source.decodedByteSize as number) <= 0))) {
      refuse("source_identity");
    }
    let parsed: URL;
    try {
      parsed = new URL(source.canonicalUrl);
    } catch {
      refuse("source_identity");
    }
    if (parsed.href !== source.canonicalUrl || parsed.protocol !== "https:" || parsed.username !== "" ||
        parsed.password !== "" || parsed.port !== "" || parsed.search !== "" || parsed.hash !== "") {
      refuse("source_identity");
    }
    const readIdentity = operation === "retained_custody_read";
    if (readIdentity !== (source.outerSha256 !== null && source.outerByteSize !== null &&
        source.decodedSha256 !== null && source.decodedByteSize !== null)) {
      refuse("source_identity");
    }
    return Object.freeze({
      sourceId: source.sourceId,
      canonicalUrl: source.canonicalUrl,
      targetPolicySha256: source.targetPolicySha256,
      outerSha256: source.outerSha256 as string | null,
      outerByteSize: source.outerByteSize as number | null,
      decodedSha256: source.decodedSha256 as string | null,
      decodedByteSize: source.decodedByteSize as number | null,
    });
  });
  if (new Set(identities.map((item) => item.sourceId)).size !== identities.length ||
      new Set(identities.map((item) => item.canonicalUrl)).size !== identities.length ||
      (operation === "exact_sec_archive_acquisition" && identities.length !== 1)) {
    refuse("source_identities");
  }
  return Object.freeze(identities);
}

function snapshotExpected(raw: unknown): Readonly<M5bProductEffectExpectedAuthority> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "expected_authority", EXPECTED_LIMITS);
  } catch {
    refuse("expected_authority_plain_data");
  }
  const root = objectAt(snapshot, ["operation", "authorityId", "consumptionId", "ledgerRootSha256", "implementationCommit",
    "implementationTree", "targetPolicySha256", "sourceIdentities"], "expected_authority_shape");
  if ((root.operation !== "retained_custody_read" && root.operation !== "exact_sec_archive_acquisition") ||
      typeof root.authorityId !== "string" || !AUTHORITY_ID.test(root.authorityId) ||
      typeof root.consumptionId !== "string" || !AUTHORITY_ID.test(root.consumptionId) ||
      typeof root.ledgerRootSha256 !== "string" || !SHA256.test(root.ledgerRootSha256) ||
      typeof root.implementationCommit !== "string" || !GIT_OID.test(root.implementationCommit) ||
      typeof root.implementationTree !== "string" || !GIT_OID.test(root.implementationTree) ||
      typeof root.targetPolicySha256 !== "string" || !SHA256.test(root.targetPolicySha256)) {
    refuse("expected_authority");
  }
  return deepFreezeOwnData({
    operation: root.operation,
    authorityId: root.authorityId,
    consumptionId: root.consumptionId,
    ledgerRootSha256: root.ledgerRootSha256,
    implementationCommit: root.implementationCommit,
    implementationTree: root.implementationTree,
    targetPolicySha256: root.targetPolicySha256,
    sourceIdentities: sourceIdentitiesAt(root.sourceIdentities, root.operation),
  }) as Readonly<M5bProductEffectExpectedAuthority>;
}

function validateGo(raw: unknown, expected: Readonly<M5bProductEffectExpectedAuthority>): ValidatedGo {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "effect_go", GO_LIMITS);
  } catch {
    refuse("go_plain_data");
  }
  const root = objectAt(snapshot, ["kind", "schemaVersion", "operation", "authorityId", "consumptionId",
    "ledgerRootSha256", "implementation", "targetPolicySha256", "sourceIdentities", "authorizedAt", "validFrom", "validUntil",
    "armingStatus", "authorizesEffect", "effectBudget"], "go_shape");
  const implementation = objectAt(root.implementation, ["commit", "tree"], "go_implementation");
  const budget = objectAt(root.effectBudget, ["retainedCustodyReads", "dnsAttempts", "networkRequests", "redirects",
    "retries"], "go_budget");
  if ((root.operation !== "retained_custody_read" && root.operation !== "exact_sec_archive_acquisition") ||
      root.kind !== M5B_PRODUCT_EFFECT_GO_KIND || root.schemaVersion !== M5B_PRODUCT_EFFECT_GO_VERSION ||
      root.authorityId !== expected.authorityId || root.consumptionId !== expected.consumptionId ||
      root.ledgerRootSha256 !== expected.ledgerRootSha256 ||
      root.operation !== expected.operation || implementation.commit !== expected.implementationCommit ||
      implementation.tree !== expected.implementationTree || root.targetPolicySha256 !== expected.targetPolicySha256 ||
      root.armingStatus !== "armed" || root.authorizesEffect !== true ||
      !timestamp(root.authorizedAt) || !timestamp(root.validFrom) || !timestamp(root.validUntil) ||
      Date.parse(root.authorizedAt) > Date.parse(root.validFrom) || Date.parse(root.validFrom) >= Date.parse(root.validUntil)) {
    refuse("go_binding");
  }
  const expectedBudget = root.operation === "retained_custody_read"
    ? { retainedCustodyReads: expected.sourceIdentities.length, dnsAttempts: 0, networkRequests: 0, redirects: 0, retries: 0 }
    : { retainedCustodyReads: 0, dnsAttempts: 1, networkRequests: 1, redirects: 0, retries: 0 };
  if (budget.retainedCustodyReads !== expectedBudget.retainedCustodyReads || budget.dnsAttempts !== expectedBudget.dnsAttempts ||
      budget.networkRequests !== expectedBudget.networkRequests || budget.redirects !== 0 || budget.retries !== 0) {
    refuse("go_budget");
  }
  const sourceIdentities = sourceIdentitiesAt(root.sourceIdentities, root.operation);
  if (sha256CanonicalJson(sourceIdentities as unknown as StrictJsonValue) !==
      sha256CanonicalJson(expected.sourceIdentities as unknown as StrictJsonValue)) {
    refuse("go_source_binding");
  }
  return Object.freeze({
    ...expected,
    authorizedAt: root.authorizedAt,
    validFrom: root.validFrom,
    validUntil: root.validUntil,
    goCanonicalSha256: sha256CanonicalJson(snapshot),
  });
}

function requireLedgerState(value: unknown): LedgerState {
  if (typeof value !== "object" || value === null) refuse("ledger");
  const state = LEDGERS.get(value);
  if (!state) refuse("ledger");
  return state;
}

function assertLedgerRoot(state: LedgerState): void {
  let metadata: ReturnType<typeof lstatSync>;
  try {
    metadata = lstatSync(state.root);
  } catch {
    refuse("ledger_root_substitution");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || !sameIdentity(state.rootIdentity, metadata) ||
      realpathSync(state.root) !== state.root || (metadata.mode & 0o077) !== 0) {
    refuse("ledger_root_substitution");
  }
}

/** Fixes one trusted ledger root for all attempts created through the returned opaque handle. */
export function createM5bProductEffectLedger(rootInput: unknown): Readonly<M5bProductEffectLedger> {
  if (typeof rootInput !== "string" || !isAbsolute(rootInput) || normalize(rootInput) !== rootInput ||
      basename(rootInput).length === 0) {
    refuse("ledger_root");
  }
  let metadata: ReturnType<typeof lstatSync>;
  try {
    metadata = lstatSync(rootInput);
  } catch {
    refuse("ledger_root");
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || realpathSync(rootInput) !== rootInput ||
      (metadata.mode & 0o077) !== 0) {
    refuse("ledger_root");
  }
  const ledgerRootSha256 = createHash("sha256")
    .update("m5b-product-effect-ledger-root-v1\0", "utf8")
    .update(rootInput, "utf8")
    .digest("hex");
  const ledger = Object.freeze({ kind: "m5b-product-effect-ledger" as const, ledgerRootSha256 });
  LEDGERS.set(ledger, Object.freeze({ root: rootInput, ledgerRootSha256, rootIdentity: identity(metadata) }));
  return ledger;
}

/** Validates an exact GO against trusted expected bindings without consuming it yet. */
export function createM5bProductEffectAttempt(
  rawGo: unknown,
  ledger: unknown,
  rawExpected: unknown,
  now = new Date(),
): Readonly<M5bProductEffectAttempt> {
  const ledgerState = requireLedgerState(ledger);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) refuse("clock");
  const expected = snapshotExpected(rawExpected);
  if (expected.ledgerRootSha256 !== ledgerState.ledgerRootSha256) refuse("ledger_root_binding");
  const go = validateGo(rawGo, expected);
  if (go.ledgerRootSha256 !== ledgerState.ledgerRootSha256) refuse("ledger_root_binding");
  if (now.getTime() < Date.parse(go.validFrom) || now.getTime() >= Date.parse(go.validUntil)) refuse("go_time");
  const attempt = Object.freeze({ kind: "m5b-product-effect-attempt" as const });
  ATTEMPTS.set(attempt, { ledger: ledgerState, go, status: "available" });
  return attempt;
}

function writeAll(descriptor: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
    if (written <= 0) refuse("ledger_partial_state");
    offset += written;
  }
}

function ledgerNamespaceBinding(value: Readonly<M5bProductEffectExpectedAuthority>) {
  return {
    kind: M5B_PRODUCT_EFFECT_LEDGER_RECORD_KIND,
    schemaVersion: M5B_PRODUCT_EFFECT_GO_VERSION,
    operation: value.operation,
    authorityId: value.authorityId,
    consumptionId: value.consumptionId,
    ledgerRootSha256: value.ledgerRootSha256,
    implementationCommit: value.implementationCommit,
    implementationTree: value.implementationTree,
    targetPolicySha256: value.targetPolicySha256,
    sourceIdentities: value.sourceIdentities,
  };
}

function ledgerRecordBytes(
  value: Readonly<M5bProductEffectConsumption> | ValidatedGo,
  consumedAt: string,
  ledgerNamespaceSha256: string,
): Buffer {
  const record = {
    ...ledgerNamespaceBinding(value),
    authorizedAt: value.authorizedAt,
    validFrom: value.validFrom,
    validUntil: value.validUntil,
    consumedAt,
    ledgerNamespaceSha256,
    goCanonicalSha256: value.goCanonicalSha256,
  };
  return Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function consumeLedger(state: LedgerState, go: ValidatedGo, consumedAt: string): M5bProductEffectConsumption {
  assertLedgerRoot(state);
  const namespaceBinding = ledgerNamespaceBinding(go);
  const ledgerNamespaceSha256 = sha256CanonicalJson(namespaceBinding as unknown as StrictJsonValue);
  const path = join(state.root, `.m5b-product-effect-${ledgerNamespaceSha256}.json`);
  const bytes = ledgerRecordBytes(go, consumedAt, ledgerNamespaceSha256);
  let directoryDescriptor: number | undefined;
  let recordDescriptor: number | undefined;
  try {
    directoryDescriptor = openSync(state.root, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
    try {
      recordDescriptor = openSync(path,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600);
    } catch {
      refuse("replay_or_collision");
    }
    writeAll(recordDescriptor, bytes);
    const descriptorIdentity = fstatSync(recordDescriptor);
    const pathIdentity = lstatSync(path);
    if (!descriptorIdentity.isFile() || descriptorIdentity.nlink !== 1 || (descriptorIdentity.mode & 0o777) !== 0o600 ||
        !pathIdentity.isFile() || pathIdentity.isSymbolicLink() || pathIdentity.nlink !== 1 ||
        descriptorIdentity.dev !== pathIdentity.dev || descriptorIdentity.ino !== pathIdentity.ino) {
      refuse("ledger_record_alias");
    }
    fsyncSync(recordDescriptor);
    assertLedgerRoot(state);
    fsyncSync(directoryDescriptor);
  } catch (error) {
    if (error instanceof M5bProductEffectAuthorityRefusal) throw error;
    refuse("ledger_partial_state");
  } finally {
    if (recordDescriptor !== undefined) closeSync(recordDescriptor);
    if (directoryDescriptor !== undefined) closeSync(directoryDescriptor);
  }
  const ledgerRecordSha256 = createHash("sha256").update(bytes).digest("hex");
  const consumption = Object.freeze({
    operation: go.operation,
    authorityId: go.authorityId,
    consumptionId: go.consumptionId,
    ledgerRootSha256: go.ledgerRootSha256,
    implementationCommit: go.implementationCommit,
    implementationTree: go.implementationTree,
    targetPolicySha256: go.targetPolicySha256,
    sourceIdentities: go.sourceIdentities,
    authorizedAt: go.authorizedAt,
    validFrom: go.validFrom,
    validUntil: go.validUntil,
    consumedAt,
    ledgerNamespaceSha256,
    ledgerRecordSha256,
    goCanonicalSha256: go.goCanonicalSha256,
  });
  const recordMetadata = lstatSync(path);
  CONSUMPTIONS.set(consumption, Object.freeze({
    ledger: state,
    path,
    recordIdentity: identity(recordMetadata),
    recordSha256: ledgerRecordSha256,
  }));
  return consumption;
}

/** Exclusively consumes the stable on-disk namespace before the caller may read or construct network dependencies. */
export function claimM5bProductEffectAttempt(
  value: unknown,
  operation: M5bProductEffectOperation,
  now = new Date(),
): Readonly<M5bProductEffectConsumption> {
  if (typeof value !== "object" || value === null) refuse("attempt");
  const state = ATTEMPTS.get(value);
  if (!state || state.status !== "available" || state.go.operation !== operation) refuse("attempt_replay");
  state.status = "claimed";
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getTime() < Date.parse(state.go.validFrom) ||
      now.getTime() >= Date.parse(state.go.validUntil)) {
    refuse("go_time");
  }
  return consumeLedger(state.ledger, state.go, now.toISOString());
}

/** Re-checks the exact consumed record identity and bytes before an effect dependency is used. */
export function assertM5bProductEffectConsumptionIntact(
  value: unknown,
  operation: M5bProductEffectOperation,
): Readonly<M5bProductEffectConsumption> {
  if (typeof value !== "object" || value === null) refuse("consumption");
  const state = CONSUMPTIONS.get(value);
  if (!state || (value as M5bProductEffectConsumption).operation !== operation) refuse("consumption");
  assertLedgerRoot(state.ledger);
  let descriptor: number | undefined;
  try {
    const pathMetadata = lstatSync(state.path);
    if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink() || pathMetadata.nlink !== 1 ||
        (pathMetadata.mode & 0o777) !== 0o600 || !sameIdentity(state.recordIdentity, pathMetadata)) {
      refuse("ledger_record_substitution");
    }
    descriptor = openSync(state.path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const descriptorMetadata = fstatSync(descriptor);
    if (!descriptorMetadata.isFile() || descriptorMetadata.nlink !== 1 ||
        !sameIdentity(state.recordIdentity, descriptorMetadata) ||
        createHash("sha256").update(readFileSync(descriptor)).digest("hex") !== state.recordSha256) {
      refuse("ledger_record_substitution");
    }
    const after = lstatSync(state.path);
    if (!sameIdentity(state.recordIdentity, after) || after.nlink !== 1) refuse("ledger_record_substitution");
  } catch (error) {
    if (error instanceof M5bProductEffectAuthorityRefusal) throw error;
    refuse("ledger_record_substitution");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return value as Readonly<M5bProductEffectConsumption>;
}

function snapshotConsumptionReceipt(
  raw: unknown,
  operation: M5bProductEffectOperation,
): Readonly<M5bProductEffectConsumption> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "consumption_receipt", GO_LIMITS);
  } catch {
    refuse("consumption_receipt_plain_data");
  }
  const root = objectAt(snapshot, ["operation", "authorityId", "consumptionId", "ledgerRootSha256",
    "implementationCommit", "implementationTree", "targetPolicySha256", "sourceIdentities", "authorizedAt",
    "validFrom", "validUntil", "consumedAt", "ledgerNamespaceSha256", "ledgerRecordSha256",
    "goCanonicalSha256"], "consumption_receipt_shape");
  const expected = snapshotExpected({
    operation: root.operation,
    authorityId: root.authorityId,
    consumptionId: root.consumptionId,
    ledgerRootSha256: root.ledgerRootSha256,
    implementationCommit: root.implementationCommit,
    implementationTree: root.implementationTree,
    targetPolicySha256: root.targetPolicySha256,
    sourceIdentities: root.sourceIdentities,
  });
  if (expected.operation !== operation || !timestamp(root.authorizedAt) || !timestamp(root.validFrom) ||
      !timestamp(root.validUntil) || !timestamp(root.consumedAt) ||
      Date.parse(root.authorizedAt) > Date.parse(root.validFrom) ||
      Date.parse(root.validFrom) >= Date.parse(root.validUntil) ||
      Date.parse(root.consumedAt) < Date.parse(root.validFrom) ||
      Date.parse(root.consumedAt) >= Date.parse(root.validUntil) ||
      typeof root.ledgerNamespaceSha256 !== "string" || !SHA256.test(root.ledgerNamespaceSha256) ||
      typeof root.ledgerRecordSha256 !== "string" || !SHA256.test(root.ledgerRecordSha256) ||
      typeof root.goCanonicalSha256 !== "string" || !SHA256.test(root.goCanonicalSha256)) {
    refuse("consumption_receipt");
  }
  return deepFreezeOwnData({
    ...expected,
    authorizedAt: root.authorizedAt,
    validFrom: root.validFrom,
    validUntil: root.validUntil,
    consumedAt: root.consumedAt,
    ledgerNamespaceSha256: root.ledgerNamespaceSha256,
    ledgerRecordSha256: root.ledgerRecordSha256,
    goCanonicalSha256: root.goCanonicalSha256,
  }) as Readonly<M5bProductEffectConsumption>;
}

/** Proves that a serialized receipt names the exact intact record in the caller-supplied opaque ledger. */
export function assertM5bProductEffectLedgerReceipt(
  ledger: unknown,
  rawReceipt: unknown,
  operation: M5bProductEffectOperation,
): Readonly<M5bProductEffectConsumption> {
  const state = requireLedgerState(ledger);
  const receipt = snapshotConsumptionReceipt(rawReceipt, operation);
  if (receipt.ledgerRootSha256 !== state.ledgerRootSha256) refuse("receipt_ledger_root_binding");
  const ledgerNamespaceSha256 = sha256CanonicalJson(
    ledgerNamespaceBinding(receipt) as unknown as StrictJsonValue,
  );
  const expectedBytes = ledgerRecordBytes(receipt, receipt.consumedAt, ledgerNamespaceSha256);
  const ledgerRecordSha256 = createHash("sha256").update(expectedBytes).digest("hex");
  if (receipt.ledgerNamespaceSha256 !== ledgerNamespaceSha256 ||
      receipt.ledgerRecordSha256 !== ledgerRecordSha256) {
    refuse("consumption_receipt_binding");
  }
  assertLedgerRoot(state);
  const path = join(state.root, `.m5b-product-effect-${ledgerNamespaceSha256}.json`);
  let descriptor: number | undefined;
  try {
    const pathMetadata = lstatSync(path);
    if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink() || pathMetadata.nlink !== 1 ||
        (pathMetadata.mode & 0o777) !== 0o600) {
      refuse("consumption_receipt_record");
    }
    descriptor = openSync(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const descriptorMetadata = fstatSync(descriptor);
    const actualBytes = readFileSync(descriptor);
    if (!descriptorMetadata.isFile() || descriptorMetadata.nlink !== 1 ||
        descriptorMetadata.dev !== pathMetadata.dev || descriptorMetadata.ino !== pathMetadata.ino ||
        !actualBytes.equals(expectedBytes) ||
        createHash("sha256").update(actualBytes).digest("hex") !== ledgerRecordSha256) {
      refuse("consumption_receipt_record");
    }
    const after = lstatSync(path);
    if (after.dev !== pathMetadata.dev || after.ino !== pathMetadata.ino || after.nlink !== 1) {
      refuse("consumption_receipt_record");
    }
    assertLedgerRoot(state);
  } catch (error) {
    if (error instanceof M5bProductEffectAuthorityRefusal) throw error;
    refuse("consumption_receipt_record");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return receipt;
}
