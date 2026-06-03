# Runtime Model-Only Proof Preflight

Status: no-spend activation preflight proof.

This proof composes the selected GPT-5.5 route, existing activation/cost gates, runtime model execution preflight, sanitized credential-readiness status, and the injected no-spend transport proof seam.

Scope requirements:
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- corpus ref must start with `external-corpus/synthetic-`
- prompt ref must start with `prompts/synthetic-`
- credential readiness may be recorded only as status `present`, `missing`, or `invalid`
- credential values, auth headers, private paths, raw request bodies, and raw response bodies are not accepted or emitted

Readiness markers:
- ready_for_one_synthetic_live_proof: true
- provider_calls_executed: 0
- provider_spend: false
- credential_value_observed: false
- raw_evidence_committed: false
- authorizes_comparison_run: false
- authorizes_candidate_calls: false
- model_only_transport_proven: false
- runtime_model_provider_implemented: false

Interpretation:
- This is not a live proof.
- This is not runtime model execution.
- This is not a provider-quality result.
- This is not a default model selection.
- This proof means the next step may be a separate docs-only approval packet for a real tiny live proof.
- The future live proof must still be bounded, synthetic-only, private-evidence-only, no-tools, no-shell, no-file-access, no-web-search, no-plugins, no-MCP, no-retrieval, and no retry without new approval.
