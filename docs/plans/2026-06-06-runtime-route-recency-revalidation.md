# Runtime Route Recency Revalidation Plan

Status: no-spend planning contract.

Input contract: `docs/runbooks/runtime-model-route-recency-revalidation-contract.md`.
Input route-chain plan: `docs/plans/2026-06-06-provider-neutral-lab-runtime-route-planning.md`.

## Goal

Add a provider-neutral recency and revalidation gate before any fresh live approval, provider call, runtime/model-mode execution, or model comparison. The goal is to make route evidence time-boxed and reviewable while preserving no-spend behavior and replaceable provider/model architecture.

## Route strategy

Models get better, and route evidence gets stale. GPT-5.5 is a currently validated candidate route for bounded lab/runtime proof work; it is not a permanent default. `owl-alpha` remains a validation route until a separate review retires it. Future candidates such as Opus 4.8, GPT-5.6, direct Anthropic API, direct OpenAI API, gateway routes, or other providers must enter through the same `ModelProvider` boundary and validated route catalog.

Route selection remains an explicit route ref decision, not a provider label, model label, recency order, or hidden default. The recency report can warn that evidence is near expiry or expired, but it cannot choose a model or authorize a provider call.

## Decision

Decision: proceed with no-spend route recency / revalidation contract before any fresh live approval, provider call, comparison, or product hardening that depends on model route freshness.

Rationale: PR #241 proved no-call route-chain plumbing for the lab runtime proof result, but route evidence still needs an explicit recency/revalidation posture. Fresh, nearing-expiry, expired, and label-only states should be visible and deterministic before future runtime work. This is a foundation-first step that avoids turning a successful historical proof into standing authorization.

## Required behavior

1. Review only sanitized route records and public candidate labels.
2. Classify entries as `fresh`, `nearing-expiry`, `expired-needs-revalidation`, or `candidate-label-only-not-validated`.
3. Mark expired routes and label-only candidates as requiring a fresh approval packet before use.
4. Preserve false authorization/default/lock-in/readiness markers.
5. Reject unsafe or malformed route-recency inputs before producing a report.
6. Keep provider calls, spend, runtime/model-mode integration, graph ingestion, and production writes at zero/false.

## Current safety markers

- provider_calls_executed_by_plan: 0
- provider_calls_executed: 0
- provider_spend: false
- authorizes_provider_call: false
- authorizes_runtime_use: false
- authorizes_revalidation_run: false
- authorizes_retry: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_corpus_expansion: false
- authorizes_default_model_selection: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- authorizes_mcp: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- runtime_model_mode_integration: false
- default_model_selection_claim: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- stale_or_candidate_requires_fresh_approval: true
- revalidation_requires_new_approval: true

## Follow-on options after this PR

After this no-spend contract lands, the next branch can be chosen explicitly:

- product hardening using fake/sanitized fixtures only;
- a docs-only fresh approval packet for a tiny revalidation or follow-up proof;
- no-spend runtime observability/reporting polish;
- no-spend route catalog fixtures that exercise multiple provider routes without provider calls.

None of those options is authorized by this plan. Each requires a separate scoped PR or explicit fresh approval packet.
