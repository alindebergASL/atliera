import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { types as nodeUtilTypes } from "node:util";

import {
  authorizeBearerTokenRequest,
  type HttpHeadersLike,
  type LocalBearerAuthConfig,
} from "../auth/bearer-token-auth.ts";
import {
  assertExactKeys,
  canonicalJson,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES,
  CANDIDATE_TRANSITION_MAX_JSON_NODES,
  CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES,
  hydrateCandidateDelta,
  hydrateCandidateTransition,
  type CandidateDelta,
  type CandidateQualityGatePolicyIdentity,
  type CandidateTransition,
} from "../graph/candidate-delta.ts";
import {
  SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION,
  createSubjectGraphRevisionIntent,
  hydrateSubjectGraphRevisionIntent,
  type SubjectGraphRevisionIntent,
  type SubjectGraphRevisionReviewAuthority,
  type SubjectGraphRevisionReviewHandoff,
} from "../graph/subject-graph-revision-intent.ts";
import type { QualityGateReport } from "../gate/quality-gate.ts";
import {
  hydrateProposalEnvelope,
  type ProposalEnvelope,
} from "../validation/proposal-envelope.ts";
import {
  PINNED_DURABLE_WRITE_TRUST_LABEL,
} from "./proposal-durable-graph-write-contract.ts";
import {
  ARMED_LIFECYCLE_STATE,
} from "./proposal-durable-graph-write-operator-arming.ts";
import type { WorkshopProposalHumanReviewDecisionKind } from "./proposal-review-decision.ts";
import { WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT } from "./render-html.ts";
import {
  executeSyntheticTransactionWorkshopProof,
  preflightSyntheticTransactionWorkshopRead,
  type SubjectGraphRevisionReadResult,
  type SubjectGraphRevisionTransactionResult,
  type SyntheticTransactionWorkshopProof,
} from "./synthetic-transaction-workshop-proof.ts";
import {
  WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
  buildWorkshopViewModel,
  type WorkshopLensItemViewModel,
  type WorkshopViewModel,
} from "./view-model.ts";

export const SYNTHETIC_HUMAN_REVIEW_ASSURANCE =
  "verified-local-lab-bearer-only" as const;
export const SYNTHETIC_HUMAN_REVIEW_DECISION_KIND =
  "atliera_synthetic_human_review_decision" as const;
export const SYNTHETIC_HUMAN_REVIEW_DECISION_VERSION = 1 as const;
export const SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_KIND =
  "atliera-synthetic-human-review-disposable-sqlite-target" as const;
export const SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_VERSION = 1 as const;

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SAFE_SHA256 = /^[0-9a-f]{64}$/;
const MAX_ID_LENGTH = 200;
const MAX_REASON_LENGTH = 500;

const ARTIFACT_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_000,
  max_depth: 24,
  max_expanded_json_value_occurrences:
    CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES + 30_000,
  max_nodes: CANDIDATE_TRANSITION_MAX_JSON_NODES + 2_000,
  max_object_fields: 128,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes:
    CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES + 256 * 1024,
});

const ROOT_VERIFY_KEYS = [
  "request",
  "headers",
  "database",
  "envelope",
  "delta",
  "transition",
  "application_options",
  "intent",
] as const;
const ROOT_PENDING_KEYS = [
  "envelope",
  "delta",
  "transition",
  "application_options",
  "intent",
] as const;
const ROOT_EFFECT_KEYS = [
  "auth_context",
  "decision_artifact",
  "envelope",
  "delta",
  "transition",
  "application_options",
  "intent",
  "database",
] as const;
const REQUEST_KEYS = ["decision", "reason"] as const;
const VERIFIER_CONFIG_KEYS = [
  "actor_id",
  "assurance",
  "session_id",
  "issued_at",
  "expires_at",
  "bearer_auth",
  "clock",
] as const;
const DATABASE_REQUIRED_KEYS = [
  "database_path",
  "isolated_temporary_directory",
] as const;
const ARTIFACT_CORE_KEYS = [
  "kind",
  "version",
  "disposable",
  "graph_identity",
  "envelope_sha256",
  "delta_sha256",
  "delta",
  "transition_sha256",
  "transition",
  "pending_intent_sha256",
  "pending_review_handoff_sha256",
  "pending_intent",
  "intent_sha256",
  "review_handoff_sha256",
  "transaction_intent",
  "transaction_review_handoff",
  "candidate_sha256",
  "predecessor_basis",
  "base_snapshot_sha256",
  "quality_gate_policy",
  "quality_gate_report",
  "decision",
  "reason",
  "verified_actor",
  "assurance",
  "auth_context_id",
  "database_target_sha256",
  "session_id",
  "issued_at",
  "reviewed_at",
  "expires_at",
  "transaction_replay_key",
  "decision_replay_identity",
  "trust_label_on_accepted_durable_write",
  "effect_contract",
  "authority",
] as const;
const ARTIFACT_KEYS = [...ARTIFACT_CORE_KEYS, "decision_sha256"] as const;

declare const VERIFIER_BRAND: unique symbol;
declare const AUTH_CONTEXT_BRAND: unique symbol;

export interface SyntheticHumanReviewLabVerifier {
  readonly [VERIFIER_BRAND]: true;
}

export interface SyntheticHumanReviewAuthContext {
  readonly [AUTH_CONTEXT_BRAND]: true;
}

export interface SyntheticHumanReviewLabVerifierConfig {
  readonly actor_id: string;
  readonly assurance: typeof SYNTHETIC_HUMAN_REVIEW_ASSURANCE;
  readonly session_id: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly bearer_auth: LocalBearerAuthConfig;
  readonly clock: () => string;
}

export interface SyntheticHumanReviewDecisionRequest {
  readonly decision: Extract<
    WorkshopProposalHumanReviewDecisionKind,
    "accept_for_graph_candidate" | "reject"
  >;
  readonly reason: string;
}

interface PipelineInput {
  readonly envelope: unknown;
  readonly delta: unknown;
  readonly transition: unknown;
  readonly application_options: unknown;
  readonly intent: unknown;
}

interface SyntheticHumanReviewDatabaseOptions {
  readonly database_path: string;
  readonly isolated_temporary_directory: string;
}

interface HydratedPipeline {
  readonly envelope: ProposalEnvelope;
  readonly delta: CandidateDelta;
  readonly transition: CandidateTransition;
  readonly intent: SubjectGraphRevisionIntent;
  readonly application_options: unknown;
}

interface AuthContextState {
  readonly actor_id: string;
  readonly assurance: typeof SYNTHETIC_HUMAN_REVIEW_ASSURANCE;
  readonly session_id: string;
  readonly issued_at: string;
  readonly reviewed_at: string;
  readonly expires_at: string;
  readonly auth_context_id: string;
  readonly database_target_sha256: string;
  readonly request: SyntheticHumanReviewDecisionRequest;
  readonly clock: () => string;
}

