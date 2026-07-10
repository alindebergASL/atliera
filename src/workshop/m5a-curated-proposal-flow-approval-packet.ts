// Workshop M5a — curated-source proposal-flow approval packet (drafted).
//
// M5a step 2 (operator GO 2026-06-17). Produces a drafted-and-unarmed
// approval packet over an M5a step 1 contract artifact. The packet is
// the typed drafted input that step 3 verifies before producing a
// separate armed-state artifact; the packet itself remains drafted and
// inert. The future M5a flow execution slice (the analog of M3 step
// 3a's executor) consumes the verified packet plus that arming artifact.
//
// This module performs no provider call, no graph mutation, no
// durable write, no flow execution. The packet it produces is inert
// by construction: a drafted authorization that cannot cause a write
// until a separate arming slice produces a bound armed-state artifact.
// A probe in the
// hostile-input regression suite confirms that an attempt to execute
// against the drafted packet fails closed.
//
// THREAT SHAPE (the operator named the difference at step 2 GO 2026-
// 06-17): step 1 consumed an upstream materialization artifact; its
// adversary was a hostile input object trying to smuggle unsafe
// values through validation. Step 2 produces an approval packet, and
// its primary adversary is approval-state counterfeit — a packet that
// claims to conform to `approval_packet_shape` but doesn't carry the
// required positive trust-tier pins, or whose Path-1 markers are
// present-but-falsified, or that arrives already-armed when the
// contract says drafted-and-unarmed-by-default, or that references a
// contract_artifact_id that doesn't match the step-1 contract it
// claims to be over. The hostile-probe suite is built against THAT
// threat, not re-aimed at input-smuggling.
//
// What the eventual arming will authorize (M5a-specific sharpening
// from Path-1 ratification): the durable WRITE of a recorded
// proposal + the RENDER of the resulting durable state through the
// M3-shipped ratification surface. NOT a fresh provider call. NOT
// system-side acquisition. The packet's `eventual_authorization`
// block encodes this explicitly; a counterfeit packet that tried to
// authorize a fresh call is refused by the verifier.
//
// SNAPSHOT-DISCIPLINE PROVENANCE (operator decision 2026-06-17): step
// 2 imports `snapshotPlainOwnData`, `snapshotPlainArray`,
// `isCanonicalIsoTimestamp`, `requireSafeId`,
// `requireCanonicalIsoTimestamp`, and `M5aContractBuilderRefusal` from
// step 1's module. The shared helpers now include the runtime verifier,
// exact-key checks, bounded strict array snapshots, chronology checks,
// and canonical-ID enforcement added by the pre-capstone hardening.
// The M5a layer is therefore one consolidated site of the discipline.
// This is recorded as an H3 retro input: the cost of
// every site hand-rolling is partly offset when sites share a
// namespace, evidence that informs Q4 and the eventual H3 migration
// surface (now three M3 sites + one M5a-layer site, not three M3
// sites + two independent M5a hand-rolls).

import { createHash } from "node:crypto";

import {
  M5A_PINNED_CURATION_ORIGIN,
  M5A_PINNED_MEDIATION_GATE_LEVEL,
  M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
  M5A_PINNED_ROW_TRUST_LABEL,
  M5A_PINNED_TARGET_STORE,
  M5aContractBuilderRefusal,
  isCanonicalIsoTimestamp,
  requireCanonicalIsoTimestamp,
  requireSafeId,
  snapshotPlainArray,
  snapshotPlainOwnData,
  verifyM5aCuratedProposalFlowContract,
  type M5aCuratedProposalFlowContractArtifact,
} from "./m5a-curated-proposal-flow-contract.ts";

export const M5A_APPROVAL_PACKET_KIND =
  "m5a-curated-proposal-flow-approval-packet" as const;

export const M5A_APPROVAL_PACKET_SCHEMA_VERSION =
  "atliera.m5a_curated_proposal_flow_approval_packet.v1" as const;

const M5A_PACKET_ID_DIGEST_HEX_LENGTH = 40;

// The canonical packet identity binds every validated step-2 identity
// dimension. JSON tuple encoding is unambiguous for strings, and the
// 40-hex SHA-256 prefix supplies a 160-bit digest within SAFE_ID.
export function canonicalM5aCuratedProposalFlowApprovalPacketArtifactId(
  referencesContractArtifactId: string,
  proposalSetId: string,
  accountId: string,
  draftedBy: string,
  draftedAt: string,
  expiresAt: string,
): string {
  const canonicalTuple = JSON.stringify([
    referencesContractArtifactId,
    proposalSetId,
    accountId,
    draftedBy,
    draftedAt,
    expiresAt,
  ]);
  const digest = createHash("sha256")
    .update(canonicalTuple, "utf8")
    .digest("hex")
    .slice(0, M5A_PACKET_ID_DIGEST_HEX_LENGTH);
  return `m5a-pkt:${digest}`;
}

