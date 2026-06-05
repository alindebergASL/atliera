# Runtime Model-Only Tiny Live Runtime Proof Remediated Approval Packet

Status: pre-run docs-only remediated approval packet. This PR does not execute a provider call. Later execution status is recorded in `runtime-model-only-tiny-live-runtime-proof-remediated-status.md`.

This packet is the historical approval surface after the consumed fresh tiny live runtime proof was diagnosed as `account_object_type_allowlist_mismatch` and after the no-spend prompt-contract remediation aligned the prompt contract to the canonical public v2 account-object type allowlist. It is now linked to a completed status follow-up; current authorization is recorded below as consumed with zero remaining provider calls.

No provider request was executed by the original approval PR. Execution and sanitized status happened later under the exact scope below and are recorded in `runtime-model-only-tiny-live-runtime-proof-remediated-status.md`.

## Prerequisites

- source_status: `runtime-model-only-tiny-live-runtime-proof-fresh-status.md`
- source_diagnosis: `runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md`
- source_remediation: `runtime-model-only-tiny-live-runtime-proof-contract-remediation.md`
- source_status_outcome: exception
- source_diagnosis_code: account_object_type_allowlist_mismatch
- source_failing_contract_gate: account_object_type_allowlist
- source_approval_consumed: true
- source_remaining_provider_calls_authorized: 0
- source_retry_requires_new_approval: true
- remediation_provider_calls_executed: 0
- remediation_provider_spend: false
- remediation_validator_allowlist_aligned: true
- remediation_prompt_contract_amended: true

The consumed source approval must not be reused. This packet replaced it only for the bounded suite that is now recorded as completed and consumed by `runtime-model-only-tiny-live-runtime-proof-remediated-status.md`.

## Historical approved remediated suite consumed by completed status

- approval_id: runtime-model-only-tiny-live-runtime-proof-remediated-20260605a
- approval_kind: three_slot_tiny_live_runtime_model_proof_remediated_suite
- max_attempts: 1
- max_provider_calls: 3
- approved_max_cost_usd: 3
- free_route_expected: true
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- route_kind: candidate
- corpus_ref: runtime-model-only/tiny-live-remediated-three-slot-v1
- corpus_scope: synthetic-or-approved-tiny-product-slice-only
- prompt_contract_ref: prompts/runtime-model-only-tiny-live-runtime-proof-v2-allowlist-remediated
- output_contract_ref: public runtime/model-mode v2 contract
- pre_run_transport_interpreter: pinned-hermes-uv-project
- runtime_mode: model-only-smoke
- test_slots: 3
- required_slot_roles: representative, edge-case, calibration
- per_slot_provider_calls: at most one provider call per slot
- no_retry_beyond_approved_three_slot_suite: true

This was a single three-slot suite, not an open-ended retry allowance. The approved calls tested the remediated v2 allowlist contract across a representative slot, an edge-case slot, and a calibration slot. The route was treated as a free testing route for this approval; the positive cost cap existed so the existing no-call planner could validate the packet, not because cost was the limiting factor. The completed status recorded provider_spend: false and observed_cost_usd: 0.

## Required canonical account-object type allowlist

Every prompt contract for this suite had to instruct the model to use only these values for every `account_object.type` field:

- account_snapshot
- signal
- risk
- play
- map
- relationship
- milestone
- recommendation
- stakeholder
- initiative
- open_question

Unknown, prompt-specific, provider-specific, smoke-specific, or product-slice-specific type labels remain v2 contract failures. This suite must validate the public contract instead of normalizing provider taxonomy drift.

## Historical pre-execution planner requirement

The executor was required to run the no-provider-call planner before any provider access:

```sh
npm run product-preview:plan -- \
  --job-id runtime-model-only-tiny-live-runtime-proof-remediated-20260605a \
  --approval-ref docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md \
  --route-ref gpt-5.5-openai-codex-repeatability-20260604h \
  --provider-ref openai-codex \
  --model-label gpt-5.5 \
  --transport-kind model-only-codex-auth \
  --corpus-ref runtime-model-only/tiny-live-remediated-three-slot-v1 \
  --prompt-contract-ref prompts/runtime-model-only-tiny-live-runtime-proof-v2-allowlist-remediated \
  --max-provider-calls 3 \
  --max-cost-usd 3 \
  --slot-roles representative,edge-case,calibration \
  --runtime-mode model-only-smoke
```

The planner must report:

- dry_run: true
- provider_calls_executed: 0
- provider_spend_authorized_by_plan: false
- raw_private_evidence_read: false
- network_access_performed: false
- authorizes_provider_call: false
- route_ref_matches_approval: true
- provider_ref_matches_approval: true
- model_label_matches_approval: true
- prompt_contract_contains_canonical_allowlist: true
- planned_max_provider_calls: 3
- planned_max_cost_usd: 3
- planned_slot_roles: representative, edge-case, calibration

