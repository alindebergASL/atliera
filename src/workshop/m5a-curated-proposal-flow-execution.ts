// M5a Step 4 — one-shot, no-provider-call curated proposal-flow capstone.
//
// The executor accepts one Step-3 arming over its matching Step-2 packet and
// Step-1 contract, materializes one committed hand-curated proposal set,
// ratifies the complete validated bundle, atomically appends one local graph
// snapshot row, reads that row back through the shipped durable reader, and
// renders one Workshop artifact from the read-back bundle.

import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { inspectLocalDurableDb } from "../db/local-durable-db.ts";
import {
  acquireGraphSnapshotWriteLock,
  canonicalGraphSnapshotDbRootPath,
  releaseGraphSnapshotWriteLockBestEffort,
} from "../db/graph-snapshot-write-lock.ts";
import { parseGraphBundle } from "../graph/schema.ts";
import type { AuditEvent, GraphBundle, RunArtifact } from "../graph/types.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import {
  materializeProposalForValidation,
  type MaterializeProposalForValidationInput,
  type ProposalMaterializationArtifact,
} from "../validation/proposal-materialization.ts";
import { readWorkshopPublicProposalDurableGraphSnapshots } from "./durable-graph-snapshots-reader.ts";
import {
  M5A_PINNED_CURATION_ORIGIN,
  M5A_PINNED_MEDIATION_GATE_LEVEL,
  M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
  M5A_PINNED_ROW_TRUST_LABEL,
  M5A_PINNED_TARGET_STORE,
  M5aContractBuilderRefusal,
  requireCanonicalIsoTimestamp,
  snapshotPlainArray,
  snapshotPlainOwnData,
  verifyM5aCuratedProposalFlowContract,
  type M5aCuratedProposalFlowContractArtifact,
  type M5aFlowSuccessCriterion,
  type M5aFlowStageKind,
} from "./m5a-curated-proposal-flow-contract.ts";
import {
  M5aApprovalPacketRefusal,
  verifyM5aCuratedProposalFlowApprovalPacket,
  type M5aCuratedProposalFlowApprovalPacketArtifact,
} from "./m5a-curated-proposal-flow-approval-packet.ts";
import {
  M5aOperatorArmingRefusal,
  verifyM5aCuratedProposalFlowOperatorArming,
  type M5aCuratedProposalFlowOperatorArmingArtifact,
} from "./m5a-curated-proposal-flow-operator-arming.ts";

import {
  renderWorkshopHtml,
  WORKSHOP_CURATED_PUBLIC_SOURCE_LABEL,
  WORKSHOP_CURATED_PUBLIC_SOURCE_ORIGIN,
} from "./render-html.ts";
import {
  ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
  ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
  type DurableGraphSnapshotRow,
} from "./proposal-durable-graph-write-execution.ts";
import { buildWorkshopViewModel, type WorkshopViewModel } from "./view-model.ts";

export const M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME =
  "m5a-curated-proposal-flow-execution-outcome" as const;
export const M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION =
  "atliera.m5a_curated_proposal_flow_execution_outcome.v1" as const;

// Fixture-bound authority for this intentionally single-fixture capstone.
// Steps 1-3 IDs do not contain this digest and are not represented as doing so.
export const M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256 =
  "21ee88262f9e27d03ce3f37064f5728b8207aa2fb04e3be54bec2495b33caed9" as const;

const GRAPH_SNAPSHOTS_RELATIVE_PATH = "tables/graph_snapshots.jsonl";
const TEMP_SUFFIX = ".m5a-step4.tmp";
const MAX_SNAPSHOT_DEPTH = 24;
const MAX_SNAPSHOT_NODES = 20_000;

const STAGE_ORDER = Object.freeze([
  "materialize",
  "validate",
  "ratify",
  "durable_write",
  "render",
] as const satisfies readonly M5aFlowStageKind[]);

export type M5aCuratedProposalFlowExecutionRefusalCode =
  | "input_invalid"
  | "authorization_invalid"
  | "authorization_expired"
  | "recorded_proposal_digest_mismatch"
  | "materialization_refused"
  | "proposal_set_invalid"
  | "durable_db_invalid"
  | "durable_state_invalid"
  | "one_shot_replay"
  | "durable_record_id_conflict"
  | "lock_busy"
  | "transaction_aborted";

export type M5aCuratedProposalFlowCommittedFailureCode =
  | "post_commit_read_back_failed"
  | "post_commit_row_mismatch"
  | "post_commit_view_model_failed"
  | "post_commit_render_failed"
  | "post_commit_success_criterion_failed";

export interface M5aCuratedProposalFlowExecutionOptions {
  readonly contract: unknown;
  readonly approvalPacket: unknown;
  readonly arming: unknown;
  readonly materializationInput: unknown;
  readonly dbRootDir: unknown;
  readonly now: unknown;
}

