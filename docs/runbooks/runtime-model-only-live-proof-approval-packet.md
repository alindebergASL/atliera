# Runtime Model-Only Live Proof Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute the live proof.

This packet authorizes exactly one future bounded runtime model-only live proof attempt and nothing more. It binds together the two merged building blocks and the single-call envelope they must run inside. It is a paper authorization only: merging this PR runs no provider call.

The fresh one-call approval packet that builds on the now-proven no-call `model-only-codex-auth` boundary is `runtime-model-only-live-proof-one-call-approval-packet.md`.

## Prerequisites (merged building blocks)

- PR #166 merged a no-spend activation/preflight wrapper reporting `ready_for_one_synthetic_live_proof: true` while preserving zero-call/non-authorizing markers.
- PR #170 merged the runtime model-only live transport harness (`src/model/runtime-model-only-live-transport-harness.ts`): a no-call contract over an injected transport, validating exact request/response shape with `provider_calls_executed: 0` and `model_only_live_transport_implemented: false`.
- PR #171 merged the runtime model-only live proof status writer (`src/model/runtime-model-only-live-proof-status.ts`): the sanitized status writer through which the outcome of the attempt must be recorded.

## Approved single-call envelope

This is the entire allowed surface for the one attempt:

- one approved route/provider boundary:
  - route_ref: gpt-5.5-openai-codex-20260602a
  - provider_ref: openai-codex
  - model_label: gpt-5.5
- at most one provider call
- approved max cost <= $1 (max_cost_usd: 1)
- activation corpus ref: `external-corpus/synthetic-runtime-model-only-live-proof.json`
- request input graph ref: `corpus/synthetic-runtime-model-only-live-proof.json`
- prompt ref: `prompts/synthetic-runtime-model-only-live-proof-v1`
- sanitized public evidence only
- private raw evidence must remain outside the repository
- the completed, blocked, or exception status must be recorded through the status writer

## Status recording (through the merged status writer)

The single attempt's outcome must be recorded only as a sanitized status produced by the runtime model-only live proof status writer. The writer's accounting invariants bound what each outcome may claim:

- blocked: provider_calls_executed must be 0; no accepted output; no stable error code.
- exception: may record at most one provider call but must not claim accepted output.
- completed: requires exactly one provider call and accepted_output_received: true, within the approved cost cap.

No raw request, raw response, model output, private evidence, credentials, environment variables, or stack traces may be committed; only the writer's sanitized markers below are published:

- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false

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

## Required non-authorizing markers

- retry_requires_new_approval: true
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Decision rules

- If preflight fails, record sanitized blocked status only.
- If the provider request fails, record sanitized failure status only.
- If the provider returns malformed or non-exact JSON, record sanitized failure status only.
- Do not retry automatically. Any retry requires a fresh approval packet.
- Do not broaden scope to tools, search, files, shell, plugins, MCP, retrieval, comparison, production writes, production deployment, or any other provider/model route.
- A successful result may prove only this exact tiny synthetic live proof route. It must not claim production readiness, general model quality, default model selection, comparison authorization, or any launch claim.

## Interpretation limits

- This packet does not run a provider call.
- This packet does not select a default model.
- This packet does not prove production readiness.
- This packet does not authorize retries or comparison runs.
- Any future live proof beyond this single attempt still requires a fresh approval packet and private raw evidence outside the repository.
