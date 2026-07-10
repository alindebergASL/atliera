# M5a Curated Proposal Flow Contract Status

Status: active

This runbook records the M5a Step 1 artifact — a no-call typed contract for the curated-source proposal flow end-to-end. M5a is the doctrine-loop capstone on curated public sources (per `docs/strategy/roadmap.md` §P-track M5a and the M3 retro §4 disposition). The contract slice executes nothing. Step 2 now consumes and validates this contract to produce the drafted packet; Step 3 produces a separate armed-state artifact; Step 4 is next.

Step 1 itself ships only the contract surface — typed shape, builder, runtime verifier, closed boundary markers, success-criterion shape, and the typed shape consumed by the Step 2 approval packet. It performs no packet drafting, arming, or execution.

Operator decision provenance (2026-06-17):

- **Path 1 ratified — recorded proposals.** M5a consumes a hand-curated public materialization input (the existing committed shape: `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json` with `context.origin === "hand-curated-public"`). The contract refuses any materialization input lacking this curated-provenance marker. Rationale recorded in the contract module header: Path 2 (a one-shot armed model call against the curated bundle at flow time) would conflate real-flow with real-time provider call — exactly the conflation ADR 0003 guards against — AND would destroy the diagnostic property that justified curated-before-acquired sequencing (Path 1 isolates loop failures to validate/ratify/write/render; Path 2 could fail at the call/arming/loop level and the diagnostic cost balloons). The runtime-provider-call surface remains M4 capstone territory, where its arming pattern belongs.
- **Step-1 contract-only scope confirmed.** Step 1 ships typed shape + builder/verifier + runbook + safety test + INDEX. Step 2 packet drafting and Step 3 recorded-flow arming now exist in their own modules; Step 4 execution remains separate. Path 1 still means M5a has no runtime-provider-call arming surface.
- **Namespace `src/workshop/m5a-*` confirmed.** M5a's architecture is reuse of M3-shipped workshop surfaces (ratification, durable write, render). A new top-level `src/m5a/` namespace would visually imply M5a is a separate subsystem when it is actually the proof that the workshop subsystem does its job on a real flow. Filing under `src/workshop/` keeps the code structure honest.

Two structural shape requirements folded in (operator 2026-06-17):

- **Curated provenance is a typed property of the success criterion, not prose.** The contract carries `curated_provenance_requirements` requiring (a) the materialization input's `context.origin` matches the pinned curation origin, (b) the rendered page surfaces the curated label per durable card via a `data-curated-provenance` attribute, and (c) per-record `provenance_status` may not be `verified` under the M5a admission row trust label. The safety test locks the structural negative: the contract cannot be built without the curated-provenance marker on the input, and the success criterion cannot declare success in any branch that omits the per-card curated surfacing.
- **Path 1 is enforced by a closed boundary marker, not merely chosen.** `boundaries.forbids_fresh_provider_call_on_flow_path: true`. The success criterion separately asserts `forbids_fresh_provider_call_on_any_stage: true`. The Step 2 approval packet inherits both via `inherits_forbids_fresh_provider_call_on_flow_path: true`. A later slice that wired a fresh provider call into the M5a flow would have to flip these markers AND open a new approval surface — neither of which is in M5a's scope.

Doctrine alignment (ADR 0003; M3 step 3a retro; M3 retro):

- M5a is the curated-source doctrine-loop capstone. It reuses M3-shipped surfaces (the proposal-ratification surface, the durable graph-write executor and its arming, the durable-graph-snapshots reader, the durable-state render). It introduces no new mediation gate. Step 1 only carries a prospective `mediation_gate_level: L0` policy pin in `approval_packet_shape`; it stamps no effect. Only a completed Step 4 durable effect may carry the `mediation_gate_level: L0` stamp established by M3 step 3a. It adds no new acquisition risk class; system-side acquisition is M4's to introduce, and the contract is marker-closed against that path.
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

