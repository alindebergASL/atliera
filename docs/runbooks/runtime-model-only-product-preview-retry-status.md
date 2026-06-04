# Runtime Model-Only Product-Preview Retry Status

Status: completed for one approved model-only product-preview retry.

Retry approval packet: `runtime-model-only-product-preview-retry-approval-packet.md`.
Prior consumed approval status: `runtime-model-only-product-preview-status.md`.
Transport remediation: `runtime-model-only-product-preview-transport-remediation.md`.

The retry approval has now been consumed by this attempt. No additional retry is authorized by this status.

- approval_consumed: true
- retry_requires_new_approval: true

## Sanitized execution facts

- job_id: product-preview-retry-20260604b
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/single-screened-account-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 1
- status: completed
- reason_code: model_only_product_preview_completed
- stable_error_code: none
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- accepted_output_received: true
- v2_contract_validated: true
- v2_excerpts: 4
- v2_claims: 3
- v2_account_objects: 1
- account_ref_count: 1
- input_tokens_observed: 352
- output_tokens_observed: 450
- approved_max_cost_usd: 1
- observed_cost_usd: 0

The app-owned model-only harness executed exactly one approved retry. The output satisfied the controlled-corpus v2 public contract shape for the single screened product-preview slot. This status records only sanitized counts and boundary facts.

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

Only sanitized facts are recorded here. Raw prompt material, screened account text, local transport details, request bodies, response bodies, provider bodies, credential material, private evidence details, model output text, and client handles remain outside the repository.

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

A completed retry is a bounded historical product-preview transport and contract signal only. Any usefulness evaluation, further retry, comparison, default selection, graph ingestion, production use, or background orchestration decision requires a separate approval packet.
