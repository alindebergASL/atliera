// Workshop M5a — curated-source proposal-flow operator arming.
//
// M5a step 3 (operator GO 2026-06-18). Consumes the M5a step 1
// contract, the M5a step 2 drafted-and-unarmed approval packet, and an
// explicit operator arming input. Produces an armed-state artifact that
// authorizes exactly one future curated proposal-flow execution.
//
// Boundary discipline: this slice arms only. It performs no flow
// execution, no durable write, no render, no provider call, no system-
// side acquisition, no private evidence read, and no readiness claim.
// It also stamps no mediation_gate_level on the arming artifact: L0 is
// only stamped by the eventual execution slice when a real effect occurs.

import { createHash } from "node:crypto";

import {
  M5A_PINNED_CURATION_ORIGIN,
  M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
  M5A_PINNED_ROW_TRUST_LABEL,
  M5A_PINNED_TARGET_STORE,
  M5aContractBuilderRefusal,
  requireCanonicalIsoTimestamp,
  requireSafeId,
  snapshotPlainArray,
  snapshotPlainOwnData,
  verifyM5aCuratedProposalFlowContract,
  type M5aCuratedProposalFlowContractArtifact,
} from "./m5a-curated-proposal-flow-contract.ts";
import {
  M5A_APPROVAL_PACKET_KIND,
  M5A_EVENTUAL_AUTHORIZATION_SCOPE,
  M5aApprovalPacketRefusal,
  verifyM5aCuratedProposalFlowApprovalPacket,
  type M5aCuratedProposalFlowApprovalPacketArtifact,
} from "./m5a-curated-proposal-flow-approval-packet.ts";

export const M5A_OPERATOR_ARMING_KIND =
  "m5a-curated-proposal-flow-operator-arming" as const;
export const M5A_OPERATOR_ARMING_SCHEMA_VERSION =
  "atliera.m5a_curated_proposal_flow_operator_arming.v1" as const;
export const M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE =
  "single-future-curated-proposal-flow-execution" as const;
export const M5A_OPERATOR_ARMING_NEXT_REQUIRED_CONTRACT =
  "m5a-curated-proposal-flow-execution" as const;

export class M5aOperatorArmingRefusal extends Error {
  constructor(public readonly detail: string) {
    super(`M5a operator arming refused: ${detail}`);
    this.name = "M5aOperatorArmingRefusal";
  }
}

export interface M5aOperatorArmingTrustTierPins {
  readonly required_row_trust_label: typeof M5A_PINNED_ROW_TRUST_LABEL;
  readonly required_per_record_provenance_status: typeof M5A_PINNED_PER_RECORD_PROVENANCE_STATUS;
  readonly forbidden_per_record_provenance_statuses: readonly ["verified"];
}

export interface M5aOperatorArmingBoundaries {
  readonly current_effective_authorization: typeof M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE;
  readonly operator_armed: true;
  readonly arming_is_one_shot: true;
  readonly authorizes_future_flow_execution: true;
  readonly max_flow_executions_authorized: 1;
  readonly remaining_flow_executions: 1;
  readonly consumed_flow_executions: 0;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  // Step 3 records no consumption. The future execution slice must
  // enforce these closed requirements around its durable effect.
  readonly one_shot_consumption_recorded: false;
  readonly step_4_must_check_expiry_at_execution: true;
  readonly step_4_must_atomically_consume_one_shot_key_in_durable_transaction: true;
  readonly step_4_must_refuse_replay_after_consumption: true;
  readonly authorizes_provider_call: false;
  readonly authorizes_system_side_acquisition: false;
  readonly authorizes_private_evidence_read: false;
  readonly authorizes_fresh_provider_call_on_flow_path: false;
  readonly authorizes_immediate_durable_write: false;
  readonly flow_execution_performed: false;
  readonly durable_write_execution_performed: false;
  readonly durable_writes_performed: false;
  readonly graph_ingestion_performed: false;
  readonly render_performed: false;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly system_side_acquisition_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

export interface M5aCuratedProposalFlowOperatorArmingArtifact {
  readonly kind: typeof M5A_OPERATOR_ARMING_KIND;
  readonly schema_version: typeof M5A_OPERATOR_ARMING_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof M5A_APPROVAL_PACKET_KIND;
  readonly arming_artifact_id: string;
  readonly one_shot_consumption_key: string;
  readonly packet_artifact_id: string;
  readonly references_contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly packet_lifecycle_before_arming: "drafted";
  readonly lifecycle: "armed";
  readonly armed: true;
  readonly consumed: false;
  readonly executed: false;
  readonly expired: false;
  readonly revoked: false;
  readonly armed_at: string;
  readonly armed_by: string;
  readonly packet_drafted_at: string;
  readonly packet_expires_at: string;
  readonly authorization_scope: typeof M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE;
  readonly eventual_authorization_scope: typeof M5A_EVENTUAL_AUTHORIZATION_SCOPE;
  readonly next_required_contract: typeof M5A_OPERATOR_ARMING_NEXT_REQUIRED_CONTRACT;
  readonly target_store: typeof M5A_PINNED_TARGET_STORE;
  readonly recorded_proposal_source_origin: typeof M5A_PINNED_CURATION_ORIGIN;
  readonly trust_tier_pins: M5aOperatorArmingTrustTierPins;
  readonly boundaries: M5aOperatorArmingBoundaries;
}

export interface BuildM5aOperatorArmingOptions {
  readonly armedAt: string;
  readonly armedBy: string;
}

const SAFE_OPERATOR_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,40}$/;
// Forty hex characters provide a 160-bit binding digest while keeping
// the longest valid operator/timestamp form below SAFE_ID's 121-character cap.
const ARMING_TUPLE_DIGEST_HEX_LENGTH = 40;