export interface SyntheticHumanReviewDecisionArtifactCore {
  readonly kind: typeof SYNTHETIC_HUMAN_REVIEW_DECISION_KIND;
  readonly version: typeof SYNTHETIC_HUMAN_REVIEW_DECISION_VERSION;
  readonly disposable: true;
  readonly graph_identity: SubjectGraphRevisionIntent["graph_identity"];
  readonly envelope_sha256: string;
  readonly delta_sha256: string;
  readonly delta: CandidateDelta;
  readonly transition_sha256: string;
  readonly transition: CandidateTransition;
  /** Caller-supplied, validated proposal/prewrite intent. Never consumed here. */
  readonly pending_intent_sha256: string;
  readonly pending_review_handoff_sha256: string;
  readonly pending_intent: SubjectGraphRevisionIntent;
  /** Decision-bound transaction identity. Null for a rejection. */
  readonly intent_sha256: string | null;
  readonly review_handoff_sha256: string | null;
  readonly transaction_intent: SubjectGraphRevisionIntent | null;
  readonly transaction_review_handoff: SubjectGraphRevisionReviewHandoff | null;
  readonly candidate_sha256: string;
  readonly predecessor_basis: SubjectGraphRevisionIntent["predecessor_basis"];
  readonly base_snapshot_sha256: string;
  readonly quality_gate_policy: CandidateQualityGatePolicyIdentity;
  readonly quality_gate_report: QualityGateReport;
  readonly decision: SyntheticHumanReviewDecisionRequest["decision"];
  readonly reason: string;
  readonly verified_actor: string;
  readonly assurance: typeof SYNTHETIC_HUMAN_REVIEW_ASSURANCE;
  readonly auth_context_id: string;
  /** Digest-only binding to the exact disposable SQLite target; no raw path is exposed. */
  readonly database_target_sha256: string;
  readonly session_id: string;
  readonly issued_at: string;
  readonly reviewed_at: string;
  readonly expires_at: string;
  readonly transaction_replay_key: string;
  /** Audit identity only. The SQLite transaction replay key remains the sole durable namespace. */
  readonly decision_replay_identity: string;
  readonly trust_label_on_accepted_durable_write: typeof PINNED_DURABLE_WRITE_TRUST_LABEL;
  readonly effect_contract: {
    readonly lifecycle_state: typeof ARMED_LIFECYCLE_STATE | "rejected";
    readonly current_effective_authorization:
      | "single-armed-durable-write-attempt"
      | "none";
    readonly maximum_attempts: 1;
    readonly retry_budget: 0;
    readonly retry_requires_new_decision: true;
    readonly accepted_scope: "exact-synthetic-proposal-disposable-sqlite-only";
  };
  readonly authority: {
    readonly decision_integrity_digest_is_authority: false;
    readonly verified_local_lab_bearer_only: true;
    readonly production_identity_verified: false;
    readonly production_approval: false;
    readonly factual_verification: false;
    readonly source_verification: false;
    readonly quality_gate_pass: false;
    readonly intent_authenticated_human_approval_remains_false: true;
    readonly disposable_permit_ratification_remains_false: true;
  };
}

export interface SyntheticHumanReviewDecisionArtifact
  extends SyntheticHumanReviewDecisionArtifactCore {
  readonly decision_sha256: string;
}

export type SyntheticHumanReviewVerificationFailure =
  | "missing_bearer"
  | "invalid_bearer"
  | "disabled_local_dev"
  | "not_yet_valid"
  | "expired_at_verification"
  | "invalid_request_or_binding";

export type SyntheticHumanReviewVerificationResult =
  | {
      readonly outcome: "verified";
      readonly verified: true;
      readonly decision_artifact: SyntheticHumanReviewDecisionArtifact;
      readonly auth_context: SyntheticHumanReviewAuthContext;
      readonly html: string;
      readonly counters: SyntheticHumanReviewZeroEffectCounters;
    }
  | {
      readonly outcome: "refused";
      readonly verified: false;
      readonly reason: SyntheticHumanReviewVerificationFailure;
      readonly decision_artifact: null;
      readonly auth_context: null;
      readonly html: string;
      readonly counters: SyntheticHumanReviewZeroEffectCounters;
    };

export interface SyntheticHumanReviewZeroEffectCounters {
  readonly provider_calls: 0;
  readonly mcp_invocations: 0;
  readonly product_network_operations: 0;
  readonly production_effects: 0;
}

export interface SyntheticHumanReviewPendingProposalProjection {
  readonly surface: "Workshop";
  readonly state: "pending_human_review";
  readonly view_model: WorkshopViewModel;
  readonly html: string;
}

export interface SyntheticHumanReviewPendingProposalResult {
  readonly kind: "synthetic-human-review-pending-proposal";
  readonly state: "pending_human_review";
  readonly envelope_sha256: string;
  readonly delta_sha256: string;
  readonly transition_sha256: string;
  readonly pending_intent_sha256: string;
  readonly pending_review_handoff_sha256: string;
  readonly candidate_sha256: string;
  readonly quality_gate_report: QualityGateReport;
  readonly workshop: SyntheticHumanReviewPendingProposalProjection;
  readonly counters: SyntheticHumanReviewZeroEffectCounters;
}

export type SyntheticHumanReviewLoopOutcome =
  | "committed"
  | "already_committed"
  | "rejected"
  | "conflicted"
  | "refused"
  | "dependency_failed"
  | "committed_readback_failed"
  | "indeterminate";

export interface SyntheticHumanReviewWorkshopProjection {
  readonly surface: "Workshop";
  readonly outcome: SyntheticHumanReviewLoopOutcome;
  readonly storage_currentness:
    | "exact_decision_bound_current_commit"
    | "historical_or_overtaken"
    | "not_applicable"
    | "unavailable";
  readonly view_model: WorkshopViewModel | null;
  readonly html: string;
}

export interface SyntheticHumanReviewLoopResult {
  readonly kind: "synthetic-human-review-loop-result";
  readonly outcome: SyntheticHumanReviewLoopOutcome;
  readonly decision_artifact: SyntheticHumanReviewDecisionArtifact | null;
  readonly preflight: SubjectGraphRevisionReadResult | null;
  readonly transaction: SubjectGraphRevisionTransactionResult | null;
  readonly readback: SubjectGraphRevisionReadResult | null;
  readonly workshop: SyntheticHumanReviewWorkshopProjection;
  readonly counters: SyntheticHumanReviewZeroEffectCounters;
}

const verifierStates = new WeakMap<object, SyntheticHumanReviewLabVerifierConfig>();
const authContextStates = new WeakMap<object, AuthContextState>();

interface DurableTargetFileIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly birthtime_nanoseconds: bigint;
}

type AuthContextAttemptState =
  | { readonly status: "ready" }
  | { readonly status: "spent" }
  | {
      readonly status: "successful";
      readonly target_file_identity: DurableTargetFileIdentity;
    };

const READY_ATTEMPT: AuthContextAttemptState = Object.freeze({ status: "ready" });
const SPENT_ATTEMPT: AuthContextAttemptState = Object.freeze({ status: "spent" });
const authContextAttemptStates = new WeakMap<object, AuthContextAttemptState>();

function zeroCounters(): SyntheticHumanReviewZeroEffectCounters {
  return Object.freeze({
    provider_calls: 0,
    mcp_invocations: 0,
    product_network_operations: 0,
    production_effects: 0,
  });
}

function invalidInput(): never {
  throw new TypeError("Invalid synthetic human-review loop input");
}

