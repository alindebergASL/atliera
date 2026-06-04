# Runtime Model-Only Controlled-Corpus Execution Status

Status: completed for one approved controlled-corpus model-only harness run.

Approval packet: `runtime-model-only-controlled-corpus-approval-packet.md`.

This status records the separate execution step allowed by the approval packet merged in PR #188. It is a sanitized public status only. Raw controlled account text, raw prompt, raw provider request, raw provider response, model output text, provider bodies, headers, credentials, stack traces, and private evidence paths remain outside the repository.

## Approved envelope consumed

- approval_ref: docs/runbooks/runtime-model-only-controlled-corpus-approval-packet.md
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- harness: Atliera model-only harness
- corpus_ref: controlled-corpus/model-only-harness-smoke-v1
- corpus_size: 3
- corpus_roles: representative, edge-case, calibration
- prompt_contract_ref: prompts/controlled-corpus-model-only-v1
- max_provider_calls: 1
- max_attempts: 1
- approved_max_cost_usd: 1

The PR #188 approval is consumed and is not reusable.

## Sanitized outcome

- status: completed
- reason_code: model_only_harness_completed
- stable_error_code: none
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- accepted_output_received: true
- observed_cost_usd: 0
- approved_max_cost_usd: 1
- input_tokens_observed: 320
- output_tokens_observed: 812
- raw_request_committed: false
- raw_response_committed: false
- raw_controlled_account_text_committed: false
- model_output_committed: false
- private_evidence_committed: false
- usefulness_evaluated: false

## Boundary preserved

The run stayed within the approved model-only harness boundary:

- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no session carryover
- no production writes
- no graph ingestion into production state
- no provider comparison
- no default model selection
- no background orchestrator bypass

## Interpretation

This completed run proves only that the approved three-account synthetic controlled-corpus request can traverse the Atliera-owned harness and the model-only Codex-auth transport once while producing output that satisfied the strict top-level output contract.

This status does not evaluate usefulness. It does not claim that the output is product-useful, graph-useful, launch-ready, product-ready, or production-ready.

A separate no-spend usefulness assessment over sanitized facts is required before deciding whether to approve any product-preview run, provider comparison, default model selection, background orchestration, or production integration.

## Non-authorizing markers

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true
