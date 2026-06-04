# Runtime Model-Only Product-Preview Post-Comparison Decision Packet

Status: docs-only decision packet. This document does not execute or approve a provider call.

Inputs:

- `runtime-model-only-product-preview-sanitized-provider-comparison.md`
- `runtime-model-only-product-preview-runtime-hardening.md`
- `runtime-model-only-product-preview-tiny-expansion-status.md`
- `runtime-model-only-product-preview-tiny-expansion-usefulness-assessment.md`

## Decision

- decision_id: runtime-model-only-product-preview-post-comparison-20260604d
- selected_next_lane: runtime-model-mode-smoke-approval
- selected_scope: one_call_single_slot_runtime_model_mode_smoke
- selected_reason: GPT-5.5 has completed the tiny contract-valid product-preview expansion, but the sanitized provider comparison is lower-scope than the six-slot Owl Alpha baseline; the next highest-value live slice should test runtime boundary plumbing, not broader corpus quality.

## Rejected lanes for now

### Another live expansion

- decision: not_selected_now
- reason: live expansion should wait until runtime status rendering/planning is exercised in a smoke path and the no-spend comparison is reviewed.

### Graph ingestion

- decision: not_selected_now
- reason: graph ingestion should remain behind a separate approval after runtime/model-mode smoke facts exist.

### Background orchestrator

- decision: not_selected_now
- reason: background orchestration is higher blast-radius and should not bypass the runtime boundary review.

### Default model selection

- decision: not_selected
- reason: the comparison is a bounded sanitized signal, not a model-quality conclusion or production default selection.

## Required approval packet shape

If approved in a separate PR, the next live slice should be bounded to:

- max_attempts: 1
- max_provider_calls: 1
- approved_max_cost_usd: 1
- corpus_ref: product-preview/runtime-smoke-single-slot-v1
- slot_role: calibration
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_mode: model-only-smoke
- planner_required_before_execution: true
- status_renderer_required_after_execution: true

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_live_expansion: false
- authorizes_provider_comparison_execution: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_graph_ingestion: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

This decision packet chooses the next lane but does not authorize execution. A separate docs/tests-only approval packet is required before any provider request.
