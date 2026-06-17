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
// next slice (the M5a approval packet) will be validated against and
// the slices after that will execute against — same shape M3 step 1
// opened with for the durable-write surface, scoped one level up.
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

import type { GraphBundle } from "../graph/types.ts";

export const M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME =
  "m5a-curated-proposal-flow-contract" as const;

export const M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION =
  "atliera.m5a_curated_proposal_flow_contract.v1" as const;

// The next required artifact in the M5a slice arc. The M5a step 2
// approval packet must conform to the typed shape this contract
// publishes in `approval_packet_shape`.
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

// The typed shape of the future M5a approval packet (step 2). Like
// M3 step 1, the contract publishes the shape that step 2 must
// conform to, so step 2 has a fixed target to validate against.
export interface M5aApprovalPacketShape {
  readonly required_kind: "m5a-curated-proposal-flow-approval-packet";
  readonly must_reference_contract_artifact_id: string;
  readonly must_reference_materialization_input_proposal_set_id: string;
  readonly must_reference_account_id: string;
  // M5a step 2 packet, like M3 step 2, is drafted-and-unarmed by
  // default. Arming a flow execution is M5a step 3+ work, not step 2.
  readonly drafted_and_unarmed_by_default: true;
  readonly max_flow_executions: 1;
  readonly retry_budget: 0;
  readonly retry_requires_new_approval: true;
  readonly expiry_required: true;
  readonly operator_arming_required_for_flow_execution: true;
  // The packet inherits the contract's Path-1 marker and trust-tier
  // pins so step 2 cannot quietly relax them.
  readonly inherits_forbids_fresh_provider_call_on_flow_path: true;
  readonly inherits_forbids_system_side_acquisition: true;
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

// The shape of the materialization input fixture the contract reads
// from. Matches the existing committed shape of
// `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json`
// — the artifact M3 step 3a's executor already consumes. The contract
// does NOT redefine the materialization input's full graph shape; it
// snapshots only the fields needed to (a) verify curated provenance,
// (b) count proposed records, and (c) bind the flow to its
// proposal_set_id and account_id.
interface MaterializationInputCuratedShape {
  readonly context: {
    readonly origin: string;
    readonly account_id: string;
    readonly materialized_at: string;
    readonly proposal_set_id: string;
  };
  readonly public_sources: readonly { readonly id: string }[];
  readonly proposed_excerpts: readonly { readonly proposal_id: string }[];
  readonly proposed_claims: readonly { readonly proposal_id: string }[];
  readonly proposed_account_objects?: readonly { readonly proposal_id: string }[];
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

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

export interface BuildM5aCuratedProposalFlowContractInput {
  readonly flowId: string;
  readonly now: string;
}

export function buildM5aCuratedProposalFlowContract(
  materializationInput: unknown,
  options: BuildM5aCuratedProposalFlowContractInput,
): M5aCuratedProposalFlowContractArtifact {
  // The builder snapshots only the fields it needs (no full graph
  // validation here — the validate stage in the eventual flow runs
  // the full graph validator). Refuses any input that does not match
  // the curated materialization shape.
  if (
    materializationInput === null ||
    typeof materializationInput !== "object" ||
    Array.isArray(materializationInput)
  ) {
    throw new Error("materializationInput must be a plain own-data object");
  }
  const snap = materializationInput as MaterializationInputCuratedShape;
  if (
    snap.context === null ||
    typeof snap.context !== "object" ||
    Array.isArray(snap.context)
  ) {
    throw new Error("materializationInput.context must be a plain own-data object");
  }
  if (snap.context.origin !== M5A_PINNED_CURATION_ORIGIN) {
    // Structural enforcement of the operator shape requirement: the
    // curated-provenance marker MUST be present on the materialization
    // input; the contract cannot be built without it.
    throw new Error(
      `materializationInput.context.origin must be "${M5A_PINNED_CURATION_ORIGIN}"; M5a is curated-source only`,
    );
  }
  if (typeof snap.context.account_id !== "string" || !SAFE_ID.test(snap.context.account_id)) {
    throw new Error("materializationInput.context.account_id must be a safe id");
  }
  if (typeof snap.context.proposal_set_id !== "string" || !SAFE_ID.test(snap.context.proposal_set_id)) {
    throw new Error("materializationInput.context.proposal_set_id must be a safe id");
  }
  if (typeof snap.context.materialized_at !== "string" || !ISO_TIMESTAMP.test(snap.context.materialized_at)) {
    throw new Error("materializationInput.context.materialized_at must be a canonical ISO timestamp");
  }
  if (!Array.isArray(snap.public_sources) || snap.public_sources.length === 0) {
    throw new Error("materializationInput.public_sources must be a non-empty array");
  }
  if (!Array.isArray(snap.proposed_excerpts) || snap.proposed_excerpts.length === 0) {
    throw new Error("materializationInput.proposed_excerpts must be a non-empty array");
  }
  if (!Array.isArray(snap.proposed_claims) || snap.proposed_claims.length === 0) {
    throw new Error("materializationInput.proposed_claims must be a non-empty array");
  }
  if (!SAFE_ID.test(options.flowId)) {
    throw new Error("flowId must be a safe id");
  }
  if (!ISO_TIMESTAMP.test(options.now)) {
    throw new Error("options.now must be a canonical ISO timestamp");
  }

  const contractArtifactId = `m5a-flow-contract:${snap.context.proposal_set_id}:${options.flowId}`;

  return Object.freeze({
    kind: M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME,
    schema_version: M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION,
    disposable: true as const,
    current_effective_authorization: "none" as const,
    contract_artifact_id: contractArtifactId,
    flow_id: options.flowId,
    proposal_set_id: snap.context.proposal_set_id,
    account_id: snap.context.account_id,
    materialized_at: snap.context.materialized_at,
    contracted_at: options.now,
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
      must_reference_materialization_input_proposal_set_id: snap.context.proposal_set_id,
      must_reference_account_id: snap.context.account_id,
      drafted_and_unarmed_by_default: true as const,
      max_flow_executions: 1 as const,
      retry_budget: 0 as const,
      retry_requires_new_approval: true as const,
      expiry_required: true as const,
      operator_arming_required_for_flow_execution: true as const,
      inherits_forbids_fresh_provider_call_on_flow_path: true as const,
      inherits_forbids_system_side_acquisition: true as const,
      mediation_gate_level: M5A_PINNED_MEDIATION_GATE_LEVEL,
      target_store: M5A_PINNED_TARGET_STORE,
    }),
    counts: Object.freeze({
      curated_source_count: snap.public_sources.length,
      proposed_excerpt_count: snap.proposed_excerpts.length,
      proposed_claim_count: snap.proposed_claims.length,
      proposed_account_object_count: snap.proposed_account_objects?.length ?? 0,
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
}

// Type-only re-export to keep the GraphBundle shape importable by
// consumers of this contract without re-declaring it.
export type { GraphBundle };
