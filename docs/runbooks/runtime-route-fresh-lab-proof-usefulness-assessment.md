# Runtime Route Fresh Lab Proof Usefulness Assessment

Status: no-spend interpretation and decision record.

Source status: `runtime-route-fresh-lab-proof-status.md`.

This document interprets only the already-committed sanitized fresh-route lab proof status. It does not execute a provider call, retry the lab proof, revalidate a route, compare providers or models, ingest output into the graph, expand the corpus or product-preview surface, write to production, select a default model, or change tools, web search, plugins, retrieval, or MCP settings.

## Assessment result

- assessment_ref: runtime-route-fresh-lab-proof-usefulness-20260608a
- source_status_ref: runtime-route-fresh-lab-proof-20260607a
- source_status_doc: docs/runbooks/runtime-route-fresh-lab-proof-status.md
- assessment_provider_calls_executed: 0
- assessment_provider_spend: false
- assessment_network_access: false
- assessment_classification: useful_but_bounded_fresh_route_contract_signal
- recommended_next_step: no-call-route-chain-hardening

## Sanitized source facts consumed

- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_ref: injected-model-provider-lab-runtime-harness
- environment: lab
- operation: graph.propose
- corpus_ref: external-corpus/lab-runtime-model-proof.json
- route_recency_status_observed_at_preflight: fresh
- source_provider_calls_executed: 1
- source_transport_calls_observed_by_runner: 1
- source_provider_spend: false
- source_observed_cost_usd: 0
- source_output_counts: excerpts 9, claims 9, account_objects 9
- accepted_output_received: true
- exact_output_contract_validated: true
- graph_ingestion_performed: false
- production_writes: false

## What the proof establishes

The status is useful as a bounded runtime-boundary signal. It records that the selected route was fresh at execution preflight, the lab runtime/model-mode harness reached the injected `ModelProvider` boundary, exactly one transport/provider call was observed, and the returned public output satisfied the exact contract checked by the harness.

The status also records that the one-call limit held, provider spend was false with observed cost zero, graph ingestion was not performed, production writes were false, and raw/provider/private categories were not committed.

This is enough to justify no-spend follow-up work that hardens the route chain around the already-proven shape. It is not enough to justify another provider call or broader runtime adoption without a separate approval packet.

## What the proof does not establish

This assessment makes no claim about other routes, providers, models, transports, operations, corpora, account roles, product-preview slices, production runtime paths, graph-ingestion behavior, or default model choice. It also makes no provider quality conclusion and no product, production, or launch readiness claim.

The model label here remains a replaceable candidate route label tied to this historical status. Future direct provider API routes (including Anthropic API and OpenAI API) and gateway routes should enter through the same `ModelProvider` boundary, validated route catalog, route-recency review, and explicit approval discipline rather than through product-logic rewrites or default-model assumptions.

## Candidate next branches

1. `no-call-route-chain-hardening` — recommended next.
   - Add or strengthen deterministic tests for catalog validation -> explicit routeRef selection -> runtime composition -> preflight -> sanitized observability.
   - Use an injected throwing provider dependency and assert it is never called.
   - Assert zero provider calls and zero provider spend at catalog, selection, preflight, and report layers.
   - Exercise fresh, stale, expired, nearing-expiry, and candidate-label-only route evidence with fail-closed behavior before any provider boundary access.

2. `separate-docs-only-approval-packet` — only after the no-call decision point if the user wants a new live slice.
   - The packet would need to name the exact route, provider, model label, transport, operation, corpus, call cap, cost cap, stop rules, route-recency requirements, private evidence handling, and separate sanitized status follow-up.
   - The approval packet itself would still be docs/tests-only and would not execute a provider call.

3. `provider-comparison-planning` — defer unless comparison becomes the explicit goal.
   - Any comparison requires a separate approval packet, separate provider/model scopes, separate call/cost caps, and no default-model-selection or provider-lock-in language.

## Approval and authorization state

- approval_consumed: true
- approved_future_attempts: 1
- remaining_approved_future_attempts: 0
- attempts_executed: 1
- retry_requires_new_approval: true
- provider_call_requires_new_approval: true
- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_future_runtime_model_mode_execution: false
- authorizes_provider_comparison: false
- authorizes_product_preview_expansion: false
- authorizes_corpus_expansion: false
- authorizes_default_model_selection: false
- authorizes_tools: false
- authorizes_web_search: false
- authorizes_plugins: false
- authorizes_retrieval: false
- authorizes_mcp: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false

## Boundary markers

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

## Decision

Proceed with no-call route-chain hardening before any new approval packet by default. If the next desired action is another live runtime/model-mode proof, first add a separate docs/tests-only approval packet and wait for explicit approval before execution. This assessment itself keeps current effective authorization at none.
