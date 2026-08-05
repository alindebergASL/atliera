import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isProxy } from "node:util/types";

import {
  assertExactKeys,
  canonicalJson,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonObject,
  StrictJsonBoundaryError,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES,
  CANDIDATE_TRANSITION_MAX_JSON_NODES,
  CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES,
  candidateQualityGatePolicyIdentity,
  validatedCandidateSha256,
} from "./candidate-delta.ts";
import {
  SUBJECT_GRAPH_REVISION_INTENT_KIND,
  SUBJECT_GRAPH_REVISION_INTENT_VERSION,
  SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION,
  type SubjectGraphRevisionIntentAuthority,
  type SubjectGraphRevisionReviewAuthority,
  type SubjectGraphRevisionToken,
} from "./subject-graph-revision-intent.ts";
import {
  DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_KIND,
  DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_VERSION,
  createDisposableSqliteSubjectGraphRevisionLabPermit,
  type DisposableSqliteSubjectGraphRevisionLabPermit,
  type SubjectGraphRevisionCommittedState,
  type SubjectGraphRevisionConflictDimensions,
  type SubjectGraphRevisionConflictKind,
  type SubjectGraphRevisionConflictReceipt,
  type SubjectGraphRevisionConflictReceiptCore,
  type SubjectGraphRevisionRecoveryIdentity,
  type SubjectGraphRevisionReadResult,
  type SubjectGraphRevisionRefusalReason,
  type SubjectGraphRevisionRefusalReceipt,
  type SubjectGraphRevisionRefusalReceiptCore,
  type SubjectGraphRevisionSuccessReceipt,
  type SubjectGraphRevisionSuccessReceiptCore,
  type SubjectGraphRevisionTransaction,
  type SubjectGraphRevisionTransactionResult,
  type TransactionGraphIdentity,
  type TransactionPredecessorBasis,
} from "./subject-graph-revision-transaction.ts";
import {
  createValidatedCandidate,
  hydrateValidatedCandidate,
  type ValidatedCandidate,
} from "./validated-candidate.ts";

export const DISPOSABLE_SQLITE_BUSY_TIMEOUT_MS = 1_500;
export const DISPOSABLE_SQLITE_TEST_FAULT_MAX_DELAY_MS = 2_000;
export const SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES =
  256 * 1024;
export const SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES =
  16 * 1024;
const DISPOSABLE_SQLITE_SCHEMA_CATALOG_ROW_COUNT = 15;
const DISPOSABLE_SQLITE_SCHEMA_CATALOG_SHA256 =
  "fa9df3d0b1412e596acb201eaa3b8338a0d5ea6391b359d41408ee3b5202ea29";

export type DisposableSqliteSubjectGraphRevisionTestFaultPoint =
  | "after_open_before_transaction"
  | "before_transaction"
  | "after_begin"
  | "after_graph_write"
  | "after_replay_write"
  | "after_commit_before_acknowledgement"
  | "after_commit_before_readback"
  | "before_commit_recovery_probe";

export type DisposableSqliteSubjectGraphRevisionTestFaultInstruction =
  | {
      readonly point: DisposableSqliteSubjectGraphRevisionTestFaultPoint;
      readonly action: "throw";
      readonly delay_ms?: number;
    }
  | {
      readonly point: DisposableSqliteSubjectGraphRevisionTestFaultPoint;
      readonly action: "sleep";
      readonly duration_ms: number;
    };

export interface DisposableSqliteSubjectGraphRevisionTransactionOptions {
  readonly database_path: string;
  readonly isolated_temporary_directory: string;
  /** Data-only, bounded test seam. It is not a runtime failure-injection surface. */
  readonly test_only_fault_plan?: readonly DisposableSqliteSubjectGraphRevisionTestFaultInstruction[];
}

function invalidOptions(): never {
  throw new TypeError("Invalid disposable SQLite transaction options");
}

const TEST_FAULT_POINTS = new Set<DisposableSqliteSubjectGraphRevisionTestFaultPoint>([
  "after_open_before_transaction",
  "before_transaction",
  "after_begin",
  "after_graph_write",
  "after_replay_write",
  "after_commit_before_acknowledgement",
  "after_commit_before_readback",
  "before_commit_recovery_probe",
]);

const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

function boundedSleep(durationMs: number): void {
  Atomics.wait(SLEEP_ARRAY, 0, 0, durationMs);
}

function exactOwnDataObject(
  raw: unknown,
  expectedKeys: readonly string[],
): Record<string, PropertyDescriptor> {
  if (
    typeof raw !== "object" ||
    raw === null ||
    isProxy(raw) ||
    (Object.getPrototypeOf(raw) !== Object.prototype &&
      Object.getPrototypeOf(raw) !== null) ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) {
    return invalidOptions();
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const keys = Object.getOwnPropertyNames(raw).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    expected.some((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable
      );
    })
  ) {
    return invalidOptions();
  }
  return descriptors;
}

function snapshotFaultPlan(
  raw: unknown,
): readonly DisposableSqliteSubjectGraphRevisionTestFaultInstruction[] {
  if (
    !Array.isArray(raw) ||
    isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype ||
    Object.getOwnPropertySymbols(raw).length !== 0 ||
    raw.length > TEST_FAULT_POINTS.size
  ) {
    return invalidOptions();
  }
  const arrayDescriptors = Object.getOwnPropertyDescriptors(raw) as Record<
    string,
    PropertyDescriptor
  >;
  const expectedArrayKeys = [
    ...Array.from({ length: raw.length }, (_, index) => String(index)),
    "length",
  ].sort();
  const arrayKeys = Object.getOwnPropertyNames(raw).sort();
  if (
    arrayKeys.length !== expectedArrayKeys.length ||
    arrayKeys.some((key, index) => key !== expectedArrayKeys[index]) ||
    !("value" in arrayDescriptors.length!) ||
    arrayDescriptors.length!.value !== raw.length
  ) {
    return invalidOptions();
  }

  const seen = new Set<DisposableSqliteSubjectGraphRevisionTestFaultPoint>();
  const snapshot: DisposableSqliteSubjectGraphRevisionTestFaultInstruction[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const arrayItem = arrayDescriptors[String(index)];
    if (
      arrayItem === undefined ||
      !("value" in arrayItem) ||
      !arrayItem.enumerable
    ) {
      return invalidOptions();
    }
    const item = arrayItem.value as unknown;
    if (typeof item !== "object" || item === null || isProxy(item)) {
      return invalidOptions();
    }
    const preliminary = Object.getOwnPropertyDescriptors(item);
    const actionDescriptor = preliminary.action;
    if (
      actionDescriptor === undefined ||
      !("value" in actionDescriptor) ||
      typeof actionDescriptor.value !== "string"
    ) {
      return invalidOptions();
    }
    const action = actionDescriptor.value;
    const keys =
      action === "sleep"
        ? ["point", "action", "duration_ms"]
        : action === "throw"
          ? Object.hasOwn(preliminary, "delay_ms")
            ? ["point", "action", "delay_ms"]
            : ["point", "action"]
          : [];
    if (keys.length === 0) return invalidOptions();
    const descriptors = exactOwnDataObject(item, keys);
    const point = descriptors.point!.value;
    if (
      typeof point !== "string" ||
      !TEST_FAULT_POINTS.has(
        point as DisposableSqliteSubjectGraphRevisionTestFaultPoint,
      ) ||
      seen.has(point as DisposableSqliteSubjectGraphRevisionTestFaultPoint)
    ) {
      return invalidOptions();
    }
    seen.add(point as DisposableSqliteSubjectGraphRevisionTestFaultPoint);
    if (action === "sleep") {
      const durationMs = descriptors.duration_ms!.value;
      if (
        !Number.isSafeInteger(durationMs) ||
        durationMs < 1 ||
        durationMs > DISPOSABLE_SQLITE_TEST_FAULT_MAX_DELAY_MS
      ) {
        return invalidOptions();
      }
      snapshot.push(
        Object.freeze({
          point: point as DisposableSqliteSubjectGraphRevisionTestFaultPoint,
          action: "sleep" as const,
          duration_ms: durationMs as number,
        }),
      );
    } else {
      const delayMs = descriptors.delay_ms?.value;
      if (
        delayMs !== undefined &&
        (!Number.isSafeInteger(delayMs) ||
          delayMs < 1 ||
          delayMs > DISPOSABLE_SQLITE_TEST_FAULT_MAX_DELAY_MS)
      ) {
        return invalidOptions();
      }
      snapshot.push(
        Object.freeze({
          point: point as DisposableSqliteSubjectGraphRevisionTestFaultPoint,
          action: "throw" as const,
          ...(delayMs === undefined ? {} : { delay_ms: delayMs as number }),
        }),
      );
    }
  }
  return Object.freeze(snapshot);
}

