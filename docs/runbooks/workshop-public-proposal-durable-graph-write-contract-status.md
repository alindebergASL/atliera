# Workshop Public Proposal Durable Graph-Write Contract Status

Status: active

This runbook records the no-call public proposal durable graph-write contract that follows `docs/runbooks/workshop-public-proposal-ratification-plan-status.md`. The slice consumes the disposable reviewed-candidate ratification plan and produces a disposable contract artifact. It does not perform a durable graph write, does not authorize a durable graph write, does not ingest any graph records, does not call a provider, does not read private evidence, does not write production data, does not deploy anything, and does not claim product/readiness status.

This slice is M3 step 1 per the operator directive of 2026-06-12 and the roadmap default sequence (M3 → M5a → M4 → M5b). It defines the typed shape of the eventual durable graph-write operation for each ratified candidate and defines the typed shape of the future approval packet that would arm one such write. The eventual write is a deterministic L0 system action per ADR 0003: the model influenced what was proposed, the human ratified the proposal, and the system performs the write deterministically under a separately operator-armed approval. There is no model influence on whether, when, or against what the eventual write would run.

Artifacts:

- Source plan status: `docs/runbooks/workshop-public-proposal-ratification-plan-status.md`
- Source plan fixture: `fixtures/workshop/workshop-public-proposal-reviewed-candidate-ratification-plan.json`
- Contract fixture: `fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json`
- Implementation: `src/workshop/proposal-durable-graph-write-contract.ts`
- Contract tests: `tests/workshop/proposal-durable-graph-write-contract.test.ts`
- Safety tests: `tests/safety/proposal-durable-graph-write-contract-contract.test.ts`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- defines_durable_write_contract: true
- authorizes_durable_write_execution: false
- durable_write_execution_performed: false
- requires_separate_durable_write_approval_packet: true
- ratification_performed: false
- plan_only: true
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

- `buildWorkshopPublicProposalDurableGraphWriteContractArtifact` consumes the no-call ratification plan artifact and a deterministic `contractedAt` timestamp and emits a frozen contract artifact.
- The artifact defines the typed shape of the eventual durable graph-write operation per candidate. Each `write_operation` records the per-candidate `target_store` (pinned to `local-durable-db`), the derived `target_record_counts` for the eventual write (account_object, claim_count, excerpt_count, source_count, ratification_audit_event), the doctrine-aligned `trust_label_on_durable_write` (`model-proposed-human-ratified-evidence-pending`), the ADR-0003 `mediation_gate_level` of `L0`, an `idempotency_key_shape`, a hard `retry_budget` of zero, `rollback_semantics` of `single-transaction-or-noop`, and the per-record state markers `authorizes_durable_write: false` and `durable_write_performed: false`.
- The artifact defines the typed shape of the future approval packet that any later slice must produce to arm an eventual write. The `approval_packet_shape` pins the required artifact kind, the `must_reference_contract_artifact_id`, the `must_reference_ratification_plan_proposal_set_id`, the `must_pin_candidate_item_ids` list, `max_durable_writes: 1`, `max_attempts: 1`, `retry_budget: 0`, `retry_requires_new_approval: true`, `expiry_required: true`, `operator_arming_required: true`, `mediation_gate_level: L0`, and the pinned `target_store`.
- The contract rejects any upstream ratification plan whose own boundary state has broadened (any closed marker observed `true`, `current_effective_authorization` other than `none`, missing `plan_only`, missing pointer at `reviewed-candidate-durable-graph-write`, or malformed timestamps).
- The committed contract fixture demonstrates one contracted write operation derived from the public fixture item `obj_acme-hub-signal` and a fully populated approval-packet shape that pins this contract artifact.
- The artifact is deeply frozen and records all closed provider/private/durable/ingestion/production/readiness markers.

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private fresh-route proof read or private evidence materialization.
- No ratification execution, graph ingestion, durable graph write, production write, deployment, or readiness claim.
- No claim that any candidate is verified, source-backed, launch-ready, or production-ready.
- No automatic conversion from contracted refs into a GraphBundle write; the next required contract is the `reviewed-candidate-durable-graph-write-approval-packet` slice, and the slice after that is the separately operator-armed durable write itself.

Verification coverage:

`tests/workshop/proposal-durable-graph-write-contract.test.ts` proves:

- a disposable contract artifact can be built from the ratification plan fixture without authorizing or performing any write
- the committed contract fixture regenerates exactly from the committed plan fixture
- an upstream plan whose closed-state authorization markers have broadened is rejected
- an upstream candidate whose `authorizes_durable_write` has broadened is rejected
- a malformed `contractedAt` is rejected
- a zero-candidate plan is rejected
- upstream count mismatches, stale `contractedAt` values, and accessor-backed hostile records fail closed without invoking getters
- a wrong-kind upstream artifact is rejected
- an upstream plan whose `next_required_contract` does not point at this slice is rejected

`tests/safety/proposal-durable-graph-write-contract-contract.test.ts` proves:

- this status runbook records the contract-only no-call no-write boundaries in greppable form
- the runbook index lists this runbook exactly once and classifies it as `active` with the non-authorizing description
- the implementation module stays pure (no fs/process.env/network/dynamic imports) and keeps the closed-state markers
- the committed contract fixture is sanitized and non-authorizing
