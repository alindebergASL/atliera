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
  CANDIDATE_TRANSITION_MAX_JSON_NODES,
  CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES,
  hydrateCandidateTransition,
  validatedCandidateSha256,
  type CandidateQualityGatePolicyIdentity,
  type CandidateTransition,
} from "./candidate-delta.ts";
import {
  hydrateValidatedCandidate,
  type ValidatedCandidate,
} from "./validated-candidate.ts";

export const SUBJECT_GRAPH_REVISION_INTENT_KIND =
  "atliera_subject_graph_revision_intent" as const;
export const SUBJECT_GRAPH_REVISION_INTENT_VERSION = 1 as const;
export const SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND =
  "atliera_subject_graph_revision_review_handoff" as const;
export const SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION = 1 as const;
export const SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION =
  "accept_transition_for_prewrite_revision_intent" as const;

// This pure contract intentionally mirrors the existing store seam's public
// revision spelling without importing an effect-capable store module. Runtime
// parsing below is stricter than the template-literal type.
export type SubjectGraphRevisionToken = `rev_${number}`;

export interface SubjectGraphIdentity {
  readonly team_id: string;
  readonly account_id: string;
  readonly subject_id: string;
  readonly purpose: CandidateTransition["scope"]["purpose"];
}

export interface SubjectGraphRevisionPredecessorBasis {
  readonly mode: "bootstrap" | "successor";
  readonly expected_prior_revision: SubjectGraphRevisionToken | null;
  readonly expected_base_snapshot_sha256: string;
}

export interface SubjectGraphRevisionReviewAuthority {
  readonly current_effective_authorization: "none";
  readonly review_handoff_only: true;
  readonly integrity_digest_is_approval: false;
  readonly authenticated_human_approval: false;
  readonly ratification: false;
  readonly ratification_performed: false;
  readonly durable_replay_consumed: false;
  readonly durable_replay_protection: false;
  readonly anti_rollback_protection: false;
  readonly origin_custody_proven: false;
  readonly transformation_custody_proven: false;
  readonly graph_ingestion_authorized: false;
  readonly graph_ingestion_performed: false;
  readonly durable_write_authorized: false;
  readonly durable_write_performed: false;
}

export interface SubjectGraphRevisionReviewHandoff {
  readonly kind: typeof SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND;
  readonly version: typeof SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION;
  readonly disposition: typeof SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION;
  readonly graph_identity: SubjectGraphIdentity;
  readonly predecessor_basis: SubjectGraphRevisionPredecessorBasis;
  readonly envelope_sha256: string;
  readonly delta_sha256: string;
  readonly transition_sha256: string;
  readonly base_snapshot_sha256: string;
  readonly proposed_snapshot_sha256: string;
  readonly quality_gate_policy: CandidateQualityGatePolicyIdentity;
  readonly quality_gate_report_sha256: string;
  readonly replay_key_to_record: string;
  readonly reviewer_ref: string;
  readonly reviewed_at: string;
  readonly rationale: string;
  readonly authority: SubjectGraphRevisionReviewAuthority;
}

export interface SubjectGraphRevisionIntentAuthority {
  readonly current_effective_authorization: "none";
  readonly intent_contract_only: true;
  readonly integrity_digest_is_authority: false;
  readonly authenticated_human_approval: false;
  readonly ratification: false;
  readonly ratification_performed: false;
  readonly durable_replay_consumed: false;
  readonly durable_replay_protection: false;
  readonly anti_rollback_protection: false;
  readonly durable_current_state_checked: false;
  readonly future_transaction_must_atomically_compare_revision_and_snapshot: true;
  readonly origin_custody_proven: false;
  readonly transformation_custody_proven: false;
  readonly graph_ingestion_authorized: false;
  readonly graph_ingestion_performed: false;
  readonly durable_write_authorized: false;
  readonly durable_write_performed: false;
  readonly provider_calls_performed: 0;
  readonly mcp_invocations_performed: 0;
  readonly network_operations_performed: 0;
  readonly deployment_operations_performed: 0;
  readonly production_effects_performed: 0;
}

