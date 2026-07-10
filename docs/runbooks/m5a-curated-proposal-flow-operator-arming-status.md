# M5a Curated Proposal Flow Operator Arming Status

Status: active

This runbook records the M5a step 3 artifact — the operator-arming slice over the M5a step 2 drafted-and-unarmed approval packet. It is the M5a analog of M3 step 3a's arming half: it consumes the step 1 contract, the verified step 2 packet, and an explicit operator arming input; it produces an armed-state artifact authorizing exactly one future curated proposal-flow execution.

No concrete committed arming instance exists in this repository. The module does not arm anything at import or initialization time; it creates an arming artifact only when an operator explicitly supplies a verified contract, verified drafted packet, `armedAt`, and `armedBy` to the builder. The committed code and tests prove the arming shape and refusal behavior, not that any real packet has been armed.

The boundary is deliberately narrow: **arming is not execution**. This slice performs no flow execution, no durable write, no render, no provider call, no system-side acquisition, no private evidence read, no graph ingestion, no production write, and no readiness claim. It also stamps **no mediation_gate_level** on the arming artifact. Steps 1 and 2 carry `L0` only as a prospective policy pin; L0 is a property stamp only on a completed effect, so only Step 4 may stamp it when a durable write actually occurs.

Doctrine inheritance from M5a steps 1 and 2:

- **hostile-probe-suite-as-done-criterion.** The actual deliverable is the hostile-probe regression suite. The probe target is **arming-state counterfeit**, not step 1 input-smuggling and not step 2 packet-state counterfeit. The probes cover forged armings and consumption keys, packet/contract/arming mismatches, broadening attempts, timestamp chronology, no-L0-stamp enforcement, accessors/Proxy refusal, and TOCTOU source guards. They do not claim to exercise durable replay enforcement, which belongs to Step 4.
- **build-side / verify-side asymmetry.** Every property the builder establishes by construction is independently checked by the verifier. The canonical `arming_artifact_id` and `one_shot_consumption_key` are the clearest cases: the builder generates them, and the verifier re-derives both from validated locals and refuses mismatch. The verifier's job is the arming artifacts the builder did not make. The step-1 contract is likewise re-verified at both downstream boundaries rather than trusted because its TypeScript type claims conformity.
- **snapshot-once-render-from-locals.** The module imports the M5a snapshot helpers from step 1 (`snapshotPlainOwnData`, `snapshotPlainArray`, `requireSafeId`, `requireCanonicalIsoTimestamp`, and `M5aContractBuilderRefusal`) and does not hand-roll another helper. This reinforces the H3 retro input: the M5a layer remains one consolidated snapshot-discipline site with multiple consumers.
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
- one_shot_consumption_recorded: false
- step_4_must_check_expiry_at_execution: true
- step_4_must_atomically_consume_one_shot_key_in_durable_transaction: true
- step_4_must_refuse_replay_after_consumption: true
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
- `canonicalM5aOperatorArmingArtifactId(packetArtifactId, referencesContractArtifactId, proposalSetId, accountId, armedBy, armedAt)` derives the event-specific canonical arming ID. It binds the full verified tuple, including operator and timestamp, with a deterministic 40-hex-character (160-bit) SHA-256 digest over an ordered JSON array, plus the readable operator and timestamp suffix: `m5a-arm:${tupleDigest}:${armedBy}:${armedAt}`. The verifier independently re-derives this canonical form from validated locals; a safe-shaped but wrong ID is refused.
- `canonicalM5aOneShotConsumptionKey(packetArtifactId, referencesContractArtifactId, proposalSetId, accountId)` derives the stable `m5a-one-shot:<40-hex-digest>` identity from only the verified packet/contract/proposal/account tuple. It intentionally excludes `armed_by` and `armed_at`, so two arming events over one packet have different `arming_artifact_id` values but the same `one_shot_consumption_key`. The verifier independently re-derives and checks it.
- `M5aOperatorArmingRefusal extends Error` is the typed refusal thrown by builder and verifier.

Canonical arming ID doctrine:

The arming ID cannot include all binding fields verbatim without exceeding the 121-character safe-id cap, but it must not drop any identity dimension. The canonical digest covers the **full verified tuple**, not a hand-selected substring. Step 1 and Step 2 now also use account-distinct 160-bit canonical digests; the Step-2 packet identity additionally binds `expires_at`, so extending an approval window changes the packet ID, arming ID, and one-shot consumption key. Account identity and expiry authority are therefore preserved at every downstream layer. The Step-3 verifier independently re-derives both arming and consumption identities from validated locals before accepting the artifact.

