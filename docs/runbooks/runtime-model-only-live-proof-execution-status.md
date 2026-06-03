# Runtime Model-Only Live Proof Execution Status

Status: completed for one approved output-contract-compatible synthetic provider request.

Approval packet: `runtime-model-only-live-proof-output-contract-approval-packet.md`.

This status records the separate execution step allowed by the output-contract approval packet merged in PR #183. The output-contract-compatible attempt was performed after PR #183 merged. It is a sanitized public status only; raw request, raw response, provider body details, stack traces, model output, credentials, and private evidence remain outside the repository.

## Prior attempt history

Earlier approval packets were consumed before this output-contract-compatible attempt:

- PR #176 approved exactly one synthetic attempt.
- PR #177 recorded that attempt as a sanitized exception.
- PR #178 approved exactly one corrected retry.
- PR #179 recorded that corrected retry as a sanitized exception.
- PR #180 approved exactly one parameter-compatible attempt.
- PR #181 recorded that parameter-compatible attempt as a sanitized exception.
- PR #182 merged the no-call output-contract collector and guardrail.
- PR #183 approved exactly one output-contract-compatible attempt.

This document records the PR #183 output-contract-compatible attempt only.

## Output-contract-compatible attempt outcome

The output-contract-compatible attempt used the approved collector correction from PR #182: streamed `response.output_text.delta` text was the canonical output source, completed item text was not concatenated with delta text, and strict exact JSON proof parsing was enforced.

Sanitized outcome:

- status: completed
- reason_code: synthetic_model_only_live_proof_completed
- stable_error_code: none
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- provider_calls_executed: 1
- provider_spend: false
- observed_cost_usd: 0
- approved_max_cost_usd: 1
- accepted_output_received: true
- output_source: delta
- input_tokens_observed: 125
- output_tokens_observed: 16
- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false
- raw_evidence_committed: false

## Request boundary preserved

The output-contract-compatible attempt stayed within the approved model-only boundary:

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

## What this proves

This proves only the exact tiny synthetic model-only route under the approved boundary:

- the Codex-auth model-only route was reachable for this synthetic request
- exactly one provider request was attempted
- the delta-first output collector produced one accepted proof object
- the accepted proof object satisfied the exact top-level output contract
- no public raw/private evidence was committed

## Non-authorizing markers

This status is not an approval packet and does not authorize another provider request.

- max_attempts: 1
- one_call_only: true
- output_contract_compatible_attempt_only: true
- prior_approval_consumed: true
- corrected_retry_approval_consumed: true
- parameter_compatible_approval_consumed: true
- output_contract_approval_consumed: true
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

- live proof completed for this exact synthetic route only
- no automatic retry
- no default model selected
- no provider comparison performed
- no production readiness claim
- no product readiness claim
- no launch readiness claim

Any further attempt or broader validation requires another fresh approval packet before execution. Do not treat PR #176, PR #178, PR #180, or PR #183 as reusable authorization.
