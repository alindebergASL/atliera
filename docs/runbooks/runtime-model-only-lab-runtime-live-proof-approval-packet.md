# Lab Runtime Model-Only Live Proof Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

This packet authorizes only one future tiny synthetic lab runtime/model-mode proof attempt, executed through the merged lab/test runtime harness, in a separate later execution/status PR after this packet is merged. It is the first authorization to run the harness implemented in PR #236; that harness is implemented but was explicitly not yet authorized for any live execution.

This approval-packet PR adds no provider transport and runs no model. It keeps `provider_call_executed_in_this_pr: false` and `adds_runtime_provider_call_source: false`.

## Consumption update

The one approved future attempt has since been executed and recorded in the separate sanitized status `runtime-model-only-lab-runtime-live-proof-status.md`. That status consumed this approval. The current remaining authorization under this packet is zero.

- approval_consumed: true
- consuming_status_ref: `runtime-model-only-lab-runtime-live-proof-status.md`
- current_remaining_approved_future_attempts: 0
- retry_requires_new_approval: true

This consumption note does not add, restore, or broaden any authorization. The historical approval-time scope and all non-authorizing follow-up markers below are preserved unchanged as the record of what this packet approved at approval time. Any further provider call or retry requires a fresh approval packet.

## Source and prerequisites

- harness_status_ref: `live-provider-proof-verifier-runtime-harness-status.md`
- harness_status: lab/test-only harness implemented, not yet authorized for live execution
- harness_function: `executeLabRuntimeModelProof` in `src/validation/live-provider-moderate-proof-verifier.ts`
- harness_tests_ref: `tests/validation/lab-runtime-model-proof-harness.test.ts`
- preview_usefulness_assessment_ref: `live-provider-broader-batch-workshop-preview-usefulness-assessment.md`
- preview_label_hardening_merged: true
- route_selection_policy: explicit-route-ref-only-replaceable

## Approved attempt scope

- approval_id: lab-runtime-model-proof-live-attempt-20260605f
- approved_future_attempts: 1
- one_call_only: true
- max_attempts: 1
- max_provider_calls: 1
- max_cost_usd: 1
- separate later execution status PR required: true
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- environment: lab
- operation: graph.propose
- corpus_ref: external-corpus/lab-runtime-model-proof.json
- corpus_scope: synthetic-only
- route_kind: candidate
- output_scope: exact public contract plus sanitized status facts only
- stop_on_exception: true
- retry_requires_new_approval: true

The route candidate above is explicit and replaceable: a different approved route requires a fresh approval packet, not an in-place edit of a consumed one.

## Required pre-run checks

Before the future execution may send its single provider request through the harness, it must verify:

- current route catalog still contains the exact route_ref
- route selection uses route_ref only, not model label shortcuts
- selectedRoute.environment must equal lab
- harness environment must equal lab
- request model must match the selected route model
- credential readiness must be true at execution time
- execution preflight must pass with the matching approval_id and cost cap
- the request operation is exactly graph.propose
- the corpus is the approved synthetic corpus_ref only
- no tools
- no web search
- no plugins
- no MCP
- no retrieval
- no shell
- no file access
- no session carryover
- no background orchestrator
- no graph ingestion
- no production writes
- no deployment
- no provider comparison
- no corpus expansion
- no product-preview expansion
- no default model selection
- no provider lock-in

The provider request metadata must contain none of the forbidden capability keys (tools, web search, plugins, retrieval, MCP, file access, shell access). The harness rejects forbidden metadata keys before any provider invocation.

## Required transport boundary

The future execution must send its single request only through the injected `ModelProvider` boundary (`src/model/provider.ts`) consumed by `executeLabRuntimeModelProof`. It must not substitute a shell command, curl, a Claude Code session, a Hermes session, or an autonomous-agent session as the provider transport. Provider invocation happens exactly once, after the harness gates pass, and only via the injected provider's `generate` call.

If any pre-run check fails, the later execution PR must record a blocked status with provider_calls_executed: 0 and provider_spend: false. It must not substitute an operator session, autonomous agent, shell command, web retrieval, broader product-preview run, expanded corpus, or a different model/provider route.

## Out-of-repo boundary

These must never be committed to the repository, in this packet or the later execution/status PR:

- raw prompt text
- raw request, raw response, or provider payload bodies
- model output text
- request identifiers
- credential-bearing values or auth headers
- private evidence paths or local evidence locations
- preview HTML or screenshots

## Public status requirements for the later execution PR

The later status may record only bounded, sanitized facts:

- status: completed, exception, or blocked
- reason_code or stable_error_code
- route_ref, provider_ref, model_label
- environment lab
- operation graph.propose
- provider_calls_executed
- provider_spend
- observed_cost_usd
- token counts if publicly safe
- whether accepted output satisfied the exact output contract
- non-authorizing boundary markers

The later status follow-up must be sanitized and separate from this packet. It must not commit prompt text, model text, source excerpts, account refs, provider payloads, headers, operator filesystem locations, logs, credential-bearing values, client handles, request identifiers, preview HTML, or screenshots.

## Approval-time authorization state

- provider_call_executed_in_this_pr: false
- adds_runtime_provider_call_source: false
- authorizes_one_future_lab_runtime_model_mode_attempt: true
- approved_future_attempts: 1
- remaining_approved_future_attempts: 1
- runtime_model_mode_execution_authorized_for_one_future_attempt: true
- authorizes_retry: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_corpus_expansion: false
- authorizes_default_model_selection: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- authorizes_mcp: false
- retry_requires_new_approval: true
- default_model_selection_claim: false
- provider_comparison_claim: false
- provider_quality_conclusion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

A successful future attempt under this packet would prove only the exact tiny synthetic lab runtime/model-mode route under this bounded scope. This packet proves no provider comparison, corpus expansion, product-preview expansion, graph ingestion, production use, deployment, tool/search/plugin/retrieval/MCP changes, launch, retry, or any second provider request. Any retry or scope change requires a fresh approval packet.