- `buildM5aCuratedProposalFlowContract(materializationInput, { flowId, now })` consumes a curated materialization input and produces a frozen `M5aCuratedProposalFlowContractArtifact`. The builder uses **snapshot-once-render-from-locals** discipline (M5a step 1 hardening pass 2026-06-17; see below). Every value is descriptor-snapshotted into a frozen local at entry, validated against the local, and the artifact is rendered exclusively from those locals — never from a re-read of the input. The builder refuses any input lacking `context.origin === "hand-curated-public"`, lacking a safe account_id/proposal_set_id, lacking a canonical ISO `materialized_at` (parse + canonical round-trip, not regex-only), with empty `public_sources`/`proposed_excerpts`/`proposed_claims` arrays, with Proxy-backed or accessor-backed inputs at any level, with symbol-keyed or unsafe-key own properties, with hostile Proxy-backed or accessor-backed `options`, with a non-array `proposed_account_objects`, or with an array length above the documented M5a maximum of 100,000. The completed artifact is passed through the runtime verifier before return.
- `verifyM5aCuratedProposalFlowContract(contract)` is the downstream counterfeit detector introduced by the PR #280 hardening pass. It descriptor-snapshots the root and every nested record/array, requires exact own-key sets, independently verifies the canonical identity, chronology (`materialized_at <= contracted_at`), five-stage sequence, closed authorization/effect markers, curated provenance, trust-tier pins, success criterion, approval shape, and canonical nonnegative counts, and refuses broadened or hostile shapes with `M5aContractBuilderRefusal`. Steps 2 and 3 call it before accepting a step-1 artifact.
- `canonicalM5aCuratedProposalFlowContractArtifactId(proposalSetId, accountId, flowId)` derives `m5a-flow-contract:<40-hex-digest>` from an unambiguous JSON tuple and a 160-bit SHA-256 prefix. Both builder and verifier call it from validated locals. The account dimension is load-bearing: otherwise two honest contracts for different accounts but the same proposal set and flow would collide.
- The contract artifact carries five typed `flow_stages` (`materialize` → `validate` → `ratify` → `durable_write` → `render`), each with consumed/produced artifact names and stage-level closed markers (`authorizes_provider_call: false`, `authorizes_system_side_acquisition: false`, `readiness_claim: false`).
- `curated_provenance_requirements` carries the required materialization origin, the required render-side label text ("Curated public source"), the required per-card `data-curated-provenance` attribute, and the forbidden per-record `provenance_status` values (currently `["verified"]`).
- `success_criterion` carries: `all_stages_completed: true`, `minimum_populated_lenses: 2`, `minimum_ratified_durable_records: 2`, `curated_provenance_must_be_surfaced_per_card: true`, `forbids_verified_per_record_provenance_in_render: true`, `forbids_fresh_provider_call_on_any_stage: true`, `forbids_system_side_acquisition_on_any_stage: true`.
- `approval_packet_shape` is the typed shape M5a step 2 must conform to. It carries POSITIVE trust-tier pins as REQUIRED fields: `required_row_trust_label: "model-proposed-human-ratified-evidence-pending"` and `required_per_record_provenance_status: "source_document_only"`. It ALSO carries the negative prohibition `forbidden_per_record_provenance_statuses: ["verified"]`. The positive pins are load-bearing: "not verified" is not the same claim as "is this specific pending label," and the gap between them is exactly where a future step could land a record in some third unlabeled state. Plus: kind, must-reference-contract-artifact-id, must-reference-proposal-set-id, must-reference-account-id, drafted-and-unarmed-by-default, max_flow_executions: 1, retry_budget: 0, expiry_required, operator_arming_required_for_flow_execution, inherits-forbids-fresh-provider-call-on-flow-path, inherits-forbids-system-side-acquisition, mediation_gate_level: L0, target_store: local-durable-db.
- `counts` surfaces the curated source/excerpt/claim/account-object counts from the consumed materialization input (the builder does not invent counts; it surfaces what the input carries, after snapshot) plus the contract-level execution counts (`flows_executed: 0`, `durable_writes_executed: 0`, `fresh_provider_calls_on_flow_path: 0`).

