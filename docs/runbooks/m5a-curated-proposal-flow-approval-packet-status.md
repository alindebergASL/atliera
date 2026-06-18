# M5a Curated Proposal Flow Approval Packet Status

Status: active

This runbook records the M5a step 2 artifact — a drafted-and-unarmed approval packet over the M5a step 1 contract. The packet is the typed authorization that a separate future arming slice (the M5a analog of M3 step 3a) will transition from `drafted` to `armed` and that the M5a flow execution slice (the analog of M3 step 3a's executor) will eventually consume. The slice mirrors M3 step 2's no-call, drafted-and-unarmed-by-default discipline.

Per the M5a step 1 standing rule (hostile-probe-suite-as-done-criterion) the actual deliverable of this slice is the hostile-probe regression suite. The suite covers a different threat shape than step 1's (operator GO 2026-06-17): step 1 consumed an upstream materialization artifact and its adversary was input-smuggling; step 2 produces an approval packet and its primary adversary is **approval-state counterfeit** — a packet that claims to conform to the contract's published `approval_packet_shape` but doesn't. The probe suite is built against THAT threat, not re-aimed at input-smuggling.

Operator scope ratifications recorded in the module header (2026-06-17):

- **Threat shape: approval-state counterfeit.** The hostile-probe suite covers packets that arrive with falsified positive trust-tier pins (or missing them entirely), Path-1 markers present-but-falsified, already-armed lifecycle when the contract says drafted-and-unarmed-by-default, mismatched contract_artifact_id / proposal_set_id / account_id, attempts to authorize a fresh provider call, and inverted constraints (`max_flow_executions > 1`, `retry_budget > 0`, `expiry_required: false`, `operator_arming_required_for_flow_execution: false`).
- **Positive trust-tier pins as load-bearing inheritance.** The packet carries `trust_tier_pins.required_row_trust_label: "model-proposed-human-ratified-evidence-pending"` AND `required_per_record_provenance_status: "source_document_only"` as REQUIRED positive values, alongside the existing negative prohibition `forbidden_per_record_provenance_statuses: ["verified"]`. The blocker-7 lesson from step 1 arrives at the layer it was actually about: "Not verified" is not "is pending"; the gap between them is exactly where a future step would land a record in some third unlabeled state, and step 2 is where that hole would open if it opened anywhere. The verifier refuses a packet forbidding `verified` but failing to positively carry the pending label.
- **Drafted-and-unarmed by default, arming is its own slice (not in step 2).** The packet is INERT by construction at draft lifecycle; only a separate arming slice transitions it. The verifier refuses any packet arriving as `lifecycle: armed` (or `consumed` / `expired` / `revoked`), or with `armed: true` / `consumed: true` / `executed: true` at draft lifecycle, or with `drafted_and_unarmed_by_default: false`. The temptation at this layer is to "just sketch" the arming surface since it's the obvious next thing; the runbook records that explicitly as out of scope.
- **Contract-reference integrity is bound and verified.** The packet's `references_contract_artifact_id`, `proposal_set_id`, and `account_id` MUST equal the contract's identity triple. M3 step 3a's "arming for contract A can't authorize a write of candidate B" lesson, pulled up to the packet-drafting layer. Without this, "over the contract" would be a claim rather than a binding.
- **M5a-specific Path-1 sharpening on the authorization clause.** What the eventual arming will license is the durable WRITE of a recorded proposal + the RENDER of the resulting durable state through the M3-shipped ratification surface — NOT a fresh provider call, NOT system-side acquisition. The packet's `eventual_authorization.authorization_scope` is pinned to the constant `"durable-write-of-recorded-proposal-and-render"`; the verifier refuses any other value. A counterfeit packet that tried to authorize a fresh call (`authorizes_provider_call: true`, or `authorization_scope: "fresh-model-call"`) is refused.

Snapshot-helper provenance (operator decision 2026-06-17):

The packet builder + verifier **imports the snapshot helpers from step 1** (`snapshotPlainOwnData`, `requireSafeId`, `requireCanonicalIsoTimestamp`, plus the typed `M5aContractBuilderRefusal` for translation). Step 1 was modified by this PR with a mechanical three-line change: `export` keywords added to the helpers (no behavior change at step 1; the existing step-1 safety contract test continues to pass, locking that property). Step 2 catches `M5aContractBuilderRefusal` from the imported helpers and translates to its own `M5aApprovalPacketRefusal` — the per-site refusal-class translation the H3 plan Q10 ratification anticipates.

This is recorded as an **H3 retro input**. The H3 plan PR #277 named three call sites as the threshold to argue consolidation on evidence; the M5a step 1 hardening pass made it four. Step 2 made it **not** five (a fifth hand-roll was the failure mode the operator wanted avoided); it made it one consolidated site at the M5a layer. The cost of every site hand-rolling is now empirical AND the partial-consolidation cost is now empirical AND the partial-consolidation is local and trivial when sites share a namespace. The H3 ratification, when it eventually happens, should treat the M5a layer as **one** migration site (executor + reader + render-composer + M5a-layer = four sites, not five), and treat the M5a-step-1-to-step-2 export-and-import as evidence informing Q4 specifically (the M5a layer already adopts the strictest broaden-the-checks discipline locally).

Doctrine alignment (ADR 0003; M3 step 3a retro; M3 retro; M5a step 1 hardening):

- M5a step 2 reuses the M3-shipped surfaces (the eventual M5a execution slice will use the M3 step 3a executor + M3 step 3b reader and render-composer); introduces no new mediation gate; adds no new acquisition risk class. The packet is marker-closed against fresh provider call and system-side acquisition.
- The trust-tier discipline (M3 step 3a retro §1) is preserved structurally AND positively: the packet carries the row trust label and per-record provenance status as positive pins, mirroring the M5a step 1 hardening pass.
- Snapshot-once-render-from-locals (M3 step 3a retro §3; M5a step 1 §hardening pass) propagates through the imported helpers — a Proxy-backed or accessor-backed packet input is refused before any getter fires.

Artifacts:

- Implementation: `src/workshop/m5a-curated-proposal-flow-approval-packet.ts` (builder + verifier + typed refusal class + typed artifact interfaces)
- Safety contract test: `tests/safety/m5a-curated-proposal-flow-approval-packet.test.ts` (counterfeit-aimed hostile-probe suite)
- INDEX: `docs/runbooks/INDEX.md`
- Step 1 contract this packet is over: `src/workshop/m5a-curated-proposal-flow-contract.ts` (PR #278, merged at `6205c4a`; this PR adds `export` keywords to its snapshot helpers as a mechanical enabling change)

Boundary markers (the drafted packet authorizes nothing):

- current_effective_authorization: none
- lifecycle: drafted
- armed: false
- consumed: false
- executed: false
- authorizes_provider_call: false (on `eventual_authorization`)
- authorizes_system_side_acquisition: false (on `eventual_authorization`)
- authorizes_private_evidence_read: false (on `eventual_authorization`)
- provider_calls_made: 0
- private_evidence_read: false
- graph_ingestion_performed: false
- durable_writes_performed: false
- production_writes: false
- readiness_claim: false
- forbids_fresh_provider_call_on_flow_path: true (on `flow_constraints`)
- forbids_system_side_acquisition: true (on `flow_constraints`)

What exists:

- `buildM5aCuratedProposalFlowApprovalPacket(contract, { now, expiresAt, draftedBy })` consumes a step-1 contract artifact and a small options object, snapshots both, validates the contract's `approval_packet_shape` against its published pins (positive trust-tier pins, Path-1 markers, flow constraints, mediation gate, target store, contract-reference triple), constructs the packet from validated locals only, and at the end calls the verifier on the constructed packet as a build-time guarantee that the build path always produces a verifier-passing packet.
- `verifyM5aCuratedProposalFlowApprovalPacket(packet, contract)` consumes an arbitrary unknown packet AND the step-1 contract it claims to be over. Refuses any packet that is not a structurally conformant drafted-and-unarmed M5a packet binding to the given contract. This is the function the hostile-probe regression suite is built against.
- `M5aApprovalPacketRefusal extends Error` is the typed refusal the builder + verifier throw; the regressions assert against it by type.
- `M5A_APPROVAL_PACKET_KIND`, `M5A_APPROVAL_PACKET_SCHEMA_VERSION`, and `M5A_EVENTUAL_AUTHORIZATION_SCOPE` constants are exported for downstream consumers.
- The verifier's typed `asserts packet is M5aCuratedProposalFlowApprovalPacketArtifact` signature lets callers narrow the input on success — the eventual arming slice will consume the verified packet under this narrowed type.

`packet_artifact_id` canonical form (two claims, both structurally enforced):

**Claim A — builder generates canonical.** `buildM5aCuratedProposalFlowApprovalPacket` produces a packet whose `packet_artifact_id` is exactly `m5a-pkt:${contractArtifactId}:${draftedBy}:${now}`. The first draft of step 2 shortened this to `m5a-pkt:${proposalSetId}:${draftedBy}:${now}` to fit `SAFE_ID`'s 121-char cap, **which silently dropped `flow_id` — load-bearing for uniqueness.** Step 1 generates a unique `contract_artifact_id` per `(proposal_set_id, flow_id)` pair, so two contracts can exist over the same proposal_set_id but different flow_ids; under the shortened form, packets drafted over those two contracts with the same drafter and `now` would have shared a `packet_artifact_id` while their `references_contract_artifact_id` correctly differed. A downstream slice treating `packet_artifact_id` as a key (idempotency, lookup) would have conflated them. The fix encodes the full `contractArtifactId` (~111 chars on the committed fixture, under the 121-char cap). Three builder-side regressions lock: (a) two contracts with the same proposal_set_id but different flow_ids produce distinct packet_artifact_ids; (b) the packet_artifact_id encodes the contract_artifact_id verbatim; (c) the ID stays within the SAFE_ID cap. This is the "tighten a thing to make CI pass, accidentally loosen a safety property" pattern, caught pre-merge by the operator's identifier-shortening review.

**Claim B — verifier requires canonical.** The builder establishing the canonical form by construction is necessary but **not sufficient**: the verifier's job is to narrow packets the builder did NOT make (deserialized inputs, forged artifacts, hand-constructed test inputs from downstream slices). A verifier that checks "the ID is safe-shaped" but not "the ID is the canonical form for this packet's own fields" confirms the ID is well-formed without confirming it is correct. The Hermes tree-side probe on the live verifier head `26a51bf` caught this: three forgeries (legacy shortened ID, arbitrary safe ID, and the load-bearing case of an ID embedding a different contract reference while the triple stays correct) all passed verification despite the builder having been fixed. The fix in `verifyM5aCuratedProposalFlowApprovalPacket` re-derives the canonical form from its own validated locals — `expectedPacketArtifactId = m5a-pkt:${referencesContractId}:${draftedBy}:${draftedAt}` — and refuses on mismatch. The re-derivation uses the verifier's snapshot-backed validated locals, **not** fresh reads of `p.*` at the comparison site (that would be the validate-then-reread TOCTOU shape M5a step 1's blocker 3 already closed, recurring at this layer). Three verifier-side regressions hand-construct forged packets (NOT derived from the builder) and feed them to the verifier; a fourth asserts the implementation uses validated locals by source inspection; a fifth asserts the legitimate built packet still verifies (no regression on the honest path).

**Build-side / verify-side asymmetry — doctrine note.** This is the second time on this PR (positive trust-tier pins were carried by the builder and had to be separately enforced by the verifier; canonical packet ID same) that a property established by construction in the builder was absent on the verify path. **For every property a builder establishes by construction, the verifier must independently re-establish it by checking — because the verifier's job is the packets the builder did not make.** "The builder produces X" and "the verifier requires X" are separate claims needing separate tests. A regression that only exercises built packets proves the first while appearing to prove the second; the tell is that the regression's input is a built packet, mutated. **Uniqueness / canonical-form regressions must include verifier-side probes on hand-constructed packets**, not only builder-output assertions. This is the standing rule's specialization for verifier-side properties, recorded here so the M5a arming and execution slices inherit it.

Refusal conditions (the verifier's reject paths, in checked order):

- packet is Proxy-backed (snapshot discipline at entry)
- packet is not a plain own-data object (accessor descriptors, symbol keys, unsafe keys all refuse via imported snapshot helper)
- packet.kind is not the M5a packet kind
- packet.schema_version is unexpected
- packet.disposable is not true
- packet.current_effective_authorization is not "none"
- packet.lifecycle is not "drafted" (already-armed / consumed / expired / revoked all refuse)
- packet.armed / consumed / executed are not false at draft lifecycle
- closed top-level doctrine markers (provider_calls_made, private_evidence_read, graph_ingestion_performed, durable_writes_performed, production_writes, readiness_claim) not closed
- packet.packet_artifact_id / references_contract_artifact_id / proposal_set_id / account_id not safe ids
- contract-reference integrity: references_contract_artifact_id / proposal_set_id / account_id do not match the contract's identity triple
- packet.drafted_at / expires_at not canonical ISO timestamps
- packet.expires_at not strictly after packet.drafted_at
- packet.drafted_by not a safe operator identity
- packet.packet_artifact_id does not match the canonical form `m5a-pkt:${references_contract_artifact_id}:${drafted_by}:${drafted_at}` (Hermes catch 2026-06-17; re-derived from validated locals)
- eventual_authorization: authorization_scope not the pinned constant; authorizes_durable_write_of_recorded_proposal or authorizes_render_of_durable_state not true; authorizes_provider_call / authorizes_system_side_acquisition / authorizes_private_evidence_read not false; recorded_proposal_source_origin not the curated origin
- trust_tier_pins: required_row_trust_label not the pending pinned value; required_per_record_provenance_status not the source_document_only pinned value; forbidden_per_record_provenance_statuses not exactly ["verified"]
- flow_constraints: drafted_and_unarmed_by_default not true; max_flow_executions not 1; retry_budget not 0; retry_requires_new_approval not true; expiry_required not true; operator_arming_required_for_flow_execution not true; mediation_gate_level not L0; target_store not local-durable-db; forbids_fresh_provider_call_on_flow_path not true; forbids_system_side_acquisition not true

Non-goals (out of scope for step 2):

- No arming. The packet is drafted-and-unarmed by construction. Arming is its own slice (the M5a analog of M3 step 3a's operator-arming module); when it lands, it will transition the packet from `drafted` to `armed` under explicit operator arming, and only then will `current_effective_authorization` flip away from `"none"`.
- No flow execution. The eventual M5a execution slice consumes an armed packet plus the step-1 contract, and runs the five flow stages (`materialize` → `validate` → `ratify` → `durable_write` → `render`) by reusing M3-shipped surfaces.
- No model/provider call. M5a's Path-1 ratification means M5a never makes a fresh provider call at any step; the packet is marker-closed against that path.
- No system-side acquisition. M4 territory.
- No private evidence read.
- No production write, no deployment, no readiness claim, no launch-readiness claim.
- No corpus expansion. The packet is over the one step-1 contract.
- No M2.5 SKILL.md packaging work.

Verification coverage:

`tests/safety/m5a-curated-proposal-flow-approval-packet.test.ts` proves:

- pinned constants are exported under their pinned values
- happy path: a legitimately-built packet over the M3-step-3a-shipped materialization input + step-1 contract carries every closed boundary marker, the drafted lifecycle, the positive trust-tier pins (plus the negative prohibition), the M5a-Path-1 eventual_authorization clause, and the drafted-and-unarmed flow_constraints
- contract-reference integrity binds the packet to the contract's identity triple
- the verifier accepts the legitimately-built packet (the build-time verify call is the load-bearing belt-and-suspenders that the build path always produces a verifier-passing packet)
- nineteen counterfeit-aimed hostile probes against the verifier (the actual deliverable of this slice): C1 missing positive row label; C2 falsified row label to a non-pending value; C3 falsified per-record pin to "verified"; C4 missing the negative prohibition; C5 authorizes_provider_call: true (Path-1 violation); C6 lifecycle: armed; C7 armed=true at drafted lifecycle; C8 mismatched contract_artifact_id; C9 mismatched account_id; C10 max_flow_executions > 1; C11 retry_budget > 0; C12 expiry_required: false; C13 operator_arming_required_for_flow_execution: false; C14 forbids_fresh_provider_call_on_flow_path falsified to false; C15 drafted_and_unarmed_by_default: false; C16 authorization_scope falsified; C17 Proxy-backed packet (snapshot discipline, get trap does NOT fire); C18 accessor-backed lifecycle (getter does NOT fire); C19 expires_at <= drafted_at
- two build-side counterfeit probes: a contract whose approval_packet_shape carries a falsified positive pin is refused at build time; a contract whose approval_packet_shape lacks the Path-1 inheritance marker is refused at build time
- the module imports the snapshot helpers from step 1 (not hand-rolled): `snapshotPlainOwnData`, `requireSafeId`, `requireCanonicalIsoTimestamp`, `M5aContractBuilderRefusal`. The test asserts no `function snapshotPlainOwnData` / `function snapshotPlainArray` definition exists in step 2's module source (the hand-roll guard)
- step 1's module exports the helpers (the only change to step 1 by this PR — a structural fact the test asserts in greppable form)
- the module is pure: no provider SDK, no network, no I/O, no env reads
- this runbook records the threat-shape difference (approval-state counterfeit vs input-smuggling), the positive-trust-tier-pin discipline, the drafted-and-unarmed-with-arming-separately-shaped framing, the contract-reference integrity check, the M5a-Path-1 authorization sharpening, and the import-from-step-1 / H3-retro-input snapshot-helper provenance
- the INDEX classifies this runbook once and frames it as the M5a step 2 drafted-and-unarmed packet slice

What this slice gates:

- **M5a's arming slice** (the M3 step 3a analog) is the next M5a artifact. It will consume the drafted packet, an explicit operator arming, and the step-1 contract, and produce an armed-state transition that authorizes exactly one flow execution under the packet's `flow_constraints`. The arming slice inherits Path-1 + positive trust-tier pins via the packet; it cannot quietly relax them.
- **M5a's flow execution slice** is the slice after arming. It consumes the armed packet plus the step-1 contract and runs the five flow stages through M3-shipped surfaces (executor, reader, render-composer). This is the slice whose visible artifact is the M5a capstone: the real-account-looking Workshop page rendered entirely from durable state, honestly labeled as curated, with no system-acquisition path exercised.
- **The H3 retro input is now richer, and the nuance is the load-bearing part — do not flatten back to a site count.** Step 2 imported the snapshot helpers from step 1 rather than hand-rolling a fifth site, so the M5a layer is one consolidated site of the discipline. But the substantive observation for H3 is not "four sites, not five"; it is that **the M5a layer locally consolidated to one site, which is evidence that namespace-local consolidation is easy when modules share a layer**. The corollary the H3 ratification should treat as load-bearing: **the H3 consolidation's difficulty is cross-layer, not per-site.** Three sites in `src/workshop/` (executor, reader, render-composer) hand-rolled independently not because the pattern is hard but because they don't share a finer namespace; M5a's step-1-to-step-2 consolidation was trivial precisely because they do. The H3 migration's hard work is not finding the pattern (it's known) and not implementing it once (it's been done four times); it is reconciling the *cross-layer* divergences across workshop call sites that have no shared namespace to motivate convergence. Q4 specifically is informed by this: the M5a layer already adopts the strictest broaden-the-checks discipline locally, which is direct evidence Branch A (broaden) is the consolidation-direction that holds when namespace-local discipline is allowed to drift toward the union.

- **Step 1's helpers are now load-bearing for two slices, not one.** The eventual H3 migration's equivalence-proof requirement (per H3 plan adjustment 1) now has two consumers to preserve, not one. The H3 implementation slice cannot weaken step 1's helpers without affecting step 2's verifier. This is recorded here as a note alongside the consolidation-is-cross-layer observation, not as a blocker — it is in fact part of the same evidence: shared helpers across a namespace are a tighter contract than independent hand-rolls precisely because they have multiple consumers.
- **The hostile-probe-suite-as-done-criterion standing rule** (M5a step 1) is reinforced here: step 2 is the second slice under the rule, and the threat-shape adaptation (counterfeit vs input-smuggling) shows the rule is not mechanical — each slice's probes must be aimed at its actual threat. The rule transfers; the probes don't.
