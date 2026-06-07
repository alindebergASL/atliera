# Runtime Route Recency Enforcement Status

Status: no-spend runtime route recency enforcement.

This runbook records the no-call runtime route-chain enforcement added after the route recency/revalidation contract. It makes `evidenceExpiresAt` an enforceable runtime selection and preflight boundary while preserving the provider-neutral `ModelProvider` seam.

## Enforcement points

- `selectRouteFromCatalog` keeps explicit route ref selection only. It classifies selected route evidence as `fresh` or `nearing-expiry`, and it refuses `expired-needs-revalidation` evidence before runtime binding.
- `preflightRuntimeModelExecution` carries the selected route recency metadata and refuses any selected route that requires fresh approval or is not usable without revalidation.
- `createRuntimeModelExecutionReport` surfaces sanitized route recency metadata in observability so the route status is visible without exposing private material.

## Runtime behavior

- `fresh` route evidence may continue through no-call selection and preflight when all existing activation gates also pass.
- Near-expiry route evidence is surfaced as warning metadata. A `nearing-expiry` route does not become default selection, provider access, revalidation approval, comparison approval, or runtime authorization by itself.
- `expired-needs-revalidation` route evidence is blocked before provider access. Expired route evidence requires fresh approval before any future use or revalidation attempt.
- Label-only candidates remain outside the validated route catalog and cannot be selected as validated runtime routes.

## Safety markers

- provider_calls_executed: 0
- provider_spend: false
- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_revalidation_run: false
- authorizes_provider_comparison: false
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

## What this establishes

This establishes a deterministic foundation gate: route evidence freshness is checked before future runtime/provider paths, near-expiry status is visible, and expired route evidence fails closed before any provider call boundary. It keeps GPT-5.5, owl-alpha, Opus, GPT-5.6, direct Anthropic API, direct OpenAI API, gateway routes, and future providers replaceable route candidates rather than hidden defaults.

## What this does not establish

This does not approve any live run, retry, revalidation run, provider comparison, graph ingestion, product-preview expansion, corpus expansion, production use, product readiness, production readiness, launch readiness, or default model selection. Any of those requires a separate scoped PR or fresh approval packet.
