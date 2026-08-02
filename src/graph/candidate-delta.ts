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
  readonly newly_consumed_key_returned: true;
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
  readonly consumed_replay_key: string;
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
  readonly consumed_replay_keys: readonly string[];
}

export class CandidateDeltaBoundaryError extends Error {
  constructor(detail: string) {
    super(`Candidate delta refused: ${detail}`);
    this.name = "CandidateDeltaBoundaryError";
  }
}

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_000,
  max_depth: 16,
  max_nodes: 20_000,
  max_object_fields: 128,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes: 12 * 1024 * 1024,
});

const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;
const SAFE_TEAM_ID = /^team_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_ACCOUNT_ID = /^acc_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
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
  "consumed_replay_key",
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
  const canonical = parsed.toISOString();
  if (canonical !== value && canonical.replace(".000Z", "Z") !== value) {
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
    !SAFE_OPAQUE_ID.test(producer.trace_id)
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
  assertProposalDerivedRecordsUnverified(bundle);
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
  const candidate = hydrateValidatedCandidate(raw);
  const candidateSnapshot = snapshotStrictJson(candidate, "candidate", LIMITS);
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

function buildCandidateDeltaCore(
  envelope: ProposalEnvelope,
  base: ValidatedCandidate,
): CandidateDeltaCore {
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
  createValidatedCandidate(records, {
    team_id: envelope.scope.team_id,
    account_id: envelope.scope.account_id,
  });
  const candidate = createValidatedCandidate(graphMerge(base.graph_bundle, records), {
    team_id: envelope.scope.team_id,
    account_id: envelope.scope.account_id,
  });
  const qualityGate = runQualityGate(candidate.graph_bundle);
  if (qualityGate.status === "fail") {
    refuse("fully merged candidate failed the deterministic quality gate");
  }
  return {
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
    replay_key: replayKey(envelope.envelope_sha256, baseCandidateSha256),
    source_assurances: envelope.source_assurances,
    fixture_binding: envelope.fixture_binding,
    authority: deltaAuthority(),
  };
}

export function createCandidateDelta(
  rawEnvelope: unknown,
  rawBase: unknown,
  now: string,
): CandidateDelta {
  const envelope = hydrateProposalEnvelope(rawEnvelope);
  const base = hydrateValidatedCandidate(rawBase);
  assertLive(envelope.created_at, envelope.expires_at, now, "proposal envelope");
  const core = buildCandidateDeltaCore(envelope, base);
  const deltaSha256 = sha256CanonicalJson(
    snapshotStrictJson(core, "candidate_delta", LIMITS),
  );
  return deepFreezeOwnData({ ...core, delta_sha256: deltaSha256 });
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
  const records = createValidatedCandidate(root.records, {
    team_id: scope.team_id,
    account_id: scope.account_id,
  }).graph_bundle;
  assertProposalDerivedRecordsUnverified(records);
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
    snapshotStrictJson(core, "candidate_delta", LIMITS),
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
    ["now", "expected_scope", "consumed_replay_keys"],
    "candidate_delta_application_options",
  );
  const now = parseTimestamp(options.now, "candidate_delta_application_options.now");
  const expectedScope = parseScope(
    options.expected_scope,
    "candidate_delta_application_options.expected_scope",
  );
  let consumed: StrictJsonValue[];
  try {
    consumed = strictJsonArray(
      options.consumed_replay_keys,
      "candidate_delta_application_options.consumed_replay_keys",
      1_000,
    );
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const value of consumed) {
    if (typeof value !== "string" || !CANONICAL_SHA256.test(value)) {
      refuse("consumed replay snapshot must contain exact replay keys only");
    }
    if (seen.has(value)) refuse("consumed replay snapshot contains duplicate keys");
    seen.add(value);
    keys.push(value);
  }
  return { now, expected_scope: expectedScope, consumed_replay_keys: keys };
}

