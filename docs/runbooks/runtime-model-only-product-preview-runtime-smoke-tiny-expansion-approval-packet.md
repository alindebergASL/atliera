# Runtime Model-Only Product-Preview Runtime Smoke Tiny Expansion Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

Input assessment: `runtime-model-only-product-preview-runtime-smoke-usefulness-assessment.md`.
Source status: `runtime-model-only-product-preview-runtime-smoke-corrected-retry-status.md`.
Source approval: `runtime-model-only-product-preview-runtime-smoke-corrected-retry-approval-packet.md`.
Source remediation: `runtime-model-only-product-preview-runtime-smoke-remediation.md`.

This packet is the separate reviewed approval that may follow the useful no-spend runtime-smoke assessment. The assessment itself remains non-authorizing; this packet is the new bounded approval surface.

No execution may occur in this approval PR. Execution and sanitized status must happen later in a separate step.

## Preconditions

- corrected_retry_status_completed: true
- corrected_retry_v2_contract_validated: true
- corrected_retry_accepted_output_received: true
- corrected_retry_provider_calls_executed: 1
- corrected_retry_approval_consumed: true
- runtime_smoke_usefulness_assessment_status: pass
- runtime_smoke_usefulness_classification: useful
- runtime_smoke_useful_lenses: signals, maps, plays
- runtime_smoke_assessment_provider_calls_executed: 0
- runtime_smoke_assessment_authorizes_provider_call: false
- runtime_smoke_assessment_authorizes_product_preview_expansion: false
- runtime_smoke_assessment_authorizes_default_model_selection: false
- runtime_smoke_assessment_authorizes_graph_ingestion: false
- runtime_smoke_assessment_product_readiness_claim: false

## Approved future tiny expansion

- approval_id: runtime-model-only-product-preview-runtime-smoke-tiny-expansion-20260604f
- approval_kind: three_slot_runtime_model_mode_product_preview_tiny_expansion
- max_attempts: 1
- max_provider_calls: 3
- approved_max_cost_usd: 3
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_surface: app-owned-model-only-harness
- corpus_ref: product-preview/runtime-smoke-tiny-screened-three-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1-runtime-smoke-v2-type-remediation
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- remediation_helper_ref: src/product-preview/runtime-smoke-v2-remediation.ts
- screened_account_slots: 3
- required_slot_roles: representative, edge-case, calibration
- runtime_mode: product-preview-expansion

This approval is for exactly one future three-slot tiny expansion. It is not a provider comparison, not default-model selection, not graph ingestion, not production use, not background orchestration, and not a readiness claim.

## Required pre-execution dry-run planning

The executor must run the no-provider-call planner before any future provider access:

```sh
npm run product-preview:plan -- \
  --job-id product-preview-runtime-smoke-tiny-expansion-20260604f \
  --approval-ref docs/runbooks/runtime-model-only-product-preview-runtime-smoke-tiny-expansion-approval-packet.md \
  --route-ref gpt-5.5-openai-codex-20260602a \
  --provider-ref openai-codex \
  --model-label gpt-5.5 \
  --transport-kind model-only-codex-auth \
  --corpus-ref product-preview/runtime-smoke-tiny-screened-three-slot-v1 \
  --prompt-contract-ref prompts/product-preview-model-only-v1-runtime-smoke-v2-type-remediation \
  --max-provider-calls 3 \
  --max-cost-usd 3 \
  --slot-roles representative,edge-case,calibration \
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
- required_representative_slots: 1
- required_edge_case_slots: 1
- required_calibration_slots: 1
- replacement_accounts_allowed_without_new_approval: false
- no_paid_fallback: true
- no_retry_beyond_approved_call_count: true
- no_prompt_or_corpus_change_without_new_approval: true

Each account slot must pass private source-evidence screening before its provider call. The later status may record only sanitized role/category markers and aggregate/per-slot counts. It must not record raw source text, private account details, account identifiers, prompt material, request bodies, response bodies, model output text, provider metadata, wrapper logs, credential material, local evidence details, or local evidence paths.

If any required slot fails screening, stop before provider access for that slot. Skipped or failed slots do not authorize replacement accounts. If fewer than all three required roles pass screening, the later status must record a sanitized blocked or partial status and no additional retry is authorized by this packet.

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

The future tiny expansion must use the app-owned model-only harness boundary. It must not use Hermes as a product runtime, must not use an autonomous agent surface, and must not bypass the model-only harness.

## Authorization state

- current_pr_executes_provider_call: false
- future_execution_authorized_after_merge: true
- future_authorized_provider_call_count: 3
- future_authorized_attempt_count: 1
- future_authorized_tiny_product_preview_expansion: true
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

The later status follow-up must record whether the approved tiny expansion completed, blocked, partially completed, or failed. It must record only sanitized aggregate and per-slot role facts: role, status, provider call count, accepted-output boolean, v2 contract boolean, remediation applied/changes, output counts, token counts, observed cost, and stable public reason/error codes.

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
- multi-account readiness
- broad model quality

A completed future tiny expansion would be a bounded historical product-preview signal only. Any further retry, broader expansion, provider comparison, default selection, graph ingestion, production use, background orchestration decision, or readiness claim would require a separate approval packet.

## Provider portability

This packet uses the existing `gpt-5.5-openai-codex-20260602a` route because that is the route that produced the corrected runtime-smoke signal. It is not a default production model selection and not a provider-quality conclusion. The `ModelProvider` boundary remains the durable product seam; future routes and direct provider APIs remain replaceable behind the same boundary after separate reviewed approvals.
