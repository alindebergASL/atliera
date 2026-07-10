// Workshop M5a — curated-source proposal-flow contract (no-call).
//
// M5a step 1 (operator GO 2026-06-17). The first M5a artifact. Defines
// the typed shape of a real curated-source proposal flow end-to-end:
// curated materialization input → validation → human ratification →
// durable graph write → Workshop renders from durable state, with the
// curated provenance honestly surfaced in the rendered page and NO
// fresh provider call exercised on the flow path.
//
// This module performs no provider call, no graph mutation, no
// durable write, and no render. It is the typed surface that the
// shipped Step 2 approval packet validates against, the shipped Step 3
// arming artifact binds, and Step 4 will execute against — the same
// shape M3 Step 1 opened with for durable writes, scoped one level up.
//
// Path-1 ratification (operator decision 2026-06-17): M5a's "model
// proposals" come from recorded proposal artifacts — a hand-curated
// public materialization input whose `origin === "hand-curated-public"`
// marker is the proof the corpus and its model proposals are NOT
// system-acquired. Path 2 (one-shot armed model call at flow time)
// was explicitly declined; the operator's recorded rationale is that
// Path 2 would conflate real-flow with real-time provider call —
// exactly the conflation ADR 0003 guards against — AND would destroy
// the diagnostic property that justified curated-before-acquired
// sequencing (Path 1 isolates loop failures to validate/ratify/write/
// render; Path 2 could fail at the call/arming/loop level and the
// diagnostic cost balloons).
//
// Two structural shape requirements the operator named (2026-06-17):
//
// (1) The "honestly labeled as curated" claim is a TYPED property of
//     the success criterion, not prose in the runbook. The contract
//     requires that the curated-provenance marker is present on the
//     materialization input AND that the success criterion asserts
//     this marker survives through the loop to the rendered page.
//
// (2) The no-fresh-provider-call marker is a closed boundary on the
//     contract itself — `forbids_fresh_provider_call_on_flow_path:
//     true`. Path 1 is enforced structurally, not merely chosen.
//
// Doctrine alignment (ADR 0003): M5a is the curated-source doctrine-
// loop capstone. It reuses M3-shipped surfaces (ratification, durable
// write, render); it introduces no new L0/L1 mediation gate; it adds
// no new acquisition risk class. The acquisition risk class is M4's
// to introduce, on M4's own capstone, where a runtime provider call
// arming surface would belong. M5a's contract is marker-closed against
// that path.

import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import type { GraphBundle } from "../graph/types.ts";

export const M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME =
  "m5a-curated-proposal-flow-contract" as const;

export const M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION =
  "atliera.m5a_curated_proposal_flow_contract.v1" as const;

// M5a snapshots are a hostile-input boundary, so an array's declared
// length must be bounded before snapshotPlainArray allocates an output
// array proportional to it. 100,000 is deliberately conservative: it
// is far above every committed M5a fixture while remaining finite.
export const M5A_MAX_PLAIN_ARRAY_LENGTH = 100_000;

const M5A_CANONICAL_ID_DIGEST_HEX_LENGTH = 40;

function m5aCanonicalTupleDigest(values: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify(values), "utf8")
    .digest("hex")
    .slice(0, M5A_CANONICAL_ID_DIGEST_HEX_LENGTH);
}

// JSON tuple encoding is unambiguous for validated strings: position
// carries field identity and JSON escaping prevents delimiter collisions.
// The 40-hex-character SHA-256 prefix provides a 160-bit binding while
// keeping the resulting artifact ID comfortably inside SAFE_ID.
export function canonicalM5aCuratedProposalFlowContractArtifactId(
  proposalSetId: string,
  accountId: string,
  flowId: string,
): string {
  return `m5a-flow-contract:${m5aCanonicalTupleDigest([
    proposalSetId,
    accountId,
    flowId,
  ])}`;
}

// The immediate successor artifact encoded by the Step 1 contract.
// The shipped M5a Step 2 approval packet must conform to the typed
// shape published in `approval_packet_shape`.
export const M5A_NEXT_REQUIRED_ARTIFACT =
  "m5a-curated-proposal-flow-approval-packet" as const;

// The curation-provenance marker the materialization input MUST carry.
// `hand-curated-public` is the existing marker on
// `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json`
// (the artifact M3 step 3a's executor consumed); M5a reuses the same
// marker so the shape is grounded in committed code, not invented.
export const M5A_PINNED_CURATION_ORIGIN = "hand-curated-public" as const;

// Mediation-gate level for the eventual M5a flow's L0 system action
// (the durable write). Same value M3 step 3a's executor stamped;
// restated here so the M5a contract is self-contained for audit.
export const M5A_PINNED_MEDIATION_GATE_LEVEL = "L0" as const;

// Target store for the durable write step. Same as M3.
export const M5A_PINNED_TARGET_STORE = "local-durable-db" as const;

// Per-record provenance status M5a's durable write MUST stamp on
// ratified records. Per the M3 step 3a retro trust-tier discipline,
// admission-by-ratification produces `source_document_only` records
// under a `model-proposed-human-ratified-evidence-pending` row trust
// label. M5a does not — must not — flip per-record provenance to
// `verified`; that flip remains M4/M5b territory.
export const M5A_PINNED_PER_RECORD_PROVENANCE_STATUS =
  "source_document_only" as const;
export const M5A_PINNED_ROW_TRUST_LABEL =
  "model-proposed-human-ratified-evidence-pending" as const;

