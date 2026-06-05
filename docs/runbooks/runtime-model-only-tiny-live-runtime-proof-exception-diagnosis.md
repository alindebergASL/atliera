# Runtime Model-Only Tiny Live Runtime Proof Exception Diagnosis

Status: diagnosed.

This no-spend diagnosis follows `runtime-model-only-tiny-live-runtime-proof-fresh-status.md`. It inspected only already-captured private evidence from the consumed fresh attempt and did not execute another provider request.

## Scope

- diagnosed_status_ref: `runtime-model-only-tiny-live-runtime-proof-fresh-status.md`
- approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k
- previous_status: exception
- previous_provider_calls_executed: 1
- previous_retry_attempted: false
- diagnosis_provider_calls_executed: 0
- diagnosis_provider_spend: false
- diagnosis_observed_cost_usd: 0
- raw_private_evidence_committed: false
- provider_payload_committed: false
- model_text_committed: false
- credential_material_observed_or_committed: false

## Sanitized evidence classification

The private evidence supports this fail-closed diagnosis:

- request_shape_failure: false
- transport_parsing_failure: false
- streaming_event_handling_failure: false
- v2_contract_mismatch: true
- root_cause_bucket: prompt_contract_to_v2_allowlist_mismatch
- failing_contract_gate: account_object_type_allowlist
- stable_diagnosis_code: account_object_type_allowlist_mismatch

## Why this is the root cause

The approved call reached the model-only transport path and produced non-empty strict JSON with the expected top-level public contract keys. The stream collector produced parseable text rather than a stream failure or empty transport result.

The failure happened after JSON parsing, during v2 public contract validation. The validator reached the account-object type check and rejected an account object whose type value was outside the approved v2 allowlist. The committed status therefore correctly records `accepted_output_received: false` and `v2_contract_validated: false`, even though the provider request itself completed.

This was not diagnosed as a provider request-shape failure because the provider did not reject the request before output. It was not diagnosed as a transport parsing failure because strict JSON parsing succeeded. It was not diagnosed as a streaming-event handling failure because the captured output was non-empty and parseable.

## Remediation plan before any future approval

Before any future live retry approval packet is written, the no-spend remediation should tighten the pre-run contract and status taxonomy:

1. Enumerate the exact account-object type allowlist in the tiny-live proof prompt contract.
2. Require future pre-run evidence to prove that the prompt contract and validator allowlist are aligned.
3. Keep the future retry scope to the same route/provider/model family unless a separate decision deliberately changes it.
4. Preserve one-call-only, stop-on-exception, and no-retry discipline.
5. Preserve sanitized status-only reporting with no model text, provider payloads, provider-side diagnostic fields, private evidence locations, credential material, source text, account identifiers, or operator logs in the repository.
6. Use a more precise stable public error code for this category if it recurs: `account_object_type_allowlist_mismatch`.

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
- retry_requires_new_approval: true

## Interpretation

This is a useful engineering diagnosis, not product evidence. It says the previous local transport blocker is cleared, the fresh attempt reached a provider response path, and the remaining failure is a public contract alignment problem between the tiny-live prompt contract and the v2 account-object type allowlist.

Provider retry is not authorized by this diagnosis. The next safe step is a docs/tests-only remediation packet that aligns the prompt contract and validator expectations, followed only later by a separate fresh one-call approval if retrying still looks worthwhile.