function snapshotOptions(
  raw: DisposableSqliteSubjectGraphRevisionTransactionOptions,
): DisposableSqliteSubjectGraphRevisionTransactionOptions {
  if (
    typeof raw !== "object" ||
    raw === null ||
    isProxy(raw) ||
    (Object.getPrototypeOf(raw) !== Object.prototype &&
      Object.getPrototypeOf(raw) !== null) ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) {
    return invalidOptions();
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const keys = Object.keys(descriptors).sort();
  const expectedKeys = [
    "database_path",
    "isolated_temporary_directory",
    ...(Object.hasOwn(descriptors, "test_only_fault_plan")
      ? ["test_only_fault_plan"]
      : []),
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return invalidOptions();
  }
  const databasePath = descriptors.database_path;
  const isolatedDirectory = descriptors.isolated_temporary_directory;
  const faultPlan = descriptors.test_only_fault_plan;
  if (
    databasePath === undefined ||
    isolatedDirectory === undefined ||
    !("value" in databasePath) ||
    !("value" in isolatedDirectory) ||
    !databasePath.enumerable ||
    !isolatedDirectory.enumerable ||
    typeof databasePath.value !== "string" ||
    typeof isolatedDirectory.value !== "string" ||
    (faultPlan !== undefined &&
      (!("value" in faultPlan) || !faultPlan.enumerable))
  ) {
    return invalidOptions();
  }
  const snapshottedFaultPlan =
    faultPlan !== undefined && "value" in faultPlan
      ? snapshotFaultPlan(faultPlan.value)
      : undefined;
  return Object.freeze({
    database_path: databasePath.value,
    isolated_temporary_directory: isolatedDirectory.value,
    ...(snapshottedFaultPlan === undefined
      ? {}
      : {
          test_only_fault_plan: snapshottedFaultPlan,
        }),
  });
}

function applyTestFault(
  plan: readonly DisposableSqliteSubjectGraphRevisionTestFaultInstruction[] | undefined,
  point: DisposableSqliteSubjectGraphRevisionTestFaultPoint,
): void {
  const instruction = plan?.find((candidate) => candidate.point === point);
  if (instruction === undefined) return;
  if (instruction.action === "sleep") {
    boundedSleep(instruction.duration_ms);
    return;
  }
  if (instruction.delay_ms !== undefined) boundedSleep(instruction.delay_ms);
  throw new Error("Declarative disposable SQLite test fault");
}

interface ValidatedIntent {
  readonly graph_identity: TransactionGraphIdentity;
  readonly predecessor_basis: TransactionPredecessorBasis;
  readonly proposed_snapshot: ValidatedCandidate;
  readonly proposed_snapshot_sha256: string;
  readonly review_handoff_sha256: string;
  readonly replay_key_to_record: string;
  readonly intent_sha256: string;
}

interface PreparedCommit {
  readonly intent: ValidatedIntent;
  readonly snapshot_json: string;
  readonly next_revision_number: number;
  readonly next_revision: SubjectGraphRevisionToken;
}

interface VerifiedReadback {
  readonly receipt: SubjectGraphRevisionSuccessReceipt;
  readonly state: SubjectGraphRevisionCommittedState;
}

type CommitRecoveryProbe =
  | { readonly status: "committed"; readonly readback: VerifiedReadback }
  | { readonly status: "committed_readback_failed" }
  | { readonly status: "absent" }
  | { readonly status: "unresolved" };

interface DatabaseGraphRow {
  readonly team_id: string;
  readonly account_id: string;
  readonly subject_id: string;
  readonly purpose: string;
  readonly revision_number: number;
  readonly revision_token: string;
  readonly snapshot_sha256: string;
  readonly snapshot_json: string;
  readonly intent_sha256: string;
  readonly last_receipt_sha256: string;
  readonly operational_committed_at: string;
}

interface DatabaseReplayRow {
  readonly replay_key: string;
  readonly intent_sha256: string;
  readonly receipt_sha256: string;
  readonly team_id: string;
  readonly account_id: string;
  readonly subject_id: string;
  readonly purpose: string;
}

const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_REVISION = /^rev_([1-9][0-9]{0,15})$/;
const SAFE_TEAM_ID = /^team_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_ACCOUNT_ID = /^acc_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_REVIEWER_REF = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const CANONICAL_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_RATIONALE_UTF8_BYTES = 8 * 1024;
const OPERATIONAL_TIME_PLACEHOLDER = "2000-01-01T00:00:00Z";

const INTENT_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_000,
  max_depth: 18,
  max_expanded_json_value_occurrences:
    CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES + 10_000,
  max_nodes: CANDIDATE_TRANSITION_MAX_JSON_NODES + 256,
  max_object_fields: 128,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes:
    CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES + 64 * 1024,
});

const RECEIPT_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 16,
  max_depth: 8,
  max_expanded_json_value_occurrences: 512,
  max_nodes: 128,
  max_object_fields: 64,
  max_string_utf8_bytes: SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES,
  max_total_string_utf8_bytes:
    SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES,
});

const PERMIT_KEYS = [
  "kind",
  "version",
  "fixture_test_only",
  "effect_admission_only",
  "disposable_isolated_sqlite_only",
  "authenticated_human_approval",
  "ratification",
  "production_authority",
  "real_account_effects_allowed",
  "provider_calls_allowed",
  "network_operations_allowed",
  "mcp_invocations_allowed",
  "deployment_operations_allowed",
  "m5a_m5b_flows_allowed",
] as const;
const GRAPH_IDENTITY_KEYS = [
  "team_id",
  "account_id",
  "subject_id",
  "purpose",
] as const;
const PREDECESSOR_BASIS_KEYS = [
  "mode",
  "expected_prior_revision",
  "expected_base_snapshot_sha256",
] as const;
const QUALITY_GATE_POLICY_KEYS = ["name", "version", "policy_sha256"] as const;
const REVIEW_AUTHORITY_KEYS = [
  "current_effective_authorization",
  "review_handoff_only",
  "integrity_digest_is_approval",
  "authenticated_human_approval",
  "ratification",
  "ratification_performed",
  "durable_replay_consumed",
  "durable_replay_protection",
  "anti_rollback_protection",
  "origin_custody_proven",
  "transformation_custody_proven",
  "graph_ingestion_authorized",
  "graph_ingestion_performed",
  "durable_write_authorized",
  "durable_write_performed",
] as const;
const INTENT_AUTHORITY_KEYS = [
  "current_effective_authorization",
  "intent_contract_only",
  "integrity_digest_is_authority",
  "authenticated_human_approval",
  "ratification",
  "ratification_performed",
  "durable_replay_consumed",
  "durable_replay_protection",
  "anti_rollback_protection",
  "durable_current_state_checked",
  "future_transaction_must_atomically_compare_revision_and_snapshot",
  "origin_custody_proven",
  "transformation_custody_proven",
  "graph_ingestion_authorized",
  "graph_ingestion_performed",
  "durable_write_authorized",
  "durable_write_performed",
  "provider_calls_performed",
  "mcp_invocations_performed",
  "network_operations_performed",
  "deployment_operations_performed",
  "production_effects_performed",
] as const;
const SUCCESS_RECEIPT_AUTHORITY_KEYS = [
  "effect_admission",
  "intent_is_write_authority",
  "integrity_digest_is_authority",
  "authenticated_human_approval",
  "ratification",
  "production_authority",
  "provider_calls_performed",
  "network_operations_performed",
  "mcp_invocations_performed",
  "deployment_operations_performed",
] as const;
const REVIEW_HANDOFF_KEYS = [
  "kind",
  "version",
  "disposition",
  "graph_identity",
  "predecessor_basis",
  "envelope_sha256",
  "delta_sha256",
  "transition_sha256",
  "base_snapshot_sha256",
  "proposed_snapshot_sha256",
  "quality_gate_policy",
  "quality_gate_report_sha256",
  "replay_key_to_record",
  "reviewer_ref",
  "reviewed_at",
  "rationale",
  "authority",
] as const;
const INTENT_CORE_KEYS = [
  "kind",
  "version",
  "graph_identity",
  "predecessor_basis",
  "envelope_sha256",
  "delta_sha256",
  "transition_sha256",
  "base_snapshot_sha256",
  "proposed_snapshot_sha256",
  "quality_gate_policy",
  "quality_gate_report_sha256",
  "proposed_snapshot",
  "review_handoff",
  "review_handoff_sha256",
  "replay_key_to_record",
  "authority",
] as const;

const EXPECTED_REVIEW_AUTHORITY: SubjectGraphRevisionReviewAuthority =
  Object.freeze({
    current_effective_authorization: "none",
    review_handoff_only: true,
    integrity_digest_is_approval: false,
    authenticated_human_approval: false,
    ratification: false,
    ratification_performed: false,
    durable_replay_consumed: false,
    durable_replay_protection: false,
    anti_rollback_protection: false,
    origin_custody_proven: false,
    transformation_custody_proven: false,
    graph_ingestion_authorized: false,
    graph_ingestion_performed: false,
    durable_write_authorized: false,
    durable_write_performed: false,
  });
const EXPECTED_INTENT_AUTHORITY: SubjectGraphRevisionIntentAuthority =
  Object.freeze({
    current_effective_authorization: "none",
    intent_contract_only: true,
    integrity_digest_is_authority: false,
    authenticated_human_approval: false,
    ratification: false,
    ratification_performed: false,
    durable_replay_consumed: false,
    durable_replay_protection: false,
    anti_rollback_protection: false,
    durable_current_state_checked: false,
    future_transaction_must_atomically_compare_revision_and_snapshot: true,
    origin_custody_proven: false,
    transformation_custody_proven: false,
    graph_ingestion_authorized: false,
    graph_ingestion_performed: false,
    durable_write_authorized: false,
    durable_write_performed: false,
    provider_calls_performed: 0,
    mcp_invocations_performed: 0,
    network_operations_performed: 0,
    deployment_operations_performed: 0,
    production_effects_performed: 0,
  });

const EMPTY_GRAPH_BUNDLE = Object.freeze({
  sources: [],
  excerpts: [],
  claims: [],
  claim_evidence: [],
  account_objects: [],
  account_object_claims: [],
  research_runs: [],
  run_artifacts: [],
  audit_events: [],
});

class IntentRefusal extends Error {
  constructor() {
    super("malformed intent");
    this.name = "IntentRefusal";
  }
}

class DurableReadbackFailure extends Error {
  constructor() {
    super("durable read-back invalid");
    this.name = "DurableReadbackFailure";
  }
}

function exact(
  value: { [key: string]: StrictJsonValue },
  keys: readonly string[],
  path: string,
): void {
  try {
    assertExactKeys(value, keys, path);
  } catch {
    throw new IntentRefusal();
  }
}

function object(
  value: StrictJsonValue | undefined,
  path: string,
): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(value as StrictJsonValue, path);
  } catch {
    throw new IntentRefusal();
  }
}

function digest(value: StrictJsonValue | undefined): string {
  if (typeof value !== "string" || !CANONICAL_SHA256.test(value)) {
    throw new IntentRefusal();
  }
  return value;
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return (
    canonicalJson(left as StrictJsonValue) ===
    canonicalJson(right as StrictJsonValue)
  );
}

function validatePermit(raw: unknown): DisposableSqliteSubjectGraphRevisionLabPermit {
  const limits: StrictJsonLimits = {
    max_array_length: 0,
    max_depth: 2,
    max_expanded_json_value_occurrences: 32,
    max_nodes: 4,
    max_object_fields: 20,
    max_string_utf8_bytes: 128,
    max_total_string_utf8_bytes: 512,
  };
  let permit: { [key: string]: StrictJsonValue };
  try {
    permit = strictJsonObject(snapshotStrictJson(raw, "lab_permit", limits), "lab_permit");
    assertExactKeys(permit, PERMIT_KEYS, "lab_permit");
  } catch {
    throw new IntentRefusal();
  }
  const expected = createDisposableSqliteSubjectGraphRevisionLabPermit();
  if (
    permit.kind !== DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_KIND ||
    permit.version !== DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_VERSION ||
    !sameCanonical(permit, expected)
  ) {
    throw new IntentRefusal();
  }
  return expected;
}

function validateGraphIdentity(
  raw: StrictJsonValue | undefined,
): TransactionGraphIdentity {
  const value = object(raw, "intent.graph_identity");
  exact(value, GRAPH_IDENTITY_KEYS, "intent.graph_identity");
  if (
    typeof value.team_id !== "string" ||
    !SAFE_TEAM_ID.test(value.team_id) ||
    typeof value.account_id !== "string" ||
    !SAFE_ACCOUNT_ID.test(value.account_id) ||
    typeof value.subject_id !== "string" ||
    !SAFE_SUBJECT_ID.test(value.subject_id) ||
    value.purpose !== "candidate_validation"
  ) {
    throw new IntentRefusal();
  }
  return {
    team_id: value.team_id,
    account_id: value.account_id,
    subject_id: value.subject_id,
    purpose: "candidate_validation",
  };
}

