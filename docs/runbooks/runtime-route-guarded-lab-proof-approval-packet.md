# Runtime Route Guarded Lab Proof Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

This packet records a bounded future lab runtime/model-mode proof scope after `runtime-route-chain-no-call-hardening-status.md`. The hardening status established preflight-recomputed route recency in sanitized observability, selected route and preflight route identity must match, status must match preflight outcome, and validation age must be derived at observedAt rather than from selection-time snapshots.

This packet adds no provider transport, no wrapper, no runtime provider call source, no route revalidation run, no retry, no comparison, no graph ingestion, no production write, and no default model selection. It is a review artifact only. The current effective authorization remains none until this packet is merged and the operator gives a separate explicit execution instruction. The `authorizes_provider_call: false` marker describes the current and this-PR boundary; any later single lab call still needs merge plus that separate operator instruction and must remain under the stated caps.

## Packet markers

- approval_id: runtime-route-guarded-lab-proof-20260609a
- packet_ref: runtime-route-guarded-lab-proof-approval-20260609a
- depends_on_status_doc: docs/runbooks/runtime-route-chain-no-call-hardening-status.md
- source_assessment_doc: docs/runbooks/runtime-route-fresh-lab-proof-usefulness-assessment.md
- provider_call_executed_in_this_pr: false
- adds_runtime_provider_call_source: false
- current_effective_authorization: none
- approval_effective_before_merge_and_operator_execution_instruction: false
- execution_requires_explicit_operator_instruction_after_merge: true

## Future proof scope

- proposed_future_attempts: 1
- max_attempts: 1
- max_provider_calls: 1
- max_transport_calls: 1
- max_cost_usd: 1
- one_call_only: true
- separate_later_execution_status_pr_required: true
- stop_on_exception: true
- retry_requires_new_approval: true
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_ref: injected-model-provider-lab-runtime-harness
- environment: lab
- operation: graph.propose
- corpus_ref: external-corpus/lab-runtime-model-proof.json
- corpus_scope: synthetic-only
- route_kind: candidate
- route_recency_status_required: fresh
- fresh_route_required_at_execution_time: true

The selected route evidence must still be fresh at execution preflight time. Stale, expired, nearing-expiry, or candidate-label-only route evidence blocks before provider access. If route evidence is not fresh at execution preflight, record a blocked status with provider_calls_executed: 0 and provider_spend: false.

The later execution path must use the exact route_ref above through the validated route catalog, explicit routeRef selection, lab runtime composition, execution preflight, and sanitized observability. There is no route substitution, no provider substitution, no model substitution, no transport substitution, and no shell, curl, Hermes session, Claude Code session, or autonomous-agent substitution.

## Required preflight checks before any future execution

- current route catalog still contains the exact route_ref
- route selection uses route_ref only, not model label shortcuts
- selected route and preflight route identity must match
- selected route and preflight evidence expiry must match
- preflightRuntimeModelExecution must pass
- status must match preflight outcome
- route recency metadata must report fresh
- requires_fresh_approval_before_use must be false
- usable_without_revalidation must be true
- validation age must be derived at observedAt
- credential readiness must be true at execution time
- cost ledger must leave room for the one-call cap
- request metadata must not enable tools, web search, plugins, retrieval, MCP, shell, file access, session carryover, or background orchestration

If any preflight check fails, the future status must be blocked before provider access. It must not retry, revalidate, substitute another route, substitute another provider surface, or continue through an operator session.

## Closed capability boundaries

- authorizes_provider_call: false
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

## Commit and evidence boundaries

- provider_payload_committed: false
- model_output_committed: false
- raw_prompt_committed: false
- raw_request_committed: false
- raw_response_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false

## Claims explicitly not made

- default_model_selection_claim: false
- provider_comparison_claim: false
- provider_quality_conclusion: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false

This packet does not create ongoing execution clearance. It records one bounded future proof scope that remains inert until merge plus a separate explicit execution instruction. Any retry, route revalidation run, provider or model comparison, product-preview or corpus expansion, graph ingestion, production use, tools, web search, plugins, retrieval, MCP, default model decision, or readiness claim needs a separate packet.

## Later sanitized status requirements

The later status follow-up must be sanitized and separate from this packet. It must record status: completed, exception, or blocked; provider_calls_executed; transport_calls_observed; provider_spend; observed_cost_usd; route_recency_status_observed_at_preflight; whether accepted output satisfied the exact output contract; aggregate public-safe output counts if completed; and non-authorizing boundary markers.

The later status must not commit raw prompt text, raw request, raw response, or provider payload bodies, model output text, request identifiers, credential-bearing values or auth headers, private evidence paths or local evidence locations, wrapper logs, source account identifiers, screenshots, client handles, or production runtime details.