type PlainRecord = Readonly<Record<string, unknown>>;

const ARMING_ROOT_KEYS = [
  "kind",
  "schema_version",
  "disposable",
  "generated_from",
  "arming_artifact_id",
  "one_shot_consumption_key",
  "packet_artifact_id",
  "references_contract_artifact_id",
  "proposal_set_id",
  "account_id",
  "packet_lifecycle_before_arming",
  "lifecycle",
  "armed",
  "consumed",
  "executed",
  "expired",
  "revoked",
  "armed_at",
  "armed_by",
  "packet_drafted_at",
  "packet_expires_at",
  "authorization_scope",
  "eventual_authorization_scope",
  "next_required_contract",
  "target_store",
  "recorded_proposal_source_origin",
  "trust_tier_pins",
  "boundaries",
] as const;
const ARMING_TRUST_TIER_PIN_KEYS = [
  "required_row_trust_label",
  "required_per_record_provenance_status",
  "forbidden_per_record_provenance_statuses",
] as const;
const ARMING_BOUNDARY_KEYS = [
  "current_effective_authorization",
  "operator_armed",
  "arming_is_one_shot",
  "authorizes_future_flow_execution",
  "max_flow_executions_authorized",
  "remaining_flow_executions",
  "consumed_flow_executions",
  "retry_budget",
  "retry_requires_new_approval",
  "one_shot_consumption_recorded",
  "step_4_must_check_expiry_at_execution",
  "step_4_must_atomically_consume_one_shot_key_in_durable_transaction",
  "step_4_must_refuse_replay_after_consumption",
  "authorizes_provider_call",
  "authorizes_system_side_acquisition",
  "authorizes_private_evidence_read",
  "authorizes_fresh_provider_call_on_flow_path",
  "authorizes_immediate_durable_write",
  "flow_execution_performed",
  "durable_write_execution_performed",
  "durable_writes_performed",
  "graph_ingestion_performed",
  "render_performed",
  "provider_calls_made",
  "private_evidence_read",
  "system_side_acquisition_performed",
  "production_writes",
  "readiness_claim",
] as const;

function refuse(detail: string): never {
  throw new M5aOperatorArmingRefusal(detail);
}

function translateSnapshotError(e: unknown): never {
  if (e instanceof M5aContractBuilderRefusal) {
    throw new M5aOperatorArmingRefusal(e.detail);
  }
  if (e instanceof M5aApprovalPacketRefusal) {
    throw new M5aOperatorArmingRefusal(e.detail);
  }
  throw e;
}

function snapshotRecordOrRefuse(value: unknown, label: string): PlainRecord {
  try {
    return snapshotPlainOwnData(value, label);
  } catch (e) {
    translateSnapshotError(e);
  }
}

function snapshotArrayOrRefuse(value: unknown, label: string): readonly unknown[] {
  try {
    return snapshotPlainArray(value, label);
  } catch (e) {
    translateSnapshotError(e);
  }
}

