// Workshop public proposal — no-call durable graph-write approval packet.
//
// M3 step 2 (operator directive of 2026-06-12). Consumes the no-call
// durable graph-write contract artifact (M3 step 1) and produces a
// disposable, DRAFTED approval packet plus the typed shape of the
// operator-arming action that a future operator step would perform.
//
// This module performs no durable write, no graph ingestion, no
// provider call, reads no private evidence, and — critically — never
// arms anything. The packet it emits is always `lifecycle_state:
// "drafted"` with `operator_armed: false`; there is no parameter, mode,
// or code path in this module that produces an armed packet. Arming is
// a separate operator action whose required shape this module DEFINES
// (the `arming_surface`) but never executes.
//
// Doctrine alignment (ADR 0003): the eventual durable write is a
// deterministic L0 system action. This packet, even once armed by a
// later operator step, only authorizes the separate write-execution
// slice to run; it never itself runs a write. current_effective_
// authorization stays "none" for a drafted packet.

import {
  PINNED_DURABLE_WRITE_TRUST_LABEL,
  PINNED_MEDIATION_GATE_LEVEL,
  PINNED_TARGET_STORE,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME,
  type WorkshopProposalDurableGraphWriteContractArtifact,
} from "./proposal-durable-graph-write-contract.ts";
import type { WorkshopLens } from "./view-model.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME =
  "workshop-public-proposal-durable-graph-write-approval-packet" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_durable_graph_write_approval_packet.v1" as const;

// The only lifecycle state this module can emit. The consumable-approval
// lifecycle is drafted -> operator-armed -> consumed/expired; this
// module produces the FIRST state only. Arming and consumption are
// separate operator/executor actions in later slices.
export const DRAFTED_LIFECYCLE_STATE = "drafted" as const;

// The action kind a future operator-arming step must declare. Defined
// here so the arming surface is auditable; never invoked here.
export const OPERATOR_ARMING_ACTION_KIND =
  "workshop-public-proposal-durable-graph-write-operator-arming" as const;

// The next required contract after this packet is the actual durable
// write execution slice — which only runs after a separate operator
// arming action transitions this packet to operator-armed.
export const APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT =
  "reviewed-candidate-durable-graph-write-execution" as const;

export interface WorkshopProposalDurableWriteApprovalPacketBoundaries {
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
  // Packet-specific markers.
  readonly defines_arming_surface: true;
  // The load-bearing pair: a drafted packet is not armed and does not
  // authorize execution. Arming is a separate operator action; the
  // write is a separate slice after that.
  readonly operator_armed: false;
  readonly requires_operator_arming: true;
  readonly authorizes_durable_write_execution: false;
  readonly durable_write_execution_performed: false;
  readonly arming_performed_by_this_artifact: false;
  // Inherited closed markers, restated for one-block auditability.
  readonly ratification_performed: false;
  readonly requires_separate_ratification_approval: true;
}

// The pinned per-candidate write scope this packet would authorize ONE
// attempt of, once armed. Copied from the contract's write operations;
// the packet never widens the scope.
export interface WorkshopProposalApprovalPacketWriteScope {
  readonly candidate_item_id: string;
  readonly lens: WorkshopLens;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly target_store: typeof PINNED_TARGET_STORE;
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly trust_label_on_durable_write: string;
  readonly idempotency_key_shape: string;
}

