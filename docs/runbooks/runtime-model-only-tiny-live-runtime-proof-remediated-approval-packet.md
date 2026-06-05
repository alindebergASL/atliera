# Runtime Model-Only Tiny Live Runtime Proof Remediated Approval Packet

Status: pre-run docs-only remediated approval packet. This PR does not execute a provider call.

This packet is the fresh approval surface after the consumed fresh tiny live runtime proof was diagnosed as `account_object_type_allowlist_mismatch` and after the no-spend prompt-contract remediation aligned the prompt contract to the canonical public v2 account-object type allowlist.

No provider request is executed by this PR. Execution and sanitized status must happen later, after this packet is merged, under the exact scope below.

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

The consumed source approval must not be reused. This packet replaces it only for the bounded future suite described below.

## Approved future remediated suite

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

This is a single future three-slot suite, not an open-ended retry allowance. The approved calls are intended to test the remediated v2 allowlist contract across a representative slot, an edge-case slot, and a calibration slot. The route is treated as a free testing route for this approval; the positive cost cap exists so the existing no-call planner can validate the packet, not because cost is the limiting factor. If preflight or provider terms show that the route is no longer the expected free route before access, stop before provider access and record a sanitized blocked status.

## Required canonical account-object type allowlist

Every future prompt contract for this suite must instruct the model to use only these values for every `account_object.type` field:

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

## Required pre-execution planner

The executor must run the no-provider-call planner before any provider access:

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

If planner validation fails, stop before provider access and record a sanitized blocked status. Do not substitute Hermes operator context, an autonomous agent surface, shell/curl execution, web retrieval, tools, plugins, a different model route, or a broader product-preview run.

## Screening and execution rules

- private_source_screening_required_before_each_slot: true
- stop_before_provider_access_if_preflight_fails: true
- stop_before_provider_access_if_route_is_not_expected_free_route: true
- stop_instead_of_substitute_if_slot_fails_screening: true
- replacement_slots_allowed_without_new_approval: false
- no_paid_fallback: true
- no_prompt_or_corpus_change_without_new_approval: true
- no_retry_beyond_approved_three_slot_suite: true
- status_followup_required: true

Each slot may execute at most one provider call after screening and preflight pass for that slot. A failed or skipped slot does not authorize replacement slots. A route-level preflight failure stops the whole suite before provider access. A slot-level screening failure stops that slot and the later status must record the sanitized slot outcome.

If one slot returns an exception, the later executor may continue with remaining approved slots only if the route-level and safety preflights still pass and no paid fallback, tool/search/plugin/retrieval change, prompt change, model change, or private-evidence leak is involved. This keeps the free test suite useful without converting it into an automatic retry loop.

## Current PR state

- current_pr_executes_provider_call: false
- provider_calls_executed_in_this_pr: 0
- provider_spend_in_this_pr: false
- provider_payload_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false
- adds_runtime_provider_call_source: false

## Future authorization state after merge

- future_execution_authorized_after_merge: true
- future_authorized_test_slot_count: 3
- future_authorized_provider_call_count: 3
- future_authorized_attempt_count: 1
- future_authorized_runtime_model_mode_suite: true
- authorizes_retry_after_suite: false
- retry_requires_new_approval_after_suite: true
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_product_preview_expansion: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

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

The future suite must use the app-owned model-only harness boundary. It must not use Hermes as a product runtime, must not use an autonomous agent surface, and must not bypass the model-only harness.

## Later status requirements

The later status follow-up must record only sanitized public-safe facts:

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

The later status must not commit prompt text, source excerpts, account refs, provider payloads, headers, operator filesystem locations, logs, credential-bearing values, client handles, request identifiers, response bodies, model output text, provider metadata, or private evidence details.

## Interpretation limits

This approval packet does not prove product readiness, production readiness, launch readiness, provider quality, provider comparison, default model selection, provider lock-in, graph ingestion readiness, background orchestration readiness, or production use. A completed future suite would be a bounded historical runtime/model-mode contract signal only.

Any later retry, broader corpus, product-preview expansion, provider comparison, model default decision, tool/search/plugin/retrieval change, graph ingestion, production use, or readiness claim requires a separate reviewed approval packet.