function requireExactOwnKeys(record: PlainRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    refuse(`${label} must contain exactly the expected own keys; got ${JSON.stringify(actual)}`);
  }
}

function verifyContractOrRefuse(
  contract: unknown,
): asserts contract is M5aCuratedProposalFlowContractArtifact {
  try {
    verifyM5aCuratedProposalFlowContract(contract);
  } catch (e) {
    translateSnapshotError(e);
  }
}

function requireSafeIdOrRefuse(value: unknown, label: string): string {
  try {
    return requireSafeId(value, label);
  } catch (e) {
    translateSnapshotError(e);
  }
}

function requireIsoOrRefuse(value: unknown, label: string): string {
  try {
    return requireCanonicalIsoTimestamp(value, label);
  } catch (e) {
    translateSnapshotError(e);
  }
}

function requireOperatorIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_OPERATOR_IDENTITY.test(value)) {
    refuse(`${label} must be a safe operator identity string`);
  }
  return value;
}

function m5aArmingTupleDigest(values: readonly string[]): string {
  // JSON's array form is an unambiguous canonical encoding here: all
  // values have already been validated as strings, array order is fixed,
  // and JSON escaping prevents delimiter ambiguity.
  const canonicalTuple = JSON.stringify(values);
  return createHash("sha256")
    .update(canonicalTuple, "utf8")
    .digest("hex")
    .slice(0, ARMING_TUPLE_DIGEST_HEX_LENGTH);
}

export function canonicalM5aOperatorArmingArtifactId(
  packetArtifactId: string,
  referencesContractArtifactId: string,
  proposalSetId: string,
  accountId: string,
  armedBy: string,
  armedAt: string,
): string {
  return `m5a-arm:${m5aArmingTupleDigest([
    packetArtifactId,
    referencesContractArtifactId,
    proposalSetId,
    accountId,
    armedBy,
    armedAt,
  ])}:${armedBy}:${armedAt}`;
}

// Unlike arming_artifact_id, this identity deliberately excludes the
// arming event's operator and timestamp. Every arming over the same
// verified packet/contract/proposal/account tuple therefore presents the
// same durable consumption key to Step 4.
export function canonicalM5aOneShotConsumptionKey(
  packetArtifactId: string,
  referencesContractArtifactId: string,
  proposalSetId: string,
  accountId: string,
): string {
  return `m5a-one-shot:${m5aArmingTupleDigest([
    packetArtifactId,
    referencesContractArtifactId,
    proposalSetId,
    accountId,
  ])}`;
}

function verifyPacketOrRefuse(
  packet: unknown,
  contract: M5aCuratedProposalFlowContractArtifact,
): asserts packet is M5aCuratedProposalFlowApprovalPacketArtifact {
  try {
    verifyM5aCuratedProposalFlowApprovalPacket(packet, contract);
  } catch (e) {
    translateSnapshotError(e);
  }
}

interface VerifiedPacketLocals {
  readonly packet_artifact_id: string;
  readonly references_contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly drafted_at: string;
  readonly expires_at: string;
}

function snapshotVerifiedPacketLocals(packet: unknown): VerifiedPacketLocals {
  const snap = snapshotRecordOrRefuse(packet, "packet");
  if (snap.lifecycle !== "drafted") refuse("packet.lifecycle must be drafted before arming");
  if (snap.armed !== false) refuse("packet.armed must be false before arming");
  if (snap.consumed !== false) refuse("packet.consumed must be false before arming");
  if (snap.executed !== false) refuse("packet.executed must be false before arming");
  return Object.freeze({
    packet_artifact_id: requireSafeIdOrRefuse(snap.packet_artifact_id, "packet.packet_artifact_id"),
    references_contract_artifact_id: requireSafeIdOrRefuse(
      snap.references_contract_artifact_id,
      "packet.references_contract_artifact_id",
    ),
    proposal_set_id: requireSafeIdOrRefuse(snap.proposal_set_id, "packet.proposal_set_id"),
    account_id: requireSafeIdOrRefuse(snap.account_id, "packet.account_id"),
    drafted_at: requireIsoOrRefuse(snap.drafted_at, "packet.drafted_at"),
    expires_at: requireIsoOrRefuse(snap.expires_at, "packet.expires_at"),
  });
}

