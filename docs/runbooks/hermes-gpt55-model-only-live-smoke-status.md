# Hermes GPT-5.5 Model-only Live Smoke Status

Status: sanitized failed single-call smoke record.

This document records the approved single tiny synthetic GPT-5.5 smoke attempt after the no-spend request-plan, injected proof seam, and activation preflight proof were merged. The approved cap was `approved_max_cost_usd: 1.00`.

## Scope

- provider route: `openai-codex`;
- API mode: `codex_responses`;
- model: `gpt-5.5`;
- synthetic_only: true;
- prompt ref: `prompts/synthetic-gpt55-smoke-v1.json`;
- corpus ref: `external-corpus/synthetic-gpt55-smoke-v1`;
- request surface: Responses-shaped, no tools, no retrieval, no web, no MCP, no plugins;
- private evidence retained outside the repository.

This was one operational smoke attempt only. It does not evaluate provider quality, does not select a production/default model, does not establish launch/product/production readiness, and does not approve broader candidate execution.

## Sanitized outcome

- provider_calls_executed: 1
- provider_spend_authorized: true
- approved_max_cost_usd: 1.00
- status: exception
- error_code: BadRequestError
- latency_ms: 1113
- observed_output_chars: 0
- observed_total_tokens: null
- raw_response_sha256: null
- output_sha256: null
- model_only_transport_proven: false
- authorizes_comparison_run: false

The failed attempt produced no accepted model output and therefore did not prove the model-only transport.

## Request-surface markers

- tools_sent: false
- tool_choice_sent: false
- parallel_tool_calls_sent: false
- web_search_sent: false
- mcp_sent: false
- plugins_sent: false
- retrieval_sent: false
- store: false

## Evidence and credential boundary

- raw_evidence_committed: false
- credential_value_observed: false
- private_account_data_used: false
- operator_session_context_used: false
- skills_or_tools_exposed_to_candidate: false

Private local evidence retained outside the repository contains only the sanitized wrapper artifacts needed to diagnose the failed attempt. No credential values, auth contents, headers, private account data, model output text, provider body, or local private evidence paths are committed here.

## Next step

- retry_requires_new_approval: true
- proposed_next_action: inspect the request-shape mismatch using private evidence outside the repo, update the no-spend request-shape proof if needed, then request separate approval before any additional provider call.

This status preserves the comparison blocker. A later GPT-5.5 comparison or retry must have its own explicit approval, cap, and sanitized evidence record.
