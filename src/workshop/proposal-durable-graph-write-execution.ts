// Workshop public proposal — durable graph-write executor.
//
// M3 step 3a (operator directive of 2026-06-12, sharpening 2026-06-14).
// THIS IS THE SLICE THAT FIRST FLIPS graph_ingestion_performed and
// durable_writes_performed FROM false TO true UNDER A CONTROLLED
// BOUNDARY. Everything before this defined what would be written; this
// is what writes it.
//
// Inputs: a freshly-built operator arming, the contract it descends
// from, the materialization input fixture for the ratified candidate's
// record bodies, the dbRootDir of the local-durable-db root, an
// `idempotencyToken` (per-call), and `now`.
//
// Output: a `WorkshopProposalDurableGraphWriteOutcome` discriminated
// union with three shapes:
//
//   - "refused":   arming/contract validation failed; NO row was written
//                  and NO L0 marker is stamped. The refusal record names
//                  the refusal_code so 3a's retro can answer "can the
//                  markers flip without a real arming?" with proof.
//   - "idempotent_no_op": same idempotency key already present in
//                  graph_snapshots; no new row, no L0 stamp on this
//                  outcome (the L0 effect was the prior write, not this
//                  call). Carries idempotent_referenced_row_ref.
//   - "completed": one new row was appended to graph_snapshots.jsonl in
//                  a single-transaction-or-noop write; mediation_gate_
//                  level: "L0" is stamped on this outcome. Records the
//                  durable_record_id, written_at, and one operator
//                  identity attribution on the AuditEvent inside the
//                  bundle.
//
// Single-transaction-or-noop semantics: the executor writes the new
// graph_snapshots.jsonl content to a sibling temp file and atomically
// renames it over the original. Any failure during the build/validate/
// write path leaves the original file unchanged.
//
// Operator-identity discipline: a single attributable ratifier id is
// recorded on the bundle's AuditEvent (actor_type: "user", actor_id =
// operator_identity from the arming). No roles, no sessions, no
// permissions are modeled. That scope is M6.

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { types as nodeUtilTypes } from "node:util";

import { parseGraphBundle } from "../graph/schema.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import type {
  AccountObject,
  AccountObjectClaim,
  AuditEvent,
  Claim,
  ClaimEvidence,
  EvidenceExcerpt,
  GraphBundle,
  ResearchRun,
  RunArtifact,
  SourceDocument,
} from "../graph/types.ts";
import {
  PINNED_MEDIATION_GATE_LEVEL,
  PINNED_TARGET_STORE,
  type WorkshopProposalDurableGraphWriteContractArtifact,
} from "./proposal-durable-graph-write-contract.ts";
import {
  ARMED_LIFECYCLE_STATE,
  WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME,
  type WorkshopProposalOperatorArmingArtifact,
} from "./proposal-durable-graph-write-operator-arming.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME =
  "workshop-public-proposal-durable-graph-write-outcome" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_durable_graph_write_outcome.v1" as const;

export const ATLIERA_GRAPH_SNAPSHOT_ROW_KIND =
  "atliera-graph-snapshot-row" as const;
export const ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION = 1 as const;

const GRAPH_SNAPSHOTS_RELATIVE_PATH = "tables/graph_snapshots.jsonl";

// Public refusal codes — the enumerated reject-paths the executor must
// detect to satisfy 3a's DOD. Each one corresponds to a test in the
// reject-path suite.
export type WorkshopProposalDurableWriteRefusalCode =
  | "arming_kind_invalid"
  | "arming_lifecycle_not_armed"
  | "arming_authorization_marker_missing"
  | "arming_approval_id_mismatch_against_packet"
  | "arming_contract_artifact_id_mismatch_against_contract"
  | "arming_expired_at_call_time"
  | "arming_authorizes_wrong_candidate"
  | "arming_already_consumed_against_durable_state"
  | "contract_kind_invalid"
  | "contract_boundary_broadened"
  | "materialization_input_missing_record"
  | "graph_bundle_validation_failed"
  | "durable_db_unreachable"
  | "transaction_aborted_mid_write";