export interface M5aCuratedProposalFlowExecutionRefusedOutcome {
  readonly outcome: "refused";
  readonly outcome_artifact_name: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME;
  readonly schema_version: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION;
  readonly refusal_code: M5aCuratedProposalFlowExecutionRefusalCode;
  readonly refusal_detail: string;
  readonly checked_at: string | null;
  readonly provider_calls_made: 0;
  readonly acquisition_operations: 0;
  readonly private_evidence_reads: 0;
  readonly retry_attempts: 0;
  readonly production_writes: 0;
  readonly durable_writes_performed: false;
  readonly durable_read_backs_performed: false;
  readonly rendered_artifacts: 0;
  readonly readiness_claim: false;
}

export interface M5aCuratedProposalFlowExecutionCompletedOutcome {
  readonly outcome: "completed";
  readonly outcome_artifact_name: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME;
  readonly schema_version: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION;
  readonly flow_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly contract_artifact_id: string;
  readonly packet_artifact_id: string;
  readonly arming_artifact_id: string;
  readonly operator_identity: string;
  readonly one_shot_consumption_key: string;
  readonly materialization_input_sha256: typeof M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256;
  readonly durable_record_id: string;
  readonly written_at: string;
  readonly mediation_gate_level: typeof M5A_PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof M5A_PINNED_TARGET_STORE;
  readonly stage_order: typeof STAGE_ORDER;
  readonly counts: {
    readonly curated_proposal_flows: 1;
    readonly proposal_sets: 1;
    readonly durable_transactions: 1;
    readonly durable_rows_written: 1;
    readonly durable_read_backs: 1;
    readonly rendered_artifacts: 1;
    readonly ratified_durable_records: number;
    readonly populated_lenses: number;
    readonly rendered_cards: number;
    readonly curated_labeled_cards: number;
  };
  readonly boundaries: {
    readonly provider_calls_made: 0;
    readonly fresh_provider_calls: 0;
    readonly acquisition_operations: 0;
    readonly private_evidence_reads: 0;
    readonly retry_attempts: 0;
    readonly production_writes: 0;
    readonly readiness_claim: false;
  };
  readonly durable_write_performed: true;
  readonly durable_read_back_performed: true;
  readonly rendered_from_durable_state: true;
  readonly rendered_artifact: {
    readonly media_type: "text/html";
    readonly html: string;
  };
}

export interface M5aCuratedProposalFlowExecutionCommittedUnrenderedOutcome {
  readonly outcome: "committed_unrendered";
  readonly outcome_artifact_name: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME;
  readonly schema_version: typeof M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION;
  readonly failure_code: M5aCuratedProposalFlowCommittedFailureCode;
  readonly flow_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly contract_artifact_id: string;
  readonly packet_artifact_id: string;
  readonly arming_artifact_id: string;
  readonly operator_identity: string;
  readonly one_shot_consumption_key: string;
  readonly materialization_input_sha256: typeof M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256;
  readonly durable_record_id: string;
  readonly written_at: string;
  readonly mediation_gate_level: typeof M5A_PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof M5A_PINNED_TARGET_STORE;
  readonly l0_effect_observed: true;
  readonly durable_write_performed: true;
  readonly durable_read_back_attempted: true;
  readonly durable_read_back_succeeded: boolean;
  readonly render_attempted: boolean;
  readonly render_succeeded: boolean;
  readonly rendered_from_durable_state: boolean;
  readonly rendered_artifacts: 0;
  readonly boundaries: {
    readonly provider_calls_made: 0;
    readonly fresh_provider_calls: 0;
    readonly acquisition_operations: 0;
    readonly private_evidence_reads: 0;
    readonly retry_attempts: 0;
    readonly production_writes: 0;
    readonly readiness_claim: false;
  };
}

export type M5aCuratedProposalFlowExecutionOutcome =
  | M5aCuratedProposalFlowExecutionRefusedOutcome
  | M5aCuratedProposalFlowExecutionCommittedUnrenderedOutcome
  | M5aCuratedProposalFlowExecutionCompletedOutcome;

class ExecutionBoundaryRefusal extends Error {}

function refused(
  code: M5aCuratedProposalFlowExecutionRefusalCode,
  checkedAt: string | null,
): M5aCuratedProposalFlowExecutionRefusedOutcome {
  const details: Record<M5aCuratedProposalFlowExecutionRefusalCode, string> = {
    input_invalid: "execution input failed the bounded own-data snapshot",
    authorization_invalid: "contract, packet, and arming authorization did not verify",
    authorization_expired: "one-shot authorization is not live at execution time",
    recorded_proposal_digest_mismatch: "materialization input does not match the committed capstone fixture digest",
    materialization_refused: "recorded curated proposal materialization was refused",
    proposal_set_invalid: "materialized proposal set failed identity, count, or graph validation",
    durable_db_invalid: "target does not satisfy the inspected Atliera local durable DB contract",
    durable_state_invalid: "existing or read-back durable state failed closed validation",
    one_shot_replay: "one-shot consumption key has already been consumed",
    durable_record_id_conflict: "canonical durable record identity is already present",
    lock_busy: "durable graph snapshot transaction lock is busy or stale",
    transaction_aborted: "durable transaction aborted before commit",
  };
  return Object.freeze({
    outcome: "refused" as const,
    outcome_artifact_name: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME,
    schema_version: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION,
    refusal_code: code,
    refusal_detail: details[code],
    checked_at: checkedAt,
    provider_calls_made: 0 as const,
    acquisition_operations: 0 as const,
    private_evidence_reads: 0 as const,
    retry_attempts: 0 as const,
    production_writes: 0 as const,
    durable_writes_performed: false as const,
    durable_read_backs_performed: false as const,
    rendered_artifacts: 0 as const,
    readiness_claim: false as const,
  });
}

function exactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new ExecutionBoundaryRefusal("canonical JSON input contains a non-JSON value");
}

function sha256M5aMaterializationInputSnapshot(snapshot: unknown): string {
  return createHash("sha256").update(canonicalJson(snapshot), "utf8").digest("hex");
}

export function canonicalM5aCuratedProposalFlowDurableRecordId(
  oneShotConsumptionKey: string,
  materializationInputSha256: string,
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([oneShotConsumptionKey, materializationInputSha256]), "utf8")
    .digest("hex")
    .slice(0, 40);
  return `m5a-flow:${digest}`;
}

function zeroEffectBoundaries() {
  return Object.freeze({
    provider_calls_made: 0 as const,
    fresh_provider_calls: 0 as const,
    acquisition_operations: 0 as const,
    private_evidence_reads: 0 as const,
    retry_attempts: 0 as const,
    production_writes: 0 as const,
    readiness_claim: false as const,
  });
}

interface SnapshotBudget { nodes: number }

// Reuses the Step-1 hardened snapshot helpers recursively so the shipped
// verifiers and materializer receive frozen data-only snapshots, never the
// caller's objects. Proxy/accessor/symbol inputs are rejected before their
// traps or getters can supply a value.
function snapshotBoundedValue(
  value: unknown,
  label: string,
  budget: SnapshotBudget,
  depth = 0,
): unknown {
  if (depth > MAX_SNAPSHOT_DEPTH || budget.nodes >= MAX_SNAPSHOT_NODES) {
    throw new ExecutionBoundaryRefusal(`${label} exceeds snapshot bounds`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") {
    throw new ExecutionBoundaryRefusal(`${label} contains a non-data value`);
  }
  budget.nodes += 1;
  try {
    if (Array.isArray(value)) {
      const raw = snapshotPlainArray(value, label);
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new ExecutionBoundaryRefusal(`${label} must use Array.prototype`);
      }
      return Object.freeze(
        raw.map((item, index) => snapshotBoundedValue(item, `${label}[${index}]`, budget, depth + 1)),
      );
    }
    const raw = snapshotPlainOwnData(value, label);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ExecutionBoundaryRefusal(`${label} must use a plain object prototype`);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      Object.defineProperty(out, key, {
        value: snapshotBoundedValue(raw[key], `${label}.${key}`, budget, depth + 1),
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(out);
  } catch (error) {
    if (error instanceof M5aContractBuilderRefusal || error instanceof ExecutionBoundaryRefusal) {
      throw new ExecutionBoundaryRefusal(`${label} failed own-data snapshot`);
    }
    throw error;
  }
}

function snapshotRootOptions(options: unknown): Readonly<Record<string, unknown>> {
  const snap = snapshotBoundedValue(options, "options", { nodes: 0 });
  if (snap === null || typeof snap !== "object" || Array.isArray(snap)) {
    throw new ExecutionBoundaryRefusal("options must be an object");
  }
  const record = snap as Readonly<Record<string, unknown>>;
  if (!exactKeys(record, [
    "contract",
    "approvalPacket",
    "arming",
    "materializationInput",
    "dbRootDir",
    "now",
  ])) {
    throw new ExecutionBoundaryRefusal("options keys are not exact");
  }
  return record;
}

function checkedTimestamp(value: unknown): string {
  try {
    return requireCanonicalIsoTimestamp(value, "options.now");
  } catch {
    throw new ExecutionBoundaryRefusal("now is invalid");
  }
}

function assertExecutionPins(
  contract: M5aCuratedProposalFlowContractArtifact,
  packet: M5aCuratedProposalFlowApprovalPacketArtifact,
  arming: M5aCuratedProposalFlowOperatorArmingArtifact,
): void {
  if (
    packet.references_contract_artifact_id !== contract.contract_artifact_id ||
    arming.references_contract_artifact_id !== contract.contract_artifact_id ||
    arming.packet_artifact_id !== packet.packet_artifact_id ||
    packet.proposal_set_id !== contract.proposal_set_id ||
    arming.proposal_set_id !== contract.proposal_set_id ||
    packet.account_id !== contract.account_id ||
    arming.account_id !== contract.account_id
  ) {
    throw new ExecutionBoundaryRefusal("authorization tuple mismatch");
  }
  if (
    packet.flow_constraints.max_flow_executions !== 1 ||
    packet.flow_constraints.retry_budget !== 0 ||
    arming.boundaries.max_flow_executions_authorized !== 1 ||
    arming.boundaries.remaining_flow_executions !== 1 ||
    arming.boundaries.retry_budget !== 0 ||
    packet.flow_constraints.forbids_fresh_provider_call_on_flow_path !== true ||
    packet.flow_constraints.forbids_system_side_acquisition !== true ||
    packet.eventual_authorization.authorizes_provider_call !== false ||
    packet.eventual_authorization.authorizes_system_side_acquisition !== false ||
    packet.eventual_authorization.authorizes_private_evidence_read !== false ||
    arming.boundaries.authorizes_provider_call !== false ||
    arming.boundaries.authorizes_system_side_acquisition !== false ||
    arming.boundaries.authorizes_private_evidence_read !== false ||
    packet.trust_tier_pins.required_row_trust_label !== M5A_PINNED_ROW_TRUST_LABEL ||
    packet.trust_tier_pins.required_per_record_provenance_status !==
      M5A_PINNED_PER_RECORD_PROVENANCE_STATUS ||
    arming.trust_tier_pins.required_row_trust_label !== M5A_PINNED_ROW_TRUST_LABEL ||
    arming.trust_tier_pins.required_per_record_provenance_status !==
      M5A_PINNED_PER_RECORD_PROVENANCE_STATUS ||
    arming.target_store !== M5A_PINNED_TARGET_STORE ||
    arming.recorded_proposal_source_origin !== M5A_PINNED_CURATION_ORIGIN
  ) {
    throw new ExecutionBoundaryRefusal("execution boundary pins broadened");
  }
}

function countsAreZero(artifact: ProposalMaterializationArtifact): boolean {
  return Object.values(artifact.rejected_counts).every((count) => count === 0);
}

function assertMaterializationInputShape(input: unknown): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ExecutionBoundaryRefusal("materialization root invalid");
  }
  const root = input as Readonly<Record<string, unknown>>;
  if (!exactKeys(root, [
    "context",
    "public_sources",
    "proposed_excerpts",
    "proposed_claims",
    "proposed_account_objects",
  ])) {
    throw new ExecutionBoundaryRefusal("materialization root keys invalid");
  }
  const context = root.context as Readonly<Record<string, unknown>>;
  if (!exactKeys(context, ["origin", "team_id", "account_id", "materialized_at", "proposal_set_id"])) {
    throw new ExecutionBoundaryRefusal("materialization context keys invalid");
  }
  const shapes = [
    [root.public_sources, [
      "id", "team_id", "account_id", "url", "canonical_url", "title", "publisher",
      "source_type", "fetched_at", "accessed_at", "content_hash", "raw_text", "reliability", "status",
    ]],
    [root.proposed_excerpts, ["proposal_id", "source_document_id", "quote"]],
    [root.proposed_claims, [
      "proposal_id", "claim_type", "text", "normalized_subject", "confidence",
      "supporting_excerpt_proposal_ids",
    ]],
    [root.proposed_account_objects, [
      "proposal_id", "object_type", "title", "summary", "supporting_claim_proposal_ids",
    ]],
  ] as const;
  for (const [value, keys] of shapes) {
    if (!Array.isArray(value)) throw new ExecutionBoundaryRefusal("materialization array invalid");
    for (const item of value) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new ExecutionBoundaryRefusal("materialization record invalid");
      }
      if (!exactKeys(item as Readonly<Record<string, unknown>>, keys)) {
        throw new ExecutionBoundaryRefusal("materialization record keys invalid");
      }
    }
  }
}

