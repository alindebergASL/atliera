// Workshop public proposal — no-call durable graph-write contract.
//
// M3 step 1 (operator directive of 2026-06-12). Consumes a no-call
// reviewed-candidate ratification plan and produces a disposable
// contract artifact describing:
//   (a) the typed shape of the eventual durable graph-write operation
//       for each ratified candidate, and
//   (b) the typed shape of the future approval packet that would arm
//       one such write.
//
// This module performs no durable write, no graph ingestion, no
// provider call, and reads no private evidence. The artifact authorizes
// nothing: it is the contract surface that the next slice (the
// approval packet) will be validated against and the slice after that
// (the actual write) will execute against.
//
// Doctrine alignment (ADR 0003): the eventual durable write is a
// deterministic L0 system action — the model influenced what was
// proposed, the human ratified the proposal, and the system performs
// the write deterministically under an explicit operator-armed
// approval. There is no model influence on whether, when, or against
// what the write runs.

import {
  WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME,
  type WorkshopProposalRatificationPlanArtifact,
} from "./proposal-ratification-plan.ts";
import type { WorkshopLens } from "./view-model.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME =
  "workshop-public-proposal-durable-graph-write-contract" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_durable_graph_write_contract.v1" as const;

// The next slice consumes this contract artifact and emits a
// disposable approval-packet artifact. The slice after that consumes
// the approval packet (only after operator arming) and performs the
// approved one-record durable write.
export const NEXT_REQUIRED_CONTRACT =
  "reviewed-candidate-durable-graph-write-approval-packet" as const;

// The target store for the eventual write. Pinned to the existing
// local durable DB primitive established in Gate 3 lab slices; the
// contract does not import or call into it. A future slice may extend
// this to additional pinned target stores.
export const PINNED_TARGET_STORE = "local-durable-db" as const;

// The mediation-gate level of the eventual durable write, per ADR 0003.
// Recorded on the contract so any future approval packet inherits this
// classification verbatim and any reviewer can verify the L0 claim.
export const PINNED_MEDIATION_GATE_LEVEL = "L0" as const;

// The trust label the eventual durable write will stamp on the
// resulting durable graph records. Per the doctrine spine, ratified
// records are not Verified — they are model-proposed and human-
// ratified but evidence has not yet been independently re-verified
// against fetched sources (that path remains M4 / M5b territory).
export const PINNED_DURABLE_WRITE_TRUST_LABEL =
  "model-proposed-human-ratified-evidence-pending" as const;

export interface WorkshopProposalDurableGraphWriteContractBoundaries {
  readonly current_effective_authorization: "none";
  readonly authorizes_provider_call: false;
  readonly authorizes_private_evidence_read: false;
  readonly authorizes_graph_ingestion: false;
  readonly graph_ingestion_performed: false;
  readonly provider_calls_executed: 0;
  readonly private_evidence_read: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
  // Contract-specific markers: the artifact DEFINES the shape but
  // AUTHORIZES no execution.
  readonly defines_durable_write_contract: true;
  readonly authorizes_durable_write_execution: false;
  readonly durable_write_execution_performed: false;
  readonly requires_separate_durable_write_approval_packet: true;
  // Inherited ratification-plan markers, restated to make the
  // boundary auditable in one block.
  readonly ratification_performed: false;
  readonly plan_only: true;
  readonly requires_separate_ratification_approval: true;
}

// The typed shape of the durable write that a future approved
// execution would perform against the pinned target store for ONE
// ratified candidate.
export interface WorkshopProposalDurableWriteOperationShape {
  readonly candidate_item_id: string;
  readonly lens: WorkshopLens;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
  // Target.
  readonly target_store: typeof PINNED_TARGET_STORE;
  // What records the write would land if authorized. Counts are
  // derived from the ratification plan candidate, not invented.
  readonly target_record_counts: {
    readonly account_object: 1;
    readonly claim_count: number;
    readonly excerpt_count: number;
    readonly source_count: number;
    // The ratification AuditEvent is part of the same write so the
    // durable state never carries a ratified record without its
    // attribution chain.
    readonly ratification_audit_event: 1;
  };
  // Doctrine.
  readonly trust_label_on_durable_write: typeof PINNED_DURABLE_WRITE_TRUST_LABEL;
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  // Safety contract for the eventual execution.
  readonly idempotency_key_shape: string;
  readonly retry_budget: 0;
  readonly rollback_semantics: "single-transaction-or-noop";
  // Per-record authorization state. The contract does not flip these.
  readonly authorizes_durable_write: false;
  readonly durable_write_performed: false;
}

