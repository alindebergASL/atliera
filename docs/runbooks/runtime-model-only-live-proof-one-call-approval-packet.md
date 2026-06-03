# Runtime Model-Only Live Proof One-Call Approval Packet

Status: pre-run docs-only one-call approval packet. This PR does not execute a provider call.

This packet authorizes exactly one future synthetic live proof attempt through the now-proven no-call `model-only-codex-auth` boundary, and nothing more. It is a fresh approval packet that supersedes nothing it does not name: it builds on the merged building blocks and binds the single-call envelope they must run inside. It is a paper authorization only. Merging this PR runs no provider call and adds no runtime source that can call a provider.

This packet does not execute the live proof. The actual execution and the sanitized status update must be a separate later PR, performed only after this approval packet is merged and only after the single approved call is carried out under the approved boundary.

## Prerequisites (merged building blocks)

This one-call approval rests on the merged no-call building blocks. Each is a prerequisite; none is a substitute for a live proof.

- PR #173 merged the no-call runtime model-only live transport injection seam: it holds an injected transport-shaped callable by reference but never invokes it.
- PR #174 merged the fail-closed runtime model-only live proof execution gate: it consumes an already-sanitized transport-availability fact and records a blocked status because no proven injected `model-only-codex-auth` live transport and no resolvable model-only credential are available in this repository.
- PR #175 merged the no-call `model-only-codex-auth` live transport boundary proof (`model-only-codex-auth-live-transport-proof.md`): it proves only that the intended transport boundary shape is internally consistent and safe, with no provider call. It is strictly weaker than a live proof.

The no-call boundary is now proven. This packet authorizes one call across it; it does not weaken the seam, the gate, or the boundary proof.

## Approved single-call envelope

This is the entire allowed surface for the one attempt:

- one approved route/provider/transport boundary:
  - route_ref: gpt-5.5-openai-codex-20260602a
  - provider_ref: openai-codex
  - model_label: gpt-5.5
  - transport_kind: model-only-codex-auth
- at most one provider call (max_attempts: 1)
- approved max cost <= $1 (max_cost_usd: 1)
- scope: synthetic model-only proof, no production data
- sanitized public evidence only
- private raw evidence must remain outside the repository
- the completed, blocked, or exception status must be recorded through the merged status writer in a separate later PR

The packet refuses any other route, provider, model, transport kind, budget, or attempt count.

## Status recording (in a separate later PR)

The single attempt's outcome must be recorded only as a sanitized status produced by the runtime model-only live proof status writer, and only in a separate later execution PR. The writer's accounting invariants bound what each outcome may claim:

- blocked: provider_calls_executed must be 0; no accepted output; no stable error code.
- exception: may record at most one provider call but must not claim accepted output.
- completed: requires exactly one provider call and accepted_output_received: true, within the approved cost cap.

No raw request, raw response, model output, private evidence, credentials, environment variables, or stack traces may be committed; only the writer's sanitized markers below are published:

- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Forbidden surfaces

- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no session carryover
- no paid fallback
- no production writes
- no production deployment
- no provider comparison
- no default model selection
- no provider lock-in
- no autonomous-agent substitution for the model-only transport

## Required non-authorizing markers

- one_call_only: true
- max_attempts: 1
- retry_requires_new_approval: true
- provider_call_executed_in_this_pr: false
- adds_runtime_provider_call_source: false
- execution_requires_separate_later_pr: true
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Decision rules

- If preflight fails, record sanitized blocked status only, in the later execution PR.
- If the provider request fails, record sanitized failure status only.
- If the provider returns malformed or non-exact JSON, record sanitized failure status only.
- Do not retry automatically. Any retry requires a fresh approval packet.
- Do not broaden scope to tools, search, files, shell, plugins, MCP, retrieval, session carryover, comparison, candidate calls, production writes, production deployment, or any other provider/model/transport route.
- A successful result may prove only this exact tiny synthetic live proof route. It must not claim production readiness, general model quality, default model selection, comparison authorization, provider lock-in, or any launch claim.

## Interpretation limits

- This packet does not run a provider call.
- This packet adds no runtime source that can call a provider.
- This packet does not select a default model.
- This packet does not prove production readiness.
- This packet does not authorize retries, candidate calls, or comparison runs.
- The single attempt and its sanitized status update belong to a separate later PR, after this packet is merged and after the call is performed under the approved boundary.
- Any future live proof beyond this single attempt still requires a fresh approval packet and private raw evidence outside the repository.