// What the packet's eventual arming will license (when a separate
// arming slice produces an armed-state artifact over the drafted
// packet). M5a's
// Path-1 ratification means this is ALWAYS the write/render of a
// recorded proposal — never a fresh provider call.
export const M5A_EVENTUAL_AUTHORIZATION_SCOPE =
  "durable-write-of-recorded-proposal-and-render" as const;

export type M5aApprovalPacketLifecycle =
  | "drafted"
  | "armed"
  | "consumed"
  | "expired"
  | "revoked";

// Typed refusal for the M5a step-2 verifier. Distinct from
// M5aContractBuilderRefusal (which step 1 throws from the snapshot
// helpers) so the audit-trail surface is greppable. The builder
// catches M5aContractBuilderRefusal from imported helpers and re-
// throws M5aApprovalPacketRefusal — same per-site translation pattern
// the H3 plan Q10 ratification surface anticipates.
export class M5aApprovalPacketRefusal extends Error {
  constructor(public readonly detail: string) {
    super(`M5a approval packet refused: ${detail}`);
    this.name = "M5aApprovalPacketRefusal";
  }
}

// Eventual authorization block — what arming would license. M5a-
// specific sharpening: this is ALWAYS write/render of a recorded
// proposal under Path-1; the packet structurally cannot authorize a
// fresh provider call.
export interface M5aApprovalPacketEventualAuthorization {
  readonly authorization_scope: typeof M5A_EVENTUAL_AUTHORIZATION_SCOPE;
  readonly authorizes_durable_write_of_recorded_proposal: true;
  readonly authorizes_render_of_durable_state: true;
  readonly authorizes_provider_call: false;
  readonly authorizes_system_side_acquisition: false;
  readonly authorizes_private_evidence_read: false;
  readonly recorded_proposal_source_origin: typeof M5A_PINNED_CURATION_ORIGIN;
}

// Trust-tier pins — POSITIVE values + the negative prohibition. The
// gap between "not verified" and "is this specific pending label" is
// closed structurally here: the packet must carry the positive pin
// AND the negative prohibition.
export interface M5aApprovalPacketTrustTierPins {
  readonly required_row_trust_label: typeof M5A_PINNED_ROW_TRUST_LABEL;
  readonly required_per_record_provenance_status: typeof M5A_PINNED_PER_RECORD_PROVENANCE_STATUS;
  readonly forbidden_per_record_provenance_statuses: readonly ["verified"];
}

// Flow constraints — this packet remains drafted and unarmed. Step 3's
// separate arming artifact is the surface that carries authorization.
export interface M5aApprovalPacketFlowConstraints {
  readonly drafted_and_unarmed_by_default: true;
  readonly max_flow_executions: 1;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  readonly expiry_required: true;
  readonly operator_arming_required_for_flow_execution: true;
  readonly mediation_gate_level: typeof M5A_PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof M5A_PINNED_TARGET_STORE;
  readonly forbids_fresh_provider_call_on_flow_path: true;
  readonly forbids_system_side_acquisition: true;
}

export interface M5aCuratedProposalFlowApprovalPacketArtifact {
  readonly kind: typeof M5A_APPROVAL_PACKET_KIND;
  readonly schema_version: typeof M5A_APPROVAL_PACKET_SCHEMA_VERSION;
  readonly disposable: true;
  // current_effective_authorization remains "none" on this packet.
  // Step 3 creates a separate armed-state artifact; it does not mutate
  // or transition the drafted packet.
  readonly current_effective_authorization: "none";
  readonly packet_artifact_id: string;
  // Contract-reference integrity. The packet binds to its step-1
  // contract by id, proposal_set_id, and account_id; the verifier
  // refuses any packet whose triple does not match the contract it
  // is presented with.
  readonly references_contract_artifact_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  // Drafted lifecycle state. The packet remains INERT and drafted;
  // Step 3's armed lifecycle exists only on its separate artifact.
  readonly lifecycle: "drafted";
  readonly drafted_at: string;
  readonly drafted_by: string;
  readonly expires_at: string;
  // The three blocks the verifier checks against the contract's
  // published approval_packet_shape.
  readonly eventual_authorization: M5aApprovalPacketEventualAuthorization;
  readonly trust_tier_pins: M5aApprovalPacketTrustTierPins;
  readonly flow_constraints: M5aApprovalPacketFlowConstraints;
  // Drafted-state markers. ALL remain false on the packet. Step 3
  // records armed state only on its separate arming artifact.
  readonly armed: false;
  readonly consumed: false;
  readonly executed: false;
  // Closed top-level doctrine markers.
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

const SAFE_OPERATOR_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,60}$/;