function validateReadGraphIdentity(raw: unknown): TransactionGraphIdentity {
  const limits: StrictJsonLimits = {
    max_array_length: 0,
    max_depth: 2,
    max_expanded_json_value_occurrences: 16,
    max_nodes: 4,
    max_object_fields: 4,
    max_string_utf8_bytes: 256,
    max_total_string_utf8_bytes: 512,
  };
  try {
    return validateGraphIdentity(
      snapshotStrictJson(raw, "graph_identity", limits),
    );
  } catch {
    throw new IntentRefusal();
  }
}

function parseRevision(raw: StrictJsonValue | undefined): SubjectGraphRevisionToken {
  if (typeof raw !== "string") throw new IntentRefusal();
  const match = CANONICAL_REVISION.exec(raw);
  if (match === null) throw new IntentRefusal();
  const revision = Number(match[1]);
  if (
    !Number.isSafeInteger(revision) ||
    revision <= 0 ||
    revision >= Number.MAX_SAFE_INTEGER
  ) {
    throw new IntentRefusal();
  }
  return raw as SubjectGraphRevisionToken;
}

function validatePredecessorBasis(
  raw: StrictJsonValue | undefined,
  identity: TransactionGraphIdentity,
): TransactionPredecessorBasis {
  const value = object(raw, "intent.predecessor_basis");
  exact(value, PREDECESSOR_BASIS_KEYS, "intent.predecessor_basis");
  const expectedBase = digest(value.expected_base_snapshot_sha256);
  if (value.mode === "bootstrap") {
    if (value.expected_prior_revision !== null) throw new IntentRefusal();
    const emptyCandidate = createValidatedCandidate(EMPTY_GRAPH_BUNDLE, {
      team_id: identity.team_id,
      account_id: identity.account_id,
    });
    if (validatedCandidateSha256(emptyCandidate) !== expectedBase) {
      throw new IntentRefusal();
    }
    return {
      mode: "bootstrap",
      expected_prior_revision: null,
      expected_base_snapshot_sha256: expectedBase,
    };
  }
  if (value.mode !== "successor") throw new IntentRefusal();
  return {
    mode: "successor",
    expected_prior_revision: parseRevision(value.expected_prior_revision),
    expected_base_snapshot_sha256: expectedBase,
  };
}

function validateQualityGatePolicy(
  raw: StrictJsonValue | undefined,
): { readonly name: string; readonly version: number; readonly policy_sha256: string } {
  const value = object(raw, "intent.quality_gate_policy");
  exact(value, QUALITY_GATE_POLICY_KEYS, "intent.quality_gate_policy");
  const expected = candidateQualityGatePolicyIdentity();
  if (
    value.name !== expected.name ||
    value.version !== expected.version ||
    value.policy_sha256 !== expected.policy_sha256
  ) {
    throw new IntentRefusal();
  }
  return expected;
}

function validateTimestamp(raw: StrictJsonValue | undefined): void {
  if (typeof raw !== "string" || !CANONICAL_UTC_TIMESTAMP.test(raw)) {
    throw new IntentRefusal();
  }
  const parsed = new Date(raw);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().replace(".000Z", "Z") !== raw
  ) {
    throw new IntentRefusal();
  }
}

function validateIntent(raw: unknown): ValidatedIntent {
  let root: { [key: string]: StrictJsonValue };
  try {
    root = strictJsonObject(
      snapshotStrictJson(raw, "subject_graph_revision_intent", INTENT_LIMITS),
      "subject_graph_revision_intent",
    );
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) throw new IntentRefusal();
    throw error;
  }
  exact(root, [...INTENT_CORE_KEYS, "intent_sha256"], "intent");
  if (
    root.kind !== SUBJECT_GRAPH_REVISION_INTENT_KIND ||
    root.version !== SUBJECT_GRAPH_REVISION_INTENT_VERSION
  ) {
    throw new IntentRefusal();
  }

  const intentSha256 = digest(root.intent_sha256);
  const core: { [key: string]: StrictJsonValue } = {};
  for (const key of INTENT_CORE_KEYS) core[key] = root[key]!;
  if (sha256CanonicalJson(core) !== intentSha256) throw new IntentRefusal();

  const identity = validateGraphIdentity(root.graph_identity);
  const basis = validatePredecessorBasis(root.predecessor_basis, identity);
  const envelopeSha256 = digest(root.envelope_sha256);
  const deltaSha256 = digest(root.delta_sha256);
  const transitionSha256 = digest(root.transition_sha256);
  const baseSnapshotSha256 = digest(root.base_snapshot_sha256);
  const proposedSnapshotSha256 = digest(root.proposed_snapshot_sha256);
  const qualityGatePolicy = validateQualityGatePolicy(root.quality_gate_policy);
  const qualityGateReportSha256 = digest(root.quality_gate_report_sha256);
  const reviewHandoffSha256 = digest(root.review_handoff_sha256);
  const replayKey = digest(root.replay_key_to_record);
  if (baseSnapshotSha256 !== basis.expected_base_snapshot_sha256) {
    throw new IntentRefusal();
  }

  let proposedSnapshot: ValidatedCandidate;
  try {
    proposedSnapshot = hydrateValidatedCandidate(root.proposed_snapshot);
  } catch {
    throw new IntentRefusal();
  }
  if (
    proposedSnapshot.subject.team_id !== identity.team_id ||
    proposedSnapshot.subject.account_id !== identity.account_id ||
    validatedCandidateSha256(proposedSnapshot) !== proposedSnapshotSha256
  ) {
    throw new IntentRefusal();
  }

  const review = object(root.review_handoff, "intent.review_handoff");
  exact(review, REVIEW_HANDOFF_KEYS, "intent.review_handoff");
  if (
    review.kind !== SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND ||
    review.version !== SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION ||
    review.disposition !== SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION ||
    sha256CanonicalJson(review) !== reviewHandoffSha256
  ) {
    throw new IntentRefusal();
  }
  const reviewIdentity = validateGraphIdentity(review.graph_identity);
  const reviewBasis = object(review.predecessor_basis, "review.predecessor_basis");
  exact(reviewBasis, PREDECESSOR_BASIS_KEYS, "review.predecessor_basis");
  const reviewPolicy = validateQualityGatePolicy(review.quality_gate_policy);
  if (
    !sameCanonical(reviewIdentity, identity) ||
    !sameCanonical(reviewBasis, basis) ||
    review.envelope_sha256 !== envelopeSha256 ||
    review.delta_sha256 !== deltaSha256 ||
    review.transition_sha256 !== transitionSha256 ||
    review.base_snapshot_sha256 !== baseSnapshotSha256 ||
    review.proposed_snapshot_sha256 !== proposedSnapshotSha256 ||
    !sameCanonical(reviewPolicy, qualityGatePolicy) ||
    review.quality_gate_report_sha256 !== qualityGateReportSha256 ||
    review.replay_key_to_record !== replayKey
  ) {
    throw new IntentRefusal();
  }
  for (const key of [
    "envelope_sha256",
    "delta_sha256",
    "transition_sha256",
    "base_snapshot_sha256",
    "proposed_snapshot_sha256",
    "quality_gate_report_sha256",
    "replay_key_to_record",
  ] as const) {
    digest(review[key]);
  }
  if (
    typeof review.reviewer_ref !== "string" ||
    !SAFE_REVIEWER_REF.test(review.reviewer_ref)
  ) {
    throw new IntentRefusal();
  }
  validateTimestamp(review.reviewed_at);
  if (
    typeof review.rationale !== "string" ||
    review.rationale.trim() === "" ||
    Buffer.byteLength(review.rationale, "utf8") > MAX_RATIONALE_UTF8_BYTES ||
    /[\u0000-\u001f\u007f]/.test(review.rationale)
  ) {
    throw new IntentRefusal();
  }
  const reviewAuthority = object(review.authority, "review.authority");
  exact(reviewAuthority, REVIEW_AUTHORITY_KEYS, "review.authority");
  const intentAuthority = object(root.authority, "intent.authority");
  exact(intentAuthority, INTENT_AUTHORITY_KEYS, "intent.authority");
  if (
    !sameCanonical(reviewAuthority, EXPECTED_REVIEW_AUTHORITY) ||
    !sameCanonical(intentAuthority, EXPECTED_INTENT_AUTHORITY)
  ) {
    throw new IntentRefusal();
  }

  return deepFreezeOwnData({
    graph_identity: identity,
    predecessor_basis: basis,
    proposed_snapshot: proposedSnapshot,
    proposed_snapshot_sha256: proposedSnapshotSha256,
    review_handoff_sha256: reviewHandoffSha256,
    replay_key_to_record: replayKey,
    intent_sha256: intentSha256,
  });
}

function receiptAuthority() {
  return {
    effect_admission: "fixture_test_only_disposable_sqlite" as const,
    intent_is_write_authority: false as const,
    integrity_digest_is_authority: false as const,
    authenticated_human_approval: false as const,
    ratification: false as const,
    production_authority: false as const,
    provider_calls_performed: 0 as const,
    network_operations_performed: 0 as const,
    mcp_invocations_performed: 0 as const,
    deployment_operations_performed: 0 as const,
  };
}

function successReceipt(
  prepared: PreparedCommit,
  operationalCommittedAt: string,
): SubjectGraphRevisionSuccessReceipt {
  const core: SubjectGraphRevisionSuccessReceiptCore = {
    kind: "atliera_subject_graph_revision_success_receipt",
    version: 1,
    outcome: "committed",
    graph_identity: { ...prepared.intent.graph_identity },
    predecessor_basis: { ...prepared.intent.predecessor_basis },
    committed_revision: prepared.next_revision,
    proposed_snapshot_sha256: prepared.intent.proposed_snapshot_sha256,
    intent_sha256: prepared.intent.intent_sha256,
    review_handoff_sha256: prepared.intent.review_handoff_sha256,
    replay_key: prepared.intent.replay_key_to_record,
    operational_committed_at: operationalCommittedAt,
    authority: receiptAuthority(),
  };
  const coreSnapshot = snapshotStrictJson(core, "success_receipt_core", RECEIPT_LIMITS);
  return deepFreezeOwnData({
    ...core,
    receipt_sha256: sha256CanonicalJson(coreSnapshot),
  });
}

function deterministicReceipt<T extends { readonly receipt_sha256: string }>(
  core: Omit<T, "receipt_sha256">,
): T {
  const snapshot = snapshotStrictJson(core, "deterministic_receipt_core", RECEIPT_LIMITS);
  return deepFreezeOwnData({
    ...core,
    receipt_sha256: sha256CanonicalJson(snapshot),
  }) as T;
}

