# Provider-Neutral Lab Runtime Route Planning

Status: no-spend planning contract.

Input interpretation: `docs/runbooks/runtime-model-only-lab-runtime-live-proof-interpretation.md`.
Input status: `docs/runbooks/runtime-model-only-lab-runtime-live-proof-status.md`.
Input approval: `docs/runbooks/runtime-model-only-lab-runtime-live-proof-approval-packet.md`.

## Goal

Plan the provider-neutral runtime route work that should follow the single consumed
lab runtime/model-mode proof, without executing runtime/model-mode integration,
calling a provider, selecting a default model, expanding the corpus, or changing
production behavior. The one approval is fully consumed; remaining approved future
attempts is zero.

## Route strategy

Models get better, and route evidence gets stale. GPT-5.5 is a currently validated
candidate route for this bounded lab runtime path; it is not a permanent default.
`owl-alpha` remains a validation route until a separate review retires it. Future
candidates such as Opus 4.8, GPT-5.6, direct Anthropic API, direct OpenAI API,
gateway routes, or other providers must enter through the same `ModelProvider` boundary
and validated route catalog.

Required route properties:

- route refs are safe logical IDs;
- provider refs and model labels are sanitized logical labels, not credentials or SDK handles;
- validation refs point only to committed sanitized docs or fixtures;
- validation evidence is time-boxed and subject to recency review;
- route selection is explicit by route ref, not by model/provider default heuristics;
- production-like selection requires an approval ref and fresh-enough validation evidence;
- fake or provider-locked routes are refused for production-like selection;
- switching among validated routes must not require product-logic rewrites.

## Candidate next branches

1. **Product hardening** — build product-facing vertical-slice behavior on top of the
   runtime. Higher value if the runtime/route foundation is already proven robust.
2. **Route-chain hardening** — extend no-call route catalog / selection / composition /
   preflight / observability coverage for the lab runtime proof result. Foundation-first
   and fully no-spend.
3. **Separate docs-only approval packet** — request a fresh approval for another live
   run/comparison. Requires spend authorization and should not precede a hardened
   foundation.

## Decision

Decision: proceed with foundation-first, no-spend **route-chain hardening** before any further approval, live run, or provider call.

Rationale: the consumed proof establishes only a single-route, single-provider,
single-operation, zero-spend harness signal (see the interpretation). It does not
demonstrate that the route-chain seam is hardened for the lab runtime proof result
across catalog validation, explicit `routeRef` selection, runtime composition,
preflight, and sanitized observability. Because the existing code and tests do not yet
demonstrate that exact next branch as already-hardened for this specific proof result,
foundation-first route-chain hardening is preferred over product hardening or another
approval/live run. A separate docs-only approval packet is deferred until the no-call
foundation is hardened and a fresh spend authorization is justified.

This branch is fully no-spend and changes no production behavior. It is realized by the
no-call integration coverage in
`tests/model/lab-runtime-route-chain-no-call.integration.test.ts`.

## No-call integration slices

### Slice 1: validated route catalog

Represent the lab-runtime-proof candidate route as a validated route record whose
validation refs point only to committed sanitized docs:

- `docs/runbooks/runtime-model-only-lab-runtime-live-proof-status.md`
- `docs/runbooks/runtime-model-only-lab-runtime-live-proof-interpretation.md`
- `docs/runbooks/runtime-model-only-lab-runtime-live-proof-approval-packet.md`

Catalog validation must execute zero provider calls and zero network requests.

### Slice 2: explicit route selection

Select the candidate route only by explicit route ref. Selection must reject selection
by `modelLabel`, hidden defaults, unknown refs, stale evidence, fake production-like
routes, unsafe refs, or missing production-like approval refs.

### Slice 3: runtime composition binding

Compose the selected route into `AtlieraRuntime` only as sanitized route metadata plus
an already-injected `ModelProvider` interface. Composition must not import provider
SDKs, construct provider clients, read environment credentials, call the provider, read
private evidence, or write production data. The injected provider is a throwing stub
asserted never to be called.

### Slice 4: runtime execution preflight

Reuse activation and cost gates before any future execution. The no-call chain may prove
a preflight shape but must keep `authorizesProviderCall: false`,
`providerCallsExecuted: 0`, `providerSpend: false`, and
`runtimeModelModeIntegration: false`.

### Slice 5: sanitized observability

A no-call report may record route refs, validation refs, approval ref, validation age,
preflight status, zero usage/cost, and safety markers. It must reject prompt material,
model completions, source materials, account-specific references, request handles,
provider metadata, credentials, private evidence details, wrappers, tools, search,
plugins, shell, file access, retrieval, or MCP fields.

## Current safety markers

- provider_calls_executed_by_plan: 0
- provider_calls_executed: 0
- provider_spend: false
- raw_private_evidence_read: false
- network_access: false
- production_writes: false
- runtime_model_mode_integration: false
- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_corpus_expansion: false
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

- targeted lab runtime proof interpretation contract tests pass;
- targeted lab runtime route-chain no-call integration tests pass;
- `tests/safety/no-provider-sdk.test.ts` passes for any `src/` route/runtime changes;
- full `npm run ci` passes before merge.

This plan approves no provider call, no retry, no runtime/model-mode execution, no
production write, no graph ingestion, no provider comparison, no corpus expansion, no
default model selection, and no readiness claim.
