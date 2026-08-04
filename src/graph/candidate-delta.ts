import {
  assertExactKeys,
  canonicalJson,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  StrictJsonBoundaryError,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  runQualityGate,
  type GateStatus,
  type QualityGateReport,
} from "../gate/quality-gate.ts";
import {
  PROPOSAL_ENVELOPE_MAX_LIFETIME_MS,
  PROPOSAL_ENVELOPE_PURPOSE,
  hydrateProposalEnvelope,
  type ProposalAuthorityMarkers,
  type ProposalEnvelope,
  type ProposalFixtureBinding,
  type ProposalProducer,
  type ProposalScope,
  type ProposalSourceAssurances,
} from "../validation/proposal-envelope.ts";
import {
  PROPOSAL_MATERIALIZATION_REVIEW_STATE,
  assertProposalDerivedRecordsUnverified,
  materializeProposalForValidation,
} from "../validation/proposal-materialization.ts";
import type { GraphBundle } from "./types.ts";
import {
  createValidatedCandidate,
  hydrateValidatedCandidate,
  type ValidatedCandidate,
} from "./validated-candidate.ts";

export const CANDIDATE_DELTA_KIND = "atliera_candidate_delta" as const;
export const CANDIDATE_DELTA_VERSION = 1 as const;
export const CANDIDATE_TRANSITION_KIND = "atliera_candidate_transition" as const;
export const CANDIDATE_TRANSITION_VERSION = 1 as const;
export const CANDIDATE_QUALITY_GATE_POLICY_NAME =
  "atliera_candidate_quality_gate" as const;
export const CANDIDATE_QUALITY_GATE_POLICY_VERSION = 1 as const;

export const CANDIDATE_COMPOSITION_MAX_RECORDS_PER_GRAPH_KIND = 1_000;
export const CANDIDATE_COMPOSITION_MAX_TOTAL_GRAPH_RECORDS = 4_000;
export const CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES =
  2 * 1024 * 1024;
export const CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES =
  4 * 1024 * 1024;
export const CANDIDATE_TRANSITION_MAX_JSON_NODES = 20_000;
// A transition can embed at most roughly 8,000 graph records across its delta,
// base, and merged candidate. This leaves over 20 expanded values per record
// plus fixed wrappers while stopping million-scalar alias amplification early.
export const CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES = 200_000;
export const CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES =
  12 * 1024 * 1024;

export interface CandidateQualityGatePolicyIdentity {
  readonly name: typeof CANDIDATE_QUALITY_GATE_POLICY_NAME;
  readonly version: typeof CANDIDATE_QUALITY_GATE_POLICY_VERSION;
  readonly policy_sha256: string;
}

export interface CandidateDeltaAuthorityMarkers extends ProposalAuthorityMarkers {
  readonly candidate_state_only: true;
  readonly candidate_hash_is_approval: false;
}

export interface CandidateDeltaCore {
  readonly kind: typeof CANDIDATE_DELTA_KIND;
  readonly version: typeof CANDIDATE_DELTA_VERSION;
  readonly producer: ProposalProducer;
  readonly scope: ProposalScope;
  readonly created_at: string;
  readonly expires_at: string;
  readonly envelope_sha256: string;
  readonly base_candidate_sha256: string;
  readonly records: GraphBundle;
  readonly quality_gate_status: GateStatus;
  readonly quality_gate_policy: CandidateQualityGatePolicyIdentity;
  readonly quality_gate_report_sha256: string;
  readonly replay_key: string;
  readonly source_assurances: ProposalSourceAssurances;
  readonly fixture_binding: ProposalFixtureBinding | null;
  readonly authority: CandidateDeltaAuthorityMarkers;
}

export interface CandidateDelta extends CandidateDeltaCore {
  readonly delta_sha256: string;
}

export interface CandidateTransitionAuthorityMarkers
  extends CandidateDeltaAuthorityMarkers {
  readonly provider_calls_performed: 0;
  readonly network_operations_performed: 0;
}

export interface CandidateTransitionReplayProtection {
  readonly caller_snapshot_required: true;
  readonly caller_must_record_key: true;
  readonly cross_process_durable_protection: false;
}

export interface CandidateTransitionCore {
  readonly kind: typeof CANDIDATE_TRANSITION_KIND;
  readonly version: typeof CANDIDATE_TRANSITION_VERSION;
  readonly producer: ProposalProducer;
  readonly scope: ProposalScope;
  readonly created_at: string;
  readonly expires_at: string;
  readonly delta: CandidateDelta;
  readonly base_candidate: ValidatedCandidate;
  readonly candidate_sha256: string;
  readonly candidate: ValidatedCandidate;
  readonly quality_gate: QualityGateReport;
  readonly replay_key_to_record: string;
  readonly replay_protection: CandidateTransitionReplayProtection;
  readonly source_assurances: ProposalSourceAssurances;
  readonly fixture_binding: ProposalFixtureBinding | null;
  readonly authority: CandidateTransitionAuthorityMarkers;
}

export interface CandidateTransition extends CandidateTransitionCore {
  readonly transition_sha256: string;
}

export interface ApplyCandidateDeltaOptions {
  readonly now: string;
  readonly expected_scope: ProposalScope;
  readonly prior_recorded_replay_keys: readonly string[];
}

