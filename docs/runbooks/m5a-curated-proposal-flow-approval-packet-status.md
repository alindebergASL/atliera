# M5a Curated Proposal Flow Approval Packet Status

Status: active

This runbook records the M5a step 2 artifact — a drafted-and-unarmed approval packet over the M5a step 1 contract. Step 3 consumes the verified packet and produces a separate armed artifact; the fixture-bound Step 4 capstone now consumes and re-verifies all three artifacts while independently pinning the exact committed proposal digest. Step 2 itself remains no-call and drafted-and-unarmed by default.

Per the M5a step 1 standing rule (hostile-probe-suite-as-done-criterion) the actual deliverable of this slice is the hostile-probe regression suite. The suite covers a different threat shape than step 1's (operator GO 2026-06-17): step 1 consumed an upstream materialization artifact and its adversary was input-smuggling; step 2 produces an approval packet and its primary adversary is **approval-state counterfeit** — a packet that claims to conform to the contract's published `approval_packet_shape` but doesn't. The probe suite is built against THAT threat, not re-aimed at input-smuggling.

Operator scope ratifications recorded in the module header (2026-06-17):

- **Threat shape: approval-state counterfeit.** The hostile-probe suite covers packets that arrive with falsified positive trust-tier pins (or missing them entirely), Path-1 markers present-but-falsified, already-armed lifecycle when the contract says drafted-and-unarmed-by-default, mismatched contract_artifact_id / proposal_set_id / account_id, attempts to authorize a fresh provider call, and inverted constraints (`max_flow_executions > 1`, `retry_budget > 0`, `expiry_required: false`, `operator_arming_required_for_flow_execution: false`).
- **Positive trust-tier pins as load-bearing inheritance.** The packet carries `trust_tier_pins.required_row_trust_label: "model-proposed-human-ratified-evidence-pending"` AND `required_per_record_provenance_status: "source_document_only"` as REQUIRED positive values, alongside the existing negative prohibition `forbidden_per_record_provenance_statuses: ["verified"]`. The blocker-7 lesson from step 1 arrives at the layer it was actually about: "Not verified" is not "is pending"; the gap between them is exactly where a future step would land a record in some third unlabeled state, and step 2 is where that hole would open if it opened anywhere. The verifier refuses a packet forbidding `verified` but failing to positively carry the pending label.
- **Drafted-and-unarmed by default, arming is its own slice (not in step 2).** The packet is INERT by construction at draft lifecycle; the shipped Step 3 builder creates a separate armed artifact from it. The verifier refuses any packet arriving as `lifecycle: armed` (or `consumed` / `expired` / `revoked`), or with `armed: true` / `consumed: true` / `executed: true` at draft lifecycle, or with `drafted_and_unarmed_by_default: false`.
- **Contract-reference integrity is bound and verified.** The packet's `references_contract_artifact_id`, `proposal_set_id`, and `account_id` MUST equal the contract's identity triple. M3 step 3a's "arming for contract A can't authorize a write of candidate B" lesson, pulled up to the packet-drafting layer. Without this, "over the contract" would be a claim rather than a binding.
- **M5a-specific Path-1 sharpening on the authorization clause.** What the eventual arming will license is the durable WRITE of a recorded proposal + the RENDER of the resulting durable state through the M3-shipped ratification surface — NOT a fresh provider call, NOT system-side acquisition. The packet's `eventual_authorization.authorization_scope` is pinned to the constant `"durable-write-of-recorded-proposal-and-render"`; the verifier refuses any other value. A counterfeit packet that tried to authorize a fresh call (`authorizes_provider_call: true`, or `authorization_scope: "fresh-model-call"`) is refused.

Snapshot-helper provenance (operator decision 2026-06-17):

The packet builder + verifier **imports the snapshot helpers from step 1** (`snapshotPlainOwnData`, bounded `snapshotPlainArray`, `requireSafeId`, `requireCanonicalIsoTimestamp`, plus the typed `M5aContractBuilderRefusal` for translation). This is not a mechanical export-only change: the shared Step 1 surface now includes the runtime contract verifier, exact-key closure, the M5a array-length cap, canonical chronology, and canonical contract-ID enforcement. Step 2 adds its own strict root/nested-key checks, chronology check, and canonical packet-ID verifier, translating shared refusals to `M5aApprovalPacketRefusal`.

This is recorded as an **H3 retro input**. The H3 plan PR #277 named three call sites as the threshold to argue consolidation on evidence; the M5a step 1 hardening pass made it four. Step 2 made it **not** five (a fifth hand-roll was the failure mode the operator wanted avoided); it made it one consolidated site at the M5a layer. The cost of every site hand-rolling is now empirical AND the partial-consolidation cost is now empirical AND the partial-consolidation is local and trivial when sites share a namespace. The H3 ratification, when it eventually happens, should treat the M5a layer as **one** migration site (executor + reader + render-composer + M5a-layer = four sites, not five), and treat the M5a-step-1-to-step-2 export-and-import as evidence informing Q4 specifically (the M5a layer already adopts the strictest broaden-the-checks discipline locally).