function validateMaterializationAlignment(
  artifact: ProposalMaterializationArtifact,
  contract: M5aCuratedProposalFlowContractArtifact,
): void {
  if (
    artifact.origin !== M5A_PINNED_CURATION_ORIGIN ||
    artifact.proposal_set_id !== contract.proposal_set_id ||
    artifact.account_id !== contract.account_id ||
    artifact.materialized_at !== contract.materialized_at ||
    artifact.boundaries.provider_calls_executed !== 0 ||
    artifact.boundaries.authorizes_provider_call !== false ||
    artifact.boundaries.authorizes_private_evidence_read !== false ||
    artifact.boundaries.authorizes_graph_ingestion !== false ||
    artifact.boundaries.durable_writes_performed !== false ||
    artifact.boundaries.production_writes !== false ||
    artifact.boundaries.readiness_claim !== false ||
    !countsAreZero(artifact) ||
    artifact.accepted_counts.sources !== contract.counts.curated_source_count ||
    artifact.accepted_counts.excerpts !== contract.counts.proposed_excerpt_count ||
    artifact.accepted_counts.claims !== contract.counts.proposed_claim_count ||
    artifact.accepted_counts.account_objects !== contract.counts.proposed_account_object_count ||
    artifact.dispositions.some((item) => item.disposition !== "accepted") ||
    artifact.bundle_validation.ok !== true
  ) {
    throw new ExecutionBoundaryRefusal("materialization alignment failed");
  }
  const parsed = parseGraphBundle(artifact.bundle_candidate);
  if (!parsed.ok || !validateGraphBundle(parsed.value, { mode: "validation" }).ok) {
    throw new ExecutionBoundaryRefusal("materialized graph bundle invalid");
  }
}