function refusal(
  reason: SubjectGraphRevisionRefusalReason,
  intent: ValidatedIntent | null = null,
): SubjectGraphRevisionTransactionResult {
  const core: SubjectGraphRevisionRefusalReceiptCore = {
    kind: "atliera_subject_graph_revision_refusal_receipt",
    version: 1,
    outcome: "refused",
    reason,
    intent_sha256: intent?.intent_sha256 ?? null,
    replay_key: intent?.replay_key_to_record ?? null,
    persisted: false,
  };
  const receipt = deterministicReceipt<SubjectGraphRevisionRefusalReceipt>(core);
  return deepFreezeOwnData({
    outcome: "refused",
    committed: false,
    applied: false,
    reason,
    receipt,
  });
}

function dependencyFailed(
  transactionState: "not_started" | "rolled_back",
  failureCode:
    | "database_unavailable_or_busy"
    | "transaction_failed"
    | "durable_state_invalid",
): SubjectGraphRevisionTransactionResult {
  return deepFreezeOwnData({
    outcome: "dependency_failed",
    committed: false,
    transaction_state: transactionState,
    failure_code: failureCode,
    message: "Disposable SQLite revision transaction dependency failed",
  });
}

function recoveryIdentity(intent: ValidatedIntent): SubjectGraphRevisionRecoveryIdentity {
  return deepFreezeOwnData({
    graph_identity: { ...intent.graph_identity },
    intent_sha256: intent.intent_sha256,
    replay_key: intent.replay_key_to_record,
    proposed_snapshot_sha256: intent.proposed_snapshot_sha256,
  });
}

function canonicalReceiptJson(receipt: SubjectGraphRevisionSuccessReceipt): string {
  return canonicalJson(
    snapshotStrictJson(receipt, "success_receipt", RECEIPT_LIMITS),
  );
}

function prepareCommit(intent: ValidatedIntent): PreparedCommit {
  const snapshotJson = canonicalJson(
    snapshotStrictJson(intent.proposed_snapshot, "proposed_snapshot", INTENT_LIMITS),
  );
  const prior = intent.predecessor_basis.expected_prior_revision;
  const nextRevisionNumber =
    prior === null ? 1 : Number(prior.slice("rev_".length)) + 1;
  if (!Number.isSafeInteger(nextRevisionNumber) || nextRevisionNumber <= 0) {
    throw new IntentRefusal();
  }
  const prepared: PreparedCommit = {
    intent,
    snapshot_json: snapshotJson,
    next_revision_number: nextRevisionNumber,
    next_revision: `rev_${nextRevisionNumber}`,
  };
  return prepared;
}

function checkProspectiveStorage(prepared: PreparedCommit): SubjectGraphRevisionRefusalReason | null {
  if (
    Buffer.byteLength(prepared.snapshot_json, "utf8") >
    SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES
  ) {
    return "snapshot_storage_limit_exceeded";
  }
  const prospective = successReceipt(prepared, OPERATIONAL_TIME_PLACEHOLDER);
  if (
    Buffer.byteLength(canonicalReceiptJson(prospective), "utf8") >
    SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES
  ) {
    return "receipt_storage_limit_exceeded";
  }
  return null;
}

function validateSafePath(options: DisposableSqliteSubjectGraphRevisionTransactionOptions): void {
  const databasePath = options.database_path;
  const isolatedDirectory = options.isolated_temporary_directory;
  if (
    typeof databasePath !== "string" ||
    typeof isolatedDirectory !== "string" ||
    databasePath === ":memory:" ||
    !isAbsolute(databasePath) ||
    !isAbsolute(isolatedDirectory) ||
    resolve(databasePath) !== databasePath ||
    resolve(isolatedDirectory) !== isolatedDirectory ||
    databasePath.length > 4_096 ||
    isolatedDirectory.length > 4_096
  ) {
    throw new IntentRefusal();
  }

  const canonicalOsTemporaryRoot = realpathSync(tmpdir());
  const directoryLstat = lstatSync(isolatedDirectory);
  const canonicalIsolatedDirectory = realpathSync(isolatedDirectory);
  const directoryStat = statSync(canonicalIsolatedDirectory);
  if (
    directoryLstat.isSymbolicLink() ||
    !directoryStat.isDirectory() ||
    canonicalIsolatedDirectory !== isolatedDirectory ||
    canonicalIsolatedDirectory === canonicalOsTemporaryRoot ||
    !canonicalIsolatedDirectory.startsWith(`${canonicalOsTemporaryRoot}${sep}`) ||
    dirname(databasePath) !== canonicalIsolatedDirectory ||
    basename(databasePath) === "" ||
    basename(databasePath) === "." ||
    basename(databasePath) === ".." ||
    (directoryStat.mode & 0o7777) !== 0o700
  ) {
    throw new IntentRefusal();
  }
  if (typeof process.getuid === "function" && directoryStat.uid !== process.getuid()) {
    throw new IntentRefusal();
  }

  const databaseName = basename(databasePath);
  const allowedEntries = new Set([
    databaseName,
    `${databaseName}-wal`,
    `${databaseName}-shm`,
    `${databaseName}-journal`,
  ]);
  for (const entry of readdirSync(canonicalIsolatedDirectory)) {
    if (!allowedEntries.has(entry)) throw new IntentRefusal();
    let artifact;
    try {
      artifact = lstatSync(resolve(canonicalIsolatedDirectory, entry));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        // SQLite may unlink a safe sidecar between the directory listing and
        // lstat. Its absence needs no admission.
        continue;
      }
      throw new IntentRefusal();
    }
    if (
      artifact.isSymbolicLink() ||
      !artifact.isFile() ||
      artifact.nlink !== 1 ||
      (typeof process.getuid === "function" && artifact.uid !== process.getuid())
    ) {
      throw new IntentRefusal();
    }
  }
}

function openDatabaseImmediatelyAfterSafePathValidation(
  options: DisposableSqliteSubjectGraphRevisionTransactionOptions,
  readOnly: boolean,
): DatabaseSync {
  validateSafePath(options);
  return new DatabaseSync(options.database_path, {
    allowExtension: false,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    readBigInts: false,
    readOnly,
    timeout: DISPOSABLE_SQLITE_BUSY_TIMEOUT_MS,
  });
}

function pragmaValue(
  db: DatabaseSync,
  sql: string,
  key: string,
): unknown {
  return (db.prepare(sql).get() as Record<string, unknown> | undefined)?.[key];
}

function verifyUtf8Encoding(db: DatabaseSync): void {
  if (pragmaValue(db, "PRAGMA encoding", "encoding") !== "UTF-8") {
    throw new DurableReadbackFailure();
  }
}

function withBoundedBusyRetry<T>(operation: () => T): T {
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      if (!isBusyLike(error) || attempt === attempts - 1) throw error;
      boundedSleep(25 * (attempt + 1));
    }
  }
  throw new Error("unreachable SQLite retry state");
}

function configureAndVerifyWal(db: DatabaseSync): void {
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const mode = pragmaValue(
        db,
        "PRAGMA journal_mode = WAL",
        "journal_mode",
      );
      if (mode === "wal") return;
      if (attempt === attempts - 1) throw new DurableReadbackFailure();
    } catch (error) {
      if (!isBusyLike(error) || attempt === attempts - 1) throw error;
    }
    boundedSleep(25 * (attempt + 1));
  }
  throw new DurableReadbackFailure();
}

function verifyDatabaseCatalog(db: DatabaseSync): void {
  verifyUtf8Encoding(db);
  const rows = db
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name, tbl_name",
    )
    .all();
  if (rows.length !== DISPOSABLE_SQLITE_SCHEMA_CATALOG_ROW_COUNT) {
    throw new DurableReadbackFailure();
  }
  const digest = createHash("sha256")
    .update(JSON.stringify(rows), "utf8")
    .digest("hex");
  if (digest !== DISPOSABLE_SQLITE_SCHEMA_CATALOG_SHA256) {
    throw new DurableReadbackFailure();
  }
  const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as
    | { readonly foreign_keys?: unknown }
    | undefined;
  if (foreignKeys?.foreign_keys !== 1) {
    throw new DurableReadbackFailure();
  }
  if (pragmaValue(db, "PRAGMA journal_mode", "journal_mode") !== "wal") {
    throw new DurableReadbackFailure();
  }
  if (pragmaValue(db, "PRAGMA synchronous", "synchronous") !== 2) {
    throw new DurableReadbackFailure();
  }
}