export interface BuildM5aApprovalPacketOptions {
  readonly now: string;
  readonly draftedBy: string;
  readonly expiresAt: string;
}

type PlainRecord = Readonly<Record<string, unknown>>;

const PACKET_ROOT_KEYS = [
  "kind",
  "schema_version",
  "disposable",
  "current_effective_authorization",
  "packet_artifact_id",
  "references_contract_artifact_id",
  "proposal_set_id",
  "account_id",
  "lifecycle",
  "drafted_at",
  "drafted_by",
  "expires_at",
  "eventual_authorization",
  "trust_tier_pins",
  "flow_constraints",
  "armed",
  "consumed",
  "executed",
  "provider_calls_made",
  "private_evidence_read",
  "graph_ingestion_performed",
  "durable_writes_performed",
  "production_writes",
  "readiness_claim",
] as const;
const EVENTUAL_AUTHORIZATION_KEYS = [
  "authorization_scope",
  "authorizes_durable_write_of_recorded_proposal",
  "authorizes_render_of_durable_state",
  "authorizes_provider_call",
  "authorizes_system_side_acquisition",
  "authorizes_private_evidence_read",
  "recorded_proposal_source_origin",
] as const;
const TRUST_TIER_PIN_KEYS = [
  "required_row_trust_label",
  "required_per_record_provenance_status",
  "forbidden_per_record_provenance_statuses",
] as const;
const FLOW_CONSTRAINT_KEYS = [
  "drafted_and_unarmed_by_default",
  "max_flow_executions",
  "retry_budget",
  "retry_requires_new_approval",
  "expiry_required",
  "operator_arming_required_for_flow_execution",
  "mediation_gate_level",
  "target_store",
  "forbids_fresh_provider_call_on_flow_path",
  "forbids_system_side_acquisition",
] as const;

function requireExactOwnKeys(record: PlainRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new M5aApprovalPacketRefusal(
      `${label} must contain exactly the expected own keys; got ${JSON.stringify(actual)}`,
    );
  }
}

function translateContractRefusal(e: unknown): never {
  if (e instanceof M5aContractBuilderRefusal) {
    throw new M5aApprovalPacketRefusal(e.detail);
  }
  throw e;
}

function snapshotRecordOrRefuse(value: unknown, label: string): PlainRecord {
  try {
    return snapshotPlainOwnData(value, label);
  } catch (e) {
    translateContractRefusal(e);
  }
}

function snapshotArrayOrRefuse(value: unknown, label: string): readonly unknown[] {
  try {
    return snapshotPlainArray(value, label);
  } catch (e) {
    translateContractRefusal(e);
  }
}

function verifyContractOrRefuse(
  contract: unknown,
): asserts contract is M5aCuratedProposalFlowContractArtifact {
  try {
    verifyM5aCuratedProposalFlowContract(contract);
  } catch (e) {
    translateContractRefusal(e);
  }
}

