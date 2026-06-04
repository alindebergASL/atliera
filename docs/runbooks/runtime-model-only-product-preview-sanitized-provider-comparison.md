# Runtime Model-Only Product-Preview Sanitized Provider Comparison

Status: no-spend comparison over already-committed sanitized product-preview facts. This document does not execute or approve a provider call.

## Inputs

Baseline sanitized status:

- status_ref: live-product-preview-six-slot-20260601a
- provider_ref: openrouter
- model_label: owl-alpha
- corpus shape: six screened product-preview slots
- provider_calls_executed: 6
- accepted_output_received: true
- v2_contract_validated: true
- output counts: excerpts 18, claims 18, account_objects 18
- input_tokens_observed: 5958
- output_tokens_observed: 5317
- observed_cost_usd: 0

Candidate sanitized status:

- status_ref: product-preview-tiny-expansion-20260604c
- provider_ref: openai-codex
- model_label: gpt-5.5
- corpus shape: three screened product-preview slots
- provider_calls_executed: 3
- accepted_output_received: true
- v2_contract_validated: true
- output counts: excerpts 12, claims 10, account_objects 5
- input_tokens_observed: 1075
- output_tokens_observed: 1614
- observed_cost_usd: 0

Both inputs are public sanitized records. This comparison reads no raw prompt, screened account text, raw request/response, model output text, provider body, credential, private evidence, or local private path.

## Comparison result

- comparison_ref: runtime-model-only-gpt55-tiny-vs-owl-alpha-six-slot-20260604c
- status: pass
- classification: candidate-contract-valid-lower-scope
- recommended_next_lane: runtime-model-mode-smoke-approval
- provider_calls_delta: -3
- excerpts_delta: -6
- claims_delta: -8
- account_objects_delta: -13
- input_tokens_delta: -4883
- output_tokens_delta: -3703
- observed_cost_usd_delta: 0

Reasons:

- both sides are completed sanitized contract-valid product-preview records
- candidate has lower provider-call scope, so this is not a full model quality comparison
- result does not select a default model, lock in a provider, or approve production use

## Interpretation

GPT-5.5 remains contract-valid on the current public sanitized product-preview surface: one single-slot retry and one three-slot tiny expansion completed under the model-only harness and passed the v2 public contract. The tiny expansion is not scope-equivalent to the historical six-slot Owl Alpha baseline, so this document must not claim GPT-5.5 is better or select it as default.

The comparison is still useful because it shows the candidate path is stable enough to move to provider-neutral runtime/model-mode smoke validation with a very small cap. The next lane should test runtime boundary plumbing, not broaden corpus size or make a product-readiness claim.

## Safety markers

- provider_call_during_comparison: false
- provider_spend_during_comparison: false
- raw_private_evidence_read: false
- network_access: false
- graph_ingestion: false
- production_writes: false
- runtime_model_mode_integration_performed: false
- authorizes_provider_call: false
- authorizes_default_model_selection: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