export interface WorkshopProposalDurableWriteRefusedOutcome {
  readonly outcome: "refused";
  readonly outcome_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION;
  readonly refusal_code: WorkshopProposalDurableWriteRefusalCode;
  readonly refusal_detail: string;
  readonly approval_id_observed: string | null;
  readonly contract_artifact_id_observed: string | null;
  readonly checked_at: string;
  // Doctrine alignment: refusals carry NO L0 stamp. A refused write is
  // not an L0 effect; nothing happened. The 3a retro can verify this by
  // grepping that no `mediation_gate_level` field is present on a
  // refused outcome.
  readonly l0_effect_observed: false;
  readonly durable_write_performed: false;
  readonly graph_ingestion_performed: false;
}

export interface WorkshopProposalDurableWriteIdempotentNoOpOutcome {
  readonly outcome: "idempotent_no_op";
  readonly outcome_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION;
  readonly idempotency_key: string;
  readonly idempotent_referenced_row_id: string;
  readonly idempotent_referenced_row_written_at: string;
  readonly checked_at: string;
  // No L0 stamp on a no-op outcome. The L0 effect was the prior write.
  // The no-op references that effect; it does not re-claim it.
  readonly l0_effect_observed_on_this_call: false;
  readonly durable_write_performed_on_this_call: false;
  readonly graph_ingestion_performed_on_this_call: false;
}

export interface WorkshopProposalDurableWriteCompletedOutcome {
  readonly outcome: "completed";
  readonly outcome_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION;
  readonly durable_record_id: string;
  readonly idempotency_key: string;
  readonly written_at: string;
  readonly approval_id: string;
  readonly contract_artifact_id: string;
  readonly account_id: string;
  readonly candidate_item_id: string;
  readonly operator_identity: string;
  // The L0 stamp lives HERE — and only here. This is the outcome of a
  // write that happened, so the gate level is a property of the effect.
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly l0_effect_observed: true;
  readonly durable_write_performed: true;
  readonly graph_ingestion_performed: true;
  readonly target_store: typeof PINNED_TARGET_STORE;
  readonly bundle_record_counts: {
    readonly sources: number;
    readonly excerpts: number;
    readonly claims: number;
    readonly claim_evidence: number;
    readonly account_objects: number;
    readonly account_object_claims: number;
    readonly research_runs: number;
    readonly run_artifacts: number;
    readonly audit_events: number;
  };
}

export type WorkshopProposalDurableGraphWriteOutcome =
  | WorkshopProposalDurableWriteRefusedOutcome
  | WorkshopProposalDurableWriteIdempotentNoOpOutcome
  | WorkshopProposalDurableWriteCompletedOutcome;

export interface DurableGraphSnapshotRow {
  readonly kind: typeof ATLIERA_GRAPH_SNAPSHOT_ROW_KIND;
  readonly schema_version: typeof ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION;
  readonly durable_record_id: string;
  readonly idempotency_key: string;
  readonly approval_id: string;
  readonly contract_artifact_id: string;
  readonly account_id: string;
  readonly candidate_item_id: string;
  readonly operator_identity: string;
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly trust_label: string;
  readonly written_at: string;
  readonly bundle: GraphBundle;
}

// The shape of the materialization input fixture (M1's input). We
// snapshot only the fields needed to derive record bodies for the
// approved candidate.
export interface MaterializationInputFixture {
  readonly context: {
    readonly team_id: string;
    readonly account_id: string;
    readonly materialized_at: string;
    readonly proposal_set_id: string;
  };
  readonly public_sources: readonly SourceDocument[];
  readonly proposed_excerpts: ReadonlyArray<{
    readonly proposal_id: string;
    readonly source_document_id: string;
    readonly quote: string;
  }>;
  readonly proposed_claims: ReadonlyArray<{
    readonly proposal_id: string;
    readonly claim_type: string;
    readonly text: string;
    readonly normalized_subject: string;
    readonly confidence: "high" | "medium" | "low";
    readonly supporting_excerpt_proposal_ids: readonly string[];
  }>;
  readonly proposed_account_objects: ReadonlyArray<{
    readonly proposal_id: string;
    readonly object_type: AccountObject["object_type"];
    readonly title: string;
    readonly summary: string;
    readonly supporting_claim_proposal_ids: readonly string[];
  }>;
}

