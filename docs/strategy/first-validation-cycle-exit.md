# First Validation Cycle Exit

Status: Accepted

Last updated: 2026-05-28

## Decision

Atliera exits the first validation cycle with a no-spend methodology decision, not a launch or product-readiness claim.

The completed validation evidence is sufficient to stop extending substrate by default and to codify the validated engineering practice. The next implementation phase may begin only as a narrow product-facing fake-mode runtime slice that reuses existing graph-backed outputs in deterministic/fake-mode first. It must not add live provider execution, runtime/model-mode integration, production writes, provider comparison, or corpus expansion without a separate explicit approval packet.

This document is an exit assessment for the first validation cycle. It records what the cycle proved, what it did not prove, and which bounded next phase is now acceptable.

## What the first cycle validated

The first validation cycle exercised the load-bearing substrate under concrete constraints:

- approval and cumulative-budget controls exist before live provider execution;
- a durable artifact path reached real S3-compatible object API semantics with cleanup responsibility preserved outside product runtime;
- the provider boundary exercised the `ModelProvider` and external-command seams without provider SDK imports in Atliera source;
- activation gates, credential status, provider call, response contract, cost ledger, AgentRun linkage, graph validation, quality gates, manifest packaging, and bootstrap evidence verification all traversed the approved live-provider evidence path;
- `docs/runbooks/controlled-2b-expanded-rerun-status.md` records the separate sanitized status for the controlled 2b-expanded remediated rerun;
- the remediated controlled corpus result is a useful tiny-corpus signal: useful 3, weak-but-valid 0, zero-output 0, unsupported/invented 0, contract failure 0, and `launch_readiness_claim: false`.

The cycle also validated the project workflow itself:

- create deterministic no-spend contracts before live execution;
- split request, approval, execution, and sanitized status into separate reviewable PRs;
- keep raw/private evidence out of the repository;
- add safety tests for every load-bearing durable doc;
- scan staged diffs for private evidence and scope drift;
- use independent review before committing safety/methodology changes;
- treat external advisors as consultative input rather than merge authority.

## Interpretation boundaries

The first validation cycle does not imply launch readiness.

It does not imply product readiness.

It does not establish production readiness.

It does not establish broad model quality.

It does not establish multi-account corpus readiness.

It does not approve provider comparison.

It does not approve corpus expansion.

It does not approve runtime/model-mode integration.

It does not approve production writes.

It does not approve additional live provider calls or provider spend.

Any future live call, provider comparison, corpus expansion, production write, runtime/model-mode integration, launch-readiness assessment, or product-readiness assessment requires a separate explicit approval packet and a later sanitized status record.

## Provider portability boundary

The validation route used OpenRouter `owl-alpha` as a bounded validation route. OpenRouter is not a commitment, and `owl-alpha` is not a product provider decision.

Gateway and direct provider APIs must remain first-class options behind the same `ModelProvider` boundary. Future separately approved routes may include gateway providers and direct provider APIs such as the Anthropic API and OpenAI API. Switching among gateway and direct provider APIs must not require product-logic rewrites.

The next phase must preserve this portability boundary by avoiding OpenRouter-specific, Anthropic-specific, OpenAI-specific, or AWS-specific assumptions in product logic.

## Chosen next phase

The next phase is:

1. codify the validated engineering practice from the first validation cycle;
2. start only a narrow product-facing fake-mode runtime slice after the methodology is recorded;
3. keep that slice deterministic/fake-mode first;
4. reuse existing graph-backed outputs and validation artifacts instead of making new provider calls;
5. require separate approval before any live provider call, provider spend, runtime/model-mode integration, provider comparison, corpus expansion, production write, launch-readiness claim, or product-readiness claim.

The preferred first implementation target after this document is a small no-spend path that makes existing graph-backed evidence visible through product-facing runtime/workshop wiring while preserving fake adapters, deterministic fixtures, and current safety gates.

Current status: `src/runtime/workshop-preview.ts` now implements the first narrow product-facing fake-mode runtime slice. `prepareRuntimeWorkshopPreview(...)` builds a Workshop view model from the supplied runtime graph snapshot only after runtime preflight passes, and its report preserves `providerCallsMade: 0`, `productionWrites: false`, no server start, no client construction, and no live provider call.

## PR shape for the next implementation slice

The next implementation PR should be intentionally narrow:

- scope: deterministic/fake-mode product-facing runtime or Workshop wiring only;
- input: existing checked-in graph fixtures or sanitized validation artifacts;
- model/provider behavior: no live provider call and no provider spend;
- persistence behavior: no production writes and no production data access;
- runtime behavior: no worker loop, no autonomous execution, and no runtime/model-mode integration;
- portability behavior: no hardcoded infrastructure, provider, endpoint, bucket, queue, account, host, or credential assumptions;
- verification: targeted test, full `npm run ci`, static scan for private evidence and scope drift, and independent review if the PR changes future safety or execution posture.

## When to pause for external advice

External advisor feedback is useful at phase boundaries, especially if it challenges the sequence from validation to product-facing runtime. Treat that feedback as consultative. Reconcile it against merged repo state before acting.

If an advisor recommends additional provider comparison, corpus expansion, live execution, production deployment, or runtime/model-mode integration, convert the recommendation into a bounded proposal first. Do not execute it until the repository contains the corresponding approval packet, safety tests, and sanitized status plan.