function ratifyBundle(
  artifact: ProposalMaterializationArtifact,
  contract: M5aCuratedProposalFlowContractArtifact,
  packet: M5aCuratedProposalFlowApprovalPacketArtifact,
  arming: M5aCuratedProposalFlowOperatorArmingArtifact,
  materializationInputSha256: typeof M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
  now: string,
): GraphBundle {
  const run = artifact.bundle_candidate.research_runs[0];
  if (run === undefined) throw new ExecutionBoundaryRefusal("materialization research run missing");
  const runArtifact: RunArtifact = {
    id: `art_m5a_${contract.proposal_set_id}`,
    research_run_id: run.id,
    artifact_type: "m5a_curated_proposal_set_ratification",
    payload_json: {
      contract_artifact_id: contract.contract_artifact_id,
      packet_artifact_id: packet.packet_artifact_id,
      arming_artifact_id: arming.arming_artifact_id,
      proposal_set_id: contract.proposal_set_id,
      origin: M5A_PINNED_CURATION_ORIGIN,
      materialization_input_sha256: materializationInputSha256,
    },
    created_at: now,
  };
  const auditEvent: AuditEvent = {
    id: `aud_m5a_${contract.proposal_set_id}`,
    team_id: artifact.team_id,
    actor_type: "user",
    actor_id: arming.armed_by,
    event_type: "proposal_set.ratified",
    target_type: "proposal_set",
    target_id: contract.proposal_set_id,
    payload_json: {
      account_id: contract.account_id,
      account_object_count: artifact.bundle_candidate.account_objects.length,
      trust_label: M5A_PINNED_ROW_TRUST_LABEL,
    },
    created_at: now,
  };
  const bundle: GraphBundle = {
    sources: artifact.bundle_candidate.sources.map((record) => ({ ...record })),
    excerpts: artifact.bundle_candidate.excerpts.map((record) => ({
      ...record,
      validation_status: "accepted" as const,
    })),
    claims: artifact.bundle_candidate.claims.map((record) => ({
      ...record,
      provenance_status: M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
    })),
    claim_evidence: artifact.bundle_candidate.claim_evidence.map((record) => ({
      ...record,
      rationale: "supporting hand-curated public excerpt accepted by one-shot ratification",
    })),
    account_objects: artifact.bundle_candidate.account_objects.map((record) => {
      const { review_state: _reviewState, ...payload } = record.payload_json;
      return {
        ...record,
        payload_json: {
          ...payload,
          origin: M5A_PINNED_CURATION_ORIGIN,
          durable_record_provenance: M5A_PINNED_ROW_TRUST_LABEL,
          ratified_via: "m5a-curated-proposal-flow-execution",
        },
        provenance_status: M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
        updated_at: now,
      };
    }),
    account_object_claims: artifact.bundle_candidate.account_object_claims.map((record) => ({ ...record })),
    research_runs: artifact.bundle_candidate.research_runs.map((record) => ({ ...record })),
    run_artifacts: [runArtifact],
    audit_events: [auditEvent],
  };
  const parsed = parseGraphBundle(bundle);
  if (!parsed.ok || !validateGraphBundle(parsed.value, { mode: "fixture" }).ok) {
    throw new ExecutionBoundaryRefusal("ratified bundle invalid");
  }
  if (
    parsed.value.claims.some((record) => record.provenance_status !== M5A_PINNED_PER_RECORD_PROVENANCE_STATUS) ||
    parsed.value.account_objects.some(
      (record) => record.provenance_status !== M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
    )
  ) {
    throw new ExecutionBoundaryRefusal("ratified trust tier invalid");
  }
  return parsed.value;
}

const CURATED_BADGE_MARKUP =
  `<span class="curated-pill">${WORKSHOP_CURATED_PUBLIC_SOURCE_LABEL}</span>` as const;
const CURATED_DATA_ATTRIBUTE =
  `data-curated-provenance="${WORKSHOP_CURATED_PUBLIC_SOURCE_ORIGIN}"` as const;

export type M5aWorkshopEvaluationFailureStage = "view_model" | "render" | "success_criterion";

export type M5aWorkshopEvaluation =
  | {
      readonly ok: true;
      readonly html: string;
      readonly populated_lenses: number;
      readonly rendered_cards: number;
      readonly curated_labeled_cards: number;
      readonly ratified_durable_records: number;
    }
  | {
      readonly ok: false;
      readonly failure_stage: M5aWorkshopEvaluationFailureStage;
      readonly render_attempted: boolean;
      readonly render_succeeded: boolean;
    };

function countExactMarkup(html: string, markup: string): number {
  return html.split(markup).length - 1;
}