Doctrine alignment (ADR 0003; M3 step 3a retro; M3 retro; M5a step 1 hardening):

- M5a step 2 defines the packet consumed by the shipped fixture-bound Step 4 capstone, which reuses the M3 durable store/reader/render surfaces; step 2 itself introduces no mediation gate or acquisition risk class. Its `flow_constraints.mediation_gate_level: L0` is a prospective policy pin only, not an effect stamp. An L0 stamp belongs only on a committed Step 4 effect. The packet is marker-closed against fresh provider call and system-side acquisition.
- The trust-tier discipline (M3 step 3a retro §1) is preserved structurally AND positively: the packet carries the row trust label and per-record provenance status as positive pins, mirroring the M5a step 1 hardening pass.
- Snapshot-once-render-from-locals (M3 step 3a retro §3; M5a step 1 §hardening pass) propagates through the imported helpers — a Proxy-backed or accessor-backed packet input is refused before any getter fires.

Artifacts:

- Implementation: `src/workshop/m5a-curated-proposal-flow-approval-packet.ts` (builder + verifier + typed refusal class + typed artifact interfaces)
- Safety contract test: `tests/safety/m5a-curated-proposal-flow-approval-packet.test.ts` (counterfeit-aimed hostile-probe suite)
- INDEX: `docs/runbooks/INDEX.md`
- Step 1 contract this packet is over: `src/workshop/m5a-curated-proposal-flow-contract.ts` (runtime-verifier, strict-key, bounded-array, chronology, and canonical-ID hardened in PR #280)

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
- `canonicalM5aCuratedProposalFlowApprovalPacketArtifactId(referencesContractArtifactId, proposalSetId, accountId, draftedBy, draftedAt, expiresAt)` derives `m5a-pkt:<40-hex-digest>` from an ordered JSON tuple and a 160-bit SHA-256 prefix. Both builder and verifier invoke it independently from validated locals.
- `M5aApprovalPacketRefusal extends Error` is the typed refusal the builder + verifier throw; the regressions assert against it by type.
- `M5A_APPROVAL_PACKET_KIND`, `M5A_APPROVAL_PACKET_SCHEMA_VERSION`, and `M5A_EVENTUAL_AUTHORIZATION_SCOPE` constants are exported for downstream consumers.
- The verifier's typed `asserts packet is M5aCuratedProposalFlowApprovalPacketArtifact` signature lets callers narrow the input on success; Step 3 consumes that verified shape.

`packet_artifact_id` canonical form (two claims, both structurally enforced):

**Claim A — builder generates canonical.** The builder calls the exported helper with its validated `references_contract_artifact_id`, `proposal_set_id`, `account_id`, `drafted_by`, `drafted_at`, and `expires_at` locals. The result is exactly `m5a-pkt:<40-hex-digest>`. Account and expiry are explicit identity dimensions: different flow-bound contracts, accounts, or approved expiry windows produce distinct packet IDs, and even the longest valid input fields remain comfortably inside `SAFE_ID`.

**Claim B — verifier requires canonical.** The verifier separately calls the same helper from its own snapshot-backed validated contract/proposal/account/drafter/drafted-at/expires-at locals and refuses mismatch. It never re-reads `p.*` at the comparison site. Legacy shortened, legacy verbatim-contract, arbitrary safe-shaped, digest-from-a-different-contract, and expiry-extended-without-rebinding forms all refuse. Builder construction and verifier enforcement remain separate claims with separate regressions.

This pre-capstone canonical-ID hardening keeps the packet schema at v1 because repository evidence confirms there is no committed concrete M5a step-2 packet instance to migrate. Packet occurrences in the committed tree are source, tests, and runbook prose; there is no M5a contract/packet artifact fixture. The step-1 schema likewise remains v1 on the same evidence.

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
- packet.packet_artifact_id does not match the helper-derived canonical digest over references_contract_artifact_id / proposal_set_id / account_id / drafted_by / drafted_at / expires_at
- eventual_authorization: authorization_scope not the pinned constant; authorizes_durable_write_of_recorded_proposal or authorizes_render_of_durable_state not true; authorizes_provider_call / authorizes_system_side_acquisition / authorizes_private_evidence_read not false; recorded_proposal_source_origin not the curated origin
- trust_tier_pins: required_row_trust_label not the pending pinned value; required_per_record_provenance_status not the source_document_only pinned value; forbidden_per_record_provenance_statuses not exactly ["verified"]
- flow_constraints: drafted_and_unarmed_by_default not true; max_flow_executions not 1; retry_budget not 0; retry_requires_new_approval not true; expiry_required not true; operator_arming_required_for_flow_execution not true; mediation_gate_level not L0; target_store not local-durable-db; forbids_fresh_provider_call_on_flow_path not true; forbids_system_side_acquisition not true

Non-goals (out of scope for step 2):

- No arming in Step 2. The packet is drafted-and-unarmed by construction; Step 3 now produces the separate armed artifact under explicit operator input.
- No flow execution. The eventual M5a execution slice consumes the separate armed-state artifact plus the still-drafted packet and step-1 contract, and runs the five flow stages (`materialize` → `validate` → `ratify` → `durable_write` → `render`) by reusing M3-shipped surfaces.
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
- C1-C26 plus current build-side/canonical-ID/strict-shape regressions cover positive-pin loss or falsification, Path-1 and lifecycle broadening, contract/proposal/account mismatches, max-flow/retry/expiry/arming constraint inversion, Proxy/accessor/symbol/unsafe/unknown-key inputs, malformed chronology, broadened Step-1 contracts, packet drafting before the contract, and expiry extension without canonical-ID rebinding
- two build-side counterfeit probes: a contract whose approval_packet_shape carries a falsified positive pin is refused at build time; a contract whose approval_packet_shape lacks the Path-1 inheritance marker is refused at build time
- the module imports the snapshot helpers from step 1 (not hand-rolled): `snapshotPlainOwnData`, `snapshotPlainArray`, `requireSafeId`, `requireCanonicalIsoTimestamp`, `M5aContractBuilderRefusal`. The test asserts no `function snapshotPlainOwnData` / `function snapshotPlainArray` definition exists in step 2's module source (the hand-roll guard)
- step 1's module exports the shared hardened helpers used by step 2
- the module is pure: no provider SDK, no network, no I/O, no env reads
- this runbook records the threat-shape difference (approval-state counterfeit vs input-smuggling), the positive-trust-tier-pin discipline, the drafted-and-unarmed-with-arming-separately-shaped framing, the contract-reference integrity check, the M5a-Path-1 authorization sharpening, and the import-from-step-1 / H3-retro-input snapshot-helper provenance
- the INDEX classifies this runbook once and frames it as the M5a step 2 drafted-and-unarmed packet slice

What this slice gates:

- **M5a Step 3 exists.** It consumes the drafted packet, explicit operator input, and the step-1 contract, and produces a separately verified armed artifact carrying Path-1 and positive trust-tier pins.
- **M5a Step 4 now exists as a fixture-bound flow-execution capstone.** It consumes the armed artifact plus packet and contract, re-verifies all three, independently pins the exact committed proposal digest, enforces expiry at execution time, and atomically consumes Step 3's stable one-shot key in the same local durable transaction as the effect. It refuses replay after consumption. A committed effect stamps `mediation_gate_level: L0`; a post-commit render failure remains an explicitly attributed `committed_unrendered` L0 effect rather than a refusal.
- **The H3 retro input is now richer, and the nuance is the load-bearing part — do not flatten back to a site count.** Step 2 imported the snapshot helpers from step 1 rather than hand-rolling a fifth site, so the M5a layer is one consolidated site of the discipline. But the substantive observation for H3 is not "four sites, not five"; it is that **the M5a layer locally consolidated to one site, which is evidence that namespace-local consolidation is easy when modules share a layer**. The corollary the H3 ratification should treat as load-bearing: **the H3 consolidation's difficulty is cross-layer, not per-site.** Three sites in `src/workshop/` (executor, reader, render-composer) hand-rolled independently not because the pattern is hard but because they don't share a finer namespace; M5a's step-1-to-step-2 consolidation was trivial precisely because they do. The H3 migration's hard work is not finding the pattern (it's known) and not implementing it once (it's been done four times); it is reconciling the *cross-layer* divergences across workshop call sites that have no shared namespace to motivate convergence. Q4 specifically is informed by this: the M5a layer already adopts the strictest broaden-the-checks discipline locally, which is direct evidence Branch A (broaden) is the consolidation-direction that holds when namespace-local discipline is allowed to drift toward the union.

- **Step 1's helpers are now load-bearing across three M5a artifact layers.** The Step-1 contract builder/verifier defines them, and both the Step-2 packet and Step-3 arming modules consume them. The eventual H3 migration's equivalence-proof requirement must preserve all three layers. H3 cannot weaken the shared helpers without affecting downstream packet and arming verification. This is evidence, not a blocker: shared helpers across a namespace are a tighter contract than independent hand-rolls precisely because they have multiple consumers.
- **The hostile-probe-suite-as-done-criterion standing rule** (M5a step 1) is reinforced here: step 2 is the second slice under the rule, and the threat-shape adaptation (counterfeit vs input-smuggling) shows the rule is not mechanical — each slice's probes must be aimed at its actual threat. The rule transfers; the probes don't.
