# Runtime Model-Only Product-Preview Execution Status

Status: exception for one approved model-only product-preview attempt.

Approval packet: `runtime-model-only-product-preview-approval-packet.md`.

The approval has now been consumed by this attempt. No retry was performed.

- approval_consumed: true
- retry_requires_new_approval: true

## Sanitized execution facts

- job_id: product-preview-run-20260604a
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/single-screened-account-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 1
- status: exception
- reason_code: model_only_product_preview_transport_dependency_unavailable
- stable_error_code: private_transport_dependency_unavailable
- provider_api_requests_executed: 0
- transport_calls_observed_by_runner: 1
- harness_transport_invocation_counter: 1
- accepted_output_received: false
- v2_contract_validated: false
- approved_max_cost_usd: 1
- observed_cost_usd: 0

The private transport failed before provider API access because a local private transport dependency was unavailable in the invoked interpreter. The provider API was not reached. The approval is still treated as consumed because the approved execution path was attempted.

## Authorization state after execution

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

## Evidence handling

- raw_request_committed: false
- raw_response_committed: false
- raw_screened_account_text_committed: false
- model_output_committed: false
- private_evidence_committed: false
- usefulness_evaluated: false

Only sanitized facts are recorded here. Raw prompt material, screened account text, local transport details, stack traces, request bodies, response bodies, provider bodies, credential material, and private evidence details remain outside the repository.

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
