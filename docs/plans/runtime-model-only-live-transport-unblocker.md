# Runtime Model-Only Live Transport Unblocker

Status: implementation plan only. This PR does not execute a provider call.

Blocked status: `runtime-model-only-live-proof-status.md`.

## Problem

The approved tiny live proof is blocked because Atliera does not yet have a proven injected live transport that satisfies the model-only boundary. The available Codex/Hermes surfaces are autonomous agent/operator surfaces and must not be substituted for the approved live proof.

## Required transport boundary

The live transport harness must:

- accepts only Atliera `ModelProviderRequest`;
- returns only Atliera `ModelProviderResponse`;
- enforce exact top-level request shape;
- enforce exact top-level response shape;
- perform at most one provider call;
- cap the approved proof at max_cost_usd: 1;
- keep private raw evidence outside the repository;
- commit sanitized status follow-up only;
- set retry_requires_new_approval: true.

Forbidden surfaces:

- no tools;
- no shell;
- no file access;
- no web search;
- no plugins;
- no MCP;
- no retrieval;
- no paid fallback;
- no production writes;
- no provider comparison;
- no default model selection;
- no production, product, launch, or broad model-quality readiness claim.

The transport must not use Codex/Hermes autonomous agent surfaces and must not use shell/curl as a substitute for a model-only provider transport.

## Concrete implementation slices

1. Contract test: add a failing contract that requires a live transport harness to accept exactly one `ModelProviderRequest` and emit exactly one `ModelProviderResponse`, with fixture-only proof until separately approved.
2. Harness interface: define a small injected interface for the real transport; keep provider-specific SDK/network implementation outside default `src/` safety-scanned runtime paths unless a future PR explicitly relaxes that boundary.
3. Evidence adapter: define the sanitized status writer that records success/failure/blocked markers without raw request, raw response, credential value, authorization header, or private evidence paths.
4. Approval packet: require a fresh approval packet before any real provider call after the harness exists.
5. Live proof PR: execute only the one approved synthetic call; if any preflight or transport requirement fails, record blocked/failure status and stop.

## Acceptance criteria

- A live transport harness exists and is testable without a live call.
- The harness proves exact request/response boundaries before any provider access.
- The harness proves no tools, no shell, no file access, no web search, no plugins, no MCP, and no retrieval.
- The repository can record a sanitized status follow-up for success, failure, or blocked outcomes.
- A future live proof requires a new approval packet and may not retry automatically.