// buildM5aCuratedProposalFlowApprovalPacket: produces a drafted-and-
// unarmed packet over the given step-1 contract artifact. The packet
// is inert by construction and remains drafted; the separate Step 3
// module creates a bound armed-state artifact without mutating it.
//
// Snapshot discipline: the contract and options are snapshotted at
// entry using the helpers imported from step 1; the packet is built
// EXCLUSIVELY from validated locals. The contract's published
// `approval_packet_shape` is the source of truth for every value the
// packet carries; the builder copies them through directly.
//
// At the end, the builder calls
// `verifyM5aCuratedProposalFlowApprovalPacket(packet, contract)` to
// ensure the constructed packet conforms exactly. This is the
// build-time guarantee: a legitimate build path always produces a
// verifier-passing packet.
export function buildM5aCuratedProposalFlowApprovalPacket(
  contract: M5aCuratedProposalFlowContractArtifact,
  options: BuildM5aApprovalPacketOptions,
): M5aCuratedProposalFlowApprovalPacketArtifact {
  // (1) Snapshot the options object (imported from step 1).
  let optsSnap: Readonly<Record<string, unknown>>;
  try {
    optsSnap = snapshotPlainOwnData(options as unknown, "options");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  const now = requireCanonicalIsoTimestampOrRefuse(optsSnap.now, "options.now");
  const expiresAt = requireCanonicalIsoTimestampOrRefuse(
    optsSnap.expiresAt,
    "options.expiresAt",
  );
  // expiresAt must be strictly after now.
  if (Date.parse(expiresAt) <= Date.parse(now)) {
    throw new M5aApprovalPacketRefusal("options.expiresAt must be strictly after options.now");
  }
  const draftedByRaw = optsSnap.draftedBy;
  if (typeof draftedByRaw !== "string" || !SAFE_OPERATOR_IDENTITY.test(draftedByRaw)) {
    throw new M5aApprovalPacketRefusal("options.draftedBy must be a safe operator identity string");
  }
  const draftedBy = draftedByRaw;

  verifyContractOrRefuse(contract as unknown);

  // (2) Snapshot the contract input. The contract is itself produced
  // by step 1's builder; a legitimate caller passes the actual frozen
  // contract artifact, but a hostile caller could synthesize a counterfeit
  // (a packet builder is just as much a verification surface as a
  // verifier is).
  let contractSnap: Readonly<Record<string, unknown>>;
  try {
    contractSnap = snapshotPlainOwnData(contract as unknown, "contract");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }

  // (3) Validate contract identity + bound ids.
  if (contractSnap.kind !== "m5a-curated-proposal-flow-contract") {
    throw new M5aApprovalPacketRefusal("contract.kind is not the M5a step 1 contract kind");
  }
  if (
    contractSnap.schema_version !== "atliera.m5a_curated_proposal_flow_contract.v1"
  ) {
    throw new M5aApprovalPacketRefusal("contract.schema_version is unexpected");
  }
  const contractArtifactId = requireSafeIdOrRefuse(
    contractSnap.contract_artifact_id,
    "contract.contract_artifact_id",
  );
  const proposalSetId = requireSafeIdOrRefuse(
    contractSnap.proposal_set_id,
    "contract.proposal_set_id",
  );
  const accountId = requireSafeIdOrRefuse(contractSnap.account_id, "contract.account_id");

  // (4) Snapshot the contract's approval_packet_shape and validate
  // every positive pin + every closed marker. This is where the
  // step-1 contract's typed shape becomes step 2's authoritative
  // source for the packet's content.
  let shapeSnap: Readonly<Record<string, unknown>>;
  try {
    shapeSnap = snapshotPlainOwnData(
      contractSnap.approval_packet_shape,
      "contract.approval_packet_shape",
    );
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  if (shapeSnap.required_kind !== M5A_APPROVAL_PACKET_KIND) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.required_kind is not the M5a packet kind",
    );
  }
  if (shapeSnap.must_reference_contract_artifact_id !== contractArtifactId) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.must_reference_contract_artifact_id does not match contract.contract_artifact_id",
    );
  }
  if (shapeSnap.must_reference_materialization_input_proposal_set_id !== proposalSetId) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.must_reference_materialization_input_proposal_set_id does not match contract.proposal_set_id",
    );
  }
  if (shapeSnap.must_reference_account_id !== accountId) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.must_reference_account_id does not match contract.account_id",
    );
  }
  // Positive trust-tier pins — REQUIRED to be present and exact.
  // "Not verified" is not "is pending"; both must be carried.
  if (shapeSnap.required_row_trust_label !== M5A_PINNED_ROW_TRUST_LABEL) {
    throw new M5aApprovalPacketRefusal(
      `contract.approval_packet_shape.required_row_trust_label must be "${M5A_PINNED_ROW_TRUST_LABEL}"`,
    );
  }
  if (
    shapeSnap.required_per_record_provenance_status !==
    M5A_PINNED_PER_RECORD_PROVENANCE_STATUS
  ) {
    throw new M5aApprovalPacketRefusal(
      `contract.approval_packet_shape.required_per_record_provenance_status must be "${M5A_PINNED_PER_RECORD_PROVENANCE_STATUS}"`,
    );
  }
  if (shapeSnap.mediation_gate_level !== M5A_PINNED_MEDIATION_GATE_LEVEL) {
    throw new M5aApprovalPacketRefusal("contract.approval_packet_shape.mediation_gate_level is not L0");
  }
  if (shapeSnap.target_store !== M5A_PINNED_TARGET_STORE) {
    throw new M5aApprovalPacketRefusal("contract.approval_packet_shape.target_store is not local-durable-db");
  }
  // Path-1 markers.
  if (shapeSnap.inherits_forbids_fresh_provider_call_on_flow_path !== true) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.inherits_forbids_fresh_provider_call_on_flow_path must be true",
    );
  }
  if (shapeSnap.inherits_forbids_system_side_acquisition !== true) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.inherits_forbids_system_side_acquisition must be true",
    );
  }
  if (shapeSnap.drafted_and_unarmed_by_default !== true) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.drafted_and_unarmed_by_default must be true",
    );
  }
  if (shapeSnap.operator_arming_required_for_flow_execution !== true) {
    throw new M5aApprovalPacketRefusal(
      "contract.approval_packet_shape.operator_arming_required_for_flow_execution must be true",
    );
  }
  if (shapeSnap.max_flow_executions !== 1) {
    throw new M5aApprovalPacketRefusal("contract.approval_packet_shape.max_flow_executions must be 1");
  }
  if (shapeSnap.retry_budget !== 0) {
    throw new M5aApprovalPacketRefusal("contract.approval_packet_shape.retry_budget must be 0");
  }
  if (shapeSnap.expiry_required !== true) {
    throw new M5aApprovalPacketRefusal("contract.approval_packet_shape.expiry_required must be true");
  }

  // (5) Construct the packet ID and assemble the artifact from
  // validated locals only.
  // The digest binds the complete validated contract/proposal/account/
  // drafter/draft-time/expiry tuple without embedding a delimiter-sensitive
  // field or approaching SAFE_ID's maximum length.
  const packetArtifactId = canonicalM5aCuratedProposalFlowApprovalPacketArtifactId(
    contractArtifactId,
    proposalSetId,
    accountId,
    draftedBy,
    now,
    expiresAt,
  );

  const packet: M5aCuratedProposalFlowApprovalPacketArtifact = Object.freeze({
    kind: M5A_APPROVAL_PACKET_KIND,
    schema_version: M5A_APPROVAL_PACKET_SCHEMA_VERSION,
    disposable: true as const,
    current_effective_authorization: "none" as const,
    packet_artifact_id: packetArtifactId,
    references_contract_artifact_id: contractArtifactId,
    proposal_set_id: proposalSetId,
    account_id: accountId,
    lifecycle: "drafted" as const,
    drafted_at: now,
    drafted_by: draftedBy,
    expires_at: expiresAt,
    eventual_authorization: Object.freeze({
      authorization_scope: M5A_EVENTUAL_AUTHORIZATION_SCOPE,
      authorizes_durable_write_of_recorded_proposal: true as const,
      authorizes_render_of_durable_state: true as const,
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      authorizes_private_evidence_read: false as const,
      recorded_proposal_source_origin: M5A_PINNED_CURATION_ORIGIN,
    }),
    trust_tier_pins: Object.freeze({
      required_row_trust_label: M5A_PINNED_ROW_TRUST_LABEL,
      required_per_record_provenance_status: M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
      forbidden_per_record_provenance_statuses: Object.freeze(["verified"] as const),
    }),
    flow_constraints: Object.freeze({
      drafted_and_unarmed_by_default: true as const,
      max_flow_executions: 1 as const,
      retry_budget: 0 as const,
      retry_requires_new_approval: true as const,
      expiry_required: true as const,
      operator_arming_required_for_flow_execution: true as const,
      mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
      target_store: M5A_PINNED_TARGET_STORE,
      forbids_fresh_provider_call_on_flow_path: true as const,
      forbids_system_side_acquisition: true as const,
    }),
    armed: false as const,
    consumed: false as const,
    executed: false as const,
    provider_calls_made: 0 as const,
    private_evidence_read: false as const,
    graph_ingestion_performed: false as const,
    durable_writes_performed: false as const,
    production_writes: false as const,
    readiness_claim: false as const,
  });

  // (6) Belt-and-suspenders: the verifier must accept the packet the
  // builder just produced. If it doesn't, the build path has drifted
  // from the verifier path and that is a build-time bug, not a
  // hostile-input case. We surface it loudly here.
  verifyM5aCuratedProposalFlowApprovalPacket(packet, contract);
  return packet;
}