export interface WorkshopProposalDurableGraphWriteExecutionOptions {
  readonly arming: WorkshopProposalOperatorArmingArtifact;
  readonly contract: WorkshopProposalDurableGraphWriteContractArtifact;
  readonly approvalPacket: { readonly approval_id: string; readonly contract_artifact_id: string };
  readonly materializationInput: MaterializationInputFixture;
  readonly dbRootDir: string;
  readonly now: string;
}

// ---------- helpers ----------

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const CANONICAL_IDEMPOTENCY_SUFFIX = "ratified-durable-write-v1" as const;

type PlainRecord = Readonly<Record<string, unknown>>;

interface ExecutionArmingSnapshot {
  readonly kind: unknown;
  readonly lifecycle_state: unknown;
  readonly approval_id: string | null;
  readonly contract_artifact_id: string | null;
  readonly expires_at: string;
  readonly operator_identity: string;
  readonly authorized_candidate_item_ids: readonly string[];
  readonly boundaries: PlainRecord;
}

interface ExecutionContractSnapshot {
  readonly kind: unknown;
  readonly contract_artifact_id: string | null;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly boundaries: PlainRecord;
  readonly write_operations: readonly { readonly candidate_item_id: string; readonly idempotency_key_shape: string }[];
}

interface ExecutionApprovalPacketSnapshot {
  readonly approval_id: string | null;
  readonly contract_artifact_id: string | null;
}

function snapshotPlainRecord(value: unknown, label: string): PlainRecord {
  if (nodeUtilTypes.isProxy(value)) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain own-data object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`${label} must not carry symbol keys`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`${label} contains unsafe key`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new Error(`${label} must be a plain own-data object`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function snapshotArray(value: unknown, label: string, maxLength: number): readonly unknown[] {
  if (nodeUtilTypes.isProxy(value)) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const length = value.length;
  if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) {
    throw new Error(`${label} length invalid`);
  }
  const out: unknown[] = [];
  for (let i = 0; i < length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      throw new Error(`${label} must contain only enumerable own data items`);
    }
    out.push(descriptor.value);
  }
  return Object.freeze(out);
}