function assertArmedChronology(armedAt: string, packetDraftedAt: string, packetExpiresAt: string): void {
  const armed = Date.parse(armedAt);
  const drafted = Date.parse(packetDraftedAt);
  const expires = Date.parse(packetExpiresAt);
  if (armed < drafted) refuse("armedAt precedes packet.drafted_at");
  if (armed >= expires) refuse("armedAt is at or after packet.expires_at");
}

function assertNoMediationGateStamp(record: PlainRecord, label: string): void {
  if (Object.hasOwn(record, "mediation_gate_level")) {
    refuse(`${label}.mediation_gate_level must not be stamped by the arming slice`);
  }
}

function requireExact(record: PlainRecord, key: string, expected: unknown, label: string): void {
  if (record[key] !== expected) {
    refuse(`${label}.${key} must be ${JSON.stringify(expected)}`);
  }
}

function verifyTrustPins(record: PlainRecord, label: string): void {
  requireExactOwnKeys(record, ARMING_TRUST_TIER_PIN_KEYS, label);
  requireExact(record, "required_row_trust_label", M5A_PINNED_ROW_TRUST_LABEL, label);
  requireExact(
    record,
    "required_per_record_provenance_status",
    M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
    label,
  );
  const forbidden = snapshotArrayOrRefuse(
    record.forbidden_per_record_provenance_statuses,
    `${label}.forbidden_per_record_provenance_statuses`,
  );
  if (forbidden.length !== 1 || forbidden[0] !== "verified") {
    refuse(`${label}.forbidden_per_record_provenance_statuses must be exactly ["verified"]`);
  }
}

function verifyBoundaries(boundaries: PlainRecord): void {
  requireExactOwnKeys(boundaries, ARMING_BOUNDARY_KEYS, "arming.boundaries");
  assertNoMediationGateStamp(boundaries, "arming.boundaries");
  requireExact(
    boundaries,
    "current_effective_authorization",
    M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
    "arming.boundaries",
  );
  for (const key of [
    "operator_armed",
    "arming_is_one_shot",
    "authorizes_future_flow_execution",
    "retry_requires_new_approval",
    "step_4_must_check_expiry_at_execution",
    "step_4_must_atomically_consume_one_shot_key_in_durable_transaction",
    "step_4_must_refuse_replay_after_consumption",
  ]) {
    requireExact(boundaries, key, true, "arming.boundaries");
  }
  for (const [key, expected] of [
    ["max_flow_executions_authorized", 1],
    ["remaining_flow_executions", 1],
    ["consumed_flow_executions", 0],
    ["retry_budget", 0],
    ["provider_calls_made", 0],
  ] as const) {
    requireExact(boundaries, key, expected, "arming.boundaries");
  }
  for (const key of [
    "authorizes_provider_call",
    "authorizes_system_side_acquisition",
    "authorizes_private_evidence_read",
    "authorizes_fresh_provider_call_on_flow_path",
    "authorizes_immediate_durable_write",
    "one_shot_consumption_recorded",
    "flow_execution_performed",
    "durable_write_execution_performed",
    "durable_writes_performed",
    "graph_ingestion_performed",
    "render_performed",
    "private_evidence_read",
    "system_side_acquisition_performed",
    "production_writes",
    "readiness_claim",
  ]) {
    requireExact(boundaries, key, false, "arming.boundaries");
  }
}

