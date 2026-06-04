# Runtime Model-Only Product-Preview Runtime Smoke Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

Input decision: `runtime-model-only-product-preview-post-comparison-decision.md`.
Input hardening: `runtime-model-only-product-preview-runtime-hardening.md`.
Input comparison: `runtime-model-only-product-preview-sanitized-provider-comparison.md`.

## Approval scope

- approval_id: runtime-model-only-product-preview-runtime-smoke-20260604d
- approval_kind: one_call_single_slot_runtime_model_mode_smoke
- max_attempts: 1
- max_provider_calls: 1
- approved_max_cost_usd: 1
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/runtime-smoke-single-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- slot_role: calibration
- runtime_mode: model-only-smoke

This approval is for exactly one future runtime/model-mode smoke call. It is not a corpus expansion, not graph ingestion, not provider comparison execution, not production use, and not a default-model selection.

## Required pre-execution dry-run planning

The executor must run a no-provider-call planner before the live smoke:

```sh
npm run product-preview:plan -- \
  --job-id product-preview-runtime-smoke-20260604d \
  --approval-ref docs/runbooks/runtime-model-only-product-preview-runtime-smoke-approval-packet.md \
  --route-ref gpt-5.5-openai-codex-20260602a \
  --provider-ref openai-codex \
  --model-label gpt-5.5 \
  --transport-kind model-only-codex-auth \
  --corpus-ref product-preview/runtime-smoke-single-slot-v1 \
  --prompt-contract-ref prompts/product-preview-model-only-v1 \
  --max-provider-calls 1 \
  --max-cost-usd 1 \
  --slot-roles calibration \
  --runtime-mode model-only-smoke
```

The planner must report:

- dry_run: true
- provider_calls_executed: 0
- provider_spend_authorized_by_plan: false
- raw_private_evidence_read: false
- network_access_performed: false
- authorizes_provider_call: false

If planner validation fails, stop before provider access and record a sanitized blocked status. Do not substitute a manual run.

## Runtime smoke requirements

The future execution must:

- use the app-owned model-only harness path
- use exactly one screened calibration slot
- invoke transport at most once
- request no tools, web search, plugins, MCP, shell, file access, retrieval, or session carryover
- keep raw prompt, screened account text, request, response, provider body, credential material, local paths, and model output text outside the repo
- validate the output through the v2 public contract
- render sanitized public status through the status helper or equivalent exact fields
- record whether the status renderer was used
- stop after one provider request even if the output contract fails

## Disallowed scope

- max_attempts_greater_than_1: false
- max_provider_calls_greater_than_1: false
- paid_fallback_allowed: false
- retry_allowed_without_new_approval: false
- additional_slots_allowed: false
- live_expansion_allowed: false
- provider_comparison_execution_allowed: false
- default_model_selection_allowed: false
- graph_ingestion_allowed: false
- workshop_runtime_render_allowed: false
- background_orchestrator_allowed: false
- production_writes_allowed: false
- tools_allowed: false
- web_search_allowed: false
- plugins_allowed: false
- mcp_allowed: false
- shell_allowed: false
- file_access_allowed: false
- retrieval_allowed: false
- session_carryover_allowed: false

## Post-execution status requirements

A later status PR must record only sanitized public facts:

- status: completed, blocked, or exception
- stable public reason_code and stable_error_code
- approval_consumed: true if a provider request is attempted
- retry_requires_new_approval: true
- provider_calls_executed
- transport_calls_observed_by_runner
- accepted_output_received
- v2_contract_validated
- status_renderer_used
- input_tokens_observed
- output_tokens_observed
- approved_max_cost_usd
- observed_cost_usd
- all boundary false markers

No raw/model/private evidence may be committed in the later status PR.

## Current authorization state

- authorizes_provider_call: true
- authorizes_provider_call_count: 1
- authorizes_retry: false
- authorizes_live_expansion: false
- authorizes_provider_comparison_execution: false
- authorizes_default_model_selection: false
- authorizes_graph_ingestion: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

This packet authorizes exactly one future provider request under the runtime smoke scope above. It does not execute that request. Execution and sanitized status must happen later.