function exactOwnDataObject<K extends string>(
  raw: unknown,
  keys: readonly K[],
): Readonly<Record<K, unknown>> {
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    nodeUtilTypes.isProxy(raw)
  ) invalidInput();
  const prototype = Object.getPrototypeOf(raw);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) invalidInput();
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) invalidInput();
  const out = Object.create(null) as Record<K, unknown>;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) invalidInput();
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function canonicalTimestamp(raw: unknown): string {
  if (typeof raw !== "string" || !ISO_TIMESTAMP.test(raw)) invalidInput();
  const date = new Date(raw);
  const canonical = date.toISOString();
  if (
    Number.isNaN(date.getTime()) ||
    (canonical !== raw && canonical.replace(".000Z", "Z") !== raw)
  ) invalidInput();
  return raw;
}

function boundedText(raw: unknown, maximum: number, allowMarkup: boolean): string {
  if (
    typeof raw !== "string" ||
    raw.trim() === "" ||
    raw.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(raw) ||
    (!allowMarkup && !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/.test(raw))
  ) invalidInput();
  return raw;
}

function snapshotBearerConfig(raw: unknown): LocalBearerAuthConfig {
  if (typeof raw !== "object" || raw === null || nodeUtilTypes.isProxy(raw)) {
    return invalidInput();
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const mode = descriptors.mode;
  if (mode === undefined || !("value" in mode) || !mode.enumerable) invalidInput();
  if (mode.value === "disabled-local-dev") {
    exactOwnDataObject(raw, ["mode"]);
    return Object.freeze({ mode: "disabled-local-dev" });
  }
  const record = exactOwnDataObject(raw, ["mode", "token"]);
  if (
    record.mode !== "required" ||
    typeof record.token !== "string" ||
    record.token.trim() === ""
  ) invalidInput();
  return Object.freeze({ mode: "required", token: record.token });
}

function snapshotHeaders(raw: unknown): HttpHeadersLike {
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    nodeUtilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) invalidInput();
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Object.keys(descriptors).length > 64) invalidInput();
  const out: Record<string, string | readonly string[] | undefined> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor) || !descriptor.enumerable) invalidInput();
    const value = descriptor.value as unknown;
    if (value === undefined || typeof value === "string") {
      out[key] = value;
      continue;
    }
    if (
      !Array.isArray(value) ||
      nodeUtilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length !== 1
    ) invalidInput();
    const item = Object.getOwnPropertyDescriptor(value, "0");
    if (item === undefined || !("value" in item) || typeof item.value !== "string") {
      invalidInput();
    }
    out[key] = Object.freeze([item.value]);
  }
  return Object.freeze(out);
}

function snapshotRequest(raw: unknown): SyntheticHumanReviewDecisionRequest {
  const request = exactOwnDataObject(raw, REQUEST_KEYS);
  if (
    request.decision !== "accept_for_graph_candidate" &&
    request.decision !== "reject"
  ) invalidInput();
  return Object.freeze({
    decision: request.decision,
    reason: boundedText(request.reason, MAX_REASON_LENGTH, true),
  });
}

function snapshotDatabase(
  raw: unknown,
): SyntheticHumanReviewDatabaseOptions {
  if (typeof raw !== "object" || raw === null || nodeUtilTypes.isProxy(raw)) {
    return invalidInput();
  }
  const record = exactOwnDataObject(raw, DATABASE_REQUIRED_KEYS);
  if (
    typeof record.database_path !== "string" ||
    record.database_path === "" ||
    record.database_path.includes("\u0000") ||
    typeof record.isolated_temporary_directory !== "string" ||
    record.isolated_temporary_directory === "" ||
    record.isolated_temporary_directory.includes("\u0000")
  ) invalidInput();
  const databasePath = resolve(record.database_path);
  const isolatedTemporaryDirectory = resolve(
    record.isolated_temporary_directory,
  );
  if (
    databasePath !== record.database_path ||
    isolatedTemporaryDirectory !== record.isolated_temporary_directory
  ) invalidInput();
  return Object.freeze({
    database_path: databasePath,
    isolated_temporary_directory: isolatedTemporaryDirectory,
  });
}

function databaseTargetSha256(
  database: SyntheticHumanReviewDatabaseOptions,
): string {
  return sha256CanonicalJson({
    kind: SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_KIND,
    version: SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_VERSION,
    database_path: database.database_path,
    isolated_temporary_directory: database.isolated_temporary_directory,
  });
}

function hydratePipeline(input: PipelineInput): HydratedPipeline {
  const envelope = hydrateProposalEnvelope(input.envelope);
  if (envelope.producer.kind !== "fixture" || envelope.fixture_binding === null) {
    throw new Error("fixture binding required");
  }
  const delta = hydrateCandidateDelta(input.delta);
  const transition = hydrateCandidateTransition(
    envelope,
    input.transition,
    input.application_options,
  );
  if (
    delta.delta_sha256 !== transition.delta.delta_sha256 ||
    canonicalJson(delta as unknown as StrictJsonValue) !==
      canonicalJson(transition.delta as unknown as StrictJsonValue)
  ) throw new Error("delta binding mismatch");
  const intent = hydrateSubjectGraphRevisionIntent(
    envelope,
    transition,
    input.application_options,
    input.intent,
  );
  const quality = transition.quality_gate;
  if (
    quality.status !== "borderline" ||
    quality.ok !== false ||
    quality.metrics.accepted_excerpts !== 0 ||
    quality.metrics.accepted_excerpt_rate !== 0 ||
    quality.thresholds.min_accepted_excerpt_rate !== 0.5 ||
    quality.validation_report.ok !== true
  ) throw new Error("bounded Borderline fixture truth required");
  if (
    intent.authority.authenticated_human_approval !== false ||
    intent.authority.ratification !== false ||
    intent.review_handoff.authority.authenticated_human_approval !== false ||
    intent.review_handoff.authority.ratification !== false
  ) throw new Error("intent authority must remain non-authorizing");
  return Object.freeze({
    envelope,
    delta,
    transition,
    intent,
    application_options: input.application_options,
  });
}

function contextIdentityCore(config: {
  readonly actor_id: string;
  readonly assurance: string;
  readonly session_id: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly database_target_sha256: string;
}): StrictJsonValue {
  return {
    kind: "atliera_synthetic_human_review_auth_context",
    actor_id: config.actor_id,
    assurance: config.assurance,
    session_id: config.session_id,
    issued_at: config.issued_at,
    expires_at: config.expires_at,
    database_target_sha256: config.database_target_sha256,
  };
}

