# Runtime GPT-5.5 Smoke Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute the smoke.

This packet approves a future bounded runtime-model smoke only after this packet lands and only within the constraints below.

Approved route:
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- route_kind: candidate

Scope:
- at most one provider call
- operation: synthetic runtime model smoke
- synthetic-only corpus: external-corpus/runtime-model-gpt55-smoke.json
- prompt contract ref: prompt-contracts/runtime-model-gpt55-smoke-v1
- max_cost_usd: 1
- private raw evidence must remain outside the repository
- commit only a sanitized status follow-up

Forbidden surfaces:
- no tools
- no web search
- no shell
- no file access
- no plugins
- no MCP
- no retrieval
- no paid fallback
- no production writes
- no broad provider comparison
- no default model selection
- no provider lock-in

Required status markers for the follow-up:
- retry_requires_new_approval: true
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

Decision rules:
- If the safe runtime transport is unavailable, the follow-up must record a sanitized blocked status rather than substituting another surface.
- If the call fails, record sanitized failure status only; do not retry automatically.
- If the call succeeds, record only bounded smoke facts and keep all readiness/default-selection/provider-lock-in markers false.