export function buildM5aCuratedProposalFlowOperatorArming(
  contract: M5aCuratedProposalFlowContractArtifact,
  packet: M5aCuratedProposalFlowApprovalPacketArtifact,
  options: BuildM5aOperatorArmingOptions,
): M5aCuratedProposalFlowOperatorArmingArtifact {
  // Snapshot the contract root before any verifier that might otherwise
  // read fields from a hostile object. The step-2 verifier then checks
  // the packet/contract binding; step 3 renders only from validated locals.
  verifyContractOrRefuse(contract as unknown);
  verifyPacketOrRefuse(packet as unknown, contract);
  const packetLocals = snapshotVerifiedPacketLocals(packet as unknown);

  const opts = snapshotRecordOrRefuse(options as unknown, "options");
  const armedBy = requireOperatorIdentity(opts.armedBy, "options.armedBy");
  const armedAt = requireIsoOrRefuse(opts.armedAt, "options.armedAt");
  assertArmedChronology(armedAt, packetLocals.drafted_at, packetLocals.expires_at);

  const armingArtifactId = canonicalM5aOperatorArmingArtifactId(
    packetLocals.packet_artifact_id,
    packetLocals.references_contract_artifact_id,
    packetLocals.proposal_set_id,
    packetLocals.account_id,
    armedBy,
    armedAt,
  );
  requireSafeIdOrRefuse(armingArtifactId, "arming.arming_artifact_id");
  const oneShotConsumptionKey = canonicalM5aOneShotConsumptionKey(
    packetLocals.packet_artifact_id,
    packetLocals.references_contract_artifact_id,
    packetLocals.proposal_set_id,
    packetLocals.account_id,
  );
  requireSafeIdOrRefuse(oneShotConsumptionKey, "arming.one_shot_consumption_key");

  const arming: M5aCuratedProposalFlowOperatorArmingArtifact = Object.freeze({
    kind: M5A_OPERATOR_ARMING_KIND,
    schema_version: M5A_OPERATOR_ARMING_SCHEMA_VERSION,
    disposable: true as const,
    generated_from: M5A_APPROVAL_PACKET_KIND,
    arming_artifact_id: armingArtifactId,
    one_shot_consumption_key: oneShotConsumptionKey,
    packet_artifact_id: packetLocals.packet_artifact_id,
    references_contract_artifact_id: packetLocals.references_contract_artifact_id,
    proposal_set_id: packetLocals.proposal_set_id,
    account_id: packetLocals.account_id,
    packet_lifecycle_before_arming: "drafted" as const,
    lifecycle: "armed" as const,
    armed: true as const,
    consumed: false as const,
    executed: false as const,
    expired: false as const,
    revoked: false as const,
    armed_at: armedAt,
    armed_by: armedBy,
    packet_drafted_at: packetLocals.drafted_at,
    packet_expires_at: packetLocals.expires_at,
    authorization_scope: M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
    eventual_authorization_scope: M5A_EVENTUAL_AUTHORIZATION_SCOPE,
    next_required_contract: M5A_OPERATOR_ARMING_NEXT_REQUIRED_CONTRACT,
    target_store: M5A_PINNED_TARGET_STORE,
    recorded_proposal_source_origin: M5A_PINNED_CURATION_ORIGIN,
    trust_tier_pins: Object.freeze({
      required_row_trust_label: M5A_PINNED_ROW_TRUST_LABEL,
      required_per_record_provenance_status: M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
      forbidden_per_record_provenance_statuses: Object.freeze(["verified"] as const),
    }),
    boundaries: Object.freeze({
      current_effective_authorization: M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
      operator_armed: true as const,
      arming_is_one_shot: true as const,
      authorizes_future_flow_execution: true as const,
      max_flow_executions_authorized: 1 as const,
      remaining_flow_executions: 1 as const,
      consumed_flow_executions: 0 as const,
      retry_budget: 0 as const,
      retry_requires_new_approval: true as const,
      one_shot_consumption_recorded: false as const,
      step_4_must_check_expiry_at_execution: true as const,
      step_4_must_atomically_consume_one_shot_key_in_durable_transaction: true as const,
      step_4_must_refuse_replay_after_consumption: true as const,
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      authorizes_private_evidence_read: false as const,
      authorizes_fresh_provider_call_on_flow_path: false as const,
      authorizes_immediate_durable_write: false as const,
      flow_execution_performed: false as const,
      durable_write_execution_performed: false as const,
      durable_writes_performed: false as const,
      graph_ingestion_performed: false as const,
      render_performed: false as const,
      provider_calls_made: 0 as const,
      private_evidence_read: false as const,
      system_side_acquisition_performed: false as const,
      production_writes: false as const,
      readiness_claim: false as const,
    }),
  });

  verifyM5aCuratedProposalFlowOperatorArming(arming, packet, contract);
  return arming;
}

