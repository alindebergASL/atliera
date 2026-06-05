# Runtime Model-Only Tiny Live Runtime Proof Contract Remediation

Status: no-spend prompt-contract remediation.

Source status: `runtime-model-only-tiny-live-runtime-proof-fresh-status.md`.
source_diagnosis: `runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md`

This remediation does not execute or approve a provider call. It records the sanitized prompt-contract and validator-alignment cleanup required after the consumed fresh tiny live runtime proof was diagnosed as an account-object type allowlist mismatch.

## Source blocker

- source_status: exception
- source_diagnosis_code: account_object_type_allowlist_mismatch
- source_root_cause_bucket: prompt_contract_to_v2_allowlist_mismatch
- source_failing_contract_gate: account_object_type_allowlist
- remediation_provider_calls_executed: 0
- remediation_provider_spend: false
- remediation_observed_cost_usd: 0
- network_access_during_remediation: false
- raw_or_model_output_committed: false
- private_evidence_committed: false
- provider_payload_committed: false
- model_text_committed: false

## Remediation applied

- prompt_contract_amended: true
- validator_allowlist_aligned: true
- validator_mapping_added: false
- canonical_account_object_type_allowlist: account_snapshot, signal, risk, play, map, relationship, milestone, recommendation, stakeholder, initiative, open_question
- stable_future_error_code: account_object_type_allowlist_mismatch

The prompt contract must instruct future attempts to use only the canonical allowlist above for every `account_object.type` value. The contract should not ask for prompt-specific, provider-specific, or smoke-specific type labels.

The validator allowlist remains the same canonical public v2 vocabulary. Unknown account-object type labels remain contract failures rather than being silently accepted or normalized, because this tiny-live proof is meant to validate the public contract rather than preserve provider-specific taxonomy drift.

This is a prompt-contract alignment remediation, not a mapping remediation. A future approval packet may cite this remediation as a prerequisite, but it must still define its own exact call count, budget, route, stop rules, private-evidence handling, and sanitized status requirements.

## Verification requirements before any future approval

- no provider call while applying this remediation
- no network access while applying this remediation
- deterministic safety tests for the canonical allowlist wording
- deterministic safety tests that no retry/provider authorization is added
- sanitized docs/tests only
- no model text or provider payload committed
- no graph ingestion
- no provider comparison
- no default model selection
- no production write
- no launch, product, or production readiness claim

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_runtime_model_mode_execution: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_default_model_selection: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- graph_ingestion_performed: false
- production_writes: false
- default_model_selection_claim: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_separate_approval_packet: true

## Interpretation

This remediation removes the known no-spend contract-alignment blocker before any later retry request. It does not make another provider attempt safe by itself and does not authorize runtime/model-mode execution.

A corrected tiny live runtime proof retry, if still worthwhile, must be requested in a separate docs/tests-only approval packet and must remain exactly bounded before any provider access occurs.
