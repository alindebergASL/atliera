# Runtime Route Fresh Lab Proof Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

This packet historically authorized only one future fresh-route tiny synthetic lab runtime/model-mode proof attempt, executed through the merged lab/test runtime harness and the merged route-recency enforcement gate, in a separate later execution/status PR after this packet was merged. That later execution/status step is now recorded in `runtime-route-fresh-lab-proof-status.md`; the approval is consumed and the current effective authorization is none. This approval-packet PR did not execute a provider call, add provider transport, run a model, revalidate stale evidence, or change production/runtime defaults.

This approval-packet PR kept `provider_call_executed_in_this_pr: false` and `adds_runtime_provider_call_source: false`.

## Source and prerequisites

- recency_enforcement_status_ref: `runtime-route-recency-enforcement-status.md`
- recency_enforcement_status: no-spend runtime route recency enforcement merged
- prior_lab_status_ref: `runtime-model-only-lab-runtime-live-proof-status.md`
- prior_lab_approval_consumed: true
- prior_remaining_approved_future_attempts: 0
- route_selection_policy: explicit-route-ref-only-replaceable
- route_recency_status_required: fresh
- fresh_route_required_at_execution_time: true
- stale_or_candidate_label_only_route_blocks_before_provider_access: true

The selected route evidence must still be fresh at execution preflight time. Stale, expired, nearing-expiry, or candidate-label-only route evidence blocks before provider access. If route evidence is stale at execution time, record a blocked status with provider_calls_executed: 0 and provider_spend: false.

## Historical approved future attempt scope

- approval_id: runtime-route-fresh-lab-proof-20260607a
- approved_future_attempts: 1
- one_call_only: true
- max_attempts: 1
- max_provider_calls: 1
- max_cost_usd: 1
- separate later execution status PR required: true
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_ref: injected-model-provider-lab-runtime-harness
- environment: lab
- operation: graph.propose
- corpus_ref: external-corpus/lab-runtime-model-proof.json
- corpus_scope: synthetic-only
- route_kind: candidate
- evidence_expires_at: 2026-07-05T00:00:00.000Z
- output_scope: exact public contract plus sanitized status facts only
- stop_on_exception: true
- retry_requires_new_approval: true

The route candidate above is explicit and replaceable. A different route, provider, model, environment, operation, corpus, transport, cost cap, attempt count, or stale-route revalidation required a fresh approval packet, not an in-place edit of this packet and not reuse after consumption.

## Consumption status after execution

- status_ref: docs/runbooks/runtime-route-fresh-lab-proof-status.md
- approval_consumed: true
- current_effective_authorization: none
- remaining_approved_future_attempts: 0
- attempts_executed: 1
- provider_calls_executed: 1
- provider_call_requires_new_approval: true
- retry_requires_new_approval: true

## Required pre-run checks

Before the future execution may send its single provider request through the harness, it must verify:

- current route catalog still contains the exact route_ref
- route selection uses route_ref only, not model label shortcuts
- selectedRoute.environment must equal lab
- harness environment must equal lab
- request model must match the selected route model
- credential readiness must be true at execution time
- preflightRuntimeModelExecution must pass with the matching approval_id and cost cap
- route recency metadata must report fresh
- requires_fresh_approval_before_use must be false
- usable_without_revalidation must be true
- selected route evidence must still be fresh at execution preflight time
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

The provider request metadata must contain none of the forbidden capability keys for tools, web search, plugins, retrieval, MCP, file access, shell access, session carryover, background orchestration, or production writes. The harness and preflight must reject forbidden metadata or stale route recency before any provider invocation.

## Required transport boundary

The future execution must send its single request only through the injected `ModelProvider` boundary (`src/model/provider.ts`) consumed by the lab/runtime proof harness. It must not substitute a shell command, curl, a Claude Code session, a Hermes session, or an autonomous-agent session as the provider transport. Provider invocation happens at most once, after the route-recency and runtime preflight gates pass, and only via the injected provider's `generate` call.

If any pre-run check fails, the later execution PR must record a blocked status with provider_calls_executed: 0 and provider_spend: false. It must not substitute an operator session, autonomous agent, shell command, web retrieval, broader product-preview run, expanded corpus, stale-route revalidation run, or a different model/provider route.

## Out-of-repo boundary

These must never be committed to the repository, in this packet or the later execution/status PR:

- raw prompt text
- raw request, raw response, or provider payload bodies
- model output text
- source excerpts or account refs
- request identifiers
- credential-bearing values or auth headers
- private evidence paths or local evidence locations
- provider logs, wrapper logs, client handles, preview HTML, or screenshots

## Public status requirements for the later execution PR

The later status follow-up must be sanitized and separate from this packet. It may record only bounded, public-safe facts:

- status: completed, exception, or blocked
- reason_code or stable_error_code
- route_ref, provider_ref, model_label, transport_ref
- environment lab
- operation graph.propose
- corpus_ref external-corpus/lab-runtime-model-proof.json
- route recency status observed at preflight
- provider_calls_executed
- provider_spend
- observed_cost_usd
- token counts if publicly safe
- whether accepted output satisfied the exact output contract
- non-authorizing boundary markers

The later status must not commit prompt text, model text, source excerpts, account refs, provider payloads, headers, operator filesystem locations, logs, credential-bearing values, client handles, request identifiers, preview HTML, screenshots, or raw/private evidence. If the route has become non-fresh, nearing-expiry, expired, or label-only by execution time, the later status must be blocked before provider access and must not execute a revalidation attempt under this approval.

## Historical approval-time authorization state

- provider_call_executed_in_this_pr: false
- adds_runtime_provider_call_source: false
- authorizes_one_future_fresh_lab_runtime_model_mode_attempt: true
- approved_future_attempts: 1
- historical_remaining_approved_future_attempts_at_approval_time: 1
- remaining_approved_future_attempts: 0
- runtime_model_mode_execution_authorized_for_one_future_attempt: true
- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_future_runtime_model_mode_execution: false
- authorizes_retry: false
- authorizes_revalidation_run: false
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

The completed attempt under this packet proved only the exact fresh-route tiny synthetic lab runtime/model-mode path under this bounded scope. This packet and its status prove no provider comparison, corpus expansion, product-preview expansion, graph ingestion, production use, deployment, tool/search/plugin/retrieval/MCP changes, launch, retry, revalidation run, stale-route use, default model selection, or any second provider request. Any retry, revalidation, stale-route use, or scope change requires a fresh approval packet.
