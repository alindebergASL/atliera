# Workshop Public Proposal Durable Graph-Write Operator Arming Status

Status: active

This runbook records the operator-arming artifact for the M3 step 2 durable-write approval packet, the first half of M3 step 3a per the operator directive of 2026-06-12 (sharpening 2026-06-14). The arming consumes the drafted approval packet plus a single operator identity and an armed_at timestamp and produces an operator-armed artifact whose only effect is to authorize exactly one attempt of the separate durable-write executor under this arming.

The arming itself does not perform a durable graph write, does not ingest any graph records, does not call a provider, does not read private evidence, and does not write production data. It does flip `authorizes_durable_write_execution` from false to true — on this artifact only — which is the single marker change this slice introduces. Every other closed marker on the arming artifact remains closed.

Doctrine alignment (ADR 0003): arming is the deterministic precondition that lets the L0 system action proceed. Arming itself does not perform an L0 effect; it gates one. The mediation_gate_level is recorded on the arming as the level the executor will operate at, not as a claim that an effect has occurred.

Operator-identity discipline (operator directive 2026-06-14): this artifact carries exactly one attributable ratifier — a single string field. No roles, no sessions, no permissions, no group lookups. That scope is M6.

Artifacts:

- Source approval packet status: `docs/runbooks/workshop-public-proposal-durable-graph-write-approval-packet-status.md`
- Source approval packet fixture: `fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json`
- Implementation: `src/workshop/proposal-durable-graph-write-operator-arming.ts`
- Contract tests: `tests/workshop/proposal-durable-graph-write-operator-arming.test.ts`
- Safety tests: `tests/safety/proposal-durable-graph-write-operator-arming-contract.test.ts`

Boundary markers:

- current_effective_authorization: single-armed-durable-write-attempt
- authorizes_durable_write_execution: true
- operator_armed: true
- arming_is_one_shot: true
- arming_is_revocable_before_consumption: true
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion_beyond_single_armed_write: false
- graph_ingestion_performed: false
- durable_write_execution_performed: false
- durable_writes_performed: false
- production_writes: false
- readiness_claim: false
- ratification_performed_against_durable_state: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- l0_effect_observed: false

What exists:

- `buildWorkshopPublicProposalOperatorArming` consumes the no-call durable-write approval packet and `(operatorIdentity, armedAt)` and emits a frozen operator-armed artifact.
- The single operator identity is recorded on one string field. No roles, sessions, permissions, or group lookups are modeled here.
- The arming carries `consumption.attempts_remaining: 1` at construction; the executor decrements this when it consumes the arming, but the arming module itself never decrements anything.
- The arming refuses any packet that is not in `drafted` lifecycle, any packet whose closed boundary markers have broadened (notably `operator_armed: true` or `authorizes_durable_write_execution: true`), any malformed timestamp, any armed_at before the packet's drafted_at, any armed_at at or after the packet's expires_at, any malformed operator identity, and any accessor-backed hostile packet (rejected via own-data descriptor snapshot without invoking getters).

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private evidence read, materialization, or fetched-source ingestion.
- No durable graph write, graph ingestion, production write, deployment, or readiness claim.
- No L0 effect on this artifact alone.
- No role/session/permission modeling. M6 work.

Verification coverage:

`tests/workshop/proposal-durable-graph-write-operator-arming.test.ts` proves:

- a valid drafted packet arms cleanly with the one operator identity field and stamps the lifecycle to operator-armed
- the arming flips `authorizes_durable_write_execution` to true while keeping every other closed marker closed
- a packet not in drafted lifecycle is refused
- a packet whose `operator_armed` boundary is already true is refused
- a packet whose `authorizes_durable_write_execution` boundary is already true is refused
- an `armedAt` at or after the packet's `expires_at` is refused
- an `armedAt` before the packet's `drafted_at` is refused
- a malformed operator identity is refused
- an accessor-backed hostile packet is refused without invoking the getter

`tests/safety/proposal-durable-graph-write-operator-arming-contract.test.ts` proves:

- this status runbook records the operator-arming boundaries in greppable form
- the runbook index lists this runbook exactly once and classifies it as `active`
- the implementation module stays pure (no fs/process.env/network/dynamic imports) and keeps the closed-state markers
