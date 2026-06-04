# Runtime Model-Only Product-Preview Runtime Smoke Status

Status: exception for one approved runtime/model-mode smoke.

Approval packet: `runtime-model-only-product-preview-runtime-smoke-approval-packet.md`.
Input decision: `runtime-model-only-product-preview-post-comparison-decision.md`.
Input hardening: `runtime-model-only-product-preview-runtime-hardening.md`.

The runtime smoke approval has now been consumed by this attempt. No additional retry is authorized by this status.

- approval_consumed: true
- retry_requires_new_approval: true

## Required dry-run planner result

The required pre-execution dry-run planner was run before provider access.

- planner_dry_run: true
- planner_provider_calls_executed: 0
- planner_provider_spend_authorized_by_plan: false
- planner_raw_private_evidence_read: false
- planner_network_access_performed: false
- planner_authorizes_provider_call: false

## Sanitized execution facts

- job_id: product-preview-runtime-smoke-20260604d
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/runtime-smoke-single-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 1
- slot_role: calibration
- status: exception
- reason_code: model_only_product_preview_runtime_smoke_exception
- stable_error_code: v2_contract_account_object_type_invalid
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- approved_max_provider_calls: 1
- accepted_output_received: false
- v2_contract_validated: false
- status_renderer_used: true
- v2_excerpts: 0
- v2_claims: 0
- v2_account_objects: 0
- input_tokens_observed: 382
- output_tokens_observed: 452
- approved_max_cost_usd: 1
- observed_cost_usd: 0

## Sanitized per-slot facts

| role | status | provider calls | accepted output | v2 contract | excerpts | claims | account objects | input tokens | output tokens |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| calibration | exception | 1 | false | false | 0 | 0 | 0 | 382 | 452 |

The app-owned model-only runtime smoke attempted exactly one approved calibration slot. The provider request was attempted once, then stopped. The stream produced usage accounting, but the public v2 contract was not accepted because sanitized validation failed with the stable public code above. This status records only sanitized counts, stable status codes, role labels, and boundary facts.

## Sanitized status renderer check

A public-safe projection of the status was validated and rendered through the sanitized product-preview status helper.

Rendered helper excerpt:

```text
# Sanitized Product-Preview Status: runtime-model-only-product-preview-runtime-smoke-20260604d

- status: exception
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/runtime-smoke-single-slot-v1
- provider_calls_executed: 1
- approved_max_provider_calls: 1
- accepted_output_received: false
- v2_contract_validated: false
- v2_excerpts: 0
- v2_claims: 0
- v2_account_objects: 0
- observed_cost_usd: 0
- approved_max_cost_usd: 1
```

## Authorization state after execution

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

## Evidence handling

- raw_request_committed: false
- raw_response_committed: false
- raw_screened_account_text_committed: false
- model_output_committed: false
- provider_body_committed: false
- credential_material_committed: false
- private_evidence_committed: false
- wrapper_logs_committed: false
- prompt_material_committed: false
- local_paths_committed: false
- usefulness_evaluated: false
- graph_ingestion_performed: false
- provider_comparison_performed: false
- production_writes: false

Only sanitized facts are recorded here. Raw prompt material, screened account text, request bodies, response bodies, provider bodies, credential material, local evidence details, model output text, wrapper logs, and client handles remain outside the repository.

## Non-claims

This status does not claim:

- product readiness
- production readiness
- launch readiness
- default model selection
- provider comparison
- provider lock-in
- graph ingestion readiness
- background orchestrator readiness

An exception status is still useful boundary evidence: the approved runtime/model-mode smoke consumed exactly one call, preserved the no-retry rule, and exposed a public contract-validation blocker without committing raw or private material. Any retry, broader product-preview expansion, provider comparison, default selection, graph ingestion, production use, or background orchestration decision requires a separate approval packet.