/** Pure Workshop preflight/read-back evaluation over the supplied bundle. */
export function evaluateM5aCuratedProposalWorkshopBundle(
  bundle: GraphBundle,
  successCriterion: M5aFlowSuccessCriterion,
): M5aWorkshopEvaluation {
  let view: WorkshopViewModel;
  try {
    view = buildWorkshopViewModel(bundle);
  } catch {
    return Object.freeze({
      ok: false as const,
      failure_stage: "view_model" as const,
      render_attempted: false,
      render_succeeded: false,
    });
  }
  const cards = [...view.lenses.signals, ...view.lenses.maps, ...view.lenses.plays];
  const populatedLenses = Object.values(view.lenses).filter((items) => items.length > 0).length;
  const durableRecords = bundle.account_objects.length;
  const typedTrustStateValid =
    view.totals.verified_objects === 0 &&
    cards.every(
      (card) =>
        card.trust.provenance_status === M5A_PINNED_PER_RECORD_PROVENANCE_STATUS &&
        card.trust.label === "Source-backed",
    );

  let html: string;
  try {
    html = renderWorkshopHtml(view, { previewMode: "durable-curated" });
  } catch {
    return Object.freeze({
      ok: false as const,
      failure_stage: "render" as const,
      render_attempted: true,
      render_succeeded: false,
    });
  }
  const curatedBadges = countExactMarkup(html, CURATED_BADGE_MARKUP);
  const curatedAttributes = countExactMarkup(html, CURATED_DATA_ATTRIBUTE);
  if (
    populatedLenses < successCriterion.minimum_populated_lenses ||
    durableRecords < successCriterion.minimum_ratified_durable_records ||
    cards.length !== durableRecords ||
    !typedTrustStateValid ||
    curatedBadges !== cards.length ||
    curatedAttributes !== cards.length
  ) {
    return Object.freeze({
      ok: false as const,
      failure_stage: "success_criterion" as const,
      render_attempted: true,
      render_succeeded: true,
    });
  }
  return Object.freeze({
    ok: true as const,
    html,
    populated_lenses: populatedLenses,
    rendered_cards: cards.length,
    curated_labeled_cards: curatedBadges,
    ratified_durable_records: durableRecords,
  });
}

function committedUnrendered(
  failureCode: M5aCuratedProposalFlowCommittedFailureCode,
  contract: M5aCuratedProposalFlowContractArtifact,
  packet: M5aCuratedProposalFlowApprovalPacketArtifact,
  arming: M5aCuratedProposalFlowOperatorArmingArtifact,
  durableRecordId: string,
  now: string,
  flags: {
    readonly durableReadBackSucceeded: boolean;
    readonly renderAttempted: boolean;
    readonly renderSucceeded: boolean;
  },
): M5aCuratedProposalFlowExecutionCommittedUnrenderedOutcome {
  return Object.freeze({
    outcome: "committed_unrendered" as const,
    outcome_artifact_name: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME,
    schema_version: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION,
    failure_code: failureCode,
    flow_id: contract.flow_id,
    proposal_set_id: contract.proposal_set_id,
    account_id: contract.account_id,
    contract_artifact_id: contract.contract_artifact_id,
    packet_artifact_id: packet.packet_artifact_id,
    arming_artifact_id: arming.arming_artifact_id,
    operator_identity: arming.armed_by,
    one_shot_consumption_key: arming.one_shot_consumption_key,
    materialization_input_sha256: M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
    durable_record_id: durableRecordId,
    written_at: now,
    mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
    target_store: M5A_PINNED_TARGET_STORE,
    l0_effect_observed: true as const,
    durable_write_performed: true as const,
    durable_read_back_attempted: true as const,
    durable_read_back_succeeded: flags.durableReadBackSucceeded,
    render_attempted: flags.renderAttempted,
    render_succeeded: flags.renderSucceeded,
    rendered_from_durable_state: flags.durableReadBackSucceeded && flags.renderSucceeded,
    rendered_artifacts: 0 as const,
    boundaries: zeroEffectBoundaries(),
  });
}

function nonBlankLineCount(text: string): number {
  return text.split("\n").filter((line) => line.trim() !== "").length;
}

