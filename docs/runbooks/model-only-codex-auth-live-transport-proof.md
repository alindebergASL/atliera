# Model-Only Codex-Auth Live Transport Proof

Status: no-call prerequisite proof contract. This PR does not execute a provider call.

This document records the no-call `model-only-codex-auth` live transport boundary proof added on top of the merged building blocks (PR #171 sanitized status writer, PR #172 approval packet, PR #173 no-call transport injection seam, PR #174 fail-closed execution gate). It proves only that the intended transport boundary SHAPE is internally consistent and safe. It is a prerequisite, not the live proof itself.

## What this PR adds, and what it does not

This PR adds a deterministic helper, `proveModelOnlyCodexAuthLiveTransport`, that consumes a sanitized plain-data descriptor of the intended `model-only-codex-auth` live transport boundary and proves the boundary shape with no provider call.

This PR does NOT:

- execute a provider call;
- spend;
- implement the real model-only live transport;
- reference or invoke any transport callable;
- authorize a live proof, a candidate call, or a comparison run;
- select a default model or claim production, product, or launch readiness.

Proving the boundary shape here is a no-call boundary-contract proof. It is strictly weaker than a live proof. A real one-call live proof still requires a separate fresh approval packet and a separate execution PR, with private raw evidence kept outside the repository.

## Relationship to the merged building blocks

- PR #173's no-call transport injection seam holds an injected transport-shaped callable by reference but never invokes it.
- PR #174's execution gate fails closed and records a blocked status because no proven injected `model-only-codex-auth` live transport (and no resolvable model-only credential) is available in this repository.
- This proof is the prerequisite that the intended boundary descriptor must satisfy before a separate fresh approval can authorize a one-call live proof. It composes with the seam and the gate as a no-call, deterministic check only; it never references or invokes any transport callable.

## Approved route and scope

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- approved_max_cost_usd: 1
- approval packet: `runtime-model-only-live-proof-approval-packet.md`

The proof refuses any other route, provider, model, transport kind, or budget.

## Proven boundary shape (all required true)

The proof requires every boundary safety fact to hold, and fails closed if any is broadened, false, or missing:

- accepts only an Atliera `ModelProviderRequest`
- returns only an Atliera `ModelProviderResponse`
- exact request shape
- exact response shape
- synthetic-only scope
- credential neutral
- private evidence kept outside the repository
- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no session carryover

## Sanitized outcome markers

- model_only_transport_proven: true
- model_only_live_transport_implemented: false
- transport_invoked: false
- provider_calls_executed: 0
- provider_spend: false
- observed_cost_usd: 0
- raw_evidence_committed: false
- credential_value_observed: false
- no_tools: true
- no_shell: true
- no_file_access: true
- no_web_search: true
- no_plugins: true
- no_mcp: true
- no_retrieval: true
- no_session_carryover: true

## Fail-closed conditions

The proof throws (records nothing) when any of the following holds:

- route_ref, provider_ref, model_label, transport_kind, or approved_max_cost_usd does not match the approved boundary;
- any boundary safety fact is broadened, false, or missing;
- transport_invoked is true;
- provider_calls_executed is nonzero;
- observed_cost_usd is nonzero;
- raw_evidence_committed is true;
- the descriptor carries extra, prototype-backed, accessor, or symbol-keyed fields, or any private-shaped field.

It materializes frozen descriptor snapshots of the root and every nested object before semantic validation, and consumes only those frozen snapshots; it never rereads the untrusted original.

## Forbidden surfaces

- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no paid fallback
- no production writes
- no production deployment
- no provider comparison
- no default model selection
- no provider lock-in
- no autonomous-agent substitution for the model-only transport

## Interpretation limits

- model_only_live_transport_implemented: false
- transport_invoked: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Follow-up

- retry_requires_new_approval: true
- requires_fresh_approval_before_live_proof: true
- no automatic retry
- next_required_step: obtain a fresh approval packet before any provider access. Even with this no-call boundary proof satisfied, a separate execution PR is required to run the single approved one-call live proof, and private raw evidence must remain outside the repository.
