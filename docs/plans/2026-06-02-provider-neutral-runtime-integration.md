# Provider-Neutral Runtime Integration Implementation Plan

> **For Hermes:** Use subagent-driven-development skill only if this plan later becomes implementation scope. This PR is docs-only/no-spend planning.

Status: no-spend planning contract.

**Goal:** Define the provider-neutral runtime integration path after the bounded GPT-5.5 comparison usefulness assessment, without making provider calls, selecting a default model, or wiring runtime/model-mode execution yet.

**Architecture:** Atliera keeps product logic behind the existing `ModelProvider` boundary. This is the ModelProvider boundary contract for provider-neutral runtime integration planning. Runtime integration should introduce route cataloging, selection policy, runtime composition binding, activation/cost gate reuse, recency review, and sanitized observability as separate TDD slices. Direct provider APIs and gateway routes remain interchangeable through the same boundary.

**Tech Stack:** TypeScript, `node:test`, existing `ModelProvider`, `ExternalCommandModelProvider`, runtime config/preflight/composition, activation gates, cost ledger, safety-contract docs/tests.

---

## Current input state

The immediate input is the no-spend comparison usefulness assessment in `docs/runbooks/live-product-preview-gpt55-comparison-usefulness-assessment.md`.

That assessment classified GPT-5.5 via `openai-codex` as `candidate-comparable-useful` against the six-slot `owl-alpha` baseline and recommended `provider-neutral-runtime-integration-planning`.

This plan does not execute integration. It records how integration should be built later.

Safety markers for this planning PR:

- provider_calls_executed: 0;
- provider_spend: false;
- runtime_model_mode_integration: false;
- production_writes: false;
- web_search_or_tools: false;
- approves_provider_call: false;
- approves_expansion_or_comparison: false;
- default_model_selection_claim: false;
- provider_lock_in: false;
- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false.

Implementation constraints:

- no provider SDK imports in `src/`;
- no env credential reads;
- no raw private evidence in repo;
- no tool, shell, file, web search, plugin, retrieval, or MCP surface;
- no direct use of the active Hermes/operator agent session as an Atliera provider;
- switching among validated routes must not require product-logic rewrites.

## Replaceable-model strategy

Models get better. What is good today can be replaced by a better model tomorrow. The recent Opus 4.8 release and expected GPT-5.6 class improvements are explicit design inputs, not exceptions.

Runtime integration must therefore treat model/provider choices as replaceable records, not hardcoded product doctrine.

Required strategy:

1. Maintain a validated route catalog rather than a single baked-in production model.
2. Store model/version/provider route metadata separately from product logic.
3. Treat each route's validation evidence as time-boxed validation, not permanent truth.
4. Require recency review before using stale validation evidence for a production-like decision.
5. Allow new candidates such as Opus 4.8, future GPT-5.6, direct Anthropic API, direct OpenAI API, gateway routes, or other routes to enter through the same `ModelProvider` boundary.
6. Keep `owl-alpha` as a useful validation route until a separate review retires it; this plan does not deprecate `owl-alpha`.
7. Keep GPT-5.5 as a currently validated candidate, not a permanent default.

## Runtime integration target contract

Future runtime integration should expose a small provider-neutral contract:

- route catalog input: safe route refs and sanitized validation summaries;
- route selection policy: deterministic, auditable, and environment-aware;
- runtime binding: compose an already-approved `ModelProvider` adapter into `AtlieraRuntime` without provider SDK/client construction in app code;
- activation gate reuse: enforce approval, corpus, operation, cost, and credential-readiness checks before any provider call;
- observability: report sanitized route ref, validation recency, approval ref, and cost-ledger ref without raw prompts, raw outputs, credentials, account refs, or private evidence paths.

No future implementation should read credentials from `process.env` or instantiate provider SDK clients in `src/`. Real provider transport should remain an injected adapter/external-command/wrapper concern.

## Task 1: validated route catalog

**Objective:** Represent validated routes as sanitized, replaceable, time-boxed records.

**Files:**

- Create: `src/model/validated-route-catalog.ts`
- Test: `tests/model/validated-route-catalog.test.ts`
- Docs: update this plan only if the contract changes.

**Step 1: RED — write failing tests first**

Test behaviors:

- accepts a safe route record for GPT-5.5 via `openai-codex` with validation refs;
- accepts a safe route record for `owl-alpha` as a validation route;
- accepts future route labels such as `opus-4.8` and `gpt-5.6` without code changes when they satisfy safe logical IDs;
- rejects provider SDK/client/credential/raw evidence/private path fields;
- rejects stale records when caller requires a maximum validation age;
- rejects accessors/symbols/non-enumerable fields before reading nested route metadata.

**Step 2: Verify RED**

Run:

```bash
npx tsx --test tests/model/validated-route-catalog.test.ts
```

Expected: FAIL because `validated-route-catalog.ts` does not exist.

**Step 3: GREEN — minimal implementation**

Implement only pure validation and selection helpers. No file reads, no env reads, no provider calls, no network.

Required public functions should be minimal and pure:

- `snapshotValidatedModelRoute(...)`
- `validateRouteCatalog(...)`
- `selectRouteFromCatalog(...)`

**Step 4: Verify GREEN**

Run:

```bash
npm run typecheck
npx tsx --test tests/model/validated-route-catalog.test.ts
```

Expected: PASS.

## Task 2: provider selection policy

**Objective:** Define deterministic route selection without default-model lock-in.

**Files:**

- Modify: `src/model/validated-route-catalog.ts`
- Test: `tests/model/validated-route-catalog.test.ts`