export interface SubjectGraphRevisionIntentCore {
  readonly kind: typeof SUBJECT_GRAPH_REVISION_INTENT_KIND;
  readonly version: typeof SUBJECT_GRAPH_REVISION_INTENT_VERSION;
  readonly graph_identity: SubjectGraphIdentity;
  readonly predecessor_basis: SubjectGraphRevisionPredecessorBasis;
  readonly envelope_sha256: string;
  readonly delta_sha256: string;
  readonly transition_sha256: string;
  readonly base_snapshot_sha256: string;
  readonly proposed_snapshot_sha256: string;
  readonly quality_gate_policy: CandidateQualityGatePolicyIdentity;
  readonly quality_gate_report_sha256: string;
  readonly proposed_snapshot: ValidatedCandidate;
  readonly review_handoff: SubjectGraphRevisionReviewHandoff;
  readonly review_handoff_sha256: string;
  readonly replay_key_to_record: string;
  readonly authority: SubjectGraphRevisionIntentAuthority;
}

export interface SubjectGraphRevisionIntent
  extends SubjectGraphRevisionIntentCore {
  readonly intent_sha256: string;
}

export class SubjectGraphRevisionIntentBoundaryError extends Error {
  constructor(detail: string) {
    super(`Subject-graph revision intent refused: ${detail}`);
    this.name = "SubjectGraphRevisionIntentBoundaryError";
  }
}

// The intent contains one candidate snapshot, not the transition's embedded
// delta/base/candidate triplication. These bounds retain the transition's
// existing limits and add only a small, fixed allowance for the review and
// intent records. They do not relax transition hydration itself.
const INTENT_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_000,
  max_depth: 18,
  max_nodes: CANDIDATE_TRANSITION_MAX_JSON_NODES + 256,
  max_object_fields: 128,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes:
    CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES + 64 * 1024,
});

const REVIEW_LIMITS: StrictJsonLimits = Object.freeze({
  // Legacy preview-review and ratification-plan artifacts are deliberately
  // allowed through this small hostile-input snapshot budget so they reach
  // the root exact-key check and are refused as the wrong contract.
  max_array_length: 100,
  max_depth: 8,
  max_nodes: 1_000,
  max_object_fields: 64,
  max_string_utf8_bytes: 16 * 1024,
  max_total_string_utf8_bytes: 64 * 1024,
});

const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_REVISION = /^rev_([1-9][0-9]{0,15})$/;
const SAFE_REVIEWER_REF = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const CANONICAL_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_RATIONALE_UTF8_BYTES = 8 * 1024;

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

const EMPTY_GRAPH_BUNDLE: StrictJsonValue = {
  sources: [],
  excerpts: [],
  claims: [],
  claim_evidence: [],
  account_objects: [],
  account_object_claims: [],
  research_runs: [],
  run_artifacts: [],
  audit_events: [],
};
const CANONICAL_EMPTY_GRAPH_BUNDLE = canonicalJson(EMPTY_GRAPH_BUNDLE);

function refuse(detail: string): never {
  throw new SubjectGraphRevisionIntentBoundaryError(detail);
}