export async function executeM5aCuratedProposalFlow(
  options: M5aCuratedProposalFlowExecutionOptions,
): Promise<M5aCuratedProposalFlowExecutionOutcome> {
  let root: Readonly<Record<string, unknown>>;
  let now: string;
  try {
    root = snapshotRootOptions(options);
    now = checkedTimestamp(root.now);
  } catch {
    return refused("input_invalid", null);
  }

  let contract: M5aCuratedProposalFlowContractArtifact;
  let packet: M5aCuratedProposalFlowApprovalPacketArtifact;
  let arming: M5aCuratedProposalFlowOperatorArmingArtifact;
  try {
    contract = root.contract as M5aCuratedProposalFlowContractArtifact;
    verifyM5aCuratedProposalFlowContract(contract);
    packet = root.approvalPacket as M5aCuratedProposalFlowApprovalPacketArtifact;
    verifyM5aCuratedProposalFlowApprovalPacket(packet, contract);
    arming = root.arming as M5aCuratedProposalFlowOperatorArmingArtifact;
    verifyM5aCuratedProposalFlowOperatorArming(arming, packet, contract);
    assertExecutionPins(contract, packet, arming);
  } catch (error) {
    if (
      error instanceof M5aContractBuilderRefusal ||
      error instanceof M5aApprovalPacketRefusal ||
      error instanceof M5aOperatorArmingRefusal ||
      error instanceof ExecutionBoundaryRefusal
    ) {
      return refused("authorization_invalid", now);
    }
    throw error;
  }

  const nowMs = Date.parse(now);
  if (nowMs < Date.parse(arming.armed_at) || nowMs >= Date.parse(packet.expires_at)) {
    return refused("authorization_expired", now);
  }

  if (typeof root.dbRootDir !== "string" || root.dbRootDir.length === 0 || root.dbRootDir.includes("\0")) {
    return refused("input_invalid", now);
  }
  let dbRootDir: string;
  try {
    dbRootDir = await canonicalGraphSnapshotDbRootPath(
      join(root.dbRootDir, GRAPH_SNAPSHOTS_RELATIVE_PATH),
    );
  } catch {
    return refused("durable_db_invalid", now);
  }

  let materialized: ProposalMaterializationArtifact;
  try {
    assertMaterializationInputShape(root.materializationInput);
  } catch {
    return refused("materialization_refused", now);
  }
  const materializationInputSha256 = sha256M5aMaterializationInputSnapshot(root.materializationInput);
  if (materializationInputSha256 !== M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256) {
    return refused("recorded_proposal_digest_mismatch", now);
  }
  try {
    materialized = materializeProposalForValidation(
      root.materializationInput as MaterializeProposalForValidationInput,
    );
  } catch {
    return refused("materialization_refused", now);
  }
  try {
    validateMaterializationAlignment(materialized, contract);
  } catch {
    return refused("proposal_set_invalid", now);
  }

  let ratifiedBundle: GraphBundle;
  try {
    ratifiedBundle = ratifyBundle(
      materialized,
      contract,
      packet,
      arming,
      M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
      now,
    );
  } catch {
    return refused("proposal_set_invalid", now);
  }

  // Pure preflight happens before the shared lock and before any durable
  // effect. The same evaluator is run again on the actual read-back bundle.
  const preflight = evaluateM5aCuratedProposalWorkshopBundle(
    ratifiedBundle,
    contract.success_criterion,
  );
  if (!preflight.ok) return refused("proposal_set_invalid", now);

  let dbInspection;
  try {
    dbInspection = await inspectLocalDurableDb({ rootDir: dbRootDir });
  } catch {
    return refused("durable_db_invalid", now);
  }
  if (
    !dbInspection.ok ||
    dbInspection.databaseStatus !== "initialized" ||
    dbInspection.productionWrites !== false
  ) {
    return refused("durable_db_invalid", now);
  }

  const graphPath = join(dbRootDir, GRAPH_SNAPSHOTS_RELATIVE_PATH);
  const tempPath = `${graphPath}${TEMP_SUFFIX}`;
  const durableRecordId = canonicalM5aCuratedProposalFlowDurableRecordId(
    arming.one_shot_consumption_key,
    M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
  );
  const lockAcquisition = await acquireGraphSnapshotWriteLock(graphPath);
  if (!lockAcquisition.ok) {
    return refused(lockAcquisition.reason === "busy" ? "lock_busy" : "transaction_aborted", now);
  }

  try {
    // Re-inspect while holding the same external lock used by overwrite
    // restore. This closes the inspect-then-lock race and proves the target
    // being written is still the initialized local DB that was preflighted.
    let lockedDbInspection;
    try {
      lockedDbInspection = await inspectLocalDurableDb({ rootDir: dbRootDir });
    } catch {
      return refused("durable_db_invalid", now);
    }
    if (
      !lockedDbInspection.ok ||
      lockedDbInspection.databaseStatus !== "initialized" ||
      lockedDbInspection.productionWrites !== false
    ) {
      return refused("durable_db_invalid", now);
    }

    let existingText: string;
    try {
      existingText = await readFile(graphPath, "utf8");
    } catch {
      return refused("transaction_aborted", now);
    }

    const existing = await readWorkshopPublicProposalDurableGraphSnapshots({ dbRootDir, now });
    if (
      existing.refusals.length !== 0 ||
      existing.rows.length !== nonBlankLineCount(existingText)
    ) {
      return refused("durable_state_invalid", now);
    }
    const existingDurableRecordIds = new Set<string>();
    for (const row of existing.rows) {
      if (existingDurableRecordIds.has(row.durable_record_id)) {
        return refused("durable_state_invalid", now);
      }
      existingDurableRecordIds.add(row.durable_record_id);
    }
    if (existing.rows.some((row) => row.idempotency_key === arming.one_shot_consumption_key)) {
      return refused("one_shot_replay", now);
    }
    if (existingDurableRecordIds.has(durableRecordId)) {
      return refused("durable_record_id_conflict", now);
    }

    const row: DurableGraphSnapshotRow = Object.freeze({
      kind: ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
      schema_version: ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
      durable_record_id: durableRecordId,
      idempotency_key: arming.one_shot_consumption_key,
      approval_id: packet.packet_artifact_id,
      contract_artifact_id: contract.contract_artifact_id,
      account_id: contract.account_id,
      candidate_item_id: contract.proposal_set_id,
      operator_identity: arming.armed_by,
      mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
      trust_label: M5A_PINNED_ROW_TRUST_LABEL,
      written_at: now,
      bundle: ratifiedBundle,
    });
    const prefix = existingText.replace(/\n*$/, "");
    const nextText = `${prefix.length === 0 ? "" : `${prefix}\n`}${JSON.stringify(row)}\n`;
    try {
      await writeFile(tempPath, nextText, { encoding: "utf8", flag: "wx" });
      await rename(tempPath, graphPath);
    } catch {
      try { await unlink(tempPath); } catch { /* best effort */ }
      return refused("transaction_aborted", now);
    }

    let readBack;
    try {
      readBack = await readWorkshopPublicProposalDurableGraphSnapshots({ dbRootDir, now });
    } catch {
      return committedUnrendered(
        "post_commit_read_back_failed",
        contract,
        packet,
        arming,
        durableRecordId,
        now,
        { durableReadBackSucceeded: false, renderAttempted: false, renderSucceeded: false },
      );
    }
    if (readBack.refusals.length !== 0) {
      return committedUnrendered(
        "post_commit_read_back_failed",
        contract,
        packet,
        arming,
        durableRecordId,
        now,
        { durableReadBackSucceeded: false, renderAttempted: false, renderSucceeded: false },
      );
    }
    const matches = readBack.rows.filter(
      (candidate) => candidate.idempotency_key === arming.one_shot_consumption_key,
    );
    if (
      matches.length !== 1 ||
      canonicalJson(matches[0]) !== canonicalJson(row)
    ) {
      return committedUnrendered(
        "post_commit_row_mismatch",
        contract,
        packet,
        arming,
        durableRecordId,
        now,
        { durableReadBackSucceeded: true, renderAttempted: false, renderSucceeded: false },
      );
    }

    const evaluation = evaluateM5aCuratedProposalWorkshopBundle(
      matches[0]!.bundle,
      contract.success_criterion,
    );
    if (!evaluation.ok) {
      const failureCode: M5aCuratedProposalFlowCommittedFailureCode =
        evaluation.failure_stage === "view_model"
          ? "post_commit_view_model_failed"
          : evaluation.failure_stage === "render"
            ? "post_commit_render_failed"
            : "post_commit_success_criterion_failed";
      return committedUnrendered(
        failureCode,
        contract,
        packet,
        arming,
        durableRecordId,
        now,
        {
          durableReadBackSucceeded: true,
          renderAttempted: evaluation.render_attempted,
          renderSucceeded: evaluation.render_succeeded,
        },
      );
    }

    return Object.freeze({
      outcome: "completed" as const,
      outcome_artifact_name: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_OUTCOME_NAME,
      schema_version: M5A_CURATED_PROPOSAL_FLOW_EXECUTION_SCHEMA_VERSION,
      flow_id: contract.flow_id,
      proposal_set_id: contract.proposal_set_id,
      account_id: contract.account_id,
      contract_artifact_id: contract.contract_artifact_id,
      packet_artifact_id: packet.packet_artifact_id,
      arming_artifact_id: arming.arming_artifact_id,
      operator_identity: arming.armed_by,
      one_shot_consumption_key: arming.one_shot_consumption_key,
      materialization_input_sha256: M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
      durable_record_id: durableRecordId,
      written_at: now,
      mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
      target_store: M5A_PINNED_TARGET_STORE,
      stage_order: STAGE_ORDER,
      counts: Object.freeze({
        curated_proposal_flows: 1 as const,
        proposal_sets: 1 as const,
        durable_transactions: 1 as const,
        durable_rows_written: 1 as const,
        durable_read_backs: 1 as const,
        rendered_artifacts: 1 as const,
        ratified_durable_records: evaluation.ratified_durable_records,
        populated_lenses: evaluation.populated_lenses,
        rendered_cards: evaluation.rendered_cards,
        curated_labeled_cards: evaluation.curated_labeled_cards,
      }),
      boundaries: zeroEffectBoundaries(),
      durable_write_performed: true as const,
      durable_read_back_performed: true as const,
      rendered_from_durable_state: true as const,
      rendered_artifact: Object.freeze({ media_type: "text/html" as const, html: evaluation.html }),
    });
  } finally {
    await releaseGraphSnapshotWriteLockBestEffort(lockAcquisition.lock);
  }
}
