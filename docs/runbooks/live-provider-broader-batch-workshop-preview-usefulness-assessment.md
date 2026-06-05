# Live-Provider Broader-Batch Workshop Preview Usefulness Assessment

Status: applied no-spend assessment to the already-rendered live-provider broader-batch non-production Workshop preview.

This document applies `assessBroaderBatchWorkshopPreviewUsefulness(...)` to the already-produced, already-sanitized facts from `live-provider-broader-batch-workshop-preview-status.md` for preview ref `live-provider-broader-batch-workshop-preview-20260605a`.

No provider call, provider spend, retry, corpus expansion, provider/model comparison, product-preview expansion, runtime/model-mode integration, graph ingestion, production write, deployment, web search, tool, plugin, raw provider output, raw prompt text, raw source text, account identifier, request id, credential, wrapper log, preview HTML, screenshot, model payload, or private evidence artifact is needed, read, or produced by this assessment. The assessment consumes only sanitized public facts already recorded in repo docs.

The route remains provider-neutral and the underlying route is a replaceable route: this assessment makes no claim about a specific provider, no default model selection, and no provider lock-in.

## Why a source-specific helper

The generic `assessLiveProductPreviewUsefulness(...)` helper assumes one provider call per selected slot and would force the source ledger's `provider_calls_executed` to equal the slot count. That is not what happened here: the source status doc records a bounded provider ledger of `provider_api_requests_attempted: 2` and `provider_calls_executed: 2` (one rejected by the private sanitizer, one validated), and the single validated generation produced the five screened batch slots. To report the ledger honestly, this assessment uses the source-specific `assessBroaderBatchWorkshopPreviewUsefulness(...)` helper, which keeps the raw provider ledger separate from the distinct `selected_slot_count` slot/account fan-out and never overloads `provider_calls_executed` as a per-slot count.

## Sanitized gate input

The checked public fixture is `fixtures/validation/live-provider-broader-batch-workshop-preview-20260605a-usefulness-input.json`.

Sanitized facts consumed by the gate:

- preview_ref: `live-provider-broader-batch-workshop-preview-20260605a`;
- selected_slot_count: 5;
- provider ledger: provider_api_requests_attempted 2, provider_calls_executed 2, rejected_generations 1, successful_validated_generations 1;
- selected roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration;
- slot_output_counts: each selected role has excerpts 2, claims 2, account_objects 3;
- output counts: excerpts 10, claims 10, account_objects 15;
- per-account graph-output floor: each selected role has at least one of each graph fact type;
- validation chain: passed;
- request surface: no tools, no plugins, no online model variant, no web search;
- Workshop side-effect boundary: HTML rendered, provider calls made 0, production writes false;
- useful_lens_count: 3;
- useful_lenses: `signals`, `maps`, `plays`;
- runtime/model-mode integration: false.

The gate input is a public sanitized summary. The per-slot role labels and per-slot counts are public-safe abstractions consistent with the recorded batch totals; they are not source account text, raw provider output, prompt text, credential material, wrapper logs, private paths, account identifiers, request ids, preview HTML, screenshots, or private evidence details. The provider ledger fields are preserved verbatim from the source status doc: `provider_calls_executed` is the raw provider request ledger (2), not a per-slot count, and `selected_slot_count` (5) is the distinct count of screened batch slots produced by the single validated generation.

## Deterministic assessment

The checked public fixture is `fixtures/validation/live-provider-broader-batch-workshop-preview-20260605a-usefulness-assessment.json`.

Result markers:

- preview_usefulness_classification: `useful`;
- ok: true;
- status: pass;
- reason count: 0;
- preserved provider ledger: provider_api_requests_attempted 2, provider_calls_executed 2, rejected_generations 1, successful_validated_generations 1;
- selected_slot_count: 5;
- observed useful lenses: 3;
- required useful lenses: 2.

Interpretation: this already-executed bounded batch made two provider requests (one rejected by the private sanitizer, one validated) and the single validated generation produced graph-backed Workshop material across five screened slots in Signals, Maps, and Plays across the representative, edge-case, and calibration roles, and the bounded validation, packaging, bootstrap, graph-validation, and non-production Workshop render path stayed valid. This is a narrow historical product-surface signal for these five screened slots only.

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

This useful batch result does not approve expansion, does not approve comparison, does not approve graph ingestion, does not request another provider call, and does not imply launch readiness, product readiness, production readiness, broad model quality, provider quality, default-model selection, provider lock-in, retry authorization, or any runtime/model-mode integration. The route stays provider-neutral and the underlying route stays a replaceable route.

This useful result may inform a later separately reviewed docs-only approval packet if another bounded validation step is proposed. That later decision needs a separate approval packet, private evidence handling, an explicit no-tools/no-search policy unless separately changed, sanitized status follow-up, and no readiness or provider-quality claims. Any future provider call, retry, or product-preview expansion still requires new approval as recorded in `live-provider-broader-batch-workshop-preview-status.md`.
