# Runtime Model-Only Product-Preview Tiny Expansion Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

Input assessment: `runtime-model-only-product-preview-retry-usefulness-assessment.md`.
Options packet: `runtime-model-only-product-preview-next-validation-options.md`.
Prior retry status: `runtime-model-only-product-preview-retry-status.md`.

This packet approves exactly one future tiny product-preview expansion slice in lane 3A. It does not approve lanes 3B or 3C execution beyond no-spend planning and tests.

No execution may occur in this approval PR. The execution and sanitized status must be a separate later step.

## Preconditions

- retry_status_completed: true
- retry_v2_contract_validated: true
- retry_accepted_output_received: true
- retry_usefulness_assessment_classification: useful_transport_contract_signal
- next_validation_options_recorded: true
- recommended_next_lane: 3A_product_preview_expansion

## Approved future tiny expansion

- max_attempts: 1
- max_provider_calls: 3
- approved_max_cost_usd: 3
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_surface: app-owned-model-only-harness
- corpus_ref: product-preview/tiny-screened-three-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 3
- required_slot_roles: representative, edge-case, calibration

## Runtime boundary

- tools: false
- web_search: false
- plugins: false
- mcp: false
- shell: false
- file_access: false
- retrieval: false
- production_writes: false
- graph_ingestion: false

The future tiny expansion must use the app-owned model-only harness boundary. It must not use Hermes as a product runtime, must not use an autonomous agent surface, and must not bypass the harness.

## Screening and stop rules

- private_source_screening_required_before_each_call: true
- stop_instead_of_substitute_if_slot_fails_screening: true
- no_paid_fallback: true
- no_retry_beyond_approved_call_count: true
- no_prompt_or_corpus_change_without_new_approval: true

If fewer than all three slots pass private screening, the run must stop before provider access for the failed slot and the later status must record sanitized blocked facts only.

## Authorization state

- authorizes_tiny_product_preview_expansion: true
- authorizes_provider_call: true
- authorizes_retry_after_this_attempt: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

## Evidence and status requirements

- status_followup_required: true
- raw_or_model_output_must_remain_private: true

The later status follow-up must record whether the approved tiny expansion completed, blocked, or failed. It must record only sanitized aggregate and per-slot role facts and must not commit raw account text, prompts, requests, responses, model output, provider bodies, credential material, stack traces, private evidence details, endpoint details, or client handles.

If the future tiny expansion blocks or fails, no additional retry is authorized by this packet.

## Non-claims

This approval packet does not claim:

- product readiness
- production readiness
- launch readiness
- default model selection
- provider comparison
- provider lock-in
- graph ingestion readiness
- background orchestrator readiness

A completed future tiny expansion would be a bounded historical product-preview signal only. Any further retry, broader expansion, provider comparison, default selection, graph ingestion, production use, or background orchestration decision would require a separate approval packet.