// The typed shape of the operator-arming action that a later step must
// perform to transition this packet to operator-armed. DEFINED here,
// never executed here.
export interface WorkshopProposalDurableWriteArmingSurface {
  readonly required_action_kind: typeof OPERATOR_ARMING_ACTION_KIND;
  readonly must_reference_approval_id: string;
  readonly must_match_contract_artifact_id: string;
  readonly must_be_invoked_by_operator_identity: true;
  readonly must_occur_before_expires_at: string;
  readonly transitions_lifecycle_from: typeof DRAFTED_LIFECYCLE_STATE;
  readonly transitions_lifecycle_to: "operator-armed";
  // What arming grants, stated narrowly: it lets the SEPARATE
  // write-execution slice attempt exactly one durable write under this
  // packet. Arming does not itself write.
  readonly on_arming_authorizes: "single-durable-write-attempt-under-this-packet";
  readonly still_requires_separate_write_execution_slice: true;
  readonly arming_is_revocable_before_consumption: true;
  // Restated closed markers so the arming surface cannot be misread as
  // a grant beyond a single armed attempt.
  readonly arming_grants_provider_call: false;
  readonly arming_grants_graph_ingestion_beyond_single_write: false;
  readonly arming_grants_production_write: false;
  readonly arming_grants_readiness_claim: false;
}

export interface WorkshopProposalDurableWriteApprovalPacketCounts {
  readonly contracted_candidate_count: number;
  readonly pinned_candidate_count: number;
  readonly armed_count: 0;
  readonly durable_write_count: 0;
}

export interface WorkshopProposalDurableWriteApprovalPacketArtifact {
  readonly kind: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME;
  readonly current_effective_authorization: "none";
  readonly approval_id: string;
  readonly lifecycle_state: typeof DRAFTED_LIFECYCLE_STATE;
  readonly contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly planned_at: string;
  readonly contracted_at: string;
  readonly drafted_at: string;
  readonly expires_at: string;
  readonly armed_at: null;
  readonly source_contract_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME;
  readonly next_required_contract: typeof APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT;
  readonly pinned_candidate_item_ids: readonly string[];
  readonly max_durable_writes: 1;
  readonly max_attempts: 1;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof PINNED_TARGET_STORE;
  readonly boundaries: WorkshopProposalDurableWriteApprovalPacketBoundaries;
  readonly write_scopes: readonly WorkshopProposalApprovalPacketWriteScope[];
  readonly arming_surface: WorkshopProposalDurableWriteArmingSurface;
  readonly counts: WorkshopProposalDurableWriteApprovalPacketCounts;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

export interface WorkshopProposalDurableWriteApprovalPacketParams {
  readonly approvalId: string;
  readonly draftedAt: string;
  readonly expiresAt: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];
const MAX_CANDIDATES = 100;

type PlainRecord = Readonly<Record<string, unknown>>;

function reject(message: string): never {
  throw new Error(`durable-write approval packet rejected: ${message}`);
}

// Descriptor-snapshot hardening (same discipline as the contract
// module; kept module-local pending the frozen H3 consolidation into
// src/safety/own-data-snapshot.ts). Reads only own enumerable data
// descriptors so a hostile accessor-backed input never has its getter
// invoked.
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

function requireExact(record: PlainRecord, key: string, expected: unknown, label: string): void {
  if (record[key] !== expected) {
    reject(`${label}.${key} not ${JSON.stringify(expected)}`);
  }
}

function isValidIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  const canonical = date.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function requireIsoTimestampValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !isValidIsoTimestamp(value)) {
    reject(`${label} malformed`);
  }
  return value;
}

