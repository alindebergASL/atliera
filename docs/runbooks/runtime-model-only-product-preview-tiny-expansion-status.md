# Runtime Model-Only Product-Preview Tiny Expansion Status

Status: completed for one approved tiny model-only product-preview expansion.

Approval packet: `runtime-model-only-product-preview-tiny-expansion-approval-packet.md`.
Input options packet: `runtime-model-only-product-preview-next-validation-options.md`.
Input retry usefulness assessment: `runtime-model-only-product-preview-retry-usefulness-assessment.md`.

The tiny-expansion approval has now been consumed by this attempt. No additional retry is authorized by this status.

- approval_consumed: true
- retry_requires_new_approval: true

## Sanitized execution facts

- job_id: product-preview-tiny-expansion-20260604c
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: product-preview/tiny-screened-three-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 3
- completed_slot_count: 3
- required_slot_roles_completed: representative, edge-case, calibration
- status: completed
- reason_code: model_only_product_preview_tiny_expansion_completed
- stable_error_code: none
- provider_calls_executed: 3
- transport_calls_observed_by_runner: 3
- approved_max_provider_calls: 3
- accepted_output_received: true
- v2_contract_validated: true
- v2_excerpts: 12
- v2_claims: 10
- v2_account_objects: 5
- input_tokens_observed: 1075
- output_tokens_observed: 1614
- approved_max_cost_usd: 3
- observed_cost_usd: 0

## Sanitized per-slot facts

| role | status | provider calls | excerpts | claims | account objects | input tokens | output tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| representative | completed | 1 | 4 | 3 | 1 | 358 | 555 |
| edge-case | completed | 1 | 4 | 4 | 3 | 360 | 581 |
| calibration | completed | 1 | 4 | 3 | 1 | 357 | 478 |

The app-owned model-only harness executed exactly one approved tiny expansion. All three screened slots completed, accepted output was received, and each slot satisfied the controlled-corpus v2 public contract shape. This status records only sanitized counts, role labels, and boundary facts.

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
- private_evidence_committed: false
- usefulness_evaluated: false
- graph_ingestion_performed: false
- provider_comparison_performed: false

Only sanitized facts are recorded here. Raw prompt material, screened account text, account identifiers beyond public-safe role labels, local transport details, request bodies, response bodies, provider bodies, credential material, private evidence details, model output text, and client handles remain outside the repository.

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

A completed tiny expansion is a bounded historical product-preview transport and contract signal only. Any usefulness evaluation, further retry, broader expansion, comparison, default selection, graph ingestion, production use, or background orchestration decision requires a separate approval packet.
