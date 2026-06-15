// Workshop public proposal — operator-arming of the durable graph-write
// approval packet.
//
// M3 step 3a (operator directive of 2026-06-12, sharpening 2026-06-14).
// Consumes the M3 step 2 DRAFTED approval packet plus an operator
// identity and an armed_at timestamp, and produces an ARMED packet
// artifact whose effect is to authorize EXACTLY ONE attempt of the
// separate durable-write executor under this arming.
//
// This module performs no durable write, no graph ingestion, no
// provider call. It DOES flip authorizes_durable_write_execution from
// false to true — on this artifact only. The flip is one-shot: the
// arming carries attempts_remaining: 1 at construction; consumption of
// the arming (the actual write attempt) is tracked by the executor.
//
// Doctrine alignment (ADR 0003): arming is the deterministic
// precondition that lets the L0 system action proceed. Arming itself
// does not perform an L0 effect; it gates one. The mediation_gate_level
// is recorded here as the level the executor will operate at, not as a
// claim that an effect occurred.
//
// Operator identity discipline (operator directive 2026-06-14): this
// module models exactly one attributable ratifier — a single string
// field. No roles, no sessions, no permissions, no group lookups. That
// scope is M6, and this slice touching it beyond a single identity
// field is the M3/M6 boundary leaking.

import {
  PINNED_MEDIATION_GATE_LEVEL,
  PINNED_TARGET_STORE,
} from "./proposal-durable-graph-write-contract.ts";
import {
  APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT,
  DRAFTED_LIFECYCLE_STATE,
  OPERATOR_ARMING_ACTION_KIND,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
  type WorkshopProposalDurableWriteApprovalPacketArtifact,
  type WorkshopProposalApprovalPacketWriteScope,
} from "./proposal-durable-graph-write-approval-packet.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME =
  "workshop-public-proposal-durable-graph-write-operator-arming" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_durable_graph_write_operator_arming.v1" as const;

export const ARMED_LIFECYCLE_STATE = "operator-armed" as const;

// The next required contract after arming is the durable-write execution
// slice — which consumes this arming exactly once.
export const ARMING_NEXT_REQUIRED_CONTRACT =
  "reviewed-candidate-durable-graph-write-execution" as const;

export interface WorkshopProposalOperatorArmingBoundaries {
  // The flip lives HERE and only here. Every other boundary stays closed.
  readonly authorizes_durable_write_execution: true;
  // What stays closed.
  readonly current_effective_authorization:
    | "single-armed-durable-write-attempt";
  readonly authorizes_provider_call: false;
  readonly authorizes_private_evidence_read: false;
  readonly authorizes_graph_ingestion_beyond_single_armed_write: false;
  readonly graph_ingestion_performed: false;
  readonly durable_write_execution_performed: false;
  readonly durable_writes_performed: false;
  readonly provider_calls_executed: 0;
  readonly private_evidence_read: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
  // Arming markers.
  readonly operator_armed: true;
  readonly arming_is_one_shot: true;
  readonly arming_is_revocable_before_consumption: true;
  // Inherited closed markers.
  readonly ratification_performed_against_durable_state: false;
}

export interface WorkshopProposalOperatorArmingConsumption {
  // The arming is born with exactly one attempt available. The executor
  // decrements this when it consumes the arming.
  readonly attempts_remaining: 1;
  readonly attempts_consumed: 0;
  readonly durable_writes_performed: 0;
  readonly mediation_gate_level_when_consumed: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly l0_effect_observed: false;
}

export interface WorkshopProposalOperatorArmingArtifact {
  readonly kind: typeof WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME;
  // The single attributable ratifier. One field. No roles, sessions, or
  // permissions are modeled here; that is M6.
  readonly operator_identity: string;
  readonly required_action_kind: typeof OPERATOR_ARMING_ACTION_KIND;
  readonly approval_id: string;
  readonly lifecycle_state: typeof ARMED_LIFECYCLE_STATE;
  readonly contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly drafted_at: string;
  readonly armed_at: string;
  readonly expires_at: string;
  readonly source_approval_packet_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME;
  readonly next_required_contract: typeof ARMING_NEXT_REQUIRED_CONTRACT;
  readonly authorized_candidate_item_ids: readonly string[];
  readonly mediation_gate_level: typeof PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof PINNED_TARGET_STORE;
  readonly boundaries: WorkshopProposalOperatorArmingBoundaries;
  readonly write_scopes: readonly WorkshopProposalApprovalPacketWriteScope[];
  readonly consumption: WorkshopProposalOperatorArmingConsumption;
}