function frozenSafeIdArray(input: unknown, label: string): readonly string[] {
  const raw = snapshotArray(input, label, MAX_CANDIDATES);
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

interface SnapshotWriteScope {
  readonly candidate_item_id: string;
  readonly lens: WorkshopLens;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly trust_label_on_durable_write: string;
  readonly idempotency_key_shape: string;
}

function snapshotWriteOperation(raw: unknown, index: number, accountId: string): SnapshotWriteScope {
  const op = snapshotPlainRecord(raw, `contract.write_operations[${index}]`);
  const candidateItemId = requireSafeId(op, "candidate_item_id", `write_operations[${index}]`);
  const lens = requireString(op, "lens", `write_operations[${index}]`);
  if (!LENSES.includes(lens as WorkshopLens)) {
    reject(`write_operations[${index}].lens unknown`);
  }
  const accountObjectId = requireSafeId(op, "account_object_id", `write_operations[${index}]`);
  if (accountObjectId !== candidateItemId) {
    reject(`write_operations[${index}].account_object_id must match candidate_item_id`);
  }
  // The contract pins these closed; the packet refuses to widen them.
  requireExact(op, "target_store", PINNED_TARGET_STORE, `write_operations[${index}]`);
  requireExact(op, "mediation_gate_level", PINNED_MEDIATION_GATE_LEVEL, `write_operations[${index}]`);
  requireExact(op, "retry_budget", 0, `write_operations[${index}]`);
  requireExact(op, "authorizes_durable_write", false, `write_operations[${index}]`);
  requireExact(op, "durable_write_performed", false, `write_operations[${index}]`);
  requireExact(
    op,
    "trust_label_on_durable_write",
    PINNED_DURABLE_WRITE_TRUST_LABEL,
    `write_operations[${index}]`,
  );
  const idempotencyKeyShape = requireString(op, "idempotency_key_shape", `write_operations[${index}]`);
  if (idempotencyKeyShape !== `${accountId}:${accountObjectId}:ratified-durable-write-v1`) {
    reject(`write_operations[${index}].idempotency_key_shape malformed`);
  }

  return Object.freeze({
    candidate_item_id: candidateItemId,
    lens: lens as WorkshopLens,
    account_object_id: accountObjectId,
    claim_ids: frozenSafeIdArray(op.claim_ids, `write_operations[${index}].claim_ids`),
    excerpt_ids: frozenSafeIdArray(op.excerpt_ids, `write_operations[${index}].excerpt_ids`),
    source_ids: frozenSafeIdArray(op.source_ids, `write_operations[${index}].source_ids`),
    trust_label_on_durable_write: PINNED_DURABLE_WRITE_TRUST_LABEL,
    idempotency_key_shape: idempotencyKeyShape,
  });
}

interface SnapshotContract {
  readonly contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly planned_at: string;
  readonly contracted_at: string;
  readonly pinned_candidate_item_ids: readonly string[];
  readonly write_scopes: readonly SnapshotWriteScope[];
  readonly contracted_candidate_count: number;
}

function snapshotContract(
  contract: WorkshopProposalDurableGraphWriteContractArtifact,
): SnapshotContract {
  const root = snapshotPlainRecord(contract, "contract");
  requireExact(root, "kind", WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME, "contract");
  requireExact(root, "current_effective_authorization", "none", "contract");
  requireExact(
    root,
    "next_required_contract",
    "reviewed-candidate-durable-graph-write-approval-packet",
    "contract",
  );
  requireExact(root, "disposable", true, "contract");
  requireExact(root, "graph_ingestion_performed", false, "contract");
  requireExact(root, "durable_writes_performed", false, "contract");
  requireExact(root, "production_writes", false, "contract");
  requireExact(root, "readiness_claim", false, "contract");
  requireExact(root, "private_evidence_read", false, "contract");

  // The contract's own boundary block must be fully closed.
  const boundaries = snapshotPlainRecord(root.boundaries, "contract.boundaries");
  for (const marker of [
    "authorizes_provider_call",
    "authorizes_private_evidence_read",
    "authorizes_graph_ingestion",
    "graph_ingestion_performed",
    "private_evidence_read",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
    "authorizes_durable_write_execution",
    "durable_write_execution_performed",
    "ratification_performed",
  ]) {
    requireExact(boundaries, marker, false, "contract.boundaries");
  }
  requireExact(boundaries, "current_effective_authorization", "none", "contract.boundaries");
  requireExact(boundaries, "defines_durable_write_contract", true, "contract.boundaries");
  requireExact(boundaries, "requires_separate_durable_write_approval_packet", true, "contract.boundaries");
  requireExact(boundaries, "plan_only", true, "contract.boundaries");

  const contractArtifactId = requireString(root, "contract_artifact_id", "contract");
  // contract_artifact_id is a composed id (contains ':' and an ISO
  // timestamp) — validate structurally without forcing SAFE_ID.
  if (!contractArtifactId.startsWith("durable-write-contract:") || contractArtifactId.includes("..")) {
    reject("contract.contract_artifact_id malformed");
  }
  const proposalSetId = requireSafeId(root, "proposal_set_id", "contract");
  const accountId = requireSafeId(root, "account_id", "contract");
  const reviewedAt = requireIsoTimestampValue(root.reviewed_at, "contract.reviewed_at");
  const plannedAt = requireIsoTimestampValue(root.planned_at, "contract.planned_at");
  const contractedAt = requireIsoTimestampValue(root.contracted_at, "contract.contracted_at");
  if (contractArtifactId !== `durable-write-contract:${proposalSetId}:${contractedAt}`) {
    reject("contract.contract_artifact_id does not match proposal_set_id and contracted_at");
  }

  // The approval_packet_shape the contract published — the packet must
  // conform to it exactly.
  const shape = snapshotPlainRecord(root.approval_packet_shape, "contract.approval_packet_shape");
  requireExact(
    shape,
    "required_kind",
    WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
    "contract.approval_packet_shape",
  );
  requireExact(shape, "must_reference_contract_artifact_id", contractArtifactId, "contract.approval_packet_shape");
  requireExact(shape, "must_reference_ratification_plan_proposal_set_id", proposalSetId, "contract.approval_packet_shape");
  requireExact(shape, "max_durable_writes", 1, "contract.approval_packet_shape");
  requireExact(shape, "max_attempts", 1, "contract.approval_packet_shape");
  requireExact(shape, "retry_budget", 0, "contract.approval_packet_shape");
  requireExact(shape, "retry_requires_new_approval", true, "contract.approval_packet_shape");
  requireExact(shape, "expiry_required", true, "contract.approval_packet_shape");
  requireExact(shape, "operator_arming_required", true, "contract.approval_packet_shape");
  requireExact(shape, "mediation_gate_level", PINNED_MEDIATION_GATE_LEVEL, "contract.approval_packet_shape");
  requireExact(shape, "target_store", PINNED_TARGET_STORE, "contract.approval_packet_shape");
  const mustPin = frozenSafeIdArray(shape.must_pin_candidate_item_ids, "contract.approval_packet_shape.must_pin_candidate_item_ids");

  // The write operations the packet will scope.
  const rawOps = snapshotArray(root.write_operations, "contract.write_operations", MAX_CANDIDATES);
  if (rawOps.length === 0) {
    reject("contract carries zero write operations");
  }
  const writeScopes = Object.freeze(rawOps.map((op, index) => snapshotWriteOperation(op, index, accountId)));

  // The shape's pinned ids must exactly equal the write operations'
  // candidate ids (order included), and carry no duplicates.
  const opIds = writeScopes.map((scope) => scope.candidate_item_id);
  if (mustPin.length !== opIds.length || mustPin.some((id, i) => id !== opIds[i])) {
    reject("contract pinned candidate ids do not match write operations");
  }
  const seen = new Set<string>();
  for (const id of opIds) {
    if (seen.has(id)) {
      reject("contract carries duplicate candidate item_id");
    }
    seen.add(id);
  }

  return Object.freeze({
    contract_artifact_id: contractArtifactId,
    proposal_set_id: proposalSetId,
    account_id: accountId,
    reviewed_at: reviewedAt,
    planned_at: plannedAt,
    contracted_at: contractedAt,
    pinned_candidate_item_ids: mustPin,
    write_scopes: writeScopes,
    contracted_candidate_count: writeScopes.length,
  });
}

export function buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(
  contract: WorkshopProposalDurableGraphWriteContractArtifact,
  params: WorkshopProposalDurableWriteApprovalPacketParams,
): WorkshopProposalDurableWriteApprovalPacketArtifact {
  const snapshot = snapshotContract(contract);

  const paramsRecord = snapshotPlainRecord(params, "params");
  const approvalId = requireSafeId(paramsRecord, "approvalId", "params");
  const draftedAt = requireIsoTimestampValue(paramsRecord.draftedAt, "params.draftedAt");
  const expiresAt = requireIsoTimestampValue(paramsRecord.expiresAt, "params.expiresAt");

  // Chronology: drafted no earlier than the contract was contracted;
  // expiry strictly after drafting (a zero/negative window is rejected).
  const contracted = new Date(snapshot.contracted_at).getTime();
  const drafted = new Date(draftedAt).getTime();
  const expires = new Date(expiresAt).getTime();
  if (drafted < contracted) {
    reject("draftedAt precedes contract contracted_at");
  }
  if (expires <= drafted) {
    reject("expiresAt must be strictly after draftedAt");
  }

  const writeScopes = Object.freeze(
    snapshot.write_scopes.map((scope) =>
      Object.freeze({
        candidate_item_id: scope.candidate_item_id,
        lens: scope.lens,
        account_object_id: scope.account_object_id,
        claim_ids: scope.claim_ids,
        excerpt_ids: scope.excerpt_ids,
        source_ids: scope.source_ids,
        target_store: PINNED_TARGET_STORE,
        mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
        trust_label_on_durable_write: scope.trust_label_on_durable_write,
        idempotency_key_shape: scope.idempotency_key_shape,
      }),
    ),
  );

  const armingSurface: WorkshopProposalDurableWriteArmingSurface = Object.freeze({
    required_action_kind: OPERATOR_ARMING_ACTION_KIND,
    must_reference_approval_id: approvalId,
    must_match_contract_artifact_id: snapshot.contract_artifact_id,
    must_be_invoked_by_operator_identity: true as const,
    must_occur_before_expires_at: expiresAt,
    transitions_lifecycle_from: DRAFTED_LIFECYCLE_STATE,
    transitions_lifecycle_to: "operator-armed" as const,
    on_arming_authorizes: "single-durable-write-attempt-under-this-packet" as const,
    still_requires_separate_write_execution_slice: true as const,
    arming_is_revocable_before_consumption: true as const,
    arming_grants_provider_call: false as const,
    arming_grants_graph_ingestion_beyond_single_write: false as const,
    arming_grants_production_write: false as const,
    arming_grants_readiness_claim: false as const,
  });

  return Object.freeze({
    kind: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_SCHEMA_VERSION,
    disposable: true,
    generated_from: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME,
    current_effective_authorization: "none",
    approval_id: approvalId,
    // Hard-coded. There is no parameter that produces any other
    // lifecycle state. Arming happens in a separate operator action.
    lifecycle_state: DRAFTED_LIFECYCLE_STATE,
    contract_artifact_id: snapshot.contract_artifact_id,
    proposal_set_id: snapshot.proposal_set_id,
    account_id: snapshot.account_id,
    reviewed_at: snapshot.reviewed_at,
    planned_at: snapshot.planned_at,
    contracted_at: snapshot.contracted_at,
    drafted_at: draftedAt,
    expires_at: expiresAt,
    // Hard null: a drafted packet has never been armed.
    armed_at: null,
    source_contract_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME,
    next_required_contract: APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT,
    pinned_candidate_item_ids: snapshot.pinned_candidate_item_ids,
    max_durable_writes: 1,
    max_attempts: 1,
    retry_budget: 0,
    retry_requires_new_approval: true,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    target_store: PINNED_TARGET_STORE,
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
      defines_arming_surface: true as const,
      operator_armed: false as const,
      requires_operator_arming: true as const,
      authorizes_durable_write_execution: false as const,
      durable_write_execution_performed: false as const,
      arming_performed_by_this_artifact: false as const,
      ratification_performed: false as const,
      requires_separate_ratification_approval: true as const,
    }),
    write_scopes: writeScopes,
    arming_surface: armingSurface,
    counts: Object.freeze({
      contracted_candidate_count: snapshot.contracted_candidate_count,
      pinned_candidate_count: snapshot.pinned_candidate_item_ids.length,
      armed_count: 0 as const,
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
