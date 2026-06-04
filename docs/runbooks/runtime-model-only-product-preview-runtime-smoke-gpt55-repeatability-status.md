# Runtime Model-Only Product-Preview Runtime Smoke GPT-5.5 Repeatability Status

Status: completed for the approved GPT-5.5 six-slot runtime/model-mode repeatability attempt.

Approval packet: `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-approval-packet.md`.
Source status: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status.md`.
Source assessment: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment.md`.
Follow-up interpretation: `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md` records a later deterministic no-spend repeatability assessment. The `usefulness_evaluated: false` marker below remains a historical marker for this execution-status record.

The GPT-5.5 repeatability approval has now been consumed by this attempt. No retry or additional provider call is authorized by this status.

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

- job_id: product-preview-runtime-smoke-six-slot-gpt55-repeatability-20260604h
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_surface: app-owned-model-only-harness
- corpus_ref: product-preview/runtime-smoke-six-slot-screened-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1-runtime-smoke-v2-type-remediation
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- remediation_helper_ref: src/product-preview/runtime-smoke-v2-remediation.ts
- screened_account_slots: 6
- required_slot_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control
- completed_slot_count: 6
- private_source_screening_passed: true
- status: completed
- reason_code: model_only_product_preview_runtime_smoke_gpt55_repeatability_completed
- stable_error_code: none
- provider_calls_executed: 6
- transport_calls_observed_by_runner: 6
- approved_max_provider_calls: 6
- accepted_output_received: true
- v2_contract_validated: true
- runtime_smoke_v2_type_remediation_applied: true
- runtime_smoke_v2_type_remediation_changes: 0
- v2_excerpts: 30
- v2_claims: 19
- v2_account_objects: 33
- input_tokens_observed: 3174
- output_tokens_observed: 4672
- approved_max_cost_usd: 6
- observed_cost_usd: 0

## Sanitized per-slot facts

| role | status | provider calls | accepted output | v2 contract | remediation changes | excerpts | claims | account objects | input tokens | output tokens |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| representative-a | completed | 1 | true | true | 0 | 5 | 3 | 5 | 531 | 720 |
| representative-b | completed | 1 | true | true | 0 | 5 | 4 | 6 | 534 | 854 |
| edge-case-a | completed | 1 | true | true | 0 | 5 | 3 | 6 | 527 | 785 |
| edge-case-b | completed | 1 | true | true | 0 | 5 | 3 | 6 | 530 | 829 |
| calibration | completed | 1 | true | true | 0 | 5 | 3 | 5 | 518 | 717 |
| sparse-control | completed | 1 | true | true | 0 | 5 | 3 | 5 | 534 | 767 |

The app-owned model-only harness attempted exactly the six approved role slots. Each slot had private source screening before provider access, each slot used exactly one transport call, and the runner stopped after the approved role set. This status records only sanitized counts, stable status codes, role labels, and boundary facts.

The sparse-control slot completed as a bounded historical observation only. It is not evidence that sparse accounts are broadly useful or product-ready.

## Sanitized object and support counts

- object_type_account_snapshot: 6
- object_type_signal: 6
- object_type_risk: 6
- object_type_play: 5
- object_type_map: 6
- object_type_open_question: 4
- object_type_stakeholder: 0
- object_type_initiative: 0
- object_type_recommendation: 0
- object_type_relationship: 0
- object_type_milestone: 0
- excerpt_text_presence_count: 30
- claim_text_presence_count: 19
- claim_supported_count: 19
- account_object_summary_presence_count: 33
- account_object_supported_count: 33

## Repeatability interpretation

This is a bounded historical repeatability signal: a second approved six-slot GPT-5.5 runtime/model-mode smoke completed under the same model-only route, role labels, v2 contract, and no-tools/no-search/no-production/no-graph-ingestion boundary.

The repeatability attempt produced accepted v2-valid output for all six approved role labels, with no remediation changes and no observed cost. It should be interpreted only as a repeatability signal for this narrow runtime/model-mode smoke path.

This is not a launch-readiness, product-readiness, production-readiness, broad model-quality, sparse-account-readiness, provider-lock-in, default-model-selection, graph-ingestion-readiness, or runtime-integration claim.

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

## Runtime boundary

- tools: false
- web_search: false
- online_model_variant: false
- plugins: false
- mcp: false
- shell: false
- file_access: false
- retrieval: false
- session_carryover: false
- background_orchestrator: false
- production_writes: false
- graph_ingestion_performed: false
- provider_comparison_performed: false

## Evidence handling

- raw_request_committed: false
- raw_response_committed: false
- raw_screened_account_text_committed: false
- model_output_committed: false
- provider_body_committed: false
- credential_material_committed: false
- private_evidence_committed: false
- private_paths_committed: false
- provider_metadata_committed: false
- account_identifiers_committed: false
- wrapper_logs_committed: false
- prompt_material_committed: false
- local_paths_committed: false
- usefulness_evaluated: false

Only sanitized facts are recorded here. Raw prompt material, screened source text, request bodies, response bodies, provider bodies, credential material, local evidence details, model output text, wrapper logs, client handles, request identifiers, account identifiers, and provider metadata remain outside the repository.

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
- broader expansion readiness
- broad model quality
- sparse-account readiness

A completed repeatability attempt is a bounded historical product-preview runtime-smoke signal only. It does not approve another provider call, retry, broader product-preview expansion, provider comparison, default model selection, graph ingestion, production use, or background orchestration. The next decision gate is a separate deterministic no-spend repeatability usefulness/interpretation assessment over these sanitized facts.
