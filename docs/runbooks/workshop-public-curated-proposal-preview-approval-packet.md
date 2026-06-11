# Workshop Public Curated Proposal Preview Approval Packet

Status: consumed

This packet approves one bounded public-fixture Workshop preview slice: render the accepted bundle candidate produced from `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json` through the deterministic Workshop HTML renderer in validation-preview mode.

Approved artifact name: `workshop-public-curated-proposal-preview`

Approved outputs:

- `fixtures/workshop/workshop-public-curated-proposal-preview.html`
- `fixtures/workshop/workshop-public-curated-proposal-preview-report.json`
- `docs/runbooks/workshop-public-curated-proposal-preview-status.md`

Approved scope:

- Use only the committed hand-curated public-shaped proposal fixture.
- Materialize through `materializeProposalForValidation`.
- Render the resulting disposable `bundle_candidate` through the existing Workshop renderer in validation preview mode.
- Show proposal-derived account objects as `Unverified` plus the visible `Model-proposed · pending human review` decoration.
- Commit deterministic preview artifacts and tests that regenerate them exactly.

Boundary markers approved for this slice:

- current_effective_authorization: none after completion
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- provider_calls_executed_by_this_slice: 0
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

Explicit non-authorization:

- This packet does not authorize reading private fresh-route proof output.
- This packet does not authorize model/provider calls, network fetching, new source collection, graph ingestion, durable graph writes, production writes, deployment, or readiness claims.
- This packet does not authorize ratification of proposal-derived records.
- This packet does not add a sixth truth-status tier; `model_proposed_pending_human_review` is a review-state decoration on top of `unverified` / `proposed` content.

Completion condition:

The slice is complete only if the committed preview HTML visibly renders at least one `Model-proposed · pending human review` card, the committed report preserves all closed boundary markers above, and tests prove the artifacts regenerate exactly from the committed public fixture.