Expiry semantics are deliberately split across slices. Step 3 proves only that `drafted_at <= armed_at < packet_expires_at`; structural verification has no execution timestamp and therefore is **not an execution-time expiry check**. A structurally valid arming can still be presented after its packet has expired. The shipped fixture-bound Step 4 capstone compares its actual execution timestamp against `packet_expires_at` and refuses execution when `execution_at >= packet_expires_at`. This Step-3 module remains arming-only and implements no execution behavior.

One-shot semantics are likewise split across slices. Step 3 creates and verifies a stable key but has no persistence, registry, database read, or write. Its verifier is pure and idempotent: repeated structural verification records no consumption and cannot enforce replay exclusion. **Only Step 4 can enforce consumption.** The shipped fixture-bound Step 4 capstone checks the stable key, atomically records its consumption in the same durable transaction as the authorized effect, and refuses replay after consumption. The closed boundary markers above make those execution requirements part of the arming shape without pretending Step 3 itself performs them.

Refusal conditions (checked by the verifier or build path):

- contract, packet, options, or arming are Proxy-backed or not plain own-data objects
- symbol keys, unsafe keys, or accessor descriptors appear on the checked boundary object
- packet fails the step 2 verifier against the step 1 contract
- packet is not drafted/unarmed/unconsumed/unexecuted before arming
- `armedAt` is before `packet.drafted_at` or at/after `packet.expires_at`
- `armedBy` is not a safe operator identity
- `arming_artifact_id` is not the canonical digest form re-derived from packet_artifact_id / references_contract_artifact_id / proposal_set_id / account_id / armed_by / armed_at
- `one_shot_consumption_key` is not the canonical digest re-derived from packet_artifact_id / references_contract_artifact_id / proposal_set_id / account_id
- arming packet/contract/proposal/account references do not match the verified packet
- lifecycle is not `armed`, or consumed/executed/expired/revoked are not false
- max flow executions is not exactly 1, remaining executions is not 1, consumed executions is not 0, retry budget is not 0, or retry requires new approval is not true
- provider call, system acquisition, private read, direct durable write, flow execution, graph ingestion, render, production write, or readiness markers are broadened
- top-level or nested `mediation_gate_level` is stamped on the arming artifact
- positive trust-tier pins are absent, weakened, or promoted to verified
- an unknown lifecycle/authorization-shaped own key appears on the contract, packet, arming, or a load-bearing nested record/array

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
- honest artifacts for different accounts receive distinct step-1, step-2, and step-3 IDs
- two armings over one packet with different operator/timestamp values have distinct arming IDs and the same stable consumption key
- a forged consumption key refuses, while structurally repeated verification succeeds without mutating or recording consumption
- arbitrary safe arming ID refuses
- consumed, executed, expired, and revoked arming states refuse
- `armed_at` chronology refuses before drafting and at/after expiry
- max-flow and retry-budget broadening refuses
- provider-call, system-acquisition, private-read, and fresh-call broadening refuses
- direct durable-write/render execution markers refuse
- top-level and nested `mediation_gate_level` stamps refuse
- trust-tier weakening and per-record provenance promotion refuse
- Proxy-backed arming, packet, and contract refuse before get traps fire
- nested Proxy/accessor-backed contract and trust-tier-array paths refuse before traps/getters fire
- accessor-backed arming/options refuse before getters fire
- symbol and unsafe keys refuse
- canonical arming ID re-derivation uses validated locals, not fresh reads
- the module imports M5a helpers rather than hand-rolling them
- the module is pure: no provider SDK, network, fs, env, child process, fetch, or dynamic require
- the runbook and INDEX record this slice as M5a step 3 arming with no flow execution

What this slice gates:

- **M5a step 4 — fixture-bound flow execution now exists.** The Step 4 capstone consumes and re-verifies this armed artifact, the step 2 packet, and the step 1 contract; independently pins the exact committed proposal digest; enforces expiry; atomically consumes `one_shot_consumption_key` in the same local transaction as the effect; refuses replay; reads back the exact committed row; and renders Workshop from that read-back state. This Step-3 module itself remains pure and performs no execution or effect.
- **H3 parked implementation.** The shared Step-1 helper surface now spans three M5a artifact layers: Step 1 defines and uses it, while Steps 2 and 3 are its two downstream consumers. H3 remains parked until implementation reaches the front of the queue, but the equivalence proof must preserve all three layers' behavior.
