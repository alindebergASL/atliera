# Workshop Public Curated Proposal Preview Status

Status: active

This runbook records the completed public-fixture Workshop preview slice named by `docs/runbooks/proposal-materialization-contract-status.md`. The slice renders the accepted public-curated proposal materialization bundle candidate through the deterministic Workshop HTML renderer, so the product surface visibly shows proposal-derived content as `Unverified` plus `Model-proposed · pending human review`.

Artifacts:

- Approval packet: `docs/runbooks/workshop-public-curated-proposal-preview-approval-packet.md`
- Input fixture: `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json`
- Preview HTML: `fixtures/workshop/workshop-public-curated-proposal-preview.html`
- Preview report: `fixtures/workshop/workshop-public-curated-proposal-preview-report.json`
- Implementation: `src/workshop/proposal-preview.ts`
- Tests: `tests/workshop/proposal-preview.test.ts`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
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

- `buildWorkshopPublicCuratedProposalPreview` materializes only a caller-supplied public-curated proposal input, builds the standard Workshop view model, renders validation-preview HTML, and returns a sanitized report.
- The committed preview HTML is deterministic and regenerated exactly by tests from the committed public fixture.
- The committed preview report records `html_rendered: true`, `lens_item_counts.signals: 1`, `review_decorated_item_count: 1`, `verified_object_count: 0`, and all closed provider/private/durable/ingestion/readiness boundary markers.
- The Workshop card keeps the existing `Unverified` trust pill and adds a separate `Model-proposed · pending human review` review-state pill. This is a decoration, not a new truth-status tier and not a ratification affordance.

Non-goals:

- No provider/model calls or spend.
- No network access or source fetching.
- No private-evidence reads and no private fresh-route proof output.
- No durable writes, graph ingestion, ratification, production writes, server start, deployment, or readiness claim.
- No product claim that this one preview is useful or launch-ready; it is a visible review artifact only.

Verification coverage:

`tests/workshop/proposal-preview.test.ts` proves:

- the public fixture renders validation-preview HTML with the visible model-proposed/pending-human-review decoration
- unverified proposal-derived content is not dressed as verified
- provider/private/durable/ingestion/production/readiness markers stay closed
- committed HTML and report artifacts stay in sync with regeneration from the public fixture
- private fresh-route origins remain rejected by the underlying materialization contract

Recommended next decision:

Use the committed preview HTML for human/product review. The immediate follow-up is now recorded in `docs/runbooks/workshop-public-proposal-human-review-decision-status.md`: a disposable human-review decision artifact over visible public-preview items. If the trust language is confusing, iterate on the public fixture/Workshop decoration first; do not move to private evidence until the visible review state works on public data.