// The typed shape of the future approval packet that would arm exactly
// one durable write under this contract. The next slice produces an
// approval packet that must conform to this shape and reference this
// contract's `contract_artifact_id`.
export interface WorkshopProposalDurableWriteApprovalPacketShape {
  readonly required_kind: "workshop-public-proposal-durable-graph-write-approval-packet";
  readonly must_reference_contract_artifact_id: string;
  readonly must_reference_ratification_plan_proposal_set_id: string;
  readonly must_pin_candidate_item_ids: readonly string[];
  readonly max_durable_writes: 1;
  readonly max_attempts: 1;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  readonly expiry_required: true;
  readonly operator_arming_required: true;
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof PINNED_TARGET_STORE;
}

export interface WorkshopProposalDurableGraphWriteContractCounts {
  readonly accepted_candidate_count: number;
  readonly planned_candidate_count: number;
  readonly contracted_candidate_count: number;
  readonly ratified_candidate_count: 0;
  readonly durable_write_count: 0;
}

export interface WorkshopProposalDurableGraphWriteContractArtifact {
  readonly kind: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME;
  readonly current_effective_authorization: "none";
  readonly contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly planned_at: string;
  readonly contracted_at: string;
  readonly source_plan_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME;
  readonly next_required_contract: typeof NEXT_REQUIRED_CONTRACT;
  readonly boundaries: WorkshopProposalDurableGraphWriteContractBoundaries;
  readonly write_operations: readonly WorkshopProposalDurableWriteOperationShape[];
  readonly approval_packet_shape: WorkshopProposalDurableWriteApprovalPacketShape;
  readonly counts: WorkshopProposalDurableGraphWriteContractCounts;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];

type PlainRecord = Readonly<Record<string, unknown>>;

interface SnapshotCandidatePlan {
  readonly item_id: string;
  readonly lens: WorkshopLens;
  readonly reviewed_at: string;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
}

interface SnapshotPlan {
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly planned_at: string;
  readonly candidates: readonly SnapshotCandidatePlan[];
  readonly counts: {
    readonly accepted_candidate_count: number;
    readonly planned_candidate_count: number;
    readonly ratified_candidate_count: 0;
    readonly durable_write_count: 0;
  };
}

function reject(message: string): never {
  throw new Error(`durable-write contract rejected: ${message}`);
}

function snapshotPlainRecord(value: unknown, label: string): PlainRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    reject(`${label} must be a plain own-data object`);
  }

  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    reject(`${label} descriptors unavailable`);
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    reject(`${label} must not carry symbol keys`);
  }

  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      reject(`${label} contains unsafe key`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      reject(`${label} must be a plain own-data object`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function snapshotArray(value: unknown, label: string, maxLength: number): readonly unknown[] {
  if (!Array.isArray(value)) {
    reject(`${label} must be an array`);
  }

  let length: number;
  try {
    length = value.length;
  } catch {
    reject(`${label} length unavailable`);
  }

  if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) {
    reject(`${label} length invalid`);
  }

  const out: unknown[] = [];
  for (let i = 0; i < length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      reject(`${label} must contain only enumerable own data items`);
    }
    out.push(descriptor.value);
  }
  return Object.freeze(out);
}

function requireString(record: PlainRecord, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    reject(`${label}.${key} must be a string`);
  }
  return value;
}

function requireSafeId(record: PlainRecord, key: string, label: string): string {
  const value = requireString(record, key, label);
  if (!SAFE_ID.test(value)) {
    reject(`${label}.${key} malformed`);
  }
  return value;
}

function requireIsoTimestamp(record: PlainRecord, key: string, label: string): string {
  const value = requireString(record, key, label);
  if (!isValidIsoTimestamp(value)) {
    reject(`${label}.${key} malformed`);
  }
  return value;
}

