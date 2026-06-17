# M5a Curated Proposal Flow Contract Status

Status: active

This runbook records the M5a step 1 artifact — a no-call typed contract for the curated-source proposal flow end-to-end. M5a is the doctrine-loop capstone on curated public sources (per `docs/strategy/roadmap.md` §P-track M5a and the M3 retro §4 disposition recording M5a as the next M-track slice). The contract slice executes nothing: it is the typed surface that the next slice (the M5a step 2 approval packet) will be validated against, mirroring the no-write contract shape M3 step 1 opened with.

The contract slice ships only the contract surface — typed shape, builder, closed boundary markers, success-criterion shape, and the typed shape of the future approval packet. No approval packet, no arming, no execution.

Operator decision provenance (2026-06-17):

- **Path 1 ratified — recorded proposals.** M5a consumes a hand-curated public materialization input (the existing committed shape: `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json` with `context.origin === "hand-curated-public"`). The contract refuses any materialization input lacking this curated-provenance marker. Rationale recorded in the contract module header: Path 2 (a one-shot armed model call against the curated bundle at flow time) would conflate real-flow with real-time provider call — exactly the conflation ADR 0003 guards against — AND would destroy the diagnostic property that justified curated-before-acquired sequencing (Path 1 isolates loop failures to validate/ratify/write/render; Path 2 could fail at the call/arming/loop level and the diagnostic cost balloons). The runtime-provider-call surface remains M4 capstone territory, where its arming pattern belongs.
- **Contract-only slice scope confirmed.** Step 1 ships typed shape + runbook + safety test + INDEX. No approval packet (that's M5a step 2), no arming (Path 1 means M5a never needs a runtime-provider-call arming surface), no execution.
- **Namespace `src/workshop/m5a-*` confirmed.** M5a's architecture is reuse of M3-shipped workshop surfaces (ratification, durable write, render). A new top-level `src/m5a/` namespace would visually imply M5a is a separate subsystem when it is actually the proof that the workshop subsystem does its job on a real flow. Filing under `src/workshop/` keeps the code structure honest.

Two structural shape requirements folded in (operator 2026-06-17):

- **Curated provenance is a typed property of the success criterion, not prose.** The contract carries `curated_provenance_requirements` requiring (a) the materialization input's `context.origin` matches the pinned curation origin, (b) the rendered page surfaces the curated label per durable card via a `data-curated-provenance` attribute, and (c) per-record `provenance_status` may not be `verified` under the M5a admission row trust label. The safety test locks the structural negative: the contract cannot be built without the curated-provenance marker on the input, and the success criterion cannot declare success in any branch that omits the per-card curated surfacing.
- **Path 1 is enforced by a closed boundary marker, not merely chosen.** `boundaries.forbids_fresh_provider_call_on_flow_path: true`. The success criterion separately asserts `forbids_fresh_provider_call_on_any_stage: true`. The future approval packet inherits both via `inherits_forbids_fresh_provider_call_on_flow_path: true`. A later slice that wired a fresh provider call into the M5a flow would have to flip these markers AND open a new approval surface — neither of which is in M5a's scope.

Doctrine alignment (ADR 0003; M3 step 3a retro; M3 retro):

- M5a is the curated-source doctrine-loop capstone. It reuses M3-shipped surfaces (the proposal-ratification surface, the durable graph-write executor and its arming, the durable-graph-snapshots reader, the durable-state render). It introduces no new mediation gate; the durable-write stage stamps `L0` exactly as M3 step 3a established. It adds no new acquisition risk class; system-side acquisition is M4's to introduce, and the contract is marker-closed against that path.
- Trust-tier discipline (M3 step 3a retro §1) is preserved structurally: M5a's ratified records carry per-record `provenance_status: source_document_only` under the row-level admission trust label `model-proposed-human-ratified-evidence-pending`. The success criterion includes `forbids_verified_per_record_provenance_in_render: true`, mirroring the reader and render-side composer's M3 step 3b refusals.

Artifacts:

- Implementation: `src/workshop/m5a-curated-proposal-flow-contract.ts`
- Safety contract test: `tests/safety/m5a-curated-proposal-flow-contract.test.ts`
- Materialization input shape it reads from: `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json` (reuses the existing M3-step-3a-consumed shape; not modified by this slice)
- INDEX: `docs/runbooks/INDEX.md`

Boundary markers (the contract authorizes nothing):

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- authorizes_durable_write_execution: false
- graph_ingestion_performed: false
- durable_write_execution_performed: false
- durable_writes_performed: false
- production_writes: false
- readiness_claim: false
- provider_calls_executed: 0
- forbids_fresh_provider_call_on_flow_path: true
- fresh_provider_call_on_flow_path_executed: false
- defines_curated_proposal_flow_contract: true
- authorizes_flow_execution: false
- flow_execution_performed: false
- requires_separate_flow_approval_packet: true
- authorizes_system_side_acquisition: false
- system_side_acquisition_performed: false

What exists:

- `buildM5aCuratedProposalFlowContract(materializationInput, { flowId, now })` consumes a curated materialization input and produces a frozen `M5aCuratedProposalFlowContractArtifact`. The builder refuses any input lacking `context.origin === "hand-curated-public"`, lacking a safe account_id/proposal_set_id, lacking a canonical ISO `materialized_at`, or with empty `public_sources`/`proposed_excerpts`/`proposed_claims` arrays.
- The contract artifact carries five typed `flow_stages` (`materialize` → `validate` → `ratify` → `durable_write` → `render`), each with consumed/produced artifact names and stage-level closed markers (`authorizes_provider_call: false`, `authorizes_system_side_acquisition: false`, `readiness_claim: false`).
- `curated_provenance_requirements` carries the required materialization origin, the required render-side label text ("Curated public source"), the required per-card `data-curated-provenance` attribute, and the forbidden per-record `provenance_status` values (currently `["verified"]`).
- `success_criterion` carries: `all_stages_completed: true`, `minimum_populated_lenses: 2`, `minimum_ratified_durable_records: 2`, `curated_provenance_must_be_surfaced_per_card: true`, `forbids_verified_per_record_provenance_in_render: true`, `forbids_fresh_provider_call_on_any_stage: true`, `forbids_system_side_acquisition_on_any_stage: true`.
- `approval_packet_shape` is the typed shape M5a step 2 must conform to: kind, must-reference-contract-artifact-id, must-reference-proposal-set-id, must-reference-account-id, drafted-and-unarmed-by-default, max_flow_executions: 1, retry_budget: 0, expiry_required, operator_arming_required_for_flow_execution, inherits-forbids-fresh-provider-call-on-flow-path, inherits-forbids-system-side-acquisition, mediation_gate_level: L0, target_store: local-durable-db.
- `counts` surfaces the curated source/excerpt/claim/account-object counts from the consumed materialization input (the builder does not invent counts; it surfaces what the input carries) plus the contract-level execution counts (`flows_executed: 0`, `durable_writes_executed: 0`, `fresh_provider_calls_on_flow_path: 0`).

Refusal conditions (the builder's reject paths):

- materialization input not a plain own-data object
- materialization input `context` not a plain own-data object
- materialization input `context.origin` not the pinned `"hand-curated-public"` value (the structural curated-provenance gate)
- materialization input `context.account_id` not a safe id
- materialization input `context.proposal_set_id` not a safe id
- materialization input `context.materialized_at` not a canonical ISO timestamp
- materialization input `public_sources`, `proposed_excerpts`, or `proposed_claims` empty or not array
- `flowId` not a safe id
- `now` not a canonical ISO timestamp

Non-goals:

- No approval packet. M5a step 2.
- No arming. Path 1 means M5a never needs a runtime-provider-call arming surface; if a future slice wires a fresh call onto the M5a flow path, it must flip `forbids_fresh_provider_call_on_flow_path` and open a new approval surface.
- No flow execution. The contract names the stages and their typed shape; the stages run only after M5a step 2's approval and M5a step 3+'s execution slices.
- No model call, no web search, no provider spend.
- No private evidence read. The contract reads only the curated public materialization input, which is `hand-curated-public` by typed marker.
- No system-side acquisition. M4 territory. The contract is marker-closed against this path.
- No production write, no deployment, no readiness claim, no launch-readiness claim. M5a's eventual visible artifact is the loop-proof page (the curated capstone), not a product launch. M5b and M7 still gate the launch surface.
- No M2.5 SKILL.md packaging work. Out of M5a scope.
- No corpus expansion. The contract is one flow over one committed curated materialization input.

Verification coverage:

`tests/safety/m5a-curated-proposal-flow-contract.test.ts` proves:

- the contract module exports the pinned constants (curation origin `hand-curated-public`, mediation gate level `L0`, target store `local-durable-db`, row trust label `model-proposed-human-ratified-evidence-pending`, per-record provenance status `source_document_only`)
- the happy path: a valid curated materialization input plus a safe flowId and ISO `now` produces a frozen contract artifact with all closed markers, the five typed flow stages in order, the curated-provenance requirements present, the success criterion's structural fields all true, and the approval-packet shape inheriting the Path-1 marker
- the builder refuses each of the enumerated reject paths, including (critically) any materialization input whose `context.origin` is not the pinned `hand-curated-public` value
- the success criterion's structural fields (`curated_provenance_must_be_surfaced_per_card`, `forbids_verified_per_record_provenance_in_render`, `forbids_fresh_provider_call_on_any_stage`, `forbids_system_side_acquisition_on_any_stage`) all literally true — locks the typed-property-not-prose discipline
- the boundary markers `forbids_fresh_provider_call_on_flow_path: true` and `fresh_provider_call_on_flow_path_executed: false` are present — locks Path 1 structural enforcement
- the contract module imports no provider SDK, performs no I/O, reads no `process.env`, has no network imports
- this runbook records the load-bearing claims in greppable form: curation origin pin, Path 1 rationale, structural-property-of-success-criterion claim, Path-1-marker claim, stage list with ordering, and the trust-tier-discipline-preserved claim
- the runbook index lists this runbook exactly once and frames it as the M5a step 1 contract-only slice
- the safety contract test asserts the existing M3-step-3a-consumed materialization input fixture passes the M5a contract builder unchanged (the committed input is a curated proposal flow source by construction, and the contract slice does not modify it)

What this slice gates:

- **M5a step 2** (the curated proposal flow approval packet) is the next M5a artifact. It consumes this contract and produces a disposable, drafted-and-unarmed approval packet conforming to `approval_packet_shape`. Step 2 inherits the Path-1 and trust-tier markers; it cannot quietly relax them.
- **M5a step 3+** (validation, ratification, durable write, render) reuse M3-shipped surfaces (the M3 step 3a executor and arming module, the M3 step 3b reader and render-side composer). These are not modified by this slice. M5a's success-criterion eventually evaluates the rendered page produced by reusing these surfaces.
- **The Path-1 disposition (operator 2026-06-17) is recorded as load-bearing for M5a.** A future slice that wished to introduce a fresh provider call on the M5a flow path would have to (a) flip the contract's `forbids_fresh_provider_call_on_flow_path` marker, (b) open a new approval surface analogous to M3 step 3a's operator arming, and (c) revisit the M3 retro §4 sequencing call. The recorded rationale stays as the burden any such change has to discharge.
- **M4 (system-side acquisition) and M5b (does-its-job-once on system-acquired sources) remain downstream of M5a.** The identity question of whether acquisition is the product's job or a feature input gets its real answer when M5a's curated-source result is in hand. This contract does not preempt that decision.
