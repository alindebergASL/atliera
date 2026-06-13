# Workshop Public Proposal Durable Graph-Write Approval Packet Status

Status: active

This runbook records the no-call public proposal durable graph-write approval packet that follows `docs/runbooks/workshop-public-proposal-durable-graph-write-contract-status.md`. The slice consumes the disposable durable graph-write contract artifact and produces a disposable, drafted approval packet plus the typed shape of the operator-arming action that a future operator step would perform. It does not arm the packet, does not perform a durable graph write, does not authorize a durable graph write, does not ingest any graph records, does not call a provider, does not read private evidence, does not write production data, does not deploy anything, and does not claim product/readiness status.

This slice is M3 step 2 per the operator directive of 2026-06-12 and the roadmap default sequence (M3 → M5a → M4 → M5b). The approval packet conforms to the `approval_packet_shape` published by the M3 step 1 contract. It is always emitted in `lifecycle_state: drafted` with `operator_armed: false` and `armed_at: null`. There is no parameter, mode, or code path in this slice that produces an armed packet: arming is a separate operator action whose required shape this slice defines (the `arming_surface`) but never executes. `current_effective_authorization` remains `none` for a drafted packet, and even once a later operator step arms it, arming only authorizes the separate write-execution slice to attempt a single durable write — it never itself writes.

Artifacts:

- Source contract status: `docs/runbooks/workshop-public-proposal-durable-graph-write-contract-status.md`
- Source contract fixture: `fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json`
- Approval packet fixture: `fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json`
- Implementation: `src/workshop/proposal-durable-graph-write-approval-packet.ts`
- Contract tests: `tests/workshop/proposal-durable-graph-write-approval-packet.test.ts`
- Safety tests: `tests/safety/proposal-durable-graph-write-approval-packet-contract.test.ts`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- defines_arming_surface: true
- operator_armed: false
- requires_operator_arming: true
- authorizes_durable_write_execution: false
- durable_write_execution_performed: false
- arming_performed_by_this_artifact: false
- ratification_performed: false
- requires_separate_ratification_approval: true
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

What exists:

- `buildWorkshopPublicProposalDurableGraphWriteApprovalPacket` consumes the no-call durable graph-write contract artifact and deterministic params (`approvalId`, `draftedAt`, `expiresAt`) and emits a frozen, drafted approval-packet artifact.
- The packet conforms to the contract's published `approval_packet_shape`: it pins the contract artifact id, the proposal set id, exactly the contracted candidate item ids, `max_durable_writes: 1`, `max_attempts: 1`, `retry_budget: 0`, `retry_requires_new_approval: true`, the `L0` mediation gate level, and the pinned `local-durable-db` target store. It carries a required `expires_at`.
- The packet copies the contract's per-candidate write scope (account object, claim/excerpt/source refs, trust label, idempotency-key shape) without widening it.
- The packet defines an `arming_surface`: the typed shape a future operator-arming action must satisfy (reference the approval id, match the contract artifact id, be invoked under operator identity, occur before expiry, transition `drafted → operator-armed`, and authorize only a single durable-write attempt under this packet — still requiring a separate write-execution slice). The arming surface is defined, never performed.
- The packet is always drafted and unarmed by construction: `lifecycle_state` is hard-coded `drafted`, `operator_armed` is hard-coded `false`, and `armed_at` is hard-coded `null`. Hostile params attempting to smuggle armed state are structurally inert and leave no trace.
- The packet rejects any contract whose closed boundary state has broadened, whose `current_effective_authorization` is not `none`, whose pinned ids disagree with its write operations, whose timestamps are malformed, or that is accessor-backed (rejected via own-data descriptor snapshot without invoking getters). It also rejects malformed params, an expiry not strictly after drafting, and drafting earlier than the contract was contracted.
- The artifact is deeply frozen and records all closed provider/private/durable/ingestion/production/readiness markers.

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private fresh-route proof read or private evidence materialization.
- No arming, ratification execution, graph ingestion, durable graph write, production write, deployment, or readiness claim.
- No claim that any candidate is verified, source-backed, launch-ready, or production-ready.
- No automatic transition to armed; arming is a separate operator action. The next required contract is the `reviewed-candidate-durable-graph-write-execution` slice, which runs only after a separate operator arming action transitions this packet to operator-armed.

Verification coverage:

`tests/workshop/proposal-durable-graph-write-approval-packet.test.ts` proves:

- a drafted, unarmed, non-authorizing packet builds from the contract fixture
- the committed packet fixture regenerates exactly from the committed contract fixture
- no parameter produces an armed packet — smuggled armed-state params are inert and the result is byte-identical to the clean build
- a contract whose closed boundary state has broadened is rejected
- a contract whose `current_effective_authorization` is not `none` is rejected
- a contract whose pinned ids disagree with its write operations is rejected
- an expiry not strictly after drafting is rejected
- drafting earlier than the contract was contracted is rejected
- a malformed approval id and malformed timestamps are rejected
- write scopes attempting to upgrade the trust label, spoof idempotency-key shape, or diverge `account_object_id` from `candidate_item_id` are rejected
- contract artifact ids that do not match the pinned proposal set and timestamp are rejected
- an accessor-backed hostile contract is rejected without invoking the getter
- a wrong-kind upstream artifact is rejected

`tests/safety/proposal-durable-graph-write-approval-packet-contract.test.ts` proves:

- this status runbook records the drafted, unarmed, no-call no-write boundaries in greppable form
- the runbook index lists this runbook exactly once and classifies it as `active` with the non-authorizing description
- the implementation module stays pure (no fs/process.env/network/dynamic imports) and keeps the closed-state markers
- the committed packet fixture is sanitized, drafted, unarmed, and non-authorizing
