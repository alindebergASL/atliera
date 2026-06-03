# Runtime Model-Only Proof Promotion Boundary

Status: no-call promotion-boundary runbook.

This document interprets the completed output-contract-compatible synthetic proof recorded in `runtime-model-only-live-proof-execution-status.md`. It defines what the proof allows us to do next and, more importantly, what it does not authorize.

## Historical proof being interpreted

The completed proof was a tiny synthetic model-only request through the route:

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- proof_status: completed
- provider_calls_executed: 1
- accepted_output_received: true
- output_source: delta

The proof showed that a constrained Codex-auth model-only route can complete one exact tiny JSON contract request when the stream collector uses delta text as the canonical output source.

## What the proof proves

This proof establishes only the following narrow facts:

- the approved route was reachable for one synthetic request
- the request used the model-only boundary
- the delta-first stream collector produced one accepted proof object
- the accepted proof object satisfied the tiny exact output contract
- public repository evidence can remain sanitized while raw evidence stays private

## What the proof does not prove

This proof does not authorize or establish:

- default model selection
- provider lock-in
- provider comparison
- production use
- product readiness
- launch readiness
- broader model quality
- background autonomous orchestration
- uncontrolled retries
- additional provider calls
- controlled-corpus validation
- product-preview validation
- graph ingestion into production state

## Promotion ladder

Future validation should advance through explicit promotion stages. Each live stage requires a fresh approval packet before execution and a separate sanitized status record after execution.

1. Tiny synthetic route proof
   - current state: completed
   - scope: one synthetic proof object only

2. App-owned harness fake-mode proof
   - no provider call
   - proves the application harness can validate approvals, requests, strict output, status lifecycle, idempotency, and sanitized status using an injected fake transport

3. Controlled-corpus model-only run
   - provider call allowed only after a fresh approval packet
   - corpus must be explicitly bounded
   - no tools, web, files, retrieval, plugins, MCP, or session carryover
   - raw evidence private, sanitized status public

4. Product-preview run
   - separate approval required after controlled-corpus status and usefulness assessment
   - no default model selection or readiness claim

5. Provider comparison or default selection
   - separate comparison approval required
   - no default selection until deterministic usefulness evidence and route recency review are complete

6. Production or background orchestration
   - separate design, permissions, queue, audit, and operator-control validation required
   - Hermes-like orchestration may trigger predefined harness jobs only if explicitly authorized and must not bypass the Atliera-owned harness

## Next allowed work

The next allowed work is no-call harness design and fake-mode harness implementation. The next live work, if approved later, should be a tiny controlled-corpus model-only run through the Atliera-owned harness boundary.

## Non-authorizing markers

- provider_call_executed_in_this_pr: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_controlled_corpus_run: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator: false
- authorizes_production_use: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true