**Step 1: RED — write failing tests first**

Test behaviors:

- production-like selection requires explicit route ref, approval ref, and recency check;
- lab/test selection may use fake model routes but must report them as fake;
- no route can be chosen solely because it is GPT-5.5 or `owl-alpha`;
- unsupported route refs fail closed with stable sanitized errors;
- model recency review is required before using stale validation evidence.

**Step 2: Verify RED**

Run the targeted test and confirm the new selection-policy tests fail.

**Step 3: GREEN — minimal implementation**

Add selection policy around route refs and evidence recency. Do not add provider transport.

**Step 4: Verify GREEN**

Run targeted tests plus typecheck.

## Task 3: runtime composition binding

**Objective:** Plan the boundary where selected routes become runtime dependencies without importing SDKs or reading credentials.

**Files:**

- Modify: `src/runtime/composition.ts`
- Test: `tests/runtime/composition.test.ts`

**Step 1: RED — write failing tests first**

Test behaviors:

- production/staging runtime composition refuses `fake` model routes;
- runtime accepts an already-composed `ModelProvider`/adapter dependency by interface only;
- runtime composition does not construct `ExternalCommandModelProvider` by default;
- runtime composition does not read env credentials;
- selected route metadata is reported as sanitized ref fields only.

**Step 2: Verify RED**

Run:

```bash
npx tsx --test tests/runtime/composition.test.ts
```

Expected: FAIL for the missing route-binding contract.

**Step 3: GREEN — minimal implementation**

Add typed route metadata and dependency injection only. Do not wire live GPT-5.5 or `owl-alpha` transport.

**Step 4: Verify GREEN**

Run targeted tests, typecheck, and existing runtime preflight tests.

## Task 4: activation and cost gate reuse

**Objective:** Ensure runtime model execution cannot bypass the existing activation and budget gates.

**Files:**

- Modify/create a narrow runtime model-execution preflight helper only after route catalog and composition exist.
- Test: new runtime model-execution preflight tests.

**Step 1: RED — write failing tests first**

Test behaviors:

- runtime model execution refuses without approval context;
- runtime model execution refuses when cost ledger/cumulative estimate exceeds cap;
- runtime model execution refuses when credential readiness is missing;
- runtime model execution refuses if request metadata includes tools, shell, file, web search, plugin, retrieval, or MCP fields;
- runtime model execution returns sanitized failure codes before provider access.

**Step 2: Verify RED**

Run the new targeted tests and confirm failures.

**Step 3: GREEN — minimal implementation**

Reuse existing activation gate and cost-ledger primitives. Keep all transport injected.

**Step 4: Verify GREEN**

Run targeted tests, no-provider-SDK safety test, and full CI.

## Task 5: route recency and replacement review

**Objective:** Encode that models improve and validated routes need periodic review.

**Files:**

- Modify: route catalog/policy helper.
- Test: route catalog tests.
- Docs: architecture/runtime plan docs.

**Step 1: RED — write failing tests first**

Test behaviors:

- a stale GPT-5.5 validation record requires recency review before production-like use;
- a future GPT-5.6 route can be added as a new candidate without modifying product code;
- a future Opus 4.8 route can be added as a new candidate without modifying product code;
- replacing a route requires new validation refs, not chat-memory claims.

**Step 2: Verify RED**

Run targeted route catalog tests and confirm failures.

**Step 3: GREEN — minimal implementation**

Add recency status and replacement metadata. Do not make provider calls.

**Step 4: Verify GREEN**

Run targeted tests and typecheck.

## Task 6: sanitized runtime observability

**Objective:** Report route use safely when runtime integration eventually executes.

**Files:**

- Create/modify a runtime model execution report helper.
- Test: runtime observability tests.

**Step 1: RED — write failing tests first**

Test behaviors:

- report includes route ref, provider route, model label, validation refs, approval ref, ledger ref, and usage/cost summary;
- report excludes raw prompt, raw output, raw provider request, raw provider response, credentials, private evidence paths, wrapper logs, source text, and account refs;
- report distinguishes validation route, candidate route, and production-like selected route;
- report preserves `default_model_selection_claim: false` unless a separate future selection PR explicitly changes that contract.

**Step 2: Verify RED**

Run targeted tests and confirm failures.

**Step 3: GREEN — minimal implementation**

Implement sanitized reporting only. Do not execute model calls.

**Step 4: Verify GREEN**

Run targeted tests and full CI.

## Verification checklist for any future implementation PR

Every future implementation PR derived from this plan must run:

```bash
npm run typecheck
npx tsx --test tests/safety/no-provider-sdk.test.ts
npm run ci
```

Additional targeted tests depend on the slice.

Full verification must prove:

- no provider SDK imports in `src/`;
- no provider calls unless a separate approval packet authorizes them;
- no env credential reads;
- no raw private evidence committed;
- no tool/shell/file/web/plugin/retrieval/MCP surface;
- no default model selection claim;
- no provider lock-in;
- route replacement remains possible without product-logic rewrites.

## Explicit non-goals

This plan does not:

- approve a GPT-5.5 provider call;
- approve an Opus 4.8 provider call;
- approve a GPT-5.6 provider call;
- wire runtime/model-mode integration;
- select GPT-5.5 as production default;
- deprecate `owl-alpha`;
- prove launch readiness;
- prove product readiness;
- prove production readiness;
- establish broad model quality;
- establish provider lock-in;
- change deployment config.

A separate approval packet is required before any future live provider call or production-like runtime model execution.