function optionalSafeString(value: unknown): string | null {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function requireSafeString(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} malformed`);
  }
  return value;
}

function isValidIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const canonical = date.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function requireIsoTimestampString(value: unknown, label: string): string {
  if (typeof value !== "string" || !isValidIsoTimestamp(value)) {
    throw new Error(`${label} malformed`);
  }
  return value;
}

function snapshotSafeStringArray(value: unknown, label: string): readonly string[] {
  const raw = snapshotArray(value, label, 100);
  if (raw.length === 0) throw new Error(`${label} must not be empty`);
  const out: string[] = [];
  for (const item of raw) out.push(requireSafeString(item, label));
  return Object.freeze(out);
}

function snapshotArmingForExecution(value: unknown): ExecutionArmingSnapshot {
  const root = snapshotPlainRecord(value, "arming");
  return Object.freeze({
    kind: root.kind,
    lifecycle_state: root.lifecycle_state,
    approval_id: optionalSafeString(root.approval_id),
    contract_artifact_id: typeof root.contract_artifact_id === "string" ? root.contract_artifact_id : null,
    expires_at: requireIsoTimestampString(root.expires_at, "arming.expires_at"),
    operator_identity: requireSafeString(root.operator_identity, "arming.operator_identity"),
    authorized_candidate_item_ids: snapshotSafeStringArray(
      root.authorized_candidate_item_ids,
      "arming.authorized_candidate_item_ids",
    ),
    boundaries: snapshotPlainRecord(root.boundaries, "arming.boundaries"),
  });
}

function snapshotContractForExecution(value: unknown): ExecutionContractSnapshot {
  const root = snapshotPlainRecord(value, "contract");
  const rawOps = snapshotArray(root.write_operations, "contract.write_operations", 100);
  if (rawOps.length === 0) throw new Error("contract carries zero write operations");
  const writeOps = Object.freeze(rawOps.map((raw, index) => {
    const op = snapshotPlainRecord(raw, `contract.write_operations[${index}]`);
    return Object.freeze({
      candidate_item_id: requireSafeString(op.candidate_item_id, `contract.write_operations[${index}].candidate_item_id`),
      idempotency_key_shape: typeof op.idempotency_key_shape === "string" ? op.idempotency_key_shape : "",
    });
  }));
  return Object.freeze({
    kind: root.kind,
    contract_artifact_id: typeof root.contract_artifact_id === "string" ? root.contract_artifact_id : null,
    proposal_set_id: requireSafeString(root.proposal_set_id, "contract.proposal_set_id"),
    account_id: requireSafeString(root.account_id, "contract.account_id"),
    boundaries: snapshotPlainRecord(root.boundaries, "contract.boundaries"),
    write_operations: writeOps,
  });
}

function snapshotApprovalPacketForExecution(value: unknown): ExecutionApprovalPacketSnapshot {
  const root = snapshotPlainRecord(value, "approvalPacket");
  return Object.freeze({
    approval_id: optionalSafeString(root.approval_id),
    contract_artifact_id: typeof root.contract_artifact_id === "string" ? root.contract_artifact_id : null,
  });
}

function refused(
  code: WorkshopProposalDurableWriteRefusalCode,
  detail: string,
  observed: {
    approvalId?: string | null;
    contractArtifactId?: string | null;
  },
  now: string,
): WorkshopProposalDurableWriteRefusedOutcome {
  return Object.freeze({
    outcome: "refused" as const,
    outcome_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION,
    refusal_code: code,
    refusal_detail: detail,
    approval_id_observed: observed.approvalId ?? null,
    contract_artifact_id_observed: observed.contractArtifactId ?? null,
    checked_at: now,
    l0_effect_observed: false as const,
    durable_write_performed: false as const,
    graph_ingestion_performed: false as const,
  });
}

function computeIdempotencyKey(
  shape: string,
  accountId: string,
  candidateItemId: string,
): string {
  // The canonical contract shape is exactly
  // `${accountId}:${accountObjectId}:ratified-durable-write-v1`.
  // Do not accept arbitrary suffixes: changing the suffix would mint a
  // second idempotency key for the same approved candidate and bypass
  // the direct-against-DB no-duplicate proof.
  const expected = `${accountId}:${candidateItemId}:${CANONICAL_IDEMPOTENCY_SUFFIX}`;
  if (shape !== expected) {
    throw new Error("idempotency_key_shape is not the canonical accountId:candidateItemId shape");
  }
  return expected;
}

function deriveBundle(
  input: MaterializationInputFixture,
  candidateItemId: string,
  contractArtifactId: string,
  approvalId: string,
  operatorIdentity: string,
  now: string,
): { bundle: GraphBundle; trustLabel: string } {
  // The candidate's proposal_id maps from materialization to durable
  // through a fixed prefix scheme: object IDs are `obj_<proposal_id>`,
  // claim IDs are `clm_<proposal_id>`, excerpt IDs are
  // `exc_<proposal_id>`, source IDs are the public_source `id` field
  // as-is.
  const objectProposalId = candidateItemId.startsWith("obj_")
    ? candidateItemId.slice("obj_".length)
    : null;
  if (!objectProposalId) {
    throw new Error("materialization_input_missing_record");
  }
  const objectInput = input.proposed_account_objects.find(
    (o) => o.proposal_id === objectProposalId,
  );
  if (!objectInput) throw new Error("materialization_input_missing_record");

  const claimInputs = input.proposed_claims.filter((c) =>
    objectInput.supporting_claim_proposal_ids.includes(c.proposal_id),
  );
  if (claimInputs.length === 0) {
    throw new Error("materialization_input_missing_record");
  }

  const excerptProposalIds = new Set<string>();
  for (const ci of claimInputs) {
    for (const eid of ci.supporting_excerpt_proposal_ids) excerptProposalIds.add(eid);
  }
  const excerptInputs = input.proposed_excerpts.filter((e) =>
    excerptProposalIds.has(e.proposal_id),
  );
  if (excerptInputs.length === 0) {
    throw new Error("materialization_input_missing_record");
  }

  const sourceIds = new Set<string>();
  for (const ei of excerptInputs) sourceIds.add(ei.source_document_id);
  const sourceInputs = input.public_sources.filter((s) => sourceIds.has(s.id));

  const sources: SourceDocument[] = sourceInputs.map((s) => ({ ...s }));
  const excerpts: EvidenceExcerpt[] = excerptInputs.map((e) => {
    const source = sourceInputs.find((s) => s.id === e.source_document_id)!;
    const charStart = source.raw_text.indexOf(e.quote);
    if (charStart < 0) {
      throw new Error("materialization_input_missing_record");
    }
    return {
      id: `exc_${e.proposal_id}`,
      source_document_id: e.source_document_id,
      text: e.quote,
      kind: "literal",
      char_start: charStart,
      char_end: charStart + e.quote.length,
      captured_at: input.context.materialized_at,
      validation_status: "accepted",
      rejection_reason: null,
    };
  });
  const claims: Claim[] = claimInputs.map((c) => ({
    id: `clm_${c.proposal_id}`,
    team_id: input.context.team_id,
    account_id: input.context.account_id,
    claim_type: c.claim_type,
    text: c.text,
    normalized_subject: c.normalized_subject,
    confidence: c.confidence,
    provenance_status: "source_document_only",
    status: "active",
    created_by: "model",
    created_at: input.context.materialized_at,
  }));
  const claim_evidence: ClaimEvidence[] = [];
  for (const c of claimInputs) {
    for (const eProposalId of c.supporting_excerpt_proposal_ids) {
      claim_evidence.push({
        id: `cev_${c.proposal_id}_${eProposalId}`,
        claim_id: `clm_${c.proposal_id}`,
        evidence_excerpt_id: `exc_${eProposalId}`,
        relationship: "supports",
        rationale: "supporting excerpt from materialization fixture",
        confidence: c.confidence,
        created_at: input.context.materialized_at,
      });
    }
  }
  const account_objects: AccountObject[] = [
    {
      id: `obj_${objectInput.proposal_id}`,
      team_id: input.context.team_id,
      account_id: input.context.account_id,
      object_type: objectInput.object_type,
      title: objectInput.title,
      summary: objectInput.summary,
      payload_json: {
        ratified_via: "workshop-public-proposal-operator-arming",
        durable_record_provenance: "model-proposed-human-ratified-evidence-pending",
      },
      confidence: "high",
      provenance_status: "source_document_only",
      status: "active",
      created_by: "model",
      created_at: input.context.materialized_at,
      updated_at: now,
    },
  ];
  const account_object_claims: AccountObjectClaim[] = claimInputs.map((c) => ({
    id: `oclm_${objectInput.proposal_id}_${c.proposal_id}`,
    account_object_id: `obj_${objectInput.proposal_id}`,
    claim_id: `clm_${c.proposal_id}`,
    relationship: "primary",
  }));
  const research_runs: ResearchRun[] = [
    {
      id: `run_ratified_${objectInput.proposal_id}`,
      team_id: input.context.team_id,
      account_id: input.context.account_id,
      mode: "fixture",
      provider: null,
      model: null,
      status: "completed",
      cost_cap_usd: 0,
      observed_cost_usd: 0,
      started_at: input.context.materialized_at,
      completed_at: now,
    },
  ];
  const run_artifacts: RunArtifact[] = [
    {
      id: `art_ratified_${objectInput.proposal_id}`,
      research_run_id: `run_ratified_${objectInput.proposal_id}`,
      artifact_type: "durable_graph_write_outcome",
      payload_json: {
        contract_artifact_id: contractArtifactId,
        approval_id: approvalId,
      },
      created_at: now,
    },
  ];
  // The single attributable ratifier identity lands on the AuditEvent —
  // one field, no roles, no sessions. This is the M3/M6 boundary.
  const audit_events: AuditEvent[] = [
    {
      id: `aud_ratified_${objectInput.proposal_id}`,
      team_id: input.context.team_id,
      actor_type: "user",
      actor_id: operatorIdentity,
      event_type: "claim.ratified",
      target_type: "account_object",
      target_id: `obj_${objectInput.proposal_id}`,
      payload_json: {
        approval_id: approvalId,
        contract_artifact_id: contractArtifactId,
        ratification_mode: "operator-armed-single-shot",
      },
      created_at: now,
    },
  ];

  const bundle: GraphBundle = {
    sources,
    excerpts,
    claims,
    claim_evidence,
    account_objects,
    account_object_claims,
    research_runs,
    run_artifacts,
    audit_events,
  };
  return { bundle, trustLabel: "model-proposed-human-ratified-evidence-pending" };
}

interface ExistingIdempotencyHit {
  readonly idempotency_key: string;
  readonly durable_record_id: string;
  readonly written_at: string;
}

async function readExistingRows(path: string): Promise<readonly DurableGraphSnapshotRow[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("durable_db_unreachable");
    }
    throw e;
  }
  const out: DurableGraphSnapshotRow[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const parsed = JSON.parse(line);
    out.push(parsed);
  }
  return out;
}

function findIdempotencyHit(
  rows: readonly DurableGraphSnapshotRow[],
  idempotencyKey: string,
): ExistingIdempotencyHit | null {
  for (const row of rows) {
    if (row.idempotency_key === idempotencyKey) {
      return {
        idempotency_key: row.idempotency_key,
        durable_record_id: row.durable_record_id,
        written_at: row.written_at,
      };
    }
  }
  return null;
}

// ---------- the executor ----------

export async function executeWorkshopPublicProposalDurableGraphWrite(
  options: WorkshopProposalDurableGraphWriteExecutionOptions,
): Promise<WorkshopProposalDurableGraphWriteOutcome> {
  const { materializationInput, dbRootDir, now } = options;

  let arming: ExecutionArmingSnapshot;
  try {
    arming = snapshotArmingForExecution(options.arming);
  } catch {
    return refused("arming_kind_invalid", "arming failed own-data snapshot validation", {}, now);
  }

  let approvalPacket: ExecutionApprovalPacketSnapshot;
  try {
    approvalPacket = snapshotApprovalPacketForExecution(options.approvalPacket);
  } catch {
    return refused("arming_approval_id_mismatch_against_packet", "approval packet failed own-data snapshot validation", {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }

  let contract: ExecutionContractSnapshot;
  try {
    contract = snapshotContractForExecution(options.contract);
  } catch {
    return refused("contract_kind_invalid", "contract failed own-data snapshot validation", {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }

  // ---- Reject-path validation (these are the proofs the 3a retro
  //      needs to answer "can the markers flip without a real arming?"
  //      with no, by construction). ----

  // R1: arming kind must be the operator-arming kind.
  if (arming.kind !== WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME) {
    return refused("arming_kind_invalid", "arming.kind unexpected", {
      approvalId: arming.approval_id ?? null,
      contractArtifactId: arming.contract_artifact_id ?? null,
    }, now);
  }
  // R2: arming must be in operator-armed lifecycle.
  if (arming.lifecycle_state !== ARMED_LIFECYCLE_STATE) {
    return refused("arming_lifecycle_not_armed", "arming.lifecycle_state is not operator-armed", {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  // R3: arming must carry authorizes_durable_write_execution: true.
  if (arming.boundaries.authorizes_durable_write_execution !== true) {
    return refused("arming_authorization_marker_missing", "arming does not carry authorizes_durable_write_execution: true", {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  // R4: arming's approval_id must match the approval packet's approval_id.
  if (arming.approval_id === null || approvalPacket.approval_id === null || arming.approval_id !== approvalPacket.approval_id) {
    return refused("arming_approval_id_mismatch_against_packet", `arming.approval_id ${arming.approval_id} != packet.approval_id ${approvalPacket.approval_id}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  const approvalId = arming.approval_id;
  // R5: arming's contract_artifact_id must match the contract.
  if (arming.contract_artifact_id === null || contract.contract_artifact_id === null || arming.contract_artifact_id !== contract.contract_artifact_id) {
    return refused("arming_contract_artifact_id_mismatch_against_contract", `arming.contract_artifact_id ${arming.contract_artifact_id} != contract.contract_artifact_id ${contract.contract_artifact_id}`, {
      approvalId,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  const contractArtifactId = arming.contract_artifact_id;
  // R6: arming must not be expired at call time.
  if (new Date(now).getTime() >= new Date(arming.expires_at).getTime()) {
    return refused("arming_expired_at_call_time", `now ${now} >= arming.expires_at ${arming.expires_at}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  // R7: arming must authorize at least one candidate; the candidate
  // it actually writes is the first authorized one. If the contract
  // happens to enumerate a different candidate than the arming pins,
  // refuse.
  const authorizedIds = arming.authorized_candidate_item_ids;
  if (authorizedIds.length !== 1) {
    return refused("arming_authorizes_wrong_candidate", `arming must authorize exactly 1 candidate; saw ${authorizedIds.length}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  const candidateItemId = authorizedIds[0]!;
  const contractCandidateIds = contract.write_operations.map((op) => op.candidate_item_id);
  if (!contractCandidateIds.includes(candidateItemId)) {
    return refused("arming_authorizes_wrong_candidate", `arming candidate ${candidateItemId} is not in the contract's write_operations`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }

  // R8: contract sanity — kind + closed boundaries.
  if (contract.kind !== "workshop-public-proposal-durable-graph-write-contract") {
    return refused("contract_kind_invalid", "contract.kind unexpected", {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  for (const closed of [
    contract.boundaries.authorizes_durable_write_execution,
    contract.boundaries.durable_write_execution_performed,
    contract.boundaries.authorizes_graph_ingestion,
    contract.boundaries.graph_ingestion_performed,
    contract.boundaries.durable_writes_performed,
    contract.boundaries.production_writes,
    contract.boundaries.readiness_claim,
  ] as const) {
    if (closed !== false) {
      return refused("contract_boundary_broadened", "contract has a broadened closed boundary", {
        approvalId: arming.approval_id,
        contractArtifactId: arming.contract_artifact_id,
      }, now);
    }
  }

  // Find the matching contract write_operation for the candidate.
  const writeOp = contract.write_operations.find(
    (op) => op.candidate_item_id === candidateItemId,
  )!;

  // ---- Idempotency key + DB read ----

  let idempotencyKey: string;
  try {
    idempotencyKey = computeIdempotencyKey(
      writeOp.idempotency_key_shape,
      contract.account_id,
      candidateItemId,
    );
  } catch (e) {
    return refused("contract_boundary_broadened", `idempotency key rejected: ${(e as Error).message}`, {
      approvalId,
      contractArtifactId,
    }, now);
  }
  const path = join(dbRootDir, GRAPH_SNAPSHOTS_RELATIVE_PATH);

  let rows: readonly DurableGraphSnapshotRow[];
  try {
    rows = await readExistingRows(path);
  } catch (e) {
    const msg = (e as Error).message;
    return refused(
      msg === "durable_db_unreachable" ? "durable_db_unreachable" : "transaction_aborted_mid_write",
      `read failed: ${msg}`,
      {
        approvalId: arming.approval_id,
        contractArtifactId: arming.contract_artifact_id,
      },
      now,
    );
  }

  // R9: arming already consumed against durable state — if the same
  // approval_id appears on any prior row, this arming was already used.
  // The arming is one-shot: a second attempt against an already-
  // consumed arming is refused.
  for (const row of rows) {
    if (row.approval_id === arming.approval_id) {
      // If it is the exact same candidate + idempotency key, fall
      // through to idempotent_no_op below. Otherwise: refuse.
      if (row.idempotency_key === idempotencyKey && row.candidate_item_id === candidateItemId) {
        break;
      }
      return refused("arming_already_consumed_against_durable_state", `approval_id ${arming.approval_id} already consumed by row ${row.durable_record_id}`, {
        approvalId: arming.approval_id,
        contractArtifactId: arming.contract_artifact_id,
      }, now);
    }
  }

  // Idempotency check: if the same idempotency_key is already there,
  // emit a no-op outcome — same approval, same candidate, same key
  // means the write already happened.
  const hit = findIdempotencyHit(rows, idempotencyKey);
  if (hit) {
    return Object.freeze({
      outcome: "idempotent_no_op" as const,
      outcome_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME,
      schema_version: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION,
      idempotency_key: idempotencyKey,
      idempotent_referenced_row_id: hit.durable_record_id,
      idempotent_referenced_row_written_at: hit.written_at,
      checked_at: now,
      l0_effect_observed_on_this_call: false as const,
      durable_write_performed_on_this_call: false as const,
      graph_ingestion_performed_on_this_call: false as const,
    });
  }

  // ---- Derive + validate the bundle ----

  let bundle: GraphBundle;
  let trustLabel: string;
  try {
    const derived = deriveBundle(
      materializationInput,
      candidateItemId,
      contractArtifactId,
      approvalId,
      arming.operator_identity,
      now,
    );
    bundle = derived.bundle;
    trustLabel = derived.trustLabel;
  } catch (e) {
    const msg = (e as Error).message;
    return refused(
      msg === "materialization_input_missing_record" ? "materialization_input_missing_record" : "transaction_aborted_mid_write",
      `derive failed: ${msg}`,
      {
        approvalId: arming.approval_id,
        contractArtifactId: arming.contract_artifact_id,
      },
      now,
    );
  }

  // Validate the bundle against the Atliera graph validator BEFORE
  // committing it. A bundle that fails validation must never reach the
  // durable store.
  const parsed = parseGraphBundle(bundle);
  if (!parsed.ok) {
    return refused("graph_bundle_validation_failed", `parse failed: ${parsed.errors[0]?.message ?? "unknown"}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }
  const report = validateGraphBundle(parsed.value, { mode: "fixture" });
  if (!report.ok) {
    return refused("graph_bundle_validation_failed", `validate failed: ${report.hard_failures[0]?.code ?? "unknown"}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }

  // ---- Single-transaction-or-noop write ----

  const durableRecordId = `ratified-write:${contract.proposal_set_id}:${candidateItemId}:${now}`;
  const row: DurableGraphSnapshotRow = Object.freeze({
    kind: ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
    schema_version: ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
    durable_record_id: durableRecordId,
    idempotency_key: idempotencyKey,
    approval_id: approvalId,
    contract_artifact_id: contractArtifactId,
    account_id: contract.account_id,
    candidate_item_id: candidateItemId,
    operator_identity: arming.operator_identity,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    trust_label: trustLabel,
    written_at: now,
    bundle,
  });

  // Build the new file content: old rows + this row, all separated by
  // newlines, with a trailing newline.
  const existingText = rows.map((r) => JSON.stringify(r)).join("\n");
  const newRowText = JSON.stringify(row);
  const newFileText =
    existingText.length === 0 ? `${newRowText}\n` : `${existingText}\n${newRowText}\n`;

  // Atomic temp + rename. If either step fails, the original file
  // remains untouched and durable_writes_performed stays false.
  const tempPath = `${path}.${process.pid}.${now.replace(/[:.]/g, "-")}.tmp`;
  try {
    await writeFile(tempPath, newFileText, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, path);
  } catch (e) {
    return refused("transaction_aborted_mid_write", `write failed: ${(e as Error).message}`, {
      approvalId: arming.approval_id,
      contractArtifactId: arming.contract_artifact_id,
    }, now);
  }

  // ---- Completed outcome — L0 stamp lives here. ----
  return Object.freeze({
    outcome: "completed" as const,
    outcome_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_WRITE_OUTCOME_SCHEMA_VERSION,
    durable_record_id: durableRecordId,
    idempotency_key: idempotencyKey,
    written_at: now,
    approval_id: approvalId,
    contract_artifact_id: contractArtifactId,
    account_id: contract.account_id,
    candidate_item_id: candidateItemId,
    operator_identity: arming.operator_identity,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    l0_effect_observed: true as const,
    durable_write_performed: true as const,
    graph_ingestion_performed: true as const,
    target_store: PINNED_TARGET_STORE,
    bundle_record_counts: {
      sources: bundle.sources.length,
      excerpts: bundle.excerpts.length,
      claims: bundle.claims.length,
      claim_evidence: bundle.claim_evidence.length,
      account_objects: bundle.account_objects.length,
      account_object_claims: bundle.account_object_claims.length,
      research_runs: bundle.research_runs.length,
      run_artifacts: bundle.run_artifacts.length,
      audit_events: bundle.audit_events.length,
    },
  });
}
