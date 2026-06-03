# Runtime Model-Only Live Proof Output-Contract Approval Packet

Status: pre-run docs-only output-contract-compatible approval packet. This PR does not execute a provider call.

This packet authorizes exactly one future synthetic model-only live proof attempt using the output-contract collector merged in PR #182. The actual attempt and sanitized status update must happen in a separate later PR.

## Consumed prior approvals

Earlier one-call approval packets were consumed and are not reusable:

- PR #176 approved exactly one synthetic attempt; PR #177 recorded a sanitized exception.
- PR #178 approved exactly one corrected retry; PR #179 recorded a sanitized exception.
- PR #180 approved exactly one parameter-compatible attempt; PR #181 recorded a sanitized exception.

## Required prerequisite

PR #182 must be merged before this approval can be used. It provides the no-call output-contract collector and guardrail:

- collect streamed `response.output_text.delta` text as canonical output when deltas are present
- use `response.output_item.done` text only as fallback when no deltas are present
- never concatenate delta text and completed item text for the same response
- parse exactly one strict JSON object
- require exact top-level keys: `excerpts`, `claims`, `account_objects`
- require each top-level value to be an array
- reject duplicate concatenated JSON objects
- reject markdown fences and prose wrappers
- reject extra keys and non-array values

## Approved single-attempt envelope

This is the entire approved surface for the future attempt:

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- max_attempts: 1
- one_call_only: true
- output_contract_compatible_attempt_only: true
- max_cost_usd: 1
- approved max cost <= $1
- scope: synthetic model-only proof, no production data
- sanitized public evidence only
- private raw evidence must remain outside the repository
- the completed, blocked, or exception status must be recorded in a separate later PR

## Allowed correction class

The next attempt may change only the output collection/validation class proven by PR #182:

- use the canonical delta-first stream collector
- do not concatenate completed item text when delta text exists
- retain strict exact JSON parsing and exact top-level proof keys

The correction must not broaden provider, route, model, transport, prompt/data scope, tool scope, budget, retry count, evidence policy, comparison scope, default model selection, or readiness claims.

## Request-surface constraints

The later execution must preserve:

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

## Evidence policy

No raw request, raw response, raw provider body, model output, private evidence, credential value, environment variable, or stack trace may be committed.

Only sanitized markers may be published:

- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Non-authorizing markers for this PR

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

- If preflight fails, record sanitized blocked status only in the later execution PR.
- If the provider request fails, record sanitized exception status only.
- If output collection or strict JSON parsing fails, record sanitized exception status only.
- If the provider returns exact accepted proof JSON, record sanitized completed status only.
- Do not retry automatically.
- Any further attempt after this output-contract-compatible attempt requires another fresh approval packet.
- A successful result may prove only this exact tiny synthetic live proof route and must not claim production readiness, general model quality, default model selection, provider comparison, provider lock-in, or launch readiness.
