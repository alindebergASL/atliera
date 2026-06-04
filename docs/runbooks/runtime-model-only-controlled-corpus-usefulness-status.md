# Runtime Model-Only Controlled-Corpus Usefulness Status

Status: no-spend usefulness assessment over the sanitized controlled-corpus run facts.

Source status: `runtime-model-only-controlled-corpus-status.md`.

This assessment uses only sanitized facts derived from the completed controlled-corpus status and a private structural inspection that was reduced to public-safe counts and support flags. It does not read raw provider output in repository code, does not commit raw provider output, and does not execute a provider call.

## Assessment envelope

- assessment_kind: deterministic_no_spend_usefulness
- provider_calls_executed_by_assessment: 0
- provider_spend_by_assessment: false
- production_writes_by_assessment: false
- runtime_model_mode_integration_by_assessment: false
- source_status: docs/runbooks/runtime-model-only-controlled-corpus-status.md
- source_run_status: completed
- source_provider_calls_executed: 1
- source_approval_consumed: true

## Sanitized assessment result

- status: fail
- overall_classification: unsupported/invented
- total_accounts: 3
- useful_accounts: 2
- weak_but_valid_accounts: 0
- zero_output_accounts: 0
- unsupported_or_invented_accounts: 1
- contract_failure_accounts: 0
- representative: 1
- edge-case: 1
- calibration: 1

## Sanitized slot facts

- acct-representative:
  - role: representative
  - excerpts: 3
  - claims: 2
  - account_objects: 1
  - classification: unsupported/invented
  - reason: representative slot had a provenance-support gap and entity-label split between evidence-bearing excerpts/claims and the account-object label.
- acct-edge-case:
  - role: edge-case
  - excerpts: 3
  - claims: 1
  - account_objects: 1
  - classification: useful
- acct-calibration:
  - role: calibration
  - excerpts: 3
  - claims: 2
  - account_objects: 1
  - classification: useful

## Interpretation

The controlled-corpus harness and transport path completed, but the sanitized usefulness assessment fails because the representative slot had a provenance-support gap. This is a useful negative result: the next step should not be product-preview execution, provider comparison, default model selection, background orchestrator enablement, graph ingestion, or production use.

The next step: no-spend diagnosis/remediation. That follow-up should determine whether the gap is best handled by prompt contract clarification, account-label normalization, support-link validation, or stricter proposal-to-graph mapping before any new provider call is approved.

- product-preview approval recommended: false
- provider comparison recommended: false
- default model selection recommended: false
- background orchestrator enablement recommended: false
- graph ingestion recommended: false
- production use recommended: false

## Private evidence policy

The repository does not contain and must not contain:

- raw controlled account text
- raw prompt text
- raw provider request
- raw provider response
- raw model output
- provider bodies
- headers
- credentials
- stack traces
- private evidence paths

Only the public-safe classification, aggregate counts, and support-gap category are recorded here.

## Non-authorizing markers

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
