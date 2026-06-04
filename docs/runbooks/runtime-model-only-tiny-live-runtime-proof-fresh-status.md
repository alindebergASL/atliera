# Runtime Model-Only Tiny Live Runtime Proof Fresh Status

Status: exception.

This status records the single future attempt approved by `runtime-model-only-tiny-live-runtime-proof-fresh-approval-packet.md`, merged after the no-spend transport remediation status. The approval was consumed by one provider call. The attempt did not return accepted contract output and no retry was attempted.

## Sanitized outcome

- approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k
- approval_consumed: true
- approved_future_attempts: 1
- attempts_executed: 1
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/tiny-live-runtime-proof-v1
- prompt_contract_ref: prompts/tiny-live-runtime-proof-model-only-v1
- status: exception
- reason_code: tiny_live_runtime_proof_exception
- stable_error_code: provider_call_or_v2_contract_failed
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- provider_spend: false
- observed_cost_usd: 0
- input_tokens_observed: 0
- output_tokens_observed: 0
- accepted_output_received: false
- v2_contract_validated: false
- status_renderer_used: false

## Output counts

- excerpts: 0
- claims: 0
- account_objects: 0

## Slot status

- slot_role: calibration
- slot_status: exception
- slot_provider_calls_executed: 1
- slot_accepted_output_received: false
- slot_v2_contract_validated: false
- slot_output_counts: excerpts 0, claims 0, account_objects 0

## Boundary markers

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_runtime_model_mode_execution: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_default_model_selection: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- graph_ingestion_performed: false
- production_writes: false
- default_model_selection_claim: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true

## Interpretation

The fresh approval succeeded in reaching the model-only transport path exactly once, but it did not produce accepted public contract output. This is not product evidence and does not select a default model or prove readiness.

The useful engineering signal is narrower: the earlier local runtime blocker was cleared, the approved call boundary was consumed exactly once, and the status failed closed without retry, comparison, expansion, production write, tools, search, plugins, retrieval, or readiness claims.

Any future provider attempt requires a new approval packet. The next non-provider step is to review the deterministic Workshop product slice and decide whether the current product surface is worth further live-proof work.
