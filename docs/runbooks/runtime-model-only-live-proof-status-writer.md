# Runtime Model-Only Live Proof Status Writer

Status: sanitized status writer contract. This PR does not execute a provider call.

The status writer defines the public follow-up shape for a future runtime model-only live proof. It accepts only bounded public accounting and scope fields, then emits sanitized status markers for blocked, exception, or completed outcomes.

Required status boundaries:
- at most one provider call may be recorded
- observed cost must not exceed approved_max_cost_usd
- approved_max_cost_usd remains capped at 1
- completed status requires exactly one call and accepted_output_received: true
- blocked status requires provider_calls_executed: 0
- exception status cannot record accepted output
- retry_requires_new_approval: true
- no automatic retry

Sanitization markers:
- raw_request_committed: false
- raw_response_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_value_observed: false

Interpretation markers:
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

Interpretation:
- This is only a deterministic status writer for future sanitized follow-up records.
- It does not prove a live transport.
- It does not authorize a live proof.
- It does not permit provider comparison, production writes, runtime model-provider integration, or default model selection.
- Any future live proof still requires a fresh approval packet and private raw evidence outside the repository.
