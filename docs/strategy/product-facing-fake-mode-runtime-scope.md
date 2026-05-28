# Product-Facing Fake-Mode Runtime Scope

Status: Accepted

Last updated: 2026-05-28

## Purpose

This document defines the narrow product-facing fake-mode runtime phase that follows `docs/strategy/first-validation-cycle-exit.md`.

The first validation cycle produced a useful tiny-corpus signal: useful 3, weak-but-valid 0, zero-output 0, unsupported/invented 0, contract failure 0, and observed cost $0.00. That is enough to start product-surface work that renders account intelligence through Atliera surfaces. It is not enough to claim product readiness, production readiness, broad-corpus quality, provider comparison, or launch readiness.

## Current implementation anchor

The first implementation anchor is `src/runtime/workshop-preview.ts` and its public helpers `prepareRuntimeWorkshopPreview(...)` and `prepareRuntimeWorkshopHtmlPreview(...)`. The first operator-facing smoke path is `src/cli/runtime-workshop-preview.ts`, which emits a sanitized JSON report or stdout-only HTML from a deterministic fake-mode runtime.

Those helpers are the permitted shape for this phase:

- it runs runtime preflight before reading graph state;
- it requires `MODEL_PROVIDER=fake`;
- it remains deterministic/fake-mode;
- it builds a Workshop view model from existing validated graph-backed outputs supplied through the runtime graph snapshot boundary;
- it reports `providerCallsMade: 0`;
- it reports `productionWrites: false`;
- it does not return the full runtime object;
- it does not start servers;
- it does not construct clients;
- it does not call model adapters or providers;
- it does not write graph state.

## In scope

The product-facing fake-mode runtime phase may add small, reviewable PRs that:

- render existing validated graph-backed outputs through Workshop or adjacent product-facing view-model code;
- add deterministic checked-in fixtures shaped like sanitized graph bundles when a test requires inspectable input;
- load already-sanitized validation artifacts or graph bundles if they are safe for repository use;
- improve view-model formatting, empty-state handling, sparse-account handling, and lens rendering;
- preserve no new provider calls and no provider spend;
- preserve no runtime/model-mode integration;
- preserve no production deployment;
- preserve no production writes;
- keep provider-specific details outside product logic;
- verify behavior with targeted tests, full CI, static scan, and independent review for safety-relevant changes.

## Out of scope

This phase must not add or imply:

- live provider execution;
- provider spend;
- provider comparison;
- corpus expansion;
- launch-readiness assessment;
- product-readiness assessment;
- production deployment;
- production writes;
- runtime/model-mode integration;
- worker-loop or autonomous runtime execution;
- customer-data access;
- provider-specific product behavior;
- hardcoded infrastructure, endpoint, bucket, account, host, credential, or private evidence references.

Any work in those categories requires a separate explicit approval packet before execution and a later sanitized status record.

## Input boundary

The preferred input is existing validated graph-backed outputs from the first validation cycle, routed through sanitized graph bundles, checked-in deterministic fixtures, or a caller-supplied runtime graph snapshot. The product surface must treat those inputs as bounded examples, not as proof that all account shapes are supported.

A product-facing fake-mode PR may use deterministic fixtures when repository-safe validated outputs are not available in the public tree. If a PR claims to render validated output rather than fixture-shaped output, it must cite the sanitized validation record it uses and must not read raw evidence.

## Known limitations

These limitations are part of the scope, not later footnotes:

- Fake-mode product work can mask integration gaps. Rendering deterministic graph snapshots proves the product surface can render those snapshots; it does not prove future real-provider outputs will have the same variety, completeness, or shape.
- The first validation cycle was useful on three roles. It does not prove product usefulness at scale, broad-corpus coverage, production load behavior, or customer readiness.
- Provider portability is an architectural commitment. The first validation cycle does not prove multi-provider validation; it validated one approved provider route behind the `ModelProvider` boundary.
- Budget gates were traversed at $0.00. That proves the no-spend path and ledger traversal for this route; it does not prove paid-spend enforcement under nonzero provider cost.
- The response contract was validated against one approved provider route. It does not guarantee all provider response shapes from future gateway or direct provider APIs.
- Product rendering should expect sparse accounts, unusual source patterns, missing lens content, and empty sections even when the first tiny corpus produced useful output.

## Verification expectations

Each PR in this phase should show:

- a targeted test for the product-facing behavior;
- proof that fake-mode gating remains intact when runtime code is touched;
- proof that `providerCallsMade: 0` and `productionWrites: false` are preserved for preview/report helpers;
- full `npm run ci` passing;
- a staged-diff static scan for private evidence and scope drift;
- independent review when the PR changes validation interpretation, approval posture, runtime boundaries, or product-facing safety claims.

## Exit from this phase

This phase exits only when there is a useful fake-mode Workshop/product surface that can render bounded graph-backed account intelligence without spend or production writes. Exiting this phase does not approve live model-mode product operation. A later live-provider product run requires a separate explicit approval packet.