function requireExact(record: PlainRecord, key: string, expected: unknown, label: string): void {
  if (record[key] !== expected) {
    reject(`${label}.${key} not ${JSON.stringify(expected)}`);
  }
}

function requireCount(record: PlainRecord, key: string, expected: number, label: string): void {
  const value = record[key];
  if (value !== expected) {
    reject(`${label}.${key} not ${expected}`);
  }
}

function requireNumber(record: PlainRecord, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    reject(`${label}.${key} must be a non-negative safe integer`);
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

function assertChronology(reviewedAt: string, plannedAt: string, contractedAt: string): void {
  const reviewed = new Date(reviewedAt).getTime();
  const planned = new Date(plannedAt).getTime();
  const contracted = new Date(contractedAt).getTime();
  if (planned < reviewed) {
    reject("upstream planned_at precedes reviewed_at");
  }
  if (contracted < planned) {
    reject("contractedAt precedes upstream planned_at");
  }
}

function frozenStringArray(input: unknown, label: string): readonly string[] {
  const raw = snapshotArray(input, label, 100);
  if (raw.length === 0) {
    reject(`${label} must not be empty`);
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !SAFE_ID.test(item)) {
      reject(`${label} contains malformed ref id`);
    }
    out.push(item);
  }
  return Object.freeze(out);
}

function snapshotCandidate(raw: unknown, reviewedAt: string, index: number): SnapshotCandidatePlan {
  const candidate = snapshotPlainRecord(raw, `candidate[${index}]`);
  const itemId = requireSafeId(candidate, "item_id", `candidate[${index}]`);
  const lens = requireString(candidate, "lens", `candidate[${index}]`);
  if (!LENSES.includes(lens as WorkshopLens)) {
    reject(`candidate[${index}].lens unknown`);
  }
  requireExact(candidate, "source_decision", "accept_for_graph_candidate", `candidate[${index}]`);
  requireExact(candidate, "reviewed_at", reviewedAt, `candidate[${index}]`);
  const accountObjectId = requireSafeId(candidate, "account_object_id", `candidate[${index}]`);
  if (accountObjectId !== itemId) {
    reject(`candidate[${index}].account_object_id must match item_id`);
  }
  requireExact(candidate, "ratification_status", "awaiting_separate_ratification", `candidate[${index}]`);
  requireExact(candidate, "planned_write_operation", "none", `candidate[${index}]`);
  requireExact(candidate, "candidate_only", true, `candidate[${index}]`);
  requireExact(candidate, "requires_separate_ratification_approval", true, `candidate[${index}]`);
  requireExact(candidate, "authorizes_graph_ingestion", false, `candidate[${index}]`);
  requireExact(candidate, "graph_ingestion_performed", false, `candidate[${index}]`);
  requireExact(candidate, "authorizes_durable_write", false, `candidate[${index}]`);
  requireExact(candidate, "durable_write_performed", false, `candidate[${index}]`);

  return Object.freeze({
    item_id: itemId,
    lens: lens as WorkshopLens,
    reviewed_at: reviewedAt,
    account_object_id: accountObjectId,
    claim_ids: frozenStringArray(candidate.claim_ids, `candidate[${index}].claim_ids`),
    excerpt_ids: frozenStringArray(candidate.excerpt_ids, `candidate[${index}].excerpt_ids`),
    source_ids: frozenStringArray(candidate.source_ids, `candidate[${index}].source_ids`),
  });
}

