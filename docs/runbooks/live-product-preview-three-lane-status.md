# Three-Lane Live Product Preview Sanitized Execution Status

Status: historical sanitized status for the approved three-lane live product preview. The approval PR was docs-only and did not execute the run; execution happened afterward under the one-run approval in `live-product-preview-three-lane-approval.md`.

## Bounded execution facts

- commit `608686d` was the code under validation.
- provider route: OpenRouter `owl-alpha`.
- operation: `graph.propose`.
- approved corpus reference prefix: `external-corpus/live-product-preview-three-lane/`.
- selected role: screened_three_lane.
- account count: 1.
- provider calls approved: 1.
- provider calls executed: 1.
- Workshop renders approved: 1.
- maximum output tokens: 900.
- temperature: 0.
- maximum run cost: `$0.50`.
- cumulative three-lane product-preview cap: `$0.50`.

## Pre-call source-evidence screen

The private source-evidence screen passed before the provider call. The repository records only category-presence markers, not raw source text, private account details, prompt material, wrapper logs, or provider response bodies.

- source-evidence screen: passed.
- signals_category_present: true.
- maps_category_present: true.
- plays_category_present: true.
- raw source text committed: false.
- prewrote graph objects: false.

This screen did not pre-create graph records. Graph objects, claims, excerpts, and Workshop items came from the provider output plus deterministic validation/packaging of that output.

## Validation results

The approved evidence traversed the intended path:

- activation gates: passed.
- credential status: passed.
- provider call: passed.
- response contract: passed.
- cost ledger: succeeded.
- full-pipeline packaging: passed.
- bootstrap evidence verifier: passed.
- Workshop preview: passed.

Observed public-safe run facts:

- input tokens: 939.
- output tokens: 967.
- token-accounting note: maximum output tokens records the request cap; observed output tokens records the provider-reported usage field from the completed response.
- observed provider cost: $0.00.
- estimated ledger cost: $0.01.
- output counts: excerpts 3, claims 3, account_objects 3.
- graph-supported lens counts: Signals 1, Maps 1, Plays 1.
- lens evidence packet counts: Signals 1, Maps 1, Plays 1.
- Workshop provider calls made: 0.
- Workshop production writes: false.
- no_post_output_substitution_used: true.
- manifest hash: `910ea9773912f09641668c49e299bf375eda19210c346fa2cced5c503387d810`.

## Safety boundaries preserved

- tools_or_plugins_requested: false.
- online_model_variant_requested: false.
- web_search_requested: false.
- private evidence retained outside the repository.
- production writes: none.
- runtime/model-mode integration: none.
- launch_readiness_claim: false.
- product_readiness_claim: false.
- production_readiness_claim: false.
- broad_model_quality_claim: false.
- multi_account_readiness_claim: false.
- provider_or_model_comparison: false.
- corpus_expansion: false.

## Interpretation limits

This status records one bounded screened-account product-preview validation run. It does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account readiness.

It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a provider comparison. It only shows that one screened, richer source account traversed the approved path through provider validation, graph validation, quality gate, manifest/bootstrap evidence, and the existing Workshop preview surface with one graph-backed item in each of Signals, Maps, and Plays.

The next step is not launch or expansion by default. The no-spend usefulness assessment over these already-sanitized facts is `live-product-preview-three-lane-usefulness-assessment.md`; it classifies this screened-account preview as `useful` while keeping `approves_expansion_or_comparison: false`. The separate approval packet for a bounded broader `owl-alpha` batch is `live-product-preview-broader-batch-approval.md`; its sanitized execution status is `live-product-preview-broader-batch-status.md`. Any further provider run outside that completed packet, provider comparison, corpus expansion beyond its three screened account slots, web/tool-enabled retrieval, paid fallback, production write, deployment, or runtime/model-mode integration needs another separate approval packet.