export interface M5aCuratedProposalFlowContractBoundaries {
  readonly current_effective_authorization: "none";
  readonly authorizes_provider_call: false;
  readonly authorizes_private_evidence_read: false;
  readonly authorizes_graph_ingestion: false;
  readonly authorizes_durable_write_execution: false;
  readonly graph_ingestion_performed: false;
  readonly durable_write_execution_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
  readonly provider_calls_executed: 0;
  readonly private_evidence_read: false;
  // Path-1 structural enforcement marker (operator shape requirement
  // 2026-06-17). M5a's flow path consumes recorded proposals from a
  // committed curated materialization input; it never authorizes a
  // fresh provider call at flow time. A later slice that wired a fresh
  // call into the M5a path would have to flip this marker AND open a
  // new approval surface — neither of which is in M5a's scope.
  readonly forbids_fresh_provider_call_on_flow_path: true;
  readonly fresh_provider_call_on_flow_path_executed: false;
  // Contract-specific: shape-only, gates nothing.
  readonly defines_curated_proposal_flow_contract: true;
  readonly authorizes_flow_execution: false;
  readonly flow_execution_performed: false;
  readonly requires_separate_flow_approval_packet: true;
  // Acquisition-risk-class marker (M4 territory; M5a closes this).
  readonly authorizes_system_side_acquisition: false;
  readonly system_side_acquisition_performed: false;
}

// The five stages of the M5a flow, each with its typed preconditions
// and postconditions. The contract names the stages; it does not run
// them.
export type M5aFlowStageKind =
  | "materialize"
  | "validate"
  | "ratify"
  | "durable_write"
  | "render";

export interface M5aFlowStageShape {
  readonly kind: M5aFlowStageKind;
  // The artifact this stage consumes (by typed name). The first
  // stage's preceding artifact is the curated materialization input
  // fixture; subsequent stages consume the prior stage's output.
  readonly consumes: string;
  // The artifact this stage produces (by typed name). The final
  // stage's product is the rendered Workshop page (the M5a capstone
  // visible artifact).
  readonly produces: string;
  // The boundary marker the stage flips (or none). M5a's only L0
  // marker flip is the `durable_write` stage, mirroring M3 step 3a.
  // The render stage flips no marker — it is read-only.
  readonly flips_marker:
    | "durable_writes_performed"
    | "rendered_from_durable_state"
    | null;
  // Stage-level closed-state assertions. Every stage must close
  // `authorizes_provider_call` and `authorizes_system_side_acquisition`.
  readonly stage_closed_markers: {
    readonly authorizes_provider_call: false;
    readonly authorizes_system_side_acquisition: false;
    readonly readiness_claim: false;
  };
}

// The typed property the M5a flow's source artifact MUST carry. The
// operator's structural shape requirement (2026-06-17): "honestly
// labeled as curated" is a TYPED property, not prose. The materialization
// input's `context.origin` must be the pinned curation origin, AND that
// marker must survive through the loop to the rendered page.
export interface M5aCuratedProvenanceRequirements {
  readonly required_materialization_origin: typeof M5A_PINNED_CURATION_ORIGIN;
  // The render must surface the curated label on every account-page
  // section sourced from this flow. The success criterion checks for
  // this; the safety contract test locks the negative.
  readonly required_render_label_text: string;
  // The render-side surfacing MUST appear on every durable card the
  // M5a flow produces. The flow's success_criterion checks structurally
  // that no durable card omits the curated label.
  readonly required_per_card_curated_marker_data_attribute: string;
  // Per the trust-tier discipline: no per-record provenance may be
  // `verified` under the M5a admission row trust label.
  readonly forbidden_per_record_provenance_statuses: readonly ["verified"];
}

// The structural success criterion: what does it mean for ONE M5a
// flow execution to have proved the loop? This is the typed property
// the eventual M5a capstone's safety check evaluates the rendered
// page against. The contract names the shape; the capstone's flow
// engine eventually evaluates it.
export interface M5aFlowSuccessCriterion {
  // Loop closure: every stage produced its named output, in order.
  readonly all_stages_completed: true;
  // The minimum number of populated Workshop lenses the rendered page
  // must carry to count as "real-account-looking." Set to 2 to match
  // the validated-cycle observed weak-but-valid threshold (per
  // `docs/strategy/first-validation-cycle-exit.md`); the operator may
  // ratify a different floor at the M5a step 2 approval-packet stage.
  readonly minimum_populated_lenses: 2;
  // The minimum number of ratified durable records the rendered page
  // must surface. At least one per populated lens.
  readonly minimum_ratified_durable_records: 2;
  // Curated-provenance survival through the loop — structural, not
  // prose (operator shape requirement 2026-06-17).
  readonly curated_provenance_must_be_surfaced_per_card: true;
  // Trust-tier discipline survival through the loop — structural
  // enforcement that ratified records remain `source_document_only`
  // under the admission row trust label. Mirrors the reader and
  // render-side composer trust-tier refusals shipped in M3 step 3b.
  readonly forbids_verified_per_record_provenance_in_render: true;
  // Path-1 survival through the loop — the success criterion cannot
  // be satisfied if any flow stage authorized a fresh provider call,
  // structurally enforcing the boundary marker above.
  readonly forbids_fresh_provider_call_on_any_stage: true;
  // No system-side acquisition surface exercised. M4 territory.
  readonly forbids_system_side_acquisition_on_any_stage: true;
}

// The typed shape consumed by the shipped M5a Step 2 approval packet.
// Like M3 Step 1, the contract publishes the shape Step 2 must conform
// to, so packet verification has a fixed target.
export interface M5aApprovalPacketShape {
  readonly required_kind: "m5a-curated-proposal-flow-approval-packet";
  readonly must_reference_contract_artifact_id: string;
  readonly must_reference_materialization_input_proposal_set_id: string;
  readonly must_reference_account_id: string;
  // The M5a Step 2 packet, like M3 Step 2, remains drafted and unarmed.
  // The shipped Step 3 module creates a separate arming artifact; Step 4
  // must present both artifacts before execution.
  readonly drafted_and_unarmed_by_default: true;
  readonly max_flow_executions: 1;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  readonly expiry_required: true;
  readonly operator_arming_required_for_flow_execution: true;
  // The packet inherits the contract's Path-1 marker and trust-tier
  // pins so step 2 cannot quietly relax them. The trust-tier pins are
  // positive REQUIREMENTS (the row label and per-record provenance
  // values the eventual durable write MUST stamp), not merely the
  // negative prohibition. The M3 step 3a retro §1 trust-tier
  // discipline names this distinction explicitly: "not verified" is
  // not the same claim as "is this specific pending label," and the
  // gap between them is exactly where a future step could land a
  // record in some third unlabeled state. The packet must carry the
  // positive pin.
  readonly inherits_forbids_fresh_provider_call_on_flow_path: true;
  readonly inherits_forbids_system_side_acquisition: true;
  readonly required_row_trust_label: typeof M5A_PINNED_ROW_TRUST_LABEL;
  readonly required_per_record_provenance_status: typeof M5A_PINNED_PER_RECORD_PROVENANCE_STATUS;
  readonly forbidden_per_record_provenance_statuses: readonly ["verified"];
  readonly mediation_gate_level: typeof M5A_PINNED_MEDIATION_GATE_LEVEL;
  readonly target_store: typeof M5A_PINNED_TARGET_STORE;
}