Refusal conditions (builder and runtime-verifier reject paths):

- materialization input not a plain own-data object
- materialization input `context` not a plain own-data object
- materialization input `context.origin` not the pinned `"hand-curated-public"` value (the structural curated-provenance gate)
- materialization input `context.account_id` not a safe id
- materialization input `context.proposal_set_id` not a safe id
- materialization input `context.materialized_at` not a canonical ISO timestamp
- materialization input `public_sources`, `proposed_excerpts`, or `proposed_claims` empty or not array
- `flowId` not a safe id
- `now` not a canonical ISO timestamp
- `contracted_at` precedes `materialized_at`, or a verified artifact carries noncanonical/negative counts
- a verified root/nested shape has unknown own keys, broadened authorization/effect markers, a noncanonical identity, or a Proxy/accessor/symbol/unsafe-key path
- a snapshotted array is sparse or declares a length above the M5a maximum of 100,000; refusal is typed and does not read accessor-backed indices

Pre-capstone canonical-ID hardening keeps the contract schema at v1. Repository evidence confirms there is no committed concrete M5a step-1 contract instance to migrate: the committed materialization fixture is input only, while contract references occur in source, tests, and runbook prose. Legacy `m5a-flow-contract:${proposal_set_id}:${flow_id}` and arbitrary safe-shaped forms are refused by the runtime verifier.

Non-goals:

- Step 1 performs no packet drafting. The M5a Step 2 module now owns that separate artifact.
- Step 1 performs no arming. M5a step 3 now provides an operator arming surface for one recorded-proposal flow execution; Path 1 still means M5a has no runtime-provider-call arming surface. Any future slice wiring a fresh call onto the M5a flow path must flip `forbids_fresh_provider_call_on_flow_path` and open a new approval surface.
- No flow execution. The contract names the stages and their typed shape; Step 3 now produces a separate arming artifact over the verified drafted packet, while Step 4 remains the execution slice.
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
- the exported runtime verifier accepts builder output but refuses broadened roots, boundaries, stages, success criteria, approval shapes, noncanonical identity/count/chronology, unknown authorization keys, and nested Proxy/accessor paths before traps fire
- different accounts produce distinct canonical contract IDs; longest valid identity inputs remain within `SAFE_ID`; forged and legacy forms refuse
- the builder refuses each of the enumerated reject paths, including (critically) any materialization input whose `context.origin` is not the pinned `hand-curated-public` value
- the success criterion's structural fields (`curated_provenance_must_be_surfaced_per_card`, `forbids_verified_per_record_provenance_in_render`, `forbids_fresh_provider_call_on_any_stage`, `forbids_system_side_acquisition_on_any_stage`) all literally true — locks the typed-property-not-prose discipline
- the boundary markers `forbids_fresh_provider_call_on_flow_path: true` and `fresh_provider_call_on_flow_path_executed: false` are present — locks Path 1 structural enforcement
- the contract module imports no provider SDK, performs no I/O, reads no `process.env`, has no network imports
- this runbook records the load-bearing claims in greppable form: curation origin pin, Path 1 rationale, structural-property-of-success-criterion claim, Path-1-marker claim, stage list with ordering, and the trust-tier-discipline-preserved claim
- the runbook index lists this runbook exactly once and frames it as the M5a step 1 contract-only slice
- the safety contract test asserts the existing M3-step-3a-consumed materialization input fixture passes the M5a contract builder unchanged (the committed input is a curated proposal flow source by construction, and the contract slice does not modify it)
- the hostile-input regression suite (probes 1–11; M5a step 1 hardening pass 2026-06-17) proves the builder fails closed on every hostile-input class: accessor-backed `context` and nested `origin` (Probes 1–2; getters do NOT fire), Proxy-backed root (Probe 3; get trap does NOT fire), impossible-component timestamps via regex-clean strings like `"2026-99-99T99:99:99Z"` and February 30 (Probe 4; parse + canonical round-trip refuses), symbol-keyed root and context (Probe 5), accessor-backed array index on `public_sources[0]` (Probe 6; getter does NOT fire), non-array `proposed_account_objects` like a string (Probe 7), TOCTOU validate-then-reread on `account_id` (Probe 8; getter is never read at all), accessor-backed `options.flowId` and Proxy-backed options (Probes 9–10), and unsafe-key `constructor` own property (Probe 11)
- sparse and oversized-array regressions prove `M5aContractBuilderRefusal` occurs without reading hostile indices/getters, and the finite length cap is checked before any output allocation proportional to declared length
- the approval_packet_shape's POSITIVE trust-tier pins (`required_row_trust_label` and `required_per_record_provenance_status`) are present alongside the negative prohibition (`forbidden_per_record_provenance_statuses: ["verified"]`), locking the structural-not-prose-and-constants discipline