export class CandidateDeltaBoundaryError extends Error {
  constructor(detail: string) {
    super(`Candidate delta refused: ${detail}`);
    this.name = "CandidateDeltaBoundaryError";
  }
}

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: CANDIDATE_COMPOSITION_MAX_RECORDS_PER_GRAPH_KIND,
  max_depth: 16,
  max_expanded_json_value_occurrences:
    CANDIDATE_TRANSITION_MAX_EXPANDED_JSON_VALUE_OCCURRENCES,
  max_nodes: CANDIDATE_TRANSITION_MAX_JSON_NODES,
  max_object_fields: 128,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes:
    CANDIDATE_TRANSITION_MAX_TOTAL_STRING_UTF8_BYTES,
});

// Candidate derivation never consults the exported generic default or a
// caller-supplied threshold object. This private, recursively immutable policy
// is versioned and hashed as an unkeyed integrity identity; neither identity
// is authentication or approval.
const CANDIDATE_QUALITY_GATE_POLICY = Object.freeze({
  name: CANDIDATE_QUALITY_GATE_POLICY_NAME,
  version: CANDIDATE_QUALITY_GATE_POLICY_VERSION,
  thresholds: Object.freeze({
    min_accepted_excerpt_rate: 0.5,
    min_verified_claim_evidence_coverage: 1,
    max_invented_id_failures: 0,
  }),
});

const CANDIDATE_QUALITY_GATE_POLICY_SHA256 = sha256CanonicalJson(
  CANDIDATE_QUALITY_GATE_POLICY as unknown as StrictJsonValue,
);

// Every digest and replay key in this pure boundary is an unkeyed integrity
// identity. Exact re-derivation establishes content binding; no hash grants
// authentication, approval, replay consumption, or other authority.
const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;
const SAFE_TEAM_ID = /^team_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_ACCOUNT_ID = /^acc_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_PRODUCER_TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const DELTA_CORE_KEYS = [
  "kind",
  "version",
  "producer",
  "scope",
  "created_at",
  "expires_at",
  "envelope_sha256",
  "base_candidate_sha256",
  "records",
  "quality_gate_status",
  "quality_gate_policy",
  "quality_gate_report_sha256",
  "replay_key",
  "source_assurances",
  "fixture_binding",
  "authority",
] as const;

const TRANSITION_CORE_KEYS = [
  "kind",
  "version",
  "producer",
  "scope",
  "created_at",
  "expires_at",
  "delta",
  "base_candidate",
  "candidate_sha256",
  "candidate",
  "quality_gate",
  "replay_key_to_record",
  "replay_protection",
  "source_assurances",
  "fixture_binding",
  "authority",
] as const;

function refuse(detail: string): never {
  throw new CandidateDeltaBoundaryError(detail);
}