function snapshotValue(
  raw: unknown,
  path: string,
  limits: StrictJsonLimits,
): StrictJsonValue {
  try {
    return snapshotStrictJson(raw, path, limits);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function snapshotObject(
  raw: unknown,
  path: string,
  limits: StrictJsonLimits,
): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(snapshotValue(raw, path, limits), path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function asObject(
  value: StrictJsonValue | undefined,
  path: string,
): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(value as StrictJsonValue, path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function exact(
  value: { [key: string]: StrictJsonValue },
  keys: readonly string[],
  path: string,
): void {
  try {
    assertExactKeys(value, keys, path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function parseDigest(value: unknown, path: string): string {
  if (typeof value !== "string" || !CANONICAL_SHA256.test(value)) {
    refuse(`${path} must be a canonical lowercase SHA-256 digest`);
  }
  return value;
}

function parseTimestamp(value: unknown, path: string): string {
  if (typeof value !== "string" || !CANONICAL_UTC_TIMESTAMP.test(value)) {
    refuse(`${path} must be a canonical UTC timestamp`);
  }
  const parsed = new Date(value);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().replace(".000Z", "Z") !== value
  ) {
    refuse(`${path} must be a valid canonical UTC timestamp`);
  }
  return value;
}

function parseApplicationNow(raw: unknown): string {
  const path = "candidate_transition_application_options";
  const options = snapshotObject(raw, path, INTENT_LIMITS);
  exact(
    options,
    ["now", "expected_scope", "prior_recorded_replay_keys"],
    path,
  );
  return parseTimestamp(options.now, `${path}.now`);
}

function reviewAuthority(): SubjectGraphRevisionReviewAuthority {
  return {
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
  };
}

function intentAuthority(): SubjectGraphRevisionIntentAuthority {
  return {
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
  };
}

function graphIdentity(transition: CandidateTransition): SubjectGraphIdentity {
  return {
    team_id: transition.scope.team_id,
    account_id: transition.scope.account_id,
    subject_id: transition.scope.subject_id,
    purpose: transition.scope.purpose,
  };
}

function parseGraphIdentity(
  value: StrictJsonValue | undefined,
  expected: SubjectGraphIdentity,
  path: string,
): SubjectGraphIdentity {
  const identity = asObject(value, path);
  exact(identity, GRAPH_IDENTITY_KEYS, path);
  if (
    identity.team_id !== expected.team_id ||
    identity.account_id !== expected.account_id ||
    identity.subject_id !== expected.subject_id ||
    identity.purpose !== expected.purpose
  ) {
    refuse(`${path} does not exactly match the transition scope`);
  }
  return { ...expected };
}

function parseRevision(value: unknown, path: string): SubjectGraphRevisionToken {
  if (typeof value !== "string") {
    refuse(`${path} must be a canonical positive GraphRevision token`);
  }
  const match = CANONICAL_REVISION.exec(value);
  if (match === null) {
    refuse(`${path} must match rev_<positive integer> without leading zeros`);
  }
  const revision = Number(match[1]);
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    refuse(`${path} must contain a positive safe integer revision`);
  }
  return value as SubjectGraphRevisionToken;
}

function transitionBaseIsCanonicallyEmpty(transition: CandidateTransition): boolean {
  return (
    canonicalJson(
      snapshotValue(
        transition.base_candidate.graph_bundle,
        "candidate_transition.base_candidate.graph_bundle",
        INTENT_LIMITS,
      ),
    ) === CANONICAL_EMPTY_GRAPH_BUNDLE
  );
}

function parsePredecessorBasis(
  raw: unknown,
  transition: CandidateTransition,
): SubjectGraphRevisionPredecessorBasis {
  const path = "subject_graph_revision_predecessor_basis";
  const basis = snapshotObject(raw, path, REVIEW_LIMITS);
  exact(basis, PREDECESSOR_BASIS_KEYS, path);
  const baseDigest = parseDigest(
    basis.expected_base_snapshot_sha256,
    `${path}.expected_base_snapshot_sha256`,
  );
  const exactBaseDigest = validatedCandidateSha256(transition.base_candidate);
  if (baseDigest !== exactBaseDigest) {
    refuse("predecessor basis is bound to a stale or substituted base snapshot");
  }
  if (basis.mode === "bootstrap") {
    if (basis.expected_prior_revision !== null) {
      refuse("bootstrap predecessor basis requires expected_prior_revision null");
    }
    if (!transitionBaseIsCanonicallyEmpty(transition)) {
      refuse("bootstrap predecessor basis requires a canonically empty base graph bundle");
    }
    return {
      mode: "bootstrap",
      expected_prior_revision: null,
      expected_base_snapshot_sha256: exactBaseDigest,
    };
  }
  if (basis.mode !== "successor") {
    refuse("predecessor basis mode must be bootstrap or successor");
  }
  return {
    mode: "successor",
    expected_prior_revision: parseRevision(
      basis.expected_prior_revision,
      `${path}.expected_prior_revision`,
    ),
    expected_base_snapshot_sha256: exactBaseDigest,
  };
}

interface TransitionBindings {
  readonly graph_identity: SubjectGraphIdentity;
  readonly envelope_sha256: string;
  readonly delta_sha256: string;
  readonly transition_sha256: string;
  readonly base_snapshot_sha256: string;
  readonly proposed_snapshot_sha256: string;
  readonly quality_gate_policy: CandidateQualityGatePolicyIdentity;
  readonly quality_gate_report_sha256: string;
  readonly replay_key_to_record: string;
}

function transitionBindings(transition: CandidateTransition): TransitionBindings {
  return {
    graph_identity: graphIdentity(transition),
    envelope_sha256: transition.delta.envelope_sha256,
    delta_sha256: transition.delta.delta_sha256,
    transition_sha256: transition.transition_sha256,
    base_snapshot_sha256: validatedCandidateSha256(transition.base_candidate),
    proposed_snapshot_sha256: validatedCandidateSha256(transition.candidate),
    quality_gate_policy: { ...transition.delta.quality_gate_policy },
    quality_gate_report_sha256: transition.delta.quality_gate_report_sha256,
    replay_key_to_record: transition.replay_key_to_record,
  };
}

function parseQualityGatePolicy(
  value: StrictJsonValue | undefined,
  expected: CandidateQualityGatePolicyIdentity,
  path: string,
): CandidateQualityGatePolicyIdentity {
  const policy = asObject(value, path);
  exact(policy, QUALITY_GATE_POLICY_KEYS, path);
  if (
    policy.name !== expected.name ||
    policy.version !== expected.version ||
    policy.policy_sha256 !== expected.policy_sha256
  ) {
    refuse(`${path} does not match the exact transition quality-gate policy`);
  }
  return { ...expected };
}

function parseReviewAuthority(
  value: StrictJsonValue | undefined,
  path: string,
): SubjectGraphRevisionReviewAuthority {
  const authority = asObject(value, path);
  exact(authority, REVIEW_AUTHORITY_KEYS, path);
  const expected = reviewAuthority();
  if (canonicalJson(authority) !== canonicalJson(expected as unknown as StrictJsonValue)) {
    refuse(`${path} must remain a non-authorizing review handoff`);
  }
  return expected;
}

function assertExactDigestReference(
  review: { [key: string]: StrictJsonValue },
  key:
    | "envelope_sha256"
    | "delta_sha256"
    | "transition_sha256"
    | "base_snapshot_sha256"
    | "proposed_snapshot_sha256"
    | "quality_gate_report_sha256"
    | "replay_key_to_record",
  expected: string,
): string {
  const value = parseDigest(review[key], `subject_graph_revision_review_handoff.${key}`);
  if (value !== expected) {
    refuse(`review handoff ${key} does not match the exact transition`);
  }
  return expected;
}

function parseReviewHandoff(
  raw: unknown,
  bindings: TransitionBindings,
  basis: SubjectGraphRevisionPredecessorBasis,
  reviewWindow: {
    readonly transition_created_at: string;
    readonly application_now: string;
  },
): SubjectGraphRevisionReviewHandoff {
  const path = "subject_graph_revision_review_handoff";
  const review = snapshotObject(raw, path, REVIEW_LIMITS);
  exact(review, REVIEW_HANDOFF_KEYS, path);
  if (
    review.kind !== SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND ||
    review.version !== SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION
  ) {
    refuse("review handoff kind/version is unsupported");
  }
  if (review.disposition !== SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION) {
    refuse("review handoff disposition does not accept this transition for a prewrite revision intent");
  }
  const reviewIdentity = parseGraphIdentity(
    review.graph_identity,
    bindings.graph_identity,
    `${path}.graph_identity`,
  );
  const reviewBasis = snapshotObject(
    review.predecessor_basis,
    `${path}.predecessor_basis`,
    REVIEW_LIMITS,
  );
  exact(reviewBasis, PREDECESSOR_BASIS_KEYS, `${path}.predecessor_basis`);
  if (
    canonicalJson(reviewBasis) !==
    canonicalJson(basis as unknown as StrictJsonValue)
  ) {
    refuse("review handoff predecessor basis does not match the validated intent basis");
  }

  const envelopeSha256 = assertExactDigestReference(
    review,
    "envelope_sha256",
    bindings.envelope_sha256,
  );
  const deltaSha256 = assertExactDigestReference(
    review,
    "delta_sha256",
    bindings.delta_sha256,
  );
  const transitionSha256 = assertExactDigestReference(
    review,
    "transition_sha256",
    bindings.transition_sha256,
  );
  const baseSnapshotSha256 = assertExactDigestReference(
    review,
    "base_snapshot_sha256",
    bindings.base_snapshot_sha256,
  );
  const proposedSnapshotSha256 = assertExactDigestReference(
    review,
    "proposed_snapshot_sha256",
    bindings.proposed_snapshot_sha256,
  );
  const qualityGatePolicy = parseQualityGatePolicy(
    review.quality_gate_policy,
    bindings.quality_gate_policy,
    `${path}.quality_gate_policy`,
  );
  const qualityGateReportSha256 = assertExactDigestReference(
    review,
    "quality_gate_report_sha256",
    bindings.quality_gate_report_sha256,
  );
  const replayKey = assertExactDigestReference(
    review,
    "replay_key_to_record",
    bindings.replay_key_to_record,
  );
  if (
    typeof review.reviewer_ref !== "string" ||
    !SAFE_REVIEWER_REF.test(review.reviewer_ref)
  ) {
    refuse("review handoff reviewer_ref is malformed or exceeds its bound");
  }
  const reviewedAt = parseTimestamp(review.reviewed_at, `${path}.reviewed_at`);
  const reviewedAtMs = new Date(reviewedAt).getTime();
  if (
    reviewedAtMs < new Date(reviewWindow.transition_created_at).getTime() ||
    reviewedAtMs > new Date(reviewWindow.application_now).getTime()
  ) {
    refuse(
      "review handoff reviewed_at must be within the exact transition live window and no later than application now",
    );
  }
  if (
    typeof review.rationale !== "string" ||
    review.rationale.trim() === "" ||
    Buffer.byteLength(review.rationale, "utf8") > MAX_RATIONALE_UTF8_BYTES ||
    /[\u0000-\u001f\u007f]/.test(review.rationale)
  ) {
    refuse("review handoff rationale must be bounded, non-empty, and free of control characters");
  }
  const authority = parseReviewAuthority(review.authority, `${path}.authority`);

  return {
    kind: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
    version: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_VERSION,
    disposition: SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
    graph_identity: reviewIdentity,
    predecessor_basis: { ...basis },
    envelope_sha256: envelopeSha256,
    delta_sha256: deltaSha256,
    transition_sha256: transitionSha256,
    base_snapshot_sha256: baseSnapshotSha256,
    proposed_snapshot_sha256: proposedSnapshotSha256,
    quality_gate_policy: qualityGatePolicy,
    quality_gate_report_sha256: qualityGateReportSha256,
    replay_key_to_record: replayKey,
    reviewer_ref: review.reviewer_ref,
    reviewed_at: reviewedAt,
    rationale: review.rationale,
    authority,
  };
}

function rehydrateTransition(
  rawEnvelope: unknown,
  rawTransition: unknown,
  rawApplicationOptions: unknown,
): CandidateTransition {
  try {
    return hydrateCandidateTransition(
      rawEnvelope,
      rawTransition,
      rawApplicationOptions,
    );
  } catch (error) {
    if (error instanceof SubjectGraphRevisionIntentBoundaryError) throw error;
    if (error instanceof Error) {
      refuse(`candidate transition rehydration failed: ${error.message}`);
    }
    refuse("candidate transition rehydration failed");
  }
}

function ownedCandidateSnapshot(candidate: ValidatedCandidate): ValidatedCandidate {
  try {
    return hydrateValidatedCandidate(candidate);
  } catch (error) {
    if (error instanceof Error) refuse(`proposed candidate snapshot is invalid: ${error.message}`);
    refuse("proposed candidate snapshot is invalid");
  }
}

function buildIntentCore(
  transition: CandidateTransition,
  bindings: TransitionBindings,
  basis: SubjectGraphRevisionPredecessorBasis,
  review: SubjectGraphRevisionReviewHandoff,
): SubjectGraphRevisionIntentCore {
  const proposedSnapshot = ownedCandidateSnapshot(transition.candidate);
  const reviewSnapshot = snapshotValue(
    review,
    "subject_graph_revision_review_handoff",
    REVIEW_LIMITS,
  );
  return {
    kind: SUBJECT_GRAPH_REVISION_INTENT_KIND,
    version: SUBJECT_GRAPH_REVISION_INTENT_VERSION,
    graph_identity: { ...bindings.graph_identity },
    predecessor_basis: { ...basis },
    envelope_sha256: bindings.envelope_sha256,
    delta_sha256: bindings.delta_sha256,
    transition_sha256: bindings.transition_sha256,
    base_snapshot_sha256: bindings.base_snapshot_sha256,
    proposed_snapshot_sha256: bindings.proposed_snapshot_sha256,
    quality_gate_policy: { ...bindings.quality_gate_policy },
    quality_gate_report_sha256: bindings.quality_gate_report_sha256,
    proposed_snapshot: proposedSnapshot,
    review_handoff: review,
    review_handoff_sha256: sha256CanonicalJson(reviewSnapshot),
    replay_key_to_record: bindings.replay_key_to_record,
    authority: intentAuthority(),
  };
}

function preflightProspectiveIntent(core: SubjectGraphRevisionIntentCore): void {
  try {
    snapshotStrictJson(
      { ...core, intent_sha256: "0".repeat(64) },
      "prospective_subject_graph_revision_intent",
      INTENT_LIMITS,
    );
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) {
      refuse(`prospective serialized intent exceeds its bound: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Create a pure, non-authorizing intent for a future transactional boundary.
 * No current durable revision or snapshot is read here; the supplied
 * predecessor basis is only an exact compare-and-swap expectation.
 */
export function createSubjectGraphRevisionIntent(
  rawEnvelope: unknown,
  rawTransition: unknown,
  rawApplicationOptions: unknown,
  rawPredecessorBasis: unknown,
  rawReviewHandoff: unknown,
): SubjectGraphRevisionIntent {
  // Snapshotting the application options here is intentional: it safely reads
  // the review clock, while hydrateCandidateTransition independently validates
  // the complete options. Strict own-data JSON rejects executable getters and
  // Proxies before either synchronous snapshot can observe caller code.
  const applicationNow = parseApplicationNow(rawApplicationOptions);
  const transition = rehydrateTransition(
    rawEnvelope,
    rawTransition,
    rawApplicationOptions,
  );
  const bindings = transitionBindings(transition);
  const basis = parsePredecessorBasis(rawPredecessorBasis, transition);
  const review = parseReviewHandoff(rawReviewHandoff, bindings, basis, {
    transition_created_at: transition.created_at,
    application_now: applicationNow,
  });
  const core = buildIntentCore(transition, bindings, basis, review);
  preflightProspectiveIntent(core);
  const coreSnapshot = snapshotValue(
    core,
    "subject_graph_revision_intent_core",
    INTENT_LIMITS,
  );
  const intent = {
    ...core,
    intent_sha256: sha256CanonicalJson(coreSnapshot),
  };
  return deepFreezeOwnData(intent);
}

/**
 * Hydrate by re-creating the complete expected intent from the exact envelope,
 * transition, application options, and the hydrated intent's own exact basis
 * and review fields. Rehashing caller-chosen substitutions cannot bypass the
 * final canonical comparison.
 */
export function hydrateSubjectGraphRevisionIntent(
  rawEnvelope: unknown,
  rawTransition: unknown,
  rawApplicationOptions: unknown,
  rawIntent: unknown,
): SubjectGraphRevisionIntent {
  const path = "subject_graph_revision_intent";
  const root = snapshotObject(rawIntent, path, INTENT_LIMITS);
  exact(root, [...INTENT_CORE_KEYS, "intent_sha256"], path);
  if (
    root.kind !== SUBJECT_GRAPH_REVISION_INTENT_KIND ||
    root.version !== SUBJECT_GRAPH_REVISION_INTENT_VERSION
  ) {
    refuse("intent kind/version is unsupported");
  }
  parseDigest(root.intent_sha256, `${path}.intent_sha256`);

  const expected = createSubjectGraphRevisionIntent(
    rawEnvelope,
    rawTransition,
    rawApplicationOptions,
    root.predecessor_basis,
    root.review_handoff,
  );
  const expectedSnapshot = snapshotValue(
    expected,
    "expected_subject_graph_revision_intent",
    INTENT_LIMITS,
  );
  if (canonicalJson(root) !== canonicalJson(expectedSnapshot)) {
    refuse(
      "intent does not exactly match the rederived transition, predecessor basis, and review handoff",
    );
  }
  return expected;
}
