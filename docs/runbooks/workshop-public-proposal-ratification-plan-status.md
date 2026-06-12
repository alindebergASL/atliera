# Workshop Public Proposal Reviewed-Candidate Ratification Plan Status

Status: active

This runbook records the no-call public proposal reviewed-candidate ratification plan contract that follows `docs/runbooks/workshop-public-proposal-human-review-decision-status.md`. The slice consumes the disposable human-review decision artifact and produces a disposable plan-only artifact over accepted candidate refs. It does not ratify candidates, ingest graph records, write durable graph state, call a provider, read private evidence, write production data, deploy anything, or claim product/readiness status.

Artifacts:

- Source decision status: `docs/runbooks/workshop-public-proposal-human-review-decision-status.md`
- Source decision fixture: `fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json`
- Ratification plan fixture: `fixtures/workshop/workshop-public-proposal-reviewed-candidate-ratification-plan.json`
- Implementation: `src/workshop/proposal-ratification-plan.ts`
- Contract tests: `tests/workshop/proposal-ratification-plan.test.ts`
- Safety tests: `tests/safety/proposal-ratification-plan-contract.test.ts`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- authorizes_reviewed_candidate_durable_write: false
- reviewed_candidate_durable_write_performed: false
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

- `buildWorkshopPublicProposalRatificationPlanArtifact` consumes the no-call human-review decision artifact and a deterministic `planned_at` timestamp.
- The contract accepts only `accept_for_graph_candidate` decisions with candidate refs that remain `candidate_only: true`, `graph_ingestion_performed: false`, and `durable_graph_write_performed: false`.
- Non-accept decisions must not carry candidate refs.
- Candidate refs are copied into plan records with `ratification_status: awaiting_separate_ratification`, `planned_write_operation: none`, and all graph/durable-write authorization/performed markers false.
- The committed fixture demonstrates one planned candidate from the public fixture item `obj_acme-hub-signal`.
- The artifact is deeply frozen and records all closed provider/private/durable/ingestion/production/readiness markers.

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private fresh-route proof read or private evidence materialization.
- No ratification execution, graph ingestion, durable graph write, production write, deployment, or readiness claim.
- No claim that the candidate is verified, source-backed, launch-ready, or production-ready.
- No automatic conversion from candidate refs into GraphBundle writes; the next required contract remains `reviewed-candidate-durable-graph-write`.

Verification coverage:

`tests/workshop/proposal-ratification-plan.test.ts` proves:

- a disposable ratification plan can be built from accepted human-review candidate refs without graph ingestion
- the committed plan fixture regenerates exactly from the committed human-review decision fixture
- the source accepted-candidate count must match actual candidate refs and at least one accepted candidate is required
- accepted decisions fail closed if candidate refs are missing, mismatched, already ingested, already durably written, or no longer candidate-only
- non-accept decisions with candidate refs and broadened source boundaries are refused
- hostile accessor records, impossible timestamps, stale `planned_at` values, and accepted decision timestamp mismatches fail closed
- artifact boundaries cannot be flipped after validation

`tests/safety/proposal-ratification-plan-contract.test.ts` proves:

- this runbook records the no-call/no-private-read/no-durable-write/no-ratification boundary
- the runbook index has exactly one active row for this status document
- the implementation stays pure and does not import filesystem/process/network primitives
- the committed fixture preserves closed authorization markers and contains no private-evidence-shaped literals

Recommended next decision:

If this plan contract looks right, the next separate slice can define the `reviewed-candidate-durable-graph-write` approval/contract surface. That later slice must still be no-call/no-write by default unless it explicitly becomes a separately approved durable-write contract; candidate refs remain non-ingested and non-durable until that separate contract exists and is approved.
