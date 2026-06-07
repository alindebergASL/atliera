# Runtime Model Route Recency Revalidation Contract

Status: no-spend route recency/revalidation contract.

This runbook records the deterministic `reviewRouteEvidenceRecency` contract for route evidence recency review. It consumes only sanitized route records and future candidate labels. It executes no provider call, performs no retry, reads no private material, and makes no runtime/model-mode execution decision.

## Contract purpose

The route recency contract classifies each validated route or candidate label into one of these public states:

- `fresh`: committed sanitized validation evidence has not expired and is outside the warning window.
- `nearing-expiry`: committed sanitized validation evidence has not expired but is inside the configured warning window.
- `expired-needs-revalidation`: committed sanitized validation evidence is past `evidence_expires_at` and must be revalidated under a fresh approval packet before use.
- `candidate-label-only-not-validated`: a future model/provider label is being tracked as a possible route but has no validated route evidence yet.

Every entry reports:

- `requires_fresh_approval_before_use`
- `usable_without_revalidation`
- `evidence_expires_at`

Expired routes and label-only candidates set `requires_fresh_approval_before_use: true` and `usable_without_revalidation: false`. Fresh and nearing-expiry routes may remain catalog facts, but the recency report itself still does not authorize runtime use or provider access.

## Current report safety markers

- provider_calls_executed: 0
- provider_spend: false
- authorizes_provider_call: false
- authorizes_runtime_use: false
- authorizes_retry: false
- authorizes_revalidation_run: false
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

## What this contract establishes

This contract establishes that route evidence can be reviewed without provider access, spend, runtime execution, graph ingestion, production writes, or route defaulting. It makes staleness explicit before future runtime work and prevents label-only candidates from being confused with validated routes.

It also keeps provider/model choices replaceable. A route label such as GPT-5.5 can remain a candidate route only when backed by current sanitized validation evidence. `owl-alpha` can remain a validation route until a separate review retires it. Future candidates must enter through the same route-catalog and `ModelProvider` boundary instead of by hidden defaults.

## What this contract does not authorize

This contract does not authorize:

- provider calls;
- retry;
- a revalidation run;
- runtime/model-mode execution;
- provider comparison;
- product-preview expansion;
- corpus expansion;
- default model selection;
- tools, web search, plugins, retrieval, or MCP;
- graph ingestion;
- production use;
- product, production, or launch readiness claims.

Any revalidation, stale-route use, label-only candidate validation, provider comparison, or live runtime/model-mode execution requires a separate fresh approval packet.