function initializeDatabase(
  options: DisposableSqliteSubjectGraphRevisionTransactionOptions,
): DatabaseSync {
  const db = openDatabaseImmediatelyAfterSafePathValidation(options, false);
  let initializationTransactionStarted = false;
  try {
    db.enableLoadExtension(false);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`PRAGMA busy_timeout = ${DISPOSABLE_SQLITE_BUSY_TIMEOUT_MS}`);
    // Check the persistent encoding before any pragma that can alter the file.
    // A catalog-empty UTF-16 database is not a fresh database for this adapter.
    verifyUtf8Encoding(db);
    configureAndVerifyWal(db);
    db.exec("PRAGMA synchronous = FULL");
    withBoundedBusyRetry(() => db.exec("BEGIN IMMEDIATE"));
    initializationTransactionStarted = true;
    const schemaIsEmpty =
      db.prepare("SELECT name FROM sqlite_schema LIMIT 1").get() === undefined;
    if (schemaIsEmpty) {
      db.exec("PRAGMA encoding = 'UTF-8'");
      verifyUtf8Encoding(db);
      db.exec(`
    CREATE TABLE IF NOT EXISTS subject_graph_success_receipts (
      receipt_sha256 TEXT COLLATE BINARY PRIMARY KEY
        CHECK(length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9a-f]*'),
      receipt_core_json TEXT COLLATE BINARY NOT NULL
        CHECK(length(CAST(receipt_core_json AS BLOB)) <= ${SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES}),
      receipt_json TEXT COLLATE BINARY NOT NULL UNIQUE
        CHECK(length(CAST(receipt_json AS BLOB)) <= ${SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES}),
      team_id TEXT COLLATE BINARY NOT NULL,
      account_id TEXT COLLATE BINARY NOT NULL,
      subject_id TEXT COLLATE BINARY NOT NULL,
      purpose TEXT COLLATE BINARY NOT NULL CHECK(purpose = 'candidate_validation'),
      predecessor_revision_token TEXT COLLATE BINARY,
      predecessor_snapshot_sha256 TEXT COLLATE BINARY NOT NULL
        CHECK(length(predecessor_snapshot_sha256) = 64 AND predecessor_snapshot_sha256 NOT GLOB '*[^0-9a-f]*'),
      committed_revision_number INTEGER NOT NULL
        CHECK(committed_revision_number BETWEEN 1 AND ${Number.MAX_SAFE_INTEGER}),
      committed_revision_token TEXT COLLATE BINARY NOT NULL,
      proposed_snapshot_sha256 TEXT COLLATE BINARY NOT NULL
        CHECK(length(proposed_snapshot_sha256) = 64 AND proposed_snapshot_sha256 NOT GLOB '*[^0-9a-f]*'),
      intent_sha256 TEXT COLLATE BINARY NOT NULL UNIQUE
        CHECK(length(intent_sha256) = 64 AND intent_sha256 NOT GLOB '*[^0-9a-f]*'),
      review_handoff_sha256 TEXT COLLATE BINARY NOT NULL
        CHECK(length(review_handoff_sha256) = 64 AND review_handoff_sha256 NOT GLOB '*[^0-9a-f]*'),
      replay_key TEXT COLLATE BINARY NOT NULL UNIQUE
        CHECK(length(replay_key) = 64 AND replay_key NOT GLOB '*[^0-9a-f]*'),
      operational_committed_at TEXT COLLATE BINARY NOT NULL,
      CHECK(committed_revision_token = 'rev_' || CAST(committed_revision_number AS TEXT))
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS subject_graph_success_receipts_canonical_identity_revision
    ON subject_graph_success_receipts (
      json_extract(receipt_json, '$.graph_identity.team_id') COLLATE BINARY,
      json_extract(receipt_json, '$.graph_identity.account_id') COLLATE BINARY,
      json_extract(receipt_json, '$.graph_identity.subject_id') COLLATE BINARY,
      json_extract(receipt_json, '$.graph_identity.purpose') COLLATE BINARY,
      committed_revision_number
    );

    CREATE TABLE IF NOT EXISTS subject_graph_current_state (
      team_id TEXT COLLATE BINARY NOT NULL,
      account_id TEXT COLLATE BINARY NOT NULL,
      subject_id TEXT COLLATE BINARY NOT NULL,
      purpose TEXT COLLATE BINARY NOT NULL CHECK(purpose = 'candidate_validation'),
      revision_number INTEGER NOT NULL
        CHECK(revision_number BETWEEN 1 AND ${Number.MAX_SAFE_INTEGER}),
      revision_token TEXT COLLATE BINARY NOT NULL,
      snapshot_sha256 TEXT COLLATE BINARY NOT NULL
        CHECK(length(snapshot_sha256) = 64 AND snapshot_sha256 NOT GLOB '*[^0-9a-f]*'),
      snapshot_json TEXT COLLATE BINARY NOT NULL
        CHECK(length(CAST(snapshot_json AS BLOB)) <= ${SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES}),
      intent_sha256 TEXT COLLATE BINARY NOT NULL
        CHECK(length(intent_sha256) = 64 AND intent_sha256 NOT GLOB '*[^0-9a-f]*'),
      last_receipt_sha256 TEXT COLLATE BINARY NOT NULL,
      operational_committed_at TEXT COLLATE BINARY NOT NULL,
      PRIMARY KEY(team_id, account_id, subject_id, purpose),
      UNIQUE(last_receipt_sha256),
      FOREIGN KEY(last_receipt_sha256)
        REFERENCES subject_graph_success_receipts(receipt_sha256),
      CHECK(revision_token = 'rev_' || CAST(revision_number AS TEXT))
    ) STRICT;

    CREATE TABLE IF NOT EXISTS subject_graph_replay_consumptions (
      replay_key TEXT COLLATE BINARY PRIMARY KEY
        CHECK(length(replay_key) = 64 AND replay_key NOT GLOB '*[^0-9a-f]*'),
      intent_sha256 TEXT COLLATE BINARY NOT NULL UNIQUE
        CHECK(length(intent_sha256) = 64 AND intent_sha256 NOT GLOB '*[^0-9a-f]*'),
      receipt_sha256 TEXT COLLATE BINARY NOT NULL UNIQUE,
      team_id TEXT COLLATE BINARY NOT NULL,
      account_id TEXT COLLATE BINARY NOT NULL,
      subject_id TEXT COLLATE BINARY NOT NULL,
      purpose TEXT COLLATE BINARY NOT NULL CHECK(purpose = 'candidate_validation'),
      FOREIGN KEY(receipt_sha256)
        REFERENCES subject_graph_success_receipts(receipt_sha256)
    ) STRICT;

    CREATE TRIGGER IF NOT EXISTS subject_graph_success_receipts_immutable_update
    BEFORE UPDATE ON subject_graph_success_receipts
    BEGIN SELECT RAISE(ABORT, 'immutable receipt'); END;

    CREATE TRIGGER IF NOT EXISTS subject_graph_success_receipts_immutable_delete
    BEFORE DELETE ON subject_graph_success_receipts
    BEGIN SELECT RAISE(ABORT, 'immutable receipt'); END;
    `);
    }
    verifyDatabaseCatalog(db);
    db.exec("COMMIT");
    initializationTransactionStarted = false;
    validateSafePath(options);
    return db;
  } catch (error) {
    if (initializationTransactionStarted) {
      rollback(db);
      initializationTransactionStarted = false;
    }
    try {
      db.close();
    } catch {
      // Preserve the initialization failure, not cleanup detail.
    }
    throw error;
  }
}

function selectGraph(db: DatabaseSync, identity: TransactionGraphIdentity) {
  return db
    .prepare(`
      SELECT team_id, account_id, subject_id, purpose,
             revision_number, revision_token, snapshot_sha256, snapshot_json,
             intent_sha256, last_receipt_sha256, operational_committed_at
      FROM subject_graph_current_state
      WHERE team_id = ? AND account_id = ? AND subject_id = ? AND purpose = ?
    `)
    .get(identity.team_id, identity.account_id, identity.subject_id, identity.purpose);
}

function selectReplay(db: DatabaseSync, replayKey: string) {
  return db
    .prepare(`
      SELECT replay_key, intent_sha256, receipt_sha256,
             team_id, account_id, subject_id, purpose
      FROM subject_graph_replay_consumptions
      WHERE replay_key = ?
    `)
    .get(replayKey);
}

function parseGraphRow(raw: Record<string, unknown>): DatabaseGraphRow {
  const row = raw as unknown as DatabaseGraphRow;
  if (
    typeof row.team_id !== "string" ||
    typeof row.account_id !== "string" ||
    typeof row.subject_id !== "string" ||
    row.purpose !== "candidate_validation" ||
    typeof row.revision_number !== "number" ||
    !Number.isSafeInteger(row.revision_number) ||
    row.revision_number <= 0 ||
    row.revision_number > Number.MAX_SAFE_INTEGER ||
    row.revision_token !== `rev_${row.revision_number}` ||
    typeof row.snapshot_sha256 !== "string" ||
    !CANONICAL_SHA256.test(row.snapshot_sha256) ||
    typeof row.snapshot_json !== "string" ||
    Buffer.byteLength(row.snapshot_json, "utf8") >
      SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES ||
    typeof row.intent_sha256 !== "string" ||
    !CANONICAL_SHA256.test(row.intent_sha256) ||
    typeof row.last_receipt_sha256 !== "string" ||
    !CANONICAL_SHA256.test(row.last_receipt_sha256) ||
    typeof row.operational_committed_at !== "string" ||
    !CANONICAL_UTC_TIMESTAMP.test(row.operational_committed_at)
  ) {
    throw new DurableReadbackFailure();
  }
  return row;
}

function parseReplayRow(raw: Record<string, unknown>): DatabaseReplayRow {
  const row = raw as unknown as DatabaseReplayRow;
  if (
    typeof row.replay_key !== "string" ||
    !CANONICAL_SHA256.test(row.replay_key) ||
    typeof row.intent_sha256 !== "string" ||
    !CANONICAL_SHA256.test(row.intent_sha256) ||
    typeof row.receipt_sha256 !== "string" ||
    !CANONICAL_SHA256.test(row.receipt_sha256) ||
    typeof row.team_id !== "string" ||
    !SAFE_TEAM_ID.test(row.team_id) ||
    typeof row.account_id !== "string" ||
    !SAFE_ACCOUNT_ID.test(row.account_id) ||
    typeof row.subject_id !== "string" ||
    !SAFE_SUBJECT_ID.test(row.subject_id) ||
    row.purpose !== "candidate_validation"
  ) {
    throw new DurableReadbackFailure();
  }
  return row;
}

function verifyReplayLink(
  replay: DatabaseReplayRow,
  receipt: SubjectGraphRevisionSuccessReceipt,
  identity: TransactionGraphIdentity,
): void {
  if (
    replay.replay_key !== receipt.replay_key ||
    replay.intent_sha256 !== receipt.intent_sha256 ||
    replay.receipt_sha256 !== receipt.receipt_sha256 ||
    replay.team_id !== identity.team_id ||
    replay.account_id !== identity.account_id ||
    replay.subject_id !== identity.subject_id ||
    replay.purpose !== identity.purpose ||
    receipt.graph_identity.team_id !== identity.team_id ||
    receipt.graph_identity.account_id !== identity.account_id ||
    receipt.graph_identity.subject_id !== identity.subject_id ||
    receipt.graph_identity.purpose !== identity.purpose
  ) {
    throw new DurableReadbackFailure();
  }
}

