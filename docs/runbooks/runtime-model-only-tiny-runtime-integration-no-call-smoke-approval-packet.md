# Runtime Model-Only Tiny Runtime Integration No-Call Smoke Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute the no-call smoke, does not execute runtime/model-mode integration, and does not execute any provider call.

Input decision: `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md`.
Input planning contract: `../plans/2026-06-04-provider-neutral-runtime-route-planning-after-gpt55-repeatability.md`.
Input assessment: `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md`.

## Decision

This packet approves a future tiny no-call runtime integration smoke only. The approved future smoke may exercise route catalog validation, explicit route selection, runtime composition with injected fake/throwing provider dependencies, runtime execution preflight, and sanitized observability.

It does not approve a live model/provider call, retry, product-preview expansion, provider comparison, default model selection, graph ingestion, production write, background orchestrator, launch readiness, product readiness, production readiness, or provider lock-in.

## Approved future no-call scope

- approval_id: runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i
- smoke_kind: tiny-runtime-integration-no-call
- max_attempts: 1
- max_provider_calls: 0
- cost_preflight_guard_usd: 0.01
- expected_provider_spend_usd: 0
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- route_kind: candidate
- environment: staging
- selection_policy: explicit-route-ref-only
- required_validation_refs: runtime-smoke-gpt55-repeatability-status, runtime-smoke-gpt55-repeatability-usefulness-assessment, runtime-smoke-gpt55-repeatability-decision
- fake_or_throwing_provider_dependency_required: true
- provider_calls_must_remain_zero: true
- provider_spend_must_remain_zero: true
- network_access_must_remain_zero: true
- production_writes_must_remain_zero: true
- status_followup_required: true

## Required pre-smoke gate

Before the future no-call smoke may run:

- planner_required_before_execution: true
- planner_must_be_dry_run: true
- planner_provider_calls_executed: 0
- planner_authorizes_provider_call: false
- route_catalog_validation_required: true
- explicit_route_selection_required: true
- approval_ref_required_for_staging_selection: true
- fake_routes_refused_for_staging: true
- preflight_must_return_authorizesProviderCall_false: true
- observability_must_return_authorizes_provider_call_false: true
- no_provider_sdk_imports_required: true
- no_env_credential_reads_required: true

If the route catalog, selection, preflight, or observability checks fail, the future smoke must stop and record a sanitized blocked status with zero provider calls and zero spend. It must not substitute a live provider call, autonomous coding agent, operator session, shell/curl path, web search, tools, or private wrapper execution.

## Runtime boundary

The future no-call smoke must preserve:

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
- provider_comparison: false
- runtime_model_mode_execution: false

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_execution: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- authorizes_tools_or_search: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

## Evidence handling

The future status follow-up may record only sanitized route refs, validation refs, approval refs, validation age, preflight status, zero provider-call count, zero token/cost values, and explicit false authorization/readiness markers.

Raw prompts, raw outputs, source text, account identifiers, provider request/response bodies, provider metadata, wrapper logs, credential material, local private evidence details, client handles, request identifiers, and private paths must not be committed.

## Non-claims

This approval packet is not a provider-call approval, not runtime/model-mode execution approval, not a default-model selection, not a provider comparison, not an expansion approval, not a graph-ingestion approval, not a production-use approval, and not a launch/product/production readiness claim.

It approves only a future no-call proof that the route-selection/runtime-preflight/observability chain can be composed safely with zero provider calls and zero spend.
