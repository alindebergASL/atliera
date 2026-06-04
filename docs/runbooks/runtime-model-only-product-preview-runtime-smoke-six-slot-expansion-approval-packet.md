# Runtime Model-Only Product-Preview Runtime Smoke Six-Slot Expansion Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

Options analysis: `runtime-model-only-product-preview-runtime-smoke-next-slice-options-analysis.md`.
Source usefulness assessment: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment.md`.
Source execution status: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status.md`.
Source approval: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-approval-packet.md`.

This packet is the separate reviewed approval surface that may follow the useful no-spend three-slot runtime-smoke assessment and the no-spend next-slice options analysis. The assessment and options analysis remain non-authorizing; this packet is the new bounded approval surface.

No execution may occur in this approval PR. Execution and sanitized status must happen later in a separate step.

## Preconditions

- three_slot_runtime_smoke_status_completed: true
- three_slot_runtime_smoke_v2_contract_validated: true
- three_slot_runtime_smoke_accepted_output_received: true
- three_slot_runtime_smoke_provider_calls_executed: 3
- three_slot_runtime_smoke_approval_consumed: true
- three_slot_runtime_smoke_usefulness_status: pass
- three_slot_runtime_smoke_usefulness_classification: useful
- three_slot_runtime_smoke_useful_lenses: signals, maps, plays
- three_slot_runtime_smoke_assessment_provider_calls_executed: 0
- three_slot_runtime_smoke_assessment_authorizes_provider_call: false
- three_slot_runtime_smoke_assessment_authorizes_product_preview_expansion: false
- three_slot_runtime_smoke_assessment_authorizes_default_model_selection: false
- three_slot_runtime_smoke_assessment_authorizes_graph_ingestion: false
- three_slot_runtime_smoke_assessment_product_readiness_claim: false
- next_slice_options_analysis_status: no-spend
- next_slice_options_analysis_recommended_next_slice: six-slot-runtime-model-mode-product-preview-approval

## Approved future six-slot expansion

- approval_id: runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g
- approval_kind: six_slot_runtime_model_mode_product_preview_expansion
- max_attempts: 1
- max_provider_calls: 6
- approved_max_cost_usd: 6
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
- runtime_mode: product-preview-expansion

This approval is for exactly one future six-slot expansion. It is not a provider comparison, not default-model selection, not graph ingestion, not production use, not background orchestration, not runtime/model-mode integration as a durable product default, and not a readiness claim.

## Required pre-execution dry-run planning

The executor must run the no-provider-call planner before any future provider access:

```sh
npm run product-preview:plan -- \
  --job-id product-preview-runtime-smoke-six-slot-expansion-20260604g \
  --approval-ref docs/runbooks/runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet.md \
  --route-ref gpt-5.5-openai-codex-20260602a \
  --provider-ref openai-codex \
  --model-label gpt-5.5 \
  --transport-kind model-only-codex-auth \
  --corpus-ref product-preview/runtime-smoke-six-slot-screened-v1 \
  --prompt-contract-ref prompts/product-preview-model-only-v1-runtime-smoke-v2-type-remediation \
  --max-provider-calls 6 \
  --max-cost-usd 6 \
  --slot-roles representative-a,representative-b,edge-case-a,edge-case-b,calibration,sparse-control \
  --runtime-mode product-preview-expansion
```

The planner must report:

- dry_run: true
- provider_calls_executed: 0
- provider_spend_authorized_by_plan: false
- raw_private_evidence_read: false
- network_access_performed: false
- authorizes_provider_call: false

If planner validation fails, stop before provider access and record a sanitized blocked status. Do not substitute a manual run.

## Screening and stop rules

- private_source_screening_required_before_each_call: true
- stop_instead_of_substitute_if_slot_fails_screening: true
- required_representative_slots: 2
- required_edge_case_slots: 2
- required_calibration_slots: 1
- required_sparse_control_slots: 1
- replacement_accounts_allowed_without_new_approval: false
- no_paid_fallback: true
- no_retry_beyond_approved_call_count: true
- no_prompt_or_corpus_change_without_new_approval: true

Each account slot must pass private source-evidence screening before its provider call. The later status may record only sanitized role/category markers and aggregate/per-slot counts. It must not record raw source text, private account details, account identifiers, prompt material, request bodies, response bodies, model output text, provider metadata, wrapper logs, credential material, local evidence details, or local evidence paths.

If any required slot fails screening, stop before provider access for that slot. Skipped or failed slots do not authorize replacement accounts. If fewer than all six required roles pass screening, the later status must record a sanitized blocked or partial status and no additional retry is authorized by this packet.

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

The future six-slot expansion must use the app-owned model-only harness boundary. It must not use Hermes as a product runtime, must not use an autonomous agent surface, and must not bypass the model-only harness.

## Authorization state

- current_pr_executes_provider_call: false
- future_execution_authorized_after_merge: true
- future_authorized_provider_call_count: 6
- future_authorized_attempt_count: 1
- future_authorized_six_slot_product_preview_expansion: true
- authorizes_retry_after_this_attempt: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

## Evidence and status requirements

- status_followup_required: true
- approval_consumed_if_any_provider_request_is_attempted: true
- retry_requires_new_approval_after_attempt: true
- raw_or_model_output_must_remain_private: true
- sanitized_status_renderer_required: true
- no_spend_usefulness_assessment_required_after_status: true

The later status follow-up must record whether the approved six-slot expansion completed, blocked, partially completed, or failed. It must record only sanitized aggregate and per-slot role facts: role, status, provider call count, accepted-output boolean, v2 contract boolean, remediation applied/changes, output counts, token counts, observed cost, and stable public reason/error codes.

No raw/model/private evidence may be committed in the later status PR.

## Non-claims

This approval packet does not claim:

- product readiness
- production readiness
- launch readiness
- default model selection
- provider comparison
- provider lock-in
- graph ingestion readiness
- background orchestrator readiness
- broader validation readiness
- broad model quality

A completed future six-slot expansion would be a bounded historical product-preview signal only. Any further retry, broader expansion, provider comparison, default selection, graph ingestion, production use, background orchestration decision, runtime integration decision, or readiness claim would require a separate approval packet.

## Provider portability

This packet uses the existing `gpt-5.5-openai-codex-20260602a` route because that is the route that produced the useful three-slot runtime-smoke signal. It is not a default production model selection and not a provider-quality conclusion. The `ModelProvider` boundary remains the durable product seam; future routes and direct provider APIs remain replaceable behind the same boundary after separate reviewed approvals.