// verifyM5aCuratedProposalFlowApprovalPacket: the counterfeit-detector.
// Consumes an arbitrary (unknown) packet AND the step-1 contract it
// claims to be over. Refuses any packet that is not a structurally
// conformant drafted-and-unarmed M5a packet binding to the given
// contract.
//
// This is the function the hostile-probe regression suite is built
// against. The threat shape is approval-state counterfeit (per the
// operator's framing at step 2 GO 2026-06-17), not input smuggling;
// every probe is a counterfeit packet shape and the expected outcome
// is M5aApprovalPacketRefusal.
//
// The verifier asserts the input narrows to a packet on success
// (asserts so callers can treat the verified value as typed).
export function verifyM5aCuratedProposalFlowApprovalPacket(
  packet: unknown,
  contract: M5aCuratedProposalFlowContractArtifact,
): asserts packet is M5aCuratedProposalFlowApprovalPacketArtifact {
  verifyContractOrRefuse(contract as unknown);
  const contractSnap = snapshotRecordOrRefuse(contract as unknown, "contract");
  const verifiedContractId = requireSafeIdOrRefuse(
    contractSnap.contract_artifact_id,
    "contract.contract_artifact_id",
  );
  const verifiedContractProposalSetId = requireSafeIdOrRefuse(
    contractSnap.proposal_set_id,
    "contract.proposal_set_id",
  );
  const verifiedContractAccountId = requireSafeIdOrRefuse(
    contractSnap.account_id,
    "contract.account_id",
  );
  const verifiedContractedAt = requireCanonicalIsoTimestampOrRefuse(
    contractSnap.contracted_at,
    "contract.contracted_at",
  );

  // (a) Snapshot the packet.
  let p: Readonly<Record<string, unknown>>;
  try {
    p = snapshotPlainOwnData(packet, "packet");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  requireExactOwnKeys(p, PACKET_ROOT_KEYS, "packet");

  // (b) Kind + schema.
  if (p.kind !== M5A_APPROVAL_PACKET_KIND) {
    throw new M5aApprovalPacketRefusal("packet.kind is not the M5a approval packet kind");
  }
  if (p.schema_version !== M5A_APPROVAL_PACKET_SCHEMA_VERSION) {
    throw new M5aApprovalPacketRefusal("packet.schema_version is unexpected");
  }
  if (p.disposable !== true) {
    throw new M5aApprovalPacketRefusal("packet.disposable must be true");
  }
  if (p.current_effective_authorization !== "none") {
    throw new M5aApprovalPacketRefusal(
      "packet.current_effective_authorization must be \"none\" at draft lifecycle",
    );
  }

  // (c) Lifecycle MUST be drafted at this slice. A packet arriving as
  // already-armed/consumed/expired/revoked is a counterfeit. Armed
  // state belongs only to the separate Step 3 artifact.
  if (p.lifecycle !== "drafted") {
    throw new M5aApprovalPacketRefusal(
      `packet.lifecycle must be "drafted" at step 2; got ${JSON.stringify(p.lifecycle)}`,
    );
  }

  // (d) Drafted-state markers MUST all be false. armed/consumed/
  // executed flipping at draft time is a counterfeit shape.
  if (p.armed !== false) {
    throw new M5aApprovalPacketRefusal("packet.armed must be false at draft lifecycle");
  }
  if (p.consumed !== false) {
    throw new M5aApprovalPacketRefusal("packet.consumed must be false at draft lifecycle");
  }
  if (p.executed !== false) {
    throw new M5aApprovalPacketRefusal("packet.executed must be false at draft lifecycle");
  }

  // (e) Closed top-level doctrine markers.
  if (p.provider_calls_made !== 0) {
    throw new M5aApprovalPacketRefusal("packet.provider_calls_made must be 0");
  }
  for (const key of [
    "private_evidence_read",
    "graph_ingestion_performed",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
  ]) {
    if (p[key] !== false) {
      throw new M5aApprovalPacketRefusal(`packet.${key} must be false`);
    }
  }

  // (f) Identification ids — packet must bind to its contract.
  const packetArtifactId = requireSafeIdOrRefuse(p.packet_artifact_id, "packet.packet_artifact_id");
  const referencesContractId = requireSafeIdOrRefuse(
    p.references_contract_artifact_id,
    "packet.references_contract_artifact_id",
  );
  const packetProposalSetId = requireSafeIdOrRefuse(p.proposal_set_id, "packet.proposal_set_id");
  const packetAccountId = requireSafeIdOrRefuse(p.account_id, "packet.account_id");

  // (g) Contract-reference integrity. The packet's binding triple
  // MUST equal the contract's identity triple. M3 3a's "arming for
  // contract A can't authorize a write of candidate B" lesson, pulled
  // up to the packet-drafting layer.
  if (referencesContractId !== verifiedContractId) {
    throw new M5aApprovalPacketRefusal(
      `packet.references_contract_artifact_id (${referencesContractId}) does not match contract.contract_artifact_id (${verifiedContractId})`,
    );
  }
  if (packetProposalSetId !== verifiedContractProposalSetId) {
    throw new M5aApprovalPacketRefusal(
      `packet.proposal_set_id does not match contract.proposal_set_id`,
    );
  }
  if (packetAccountId !== verifiedContractAccountId) {
    throw new M5aApprovalPacketRefusal(
      `packet.account_id does not match contract.account_id`,
    );
  }

  // (h) Timestamps.
  const draftedAt = requireCanonicalIsoTimestampOrRefuse(p.drafted_at, "packet.drafted_at");
  const expiresAt = requireCanonicalIsoTimestampOrRefuse(p.expires_at, "packet.expires_at");
  if (Date.parse(draftedAt) < Date.parse(verifiedContractedAt)) {
    throw new M5aApprovalPacketRefusal(
      "packet.drafted_at must be at or after contract.contracted_at",
    );
  }
  if (Date.parse(expiresAt) <= Date.parse(draftedAt)) {
    throw new M5aApprovalPacketRefusal("packet.expires_at must be strictly after packet.drafted_at");
  }

  // (i) Operator identity. Snapshot the value into a local for the
  // canonical-form check below — the value must come from the same
  // snapshot the rest of the verifier reads from, NOT a fresh read
  // of `p.drafted_by` at the comparison site (that would be the
  // validate-then-reread TOCTOU shape the M5a step 1 hardening
  // already closed, recurring at this layer).
  if (typeof p.drafted_by !== "string" || !SAFE_OPERATOR_IDENTITY.test(p.drafted_by)) {
    throw new M5aApprovalPacketRefusal("packet.drafted_by must be a safe operator identity string");
  }
  const draftedBy: string = p.drafted_by;

  // (i.5) packet_artifact_id canonical form check (Hermes catch
  // 2026-06-17; the builder-side fix established the canonical form
  // by construction, but the verifier did not enforce it. A hand-
  // constructed packet whose ID was forged — including the load-
  // bearing case of an ID derived from a different contract reference
  // while the tuple stays correct — passed verification. The
  // verifier must re-derive the canonical ID from its own validated
  // locals and refuse on mismatch.)
  //
  // The expected ID is computed from the validator's own validated
  // locals (`referencesContractId`, `packetProposalSetId`,
  // `packetAccountId`, `draftedBy`, `draftedAt`, `expiresAt`),
  // each of which has already been snapshot-backed and validated
  // above. No fresh read of `p.*` happens at this comparison —
  // every input to the canonical form is a local string already
  // proven safe. This re-derivation enforces the builder's by-
  // construction invariant on the verify path: builder generates
  // canonical, verifier requires canonical, two claims, both now
  // structurally true.
  const expectedPacketArtifactId = canonicalM5aCuratedProposalFlowApprovalPacketArtifactId(
    referencesContractId,
    packetProposalSetId,
    packetAccountId,
    draftedBy,
    draftedAt,
    expiresAt,
  );
  if (packetArtifactId !== expectedPacketArtifactId) {
    throw new M5aApprovalPacketRefusal(
      `packet.packet_artifact_id (${packetArtifactId}) does not match its canonical contract / proposal / account / drafter / drafted-at / expires-at form (expected: ${expectedPacketArtifactId})`,
    );
  }

  // (j) eventual_authorization block — Path-1 enforced structurally.
  let auth: Readonly<Record<string, unknown>>;
  try {
    auth = snapshotPlainOwnData(p.eventual_authorization, "packet.eventual_authorization");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  requireExactOwnKeys(auth, EVENTUAL_AUTHORIZATION_KEYS, "packet.eventual_authorization");
  if (auth.authorization_scope !== M5A_EVENTUAL_AUTHORIZATION_SCOPE) {
    throw new M5aApprovalPacketRefusal(
      `packet.eventual_authorization.authorization_scope must be "${M5A_EVENTUAL_AUTHORIZATION_SCOPE}"`,
    );
  }
  if (auth.authorizes_durable_write_of_recorded_proposal !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.eventual_authorization.authorizes_durable_write_of_recorded_proposal must be true",
    );
  }
  if (auth.authorizes_render_of_durable_state !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.eventual_authorization.authorizes_render_of_durable_state must be true",
    );
  }
  // The three negatives that enforce Path-1 structurally.
  if (auth.authorizes_provider_call !== false) {
    throw new M5aApprovalPacketRefusal(
      "packet.eventual_authorization.authorizes_provider_call must be false (Path-1: no fresh provider call on M5a flow path)",
    );
  }
  if (auth.authorizes_system_side_acquisition !== false) {
    throw new M5aApprovalPacketRefusal(
      "packet.eventual_authorization.authorizes_system_side_acquisition must be false (M4 territory)",
    );
  }
  if (auth.authorizes_private_evidence_read !== false) {
    throw new M5aApprovalPacketRefusal(
      "packet.eventual_authorization.authorizes_private_evidence_read must be false",
    );
  }
  if (auth.recorded_proposal_source_origin !== M5A_PINNED_CURATION_ORIGIN) {
    throw new M5aApprovalPacketRefusal(
      `packet.eventual_authorization.recorded_proposal_source_origin must be "${M5A_PINNED_CURATION_ORIGIN}"`,
    );
  }

  // (k) trust_tier_pins block — POSITIVE pins + the negative
  // prohibition. The gap between "not verified" and "is pending" is
  // closed here.
  let pins: Readonly<Record<string, unknown>>;
  try {
    pins = snapshotPlainOwnData(p.trust_tier_pins, "packet.trust_tier_pins");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  requireExactOwnKeys(pins, TRUST_TIER_PIN_KEYS, "packet.trust_tier_pins");
  if (pins.required_row_trust_label !== M5A_PINNED_ROW_TRUST_LABEL) {
    throw new M5aApprovalPacketRefusal(
      `packet.trust_tier_pins.required_row_trust_label must be "${M5A_PINNED_ROW_TRUST_LABEL}" (positive pin required, not only the negative prohibition)`,
    );
  }
  if (
    pins.required_per_record_provenance_status !== M5A_PINNED_PER_RECORD_PROVENANCE_STATUS
  ) {
    throw new M5aApprovalPacketRefusal(
      `packet.trust_tier_pins.required_per_record_provenance_status must be "${M5A_PINNED_PER_RECORD_PROVENANCE_STATUS}" (positive pin required)`,
    );
  }
  const forbiddenStatuses = snapshotArrayOrRefuse(
    pins.forbidden_per_record_provenance_statuses,
    "packet.trust_tier_pins.forbidden_per_record_provenance_statuses",
  );
  if (forbiddenStatuses.length !== 1 || forbiddenStatuses[0] !== "verified") {
    throw new M5aApprovalPacketRefusal(
      "packet.trust_tier_pins.forbidden_per_record_provenance_statuses must be exactly [\"verified\"]",
    );
  }

  // (l) flow_constraints block — drafted-and-unarmed by default;
  // Path-1 + M4-acquisition closure markers.
  let fc: Readonly<Record<string, unknown>>;
  try {
    fc = snapshotPlainOwnData(p.flow_constraints, "packet.flow_constraints");
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
  requireExactOwnKeys(fc, FLOW_CONSTRAINT_KEYS, "packet.flow_constraints");
  if (fc.drafted_and_unarmed_by_default !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.drafted_and_unarmed_by_default must be true",
    );
  }
  if (fc.max_flow_executions !== 1) {
    throw new M5aApprovalPacketRefusal("packet.flow_constraints.max_flow_executions must be 1");
  }
  if (fc.retry_budget !== 0) {
    throw new M5aApprovalPacketRefusal("packet.flow_constraints.retry_budget must be 0");
  }
  if (fc.retry_requires_new_approval !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.retry_requires_new_approval must be true",
    );
  }
  if (fc.expiry_required !== true) {
    throw new M5aApprovalPacketRefusal("packet.flow_constraints.expiry_required must be true");
  }
  if (fc.operator_arming_required_for_flow_execution !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.operator_arming_required_for_flow_execution must be true",
    );
  }
  if (fc.mediation_gate_level !== M5A_PINNED_MEDIATION_GATE_LEVEL) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.mediation_gate_level must be L0",
    );
  }
  if (fc.target_store !== M5A_PINNED_TARGET_STORE) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.target_store must be local-durable-db",
    );
  }
  if (fc.forbids_fresh_provider_call_on_flow_path !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.forbids_fresh_provider_call_on_flow_path must be true (Path-1 structural enforcement)",
    );
  }
  if (fc.forbids_system_side_acquisition !== true) {
    throw new M5aApprovalPacketRefusal(
      "packet.flow_constraints.forbids_system_side_acquisition must be true",
    );
  }

  // Verification complete. The TypeScript narrowing on the outer
  // signature now treats `packet` as a verified
  // M5aCuratedProposalFlowApprovalPacketArtifact.
}

// Local typed-throw wrappers around the imported helpers. Each catches
// `M5aContractBuilderRefusal` from the imported helpers and re-throws
// as `M5aApprovalPacketRefusal` so the audit-trail surface is M5a-
// step-2-specific. This is the per-site refusal-class translation the
// H3 plan Q10 ratification anticipates.
function requireSafeIdOrRefuse(value: unknown, label: string): string {
  try {
    return requireSafeId(value, label);
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
}

function requireCanonicalIsoTimestampOrRefuse(value: unknown, label: string): string {
  // Step 1's requireCanonicalIsoTimestamp is the function we want; we
  // also expose `isCanonicalIsoTimestamp` as a direct check for
  // contexts (like options.expiresAt before now-comparison) where
  // the wrapping is mostly cosmetic.
  void isCanonicalIsoTimestamp;
  try {
    return requireCanonicalIsoTimestamp(value, label);
  } catch (e) {
    if (e instanceof M5aContractBuilderRefusal) {
      throw new M5aApprovalPacketRefusal(e.detail);
    }
    throw e;
  }
}
