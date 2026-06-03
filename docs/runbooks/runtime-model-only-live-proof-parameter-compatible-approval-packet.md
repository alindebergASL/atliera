# Runtime Model-Only Live Proof Parameter-Compatible Approval Packet

Status: pre-run docs-only parameter-compatible approval packet. This PR does not execute a provider call.

This packet records the sanitized private diagnostic category from the two consumed attempts and authorizes exactly one future synthetic model-only live proof attempt with one specifically corrected execution envelope. It adds no runtime provider-call source.

## Sanitized diagnostic summary

Two prior approval envelopes were consumed and both ended as sanitized exceptions:

- PR #176 approved exactly one synthetic attempt.
- PR #177 recorded that attempt as an exception with provider_calls_executed: 1 and accepted_output_received: false.
- PR #178 approved exactly one corrected retry.
- PR #179 recorded that corrected retry as an exception with provider_calls_executed: 1 and accepted_output_received: false.

Private root-cause category: codex_aux_responses_parameter_compatibility.

The root cause is classified as a mechanical execution-envelope compatibility issue, not a model-quality issue and not a product-readiness issue. The first consumed attempt proved the Codex auxiliary Responses route requires a streaming request envelope. The corrected retry then reached a later request-validation boundary and showed that the auxiliary route rejects the output-token-cap parameter used by the generic Responses SDK path.

This public summary intentionally omits raw provider bodies, stack traces, raw requests, raw responses, model output, credential details, and private evidence locations.

## Specifically approved correction

The next attempt may change only this execution-envelope class:

- keep stream mode enabled for the Codex auxiliary Responses route
- omit the generic Responses output-token-cap parameter for this route
- preserve the same synthetic prompt contract and exact route/provider/model/transport boundary
- preserve the same no-tools/no-retrieval/no-session-carryover constraints

The correction must not broaden model, route, provider, transport, prompt scope, data scope, tool scope, budget, retry count, evidence policy, comparison scope, or readiness claims.

## Approved single-attempt envelope

This is the entire approved surface for the next attempt:

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- max_attempts: 1
- one_call_only: true
- parameter_compatible_retry_only: true
- approved max cost <= $1
- max_cost_usd: 1
- scope: synthetic model-only proof, no production data
- sanitized public evidence only
- private raw evidence must remain outside the repository
- the completed, blocked, or exception status must be recorded through the merged status writer in a separate later PR

## Required request-surface constraints

The later execution must preserve these constraints:

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

## Status recording in separate later PR

The actual attempt and sanitized status update must happen after this packet is merged and in a separate later PR.

The status writer outcome rules remain:

- blocked: provider_calls_executed must be 0; no accepted output; no stable error code.
- exception: may record at most one provider call but must not claim accepted output.
- completed: requires exactly one provider call and accepted_output_received: true, within the approved cost cap.

No raw request, raw response, model output, private evidence, credentials, environment variables, provider body details, or stack traces may be committed. Only sanitized markers may be published:

- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Non-authorizing markers

- prior_approval_consumed: true
- corrected_retry_approval_consumed: true
- prior_exception_count: 2
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
- If the provider returns malformed or non-exact JSON, record sanitized exception status only.
- Do not retry automatically. Any further attempt after this parameter-compatible attempt requires another fresh approval packet.
- Do not broaden scope to tools, search, files, shell, plugins, MCP, retrieval, session carryover, comparison, candidate calls, production writes, production deployment, or any other provider/model/transport route.
- A successful result may prove only this exact tiny synthetic live proof route. It must not claim production readiness, general model quality, default model selection, comparison authorization, provider lock-in, or any launch claim.
