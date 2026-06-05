# Runtime model-only live provider moderate proof status

Status: completed approved live provider structured-generation proof

## Status metadata

- status_id: runtime-model-only-live-provider-moderate-proof-20260605c
- created_at: 2026-06-05T00:00:00.000Z
- branch: docs/live-provider-moderate-proof-status
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- provider_path: hermes-openai-codex-operator
- source_scope: synthetic-only
- user_approval_scope: live provider proof approved in current operator chat

## What ran

A live Codex-authenticated GPT-5.5 provider proof was run against a synthetic-only moderate graph-generation prompt for three synthetic accounts. The output was required to be strict JSON under an output schema and was validated out of repo before this status was written.

This was not a production Atliera runtime execution and not graph ingestion. It was a structured generation proof for a replaceable model route.

## Execution results

- codex_exit_code: 0
- provider_api_requests_attempted: 2
- failed_schema_request_count: 1
- successful_structured_generations: 1
- provider_calls_executed: 1
- observed_cost_usd: 0
- provider_spend: false
- tokens_used_total: 10158
- elapsed_seconds: 25.36

The first attempt failed before structured generation because the response schema used `const` fields without explicit `type` keys. The schema was corrected and the second attempt completed successfully.

## Output validation summary

- strict_json_ok: true
- schema_version_ok: true
- source_scope_ok: true
- accounts_observed: 3
- excerpts_observed: 6
- claims_observed: 6
- account_objects_observed: 9
- citation_links_ok: true
- per_account_lens_coverage_ok: true
- boundary_flags_ok: true
- validation_errors_count: 0

## Boundary markers

- atliera_runtime_executed: false
- runtime_model_mode_execution: false
- runtime_model_mode_integration: false
- graph_ingestion_performed: false
- production_writes_performed: false
- provider_payload_committed: false
- model_output_committed: false
- raw_evidence_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false

## Claims explicitly not made

- provider_quality_conclusion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- default_model_selection_claim: false
- provider_comparison_claim: false
- provider_lock_in: false

## Future-action authorization markers

- authorizes_retry: false
- authorizes_future_runtime_model_mode_execution: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_default_model_selection: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false

## Repository safety interpretation

This status may be used as evidence that the GPT-5.5 route can produce a schema-constrained synthetic graph-shaped response under the Codex-authenticated operator path. It must not be used as evidence that Atliera production runtime model mode is wired, that graph ingestion is safe, that this model is the default, or that future provider calls/retries are authorized.

- provider_call_requires_new_approval: true
- retry_requires_new_approval: true
