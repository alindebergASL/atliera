# Live Product Preview Six-Slot Sanitized Execution Status

Status: historical sanitized status for the approved six-slot live product-preview slice. The approval PR was docs-only and did not execute the slice; execution happened afterward under the bounded six-slot approval in `live-product-preview-six-slot-approval.md`.

## Bounded execution facts

- commit `6451767` was the code under validation.
- provider route: OpenRouter `owl-alpha`.
- operation: `graph.propose`.
- approved corpus reference prefix: `external-corpus/live-product-preview-six-slot/`.
- selected roles: representative, representative, edge-case, edge-case, calibration, sparse-control.
- account slot count: 6.
- source-evidence screen passed count: 6.
- provider calls approved: 6.
- provider calls executed: 6.
- Workshop renders approved: 6.
- maximum output tokens per call: 900.
- temperature: 0.
- maximum slice cost: `$3.00`.
- cumulative six-slot product-preview cap: `$3.00`.

## Pre-call source-evidence screens

The private source-evidence screens passed before provider execution for all six slots. The repository records only category-presence markers and role labels, not raw source text, private account details, account identifiers, prompt material, wrapper logs, provider request bodies, or provider response bodies.

- source-evidence screen: passed.
- screened slots: 6.
- representative slots passed: 2.
- edge-case slots passed: 2.
- calibration slots passed: 1.
- sparse-control slots passed: 1.
- signals_category_present: true.
- maps_category_present: true.
- plays_category_present: true.
- raw source text committed: false.
- prewrote graph objects: false.
- replacement accounts used: false.

These screens did not pre-create graph records. Graph objects, claims, excerpts, and Workshop items came from provider output plus deterministic validation/packaging of that output.

## Validation results

The approved evidence traversed the intended path for all six screened slots:

- activation gates: passed for both representative slots, both edge-case slots, the calibration slot, and the sparse-control slot.
- credential status: passed for all six slots.
- provider call: passed for all six slots.
- response contract: passed for all six slots.
- cost ledger: succeeded for all six slots.
- full-pipeline packaging: passed for all six slots.
- bootstrap evidence verifier: passed for all six slots.
- Workshop preview: passed for all six slots.

Observed public-safe aggregate facts:

- input tokens: 5958.
- output tokens: 5317.
- token-accounting note: maximum output tokens per call records the request cap; observed output tokens records the provider-reported usage field from each completed response.
- observed provider cost: $0.00.
- estimated ledger cost: $0.06.
- output counts: excerpts 18, claims 18, account_objects 18.
- graph-supported lens counts: Signals 6, Maps 6, Plays 6.
- lens evidence packet counts: Signals 6, Maps 6, Plays 6.
- Workshop provider calls made: 0.
- Workshop production writes: false.
- no_post_output_substitution_used: true.
- ok slot count: 6.

Observed public-safe per-slot facts:

| slot role | provider call | output counts | graph-supported lens counts | lens evidence packet counts | packaging | bootstrap | Workshop | manifest hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| representative | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `a3bb8fda0ce49aebc53fb281ce2245639e67b74717cb80d34feb6e9a040e41a4` |
| representative | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `6a5ae5bbb4a3e702ca570478c96c852ba0dce3af982fa49604ffe8da476d49ce` |
| edge-case | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `003ba3cf56ce7eae0f67dd0d55103f85ddf1a328df087b0d3f8aaa2f7e6a2928` |
| edge-case | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `ecdc8a46e26b950f5f18da3755077fcdda4074c742781c948aa98120c7b9d0a3` |
| calibration | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `8af8b20d514f400ba0a89fbeec301bee647a9682cecd0e6309462974f4412e56` |
| sparse-control | passed | excerpts 3, claims 3, account_objects 3 | Signals 1, Maps 1, Plays 1 | Signals 1, Maps 1, Plays 1 | passed | passed | passed | `ab6082dbe0fc97ef32c9f0911592f6c266ec411d885931c8591eee90812da20d` |

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

## Sparse-control interpretation

The sparse-control slot traversed the same validation, packaging, bootstrap, and Workshop preview path as the other slots. This is a bounded historical observation from one screened low-evidence control slot, not evidence that sparse accounts are broadly product-ready. Because the sanitized graph-supported lens counts show one item per lane, the next decision should inspect usefulness from sanitized facts rather than infer readiness from successful traversal alone.

## Interpretation limits

This status records one bounded six-slot product-preview validation slice. It does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account readiness.

It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a provider comparison. It only shows that six screened slots traversed the approved path through provider validation, graph validation, quality gate, manifest/bootstrap evidence, and the existing Workshop preview surface with one graph-backed item in each of Signals, Maps, and Plays per slot.

The next step is not launch or expansion by default. The applied next step is `live-product-preview-six-slot-usefulness-assessment.md`, a separate no-spend six-slot usefulness assessment over these already-sanitized facts. Any further provider run, provider comparison, corpus expansion beyond these six screened slots, web/tool-enabled retrieval, paid fallback, production write, deployment, or runtime/model-mode integration needs another separate approval packet.
