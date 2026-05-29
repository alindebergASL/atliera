# Broader Live Product Preview Batch Sanitized Execution Status

Status: historical sanitized status for the approved broader live product-preview batch. The approval PR was docs-only and did not execute the batch; execution happened afterward under the bounded three-slot approval in `live-product-preview-broader-batch-approval.md`.

## Bounded execution facts

- commit `10b26bc` was the code under validation.
- provider route: OpenRouter `owl-alpha`.
- operation: `graph.propose`.
- approved corpus reference prefix: `external-corpus/live-product-preview-broader-batch/`.
- selected roles: representative, edge-case, calibration.
- account slot count: 3.
- source-evidence screen passed count: 3.
- provider calls approved: 3.
- provider calls executed: 3.
- Workshop renders approved: 3.
- maximum output tokens per call: 900.
- temperature: 0.
- maximum batch cost: `$1.50`.
- cumulative broader-batch product-preview cap: `$1.50`.

## Pre-call source-evidence screens

The private source-evidence screens passed before provider execution for all three slots. The repository records only category-presence markers and role labels, not raw source text, private account details, account identifiers, prompt material, wrapper logs, or provider response bodies.

- source-evidence screen: passed.
- screened slots: 3.
- signals_category_present: true.
- maps_category_present: true.
- plays_category_present: true.
- raw source text committed: false.
- prewrote graph objects: false.
- replacement accounts used: false.

These screens did not pre-create graph records. Graph objects, claims, excerpts, and Workshop items came from provider output plus deterministic validation/packaging of that output.

## Validation results

The approved evidence traversed the intended path for all three screened slots:

- activation gates: passed for representative, edge-case, and calibration.
- credential status: passed for representative, edge-case, and calibration.
- provider call: passed for representative, edge-case, and calibration.
- response contract: passed for representative, edge-case, and calibration.
- cost ledger: succeeded for representative, edge-case, and calibration.
- full-pipeline packaging: passed for representative, edge-case, and calibration.
- bootstrap evidence verifier: passed for representative, edge-case, and calibration.
- Workshop preview: passed for representative, edge-case, and calibration.

Observed public-safe aggregate facts:

- input tokens: 2833.
- output tokens: 2596.
- token-accounting note: maximum output tokens per call records the request cap; observed output tokens records the provider-reported usage field from each completed response.
- observed provider cost: $0.00.
- estimated ledger cost: $0.03.
- output counts: excerpts 9, claims 9, account_objects 9.
- graph-supported lens counts: Signals 3, Maps 3, Plays 3.
- lens evidence packet counts: Signals 3, Maps 3, Plays 3.
- Workshop provider calls made: 0.
- Workshop production writes: false.
- no_post_output_substitution_used: true.
- ok slot count: 3.

Observed public-safe per-slot facts:

| slot role | provider call | output counts | graph-supported lens counts | lens evidence packet counts | packaging | bootstrap | Workshop | manifest hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| representative | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `78ff9ebfa1969b6b49151851a8404ac8574dce2b7e03ee4f4b460de7eb7c38ff` |
| edge-case | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `00bd78564dcffbf931641bd85b53d1a0d78596a963bb5f7604ed075043644781` |
| calibration | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `4c2ec8622f1bb4a04bc75d75a8e3575b2fafafa9c0a217d5266f8c75c3c8a6fe` |

## Safety boundaries preserved

- tools_or_plugins_requested: false.
- online_model_variant_requested: false.
- web_search_requested: false.
- paid_fallback_used: false.
- private evidence retained outside the repository.
- committed private source text: false.
- production writes: none.
- runtime/model-mode integration: none.
- provider_lock_in: false.
- launch_readiness_claim: false.
- product_readiness_claim: false.
- production_readiness_claim: false.
- broad_model_quality_claim: false.
- multi_account_readiness_claim: false.
- provider_or_model_comparison: false.
- corpus_expansion_beyond_approved_slots: false.

## Interpretation limits

This status records one bounded three-slot product-preview validation batch. It does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account readiness.

It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a provider comparison. It only shows that three screened slots traversed the approved path through provider validation, graph validation, quality gate, manifest/bootstrap evidence, and the existing Workshop preview surface with one graph-backed item in each of Signals, Maps, and Plays per slot.

The next step is not launch or expansion by default. If this status is used for a next decision, that decision should first be a separate no-spend batch usefulness assessment over these already-sanitized facts. Any further provider run, provider comparison, corpus expansion beyond these three screened slots, web/tool-enabled retrieval, paid fallback, production write, deployment, or runtime/model-mode integration needs another separate approval packet.