function parseStoredReceipt(rawJson: string): SubjectGraphRevisionSuccessReceipt {
  if (
    Buffer.byteLength(rawJson, "utf8") >
    SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES
  ) {
    throw new DurableReadbackFailure();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new DurableReadbackFailure();
  }
  let root: { [key: string]: StrictJsonValue };
  try {
    root = strictJsonObject(
      snapshotStrictJson(parsed, "stored_receipt", RECEIPT_LIMITS),
      "stored_receipt",
    );
    assertExactKeys(
      root,
      [
        "kind",
        "version",
        "outcome",
        "graph_identity",
        "predecessor_basis",
        "committed_revision",
        "proposed_snapshot_sha256",
        "intent_sha256",
        "review_handoff_sha256",
        "replay_key",
        "operational_committed_at",
        "authority",
        "receipt_sha256",
      ],
      "stored_receipt",
    );
  } catch {
    throw new DurableReadbackFailure();
  }
  if (
    root.kind !== "atliera_subject_graph_revision_success_receipt" ||
    root.version !== 1 ||
    root.outcome !== "committed"
  ) {
    throw new DurableReadbackFailure();
  }
  const suppliedDigest = root.receipt_sha256;
  if (typeof suppliedDigest !== "string" || !CANONICAL_SHA256.test(suppliedDigest)) {
    throw new DurableReadbackFailure();
  }
  const core: { [key: string]: StrictJsonValue } = {};
  for (const [key, value] of Object.entries(root)) {
    if (key !== "receipt_sha256") core[key] = value;
  }
  if (
    sha256CanonicalJson(core) !== suppliedDigest ||
    canonicalJson(root) !== rawJson
  ) {
    throw new DurableReadbackFailure();
  }
  try {
    const identity = validateGraphIdentity(root.graph_identity);
    const basis = validatePredecessorBasis(root.predecessor_basis, identity);
    const committedRevisionRaw = root.committed_revision;
    if (typeof committedRevisionRaw !== "string") {
      throw new DurableReadbackFailure();
    }
    const revisionMatch = CANONICAL_REVISION.exec(committedRevisionRaw);
    const committedRevisionNumber = Number(revisionMatch?.[1]);
    const predecessorNumber =
      basis.expected_prior_revision === null
        ? null
        : Number(basis.expected_prior_revision.slice("rev_".length));
    if (
      revisionMatch === null ||
      !Number.isSafeInteger(committedRevisionNumber) ||
      committedRevisionNumber <= 0 ||
      committedRevisionNumber > Number.MAX_SAFE_INTEGER ||
      committedRevisionNumber !==
        (predecessorNumber === null ? 1 : predecessorNumber + 1)
    ) {
      throw new DurableReadbackFailure();
    }
    digest(root.proposed_snapshot_sha256);
    digest(root.intent_sha256);
    digest(root.review_handoff_sha256);
    digest(root.replay_key);
    validateTimestamp(root.operational_committed_at);
    const authority = object(root.authority, "stored_receipt.authority");
    exact(authority, SUCCESS_RECEIPT_AUTHORITY_KEYS, "stored_receipt.authority");
    if (!sameCanonical(authority, receiptAuthority())) {
      throw new DurableReadbackFailure();
    }
  } catch {
    throw new DurableReadbackFailure();
  }
  return deepFreezeOwnData(parsed as SubjectGraphRevisionSuccessReceipt);
}

function selectReceipt(db: DatabaseSync, receiptSha256: string) {
  return db
    .prepare(`
      SELECT receipt_sha256, receipt_core_json, receipt_json,
             team_id, account_id, subject_id, purpose,
             predecessor_revision_token, predecessor_snapshot_sha256,
             committed_revision_number, committed_revision_token,
             proposed_snapshot_sha256, intent_sha256,
             review_handoff_sha256, replay_key, operational_committed_at
      FROM subject_graph_success_receipts
      WHERE receipt_sha256 = ?
    `)
    .get(receiptSha256);
}

function selectReceiptByReplayKey(db: DatabaseSync, replayKey: string) {
  return db
    .prepare(`
      SELECT receipt_sha256, receipt_core_json, receipt_json,
             team_id, account_id, subject_id, purpose,
             predecessor_revision_token, predecessor_snapshot_sha256,
             committed_revision_number, committed_revision_token,
             proposed_snapshot_sha256, intent_sha256,
             review_handoff_sha256, replay_key, operational_committed_at
      FROM subject_graph_success_receipts
      WHERE replay_key = ?
    `)
    .get(replayKey);
}

function hasEmbeddedReceiptIdentityEvidence(
  db: DatabaseSync,
  identity: TransactionGraphIdentity,
): boolean {
  const identityValues = [
    identity.team_id,
    identity.account_id,
    identity.subject_id,
    identity.purpose,
  ] as const;
  const row = db
    .prepare(`
      SELECT 1 AS present
      FROM subject_graph_success_receipts
      WHERE (
        CASE WHEN json_valid(receipt_json) = 1
          THEN json_extract(receipt_json, '$.graph_identity.team_id') END = ?
        AND CASE WHEN json_valid(receipt_json) = 1
          THEN json_extract(receipt_json, '$.graph_identity.account_id') END = ?
        AND CASE WHEN json_valid(receipt_json) = 1
          THEN json_extract(receipt_json, '$.graph_identity.subject_id') END = ?
        AND CASE WHEN json_valid(receipt_json) = 1
          THEN json_extract(receipt_json, '$.graph_identity.purpose') END = ?
      ) OR (
        CASE WHEN json_valid(receipt_core_json) = 1
          THEN json_extract(receipt_core_json, '$.graph_identity.team_id') END = ?
        AND CASE WHEN json_valid(receipt_core_json) = 1
          THEN json_extract(receipt_core_json, '$.graph_identity.account_id') END = ?
        AND CASE WHEN json_valid(receipt_core_json) = 1
          THEN json_extract(receipt_core_json, '$.graph_identity.subject_id') END = ?
        AND CASE WHEN json_valid(receipt_core_json) = 1
          THEN json_extract(receipt_core_json, '$.graph_identity.purpose') END = ?
      )
      LIMIT 1
    `)
    .get(...identityValues, ...identityValues);
  return row !== undefined;
}

function verifyReceiptRow(
  raw: Record<string, unknown> | undefined,
  expectedIntent?: ValidatedIntent,
): SubjectGraphRevisionSuccessReceipt {
  if (raw === undefined || typeof raw.receipt_json !== "string") {
    throw new DurableReadbackFailure();
  }
  const receipt = parseStoredReceipt(raw.receipt_json);
  const core = { ...receipt } as Record<string, unknown>;
  delete core.receipt_sha256;
  const coreJson = canonicalJson(
    snapshotStrictJson(core, "stored_receipt_core", RECEIPT_LIMITS),
  );
  const identity = receipt.graph_identity;
  const prior = receipt.predecessor_basis.expected_prior_revision;
  if (
    raw.receipt_sha256 !== receipt.receipt_sha256 ||
    raw.receipt_core_json !== coreJson ||
    raw.team_id !== identity.team_id ||
    raw.account_id !== identity.account_id ||
    raw.subject_id !== identity.subject_id ||
    raw.purpose !== identity.purpose ||
    raw.predecessor_revision_token !== prior ||
    raw.predecessor_snapshot_sha256 !==
      receipt.predecessor_basis.expected_base_snapshot_sha256 ||
    raw.committed_revision_token !== receipt.committed_revision ||
    raw.committed_revision_number !==
      Number(receipt.committed_revision.slice("rev_".length)) ||
    raw.proposed_snapshot_sha256 !== receipt.proposed_snapshot_sha256 ||
    raw.intent_sha256 !== receipt.intent_sha256 ||
    raw.review_handoff_sha256 !== receipt.review_handoff_sha256 ||
    raw.replay_key !== receipt.replay_key ||
    raw.operational_committed_at !== receipt.operational_committed_at
  ) {
    throw new DurableReadbackFailure();
  }
  if (
    expectedIntent !== undefined &&
    (receipt.intent_sha256 !== expectedIntent.intent_sha256 ||
      receipt.replay_key !== expectedIntent.replay_key_to_record ||
      receipt.proposed_snapshot_sha256 !== expectedIntent.proposed_snapshot_sha256 ||
      receipt.review_handoff_sha256 !== expectedIntent.review_handoff_sha256 ||
      !sameCanonical(receipt.graph_identity, expectedIntent.graph_identity) ||
      !sameCanonical(receipt.predecessor_basis, expectedIntent.predecessor_basis))
  ) {
    throw new DurableReadbackFailure();
  }
  return receipt;
}

function verifyCurrentGraphRow(
  raw: Record<string, unknown>,
  expectedIdentity: TransactionGraphIdentity,
): { readonly row: DatabaseGraphRow; readonly candidate: ValidatedCandidate } {
  const row = parseGraphRow(raw);
  if (
    row.team_id !== expectedIdentity.team_id ||
    row.account_id !== expectedIdentity.account_id ||
    row.subject_id !== expectedIdentity.subject_id ||
    row.purpose !== expectedIdentity.purpose
  ) {
    throw new DurableReadbackFailure();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.snapshot_json);
  } catch {
    throw new DurableReadbackFailure();
  }
  let candidate: ValidatedCandidate;
  try {
    candidate = hydrateValidatedCandidate(parsed);
  } catch {
    throw new DurableReadbackFailure();
  }
  const canonical = canonicalJson(
    snapshotStrictJson(candidate, "stored_candidate", INTENT_LIMITS),
  );
  if (
    canonical !== row.snapshot_json ||
    validatedCandidateSha256(candidate) !== row.snapshot_sha256 ||
    candidate.subject.team_id !== expectedIdentity.team_id ||
    candidate.subject.account_id !== expectedIdentity.account_id
  ) {
    throw new DurableReadbackFailure();
  }
  return { row, candidate };
}

function verifyCurrentReceiptLink(
  row: DatabaseGraphRow,
  receipt: SubjectGraphRevisionSuccessReceipt,
): void {
  if (
    row.revision_token !== receipt.committed_revision ||
    row.snapshot_sha256 !== receipt.proposed_snapshot_sha256 ||
    row.intent_sha256 !== receipt.intent_sha256 ||
    row.last_receipt_sha256 !== receipt.receipt_sha256 ||
    row.operational_committed_at !== receipt.operational_committed_at ||
    row.team_id !== receipt.graph_identity.team_id ||
    row.account_id !== receipt.graph_identity.account_id ||
    row.subject_id !== receipt.graph_identity.subject_id ||
    row.purpose !== receipt.graph_identity.purpose
  ) {
    throw new DurableReadbackFailure();
  }
}

function verifiedHistoricalReadback(
  db: DatabaseSync,
  intent: ValidatedIntent,
): VerifiedReadback {
  const replayRaw = selectReplay(db, intent.replay_key_to_record);
  if (replayRaw === undefined) throw new DurableReadbackFailure();
  const replay = parseReplayRow(replayRaw);
  if (
    replay.replay_key !== intent.replay_key_to_record ||
    replay.intent_sha256 !== intent.intent_sha256
  ) {
    throw new DurableReadbackFailure();
  }
  const receipt = verifyReceiptRow(
    selectReceipt(db, replay.receipt_sha256),
    intent,
  );
  verifyReplayLink(replay, receipt, intent.graph_identity);
  const state: SubjectGraphRevisionCommittedState = {
    graph_identity: { ...intent.graph_identity },
    revision: receipt.committed_revision,
    snapshot_sha256: intent.proposed_snapshot_sha256,
    snapshot: intent.proposed_snapshot,
    intent_sha256: intent.intent_sha256,
    last_receipt_sha256: receipt.receipt_sha256,
    operational_committed_at: receipt.operational_committed_at,
  };
  return deepFreezeOwnData({ receipt, state });
}

function verifiedReadback(
  db: DatabaseSync,
  intent: ValidatedIntent,
): VerifiedReadback {
  let readTransactionStarted = false;
  try {
    db.exec("BEGIN");
    readTransactionStarted = true;
    verifyDatabaseCatalog(db);
    // A valid successor may commit after this intent's COMMIT but before its
    // acknowledgement/read-back. Historical replay plus receipt establish this
    // intent's commit; current-head verification is a separate health check.
    const historical = verifiedHistoricalReadback(db, intent);
    if (verifiedCurrentReadback(db, intent.graph_identity) === null) {
      throw new DurableReadbackFailure();
    }
    db.exec("COMMIT");
    readTransactionStarted = false;
    return historical;
  } catch (error) {
    if (readTransactionStarted) rollback(db);
    throw error;
  }
}