function nonAuthorizingReviewAuthority(): SubjectGraphRevisionReviewAuthority {
  return Object.freeze({
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
}

function deriveAcceptedTransactionIntent(
  pipeline: HydratedPipeline,
  context: AuthContextState,
): SubjectGraphRevisionIntent | null {
  if (context.request.decision !== "accept_for_graph_candidate") return null;
  const transition = pipeline.transition;
  const pendingIntent = pipeline.intent;
  const reviewHandoff: SubjectGraphRevisionReviewHandoff = {
    kind: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
    version: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION,
    disposition: SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
    graph_identity: { ...pendingIntent.graph_identity },
    predecessor_basis: { ...pendingIntent.predecessor_basis },
    envelope_sha256: pipeline.envelope.envelope_sha256,
    delta_sha256: pipeline.delta.delta_sha256,
    transition_sha256: transition.transition_sha256,
    base_snapshot_sha256: pendingIntent.base_snapshot_sha256,
    proposed_snapshot_sha256: transition.candidate_sha256,
    quality_gate_policy: { ...transition.delta.quality_gate_policy },
    quality_gate_report_sha256: transition.delta.quality_gate_report_sha256,
    replay_key_to_record: pendingIntent.replay_key_to_record,
    reviewer_ref: `lab-auth-context:${context.auth_context_id}`,
    reviewed_at: context.reviewed_at,
    rationale: context.request.reason,
    authority: nonAuthorizingReviewAuthority(),
  };
  return createSubjectGraphRevisionIntent(
    pipeline.envelope,
    transition,
    pipeline.application_options,
    pendingIntent.predecessor_basis,
    reviewHandoff,
  );
}

function decisionReplayIdentity(
  pipeline: HydratedPipeline,
  context: AuthContextState,
  transactionIntent: SubjectGraphRevisionIntent | null,
): string {
  return sha256CanonicalJson({
    kind: "atliera_synthetic_human_review_decision_replay_identity",
    graph_identity: pipeline.intent.graph_identity as unknown as StrictJsonValue,
    envelope_sha256: pipeline.envelope.envelope_sha256,
    delta_sha256: pipeline.delta.delta_sha256,
    transition_sha256: pipeline.transition.transition_sha256,
    pending_intent_sha256: pipeline.intent.intent_sha256,
    pending_review_handoff_sha256: pipeline.intent.review_handoff_sha256,
    intent_sha256: transactionIntent?.intent_sha256 ?? null,
    review_handoff_sha256: transactionIntent?.review_handoff_sha256 ?? null,
    candidate_sha256: pipeline.transition.candidate_sha256,
    predecessor_basis: pipeline.intent.predecessor_basis as unknown as StrictJsonValue,
    quality_gate_policy: pipeline.transition.delta.quality_gate_policy as unknown as StrictJsonValue,
    quality_gate_report: pipeline.transition.quality_gate as unknown as StrictJsonValue,
    decision: context.request.decision,
    reason: context.request.reason,
    verified_actor: context.actor_id,
    auth_context_id: context.auth_context_id,
    database_target_sha256: context.database_target_sha256,
    session_id: context.session_id,
    issued_at: context.issued_at,
    reviewed_at: context.reviewed_at,
    expires_at: context.expires_at,
    transaction_replay_key: pipeline.intent.replay_key_to_record,
  });
}

function buildDecisionArtifact(
  pipeline: HydratedPipeline,
  context: AuthContextState,
): SyntheticHumanReviewDecisionArtifact {
  const accepted = context.request.decision === "accept_for_graph_candidate";
  const transactionIntent = deriveAcceptedTransactionIntent(pipeline, context);
  const core: SyntheticHumanReviewDecisionArtifactCore = {
    kind: SYNTHETIC_HUMAN_REVIEW_DECISION_KIND,
    version: SYNTHETIC_HUMAN_REVIEW_DECISION_VERSION,
    disposable: true,
    graph_identity: { ...pipeline.intent.graph_identity },
    envelope_sha256: pipeline.envelope.envelope_sha256,
    delta_sha256: pipeline.delta.delta_sha256,
    delta: pipeline.delta,
    transition_sha256: pipeline.transition.transition_sha256,
    transition: pipeline.transition,
    pending_intent_sha256: pipeline.intent.intent_sha256,
    pending_review_handoff_sha256: pipeline.intent.review_handoff_sha256,
    pending_intent: pipeline.intent,
    intent_sha256: transactionIntent?.intent_sha256 ?? null,
    review_handoff_sha256: transactionIntent?.review_handoff_sha256 ?? null,
    transaction_intent: transactionIntent,
    transaction_review_handoff: transactionIntent?.review_handoff ?? null,
    candidate_sha256: pipeline.transition.candidate_sha256,
    predecessor_basis: { ...pipeline.intent.predecessor_basis },
    base_snapshot_sha256: pipeline.intent.base_snapshot_sha256,
    quality_gate_policy: { ...pipeline.transition.delta.quality_gate_policy },
    quality_gate_report: pipeline.transition.quality_gate,
    decision: context.request.decision,
    reason: context.request.reason,
    verified_actor: context.actor_id,
    assurance: context.assurance,
    auth_context_id: context.auth_context_id,
    database_target_sha256: context.database_target_sha256,
    session_id: context.session_id,
    issued_at: context.issued_at,
    reviewed_at: context.reviewed_at,
    expires_at: context.expires_at,
    transaction_replay_key: pipeline.intent.replay_key_to_record,
    decision_replay_identity: decisionReplayIdentity(
      pipeline,
      context,
      transactionIntent,
    ),
    trust_label_on_accepted_durable_write: PINNED_DURABLE_WRITE_TRUST_LABEL,
    effect_contract: {
      lifecycle_state: accepted ? ARMED_LIFECYCLE_STATE : "rejected",
      current_effective_authorization: accepted
        ? "single-armed-durable-write-attempt"
        : "none",
      maximum_attempts: 1,
      retry_budget: 0,
      retry_requires_new_decision: true,
      accepted_scope: "exact-synthetic-proposal-disposable-sqlite-only",
    },
    authority: {
      decision_integrity_digest_is_authority: false,
      verified_local_lab_bearer_only: true,
      production_identity_verified: false,
      production_approval: false,
      factual_verification: false,
      source_verification: false,
      quality_gate_pass: false,
      intent_authenticated_human_approval_remains_false: true,
      disposable_permit_ratification_remains_false: true,
    },
  };
  const artifact = {
    ...core,
    decision_sha256: sha256CanonicalJson(core as unknown as StrictJsonValue),
  };
  return deepFreezeOwnData(artifact);
}

function hydrateDecisionArtifact(raw: unknown): StrictJsonValue {
  const snapshot = snapshotStrictJson(
    raw,
    "synthetic_human_review_decision",
    ARTIFACT_LIMITS,
  );
  const object = strictJsonObject(snapshot, "synthetic_human_review_decision");
  assertExactKeys(object, ARTIFACT_KEYS, "synthetic_human_review_decision");
  if (typeof object.decision_sha256 !== "string" || !SAFE_SHA256.test(object.decision_sha256)) {
    invalidInput();
  }
  const core: Record<string, StrictJsonValue> = {};
  for (const key of ARTIFACT_CORE_KEYS) core[key] = object[key]!;
  if (sha256CanonicalJson(core) !== object.decision_sha256) invalidInput();
  return snapshot;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function verificationPage(
  title: string,
  detail: string,
  nextAction: string,
): string {
  return basePage(title, `<p>${escapeHtml(detail)}</p>`, nextAction);
}

function basePage(title: string, body: string, nextAction: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Atliera Workshop — ${escapeHtml(title)}</title><style>:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:dark;background:#090b12;color:#edf2ff}html,body{max-width:100%;overflow-x:hidden}body{margin:0}main{box-sizing:border-box;max-width:960px;margin:auto;padding:24px 16px;overflow-wrap:anywhere}.boundary,section{box-sizing:border-box;min-width:0;max-width:100%;border:1px solid #34415e;border-radius:14px;background:#101728;padding:16px;margin:12px 0}.boundary{border-color:#a16207;background:#2b1d08}.next{border-color:#15803d}.lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.lanes section{margin:0}ul{padding-left:20px}small{color:#b8c3dc}@media(max-width:720px){.lanes{grid-template-columns:1fr}}@media(max-width:560px){main{padding:14px 10px}}</style></head><body><main><div class="boundary">Synthetic fixture · disposable lab SQLite · non-production<br />Verified local lab bearer only; no production identity or authentication claim.</div><h1>Atliera Workshop</h1><h2>${escapeHtml(title)}</h2><section class="next"><h2>One safe next action</h2><p>${escapeHtml(nextAction)}</p></section><section class="detail">${body}</section><small>Provider calls 0 · MCP 0 · product/network operations 0 · production effects 0</small></main></body></html>`;
}

function refusedVerification(
  reason: SyntheticHumanReviewVerificationFailure,
): SyntheticHumanReviewVerificationResult {
  const detail = reason === "disabled_local_dev"
    ? "Local authentication is disabled, so this lab decision is not authenticated and cannot authorize an effect."
    : reason === "expired_at_verification"
      ? "The verifier-pinned lab session expired before review; no human ratification or durable application occurred."
      : reason === "not_yet_valid"
        ? "The verifier-pinned lab session is not yet valid; no human ratification or durable application occurred."
        : "The lab decision was not authenticated; no human ratification or durable application occurred.";
  return deepFreezeOwnData({
    outcome: "refused" as const,
    verified: false as const,
    reason,
    decision_artifact: null,
    auth_context: null,
    html: verificationPage(
      "Decision refused",
      detail,
      "Supply a currently valid verifier-pinned local lab bearer session.",
    ),
    counters: zeroCounters(),
  });
}

export function createSyntheticHumanReviewLabVerifier(
  raw: SyntheticHumanReviewLabVerifierConfig,
): SyntheticHumanReviewLabVerifier {
  const config = exactOwnDataObject(raw, VERIFIER_CONFIG_KEYS);
  const actorId = boundedText(config.actor_id, MAX_ID_LENGTH, true);
  const sessionId = boundedText(config.session_id, MAX_ID_LENGTH, true);
  if (config.assurance !== SYNTHETIC_HUMAN_REVIEW_ASSURANCE) invalidInput();
  const issuedAt = canonicalTimestamp(config.issued_at);
  const expiresAt = canonicalTimestamp(config.expires_at);
  if (
    new Date(issuedAt).getTime() >= new Date(expiresAt).getTime() ||
    typeof config.clock !== "function"
  ) invalidInput();
  const bearerAuth = snapshotBearerConfig(config.bearer_auth);
  const verifier = Object.freeze(Object.create(null)) as SyntheticHumanReviewLabVerifier;
  verifierStates.set(verifier, Object.freeze({
    actor_id: actorId,
    assurance: SYNTHETIC_HUMAN_REVIEW_ASSURANCE,
    session_id: sessionId,
    issued_at: issuedAt,
    expires_at: expiresAt,
    bearer_auth: bearerAuth,
    clock: config.clock as () => string,
  }));
  return verifier;
}

export function verifySyntheticHumanReviewDecision(
  raw: {
    readonly request: unknown;
    readonly headers: unknown;
    readonly database: unknown;
    readonly envelope: unknown;
    readonly delta: unknown;
    readonly transition: unknown;
    readonly application_options: unknown;
    readonly intent: unknown;
  },
  verifier: SyntheticHumanReviewLabVerifier,
): SyntheticHumanReviewVerificationResult {
  const verifierState =
    typeof verifier === "object" && verifier !== null
      ? verifierStates.get(verifier)
      : undefined;
  if (verifierState === undefined) return refusedVerification("invalid_request_or_binding");
  let root: Readonly<Record<(typeof ROOT_VERIFY_KEYS)[number], unknown>>;
  let request: SyntheticHumanReviewDecisionRequest;
  let headers: HttpHeadersLike;
  let database: SyntheticHumanReviewDatabaseOptions;
  try {
    root = exactOwnDataObject(raw, ROOT_VERIFY_KEYS);
    request = snapshotRequest(root.request);
    headers = snapshotHeaders(root.headers);
    database = snapshotDatabase(root.database);
  } catch {
    return refusedVerification("invalid_request_or_binding");
  }
  const auth = authorizeBearerTokenRequest(headers, verifierState.bearer_auth);
  if (auth.status === "disabled-local-dev") return refusedVerification("disabled_local_dev");
  if (!auth.ok) {
    return refusedVerification(
      auth.status === "missing" ? "missing_bearer" : "invalid_bearer",
    );
  }
  let reviewedAt: string;
  try {
    reviewedAt = canonicalTimestamp(verifierState.clock());
  } catch {
    return refusedVerification("invalid_request_or_binding");
  }
  const reviewedAtMs = new Date(reviewedAt).getTime();
  if (reviewedAtMs < new Date(verifierState.issued_at).getTime()) {
    return refusedVerification("not_yet_valid");
  }
  if (reviewedAtMs >= new Date(verifierState.expires_at).getTime()) {
    return refusedVerification("expired_at_verification");
  }
  let pipeline: HydratedPipeline;
  try {
    pipeline = hydratePipeline({
      envelope: root.envelope,
      delta: root.delta,
      transition: root.transition,
      application_options: root.application_options,
      intent: root.intent,
    });
  } catch {
    return refusedVerification("invalid_request_or_binding");
  }
  const databaseTarget = databaseTargetSha256(database);
  const authContextId = sha256CanonicalJson(contextIdentityCore({
    ...verifierState,
    database_target_sha256: databaseTarget,
  }));
  const contextState: AuthContextState = Object.freeze({
    actor_id: verifierState.actor_id,
    assurance: verifierState.assurance,
    session_id: verifierState.session_id,
    issued_at: verifierState.issued_at,
    reviewed_at: reviewedAt,
    expires_at: verifierState.expires_at,
    auth_context_id: authContextId,
    database_target_sha256: databaseTarget,
    request,
    clock: verifierState.clock,
  });
  const context = Object.freeze(Object.create(null)) as SyntheticHumanReviewAuthContext;
  let artifact: SyntheticHumanReviewDecisionArtifact;
  try {
    artifact = buildDecisionArtifact(pipeline, contextState);
  } catch {
    return refusedVerification("invalid_request_or_binding");
  }
  authContextStates.set(context, contextState);
  authContextAttemptStates.set(context, READY_ATTEMPT);
  return deepFreezeOwnData({
    outcome: "verified" as const,
    verified: true as const,
    decision_artifact: artifact,
    auth_context: context,
    html: verificationPage(
      "Decision verified",
      `Actor ${contextState.actor_id} was verified with local lab bearer assurance. The decision artifact is integrity-bound but is not authoritative by itself.`,
      contextState.request.decision === "accept_for_graph_candidate"
        ? "Submit this opaque auth context and exact decision artifact to the disposable lab effect boundary before expiry."
        : "Retain the rejection as the terminal lab decision; do not open the graph transaction.",
    ),
    counters: zeroCounters(),
  });
}

type WorkshopContentState = "pending" | "ratified-current" | "storage-only";

function itemList(
  items: readonly WorkshopLensItemViewModel[],
  state: WorkshopContentState,
): string {
  if (items.length === 0) {
    return state === "pending"
      ? "<p>No proposed items in this lane.</p>"
      : "<p>No storage-current items.</p>";
  }
  const stateLabel = state === "pending"
    ? WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT
    : state === "ratified-current"
      ? "Model-proposed · human-ratified · evidence pending"
      : "Storage-current only · no decision attribution";
  return `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br />${escapeHtml(item.summary)}<br /><small>${escapeHtml(stateLabel)} · Trust: ${escapeHtml(item.trust.label)}</small></li>`).join("")}</ul>`;
}

function workshopLanes(
  viewModel: WorkshopViewModel,
  state: WorkshopContentState,
): string {
  return `<div class="lanes"><section><h3>Maps</h3>${itemList(viewModel.lenses.maps, state)}</section><section><h3>Signals</h3>${itemList(viewModel.lenses.signals, state)}</section><section><h3>Plays</h3>${itemList(viewModel.lenses.plays, state)}</section></div>`;
}

function workshopEvidence(
  viewModel: WorkshopViewModel,
  state: WorkshopContentState,
): string {
  const packets = [
    ...viewModel.lenses.maps,
    ...viewModel.lenses.signals,
    ...viewModel.lenses.plays,
  ].flatMap((item) => item.evidence_packets).slice(0, 6);
  if (packets.length === 0) {
    return "<section><h3>Evidence &amp; provenance</h3><p>No bounded proposed evidence packet is available.</p></section>";
  }
  const excerptLabel = state === "ratified-current"
    ? "Proposed excerpt · pending human review"
    : "Proposed excerpt (pending human review)";
  const truth = state === "storage-only"
    ? "<strong>Unverified proposed evidence.</strong> The later storage-current proposal has no decision attribution. Factual, source, and provenance verification remain pending; it is not fact/source or provenance verified."
    : "Proposed evidence remains pending human review and is not fact/source verified.";
  return `<section><h3>Evidence &amp; provenance</h3><p>${truth}</p><ul>${packets.map((packet) => `<li><strong>${escapeHtml(packet.claim.text)}</strong><br />${escapeHtml(packet.excerpt.text)}<br /><small>${escapeHtml(packet.source.title)} · ${escapeHtml(excerptLabel)} · provenance not verified</small></li>`).join("")}</ul></section>`;
}

/**
 * Pure pending-proposal surface. It performs no auth, database read, permit
 * creation, transaction, or other effect.
 */
export function renderSyntheticHumanReviewPendingProposal(
  raw: {
    readonly envelope: unknown;
    readonly delta: unknown;
    readonly transition: unknown;
    readonly application_options: unknown;
    readonly intent: unknown;
  },
): SyntheticHumanReviewPendingProposalResult {
  const input = exactOwnDataObject(raw, ROOT_PENDING_KEYS);
  const pipeline = hydratePipeline({
    envelope: input.envelope,
    delta: input.delta,
    transition: input.transition,
    application_options: input.application_options,
    intent: input.intent,
  });
  const viewModel = buildWorkshopViewModel(pipeline.transition.candidate);
  const items = [
    ...viewModel.lenses.maps,
    ...viewModel.lenses.signals,
    ...viewModel.lenses.plays,
  ];
  if (
    items.length === 0 ||
    items.some((item) =>
      item.trust.label !== "Unverified" ||
      item.review_state !== WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
    ) ||
    viewModel.totals.accepted_excerpts !== 0
  ) {
    throw new Error("pending synthetic proposal Workshop truth is invalid");
  }
  deepFreezeOwnData(viewModel);
  const quality = pipeline.transition.quality_gate;
  const html = basePage(
    "Pending synthetic proposal",
    `<p><strong>Unverified</strong></p><p><strong>${escapeHtml(WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT)}</strong></p><p>This exact synthetic fixture is awaiting a human decision. No human decision or ratification has occurred; no database effect has occurred; and this surface does not verify facts or sources or grant production approval.</p><dl><dt>Structural validation</dt><dd>Succeeded</dd><dt>Policy/candidate admission</dt><dd>Admitted because launch quality was non-failing; this is not a quality pass.</dd><dt>Launch quality</dt><dd>Borderline (ok=false)</dd><dt>Accepted excerpts</dt><dd>${quality.metrics.accepted_excerpts}</dd><dt>Accepted-excerpt rate</dt><dd>${quality.metrics.accepted_excerpt_rate}</dd><dt>Threshold</dt><dd>${quality.thresholds.min_accepted_excerpt_rate}</dd><dt>Source/provenance</dt><dd>Unverified proposed evidence; not fact/source verified</dd></dl>${workshopLanes(viewModel, "pending")}${workshopEvidence(viewModel, "pending")}`,
    "Use a verified local lab-auth session to accept or reject this exact proposal.",
  );
  return deepFreezeOwnData({
    kind: "synthetic-human-review-pending-proposal" as const,
    state: "pending_human_review" as const,
    envelope_sha256: pipeline.envelope.envelope_sha256,
    delta_sha256: pipeline.delta.delta_sha256,
    transition_sha256: pipeline.transition.transition_sha256,
    pending_intent_sha256: pipeline.intent.intent_sha256,
    pending_review_handoff_sha256: pipeline.intent.review_handoff_sha256,
    candidate_sha256: pipeline.transition.candidate_sha256,
    quality_gate_report: quality,
    workshop: {
      surface: "Workshop" as const,
      state: "pending_human_review" as const,
      view_model: viewModel,
      html,
    },
    counters: zeroCounters(),
  });
}

function exactDecisionBoundReadback(
  artifact: SyntheticHumanReviewDecisionArtifact,
  readback: SubjectGraphRevisionReadResult,
): boolean {
  return readback.outcome === "found" &&
    readback.state.intent_sha256 === artifact.intent_sha256 &&
    readback.state.snapshot_sha256 === artifact.candidate_sha256 &&
    readback.receipt.replay_key === artifact.transaction_replay_key &&
    readback.receipt.review_handoff_sha256 === artifact.review_handoff_sha256;
}

function exactDecisionBoundSuccessReceipt(
  artifact: SyntheticHumanReviewDecisionArtifact,
  transaction: SubjectGraphRevisionTransactionResult,
): boolean {
  if (
    transaction.outcome !== "committed" &&
    transaction.outcome !== "already_committed"
  ) return false;
  if (
    artifact.intent_sha256 === null ||
    artifact.review_handoff_sha256 === null ||
    artifact.transaction_intent === null
  ) return false;
  const receipt = transaction.receipt;
  const { receipt_sha256: receiptSha256, ...receiptCore } = receipt;
  return receipt.kind === "atliera_subject_graph_revision_success_receipt" &&
    receipt.version === 1 &&
    receipt.outcome === "committed" &&
    receipt.intent_sha256 === artifact.intent_sha256 &&
    receipt.intent_sha256 === artifact.transaction_intent.intent_sha256 &&
    receipt.proposed_snapshot_sha256 === artifact.candidate_sha256 &&
    receipt.proposed_snapshot_sha256 ===
      artifact.transaction_intent.proposed_snapshot_sha256 &&
    receipt.replay_key === artifact.transaction_replay_key &&
    receipt.replay_key === artifact.transaction_intent.replay_key_to_record &&
    receipt.review_handoff_sha256 === artifact.review_handoff_sha256 &&
    receipt.review_handoff_sha256 ===
      artifact.transaction_intent.review_handoff_sha256 &&
    canonicalJson(receipt.graph_identity as unknown as StrictJsonValue) ===
      canonicalJson(artifact.graph_identity as unknown as StrictJsonValue) &&
    canonicalJson(receipt.predecessor_basis as unknown as StrictJsonValue) ===
      canonicalJson(artifact.predecessor_basis as unknown as StrictJsonValue) &&
    sha256CanonicalJson(receiptCore as unknown as StrictJsonValue) ===
      receiptSha256;
}

function durableTargetFileIdentity(
  database: SyntheticHumanReviewDatabaseOptions,
): DurableTargetFileIdentity | null {
  try {
    const stats = lstatSync(database.database_path, { bigint: true });
    if (!stats.isFile()) return null;
    return Object.freeze({
      device: stats.dev,
      inode: stats.ino,
      birthtime_nanoseconds: stats.birthtimeNs,
    });
  } catch {
    return null;
  }
}

function sameDurableTargetFile(
  left: DurableTargetFileIdentity,
  right: DurableTargetFileIdentity,
): boolean {
  return left.device === right.device &&
    left.inode === right.inode &&
    left.birthtime_nanoseconds === right.birthtime_nanoseconds;
}

function acceptedWorkshop(
  artifact: SyntheticHumanReviewDecisionArtifact,
  proof: SyntheticTransactionWorkshopProof,
  outcome: SyntheticHumanReviewLoopOutcome,
): SyntheticHumanReviewWorkshopProjection {
  if (outcome === "refused" || outcome === "dependency_failed") {
    return terminalWorkshop(
      outcome,
      outcome === "refused"
        ? "The decision-bound disposable SQLite transaction was refused. Existing storage, if any, receives no ratification, actor, reason, currentness, or quality attribution from this attempt."
        : "The decision-bound disposable SQLite transaction dependency failed. No safe decision-bound current view is available.",
      "Inspect the fixed transaction result and durable state before verifying any new decision.",
    );
  }
  const viewModel = proof.workshop?.view_model ?? null;
  const successful =
    proof.transaction.outcome === "committed" ||
    proof.transaction.outcome === "already_committed";
  const readFound = proof.readback.outcome === "found";
  const exactCurrent = successful &&
    exactDecisionBoundReadback(artifact, proof.readback);
  const historical = successful && readFound && !exactCurrent;
  if (viewModel === null || (!exactCurrent && !historical && outcome !== "conflicted")) {
    const committedUncertain =
      outcome === "committed_readback_failed" || outcome === "indeterminate";
    return deepFreezeOwnData({
      surface: "Workshop" as const,
      outcome,
      storage_currentness: "unavailable" as const,
      view_model: null,
      html: basePage(
        committedUncertain ? "Committed state cannot be rendered safely" : "Accepted effect unavailable",
        committedUncertain
          ? "The transaction reports a commit or unresolved commit boundary, but restart read-back could not establish an exactly bound current view. This is not reported as no commit, and no human-ratified/current content is rendered."
          : "The accepted lab effect could not establish a safe, exactly bound Workshop view.",
        "Inspect the durable recovery identity and repair read-back integrity before rendering any current approval claim.",
      ),
    });
  }
  if (historical) {
    return deepFreezeOwnData({
      surface: "Workshop" as const,
      outcome,
      storage_currentness: "historical_or_overtaken" as const,
      view_model: viewModel,
      html: basePage(
        "Historical accepted decision",
        `<p>This earlier synthetic decision is not the storage-current revision. No human ratification, currentness, or quality result from it is attributed to the later state.</p>${workshopLanes(viewModel, "storage-only")}${workshopEvidence(viewModel, "storage-only")}`,
        "Review the later storage-current proposal on its own evidence and decision bindings.",
      ),
    });
  }
  if (!exactCurrent || viewModel === null) {
    return deepFreezeOwnData({
      surface: "Workshop" as const,
      outcome,
      storage_currentness: "not_applicable" as const,
      view_model: viewModel,
      html: basePage(
        outcome === "conflicted" ? "Accepted decision conflicted" : "Accepted decision not applied",
        outcome === "conflicted"
          ? "The predecessor revision or base snapshot digest was stale. No new revision was created, and the storage-current state receives no ratification or quality result from this decision."
          : "No exactly decision-bound durable application is shown.",
        "Reload storage-current state and create a new proposal and decision; do not retry this zero-retry authorization.",
      ),
    });
  }
  const quality = artifact.quality_gate_report;
  const replay = outcome === "already_committed";
  return deepFreezeOwnData({
    surface: "Workshop" as const,
    outcome,
    storage_currentness: "exact_decision_bound_current_commit" as const,
    view_model: viewModel,
    html: basePage(
      replay ? "Accepted decision already committed" : "Accepted decision committed",
      `<p><strong>Model-proposed · human-ratified · evidence pending</strong></p><p>Human acceptance by ${escapeHtml(artifact.verified_actor)} ratifies this exact synthetic proposal for durable storage only. It does not pass quality, verify facts or sources, grant production approval, or authorize any other effect.</p><p><strong>Bound reason:</strong> ${escapeHtml(artifact.reason)}</p><p>${replay ? "Durable replay matched the original transaction. No second write or graph revision occurred." : "A fresh adapter and read-only connection verified the exact decision-bound commit after restart."}</p><dl><dt>Structural validation</dt><dd>Succeeded</dd><dt>Policy/candidate admission</dt><dd>Admitted because launch quality was non-failing; this is not a quality pass.</dd><dt>Launch quality</dt><dd>Borderline (ok=false)</dd><dt>Accepted excerpts</dt><dd>${quality.metrics.accepted_excerpts}</dd><dt>Accepted-excerpt rate</dt><dd>${quality.metrics.accepted_excerpt_rate}</dd><dt>Threshold</dt><dd>${quality.thresholds.min_accepted_excerpt_rate}</dd><dt>Source/provenance</dt><dd>Proposed evidence; not fact/source verified</dd><dt>Decision SHA-256</dt><dd>${escapeHtml(artifact.decision_sha256)}</dd><dt>Decision replay identity</dt><dd>${escapeHtml(artifact.decision_replay_identity)}</dd></dl>${workshopLanes(viewModel, "ratified-current")}${workshopEvidence(viewModel, "ratified-current")}`,
      "Review and independently verify the proposed source evidence before any later production decision.",
    ),
  });
}

function terminalWorkshop(
  outcome: "rejected" | "refused" | "dependency_failed",
  detail: string,
  nextAction: string,
): SyntheticHumanReviewWorkshopProjection {
  return deepFreezeOwnData({
    surface: "Workshop" as const,
    outcome,
    storage_currentness: outcome === "rejected" ? "not_applicable" as const : "unavailable" as const,
    view_model: null,
    html: basePage(
      outcome === "rejected" ? "Proposal rejected" : "Effect refused",
      `<p>${escapeHtml(detail)}</p><p>No human ratification or durable application is claimed.</p>`,
      nextAction,
    ),
  });
}

function loopResult(
  input: Omit<SyntheticHumanReviewLoopResult, "kind" | "counters">,
): SyntheticHumanReviewLoopResult {
  return deepFreezeOwnData({
    kind: "synthetic-human-review-loop-result" as const,
    ...input,
    counters: zeroCounters(),
  });
}

export function executeSyntheticHumanReviewLoop(
  raw: {
    readonly auth_context: unknown;
    readonly decision_artifact: unknown;
    readonly envelope: unknown;
    readonly delta: unknown;
    readonly transition: unknown;
    readonly application_options: unknown;
    readonly intent: unknown;
    readonly database: unknown;
  },
): SyntheticHumanReviewLoopResult {
  let root: Readonly<Record<(typeof ROOT_EFFECT_KEYS)[number], unknown>>;
  try {
    root = exactOwnDataObject(raw, ROOT_EFFECT_KEYS);
  } catch {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The effect input was malformed.",
        "Rebuild the exact lab request from trusted own-data inputs.",
      ),
    });
  }
  const contextState =
    typeof root.auth_context === "object" && root.auth_context !== null
      ? authContextStates.get(root.auth_context)
      : undefined;
  if (contextState === undefined) {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The lab auth context was forged or was not verifier-issued.",
        "Verify a new decision through the host-injected local lab verifier.",
      ),
    });
  }
  let effectTime: string;
  try {
    effectTime = canonicalTimestamp(contextState.clock());
  } catch {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop("refused", "The trusted lab clock was invalid.", "Verify a new bounded lab session."),
    });
  }
  const effectTimeMs = new Date(effectTime).getTime();
  if (
    effectTimeMs < new Date(contextState.issued_at).getTime() ||
    effectTimeMs < new Date(contextState.reviewed_at).getTime() ||
    effectTimeMs >= new Date(contextState.expires_at).getTime()
  ) {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The verifier-issued lab auth context expired or was not valid at effect time, including when the trusted clock regressed before the verified review time.",
        "Verify a new decision in a currently valid lab session.",
      ),
    });
  }
  let database: SyntheticHumanReviewDatabaseOptions;
  try {
    database = snapshotDatabase(root.database);
    if (
      databaseTargetSha256(database) !==
      contextState.database_target_sha256
    ) invalidInput();
  } catch {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The disposable SQLite target did not match the verifier-issued exact-target binding.",
        "Verify a new decision for this exact disposable SQLite target.",
      ),
    });
  }
  let pipeline: HydratedPipeline;
  let artifactSnapshot: StrictJsonValue;
  let expectedArtifact: SyntheticHumanReviewDecisionArtifact;
  try {
    pipeline = hydratePipeline({
      envelope: root.envelope,
      delta: root.delta,
      transition: root.transition,
      application_options: root.application_options,
      intent: root.intent,
    });
    artifactSnapshot = hydrateDecisionArtifact(root.decision_artifact);
    expectedArtifact = buildDecisionArtifact(pipeline, contextState);
    if (
      canonicalJson(artifactSnapshot) !==
      canonicalJson(expectedArtifact as unknown as StrictJsonValue)
    ) invalidInput();
  } catch {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The decision or one of its exact proposal, quality, identity, predecessor, timestamp, target, or replay bindings did not match.",
        "Rehydrate the fixture chain and verify a new exact decision.",
      ),
    });
  }
  if (expectedArtifact.decision === "reject") {
    return loopResult({
      outcome: "rejected",
      decision_artifact: expectedArtifact,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "rejected",
        `The verified local lab actor ${expectedArtifact.verified_actor} rejected this exact synthetic proposal. The graph transaction was not opened and no revision was created.`,
        "Revise the synthetic proposal and submit it for a new bounded human review.",
      ),
    });
  }

  const transactionIntent = expectedArtifact.transaction_intent;
  if (transactionIntent === null) {
    return loopResult({
      outcome: "refused",
      decision_artifact: null,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "The accepted decision did not produce an exact decision-bound transaction intent.",
        "Verify a new exact accepted decision.",
      ),
    });
  }

  const context = root.auth_context as object;
  const attemptState = authContextAttemptStates.get(context);
  if (attemptState === undefined || attemptState.status === "spent") {
    return loopResult({
      outcome: "refused",
      decision_artifact: expectedArtifact,
      preflight: null,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        "refused",
        "This accepted local-lab auth context has already reached a terminal zero-retry outcome and cannot open another preflight or transaction attempt.",
        "Verify a new exact accepted decision before any repaired disposable-database attempt.",
      ),
    });
  }
  const priorSuccessfulTarget = attemptState.status === "successful"
    ? attemptState.target_file_identity
    : null;
  // Atomically spend the process-local authorization before the first
  // potentially terminal read. Only a proven commit or exact durable replay
  // transitions it back to the successful replayable state.
  authContextAttemptStates.set(context, SPENT_ATTEMPT);

  const preflightProof = preflightSyntheticTransactionWorkshopRead({
    graph_identity: transactionIntent.graph_identity,
    database,
  });
  const preflight = preflightProof.readback;
  // A brand-new safe disposable path has no database to read yet. PR #303's
  // read-only adapter truthfully reports that open failure; bootstrap may
  // proceed only when the path still does not exist. Any existing unreadable,
  // malformed, busy, or corrupt database fails closed before consume().
  const absentBootstrap = preflightProof.absent_disposable_database;
  if (priorSuccessfulTarget !== null) {
    const currentTarget = preflight.outcome === "found"
      ? durableTargetFileIdentity(database)
      : null;
    if (
      currentTarget === null ||
      !sameDurableTargetFile(priorSuccessfulTarget, currentTarget)
    ) {
      return loopResult({
        outcome: "refused",
        decision_artifact: expectedArtifact,
        preflight,
        transaction: null,
        readback: null,
        workshop: terminalWorkshop(
          "refused",
          "The successful decision can replay only against its same still-existing disposable SQLite file; an absent, recreated, or unreadable target cannot bootstrap another commit.",
          "Verify a new exact accepted decision for the repaired disposable target.",
        ),
      });
    }
  }
  if (
    preflight.outcome === "refused" ||
    (preflight.outcome === "dependency_failed" && !absentBootstrap)
  ) {
    return loopResult({
      outcome: preflight.outcome === "dependency_failed" ? "dependency_failed" : "refused",
      decision_artifact: expectedArtifact,
      preflight,
      transaction: null,
      readback: null,
      workshop: terminalWorkshop(
        preflight.outcome === "dependency_failed" ? "dependency_failed" : "refused",
        "Fresh preflight read-back could not establish safe durable state, so the accepted transaction was not attempted.",
        "Repair or replace the disposable lab database before verifying a new accepted decision.",
      ),
    });
  }

  const proof = executeSyntheticTransactionWorkshopProof({
    envelope: pipeline.envelope,
    delta: pipeline.delta,
    transition: pipeline.transition,
    application_options: pipeline.application_options,
    intent: transactionIntent,
    database,
  });
  const outcome: SyntheticHumanReviewLoopOutcome = proof.transaction.outcome;
  if (exactDecisionBoundSuccessReceipt(expectedArtifact, proof.transaction)) {
    const targetFileIdentity = durableTargetFileIdentity(database);
    if (targetFileIdentity !== null) {
      authContextAttemptStates.set(context, Object.freeze({
        status: "successful" as const,
        target_file_identity: targetFileIdentity,
      }));
    }
  }
  return loopResult({
    outcome,
    decision_artifact: expectedArtifact,
    preflight,
    transaction: proof.transaction,
    readback: proof.readback,
    workshop: acceptedWorkshop(expectedArtifact, proof, outcome),
  });
}