export function verifyM5aCuratedProposalFlowOperatorArming(
  arming: unknown,
  packet: unknown,
  contract: M5aCuratedProposalFlowContractArtifact,
): asserts arming is M5aCuratedProposalFlowOperatorArmingArtifact {
  verifyContractOrRefuse(contract as unknown);
  verifyPacketOrRefuse(packet, contract);
  const packetLocals = snapshotVerifiedPacketLocals(packet);

  const a = snapshotRecordOrRefuse(arming, "arming");
  requireExactOwnKeys(a, ARMING_ROOT_KEYS, "arming");
  assertNoMediationGateStamp(a, "arming");
  requireExact(a, "kind", M5A_OPERATOR_ARMING_KIND, "arming");
  requireExact(a, "schema_version", M5A_OPERATOR_ARMING_SCHEMA_VERSION, "arming");
  requireExact(a, "disposable", true, "arming");
  requireExact(a, "generated_from", M5A_APPROVAL_PACKET_KIND, "arming");
  requireExact(a, "packet_lifecycle_before_arming", "drafted", "arming");
  requireExact(a, "lifecycle", "armed", "arming");
  requireExact(a, "armed", true, "arming");
  for (const key of ["consumed", "executed", "expired", "revoked"]) {
    requireExact(a, key, false, "arming");
  }

  const armingArtifactId = requireSafeIdOrRefuse(a.arming_artifact_id, "arming.arming_artifact_id");
  const oneShotConsumptionKey = requireSafeIdOrRefuse(
    a.one_shot_consumption_key,
    "arming.one_shot_consumption_key",
  );
  const packetArtifactId = requireSafeIdOrRefuse(a.packet_artifact_id, "arming.packet_artifact_id");
  const contractArtifactId = requireSafeIdOrRefuse(
    a.references_contract_artifact_id,
    "arming.references_contract_artifact_id",
  );
  const proposalSetId = requireSafeIdOrRefuse(a.proposal_set_id, "arming.proposal_set_id");
  const accountId = requireSafeIdOrRefuse(a.account_id, "arming.account_id");
  if (packetArtifactId !== packetLocals.packet_artifact_id) {
    refuse("arming.packet_artifact_id does not match packet.packet_artifact_id");
  }
  if (contractArtifactId !== packetLocals.references_contract_artifact_id) {
    refuse("arming.references_contract_artifact_id does not match packet reference");
  }
  if (proposalSetId !== packetLocals.proposal_set_id) {
    refuse("arming.proposal_set_id does not match packet.proposal_set_id");
  }
  if (accountId !== packetLocals.account_id) {
    refuse("arming.account_id does not match packet.account_id");
  }

  const armedAt = requireIsoOrRefuse(a.armed_at, "arming.armed_at");
  const armedBy = requireOperatorIdentity(a.armed_by, "arming.armed_by");
  const packetDraftedAt = requireIsoOrRefuse(a.packet_drafted_at, "arming.packet_drafted_at");
  const packetExpiresAt = requireIsoOrRefuse(a.packet_expires_at, "arming.packet_expires_at");
  if (packetDraftedAt !== packetLocals.drafted_at) {
    refuse("arming.packet_drafted_at does not match packet.drafted_at");
  }
  if (packetExpiresAt !== packetLocals.expires_at) {
    refuse("arming.packet_expires_at does not match packet.expires_at");
  }
  assertArmedChronology(armedAt, packetLocals.drafted_at, packetLocals.expires_at);

  const expectedArmingArtifactId = canonicalM5aOperatorArmingArtifactId(
    packetArtifactId,
    contractArtifactId,
    proposalSetId,
    accountId,
    armedBy,
    armedAt,
  );
  if (armingArtifactId !== expectedArmingArtifactId) {
    refuse("arming.arming_artifact_id does not match canonical packet/armed_by/armed_at form");
  }
  const expectedOneShotConsumptionKey = canonicalM5aOneShotConsumptionKey(
    packetArtifactId,
    contractArtifactId,
    proposalSetId,
    accountId,
  );
  if (oneShotConsumptionKey !== expectedOneShotConsumptionKey) {
    refuse(
      "arming.one_shot_consumption_key does not match canonical packet/contract/proposal/account form",
    );
  }

  requireExact(a, "authorization_scope", M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE, "arming");
  requireExact(a, "eventual_authorization_scope", M5A_EVENTUAL_AUTHORIZATION_SCOPE, "arming");
  requireExact(a, "next_required_contract", M5A_OPERATOR_ARMING_NEXT_REQUIRED_CONTRACT, "arming");
  requireExact(a, "target_store", M5A_PINNED_TARGET_STORE, "arming");
  requireExact(a, "recorded_proposal_source_origin", M5A_PINNED_CURATION_ORIGIN, "arming");

  const pins = snapshotRecordOrRefuse(a.trust_tier_pins, "arming.trust_tier_pins");
  assertNoMediationGateStamp(pins, "arming.trust_tier_pins");
  verifyTrustPins(pins, "arming.trust_tier_pins");

  const boundaries = snapshotRecordOrRefuse(a.boundaries, "arming.boundaries");
  verifyBoundaries(boundaries);
}