function verifiedCurrentDurableState(
  db: DatabaseSync,
  identity: TransactionGraphIdentity,
) {
  const graphRaw = selectGraph(db, identity);
  if (graphRaw === undefined) {
    const identityValues = [
      identity.team_id,
      identity.account_id,
      identity.subject_id,
      identity.purpose,
    ] as const;
    const replayEvidence = db
      .prepare(`
        SELECT 1 AS present
        FROM subject_graph_replay_consumptions
        WHERE team_id = ? AND account_id = ? AND subject_id = ? AND purpose = ?
        LIMIT 1
      `)
      .get(...identityValues);
    const embeddedReceiptEvidence = hasEmbeddedReceiptIdentityEvidence(db, identity);
    if (
      replayEvidence !== undefined ||
      embeddedReceiptEvidence
    ) {
      throw new DurableReadbackFailure();
    }
    return null;
  }
  const graph = verifyCurrentGraphRow(graphRaw, identity);
  const receipt = verifyReceiptRow(
    selectReceipt(db, graph.row.last_receipt_sha256),
  );
  verifyCurrentReceiptLink(graph.row, receipt);
  const replayRaw = selectReplay(db, receipt.replay_key);
  if (replayRaw === undefined) throw new DurableReadbackFailure();
  verifyReplayLink(parseReplayRow(replayRaw), receipt, identity);
  return { graph, receipt };
}

function verifiedCurrentReadback(
  db: DatabaseSync,
  identity: TransactionGraphIdentity,
): VerifiedReadback | null {
  const current = verifiedCurrentDurableState(db, identity);
  if (current === null) return null;
  const { graph, receipt } = current;
  return deepFreezeOwnData({
    receipt,
    state: {
      graph_identity: { ...identity },
      revision: graph.row.revision_token as SubjectGraphRevisionToken,
      snapshot_sha256: graph.row.snapshot_sha256,
      snapshot: graph.candidate,
      intent_sha256: graph.row.intent_sha256,
      last_receipt_sha256: graph.row.last_receipt_sha256,
      operational_committed_at: graph.row.operational_committed_at,
    },
  });
}

function probeCommitFromIndependentConnection(
  options: DisposableSqliteSubjectGraphRevisionTransactionOptions,
  intent: ValidatedIntent,
): CommitRecoveryProbe {
  let db: DatabaseSync | undefined;
  let readTransactionStarted = false;
  try {
    db = openDatabaseImmediatelyAfterSafePathValidation(options, true);
    db.enableLoadExtension(false);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA synchronous = FULL");
    validateSafePath(options);
    db.exec("BEGIN");
    readTransactionStarted = true;
    verifyDatabaseCatalog(db);
    const replay = selectReplay(db, intent.replay_key_to_record);
    if (replay === undefined) {
      db.exec("COMMIT");
      readTransactionStarted = false;
      return { status: "absent" };
    }
    const historical = verifiedHistoricalReadback(db, intent);
    let result: CommitRecoveryProbe;
    try {
      if (verifiedCurrentReadback(db, intent.graph_identity) === null) {
        throw new DurableReadbackFailure();
      }
      result = { status: "committed", readback: historical };
    } catch {
      result = { status: "committed_readback_failed" };
    }
    db.exec("COMMIT");
    readTransactionStarted = false;
    return result;
  } catch {
    if (db !== undefined && readTransactionStarted) {
      rollback(db);
      readTransactionStarted = false;
    }
    return { status: "unresolved" };
  } finally {
    if (db !== undefined) {
      if (readTransactionStarted) rollback(db);
      try {
        db.close();
      } catch {
        // Probe cleanup cannot strengthen or weaken its evidence.
      }
    }
  }
}

function dimensionsFromRow(row: DatabaseGraphRow | null): SubjectGraphRevisionConflictDimensions {
  return {
    revision:
      row === null ? null : (row.revision_token as SubjectGraphRevisionToken),
    snapshot_sha256: row?.snapshot_sha256 ?? null,
  };
}

function conflictKind(
  expected: SubjectGraphRevisionConflictDimensions,
  actual: SubjectGraphRevisionConflictDimensions,
): SubjectGraphRevisionConflictKind | null {
  // Bootstrap compares the durable absence of both dimensions. Its base
  // digest describes the reviewed empty candidate; there is no durable
  // snapshot digest to compare when the graph row is absent.
  if (actual.revision === null && expected.revision === null) return null;
  if (actual.revision === null && expected.revision !== null) return "missing_graph";
  const revisionMismatch = actual.revision !== expected.revision;
  const snapshotMismatch = actual.snapshot_sha256 !== expected.snapshot_sha256;
  if (revisionMismatch && snapshotMismatch) return "revision_and_snapshot_mismatch";
  if (revisionMismatch) return "revision_mismatch";
  if (snapshotMismatch) return "snapshot_mismatch";
  return null;
}

function conflictResult(
  intent: ValidatedIntent,
  kind: SubjectGraphRevisionConflictKind,
  expected: SubjectGraphRevisionConflictDimensions,
  actual: SubjectGraphRevisionConflictDimensions,
): SubjectGraphRevisionTransactionResult {
  const core: SubjectGraphRevisionConflictReceiptCore = {
    kind: "atliera_subject_graph_revision_conflict_receipt",
    version: 1,
    outcome: "conflicted",
    conflict_kind: kind,
    graph_identity: { ...intent.graph_identity },
    intent_sha256: intent.intent_sha256,
    replay_key: intent.replay_key_to_record,
    expected: { ...expected },
    actual: { ...actual },
    persisted: false,
  };
  const receipt = deterministicReceipt<SubjectGraphRevisionConflictReceipt>(core);
  return deepFreezeOwnData({
    outcome: "conflicted",
    committed: false,
    applied: false,
    conflict_kind: kind,
    expected: { ...expected },
    actual: { ...actual },
    receipt,
  });
}

function rollback(db: DatabaseSync): boolean {
  try {
    db.exec("ROLLBACK");
    return true;
  } catch {
    return false;
  }
}

function isBusyLike(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { readonly code?: unknown; readonly errcode?: unknown };
  return (
    candidate.code === "SQLITE_BUSY" ||
    candidate.errcode === 5 ||
    candidate.errcode === 6
  );
}

