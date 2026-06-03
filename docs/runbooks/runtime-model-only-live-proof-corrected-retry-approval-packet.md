# Runtime Model-Only Live Proof Corrected Retry Approval Packet

Status: pre-run docs-only corrected-retry approval packet. This PR does not execute a provider call.

This packet authorizes exactly one future corrected synthetic live proof retry after the prior one-call approval packet was consumed and recorded as an exception in PR #177. It is a fresh approval packet only. Merging this PR runs no provider call and adds no runtime source that can call a provider.

This packet does not execute the corrected retry. The actual execution and sanitized status update must be a separate later PR, performed only after this approval packet is merged and only after the single approved retry is carried out under the approved boundary.

## Prior attempt consumed

The prior one-call approval is no longer available for execution:

- PR #176 merged `runtime-model-only-live-proof-one-call-approval-packet.md` and approved exactly one synthetic attempt.
- PR #177 recorded that the one approved synthetic provider request was attempted.
- PR #177 recorded `status: exception`, `provider_calls_executed: 1`, `accepted_output_received: false`, and `stable_error_code: provider_call_or_parse_failed`.
- PR #177 preserved `retry_requires_new_approval: true` and did not authorize another attempt.

This packet is the fresh approval required for one corrected retry. It does not reinterpret PR #176 as reusable.

## Correction boundary

The corrected retry may address only the execution-envelope issue that caused the prior attempt to fail before accepted output was produced. It must not broaden model, route, provider, transport, prompt scope, data scope, tool scope, budget, or retry count.

The corrected retry must still use the same route/provider/model/transport envelope unless a later packet explicitly changes it:

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth

## Approved single-retry envelope

This is the entire allowed surface for the corrected retry:

- max_attempts: 1
- corrected_retry_only: true
- one_call_only: true
- approved max cost <= $1
- max_cost_usd: 1
- scope: synthetic model-only proof, no production data
- sanitized public evidence only
- private raw evidence must remain outside the repository
- the completed, blocked, or exception status must be recorded through the merged status writer in a separate later PR

The packet refuses any other route, provider, model, transport kind, budget, or attempt count.

## Status recording (in a separate later PR)

The corrected retry outcome must be recorded only as a sanitized status produced by the runtime model-only live proof status writer, and only in a separate later execution PR. The writer's accounting invariants bound what each outcome may claim:

- blocked: provider_calls_executed must be 0; no accepted output; no stable error code.
- exception: may record at most one provider call but must not claim accepted output.
- completed: requires exactly one provider call and accepted_output_received: true, within the approved cost cap.

No raw request, raw response, model output, private evidence, credentials, environment variables, provider body details, or stack traces may be committed; only sanitized markers may be published:

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

- prior_approval_consumed: true
- prior_status: exception
- prior_provider_calls_executed: 1
- prior_accepted_output_received: false
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
- retry_requires_new_approval: true

## Decision rules

- If preflight fails, record sanitized blocked status only, in the later execution PR.
- If the provider request fails, record sanitized exception status only.
- If the provider returns malformed or non-exact JSON, record sanitized exception status only.
- Do not retry automatically. Any further attempt after this corrected retry requires another fresh approval packet.
- Do not broaden scope to tools, search, files, shell, plugins, MCP, retrieval, session carryover, comparison, candidate calls, production writes, production deployment, or any other provider/model/transport route.
- A successful result may prove only this exact tiny synthetic live proof route. It must not claim production readiness, general model quality, default model selection, comparison authorization, provider lock-in, or any launch claim.

## Interpretation limits

- This packet does not run a provider call.
- This packet adds no runtime source that can call a provider.
- This packet does not select a default model.
- This packet does not prove production readiness.
- This packet does not authorize more than one corrected retry.
- This packet does not authorize candidate calls or comparison runs.
- The single corrected retry and its sanitized status update belong to a separate later PR, after this packet is merged and after the corrected retry is performed under the approved boundary.
