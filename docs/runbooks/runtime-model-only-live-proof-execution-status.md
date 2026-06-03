# Runtime Model-Only Live Proof Execution Status

Status: exception after one approved synthetic provider request.

Approval packet: `runtime-model-only-live-proof-one-call-approval-packet.md`.

This status records the separate execution/status PR required by the one-call approval packet merged in PR #176. Exactly one synthetic provider request was attempted under the approved route/provider/model/transport envelope. The request did not produce an accepted model output, so the public status is a sanitized exception outcome.

This PR records status only. It does not authorize another provider call and does not execute a retry. Retry requires a fresh approval packet.

## Sanitized outcome

- status: exception
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- reason_code: synthetic_model_only_live_proof_exception
- stable_error_code: provider_call_or_parse_failed
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

## Approved envelope checked

- max_attempts: 1
- one_call_only: true
- transport_kind: model-only-codex-auth
- synthetic_model_only_scope: true
- no production data
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

## Attempt interpretation

The single approved attempt consumed the one-call approval envelope. The outcome is not completed because accepted_output_received is false.

The exception was recorded as a stable public code only. Raw request content, raw provider output, provider body details, credential material, stack traces, and private evidence remain outside the repository and are not reproduced here.

## Interpretation limits

- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Follow-up

- retry_requires_new_approval: true
- no automatic retry
- any retry requires a fresh approval packet
- no live proof completed
- no accepted model output recorded