export interface M5aCuratedProposalFlowContractCounts {
  // Counts derived from the consumed materialization input. The
  // contract does not invent counts; it surfaces what the input
  // carries.
  readonly curated_source_count: number;
  readonly proposed_excerpt_count: number;
  readonly proposed_claim_count: number;
  readonly proposed_account_object_count: number;
  // M5a-level: how many flow executions this contract describes.
  // Pinned to 1 — one curated proposal flow per contract artifact.
  readonly described_flow_executions: 1;
  // Execution counts the contract knows are zero because it executes
  // nothing.
  readonly flows_executed: 0;
  readonly durable_writes_executed: 0;
  readonly fresh_provider_calls_on_flow_path: 0;
}

export interface M5aCuratedProposalFlowContractArtifact {
  readonly kind: typeof M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME;
  readonly schema_version: typeof M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION;
  readonly disposable: true;
  readonly current_effective_authorization: "none";
  readonly contract_artifact_id: string;
  readonly flow_id: string;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly materialized_at: string;
  readonly contracted_at: string;
  readonly source_materialization_input_origin: typeof M5A_PINNED_CURATION_ORIGIN;
  readonly next_required_artifact: typeof M5A_NEXT_REQUIRED_ARTIFACT;
  readonly boundaries: M5aCuratedProposalFlowContractBoundaries;
  readonly flow_stages: readonly M5aFlowStageShape[];
  readonly curated_provenance_requirements: M5aCuratedProvenanceRequirements;
  readonly success_criterion: M5aFlowSuccessCriterion;
  readonly approval_packet_shape: M5aApprovalPacketShape;
  readonly counts: M5aCuratedProposalFlowContractCounts;
  // Top-level doctrine markers — the artifact authorizes nothing.
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

// The committed materialization input shape (the artifact M3 step 3a's
// executor already consumes) is read positionally via descriptor
// snapshots below; the M5a contract module does NOT re-declare the
// full graph shape. The snapshot pass extracts only what the contract
// surfaces: curated provenance, bound ids, and array lengths for the
// counts. Element shape is a downstream-slice concern (the validate
// stage of the eventual flow runs the full graph validator).

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

// Typed refusal class — local to the M5a contract module while the
// fourth call site for snapshot discipline (H3 retro input 2026-06-17:
// the cost of hand-rolling is now real, not hypothetical) hand-rolls
// the pattern. The eventual H3 consolidation will replace this with a
// translation against the shared OwnDataSnapshotRefusal codes.
export class M5aContractBuilderRefusal extends Error {
  constructor(public readonly detail: string) {
    super(`M5a contract builder refused: ${detail}`);
    this.name = "M5aContractBuilderRefusal";
  }
}

// snapshotPlainOwnData: descriptor-snapshot at every trust boundary
// (M3 step 3a retro §3). util.types.isProxy FIRST, then own-data
// descriptor enumeration, refusing accessor descriptors, non-
// enumerable own-data, symbol keys, unsafe keys. The output is a
// frozen plain-data object; the builder reads only from this snapshot,
// never from the input.
//
// Hand-rolled rather than imported — none of the three shipped
// snapshot helpers is exported, and pre-implementing H3 is out of
// scope. The fourth site needing this pattern is recorded as an H3
// retro input in the slice runbook (`docs/runbooks/m5a-curated-
// proposal-flow-contract-status.md`, "H3 retro input" section).
export function snapshotPlainOwnData(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (nodeUtilTypes.isProxy(value)) {
    throw new M5aContractBuilderRefusal(`${label} is Proxy-backed`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new M5aContractBuilderRefusal(`${label} must be a plain own-data object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new M5aContractBuilderRefusal(`${label} must not carry symbol keys`);
  }
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    throw new M5aContractBuilderRefusal(`${label} descriptors unavailable`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new M5aContractBuilderRefusal(`${label} contains unsafe key ${key}`);
    }
    if (!("value" in descriptor)) {
      throw new M5aContractBuilderRefusal(`${label}.${key} must be a plain own-data value (no accessors)`);
    }
    if (!descriptor.enumerable) {
      throw new M5aContractBuilderRefusal(`${label}.${key} must be enumerable`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

// snapshotPlainArray: descriptor-snapshot an array. Reads length via
// descriptor (not value.length — consistency with the snapshot
// discipline; on a real Array this is style not safety, but the
// pattern is the discipline H3 will consolidate). Refuses Proxy
// arrays, symbol-keyed arrays, accessor-backed indices, missing
// indices, non-enumerable indices, and lengths above the M5a-specific
// finite maximum before allocating an output array from that length.
export function snapshotPlainArray(value: unknown, label: string): readonly unknown[] {
  if (nodeUtilTypes.isProxy(value)) {
    throw new M5aContractBuilderRefusal(`${label} is Proxy-backed`);
  }
  if (!Array.isArray(value)) {
    throw new M5aContractBuilderRefusal(`${label} must be an array`);
  }
  // Read and bound the intrinsic array length before any reflection that
  // could enumerate dense array keys. A dense oversized array could
  // otherwise make symbol/descriptor reflection allocate proportionally
  // to attacker-controlled length before the explicit M5a cap is applied.
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    throw new M5aContractBuilderRefusal(`${label}.length descriptor unavailable`);
  }
  const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
    ? (lengthDescriptor.value as unknown)
    : undefined;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    throw new M5aContractBuilderRefusal(`${label}.length must be a non-negative safe integer`);
  }
  if (length > M5A_MAX_PLAIN_ARRAY_LENGTH) {
    throw new M5aContractBuilderRefusal(
      `${label}.length must not exceed the M5a maximum of ${M5A_MAX_PLAIN_ARRAY_LENGTH}`,
    );
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new M5aContractBuilderRefusal(`${label} must not carry symbol keys`);
  }
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  } catch {
    throw new M5aContractBuilderRefusal(`${label} descriptors unavailable`);
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new M5aContractBuilderRefusal(`${label} contains unsafe key ${key}`);
    }
    if (!("value" in descriptor)) {
      throw new M5aContractBuilderRefusal(`${label}.${key} must be a plain own-data value (no accessors)`);
    }
    const index = Number(key);
    const isExpectedIndex =
      Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
    if (key !== "length" && !isExpectedIndex) {
      throw new M5aContractBuilderRefusal(`${label} contains unexpected own key ${key}`);
    }
  }
  const out: unknown[] = new Array(length);
  for (let i = 0; i < length; i += 1) {
    const descriptor = descriptors[String(i)];
    if (descriptor === undefined) {
      throw new M5aContractBuilderRefusal(`${label}[${i}] is missing`);
    }
    if (!("value" in descriptor)) {
      throw new M5aContractBuilderRefusal(`${label}[${i}] must be a plain own-data value (no accessors)`);
    }
    if (!descriptor.enumerable) {
      throw new M5aContractBuilderRefusal(`${label}[${i}] must be enumerable`);
    }
    out[i] = descriptor.value;
  }
  return Object.freeze(out);
}

// isCanonicalIsoTimestamp: regex pre-filter + Date.parse round-trip.
// Mirrors the M3 step 3a executor's lesson (the NaN-expiry hardening
// pass), now applied here: a regex-only check accepts impossible
// dates like "2026-99-99T99:99:99Z" because the regex constrains
// shape but not component ranges. Date.parse rejects impossible
// components, and the round-trip canonical form check rejects any
// surprises Date might silently coerce away.
export function isCanonicalIsoTimestamp(s: string): boolean {
  if (typeof s !== "string") return false;
  if (!ISO_TIMESTAMP_SHAPE.test(s)) return false;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return false;
  // Canonical round-trip. Date.toISOString() always produces three-
  // digit fractional seconds. If the input has no fractional part,
  // synthesize ".000" for the comparison so a legitimate "no-ms"
  // input round-trips equal to the parsed form. If the input HAS a
  // fractional part with fewer than 3 digits, normalize that side
  // too — the regex allows 1-3 digits but Date emits exactly 3.
  const canonical = new Date(t).toISOString();
  let normalized = s;
  if (!normalized.includes(".")) {
    normalized = normalized.replace(/Z$/, ".000Z");
  } else {
    // Pad fractional to exactly three digits.
    normalized = normalized.replace(/\.(\d+)Z$/, (_m, frac: string) => `.${frac.padEnd(3, "0")}Z`);
  }
  return canonical === normalized;
}

export function requireSafeId(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new M5aContractBuilderRefusal(`${label} must be a safe id`);
  }
  return value;
}

export function requireCanonicalIsoTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !isCanonicalIsoTimestamp(value)) {
    throw new M5aContractBuilderRefusal(`${label} must be a canonical ISO timestamp`);
  }
  return value;
}

const FLOW_STAGES: readonly M5aFlowStageShape[] = Object.freeze([
  Object.freeze({
    kind: "materialize" as const,
    consumes: "m5a-curated-materialization-input-fixture",
    produces: "m5a-curated-proposal-set",
    flips_marker: null,
    stage_closed_markers: Object.freeze({
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      readiness_claim: false as const,
    }),
  }),
  Object.freeze({
    kind: "validate" as const,
    consumes: "m5a-curated-proposal-set",
    produces: "m5a-validated-proposal-set",
    flips_marker: null,
    stage_closed_markers: Object.freeze({
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      readiness_claim: false as const,
    }),
  }),
  Object.freeze({
    kind: "ratify" as const,
    consumes: "m5a-validated-proposal-set",
    produces: "m5a-ratified-proposal-set",
    flips_marker: null,
    stage_closed_markers: Object.freeze({
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      readiness_claim: false as const,
    }),
  }),
  Object.freeze({
    kind: "durable_write" as const,
    consumes: "m5a-ratified-proposal-set",
    produces: "m5a-durable-graph-snapshot-rows",
    flips_marker: "durable_writes_performed" as const,
    stage_closed_markers: Object.freeze({
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      readiness_claim: false as const,
    }),
  }),
  Object.freeze({
    kind: "render" as const,
    consumes: "m5a-durable-graph-snapshot-rows",
    produces: "m5a-rendered-workshop-page",
    flips_marker: "rendered_from_durable_state" as const,
    stage_closed_markers: Object.freeze({
      authorizes_provider_call: false as const,
      authorizes_system_side_acquisition: false as const,
      readiness_claim: false as const,
    }),
  }),
]) as readonly M5aFlowStageShape[];

type PlainRecord = Readonly<Record<string, unknown>>;

const CONTRACT_ROOT_KEYS = [
  "kind",
  "schema_version",
  "disposable",
  "current_effective_authorization",
  "contract_artifact_id",
  "flow_id",
  "proposal_set_id",
  "account_id",
  "materialized_at",
  "contracted_at",
  "source_materialization_input_origin",
  "next_required_artifact",
  "boundaries",
  "flow_stages",
  "curated_provenance_requirements",
  "success_criterion",
  "approval_packet_shape",
  "counts",
  "provider_calls_made",
  "private_evidence_read",
  "graph_ingestion_performed",
  "durable_writes_performed",
  "production_writes",
  "readiness_claim",
] as const;

const CONTRACT_BOUNDARY_KEYS = [
  "current_effective_authorization",
  "authorizes_provider_call",
  "authorizes_private_evidence_read",
  "authorizes_graph_ingestion",
  "authorizes_durable_write_execution",
  "graph_ingestion_performed",
  "durable_write_execution_performed",
  "durable_writes_performed",
  "production_writes",
  "readiness_claim",
  "provider_calls_executed",
  "private_evidence_read",
  "forbids_fresh_provider_call_on_flow_path",
  "fresh_provider_call_on_flow_path_executed",
  "defines_curated_proposal_flow_contract",
  "authorizes_flow_execution",
  "flow_execution_performed",
  "requires_separate_flow_approval_packet",
  "authorizes_system_side_acquisition",
  "system_side_acquisition_performed",
] as const;

const FLOW_STAGE_KEYS = ["kind", "consumes", "produces", "flips_marker", "stage_closed_markers"] as const;
const STAGE_CLOSED_MARKER_KEYS = [
  "authorizes_provider_call",
  "authorizes_system_side_acquisition",
  "readiness_claim",
] as const;
const CURATED_PROVENANCE_KEYS = [
  "required_materialization_origin",
  "required_render_label_text",
  "required_per_card_curated_marker_data_attribute",
  "forbidden_per_record_provenance_statuses",
] as const;
const SUCCESS_CRITERION_KEYS = [
  "all_stages_completed",
  "minimum_populated_lenses",
  "minimum_ratified_durable_records",
  "curated_provenance_must_be_surfaced_per_card",
  "forbids_verified_per_record_provenance_in_render",
  "forbids_fresh_provider_call_on_any_stage",
  "forbids_system_side_acquisition_on_any_stage",
] as const;
const APPROVAL_PACKET_SHAPE_KEYS = [
  "required_kind",
  "must_reference_contract_artifact_id",
  "must_reference_materialization_input_proposal_set_id",
  "must_reference_account_id",
  "drafted_and_unarmed_by_default",
  "max_flow_executions",
  "retry_budget",
  "retry_requires_new_approval",
  "expiry_required",
  "operator_arming_required_for_flow_execution",
  "inherits_forbids_fresh_provider_call_on_flow_path",
  "inherits_forbids_system_side_acquisition",
  "required_row_trust_label",
  "required_per_record_provenance_status",
  "forbidden_per_record_provenance_statuses",
  "mediation_gate_level",
  "target_store",
] as const;
const CONTRACT_COUNT_KEYS = [
  "curated_source_count",
  "proposed_excerpt_count",
  "proposed_claim_count",
  "proposed_account_object_count",
  "described_flow_executions",
  "flows_executed",
  "durable_writes_executed",
  "fresh_provider_calls_on_flow_path",
] as const;

function requireExactOwnKeys(record: PlainRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new M5aContractBuilderRefusal(
      `${label} must contain exactly the expected own keys; got ${JSON.stringify(actual)}`,
    );
  }
}

function requireExactContractValue(
  record: PlainRecord,
  key: string,
  expected: unknown,
  label: string,
): void {
  if (record[key] !== expected) {
    throw new M5aContractBuilderRefusal(`${label}.${key} must be ${JSON.stringify(expected)}`);
  }
}

function requireCanonicalCount(value: unknown, label: string, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    Object.is(value, -0) ||
    value < minimum
  ) {
    throw new M5aContractBuilderRefusal(
      `${label} must be a canonical safe integer greater than or equal to ${minimum}`,
    );
  }
  return value;
}

// Runtime counterfeit detector for the M5a step-1 artifact. Downstream
// steps must call this before accepting a contract as authoritative. Every
// nested record and array is descriptor-snapshotted before any of its values
// are read, and every load-bearing shape is closed to unknown own keys.
export function verifyM5aCuratedProposalFlowContract(
  contract: unknown,
): asserts contract is M5aCuratedProposalFlowContractArtifact {
  const root = snapshotPlainOwnData(contract, "contract");
  requireExactOwnKeys(root, CONTRACT_ROOT_KEYS, "contract");

  requireExactContractValue(root, "kind", M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME, "contract");
  requireExactContractValue(
    root,
    "schema_version",
    M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION,
    "contract",
  );
  requireExactContractValue(root, "disposable", true, "contract");
  requireExactContractValue(root, "current_effective_authorization", "none", "contract");

  const flowId = requireSafeId(root.flow_id, "contract.flow_id");
  const proposalSetId = requireSafeId(root.proposal_set_id, "contract.proposal_set_id");
  const accountId = requireSafeId(root.account_id, "contract.account_id");
  const materializedAt = requireCanonicalIsoTimestamp(
    root.materialized_at,
    "contract.materialized_at",
  );
  const contractedAt = requireCanonicalIsoTimestamp(
    root.contracted_at,
    "contract.contracted_at",
  );
  if (Date.parse(contractedAt) < Date.parse(materializedAt)) {
    throw new M5aContractBuilderRefusal(
      "contract.contracted_at must be at or after contract.materialized_at",
    );
  }
  const contractArtifactId = requireSafeId(root.contract_artifact_id, "contract.contract_artifact_id");
  const expectedContractArtifactId = canonicalM5aCuratedProposalFlowContractArtifactId(
    proposalSetId,
    accountId,
    flowId,
  );
  if (contractArtifactId !== expectedContractArtifactId) {
    throw new M5aContractBuilderRefusal(
      "contract.contract_artifact_id does not match the canonical proposal_set_id / account_id / flow_id form",
    );
  }
  requireExactContractValue(
    root,
    "source_materialization_input_origin",
    M5A_PINNED_CURATION_ORIGIN,
    "contract",
  );
  requireExactContractValue(root, "next_required_artifact", M5A_NEXT_REQUIRED_ARTIFACT, "contract");

  const boundaries = snapshotPlainOwnData(root.boundaries, "contract.boundaries");
  requireExactOwnKeys(boundaries, CONTRACT_BOUNDARY_KEYS, "contract.boundaries");
  requireExactContractValue(boundaries, "current_effective_authorization", "none", "contract.boundaries");
  for (const key of [
    "authorizes_provider_call",
    "authorizes_private_evidence_read",
    "authorizes_graph_ingestion",
    "authorizes_durable_write_execution",
    "graph_ingestion_performed",
    "durable_write_execution_performed",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
    "private_evidence_read",
    "fresh_provider_call_on_flow_path_executed",
    "authorizes_flow_execution",
    "flow_execution_performed",
    "authorizes_system_side_acquisition",
    "system_side_acquisition_performed",
  ]) {
    requireExactContractValue(boundaries, key, false, "contract.boundaries");
  }
  requireExactContractValue(boundaries, "provider_calls_executed", 0, "contract.boundaries");
  for (const key of [
    "forbids_fresh_provider_call_on_flow_path",
    "defines_curated_proposal_flow_contract",
    "requires_separate_flow_approval_packet",
  ]) {
    requireExactContractValue(boundaries, key, true, "contract.boundaries");
  }

  const stages = snapshotPlainArray(root.flow_stages, "contract.flow_stages");
  if (stages.length !== FLOW_STAGES.length) {
    throw new M5aContractBuilderRefusal("contract.flow_stages must contain exactly five stages");
  }
  for (let index = 0; index < FLOW_STAGES.length; index += 1) {
    const label = `contract.flow_stages[${index}]`;
    const stage = snapshotPlainOwnData(stages[index], label);
    requireExactOwnKeys(stage, FLOW_STAGE_KEYS, label);
    const expected = FLOW_STAGES[index]!;
    requireExactContractValue(stage, "kind", expected.kind, label);
    requireExactContractValue(stage, "consumes", expected.consumes, label);
    requireExactContractValue(stage, "produces", expected.produces, label);
    requireExactContractValue(stage, "flips_marker", expected.flips_marker, label);
    const markers = snapshotPlainOwnData(stage.stage_closed_markers, `${label}.stage_closed_markers`);
    requireExactOwnKeys(markers, STAGE_CLOSED_MARKER_KEYS, `${label}.stage_closed_markers`);
    for (const key of STAGE_CLOSED_MARKER_KEYS) {
      requireExactContractValue(markers, key, false, `${label}.stage_closed_markers`);
    }
  }

  const provenance = snapshotPlainOwnData(
    root.curated_provenance_requirements,
    "contract.curated_provenance_requirements",
  );
  requireExactOwnKeys(provenance, CURATED_PROVENANCE_KEYS, "contract.curated_provenance_requirements");
  requireExactContractValue(
    provenance,
    "required_materialization_origin",
    M5A_PINNED_CURATION_ORIGIN,
    "contract.curated_provenance_requirements",
  );
  requireExactContractValue(
    provenance,
    "required_render_label_text",
    "Curated public source",
    "contract.curated_provenance_requirements",
  );
  requireExactContractValue(
    provenance,
    "required_per_card_curated_marker_data_attribute",
    "data-curated-provenance",
    "contract.curated_provenance_requirements",
  );
  const provenanceForbidden = snapshotPlainArray(
    provenance.forbidden_per_record_provenance_statuses,
    "contract.curated_provenance_requirements.forbidden_per_record_provenance_statuses",
  );
  if (provenanceForbidden.length !== 1 || provenanceForbidden[0] !== "verified") {
    throw new M5aContractBuilderRefusal(
      "contract.curated_provenance_requirements.forbidden_per_record_provenance_statuses must be exactly [\"verified\"]",
    );
  }

  const success = snapshotPlainOwnData(root.success_criterion, "contract.success_criterion");
  requireExactOwnKeys(success, SUCCESS_CRITERION_KEYS, "contract.success_criterion");
  requireExactContractValue(success, "minimum_populated_lenses", 2, "contract.success_criterion");
  requireExactContractValue(success, "minimum_ratified_durable_records", 2, "contract.success_criterion");
  for (const key of [
    "all_stages_completed",
    "curated_provenance_must_be_surfaced_per_card",
    "forbids_verified_per_record_provenance_in_render",
    "forbids_fresh_provider_call_on_any_stage",
    "forbids_system_side_acquisition_on_any_stage",
  ]) {
    requireExactContractValue(success, key, true, "contract.success_criterion");
  }

  const approval = snapshotPlainOwnData(root.approval_packet_shape, "contract.approval_packet_shape");
  requireExactOwnKeys(approval, APPROVAL_PACKET_SHAPE_KEYS, "contract.approval_packet_shape");
  requireExactContractValue(
    approval,
    "required_kind",
    "m5a-curated-proposal-flow-approval-packet",
    "contract.approval_packet_shape",
  );
  requireExactContractValue(
    approval,
    "must_reference_contract_artifact_id",
    contractArtifactId,
    "contract.approval_packet_shape",
  );
  requireExactContractValue(
    approval,
    "must_reference_materialization_input_proposal_set_id",
    proposalSetId,
    "contract.approval_packet_shape",
  );
  requireExactContractValue(
    approval,
    "must_reference_account_id",
    root.account_id,
    "contract.approval_packet_shape",
  );
  for (const key of [
    "drafted_and_unarmed_by_default",
    "retry_requires_new_approval",
    "expiry_required",
    "operator_arming_required_for_flow_execution",
    "inherits_forbids_fresh_provider_call_on_flow_path",
    "inherits_forbids_system_side_acquisition",
  ]) {
    requireExactContractValue(approval, key, true, "contract.approval_packet_shape");
  }
  requireExactContractValue(approval, "max_flow_executions", 1, "contract.approval_packet_shape");
  requireExactContractValue(approval, "retry_budget", 0, "contract.approval_packet_shape");
  requireExactContractValue(
    approval,
    "required_row_trust_label",
    M5A_PINNED_ROW_TRUST_LABEL,
    "contract.approval_packet_shape",
  );
  requireExactContractValue(
    approval,
    "required_per_record_provenance_status",
    M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
    "contract.approval_packet_shape",
  );
  requireExactContractValue(
    approval,
    "mediation_gate_level",
    M5A_PINNED_MEDIATION_GATE_LEVEL,
    "contract.approval_packet_shape",
  );
  requireExactContractValue(approval, "target_store", M5A_PINNED_TARGET_STORE, "contract.approval_packet_shape");
  const approvalForbidden = snapshotPlainArray(
    approval.forbidden_per_record_provenance_statuses,
    "contract.approval_packet_shape.forbidden_per_record_provenance_statuses",
  );
  if (approvalForbidden.length !== 1 || approvalForbidden[0] !== "verified") {
    throw new M5aContractBuilderRefusal(
      "contract.approval_packet_shape.forbidden_per_record_provenance_statuses must be exactly [\"verified\"]",
    );
  }

  const counts = snapshotPlainOwnData(root.counts, "contract.counts");
  requireExactOwnKeys(counts, CONTRACT_COUNT_KEYS, "contract.counts");
  for (const key of ["curated_source_count", "proposed_excerpt_count", "proposed_claim_count"]) {
    requireCanonicalCount(counts[key], `contract.counts.${key}`, 1);
  }
  requireCanonicalCount(
    counts.proposed_account_object_count,
    "contract.counts.proposed_account_object_count",
  );
  requireCanonicalCount(counts.described_flow_executions, "contract.counts.described_flow_executions", 1);
  requireExactContractValue(counts, "described_flow_executions", 1, "contract.counts");
  for (const key of [
    "flows_executed",
    "durable_writes_executed",
    "fresh_provider_calls_on_flow_path",
  ]) {
    requireCanonicalCount(counts[key], `contract.counts.${key}`);
    requireExactContractValue(counts, key, 0, "contract.counts");
  }

  requireExactContractValue(root, "provider_calls_made", 0, "contract");
  for (const key of [
    "private_evidence_read",
    "graph_ingestion_performed",
    "durable_writes_performed",
    "production_writes",
    "readiness_claim",
  ]) {
    requireExactContractValue(root, key, false, "contract");
  }
}

export interface BuildM5aCuratedProposalFlowContractInput {
  readonly flowId: string;
  readonly now: string;
}

export function buildM5aCuratedProposalFlowContract(
  materializationInput: unknown,
  options: BuildM5aCuratedProposalFlowContractInput,
): M5aCuratedProposalFlowContractArtifact {
  // Snapshot-once-render-from-locals discipline (M3 step 3a retro §3,
  // M5a step 1 hardening pass 2026-06-17). Every value is descriptor-
  // snapshotted into a frozen local before being read; the artifact is
  // rendered exclusively from these locals. A hostile getter that
  // returns a safe value during validation and an unsafe value during
  // render (the TOCTOU shape) cannot smuggle anything: the validated
  // value IS the rendered value, taken from the same snapshot.

  // (1) Snapshot the options object first. The caller may pass a
  // hostile options object (Proxy, accessor-backed `flowId`/`now`).
  const optsSnap = snapshotPlainOwnData(options as unknown, "options");
  const flowId = requireSafeId(optsSnap.flowId, "options.flowId");
  const now = requireCanonicalIsoTimestamp(optsSnap.now, "options.now");

  // (2) Snapshot the root materialization input.
  const rootSnap = snapshotPlainOwnData(materializationInput, "materializationInput");

  // (3) Snapshot the context sub-object. The materialization input's
  // context carries the curated-provenance marker and the bound ids;
  // it is the most hostile-input surface in the contract slice.
  const contextSnap = snapshotPlainOwnData(rootSnap.context, "materializationInput.context");

  // (4) Validate the curated-provenance marker against the pinned
  // value. STRUCTURAL ENFORCEMENT — the contract refuses every
  // non-`hand-curated-public` origin, including accessor-backed
  // origins that pass first-read and switch under second-read (the
  // snapshot above already prevents that by reading from a frozen
  // local).
  const origin = contextSnap.origin;
  if (origin !== M5A_PINNED_CURATION_ORIGIN) {
    throw new M5aContractBuilderRefusal(
      `materializationInput.context.origin must be "${M5A_PINNED_CURATION_ORIGIN}"; M5a is curated-source only`,
    );
  }

  // (5) Copy validated scalars into locals. Each requireSafeId /
  // requireCanonicalIsoTimestamp returns the exact validated value;
  // the artifact below uses ONLY these locals.
  const accountId = requireSafeId(contextSnap.account_id, "materializationInput.context.account_id");
  const proposalSetId = requireSafeId(contextSnap.proposal_set_id, "materializationInput.context.proposal_set_id");
  const materializedAt = requireCanonicalIsoTimestamp(
    contextSnap.materialized_at,
    "materializationInput.context.materialized_at",
  );

  // (6) Snapshot the required arrays. snapshotPlainArray refuses
  // Proxy arrays, accessor-backed indices, symbol keys, etc., before
  // any element is read. We only need the lengths from these for
  // counts; we do NOT read individual elements (the element shape is
  // a downstream-slice concern: the validate stage of the eventual
  // flow runs the full graph validator). The snapshot still walks
  // every index to refuse hostile descriptors.
  const publicSources = snapshotPlainArray(rootSnap.public_sources, "materializationInput.public_sources");
  if (publicSources.length === 0) {
    throw new M5aContractBuilderRefusal("materializationInput.public_sources must be a non-empty array");
  }
  const proposedExcerpts = snapshotPlainArray(rootSnap.proposed_excerpts, "materializationInput.proposed_excerpts");
  if (proposedExcerpts.length === 0) {
    throw new M5aContractBuilderRefusal("materializationInput.proposed_excerpts must be a non-empty array");
  }
  const proposedClaims = snapshotPlainArray(rootSnap.proposed_claims, "materializationInput.proposed_claims");
  if (proposedClaims.length === 0) {
    throw new M5aContractBuilderRefusal("materializationInput.proposed_claims must be a non-empty array");
  }
  // Optional. If present, MUST be an array (snapshotPlainArray
  // refuses non-array). A hostile caller previously could smuggle a
  // string in here, making `proposed_account_object_count` a string
  // at runtime; the snapshot fix prevents this.
  let proposedAccountObjectsLength = 0;
  if (rootSnap.proposed_account_objects !== undefined) {
    const proposedAccountObjects = snapshotPlainArray(
      rootSnap.proposed_account_objects,
      "materializationInput.proposed_account_objects",
    );
    proposedAccountObjectsLength = proposedAccountObjects.length;
  }

  const contractArtifactId = canonicalM5aCuratedProposalFlowContractArtifactId(
    proposalSetId,
    accountId,
    flowId,
  );

  // Render the artifact EXCLUSIVELY from validated locals. No snap.*
  // or options.* read survives past this point — that is the
  // load-bearing invariant of the snapshot-once-render-from-locals
  // discipline. A hostile getter that switched between validation
  // and render passes (the TOCTOU shape) cannot smuggle anything,
  // because every value below is the validated value.
  const contract: M5aCuratedProposalFlowContractArtifact = Object.freeze({
    kind: M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME,
    schema_version: M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION,
    disposable: true as const,
    current_effective_authorization: "none" as const,
    contract_artifact_id: contractArtifactId,
    flow_id: flowId,
    proposal_set_id: proposalSetId,
    account_id: accountId,
    materialized_at: materializedAt,
    contracted_at: now,
    source_materialization_input_origin: M5A_PINNED_CURATION_ORIGIN,
    next_required_artifact: M5A_NEXT_REQUIRED_ARTIFACT,
    boundaries: Object.freeze({
      current_effective_authorization: "none" as const,
      authorizes_provider_call: false as const,
      authorizes_private_evidence_read: false as const,
      authorizes_graph_ingestion: false as const,
      authorizes_durable_write_execution: false as const,
      graph_ingestion_performed: false as const,
      durable_write_execution_performed: false as const,
      durable_writes_performed: false as const,
      production_writes: false as const,
      readiness_claim: false as const,
      provider_calls_executed: 0 as const,
      private_evidence_read: false as const,
      forbids_fresh_provider_call_on_flow_path: true as const,
      fresh_provider_call_on_flow_path_executed: false as const,
      defines_curated_proposal_flow_contract: true as const,
      authorizes_flow_execution: false as const,
      flow_execution_performed: false as const,
      requires_separate_flow_approval_packet: true as const,
      authorizes_system_side_acquisition: false as const,
      system_side_acquisition_performed: false as const,
    }),
    flow_stages: FLOW_STAGES,
    curated_provenance_requirements: Object.freeze({
      required_materialization_origin: M5A_PINNED_CURATION_ORIGIN,
      required_render_label_text: "Curated public source",
      required_per_card_curated_marker_data_attribute: "data-curated-provenance",
      forbidden_per_record_provenance_statuses: Object.freeze(["verified"] as const),
    }),
    success_criterion: Object.freeze({
      all_stages_completed: true as const,
      minimum_populated_lenses: 2 as const,
      minimum_ratified_durable_records: 2 as const,
      curated_provenance_must_be_surfaced_per_card: true as const,
      forbids_verified_per_record_provenance_in_render: true as const,
      forbids_fresh_provider_call_on_any_stage: true as const,
      forbids_system_side_acquisition_on_any_stage: true as const,
    }),
    approval_packet_shape: Object.freeze({
      required_kind: "m5a-curated-proposal-flow-approval-packet" as const,
      must_reference_contract_artifact_id: contractArtifactId,
      must_reference_materialization_input_proposal_set_id: proposalSetId,
      must_reference_account_id: accountId,
      drafted_and_unarmed_by_default: true as const,
      max_flow_executions: 1 as const,
      retry_budget: 0 as const,
      retry_requires_new_approval: true as const,
      expiry_required: true as const,
      operator_arming_required_for_flow_execution: true as const,
      inherits_forbids_fresh_provider_call_on_flow_path: true as const,
      inherits_forbids_system_side_acquisition: true as const,
      // Positive trust-tier pins — operator hardening 2026-06-17. The
      // packet is required to carry the row trust label and the per-
      // record provenance status as POSITIVE values, not merely the
      // negative "not verified" prohibition. The M3 step 3a retro §1
      // discipline made these positive structural properties of the
      // durable store; the contract slice carries them forward as
      // positive requirements on step 2 so the inheritance is a
      // constraint, not a promise.
      required_row_trust_label: M5A_PINNED_ROW_TRUST_LABEL,
      required_per_record_provenance_status: M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
      forbidden_per_record_provenance_statuses: Object.freeze(["verified"] as const),
      mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
      target_store: M5A_PINNED_TARGET_STORE,
    }),
    counts: Object.freeze({
      curated_source_count: publicSources.length,
      proposed_excerpt_count: proposedExcerpts.length,
      proposed_claim_count: proposedClaims.length,
      proposed_account_object_count: proposedAccountObjectsLength,
      described_flow_executions: 1 as const,
      flows_executed: 0 as const,
      durable_writes_executed: 0 as const,
      fresh_provider_calls_on_flow_path: 0 as const,
    }),
    provider_calls_made: 0 as const,
    private_evidence_read: false as const,
    graph_ingestion_performed: false as const,
    durable_writes_performed: false as const,
    production_writes: false as const,
    readiness_claim: false as const,
  });
  verifyM5aCuratedProposalFlowContract(contract);
  return contract;
}

// Type-only re-export to keep the GraphBundle shape importable by
// consumers of this contract without re-declaring it.
export type { GraphBundle };