function snapshotPlan(plan: WorkshopProposalRatificationPlanArtifact): SnapshotPlan {
  const root = snapshotPlainRecord(plan, "ratification_plan");
  requireExact(root, "kind", WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME, "ratification_plan");
  requireExact(root, "current_effective_authorization", "none", "ratification_plan");
  requireExact(root, "next_required_contract", "reviewed-candidate-durable-graph-write", "ratification_plan");
  requireExact(root, "disposable", true, "ratification_plan");
  requireExact(root, "private_evidence_read", false, "ratification_plan");
  requireExact(root, "graph_ingestion_performed", false, "ratification_plan");
  requireExact(root, "durable_writes_performed", false, "ratification_plan");
  requireExact(root, "production_writes", false, "ratification_plan");
  requireExact(root, "readiness_claim", false, "ratification_plan");
  requireCount(root, "provider_calls_made", 0, "ratification_plan");

  const boundaries = snapshotPlainRecord(root.boundaries, "ratification_plan.boundaries");
  requireExact(boundaries, "current_effective_authorization", "none", "ratification_plan.boundaries");
  requireCount(boundaries, "provider_calls_executed", 0, "ratification_plan.boundaries");
  for (const marker of [
    "authorizes_provider_call",
    "authorizes_private_evidence_read",
    "authorizes_graph_ingestion",
    "graph_ingestion_performed",
    "private_evidence_read",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
    "authorizes_reviewed_candidate_durable_write",
    "reviewed_candidate_durable_write_performed",
    "ratification_performed",
  ]) {
    requireExact(boundaries, marker, false, "ratification_plan.boundaries");
  }
  requireExact(boundaries, "plan_only", true, "ratification_plan.boundaries");
  requireExact(boundaries, "requires_separate_ratification_approval", true, "ratification_plan.boundaries");

  const reviewedAt = requireIsoTimestamp(root, "reviewed_at", "ratification_plan");
  const plannedAt = requireIsoTimestamp(root, "planned_at", "ratification_plan");
  const proposalSetId = requireSafeId(root, "proposal_set_id", "ratification_plan");
  const accountId = requireSafeId(root, "account_id", "ratification_plan");

  const rawCandidates = snapshotArray(root.candidates, "ratification_plan.candidates", 100);
  if (rawCandidates.length === 0) {
    reject("ratification plan carries zero candidates");
  }
  const candidates = Object.freeze(
    rawCandidates.map((candidate, index) => snapshotCandidate(candidate, reviewedAt, index)),
  );

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.item_id)) {
      reject("ratification plan carries duplicate candidate item_id");
    }
    seen.add(candidate.item_id);
  }

  const counts = snapshotPlainRecord(root.counts, "ratification_plan.counts");
  const acceptedCandidateCount = requireNumber(
    counts,
    "accepted_candidate_count",
    "ratification_plan.counts",
  );
  const plannedCandidateCount = requireNumber(
    counts,
    "planned_candidate_count",
    "ratification_plan.counts",
  );
  requireCount(counts, "ratified_candidate_count", 0, "ratification_plan.counts");
  requireCount(counts, "durable_write_count", 0, "ratification_plan.counts");
  if (acceptedCandidateCount !== candidates.length || plannedCandidateCount !== candidates.length) {
    reject("ratification plan counts must match candidate count");
  }

  return Object.freeze({
    proposal_set_id: proposalSetId,
    account_id: accountId,
    reviewed_at: reviewedAt,
    planned_at: plannedAt,
    candidates,
    counts: Object.freeze({
      accepted_candidate_count: acceptedCandidateCount,
      planned_candidate_count: plannedCandidateCount,
      ratified_candidate_count: 0 as const,
      durable_write_count: 0 as const,
    }),
  });
}

function buildIdempotencyKeyShape(accountId: string, accountObjectId: string): string {
  // Static descriptor of the eventual idempotency key the executor will
  // compute. The contract does not compute the runtime key; it commits
  // to the shape so the future approval packet and executor can both
  // be validated against the same template.
  return `${accountId}:${accountObjectId}:ratified-durable-write-v1`;
}

function buildContractArtifactId(proposalSetId: string, contractedAt: string): string {
  // Deterministic, descriptive, no provenance leak. The format is
  // stable so the next slice (approval packet) can reference it
  // verbatim and any reviewer can recompute it from the same inputs.
  return `durable-write-contract:${proposalSetId}:${contractedAt}`;
}