If planner validation had failed, execution would have stopped before provider access and recorded a sanitized blocked status. The completed status records that the planner ran before provider access. No current authorization remains to substitute Hermes operator context, an autonomous agent surface, shell/curl execution, web retrieval, tools, plugins, a different model route, or a broader product-preview run.

## Historical screening and execution rules

- private_source_screening_required_before_each_slot: true
- stop_before_provider_access_if_preflight_fails: true
- stop_before_provider_access_if_route_is_not_expected_free_route: true
- stop_instead_of_substitute_if_slot_fails_screening: true
- replacement_slots_allowed_without_new_approval: false
- no_paid_fallback: true
- no_prompt_or_corpus_change_without_new_approval: true
- no_retry_beyond_approved_three_slot_suite: true
- status_followup_required: true

Each historical slot could execute at most one provider call after screening and preflight passed for that slot. The completed status records one provider call per slot. A failed or skipped slot did not authorize replacement slots, and no replacement slots were used.

If one slot returned an exception, the later executor could continue with remaining approved slots only if the route-level and safety preflights still passed and no paid fallback, tool/search/plugin/retrieval change, prompt change, model change, or private-evidence leak was involved. The completed status recorded no slot exceptions and no retry authorization.

## Original approval PR state

- current_pr_executes_provider_call: false
- provider_calls_executed_in_this_pr: 0
- provider_spend_in_this_pr: false
- provider_payload_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false
- adds_runtime_provider_call_source: false

## Historical authorization state after merge before completed status

- historical_future_execution_authorized_after_merge: true
- historical_future_authorized_test_slot_count: 3
- historical_future_authorized_provider_call_count: 3
- historical_future_authorized_attempt_count: 1
- historical_future_authorized_runtime_model_mode_suite: true
- historical_authorizes_retry_after_suite: false
- historical_retry_requires_new_approval_after_suite: true
- historical_authorizes_provider_comparison: false
- historical_authorizes_default_model_selection: false
- historical_authorizes_product_preview_expansion: false
- historical_authorizes_tools: false
- historical_authorizes_web_search: false
- historical_authorizes_plugins: false
- historical_authorizes_retrieval: false
- historical_authorizes_graph_ingestion: false
- historical_authorizes_production_use: false
- historical_product_readiness_claim: false
- historical_production_readiness_claim: false
- historical_launch_readiness_claim: false
- historical_provider_lock_in: false

The historical fields above describe the bounded future authorization that existed immediately after this packet merged and before `runtime-model-only-tiny-live-runtime-proof-remediated-status.md` recorded execution. They are preserved as audit history only and are not current authorization after the completed status.

## Current authorization state after completed status

- status_followup: runtime-model-only-tiny-live-runtime-proof-remediated-status.md
- approval_consumed_by_status: true
- current_future_execution_authorized_after_status: false
- current_future_authorized_test_slot_count: 0
- current_future_authorized_provider_call_count: 0
- current_future_authorized_attempt_count: 0
- current_future_authorized_runtime_model_mode_suite: false
- current_authorizes_retry_after_suite: false
- current_retry_requires_new_approval_after_suite: true
- current_authorizes_provider_comparison: false
- current_authorizes_default_model_selection: false
- current_authorizes_product_preview_expansion: false
- current_authorizes_tools: false
- current_authorizes_web_search: false
- current_authorizes_plugins: false
- current_authorizes_retrieval: false
- current_authorizes_graph_ingestion: false
- current_authorizes_production_use: false
- current_product_readiness_claim: false
- current_production_readiness_claim: false
- current_launch_readiness_claim: false
- current_provider_lock_in: false

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
- graph_ingestion: false

The historical suite used the app-owned model-only harness boundary. It did not use Hermes as a product runtime, did not use an autonomous agent surface, and did not bypass the model-only harness.

## Completed status requirements

The completed status follow-up records only sanitized public-safe facts:

- approval_id
- route_ref, provider_ref, and model_label
- per-slot role and sanitized outcome
- provider call count per slot and total provider call count
- whether accepted output was received
- whether the v2 public contract validated
- whether the canonical allowlist remediation was applied
- stable public reason or error code
- token counts if public-safe
- observed cost, expected to remain zero for this free route
- non-authorizing boundary markers

The completed status did not commit prompt text, source excerpts, account refs, provider payloads, headers, operator filesystem locations, logs, credential-bearing values, client handles, nonpublic request handles, response bodies, model output text, provider metadata, or private evidence details.

## Interpretation limits

This approval packet does not prove product readiness, production readiness, launch readiness, provider quality, provider comparison, default model selection, provider lock-in, graph ingestion readiness, background orchestration readiness, or production use. The completed suite is a bounded historical runtime/model-mode contract signal only.

Any later retry, broader corpus, product-preview expansion, provider comparison, model default decision, tool/search/plugin/retrieval change, graph ingestion, production use, or readiness claim requires a separate reviewed approval packet.
