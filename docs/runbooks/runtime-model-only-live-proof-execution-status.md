# Runtime Model-Only Live Proof Execution Status

Status: fail-closed execution status contract. This PR does not execute a provider call.

This status records the outcome of the runtime model-only live proof execution gate after the merged building blocks (PR #170 transport harness, PR #171 status writer, PR #172 approval packet, PR #173 no-call transport injection seam). It is produced through the merged sanitized status writer and records exactly one outcome: blocked before provider access.

## Why this PR adds a gate, not a call

The injection seam (PR #173) holds an injected transport-shaped callable by reference but never invokes it. This slice adds the execution decision that sits on top of that seam: it consumes an already-sanitized transport-availability fact and decides whether the one approved synthetic live proof attempt may proceed.

No proven model-only live transport, and no resolvable model-only credential, is available in this repository. The available Codex/Hermes surface remains an autonomous agent execution surface, not a proven injected `model-only-codex-auth` transport. Substituting Claude Code, a Hermes operator session, shell, curl, or any autonomous agent surface for the model-only provider transport is forbidden. Therefore the gate fails closed and records a blocked status before provider access.

## Sanitized outcome

- status: blocked
- reason_code: model_only_live_transport_unavailable
- provider_calls_executed: 0
- provider_spend: false
- observed_cost_usd: 0
- approved_max_cost_usd: 1
- accepted_output_received: false
- stable_error_code: none
- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Route and scope

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- approval packet: `runtime-model-only-live-proof-approval-packet.md`
- request input graph ref: `corpus/synthetic-`
- prompt ref: `prompts/synthetic-`

## Gate behavior

- The gate validates the context against the single approved route boundary and refuses any other route, provider, model, or budget.
- The gate accepts only the unavailable state: both availability facts must be false. A claimed-available transport or credential is refused rather than turned into an accepted-output status, because real execution requires a fresh approval packet and a separate execution PR.
- The gate never references or invokes any transport callable.
- The gate emits only the status writer's sanitized, non-authorizing markers.

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

## Interpretation limits

- model_only_transport_proven: false
- model_only_live_transport_implemented: false
- transport_invoked: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- default_production_model_selection: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Follow-up

- retry_requires_new_approval: true
- no automatic retry
- next_required_step: provide a proven injected `model-only-codex-auth` live transport that accepts only Atliera `ModelProviderRequest`, returns only Atliera `ModelProviderResponse`, and proves no tools, no shell, no file access, no web search, no plugins, no MCP, no retrieval, private raw evidence outside the repository, and exact one-call cost/status accounting. Any future live proof still requires a fresh approval packet.
