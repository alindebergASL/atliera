# M5a Curated Proposal Flow Operator Arming Status

Status: active

This runbook records the M5a step 3 artifact — the operator-arming slice over the M5a step 2 drafted-and-unarmed approval packet. It is the M5a analog of M3 step 3a's arming half: it consumes the step 1 contract, the verified step 2 packet, and an explicit operator arming input; it produces an armed-state artifact authorizing exactly one future curated proposal-flow execution.

The boundary is deliberately narrow: **arming is not execution**. This slice performs no flow execution, no durable write, no render, no provider call, no system-side acquisition, no private evidence read, no graph ingestion, no production write, and no readiness claim. It also stamps **no mediation_gate_level** on the arming artifact. L0 is a property of a real effect; only the eventual step 4 execution slice may stamp it when a durable write actually occurs.

Doctrine inheritance from M5a steps 1 and 2:

- **hostile-probe-suite-as-done-criterion.** The actual deliverable is the hostile-probe regression suite. The probe target is **arming-state counterfeit**, not step 1 input-smuggling and not step 2 packet-state counterfeit. The probes cover forged armings, replay/consumption shapes, packet/contract/arming mismatches, broadening attempts, timestamp chronology, no-L0-stamp enforcement, accessors/Proxy refusal, and TOCTOU source guards.
- **build-side / verify-side asymmetry.** Every property the builder establishes by construction is independently checked by the verifier. The canonical `arming_artifact_id` is the clearest case: the builder generates it, and the verifier re-derives it from validated locals and refuses mismatch. The verifier's job is the arming artifacts the builder did not make.
- **snapshot-once-render-from-locals.** The module imports the M5a snapshot helpers from step 1 (`snapshotPlainOwnData`, `requireSafeId`, `requireCanonicalIsoTimestamp`, and `M5aContractBuilderRefusal`) and does not hand-roll another helper. This reinforces the H3 retro input: the M5a layer remains one consolidated snapshot-discipline site with multiple consumers.
- **positive trust-tier pins propagate.** The arming artifact carries `required_row_trust_label: "model-proposed-human-ratified-evidence-pending"`, `required_per_record_provenance_status: "source_document_only"`, and `forbidden_per_record_provenance_statuses: ["verified"]`. The verifier requires the positive pins, not only the negative prohibition.
- **Path-1 stays closed.** The arming authorizes one future flow execution over a recorded proposal. It does not authorize a fresh provider call, system-side acquisition, private evidence read, or immediate durable write.

Artifacts:

- Implementation: `src/workshop/m5a-curated-proposal-flow-operator-arming.ts`
- Safety contract test: `tests/safety/m5a-curated-proposal-flow-operator-arming.test.ts`
- INDEX: `docs/runbooks/INDEX.md`
- Source packet runbook: `docs/runbooks/m5a-curated-proposal-flow-approval-packet-status.md`
- Source contract runbook: `docs/runbooks/m5a-curated-proposal-flow-contract-status.md`

Boundary markers:

- current_effective_authorization: single-future-curated-proposal-flow-execution
- lifecycle: armed
- packet_lifecycle_before_arming: drafted
- operator_armed: true
- arming_is_one_shot: true
- authorizes_future_flow_execution: true
- max_flow_executions_authorized: 1
- remaining_flow_executions: 1
- consumed_flow_executions: 0
- retry_budget: 0
- retry_requires_new_approval: true
- authorizes_provider_call: false
- authorizes_system_side_acquisition: false
- authorizes_private_evidence_read: false
- authorizes_fresh_provider_call_on_flow_path: false
- authorizes_immediate_durable_write: false
- flow_execution_performed: false
- durable_write_execution_performed: false
- durable_writes_performed: false
- graph_ingestion_performed: false
- render_performed: false
- provider_calls_made: 0
- private_evidence_read: false
- system_side_acquisition_performed: false
- production_writes: false
- readiness_claim: false
- mediation_gate_level: absent by design

What exists:

- `buildM5aCuratedProposalFlowOperatorArming(contract, packet, { armedAt, armedBy })` snapshots the contract root, verifies the step 2 packet against the step 1 contract, snapshots the verified packet and options, validates chronology (`drafted_at <= armedAt < expires_at`), constructs an armed artifact from validated locals only, and calls the verifier on the built artifact before returning.
- `verifyM5aCuratedProposalFlowOperatorArming(arming, packet, contract)` consumes an arbitrary unknown arming plus the packet and contract it claims to bind. It verifies the packet/contract pair first, snapshots the arming, and refuses any arming whose identity, lifecycle, trust-tier pins, Path-1 markers, chronology, or execution markers do not conform.
- `canonicalM5aOperatorArmingArtifactId(packetArtifactId, armedBy, armedAt)` derives the canonical arming ID. Because the full packet ID is already near the `SAFE_ID` cap, the arming ID encodes a deterministic 24-hex-character SHA-256 digest of the full `packet_artifact_id`, plus the operator identity and timestamp: `m5a-arm:${packetDigest}:${armedBy}:${armedAt}`. The verifier re-derives this canonical form from validated locals; a safe-shaped but wrong ID is refused.
- `M5aOperatorArmingRefusal extends Error` is the typed refusal thrown by builder and verifier.