function snapshot(raw: unknown, path: string): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(snapshotStrictJson(raw, path, LIMITS), path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function strictSnapshot(raw: unknown, path: string): StrictJsonValue {
  try {
    return snapshotStrictJson(raw, path, LIMITS);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function candidateQualityGatePolicyIdentity(): CandidateQualityGatePolicyIdentity {
  return {
    name: CANDIDATE_QUALITY_GATE_POLICY_NAME,
    version: CANDIDATE_QUALITY_GATE_POLICY_VERSION,
    policy_sha256: CANDIDATE_QUALITY_GATE_POLICY_SHA256,
  };
}

function parseCandidateQualityGatePolicyIdentity(
  value: StrictJsonValue | undefined,
  path: string,
): CandidateQualityGatePolicyIdentity {
  const identity = asObject(value, path);
  exact(identity, ["name", "version", "policy_sha256"], path);
  if (
    identity.name !== CANDIDATE_QUALITY_GATE_POLICY_NAME ||
    identity.version !== CANDIDATE_QUALITY_GATE_POLICY_VERSION ||
    identity.policy_sha256 !== CANDIDATE_QUALITY_GATE_POLICY_SHA256
  ) {
    refuse(`${path} has quality-gate policy identity drift`);
  }
  return candidateQualityGatePolicyIdentity();
}

function runCandidateQualityGate(bundle: GraphBundle): QualityGateReport {
  return runQualityGate(bundle, CANDIDATE_QUALITY_GATE_POLICY.thresholds);
}

function qualityGateReportSha256(report: QualityGateReport): string {
  return sha256CanonicalJson(
    strictSnapshot(report, "candidate_quality_gate_report"),
  );
}

function hydrateCandidate(raw: unknown, path: string): ValidatedCandidate {
  try {
    // Bound hostile candidate/base inputs before the generic candidate parser
    // allocates or validates them. The returned candidate is a second fresh
    // snapshot, so no caller-owned object can be frozen through this path.
    return hydrateValidatedCandidate(strictSnapshot(raw, path));
  } catch (error) {
    if (error instanceof CandidateDeltaBoundaryError) throw error;
    if (error instanceof Error) refuse(`${path}: ${error.message}`);
    refuse(`${path} is invalid`);
  }
}

function validateCandidate(
  raw: unknown,
  subject: { readonly team_id: string; readonly account_id: string },
  path: string,
): ValidatedCandidate {
  try {
    return createValidatedCandidate(raw, subject);
  } catch (error) {
    if (error instanceof CandidateDeltaBoundaryError) throw error;
    if (error instanceof Error) refuse(`${path}: ${error.message}`);
    refuse(`${path} is invalid`);
  }
}

function assertUnverifiedProposalRecords(records: GraphBundle): void {
  try {
    assertProposalDerivedRecordsUnverified(records);
  } catch (error) {
    if (error instanceof CandidateDeltaBoundaryError) throw error;
    if (error instanceof Error) refuse(error.message);
    refuse("candidate delta proposal records are invalid");
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

function asObject(value: StrictJsonValue | undefined, path: string) {
  try {
    return strictJsonObject(value as StrictJsonValue, path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function parseTimestamp(value: unknown, path: string): string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    refuse(`${path} must be a canonical UTC timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) refuse(`${path} must be a valid timestamp`);
  const canonical = parsed.toISOString().replace(".000Z", "Z");
  if (canonical !== value) {
    refuse(`${path} must be canonical UTC`);
  }
  return value;
}

function assertLive(createdAt: string, expiresAt: string, now: string, label: string): void {
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();
  const checked = new Date(parseTimestamp(now, `${label}.now`)).getTime();
  if (checked < created) refuse(`${label} is not live yet`);
  if (checked >= expires) refuse(`${label} is expired or stale`);
}

function parseProducer(value: StrictJsonValue | undefined, path: string): ProposalProducer {
  const producer = asObject(value, path);
  exact(producer, ["kind", "trace_id"], path);
  if (
    typeof producer.kind !== "string" ||
    !["fixture", "imported", "model_generated"].includes(producer.kind) ||
    typeof producer.trace_id !== "string" ||
    !SAFE_PRODUCER_TRACE_ID.test(producer.trace_id)
  ) {
    refuse(`${path} is malformed`);
  }
  return {
    kind: producer.kind as ProposalProducer["kind"],
    trace_id: producer.trace_id,
  };
}

function parseScope(value: StrictJsonValue | undefined, path: string): ProposalScope {
  const scope = asObject(value, path);
  exact(scope, ["team_id", "account_id", "subject_id", "purpose"], path);
  if (
    typeof scope.team_id !== "string" ||
    !SAFE_TEAM_ID.test(scope.team_id) ||
    typeof scope.account_id !== "string" ||
    !SAFE_ACCOUNT_ID.test(scope.account_id) ||
    typeof scope.subject_id !== "string" ||
    !SAFE_OPAQUE_ID.test(scope.subject_id) ||
    scope.purpose !== PROPOSAL_ENVELOPE_PURPOSE
  ) {
    refuse(`${path} is malformed or unsupported`);
  }
  return {
    team_id: scope.team_id,
    account_id: scope.account_id,
    subject_id: scope.subject_id,
    purpose: PROPOSAL_ENVELOPE_PURPOSE,
  };
}

function sameScope(left: ProposalScope, right: ProposalScope): boolean {
  return (
    left.team_id === right.team_id &&
    left.account_id === right.account_id &&
    left.subject_id === right.subject_id &&
    left.purpose === right.purpose
  );
}

function parseAssurances(
  value: StrictJsonValue | undefined,
  path: string,
): ProposalSourceAssurances {
  const assurances = asObject(value, path);
  exact(
    assurances,
    [
      "origin_content_sha256_proves_origin_custody",
      "transformation_manifest_sha256_resolves_transformation_record",
    ],
    path,
  );
  if (
    assurances.origin_content_sha256_proves_origin_custody !== false ||
    assurances.transformation_manifest_sha256_resolves_transformation_record !== false
  ) {
    refuse(`${path} must remain explicitly closed`);
  }
  return {
    origin_content_sha256_proves_origin_custody: false,
    transformation_manifest_sha256_resolves_transformation_record: false,
  };
}

function parseFixtureBinding(
  value: StrictJsonValue | undefined,
  producer: ProposalProducer,
  path: string,
): ProposalFixtureBinding | null {
  if (value === null) {
    if (producer.kind === "fixture") refuse(`${path} is required for fixture producers`);
    return null;
  }
  if (producer.kind !== "fixture") refuse(`${path} is forbidden for non-fixture producers`);
  const binding = asObject(value, path);
  exact(
    binding,
    ["fixture_id", "fixture_content_sha256", "authenticated_human_approval"],
    path,
  );
  if (
    typeof binding.fixture_id !== "string" ||
    !SAFE_OPAQUE_ID.test(binding.fixture_id) ||
    typeof binding.fixture_content_sha256 !== "string" ||
    !CANONICAL_SHA256.test(binding.fixture_content_sha256) ||
    binding.authenticated_human_approval !== false
  ) {
    refuse(`${path} is malformed or claims authenticated approval`);
  }
  return {
    fixture_id: binding.fixture_id,
    fixture_content_sha256: binding.fixture_content_sha256,
    authenticated_human_approval: false,
  };
}

function parseDeltaAuthority(
  value: StrictJsonValue | undefined,
  path: string,
): CandidateDeltaAuthorityMarkers {
  const authority = asObject(value, path);
  exact(
    authority,
    [
      "proposal_only",
      "integrity_digest_is_approval",
      "current_effective_authorization",
      "trusted_presentation_authority",
      "graph_ingestion_authority",
      "authenticated_human_approval",
      "ratification",
      "durable_write_authority",
      "durable_effect_performed",
      "candidate_state_only",
      "candidate_hash_is_approval",
    ],
    path,
  );
  if (
    authority.proposal_only !== true ||
    authority.integrity_digest_is_approval !== false ||
    authority.current_effective_authorization !== "none" ||
    authority.trusted_presentation_authority !== false ||
    authority.graph_ingestion_authority !== false ||
    authority.authenticated_human_approval !== false ||
    authority.ratification !== false ||
    authority.durable_write_authority !== false ||
    authority.durable_effect_performed !== false ||
    authority.candidate_state_only !== true ||
    authority.candidate_hash_is_approval !== false
  ) {
    refuse(`${path} must remain proposal-only and non-authorizing`);
  }
  return deltaAuthority();
}

function deltaAuthority(): CandidateDeltaAuthorityMarkers {
  return {
    proposal_only: true,
    integrity_digest_is_approval: false,
    current_effective_authorization: "none",
    trusted_presentation_authority: false,
    graph_ingestion_authority: false,
    authenticated_human_approval: false,
    ratification: false,
    durable_write_authority: false,
    durable_effect_performed: false,
    candidate_state_only: true,
    candidate_hash_is_approval: false,
  };
}

function transitionAuthority(): CandidateTransitionAuthorityMarkers {
  return {
    ...deltaAuthority(),
    provider_calls_performed: 0,
    network_operations_performed: 0,
  };
}

function parseTransitionAuthority(
  value: StrictJsonValue | undefined,
  path: string,
): CandidateTransitionAuthorityMarkers {
  const authority = asObject(value, path);
  exact(
    authority,
    [
      "proposal_only",
      "integrity_digest_is_approval",
      "current_effective_authorization",
      "trusted_presentation_authority",
      "graph_ingestion_authority",
      "authenticated_human_approval",
      "ratification",
      "durable_write_authority",
      "durable_effect_performed",
      "candidate_state_only",
      "candidate_hash_is_approval",
      "provider_calls_performed",
      "network_operations_performed",
    ],
    path,
  );
  parseDeltaAuthority(
    Object.fromEntries(
      Object.entries(authority).filter(
        ([key]) => key !== "provider_calls_performed" && key !== "network_operations_performed",
      ),
    ) as { [key: string]: StrictJsonValue },
    path,
  );
  if (authority.provider_calls_performed !== 0 || authority.network_operations_performed !== 0) {
    refuse(`${path} must record zero provider and network operations`);
  }
  return transitionAuthority();
}

function graphMerge(base: GraphBundle, delta: GraphBundle): GraphBundle {
  return {
    sources: [...base.sources, ...delta.sources],
    excerpts: [...base.excerpts, ...delta.excerpts],
    claims: [...base.claims, ...delta.claims],
    claim_evidence: [...base.claim_evidence, ...delta.claim_evidence],
    account_objects: [...base.account_objects, ...delta.account_objects],
    account_object_claims: [
      ...base.account_object_claims,
      ...delta.account_object_claims,
    ],
    research_runs: [...base.research_runs, ...delta.research_runs],
    run_artifacts: [...base.run_artifacts, ...delta.run_artifacts],
    audit_events: [...base.audit_events, ...delta.audit_events],
  };
}

const GRAPH_BUNDLE_ARRAY_KEYS = [
  "sources",
  "excerpts",
  "claims",
  "claim_evidence",
  "account_objects",
  "account_object_claims",
  "research_runs",
  "run_artifacts",
  "audit_events",
] as const satisfies readonly (keyof GraphBundle)[];

function assertMergedCandidateComposition(bundle: GraphBundle): void {
  let totalRecords = 0;
  for (const key of GRAPH_BUNDLE_ARRAY_KEYS) {
    const count = bundle[key].length;
    if (count > CANDIDATE_COMPOSITION_MAX_RECORDS_PER_GRAPH_KIND) {
      refuse(
        `fully merged candidate exceeds the merged-candidate compositional array budget for ${key} of ${CANDIDATE_COMPOSITION_MAX_RECORDS_PER_GRAPH_KIND.toLocaleString("en-US")} records`,
      );
    }
    totalRecords += count;
  }
  if (totalRecords > CANDIDATE_COMPOSITION_MAX_TOTAL_GRAPH_RECORDS) {
    refuse(
      `fully merged candidate exceeds the merged-candidate compositional total-record budget of ${CANDIDATE_COMPOSITION_MAX_TOTAL_GRAPH_RECORDS.toLocaleString("en-US")} records`,
    );
  }

  let totalSourceBytes = 0;
  for (let index = 0; index < bundle.sources.length; index += 1) {
    const sourceBytes = Buffer.byteLength(bundle.sources[index]!.raw_text, "utf8");
    if (sourceBytes > CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES) {
      refuse(
        `fully merged candidate source[${index}].raw_text exceeds the merged-candidate compositional per-source UTF-8 budget of ${CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES} bytes`,
      );
    }
    totalSourceBytes += sourceBytes;
    if (
      totalSourceBytes >
      CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES
    ) {
      refuse(
        `fully merged candidate exceeds the merged-candidate compositional cumulative source-content UTF-8 budget of ${CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES} bytes`,
      );
    }
  }
}

function proposalActor(producer: ProposalProducer): "model" | "import" | "system" {
  if (producer.kind === "model_generated") return "model";
  if (producer.kind === "imported") return "import";
  return "system";
}

function proposalReviewState(producer: ProposalProducer): string {
  return producer.kind === "imported"
    ? "imported_proposal_pending_human_review"
    : PROPOSAL_MATERIALIZATION_REVIEW_STATE;
}

function materializeEnvelopeRecords(envelope: ProposalEnvelope): GraphBundle {
  const proposalSetId = `proposal-${envelope.envelope_sha256.slice(0, 24)}`;
  // This literal satisfies the legacy materializer's internal adapter gate.
  // Its origin metadata is discarded and replaced below with the canonical
  // envelope producer trace; it is never surfaced as the proposal's origin.
  const materialized = materializeProposalForValidation({
    context: {
      origin: "hand-curated-public",
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
      materialized_at: envelope.created_at,
      proposal_set_id: proposalSetId,
    },
    public_sources: envelope.proposal_content.sources,
    proposed_excerpts: envelope.proposal_content.excerpts.map((excerpt) => ({
      proposal_id: excerpt.id,
      source_document_id: excerpt.source_id,
      quote: excerpt.text,
    })),
    proposed_claims: envelope.proposal_content.claims.map((claim) => ({
      proposal_id: claim.id,
      claim_type: claim.type,
      text: claim.text,
      normalized_subject: claim.subject,
      confidence: claim.confidence,
      supporting_excerpt_proposal_ids: claim.excerpt_ids,
    })),
    proposed_account_objects: envelope.proposal_content.account_objects.map((object) => ({
      proposal_id: object.id,
      object_type: object.type,
      title: object.title,
      summary: object.summary,
      supporting_claim_proposal_ids: object.claim_ids,
    })),
  });
  if (
    !materialized.bundle_validation.ok ||
    materialized.dispositions.some((disposition) => disposition.disposition === "rejected") ||
    materialized.accepted_counts.sources !== envelope.proposal_content.sources.length ||
    materialized.accepted_counts.excerpts !== envelope.proposal_content.excerpts.length ||
    materialized.accepted_counts.claims !== envelope.proposal_content.claims.length ||
    materialized.accepted_counts.account_objects !==
      envelope.proposal_content.account_objects.length
  ) {
    refuse("canonical proposal content did not materialize completely and validly");
  }

  const actor = proposalActor(envelope.producer);
  const trace = {
    envelope_sha256: envelope.envelope_sha256,
    producer_kind: envelope.producer.kind,
    producer_trace_id: envelope.producer.trace_id,
    subject_id: envelope.scope.subject_id,
    purpose: envelope.scope.purpose,
    fixture_binding_sha256:
      envelope.fixture_binding?.fixture_content_sha256 ?? null,
    fixture_binding_is_authenticated_human_approval: false,
    origin_content_sha256_proves_origin_custody: false,
    transformation_manifest_sha256_resolves_transformation_record: false,
    proposal_only: true,
  };
  const bundle: GraphBundle = {
    ...materialized.bundle_candidate,
    claims: materialized.bundle_candidate.claims.map((claim) => ({
      ...claim,
      created_by: actor,
    })),
    account_objects: materialized.bundle_candidate.account_objects.map((object) => ({
      ...object,
      created_by: actor,
      payload_json: {
        review_state: proposalReviewState(envelope.producer),
        origin: "canonical_proposal_envelope",
        proposal_trace: trace,
      },
    })),
  };
  assertUnverifiedProposalRecords(bundle);
  return bundle;
}

function assertCanonicalProposalTrace(
  records: GraphBundle,
  producer: ProposalProducer,
  scope: ProposalScope,
  envelopeSha256: string,
  fixtureBinding: ProposalFixtureBinding | null,
): void {
  const actor = proposalActor(producer);
  if (
    records.research_runs.length !== 1 ||
    records.run_artifacts.length !== 0 ||
    records.audit_events.length !== 0
  ) {
    refuse("candidate delta must contain exactly one effect-free materialization run");
  }
  const run = records.research_runs[0]!;
  if (
    run.mode !== "fixture" ||
    run.provider !== null ||
    run.model !== null ||
    run.cost_cap_usd !== 0 ||
    run.observed_cost_usd !== 0 ||
    run.status !== "completed"
  ) {
    refuse("candidate delta materialization run must remain provider-free and effect-free");
  }
  for (const claim of records.claims) {
    if (claim.created_by !== actor) refuse("candidate delta claim producer trace is inconsistent");
  }
  for (const object of records.account_objects) {
    if (object.created_by !== actor) refuse("candidate delta object producer trace is inconsistent");
    const payload = snapshot(object.payload_json, "candidate_delta.account_object.payload_json");
    exact(payload, ["review_state", "origin", "proposal_trace"], "candidate_delta.account_object.payload_json");
    if (
      payload.review_state !== proposalReviewState(producer) ||
      payload.origin !== "canonical_proposal_envelope"
    ) {
      refuse("candidate delta object is missing canonical pending-review metadata");
    }
    const trace = asObject(
      payload.proposal_trace,
      "candidate_delta.account_object.payload_json.proposal_trace",
    );
    exact(
      trace,
      [
        "envelope_sha256",
        "producer_kind",
        "producer_trace_id",
        "subject_id",
        "purpose",
        "fixture_binding_sha256",
        "fixture_binding_is_authenticated_human_approval",
        "origin_content_sha256_proves_origin_custody",
        "transformation_manifest_sha256_resolves_transformation_record",
        "proposal_only",
      ],
      "candidate_delta.account_object.payload_json.proposal_trace",
    );
    if (
      trace.envelope_sha256 !== envelopeSha256 ||
      trace.producer_kind !== producer.kind ||
      trace.producer_trace_id !== producer.trace_id ||
      trace.subject_id !== scope.subject_id ||
      trace.purpose !== scope.purpose ||
      trace.fixture_binding_sha256 !==
        (fixtureBinding?.fixture_content_sha256 ?? null) ||
      trace.fixture_binding_is_authenticated_human_approval !== false ||
      trace.origin_content_sha256_proves_origin_custody !== false ||
      trace.transformation_manifest_sha256_resolves_transformation_record !== false ||
      trace.proposal_only !== true
    ) {
      refuse("candidate delta proposal producer/scope/assurance trace is inconsistent");
    }
  }
}

export function validatedCandidateSha256(raw: unknown): string {
  const candidate = hydrateCandidate(raw, "candidate");
  const candidateSnapshot = strictSnapshot(candidate, "candidate");
  return sha256CanonicalJson(candidateSnapshot);
}

function replayKey(envelopeSha256: string, baseCandidateSha256: string): string {
  return sha256CanonicalJson([
    "atliera_candidate_delta_replay",
    CANDIDATE_DELTA_VERSION,
    envelopeSha256,
    baseCandidateSha256,
  ]);
}

interface CandidateDeltaDerivation {
  readonly core: CandidateDeltaCore;
  readonly candidate: ValidatedCandidate;
  readonly quality_gate: QualityGateReport;
}

function buildCandidateDeltaCore(
  envelope: ProposalEnvelope,
  base: ValidatedCandidate,
): CandidateDeltaDerivation {
  if (
    base.subject.team_id !== envelope.scope.team_id ||
    base.subject.account_id !== envelope.scope.account_id
  ) {
    refuse("base candidate team/account does not match the envelope scope");
  }
  const baseCandidateSha256 = validatedCandidateSha256(base);
  const records = materializeEnvelopeRecords(envelope);
  // The materialized proposal is independently valid, but only the complete
  // base+delta result determines whether candidate application is allowed.
  validateCandidate(
    records,
    {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    },
    "candidate delta records",
  );
  const mergedBundle = graphMerge(base.graph_bundle, records);
  assertMergedCandidateComposition(mergedBundle);
  const candidate = validateCandidate(
    mergedBundle,
    {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    },
    "fully merged candidate",
  );
  const qualityGate = runCandidateQualityGate(candidate.graph_bundle);
  if (qualityGate.status === "fail") {
    refuse("fully merged candidate failed the deterministic quality gate");
  }
  return {
    core: {
      kind: CANDIDATE_DELTA_KIND,
      version: CANDIDATE_DELTA_VERSION,
      producer: envelope.producer,
      scope: envelope.scope,
      created_at: envelope.created_at,
      expires_at: envelope.expires_at,
      envelope_sha256: envelope.envelope_sha256,
      base_candidate_sha256: baseCandidateSha256,
      records,
      quality_gate_status: qualityGate.status,
      quality_gate_policy: candidateQualityGatePolicyIdentity(),
      quality_gate_report_sha256: qualityGateReportSha256(qualityGate),
      replay_key: replayKey(envelope.envelope_sha256, baseCandidateSha256),
      source_assurances: envelope.source_assurances,
      fixture_binding: envelope.fixture_binding,
      authority: deltaAuthority(),
    },
    candidate,
    quality_gate: qualityGate,
  };
}

export function createCandidateDelta(
  rawEnvelope: unknown,
  rawBase: unknown,
  now: string,
): CandidateDelta {
  const envelope = hydrateProposalEnvelope(rawEnvelope);
  const base = hydrateCandidate(rawBase, "base candidate");
  assertLive(envelope.created_at, envelope.expires_at, now, "proposal envelope");
  const derivation = buildCandidateDeltaCore(envelope, base);
  const core = derivation.core;
  const deltaSha256 = sha256CanonicalJson(
    strictSnapshot(core, "candidate_delta"),
  );
  const delta = { ...core, delta_sha256: deltaSha256 };
  assertProspectiveTransitionRepresentable(
    delta,
    base,
    derivation.candidate,
    derivation.quality_gate,
  );
  return deepFreezeOwnData(delta);
}

function parseDeltaCore(root: { [key: string]: StrictJsonValue }): CandidateDeltaCore {
  if (root.kind !== CANDIDATE_DELTA_KIND || root.version !== CANDIDATE_DELTA_VERSION) {
    refuse("candidate delta kind/version is unsupported");
  }
  const producer = parseProducer(root.producer, "candidate_delta.producer");
  const scope = parseScope(root.scope, "candidate_delta.scope");
  const createdAt = parseTimestamp(root.created_at, "candidate_delta.created_at");
  const expiresAt = parseTimestamp(root.expires_at, "candidate_delta.expires_at");
  const lifetime = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (lifetime <= 0 || lifetime > PROPOSAL_ENVELOPE_MAX_LIFETIME_MS) {
    refuse("candidate delta lifetime is outside the conservative maximum");
  }
  for (const key of ["envelope_sha256", "base_candidate_sha256", "replay_key"] as const) {
    if (typeof root[key] !== "string" || !CANONICAL_SHA256.test(root[key])) {
      refuse(`candidate_delta.${key} is malformed`);
    }
  }
  if (!(["pass", "borderline", "fail"] as const).includes(root.quality_gate_status as GateStatus)) {
    refuse("candidate_delta.quality_gate_status is malformed");
  }
  if (root.quality_gate_status === "fail") {
    refuse("a failing quality gate cannot become a candidate delta");
  }
  const qualityGatePolicy = parseCandidateQualityGatePolicyIdentity(
    root.quality_gate_policy,
    "candidate_delta.quality_gate_policy",
  );
  if (
    typeof root.quality_gate_report_sha256 !== "string" ||
    !CANONICAL_SHA256.test(root.quality_gate_report_sha256)
  ) {
    refuse("candidate_delta.quality_gate_report_sha256 is malformed");
  }
  const records = validateCandidate(
    root.records,
    {
      team_id: scope.team_id,
      account_id: scope.account_id,
    },
    "candidate delta records",
  ).graph_bundle;
  assertUnverifiedProposalRecords(records);
  const sourceAssurances = parseAssurances(
    root.source_assurances,
    "candidate_delta.source_assurances",
  );
  const fixtureBinding = parseFixtureBinding(
    root.fixture_binding,
    producer,
    "candidate_delta.fixture_binding",
  );
  const authority = parseDeltaAuthority(root.authority, "candidate_delta.authority");
  assertCanonicalProposalTrace(
    records,
    producer,
    scope,
    root.envelope_sha256 as string,
    fixtureBinding,
  );
  return {
    kind: CANDIDATE_DELTA_KIND,
    version: CANDIDATE_DELTA_VERSION,
    producer,
    scope,
    created_at: createdAt,
    expires_at: expiresAt,
    envelope_sha256: root.envelope_sha256 as string,
    base_candidate_sha256: root.base_candidate_sha256 as string,
    records,
    quality_gate_status: root.quality_gate_status as GateStatus,
    quality_gate_policy: qualityGatePolicy,
    quality_gate_report_sha256: root.quality_gate_report_sha256,
    replay_key: root.replay_key as string,
    source_assurances: sourceAssurances,
    fixture_binding: fixtureBinding,
    authority,
  };
}

export function hydrateCandidateDelta(raw: unknown): CandidateDelta {
  const root = snapshot(raw, "candidate_delta");
  exact(root, [...DELTA_CORE_KEYS, "delta_sha256"], "candidate_delta");
  if (typeof root.delta_sha256 !== "string" || !CANONICAL_SHA256.test(root.delta_sha256)) {
    refuse("candidate_delta.delta_sha256 is malformed or missing");
  }
  const core = parseDeltaCore(root);
  const expectedDigest = sha256CanonicalJson(
    strictSnapshot(core, "candidate_delta"),
  );
  if (root.delta_sha256 !== expectedDigest) refuse("candidate delta integrity digest mismatch");
  if (core.replay_key !== replayKey(core.envelope_sha256, core.base_candidate_sha256)) {
    refuse("candidate delta replay key is not deterministic");
  }
  return deepFreezeOwnData({ ...core, delta_sha256: expectedDigest });
}

function parseApplyOptions(raw: unknown): ApplyCandidateDeltaOptions {
  const options = snapshot(raw, "candidate_delta_application_options");
  exact(
    options,
    ["now", "expected_scope", "prior_recorded_replay_keys"],
    "candidate_delta_application_options",
  );
  const now = parseTimestamp(options.now, "candidate_delta_application_options.now");
  const expectedScope = parseScope(
    options.expected_scope,
    "candidate_delta_application_options.expected_scope",
  );
  let recorded: StrictJsonValue[];
  try {
    recorded = strictJsonArray(
      options.prior_recorded_replay_keys,
      "candidate_delta_application_options.prior_recorded_replay_keys",
      1_000,
    );
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const value of recorded) {
    if (typeof value !== "string" || !CANONICAL_SHA256.test(value)) {
      refuse("prior replay-key snapshot must contain exact replay keys only");
    }
    if (seen.has(value)) refuse("prior replay-key snapshot contains duplicate keys");
    seen.add(value);
    keys.push(value);
  }
  return { now, expected_scope: expectedScope, prior_recorded_replay_keys: keys };
}

function buildTransitionCore(
  delta: CandidateDelta,
  baseCandidate: ValidatedCandidate,
  candidate: ValidatedCandidate,
  qualityGate: QualityGateReport,
): CandidateTransitionCore {
  const qualityGateSnapshot = strictSnapshot(
    qualityGate,
    "candidate_transition.quality_gate",
  ) as unknown as QualityGateReport;
  return {
    kind: CANDIDATE_TRANSITION_KIND,
    version: CANDIDATE_TRANSITION_VERSION,
    producer: delta.producer,
    scope: delta.scope,
    created_at: delta.created_at,
    expires_at: delta.expires_at,
    delta,
    base_candidate: baseCandidate,
    candidate_sha256: validatedCandidateSha256(candidate),
    candidate,
    quality_gate: qualityGateSnapshot,
    replay_key_to_record: delta.replay_key,
    replay_protection: {
      caller_snapshot_required: true,
      caller_must_record_key: true,
      cross_process_durable_protection: false,
    },
    source_assurances: delta.source_assurances,
    fixture_binding: delta.fixture_binding,
    authority: transitionAuthority(),
  };
}

function assertProspectiveTransitionRepresentable(
  delta: CandidateDelta,
  baseCandidate: ValidatedCandidate,
  candidate: ValidatedCandidate,
  qualityGate: QualityGateReport,
): void {
  const core = buildTransitionCore(
    delta,
    baseCandidate,
    candidate,
    qualityGate,
  );
  try {
    // Hydration snapshots the complete serialized transition, not only the
    // hash input. Include a canonical digest-shaped placeholder so delta
    // creation cannot accept a core that fits while its required final digest
    // pushes the hydrated transition over a cumulative limit.
    snapshotStrictJson(
      { ...core, transition_sha256: "0".repeat(64) },
      "prospective_candidate_transition",
      LIMITS,
    );
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) {
      refuse(`prospective transition representability budget failed: ${error.message}`);
    }
    throw error;
  }
}

function makeTransition(
  delta: CandidateDelta,
  baseCandidate: ValidatedCandidate,
  candidate: ValidatedCandidate,
  qualityGate: QualityGateReport,
): CandidateTransition {
  const core = buildTransitionCore(
    delta,
    baseCandidate,
    candidate,
    qualityGate,
  );
  const transitionSha256 = sha256CanonicalJson(
    strictSnapshot(core, "candidate_transition"),
  );
  return deepFreezeOwnData({ ...core, transition_sha256: transitionSha256 });
}

export function applyCandidateDelta(
  rawEnvelope: unknown,
  rawDelta: unknown,
  rawBase: unknown,
  rawOptions: unknown,
): CandidateTransition {
  const envelope = hydrateProposalEnvelope(rawEnvelope);
  const delta = hydrateCandidateDelta(rawDelta);
  const base = hydrateCandidate(rawBase, "base candidate");
  const options = parseApplyOptions(rawOptions);

  assertLive(delta.created_at, delta.expires_at, options.now, "candidate delta");
  assertLive(envelope.created_at, envelope.expires_at, options.now, "proposal envelope");
  if (!sameScope(envelope.scope, delta.scope) || !sameScope(delta.scope, options.expected_scope)) {
    refuse("team/account/subject/purpose scope mismatch or cross-scope reuse");
  }
  if (
    base.subject.team_id !== options.expected_scope.team_id ||
    base.subject.account_id !== options.expected_scope.account_id
  ) {
    refuse("base candidate is outside the expected scope");
  }
  const baseDigest = validatedCandidateSha256(base);
  if (delta.base_candidate_sha256 !== baseDigest) {
    refuse("base candidate digest is stale, wrong, or mutated");
  }
  if (delta.envelope_sha256 !== envelope.envelope_sha256) {
    refuse("candidate delta is bound to a different envelope");
  }
  if (options.prior_recorded_replay_keys.includes(delta.replay_key)) {
    refuse("candidate delta replay key is already present in the prior snapshot");
  }

  const mergedBundle = graphMerge(base.graph_bundle, delta.records);
  assertMergedCandidateComposition(mergedBundle);
  const candidate = validateCandidate(
    mergedBundle,
    {
      team_id: delta.scope.team_id,
      account_id: delta.scope.account_id,
    },
    "fully merged candidate",
  );
  const qualityGate = runCandidateQualityGate(candidate.graph_bundle);
  if (qualityGate.status === "fail") {
    refuse("fully merged candidate failed the deterministic quality gate");
  }
  if (qualityGate.status !== delta.quality_gate_status) {
    refuse("candidate delta quality status does not match the fully merged candidate");
  }
  if (qualityGateReportSha256(qualityGate) !== delta.quality_gate_report_sha256) {
    refuse(
      "candidate delta has exact quality-gate report identity drift for the fully merged candidate",
    );
  }

  const expectedDelta = createCandidateDelta(envelope, base, options.now);
  if (
    expectedDelta.delta_sha256 !== delta.delta_sha256 ||
    canonicalJson(strictSnapshot(expectedDelta, "expected_delta")) !==
      canonicalJson(strictSnapshot(delta, "candidate_delta"))
  ) {
    refuse("candidate delta does not exactly match deterministic envelope/base derivation");
  }
  return makeTransition(delta, base, candidate, qualityGate);
}

export function hydrateCandidateTransition(
  rawEnvelope: unknown,
  rawTransition: unknown,
  rawOptions: unknown,
): CandidateTransition {
  const root = snapshot(rawTransition, "candidate_transition");
  exact(root, [...TRANSITION_CORE_KEYS, "transition_sha256"], "candidate_transition");
  const expected = applyCandidateDelta(
    rawEnvelope,
    root.delta,
    root.base_candidate,
    rawOptions,
  );
  if (
    canonicalJson(root) !==
    canonicalJson(strictSnapshot(expected, "expected_candidate_transition"))
  ) {
    refuse(
      "candidate transition does not exactly match deterministic envelope/base application",
    );
  }
  return expected;
}