export interface WorkshopProposalOperatorArmingParams {
  readonly operatorIdentity: string;
  readonly armedAt: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const SAFE_OPERATOR_IDENTITY = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

type PlainRecord = Readonly<Record<string, unknown>>;

function reject(message: string): never {
  throw new Error(`operator arming rejected: ${message}`);
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
  if (!Array.isArray(value)) reject(`${label} must be an array`);
  const length = value.length;
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
  if (typeof value !== "string") reject(`${label}.${key} must be a string`);
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

interface SnapshotPacket {
  readonly approval_id: string;
  readonly contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly drafted_at: string;
  readonly expires_at: string;
  readonly pinned_candidate_item_ids: readonly string[];
  readonly write_scopes: readonly WorkshopProposalApprovalPacketWriteScope[];
}

function snapshotPacket(
  packet: WorkshopProposalDurableWriteApprovalPacketArtifact,
): SnapshotPacket {
  const root = snapshotPlainRecord(packet, "packet");

  // Refuse anything that is not the drafted packet shape this module
  // gates. The discipline is: the only thing we can arm is an
  // unmolested drafted packet. Any deviation in shape is a refusal.
  requireExact(root, "kind", WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME, "packet");
  requireExact(root, "current_effective_authorization", "none", "packet");
  requireExact(root, "lifecycle_state", DRAFTED_LIFECYCLE_STATE, "packet");
  requireExact(root, "armed_at", null, "packet");
  requireExact(root, "next_required_contract", APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT, "packet");
  requireExact(root, "mediation_gate_level", PINNED_MEDIATION_GATE_LEVEL, "packet");
  requireExact(root, "target_store", PINNED_TARGET_STORE, "packet");

  const boundaries = snapshotPlainRecord(root.boundaries, "packet.boundaries");
  for (const closedMarker of [
    "authorizes_provider_call",
    "authorizes_private_evidence_read",
    "authorizes_graph_ingestion",
    "graph_ingestion_performed",
    "operator_armed",
    "authorizes_durable_write_execution",
    "durable_write_execution_performed",
    "arming_performed_by_this_artifact",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
    "ratification_performed",
    "private_evidence_read",
  ] as const) {
    requireExact(boundaries, closedMarker, false, "packet.boundaries");
  }
  requireExact(boundaries, "current_effective_authorization", "none", "packet.boundaries");
  requireExact(boundaries, "requires_operator_arming", true, "packet.boundaries");
  requireExact(boundaries, "defines_arming_surface", true, "packet.boundaries");

  const approvalId = requireString(root, "approval_id", "packet");
  if (!SAFE_ID.test(approvalId)) reject("packet.approval_id malformed");
  const contractArtifactId = requireString(root, "contract_artifact_id", "packet");
  if (!contractArtifactId.startsWith("durable-write-contract:") || contractArtifactId.includes("..")) {
    reject("packet.contract_artifact_id malformed");
  }
  const proposalSetId = requireString(root, "proposal_set_id", "packet");
  if (!SAFE_ID.test(proposalSetId)) reject("packet.proposal_set_id malformed");
  const accountId = requireString(root, "account_id", "packet");
  if (!SAFE_ID.test(accountId)) reject("packet.account_id malformed");
  const draftedAt = requireIsoTimestampValue(root.drafted_at, "packet.drafted_at");
  const expiresAt = requireIsoTimestampValue(root.expires_at, "packet.expires_at");

  // Pinned candidate ids must equal the write_scopes' ids, by content
  // and order — refuse any drift.
  const rawIds = snapshotArray(root.pinned_candidate_item_ids, "packet.pinned_candidate_item_ids", 100);
  const pinnedIds: string[] = [];
  for (const item of rawIds) {
    if (typeof item !== "string" || !SAFE_ID.test(item)) {
      reject("packet.pinned_candidate_item_ids contains malformed id");
    }
    pinnedIds.push(item);
  }

  const rawScopes = snapshotArray(root.write_scopes, "packet.write_scopes", 100);
  if (rawScopes.length === 0) reject("packet carries zero write scopes");
  if (rawScopes.length !== pinnedIds.length) {
    reject("packet.write_scopes length disagrees with pinned candidate ids");
  }
  const writeScopes: WorkshopProposalApprovalPacketWriteScope[] = [];
  rawScopes.forEach((raw, index) => {
    const scope = snapshotPlainRecord(raw, `packet.write_scopes[${index}]`);
    requireExact(scope, "target_store", PINNED_TARGET_STORE, `packet.write_scopes[${index}]`);
    requireExact(scope, "mediation_gate_level", PINNED_MEDIATION_GATE_LEVEL, `packet.write_scopes[${index}]`);
    const candidateItemId = requireString(scope, "candidate_item_id", `packet.write_scopes[${index}]`);
    if (candidateItemId !== pinnedIds[index]) {
      reject(`packet.write_scopes[${index}] does not match pinned candidate id`);
    }
    // Preserve the scope as-is: the contract already validated it, and
    // this slice intentionally does not narrow or widen.
    writeScopes.push(raw as WorkshopProposalApprovalPacketWriteScope);
  });

  return Object.freeze({
    approval_id: approvalId,
    contract_artifact_id: contractArtifactId,
    proposal_set_id: proposalSetId,
    account_id: accountId,
    drafted_at: draftedAt,
    expires_at: expiresAt,
    pinned_candidate_item_ids: Object.freeze(pinnedIds),
    write_scopes: Object.freeze(writeScopes),
  });
}

export function buildWorkshopPublicProposalOperatorArming(
  packet: WorkshopProposalDurableWriteApprovalPacketArtifact,
  params: WorkshopProposalOperatorArmingParams,
): WorkshopProposalOperatorArmingArtifact {
  const snapshot = snapshotPacket(packet);

  const paramsRecord = snapshotPlainRecord(params, "params");
  const operatorIdentity = requireString(paramsRecord, "operatorIdentity", "params");
  if (!SAFE_OPERATOR_IDENTITY.test(operatorIdentity)) {
    reject("params.operatorIdentity malformed");
  }
  const armedAt = requireIsoTimestampValue(paramsRecord.armedAt, "params.armedAt");

  // Chronology: arming happens at or after drafting and strictly before
  // expiry. Arming at or after the expiry instant is a refusal — an
  // expired packet cannot be armed.
  const drafted = new Date(snapshot.drafted_at).getTime();
  const armed = new Date(armedAt).getTime();
  const expires = new Date(snapshot.expires_at).getTime();
  if (armed < drafted) reject("armedAt precedes packet drafted_at");
  if (armed >= expires) reject("armedAt is at or after packet expires_at");

  return Object.freeze({
    kind: WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_SCHEMA_VERSION,
    disposable: true,
    generated_from: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
    operator_identity: operatorIdentity,
    required_action_kind: OPERATOR_ARMING_ACTION_KIND,
    approval_id: snapshot.approval_id,
    lifecycle_state: ARMED_LIFECYCLE_STATE,
    contract_artifact_id: snapshot.contract_artifact_id,
    proposal_set_id: snapshot.proposal_set_id,
    account_id: snapshot.account_id,
    drafted_at: snapshot.drafted_at,
    armed_at: armedAt,
    expires_at: snapshot.expires_at,
    source_approval_packet_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
    next_required_contract: ARMING_NEXT_REQUIRED_CONTRACT,
    authorized_candidate_item_ids: snapshot.pinned_candidate_item_ids,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    target_store: PINNED_TARGET_STORE,
    boundaries: Object.freeze({
      // The flip. Authorized for execution, on this artifact only.
      authorizes_durable_write_execution: true as const,
      // What stays closed.
      current_effective_authorization: "single-armed-durable-write-attempt" as const,
      authorizes_provider_call: false as const,
      authorizes_private_evidence_read: false as const,
      authorizes_graph_ingestion_beyond_single_armed_write: false as const,
      graph_ingestion_performed: false as const,
      durable_write_execution_performed: false as const,
      durable_writes_performed: false as const,
      provider_calls_executed: 0 as const,
      private_evidence_read: false as const,
      production_writes: false as const,
      readiness_claim: false as const,
      operator_armed: true as const,
      arming_is_one_shot: true as const,
      arming_is_revocable_before_consumption: true as const,
      ratification_performed_against_durable_state: false as const,
    }),
    write_scopes: snapshot.write_scopes,
    consumption: Object.freeze({
      attempts_remaining: 1 as const,
      attempts_consumed: 0 as const,
      durable_writes_performed: 0 as const,
      mediation_gate_level_when_consumed: PINNED_MEDIATION_GATE_LEVEL,
      // L0 has not occurred yet — arming does not itself constitute an
      // L0 effect.
      l0_effect_observed: false as const,
    }),
  });
}