## M5a step 1 hardening pass (2026-06-17)

The first head of this PR (commit `15ade98`) shipped with green CI on the happy-path suite but with the builder reading the materialization input via direct `typeof`/`Array.isArray` checks and then casting + re-reading scalar fields during artifact construction. Independent review reproduced empirically: accessor getters on `context` and nested `origin` fired and leaked their thrown errors; a Proxy-backed root passed validation while its get traps fired; impossible-component ISO timestamps like `"2026-99-99T99:99:99Z"` passed regex shape and reached the rendered artifact; symbol and unsafe keys were accepted; accessor-backed array indices passed; a string `proposed_account_objects` flowed through and made `proposed_account_object_count` a non-number at runtime; and the validate-then-reread shape (TOCTOU) allowed hostile getters to return safe values during validation and unsafe values during render, landing unsafe values in `contract_artifact_id`, `proposal_set_id`, `account_id`, `materialized_at`, `flow_id`, and `contracted_at`.

The hardening pass implements **snapshot-once-render-from-locals**:

- A typed `M5aContractBuilderRefusal extends Error` class is exported (so regressions can assert by type).
- Local `snapshotPlainOwnData(value, label)` and `snapshotPlainArray(value, label)` helpers descriptor-snapshot every input at entry. `util.types.isProxy` runs FIRST, before any reflection. Accessor descriptors, non-enumerable own-data, symbol keys, and unsafe keys (`__proto__`/`constructor`/`prototype`) all refuse with typed errors. Array snapshots read length via descriptor (not `value.length` direct), enforce the M5a-specific 100,000-element maximum before allocating from the declared length, refuse symbol-keyed arrays, and walk every index refusing accessor-backed or missing indices.
- A local `isCanonicalIsoTimestamp(s)` function replaces the regex-only check: regex pre-filter, then `Date.parse` finite-check, then canonical round-trip comparison. The reviewer-reproduced impossible date `"2026-99-99T99:99:99Z"` AND `"2026-02-30T00:00:00Z"` (regex-clean Feb 30) refuse correctly.
- The builder snapshots the options object and the root materialization input + context + required arrays + optional `proposed_account_objects` ONCE at entry, copies validated scalars into frozen locals (`flowId`, `now`, `accountId`, `proposalSetId`, `materializedAt`, plus the four snapshotted array references), and renders the artifact EXCLUSIVELY from those locals. No `snap.*` or `options.*` read survives past the validation block. A hostile getter that switched between validation and render passes cannot smuggle anything; in practice the snapshot discipline refuses the getter outright.
- The approval_packet_shape gains POSITIVE trust-tier pins (`required_row_trust_label: "model-proposed-human-ratified-evidence-pending"`, `required_per_record_provenance_status: "source_document_only"`) alongside the existing negative prohibition. The reviewer's distinction is load-bearing: encoding only the prohibition leaves the positive pin a promise rather than a constraint.

## Standing rule — hostile-probe-suite-as-done-criterion (2026-06-17)

This is the third instance of confident-output / unhardened-input shipping under green CI in this project: M3 step 3a's `provenance_status: "verified"` bug, the H3 plan PR's false JS-semantics rationale, and now this. The mechanism is the same in all three: tests assert the happy path; the boundary only exists where tests assert the negative; reviewer hand-probing catches what the suite misses. Promoted to a standing rule for every contract slice over upstream artifacts from M5a step 1 forward through M4 and beyond:

