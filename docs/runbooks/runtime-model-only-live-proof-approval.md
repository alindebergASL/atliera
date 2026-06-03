# Runtime Model-Only Live Proof Approval

Status: pre-run docs-only approval packet. This PR does not execute the live proof.

Prerequisite: PR #166 merged a no-spend activation/preflight wrapper showing `ready_for_one_synthetic_live_proof: true` while preserving zero-call/non-authorizing markers.

Approved route:
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5

Approved live proof scope:
- at most one provider call
- max_cost_usd: 1
- activation corpus ref: `external-corpus/synthetic-runtime-model-only-live-proof.json`
- request input graph ref: `corpus/synthetic-runtime-model-only-live-proof.json`
- prompt ref: `prompts/synthetic-runtime-model-only-live-proof-v1`
- private raw evidence must remain outside the repository
- commit only a sanitized status follow-up

Forbidden surfaces:
- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no paid fallback
- no production writes
- no provider comparison
- no default model selection
- no provider lock-in

Required follow-up markers:
- retry_requires_new_approval: true
- authorizes_comparison_run: false
- authorizes_candidate_calls: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

Decision rules:
- If preflight fails, record sanitized blocked status only.
- If the provider request fails, record sanitized failure status only.
- If the provider returns malformed or non-exact JSON, record sanitized failure status only.
- Do not retry automatically.
- Do not broaden scope to tools, search, files, shell, plugins, MCP, retrieval, comparison, production writes, or any other provider/model route.
- A successful result may prove only this exact tiny synthetic live proof route; it must not claim production readiness, general model quality, default selection, or comparison authorization.
