# Live provider proof verifier and lab runtime harness status

Status: completed verifier, out-of-repo CLI, lab harness, and validate-without-ingest conversion slice

## Status metadata

- status_id: live-provider-proof-verifier-runtime-harness-20260605e
- predecessor_assessment: runtime-model-only-live-provider-moderate-proof-assessment-20260605d
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- scope: implementation contracts for steps 2 through 5

## Implemented contracts

- deterministic_verifier_module: true
- synthetic_fixture_corpus_added: true
- out_of_repo_verifier_cli_added: true
- lab_test_only_runtime_model_execution_harness_added: true
- validate_without_ingest_graphbundle_conversion_added: true

## Files

- verifier_module: src/validation/live-provider-moderate-proof-verifier.ts
- verifier_tests: tests/validation/live-provider-moderate-proof-verifier.test.ts
- cli: src/cli/live-provider-proof.ts
- cli_tests: tests/cli/live-provider-proof-cli.test.ts
- harness_tests: tests/validation/lab-runtime-model-proof-harness.test.ts
- fixture: tests/fixtures/live-provider-proof/moderate-valid.json

## Verification

- command: `npx tsx --test tests/validation/live-provider-moderate-proof-verifier.test.ts tests/cli/live-provider-proof-cli.test.ts tests/validation/lab-runtime-model-proof-harness.test.ts`
- command_result: pass
- tests_passed: 8
- typecheck_result: pass

## Safety boundaries

- default_test_mode_provider_calls: 0
- committed_fixture_is_synthetic: true
- raw_provider_output_committed: false
- provider_payload_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false
- graph_ingestion_performed: false
- production_writes_performed: false
- default_model_selection_claim: false
- provider_comparison_claim: false
- provider_quality_conclusion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

## CLI boundary

The CLI accepts only explicit out-of-repo input and output paths. It rejects repository input paths and repository output paths, writes sanitized summaries only, and does not print raw proof bodies on validation failure.

## Runtime harness boundary

The runtime harness is lab/test only. It requires an explicit selected route, approval, cost ledger input, credential readiness signal, and an injected provider. It blocks before provider invocation when preflight fails, and successful reports still mark graph ingestion and production writes as false.

## Graph conversion boundary

The GraphBundle conversion produces a candidate bundle and lens outputs for validation only. It does not write graph records, does not ingest into a store, and does not create product readiness or default-model claims.

## Follow-up authorization markers

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

- provider_call_requires_new_approval: true
- retry_requires_new_approval: true

## Separate live-attempt approval

A separate pre-run approval packet, `runtime-model-only-lab-runtime-live-proof-approval-packet.md`, authorizes exactly one future tiny synthetic lab runtime/model-mode proof attempt through this harness, to be executed in a later execution/status PR. This status document is not itself an authorizer: its markers above remain unchanged, `authorizes_future_runtime_model_mode_execution: false` still holds for this doc, and any provider call still requires that separate merged approval packet.
