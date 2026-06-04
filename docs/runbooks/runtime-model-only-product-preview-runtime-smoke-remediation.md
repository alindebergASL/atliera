# Runtime Model-Only Product-Preview Runtime Smoke Remediation

Status: no-spend runtime/model-mode smoke remediation.

Source status: `runtime-model-only-product-preview-runtime-smoke-status.md`.
Source approval packet: `runtime-model-only-product-preview-runtime-smoke-approval-packet.md`.

This remediation does not execute or approve a provider call. It records a deterministic prompt-and-validator cleanup after the consumed runtime/model-mode smoke ended as a sanitized exception.

## Source blocker

- source_status: exception
- stable_error_code: v2_contract_account_object_type_invalid
- observed_blocker_class: recoverable_account_object_type_label
- provider_calls_executed_during_remediation: 0
- provider_spend_during_remediation: false
- network_access_during_remediation: false
- raw_or_model_output_committed: false
- private_evidence_committed: false

The sanitized status showed the single approved runtime smoke was consumed and stopped after one provider request. The no-spend inspection classified the blocker as a type-label mismatch: the observed account object used `product_preview_runtime_smoke_summary`, which is not a valid public v2 output type for the retry prompt contract.

## Remediation applied

- prompt_contract_amended: true
- validator_mapping_added: true
- canonical_normalization: account_snapshot
- normalized_observed_type: product_preview_runtime_smoke_summary

The retry prompt amendment must require this exact type vocabulary:

Allowed account_object.type values: account_snapshot, signal, risk, play, map, relationship, milestone, recommendation, stakeholder, initiative, open_question.

The amendment also states that `product_preview_runtime_smoke_summary` is not a valid output type; when the model needs a whole-account summary it must use `account_snapshot`.

The deterministic no-spend validator mapping is intentionally narrow. It maps only the observed recoverable label to `account_snapshot` and rejects other unknown type labels rather than silently accepting provider-specific taxonomy drift.

## Verification requirements before any retry approval

- no provider call while applying this remediation
- deterministic tests for the observed recoverable type label
- deterministic tests rejecting unknown type labels
- deterministic tests proving the prompt amendment lists only canonical public-safe type labels
- sanitized docs/tests only
- no graph ingestion
- no provider comparison
- no default model selection
- no production write
- no background orchestrator bypass

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_runtime_model_mode_smoke_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_graph_ingestion: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_separate_approval_packet: true

This remediation is only a no-spend prerequisite cleanup. A corrected runtime/model-mode smoke retry still requires a separate docs/tests-only approval packet, an approval-specific dry-run planner, exactly one future provider request at most, and a later sanitized status PR.