Canonical arming ID doctrine:

The step 2 SAFE_ID lesson is applied explicitly here. The arming ID cannot include the full packet ID verbatim without exceeding the 121-character safe-id cap, but it must not drop the packet identity dimension. The compromise is a canonical digest over the **full** packet_artifact_id, not a hand-selected substring. What gets shortened is the representation, not the identity basis. The verifier independently re-derives the digest from the validated packet_artifact_id and the validated arming locals (`armed_by`, `armed_at`) before accepting the artifact.

Refusal conditions (checked by the verifier or build path):

- contract, packet, options, or arming are Proxy-backed or not plain own-data objects
- symbol keys, unsafe keys, or accessor descriptors appear on the checked boundary object
- packet fails the step 2 verifier against the step 1 contract
- packet is not drafted/unarmed/unconsumed/unexecuted before arming
- `armedAt` is before `packet.drafted_at` or at/after `packet.expires_at`
- `armedBy` is not a safe operator identity
- `arming_artifact_id` is not the canonical digest form re-derived from packet_artifact_id / armed_by / armed_at
- arming packet/contract/proposal/account references do not match the verified packet
- lifecycle is not `armed`, or consumed/executed/expired/revoked are not false
- max flow executions is not exactly 1, remaining executions is not 1, consumed executions is not 0, retry budget is not 0, or retry requires new approval is not true
- provider call, system acquisition, private read, direct durable write, flow execution, graph ingestion, render, production write, or readiness markers are broadened
- top-level or nested `mediation_gate_level` is stamped on the arming artifact
- positive trust-tier pins are absent, weakened, or promoted to verified

Non-goals:

- No flow execution.
- No durable write.
- No render.
- No L0 mediation stamp.
- No provider/model call.
- No system-side acquisition.
- No private evidence read.
- No production write, deployment, readiness, launch-readiness, or product-readiness claim.
- No roles, sessions, permissions, groups, or generic approval primitive. The operator identity is one attributable string field.
- No H3 implementation. This slice only reinforces the M5a-layer shared-helper retro input.

Verification coverage:

`tests/safety/m5a-curated-proposal-flow-operator-arming.test.ts` proves:

- happy path: builder produces an armed, unconsumed, one-shot authorization over the committed M5a step 1/2 artifacts and performs no execution
- positive trust-tier pins propagate onto the arming artifact
- verifier accepts both builder output and a hand-constructed conformant arming
- arming for packet A used with packet B refuses
- arming for contract A used with contract B refuses through the packet/contract verifier
- arming ID with the wrong packet digest refuses even when the packet/contract triple is correct
- arbitrary safe arming ID refuses
- consumed, executed, expired, and revoked arming states refuse
- `armed_at` chronology refuses before drafting and at/after expiry
- max-flow and retry-budget broadening refuses
- provider-call, system-acquisition, private-read, and fresh-call broadening refuses
- direct durable-write/render execution markers refuse
- top-level and nested `mediation_gate_level` stamps refuse
- trust-tier weakening and per-record provenance promotion refuse
- Proxy-backed arming, packet, and contract refuse before get traps fire
- accessor-backed arming/options refuse before getters fire
- symbol and unsafe keys refuse
- canonical arming ID re-derivation uses validated locals, not fresh reads
- the module imports M5a helpers rather than hand-rolling them
- the module is pure: no provider SDK, network, fs, env, child process, fetch, or dynamic require
- the runbook and INDEX record this slice as M5a step 3 arming with no flow execution

What this slice gates:

- **M5a step 4 — flow execution.** The next slice consumes the armed artifact, the step 2 packet, and the step 1 contract. It is the first M5a slice allowed to run the recorded proposal through the M3 durable-write/reader/render surfaces and the first one that may flip durable-write/render effect markers. Step 4 must re-snapshot and re-verify the arming instead of trusting builder output, and it must stamp L0 only on completed effects.
- **H3 parked implementation.** The M5a layer now has three consumers of the shared step-1 snapshot helpers. H3 remains parked until implementation reaches the front of the queue, but the equivalence proof now must preserve step 1, step 2, and step 3 behavior.