function makeTransition(
  delta: CandidateDelta,
  baseCandidate: ValidatedCandidate,
  candidate: ValidatedCandidate,
  qualityGate: QualityGateReport,
): CandidateTransition {
  const core: CandidateTransitionCore = {
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
    quality_gate: qualityGate,
    consumed_replay_key: delta.replay_key,
    replay_protection: {
      caller_snapshot_required: true,
      newly_consumed_key_returned: true,
      cross_process_durable_protection: false,
    },
    source_assurances: delta.source_assurances,
    fixture_binding: delta.fixture_binding,
    authority: transitionAuthority(),
  };
  const transitionSha256 = sha256CanonicalJson(
    snapshotStrictJson(core, "candidate_transition", LIMITS),
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
  const base = hydrateValidatedCandidate(rawBase);
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
  if (options.consumed_replay_keys.includes(delta.replay_key)) {
    refuse("candidate delta replay key has already been consumed");
  }

  const expectedDelta = createCandidateDelta(envelope, base, options.now);
  if (
    expectedDelta.delta_sha256 !== delta.delta_sha256 ||
    canonicalJson(snapshotStrictJson(expectedDelta, "expected_delta", LIMITS)) !==
      canonicalJson(snapshotStrictJson(delta, "candidate_delta", LIMITS))
  ) {
    refuse("candidate delta does not exactly match deterministic envelope/base derivation");
  }

  const candidate = createValidatedCandidate(
    graphMerge(base.graph_bundle, delta.records),
    {
      team_id: delta.scope.team_id,
      account_id: delta.scope.account_id,
    },
  );
  const qualityGate = runQualityGate(candidate.graph_bundle);
  if (qualityGate.status === "fail") {
    refuse("fully merged candidate failed the deterministic quality gate");
  }
  if (qualityGate.status !== delta.quality_gate_status) {
    refuse("candidate delta quality status does not match the fully merged candidate");
  }
  return makeTransition(delta, base, candidate, qualityGate);
}

function ensureDeltaRecordsAreInCandidate(delta: GraphBundle, candidate: GraphBundle): void {
  for (const key of [
    "sources",
    "excerpts",
    "claims",
    "claim_evidence",
    "account_objects",
    "account_object_claims",
    "research_runs",
    "run_artifacts",
    "audit_events",
  ] as const) {
    const candidates = new Map(
      candidate[key].map((record) => [record.id, record] as const),
    );
    for (const record of delta[key]) {
      const candidateRecord = candidates.get(record.id);
      if (
        candidateRecord === undefined ||
        canonicalJson(snapshotStrictJson(candidateRecord, "candidate_record", LIMITS)) !==
          canonicalJson(snapshotStrictJson(record, "delta_record", LIMITS))
      ) {
        refuse(`candidate transition does not contain the exact delta ${key} record`);
      }
    }
  }
}

export function hydrateCandidateTransition(raw: unknown, now: string): CandidateTransition {
  const root = snapshot(raw, "candidate_transition");
  exact(root, [...TRANSITION_CORE_KEYS, "transition_sha256"], "candidate_transition");
  if (
    root.kind !== CANDIDATE_TRANSITION_KIND ||
    root.version !== CANDIDATE_TRANSITION_VERSION
  ) {
    refuse("candidate transition kind/version is unsupported");
  }
  if (
    typeof root.transition_sha256 !== "string" ||
    !CANONICAL_SHA256.test(root.transition_sha256)
  ) {
    refuse("candidate_transition.transition_sha256 is malformed or missing");
  }
  const delta = hydrateCandidateDelta(root.delta);
  const producer = parseProducer(root.producer, "candidate_transition.producer");
  const scope = parseScope(root.scope, "candidate_transition.scope");
  const createdAt = parseTimestamp(root.created_at, "candidate_transition.created_at");
  const expiresAt = parseTimestamp(root.expires_at, "candidate_transition.expires_at");
  assertLive(createdAt, expiresAt, now, "candidate transition");
  if (
    producer.kind !== delta.producer.kind ||
    producer.trace_id !== delta.producer.trace_id ||
    !sameScope(scope, delta.scope) ||
    createdAt !== delta.created_at ||
    expiresAt !== delta.expires_at
  ) {
    refuse("candidate transition metadata does not match its delta");
  }
  const baseCandidate = hydrateValidatedCandidate(root.base_candidate);
  if (validatedCandidateSha256(baseCandidate) !== delta.base_candidate_sha256) {
    refuse("candidate transition base-candidate digest mismatch");
  }
  const candidate = hydrateValidatedCandidate(root.candidate);
  if (
    candidate.subject.team_id !== scope.team_id ||
    candidate.subject.account_id !== scope.account_id
  ) {
    refuse("candidate transition candidate is outside the transition scope");
  }
  if (
    typeof root.candidate_sha256 !== "string" ||
    root.candidate_sha256 !== validatedCandidateSha256(candidate)
  ) {
    refuse("candidate transition candidate digest mismatch");
  }
  const expectedCandidate = createValidatedCandidate(
    graphMerge(baseCandidate.graph_bundle, delta.records),
    { team_id: scope.team_id, account_id: scope.account_id },
  );
  if (
    canonicalJson(snapshotStrictJson(expectedCandidate, "expected_candidate", LIMITS)) !==
    canonicalJson(snapshotStrictJson(candidate, "candidate", LIMITS))
  ) {
    refuse("candidate transition is not the exact fully merged base+delta result");
  }
  ensureDeltaRecordsAreInCandidate(delta.records, candidate.graph_bundle);

  const qualityGate = runQualityGate(candidate.graph_bundle);
  if (qualityGate.status === "fail" || qualityGate.status !== delta.quality_gate_status) {
    refuse("candidate transition quality gate is failing or inconsistent");
  }
  if (
    canonicalJson(snapshotStrictJson(root.quality_gate, "candidate_transition.quality_gate", LIMITS)) !==
    canonicalJson(snapshotStrictJson(qualityGate, "recomputed_quality_gate", LIMITS))
  ) {
    refuse("candidate transition quality-gate report mismatch");
  }
  if (root.consumed_replay_key !== delta.replay_key) {
    refuse("candidate transition consumed replay key mismatch");
  }
  const replayProtection = asObject(
    root.replay_protection,
    "candidate_transition.replay_protection",
  );
  exact(
    replayProtection,
    ["caller_snapshot_required", "newly_consumed_key_returned", "cross_process_durable_protection"],
    "candidate_transition.replay_protection",
  );
  if (
    replayProtection.caller_snapshot_required !== true ||
    replayProtection.newly_consumed_key_returned !== true ||
    replayProtection.cross_process_durable_protection !== false
  ) {
    refuse("candidate transition replay-protection claims are invalid");
  }
  const assurances = parseAssurances(
    root.source_assurances,
    "candidate_transition.source_assurances",
  );
  const fixtureBinding = parseFixtureBinding(
    root.fixture_binding,
    producer,
    "candidate_transition.fixture_binding",
  );
  if (
    canonicalJson(snapshotStrictJson(assurances, "assurances", LIMITS)) !==
      canonicalJson(snapshotStrictJson(delta.source_assurances, "delta_assurances", LIMITS)) ||
    canonicalJson(snapshotStrictJson(fixtureBinding, "fixture_binding", LIMITS)) !==
      canonicalJson(snapshotStrictJson(delta.fixture_binding, "delta_fixture_binding", LIMITS))
  ) {
    refuse("candidate transition assurance/binding metadata does not match its delta");
  }
  const authority = parseTransitionAuthority(
    root.authority,
    "candidate_transition.authority",
  );
  const core: CandidateTransitionCore = {
    kind: CANDIDATE_TRANSITION_KIND,
    version: CANDIDATE_TRANSITION_VERSION,
    producer,
    scope,
    created_at: createdAt,
    expires_at: expiresAt,
    delta,
    base_candidate: baseCandidate,
    candidate_sha256: root.candidate_sha256,
    candidate,
    quality_gate: qualityGate,
    consumed_replay_key: delta.replay_key,
    replay_protection: {
      caller_snapshot_required: true,
      newly_consumed_key_returned: true,
      cross_process_durable_protection: false,
    },
    source_assurances: assurances,
    fixture_binding: fixtureBinding,
    authority,
  };
  const expectedDigest = sha256CanonicalJson(
    snapshotStrictJson(core, "candidate_transition", LIMITS),
  );
  if (root.transition_sha256 !== expectedDigest) {
    refuse("candidate transition integrity digest mismatch");
  }
  return deepFreezeOwnData({ ...core, transition_sha256: expectedDigest });
}
