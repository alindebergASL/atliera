# Workshop Public Proposal Human Review Decision Status

Status: active

This runbook records the no-call public proposal human-review decision contract that follows `docs/runbooks/workshop-public-curated-proposal-preview-status.md`. The slice turns a visible public proposal preview item into a disposable human-review decision artifact. It does not read private evidence, call a provider, ingest graph records, write durable state, write production data, deploy anything, or claim product/readiness status.

Artifacts:

- Source preview status: `docs/runbooks/workshop-public-curated-proposal-preview-status.md`
- Decision artifact fixture: `fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json`
- Implementation: `src/workshop/proposal-review-decision.ts`
- Contract tests: `tests/workshop/proposal-review-decision.test.ts`
- Safety tests: `tests/safety/proposal-review-decision-contract.test.ts`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- authorizes_reviewed_candidate_durable_write: false
- reviewed_candidate_durable_write_performed: false
- ratification_performed: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

Decision states:

- `accept_for_graph_candidate`: records that a visible unverified model-proposed item is acceptable as a candidate for a later ratification-gated graph write. It creates only a disposable `graph_candidate_ref`; it does not perform graph ingestion or a durable write.
- `reject`: records that the visible item should not advance. It creates no candidate ref.
- `needs_more_evidence`: records that the visible item needs additional public or later separately approved evidence handling before any candidate path. It creates no candidate ref.
- `defer`: records no current decision. It creates no candidate ref.

What exists:

- `buildWorkshopPublicProposalHumanReviewDecisionArtifact` consumes the already-built public curated proposal preview and a bounded set of reviewer decisions.
- The contract only accepts decision targets that are actually visible in the preview.
- `accept_for_graph_candidate` is allowed only for visible items that still carry `model_proposed_pending_human_review`, `Unverified` trust, and zero accepted excerpts.
- The committed fixture demonstrates one accepted graph-candidate decision for the public fixture item `obj_acme-hub-signal`.
- The artifact is deeply frozen and records all closed provider/private/durable/ingestion/production/readiness markers.

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private fresh-route proof read or private evidence materialization.
- No graph ingestion, ratification, durable DB write, production write, deployment, or readiness claim.
- No claim that the candidate is verified, source-backed, launch-ready, or production-ready.

Verification coverage:

`tests/workshop/proposal-review-decision.test.ts` proves:

- a disposable accept-for-graph-candidate decision can be built from the public preview without graph ingestion
- the committed artifact regenerates exactly from the public preview fixture and deterministic reviewer input
- decisions cannot target items absent from the preview
- accept decisions fail closed if visible trust is incorrectly upgraded to verified
- reject, needs-more-evidence, and defer decisions do not create graph-candidate refs or silent promotions
- duplicate decisions and accessor-backed hostile records fail closed
- artifact boundaries cannot be flipped after validation

`tests/safety/proposal-review-decision-contract.test.ts` proves:

- this runbook records the no-call/no-private-read/no-durable-write boundary
- the runbook index has exactly one active row for this status document
- the implementation stays pure and does not import filesystem/process/network primitives
- the committed fixture preserves closed authorization markers and contains no private-evidence-shaped literals

Recommended next decision:

If this contract looks right, the next separate slice can make a ratification-gated graph write plan over accepted candidate refs. That later slice must still be no-call by default and must explicitly preserve that candidate refs are not durable graph ingestion until a separate write contract says so.
