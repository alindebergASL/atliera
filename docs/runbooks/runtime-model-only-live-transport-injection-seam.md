# Runtime Model-Only Live Transport Injection Seam

Status: no-call injection seam contract. This PR does not execute a provider call.

This PR proves only the injected transport boundary / no-call implementation seam. It does not authorize the live proof, does not execute the live proof, and does not implement the real model-only live transport. The actual live call still requires a fresh approval packet and a separate execution PR.

## What this PR adds

The injection seam accepts:

- a `providerRef` and `modelLabel` matching the approved route boundary;
- a `maxCostUsd <= 1` budget cap;
- an injected `transport` callable typed as
  `(request: ModelProviderRequest) => Promise<ModelProviderResponse>`,
  validated at bind time to be a function of arity 1.

`proveInjectionSeamNoCall(request, responseFixture)` validates the
candidate request and candidate response using the same exact-shape
rules as the merged no-call harness, and emits a sanitized proof. The
seam holds the transport callable by reference but never invokes it
anywhere in this PR.

## Required boundary

- accepts only Atliera `ModelProviderRequest`
- returns only Atliera `ModelProviderResponse`
- exact top-level request shape
- exact top-level response shape
- synthetic request input graph ref (`corpus/synthetic-` prefix)
- synthetic prompt contract ref (`prompts/synthetic-` prefix)
- safe provider/model logical IDs with no slash, scheme, or traversal characters
- plain own-data objects only; no prototype-backed fields, accessors, symbols, or non-enumerable smuggling
- response cost amount within the approved cap
- max_cost_usd: 1
- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no paid fallback
- no production writes
- no provider comparison
- no default model selection
- no provider lock-in

## Sanitization and non-authorization markers

- provider_calls_executed: 0
- provider_spend: false
- transport_invoked: false
- transport_injection_seam_proven: true
- model_only_live_transport_implemented: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true
- no automatic retry

## Interpretation limits

- This proves only the no-call injection seam: the transport callable can be plugged in and the candidate request/response shape is validated, but the transport is never invoked in this PR.
- This does not prove a live transport.
- This does not authorize a live proof.
- This does not authorize a comparison run.
- This does not authorize candidate calls.
- This does not select a default model.
- This does not claim production, product, or launch readiness.
- A future live proof still requires a fresh approval packet and private raw evidence outside the repository.
