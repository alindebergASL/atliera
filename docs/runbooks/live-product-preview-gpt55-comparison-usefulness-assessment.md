# GPT-5.5 Versus Owl Alpha Usefulness Assessment

Status: applied no-spend comparison usefulness assessment to already-produced, already-sanitized facts.

This document applies `compareLiveProductPreviewProviderUsefulness(...)` to the existing sanitized six-slot `owl-alpha` baseline and the existing sanitized six-slot GPT-5.5 candidate status. It performs no provider calls, no spend, no private evidence reads, no production writes, no runtime/model-mode integration, no web search, and no tool/plugin use.

## Sanitized inputs

Checked public fixtures:

- baseline usefulness fixture: `fixtures/validation/live-product-preview-six-slot-20260601a-usefulness-assessment.json`;
- candidate usefulness input: `fixtures/validation/live-product-preview-gpt55-comparison-20260602a-usefulness-input.json`;
- candidate usefulness output: `fixtures/validation/live-product-preview-gpt55-comparison-20260602a-usefulness-assessment.json`;
- comparison usefulness input: `fixtures/validation/live-product-preview-gpt55-vs-owl-alpha-usefulness-input.json`;
- comparison usefulness output: `fixtures/validation/live-product-preview-gpt55-vs-owl-alpha-usefulness-assessment.json`.

Comparison sides:

- baseline: `owl-alpha` from `live-product-preview-six-slot-20260601a`;
- candidate: `gpt-5.5` via `openai-codex` from `live-product-preview-gpt55-comparison-20260602a`.

Both sides consume only sanitized public facts: validation status, output counts, lens counts, provider-call counts, token counts, and safety flags. They do not contain source account text, raw provider output, prompt text, credential material, wrapper logs, private paths, account identifiers, provider request bodies, provider response bodies, or private evidence details.

## Deterministic comparison result

Result markers:

- comparison_usefulness_classification: `candidate-comparable-useful`;
- recommended_next_step: `provider-neutral-runtime-integration-planning`;
- baseline preview_usefulness_classification: `useful`;
- candidate preview_usefulness_classification: `useful`;
- output count delta: excerpts 0, claims 0, account_objects 0;
- useful_lens_count delta: 0;
- input token delta: -29;
- output token delta: -687;
- observed_cost_usd delta: 0;
- estimated_cost_usd delta: 0.

Reasons:

- candidate matched the baseline sanitized usefulness floor across six screened slots;
- candidate matched baseline graph-supported Signals, Maps, and Plays counts;
- candidate used fewer provider-reported output tokens in this bounded slice;
- result is not a model-quality, readiness, lock-in, or default-selection claim.

## Interpretation

The sanitized usefulness comparison says GPT-5.5 is comparable to the `owl-alpha` six-slot baseline on this bounded product-preview usefulness surface: both produced six useful screened slots, 18 excerpts, 18 claims, 18 account_objects, and graph-supported Signals, Maps, and Plays for each slot.

The only directional signal in this sanitized comparison is token accounting: GPT-5.5 used 687 fewer provider-reported output tokens in this bounded slice while matching the same public usefulness floor. That is an efficiency signal for this slice, not a broad model-quality claim.

The recommended next step is provider-neutral-runtime-integration-planning. That means plan the runtime integration seam and switching/selection policy without making a provider call and without selecting a default production model. Any real runtime integration, additional provider call, broader corpus, production write, or default-model decision needs a separate approval packet.

## Safety output markers

The assessment preserves:

- live_provider_call: false;
- provider_spend: false;
- raw_private_evidence_read: false;
- production_writes: false;
- runtime_model_mode_integration: false;
- provider_or_model_selection: false;
- corpus_expansion: false;
- product_preview_expansion: false;
- web_search_or_tools: false.

The assessment also preserves:

- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- default_model_selection_claim: false;
- provider_lock_in: false;
- approves_provider_call: false;
- approves_expansion_or_comparison: false.

## Boundary interpretation

This assessment does not select GPT-5.5 as a default production model, does not deprecate `owl-alpha`, does not approve another provider call, does not approve expansion, does not approve comparison, does not approve runtime/model-mode integration, and does not imply launch readiness, product readiness, production readiness, broad model quality, multi-account readiness, or provider lock-in.

It only records that the bounded GPT-5.5 candidate matched the existing bounded `owl-alpha` baseline on the public sanitized usefulness metrics and used fewer output tokens in this one slice.
