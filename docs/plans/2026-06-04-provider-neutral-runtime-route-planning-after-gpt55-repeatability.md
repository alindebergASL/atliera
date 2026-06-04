# Provider-Neutral Runtime Route Planning After GPT-5.5 Repeatability

Status: no-spend planning contract.

Input decision: `docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md`.
Input assessment: `docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md`.

## Goal

Plan the provider-neutral runtime route work that should follow the repeatable-useful GPT-5.5 smoke signal, without executing runtime/model-mode integration, calling a provider, selecting a default model, or changing production behavior.

## Route strategy

Models get better, and route evidence gets stale. GPT-5.5 is a currently validated candidate for this bounded runtime-smoke path; it is not a permanent default. `owl-alpha` remains a validation route until a separate review retires it. Future candidates such as Opus 4.8, GPT-5.6, direct Anthropic API, direct OpenAI API, gateway routes, or other providers must enter through the same `ModelProvider` boundary and validated route catalog.

Required route properties:

- route refs are safe logical IDs;
- provider refs and model labels are sanitized logical labels, not credentials or SDK handles;
- validation refs point only to committed sanitized docs or fixtures;
- validation evidence is time-boxed and subject to recency review;
- route selection is explicit by route ref, not by model/provider default heuristics;
- production-like selection requires an approval ref and fresh-enough validation evidence;
- fake routes are refused for production-like selection;
- switching among validated routes must not require product-logic rewrites.

## No-call integration slices

### Slice 1: repeatability route catalog check

Represent the current repeatability-backed GPT-5.5 candidate route as a validated route record with these sanitized refs:

- `docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status.md`
- `docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md`
- `docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md`

The route catalog check must execute zero provider calls and zero network requests.

### Slice 2: explicit route selection

Select the GPT-5.5 candidate route only by explicit route ref. The route selection policy must continue to reject selection by `modelLabel`, hidden defaults, stale evidence, fake production-like routes, unsafe refs, or missing production-like approval refs.

### Slice 3: runtime composition binding

Compose the selected route into `AtlieraRuntime` only as sanitized route metadata plus an already-injected `ModelProvider` interface. Runtime composition must not import provider SDKs, construct provider clients, read environment credentials, call the provider, read private evidence, or write production data.

### Slice 4: runtime execution preflight

Reuse activation and cost gates before any future execution. The no-call chain may prove a preflight shape but must keep `authorizesProviderCall: false`, `providerCallsExecuted: 0`, `providerSpend: false`, and `runtimeModelModeIntegration: false`.

### Slice 5: sanitized observability

A no-call report may record route refs, validation refs, approval ref, validation age, preflight status, zero usage/cost, and safety markers. It must reject raw prompts, raw outputs, source text, account identifiers, provider metadata, credentials, private evidence details, wrappers, tools, search, plugins, shell, file access, retrieval, or MCP fields.

## Current safety markers

- provider_calls_executed: 0
- provider_spend: false
- raw_private_evidence_read: false
- network_access: false
- production_writes: false
- runtime_model_mode_integration: false
- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

## Verification expectations

- targeted repeatability assessment tests pass;
- targeted route-chain no-call integration tests pass;
- safety contract tests cover the assessment, decision, planning, and no-call approval docs;
- `tests/safety/no-provider-sdk.test.ts` passes for any `src/` route/runtime changes;
- full `npm run ci` passes before merge.

This plan approves no provider call, no retry, no runtime/model-mode execution, no production write, no graph ingestion, no provider comparison, no default model selection, and no readiness claim.
