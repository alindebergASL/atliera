# Runtime Model-Only Live Proof Execution Status

Status: exception after one approved parameter-compatible synthetic provider request.

Approval packet: `runtime-model-only-live-proof-parameter-compatible-approval-packet.md`.

This status records the separate execution step allowed by the parameter-compatible approval packet. The parameter-compatible attempt was performed after PR #180 merged. It is a sanitized public status only; raw request, raw response, provider body details, stack traces, model output, credentials, and private evidence remain outside the repository.

## Prior attempt history

Earlier approval packets were already consumed before this parameter-compatible attempt:

- PR #176 approved exactly one synthetic attempt.
- PR #177 recorded that attempt as an exception.
- PR #178 approved exactly one corrected retry.
- PR #179 recorded that corrected retry as an exception.
- PR #180 recorded the sanitized diagnostic category and approved exactly one parameter-compatible attempt.

This document records the PR #180 parameter-compatible attempt only.

## Parameter-compatible attempt outcome

The parameter-compatible attempt used the approved execution-envelope correction: streaming remained enabled and the generic output-token-cap parameter was omitted for this Codex auxiliary route. The provider request was attempted once. It did not produce accepted output for the public proof contract.

Sanitized outcome:

- status: exception
- reason_code: synthetic_model_only_live_proof_exception
- stable_error_code: provider_call_or_parse_failed
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- provider_calls_executed: 1
- provider_spend: false
- observed_cost_usd: 0
- approved_max_cost_usd: 1
- accepted_output_received: false
- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Request boundary preserved

The parameter-compatible attempt stayed within the approved model-only boundary:

- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no session carryover
- no provider comparison
- no default model selection
- no provider lock-in
- no production writes
- no production deployment
- no autonomous-agent substitution

## Non-authorizing markers

This status is not an approval packet and does not authorize another provider request.

- max_attempts: 1
- one_call_only: true
- parameter_compatible_retry_only: true
- prior_approval_consumed: true
- corrected_retry_approval_consumed: true
- parameter_compatible_approval_consumed: true
- prior_exception_count: 3
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true

## Interpretation

- no automatic retry
- no live proof completed
- no accepted model output recorded
- no default model selected
- no provider comparison performed
- no production readiness claim
- no product readiness claim
- no launch readiness claim

Any further attempt requires another fresh approval packet before execution. Do not treat PR #176, PR #178, or PR #180 as reusable authorization.