> **A contract slice over an upstream artifact is not done when the happy-path suite is green. It is done when the hostile-probe suite is green, and the hostile-probe suite must be written by someone treating the input as adversarial.**

The hostile-probe suite is the actual deliverable of every such slice. The probe shapes proven necessary so far are: getter on root / nested field / array index, Proxy on root / nested object / array, symbol-keyed input, unsafe-key (`__proto__`/`constructor`/`prototype`) own property, accessor-backed array index, missing array index, non-enumerable array index, regex-clean-but-impossible timestamps, non-array values where an array is expected, and TOCTOU validate-then-reread on every scalar the artifact carries. The pattern transfers; the deliverable is the proof it holds on the actual code, written adversarially against this specific builder.

This rule is most cheaply learned now, on a recorded-proposal slice where the adversary is hypothetical. M4 introduces an adversary that is real (fetched content is definitionally adversarial); if step-1 contract discipline can't fail-closed on a hostile getter, it has no chance against a hostile fetched page. Better to fix the muscle here.

## H3 retro input — fourth call site needed snapshot discipline (2026-06-17)

The M5a step 1 hardening pass hand-rolled the snapshot helpers because none of the three shipped helpers (`snapshotPlainRecord` in the executor, `snapshotPlainRecord` + `deepFreeze` in the reader, `snapshotPlainOwnData` + `snapshotPlainArray` in the render-side composer) is exported. Exporting from any of the three would have tied the M5a contract to a runtime module (the executor is hardly a safety primitive); pre-implementing H3 was out of scope per the H3 plan PR being deferred until H3 implementation reaches the front of the queue. So the fourth call site for the discipline hand-rolled correctly using a shape that matches the H3 plan's expected primitive surface — the eventual H3 migration is a clean find-replace.

**This is recorded as an H3 retro input.** The H3 plan PR (#277, merged at `a879c11`) noted the three confirmed call sites as the threshold to argue consolidation on evidence rather than prediction. The M5a step 1 hardening pass made it four. The cost of every call site hand-rolling this pattern is no longer hypothetical; it is the difference between this PR's two heads. The H3 ratification, when it eventually happens, should treat the M5a step 1 hand-roll as the fourth call site of the migration surface AND as direct evidence for whichever Q-branches favor stronger consolidation defaults (notably Q4 Branch A — broaden the executor's symbol-keyed-array refusal — since the M5a hand-roll already adopts the broader check, and the H3 consolidation would normalize that decision).

What this slice gates:

- **M5a Step 2 exists.** The curated proposal-flow approval-packet module consumes this contract and produces a disposable, drafted-and-unarmed packet conforming to `approval_packet_shape`. Step 2 inherits the Path-1 and trust-tier markers; it cannot quietly relax them.
- **M5a Step 3 exists.** The operator-arming module consumes the verified contract plus drafted packet and produces a separate, pure armed-state artifact with no execution effect.
- **M5a Step 4 is next.** It must consume and re-verify the contract, drafted packet, and armed-state artifact; enforce execution-time expiry and one-shot consumption; then reuse the hardened M3 durable-write, read-back, and render surfaces. M5a's success criterion evaluates only the resulting durable read-back and rendered Workshop artifact.
- **The Path-1 disposition (operator 2026-06-17) is recorded as load-bearing for M5a.** A future slice that wished to introduce a fresh provider call on the M5a flow path would have to (a) flip the contract's `forbids_fresh_provider_call_on_flow_path` marker, (b) open a new approval surface analogous to M3 step 3a's operator arming, and (c) revisit the M3 retro §4 sequencing call. The recorded rationale stays as the burden any such change has to discharge.
- **M4 (system-side acquisition) and M5b (does-its-job-once on system-acquired sources) remain downstream of M5a.** The identity question of whether acquisition is the product's job or a feature input gets its real answer when M5a's curated-source result is in hand. This contract does not preempt that decision.