function candidateToWriteOperation(
  candidate: SnapshotCandidatePlan,
  accountId: string,
): WorkshopProposalDurableWriteOperationShape {
  return Object.freeze({
    candidate_item_id: candidate.item_id,
    lens: candidate.lens,
    account_object_id: candidate.account_object_id,
    claim_ids: candidate.claim_ids,
    excerpt_ids: candidate.excerpt_ids,
    source_ids: candidate.source_ids,
    target_store: PINNED_TARGET_STORE,
    target_record_counts: Object.freeze({
      account_object: 1 as const,
      claim_count: candidate.claim_ids.length,
      excerpt_count: candidate.excerpt_ids.length,
      source_count: candidate.source_ids.length,
      ratification_audit_event: 1 as const,
    }),
    trust_label_on_durable_write: PINNED_DURABLE_WRITE_TRUST_LABEL,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    idempotency_key_shape: buildIdempotencyKeyShape(accountId, candidate.account_object_id),
    retry_budget: 0 as const,
    rollback_semantics: "single-transaction-or-noop" as const,
    authorizes_durable_write: false as const,
    durable_write_performed: false as const,
  });
}

export function buildWorkshopPublicProposalDurableGraphWriteContractArtifact(
  plan: WorkshopProposalRatificationPlanArtifact,
  contractedAt: string,
): WorkshopProposalDurableGraphWriteContractArtifact {
  const snapshot = snapshotPlan(plan);
  if (typeof contractedAt !== "string" || !isValidIsoTimestamp(contractedAt)) {
    reject("contractedAt malformed");
  }
  assertChronology(snapshot.reviewed_at, snapshot.planned_at, contractedAt);

  const writeOperations = Object.freeze(
    snapshot.candidates.map((candidate) =>
      candidateToWriteOperation(candidate, snapshot.account_id),
    ),
  );
  const candidateItemIds = Object.freeze(
    writeOperations.map((op) => op.candidate_item_id),
  );
  const contractArtifactId = buildContractArtifactId(snapshot.proposal_set_id, contractedAt);

  const approvalPacketShape: WorkshopProposalDurableWriteApprovalPacketShape =
    Object.freeze({
      required_kind:
        "workshop-public-proposal-durable-graph-write-approval-packet" as const,
      must_reference_contract_artifact_id: contractArtifactId,
      must_reference_ratification_plan_proposal_set_id: snapshot.proposal_set_id,
      must_pin_candidate_item_ids: candidateItemIds,
      max_durable_writes: 1 as const,
      max_attempts: 1 as const,
      retry_budget: 0 as const,
      retry_requires_new_approval: true as const,
      expiry_required: true as const,
      operator_arming_required: true as const,
      mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
      target_store: PINNED_TARGET_STORE,
    });

  return Object.freeze({
    kind: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_SCHEMA_VERSION,
    disposable: true,
    generated_from: WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME,
    current_effective_authorization: "none",
    contract_artifact_id: contractArtifactId,
    proposal_set_id: snapshot.proposal_set_id,
    account_id: snapshot.account_id,
    reviewed_at: snapshot.reviewed_at,
    planned_at: snapshot.planned_at,
    contracted_at: contractedAt,
    source_plan_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME,
    next_required_contract: NEXT_REQUIRED_CONTRACT,
    boundaries: Object.freeze({
      current_effective_authorization: "none" as const,
      authorizes_provider_call: false as const,
      authorizes_private_evidence_read: false as const,
      authorizes_graph_ingestion: false as const,
      graph_ingestion_performed: false as const,
      provider_calls_executed: 0 as const,
      private_evidence_read: false as const,
      durable_writes_performed: false as const,
      production_writes: false as const,
      readiness_claim: false as const,
      defines_durable_write_contract: true as const,
      authorizes_durable_write_execution: false as const,
      durable_write_execution_performed: false as const,
      requires_separate_durable_write_approval_packet: true as const,
      ratification_performed: false as const,
      plan_only: true as const,
      requires_separate_ratification_approval: true as const,
    }),
    write_operations: writeOperations,
    approval_packet_shape: approvalPacketShape,
    counts: Object.freeze({
      accepted_candidate_count: snapshot.counts.accepted_candidate_count,
      planned_candidate_count: snapshot.counts.planned_candidate_count,
      contracted_candidate_count: writeOperations.length,
      ratified_candidate_count: 0 as const,
      durable_write_count: 0 as const,
    }),
    provider_calls_made: 0 as const,
    private_evidence_read: false as const,
    graph_ingestion_performed: false as const,
    durable_writes_performed: false as const,
    production_writes: false as const,
    readiness_claim: false as const,
  });
}
