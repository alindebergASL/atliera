# Runtime Model-Only Product-Preview Retry Usefulness Assessment

Status: no-spend usefulness assessment over the sanitized retry status. This document does not execute or approve a provider call.

Source status: `runtime-model-only-product-preview-retry-status.md`.
Retry approval packet: `runtime-model-only-product-preview-retry-approval-packet.md`.

## Input boundary

This assessment consumes only already-public sanitized facts from the retry status:

- job_id: product-preview-retry-20260604b
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
- observed_cost_usd: 0
- usefulness_evaluated_in_execution_status: false

This assessment does not read raw prompts, screened account text, raw provider responses, model output text, private evidence, or provider client details.

## Assessment result

- assessment_id: product-preview-retry-usefulness-20260604b
- assessment_mode: deterministic_no_spend_sanitized_facts_only
- classification: useful_transport_contract_signal
- status: pass
- provider_calls_executed_during_assessment: 0
- provider_spend_during_assessment: false
- network_access_during_assessment: false
- raw_or_model_output_read: false
- private_evidence_read: false

The retry is useful as a bounded transport and public-contract signal because the app-owned model-only harness executed exactly one approved call, accepted output was received, the controlled-corpus v2 public contract validated, and the output counts exceeded the minimum single-slot contract shape.

This is not a full product-usefulness verdict. No graph ingestion, Workshop rendering, lens usefulness, background orchestration, or production-readiness path was evaluated in the retry status.

## Follow-up implications

- recommends_next_validation_options: true
- recommends_live_expansion_as_option: true
- recommends_no_spend_provider_comparison_as_option: true
- recommends_runtime_integration_hardening_as_option: true
- approves_provider_call: false
- approves_retry: false
- approves_expansion_or_comparison: false
- approves_graph_ingestion: false
- approves_background_orchestrator_bypass: false
- default_model_selection_claim: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

A later approval packet may use this useful transport-contract signal as one input, but this assessment does not itself authorize another provider call, corpus expansion, provider comparison, graph ingestion, production use, or runtime/background orchestration.
