# Live Product Preview Usefulness Assessment

Status: applied no-spend assessment to the first live product preview.

This document applies `assessLiveProductPreviewUsefulness(...)` to the already-produced, already-sanitized facts from `live-product-preview-status.md` for preview ref `live-product-preview-20260528a`.

No provider call, provider spend, corpus expansion, provider/model comparison, product-preview expansion, runtime/model-mode integration, production write, web search, tool, plugin, raw provider response, raw source text, credential, wrapper log, or private evidence artifact is needed by this assessment.

## Sanitized gate input

The checked public fixture is `fixtures/validation/live-product-preview-20260528a-usefulness-input.json`.

Sanitized facts consumed by the gate:

- preview_ref: `live-product-preview-20260528a`;
- account_count: 1;
- provider_calls_executed: 1;
- output counts: excerpts 1, claims 1, account_objects 1;
- validation chain: passed;
- request surface: no tools, no plugins, no online model variant, no web search;
- Workshop side-effect boundary: HTML rendered, provider calls made 0, production writes false;
- useful_lens_count: 1;
- useful_lenses: `signals`;
- runtime/model-mode integration: false.

## Deterministic assessment

The checked public fixture is `fixtures/validation/live-product-preview-20260528a-usefulness-assessment.json`.

Result markers:

- preview_usefulness_classification: `weak-but-valid`;
- ok: false;
- status: fail;
- reason code: `insufficient_useful_lenses`;
- observed useful lenses: 1;
- required useful lenses: 2.

Interpretation: the one-run substrate, packaging, bootstrap, and Workshop render path stayed valid, but the product surface is weak because only the Signals lens is materially useful. The Maps and Plays lenses did not have materially useful graph-backed items in this one-run preview.

## Safety output markers

The assessment preserves:

- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- approves_expansion_or_comparison: false.

The assessment also preserves:

- live_provider_call: false;
- provider_spend: false;
- production_writes: false;
- runtime_model_mode_integration: false;
- provider_or_model_comparison: false;
- corpus_expansion: false;
- product_preview_expansion: false;
- web_search_or_tools: false.

## Boundary interpretation

This weak-but-valid result does not approve expansion, does not approve comparison, does not request another provider call, and does not imply launch readiness, product readiness, production readiness, broad model quality, multi-account readiness, provider lock-in, or an `owl-alpha` quality conclusion.

The next step is no-spend remediation of the prompt, proposal shape, Workshop lens mapping, or product-surface expectations before any separate expansion approval packet. `live-product-preview-usefulness-remediation.md` records that no-spend remediation plan and keeps live reruns, provider comparison, corpus expansion, product-preview expansion, and readiness claims blocked. If a later approval packet is requested, `owl-alpha-validation-framing.md` still applies: `owl-alpha` is not cost-limited, but safety, provenance, quality, role coverage, and usefulness value determine scope.