export class DisposableSqliteSubjectGraphRevisionTransaction
  implements SubjectGraphRevisionTransaction
{
  readonly #options: DisposableSqliteSubjectGraphRevisionTransactionOptions;

  constructor(options: DisposableSqliteSubjectGraphRevisionTransactionOptions) {
    this.#options = snapshotOptions(options);
  }

  readCurrent(rawIdentity: unknown, rawPermit: unknown): SubjectGraphRevisionReadResult {
    try {
      validatePermit(rawPermit);
    } catch {
      return deepFreezeOwnData({
        outcome: "refused",
        found: false,
        reason: "invalid_lab_permit",
      });
    }
    try {
      validateSafePath(this.#options);
    } catch {
      return deepFreezeOwnData({
        outcome: "refused",
        found: false,
        reason: "unsafe_database_path",
      });
    }
    let identity: TransactionGraphIdentity;
    try {
      identity = validateReadGraphIdentity(rawIdentity);
    } catch {
      return deepFreezeOwnData({
        outcome: "refused",
        found: false,
        reason: "malformed_graph_identity",
      });
    }

    let db: DatabaseSync | undefined;
    let readTransactionStarted = false;
    try {
      db = openDatabaseImmediatelyAfterSafePathValidation(this.#options, true);
      db.enableLoadExtension(false);
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("PRAGMA synchronous = FULL");
      validateSafePath(this.#options);
      db.exec("BEGIN");
      readTransactionStarted = true;
      verifyDatabaseCatalog(db);
      const readback = verifiedCurrentReadback(db, identity);
      db.exec("COMMIT");
      readTransactionStarted = false;
      if (readback === null) {
        return deepFreezeOwnData({
          outcome: "not_found",
          found: false,
          graph_identity: { ...identity },
        });
      }
      return deepFreezeOwnData({
        outcome: "found",
        found: true,
        receipt: readback.receipt,
        state: readback.state,
      });
    } catch (error) {
      if (db !== undefined && readTransactionStarted) {
        rollback(db);
        readTransactionStarted = false;
      }
      return deepFreezeOwnData({
        outcome: "dependency_failed",
        found: "indeterminate",
        failure_code:
          error instanceof DurableReadbackFailure
            ? "durable_state_invalid"
            : isBusyLike(error)
              ? "database_unavailable_or_busy"
              : "transaction_failed",
        message: "Disposable SQLite revision read dependency failed",
      });
    } finally {
      if (db !== undefined) {
        if (readTransactionStarted) rollback(db);
        try {
          db.close();
        } catch {
          // Read cleanup does not change verified durable content.
        }
      }
    }
  }

  consume(rawIntent: unknown, rawPermit: unknown): SubjectGraphRevisionTransactionResult {
    try {
      validatePermit(rawPermit);
    } catch {
      return refusal("invalid_lab_permit");
    }
    try {
      validateSafePath(this.#options);
    } catch {
      return refusal("unsafe_database_path");
    }

    let intent: ValidatedIntent;
    try {
      intent = validateIntent(rawIntent);
    } catch {
      return refusal("malformed_intent");
    }
    let prepared: PreparedCommit;
    try {
      prepared = prepareCommit(intent);
    } catch {
      return refusal("malformed_intent", intent);
    }
    const storageRefusal = checkProspectiveStorage(prepared);
    if (storageRefusal !== null) return refusal(storageRefusal, intent);

    let db: DatabaseSync | undefined;
    let transactionStarted = false;
    let commitAttempted = false;
    let commitKnownSuccessful = false;
    let outcome: SubjectGraphRevisionTransactionResult | undefined;
    try {
      db = initializeDatabase(this.#options);
      applyTestFault(
        this.#options.test_only_fault_plan,
        "after_open_before_transaction",
      );
      applyTestFault(this.#options.test_only_fault_plan, "before_transaction");
      validateSafePath(this.#options);
      db.exec("BEGIN IMMEDIATE");
      transactionStarted = true;
      verifyDatabaseCatalog(db);
      validateSafePath(this.#options);
      applyTestFault(this.#options.test_only_fault_plan, "after_begin");

      const replayRaw = selectReplay(db, intent.replay_key_to_record);
      if (replayRaw !== undefined) {
        const replay = parseReplayRow(replayRaw);
        const persistedReceipt = verifyReceiptRow(
          selectReceipt(db, replay.receipt_sha256),
        );
        verifyReplayLink(
          replay,
          persistedReceipt,
          persistedReceipt.graph_identity,
        );
        if (replay.intent_sha256 !== intent.intent_sha256) {
          rollback(db);
          transactionStarted = false;
          return refusal("replay_key_collision", intent);
        }
        const historical = verifiedHistoricalReadback(db, intent);
        let currentVerified = false;
        try {
          currentVerified =
            verifiedCurrentReadback(db, intent.graph_identity) !== null;
        } catch {
          // Historical replay and receipt already prove this exact commit. A
          // separate current-head integrity failure must not erase that truth.
        }
        rollback(db);
        transactionStarted = false;
        if (!currentVerified) {
          return deepFreezeOwnData({
            outcome: "committed_readback_failed",
            committed: true,
            failure_code: "post_commit_verification_failed",
            message: "Commit succeeded but durable read-back verification failed",
            recovery: recoveryIdentity(intent),
          });
        }
        return deepFreezeOwnData({
          outcome: "already_committed",
          committed: true,
          applied: false,
          receipt: historical.receipt,
        });
      }

      // A receipt with this replay key but no replay-consumption row is
      // orphaned durable evidence, not a fresh intent or an ordinary CAS miss.
      const orphanedReceipt = selectReceiptByReplayKey(
        db,
        intent.replay_key_to_record,
      );
      if (orphanedReceipt !== undefined) {
        verifyReceiptRow(orphanedReceipt, intent);
        throw new DurableReadbackFailure();
      }

      const current = verifiedCurrentDurableState(db, intent.graph_identity);
      const graph = current?.graph ?? null;
      const expected: SubjectGraphRevisionConflictDimensions = {
        revision: intent.predecessor_basis.expected_prior_revision,
        snapshot_sha256: intent.predecessor_basis.expected_base_snapshot_sha256,
      };
      const actual = dimensionsFromRow(graph?.row ?? null);
      const mismatch = conflictKind(expected, actual);
      if (mismatch !== null) {
        rollback(db);
        transactionStarted = false;
        return conflictResult(intent, mismatch, expected, actual);
      }

      // Whole-second UTC is deliberately used here. It is canonical for the
      // receipt validator even at an exact second boundary, whereas SQLite's
      // `%f` spelling can produce non-canonical `.000Z`.
      const timeRow = db
        .prepare("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now') AS committed_at")
        .get();
      const committedAt = timeRow?.committed_at;
      if (
        typeof committedAt !== "string" ||
        !CANONICAL_UTC_TIMESTAMP.test(committedAt)
      ) {
        throw new DurableReadbackFailure();
      }
      const receipt = successReceipt(prepared, committedAt);
      const receiptJson = canonicalReceiptJson(receipt);
      const receiptCore = { ...receipt } as Record<string, unknown>;
      delete receiptCore.receipt_sha256;
      const receiptCoreJson = canonicalJson(
        snapshotStrictJson(receiptCore, "success_receipt_core", RECEIPT_LIMITS),
      );
      if (
        Buffer.byteLength(receiptJson, "utf8") >
        SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES
      ) {
        rollback(db);
        transactionStarted = false;
        return refusal("receipt_storage_limit_exceeded", intent);
      }

      db.prepare(`
        INSERT INTO subject_graph_success_receipts (
          receipt_sha256, receipt_core_json, receipt_json,
          team_id, account_id, subject_id, purpose,
          predecessor_revision_token, predecessor_snapshot_sha256,
          committed_revision_number, committed_revision_token,
          proposed_snapshot_sha256, intent_sha256, review_handoff_sha256,
          replay_key, operational_committed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        receipt.receipt_sha256,
        receiptCoreJson,
        receiptJson,
        intent.graph_identity.team_id,
        intent.graph_identity.account_id,
        intent.graph_identity.subject_id,
        intent.graph_identity.purpose,
        intent.predecessor_basis.expected_prior_revision,
        intent.predecessor_basis.expected_base_snapshot_sha256,
        prepared.next_revision_number,
        prepared.next_revision,
        intent.proposed_snapshot_sha256,
        intent.intent_sha256,
        intent.review_handoff_sha256,
        intent.replay_key_to_record,
        committedAt,
      );

      if (graph === null) {
        db.prepare(`
          INSERT INTO subject_graph_current_state (
            team_id, account_id, subject_id, purpose,
            revision_number, revision_token, snapshot_sha256, snapshot_json,
            intent_sha256, last_receipt_sha256, operational_committed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          intent.graph_identity.team_id,
          intent.graph_identity.account_id,
          intent.graph_identity.subject_id,
          intent.graph_identity.purpose,
          prepared.next_revision_number,
          prepared.next_revision,
          intent.proposed_snapshot_sha256,
          prepared.snapshot_json,
          intent.intent_sha256,
          receipt.receipt_sha256,
          committedAt,
        );
      } else {
        const update = db.prepare(`
          UPDATE subject_graph_current_state
          SET revision_number = ?, revision_token = ?, snapshot_sha256 = ?,
              snapshot_json = ?, intent_sha256 = ?, last_receipt_sha256 = ?,
              operational_committed_at = ?
          WHERE team_id = ? AND account_id = ? AND subject_id = ? AND purpose = ?
            AND revision_number = ? AND revision_token = ? AND snapshot_sha256 = ?
        `).run(
          prepared.next_revision_number,
          prepared.next_revision,
          intent.proposed_snapshot_sha256,
          prepared.snapshot_json,
          intent.intent_sha256,
          receipt.receipt_sha256,
          committedAt,
          intent.graph_identity.team_id,
          intent.graph_identity.account_id,
          intent.graph_identity.subject_id,
          intent.graph_identity.purpose,
          graph.row.revision_number,
          graph.row.revision_token,
          graph.row.snapshot_sha256,
        );
        if (update.changes !== 1) throw new DurableReadbackFailure();
      }
      applyTestFault(this.#options.test_only_fault_plan, "after_graph_write");

      db.prepare(`
        INSERT INTO subject_graph_replay_consumptions (
          replay_key, intent_sha256, receipt_sha256,
          team_id, account_id, subject_id, purpose
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        intent.replay_key_to_record,
        intent.intent_sha256,
        receipt.receipt_sha256,
        intent.graph_identity.team_id,
        intent.graph_identity.account_id,
        intent.graph_identity.subject_id,
        intent.graph_identity.purpose,
      );
      applyTestFault(this.#options.test_only_fault_plan, "after_replay_write");

      // COMMIT is the effect point. A throw before this helper returns leaves
      // acknowledgement uncertain, so the catch path performs durable replay
      // and receipt recovery rather than claiming no effect.
      commitAttempted = true;
      db.exec("COMMIT");
      transactionStarted = false;
      applyTestFault(
        this.#options.test_only_fault_plan,
        "after_commit_before_acknowledgement",
      );
      commitKnownSuccessful = true;

      try {
        applyTestFault(
          this.#options.test_only_fault_plan,
          "after_commit_before_readback",
        );
        validateSafePath(this.#options);
        const readback = verifiedReadback(db, intent);
        outcome = deepFreezeOwnData({
          outcome: "committed",
          committed: true,
          commit_acknowledgement: "direct",
          receipt: readback.receipt,
          state: readback.state,
        });
      } catch {
        outcome = deepFreezeOwnData({
          outcome: "committed_readback_failed",
          committed: true,
          failure_code: "post_commit_verification_failed",
          message: "Commit succeeded but durable read-back verification failed",
          recovery: recoveryIdentity(intent),
        });
      }
    } catch (error) {
      if (commitKnownSuccessful) {
        outcome = deepFreezeOwnData({
          outcome: "committed_readback_failed",
          committed: true,
          failure_code: "post_commit_verification_failed",
          message: "Commit succeeded but durable read-back verification failed",
          recovery: recoveryIdentity(intent),
        });
      } else if (commitAttempted && db !== undefined) {
        // If SQLite left the transaction open, a successful rollback proves
        // that this connection did not commit. Otherwise only an independent
        // connection may establish durable visibility; the writer connection
        // could still see its own uncommitted replay row.
        const rollbackProven = transactionStarted ? rollback(db) : false;
        transactionStarted = false;
        try {
          applyTestFault(
            this.#options.test_only_fault_plan,
            "before_commit_recovery_probe",
          );
          const probe = probeCommitFromIndependentConnection(
            this.#options,
            intent,
          );
          if (probe.status === "committed") {
            outcome = deepFreezeOwnData({
              outcome: "committed",
              committed: true,
              commit_acknowledgement: "recovered_after_commit_boundary_failure",
              receipt: probe.readback.receipt,
              state: probe.readback.state,
            });
          } else if (probe.status === "committed_readback_failed") {
            outcome = deepFreezeOwnData({
              outcome: "committed_readback_failed",
              committed: true,
              failure_code: "post_commit_verification_failed",
              message: "Commit succeeded but durable read-back verification failed",
              recovery: recoveryIdentity(intent),
            });
          } else if (probe.status === "absent" && rollbackProven) {
            outcome = dependencyFailed("rolled_back", "transaction_failed");
          } else {
            outcome = deepFreezeOwnData({
              outcome: "indeterminate",
              committed: "indeterminate",
              failure_code: "commit_outcome_unresolved",
              message: "Commit outcome could not be established by durable recovery",
              recovery: recoveryIdentity(intent),
            });
          }
        } catch {
          outcome = rollbackProven
            ? dependencyFailed("rolled_back", "transaction_failed")
            : deepFreezeOwnData({
                outcome: "indeterminate",
                committed: "indeterminate",
                failure_code: "commit_outcome_unresolved",
                message: "Commit outcome could not be established by durable recovery",
                recovery: recoveryIdentity(intent),
              });
        }
      } else if (transactionStarted && db !== undefined) {
        const rolledBack = rollback(db);
        transactionStarted = false;
        outcome = rolledBack
          ? dependencyFailed(
              "rolled_back",
              error instanceof DurableReadbackFailure
                ? "durable_state_invalid"
                : "transaction_failed",
            )
          : deepFreezeOwnData({
              outcome: "indeterminate",
              committed: "indeterminate",
              failure_code: "commit_outcome_unresolved",
              message: "Commit outcome could not be established by durable recovery",
              recovery: recoveryIdentity(intent),
            });
      } else {
        outcome = dependencyFailed(
          "not_started",
          isBusyLike(error)
            ? "database_unavailable_or_busy"
            : error instanceof DurableReadbackFailure
              ? "durable_state_invalid"
              : "transaction_failed",
        );
      }
    } finally {
      if (db !== undefined) {
        try {
          db.close();
        } catch {
          // Best-effort cleanup cannot overwrite known commit truth.
        }
      }
    }
    return outcome ?? dependencyFailed("not_started", "transaction_failed");
  }
}
