# Runtime Model-Only Tiny Live Runtime Proof Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute the live proof.

This packet records the next bounded live step after the no-call runtime smoke and deterministic product vertical slice. It is not a standing approval. It permits only one future tiny runtime/model-mode proof attempt, in a separate later execution/status PR, after this packet is merged and the pre-run checks still match this scope.

## Prerequisites

- fake_or_throwing_no_call_smoke_prerequisite: completed
- deterministic_product_vertical_slice_prerequisite: completed
- no_call_status_ref: `runtime-model-only-tiny-runtime-integration-no-call-smoke-status.md`
- product_slice_status_ref: `runtime-model-only-product-vertical-slice-deterministic-status.md`
- route_selection_policy: explicit-route-ref-only

## Approved future attempt scope

- approval_id: runtime-model-only-tiny-live-runtime-proof-20260604j
- approved_future_attempts: 1
- one_call_only: true
- max_provider_calls: 1
- max_cost_usd: 1
- separate later execution status PR required: true
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- route_kind: candidate
- corpus_scope: synthetic-or-approved-tiny-product-slice-only
- output_scope: exact public contract plus sanitized status facts only
- stop_on_exception: true
- retry_requires_new_approval: true

## Required pre-run checks

Before the future execution may send its single provider request, it must verify:

- current route catalog still contains the exact route_ref
- route selection uses route_ref only, not model label shortcuts
- runtime composition binds through the ModelProvider interface
- execution preflight passes with the matching approval_id and cost cap
- no tools
- no web search
- no online model variant
- no plugins
- no MCP
- no shell
- no file access
- no retrieval
- no session carryover
- no background orchestrator
- no production writes
- no provider comparison
- no default model selection
- no provider lock-in

If any pre-run check fails, the later execution PR must record a blocked status with provider_calls_executed: 0 and provider_spend: false. It must not substitute an operator session, autonomous agent, shell command, web retrieval, broader product-preview run, or different model/provider route.

## Public status requirements for the later execution PR

The later status may record only bounded facts:

- status: completed, exception, or blocked
- reason_code or stable_error_code
- route_ref, provider_ref, model_label
- provider_calls_executed
- provider_spend
- observed_cost_usd
- token counts if publicly safe
- whether accepted output satisfied the exact output contract
- non-authorizing boundary markers

The later status must not commit prompt text, model text, source material, account references, provider bodies, headers, local evidence locations, logs, secret material, client handles, or request identifiers.

## Non-claims

- default_model_selection_claim: false
- provider_lock_in: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

A successful future attempt would prove only the exact tiny runtime/model-mode route under this approved boundary. It would not approve provider comparison, corpus expansion, product-preview expansion, graph ingestion, production use, tool/search/plugin/retrieval changes, launch, or another provider request.
