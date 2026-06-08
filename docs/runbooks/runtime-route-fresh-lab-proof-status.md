# Runtime Route Fresh Lab Proof Status

Status: completed.

Follow-up assessment: `runtime-route-fresh-lab-proof-usefulness-assessment.md` is a no-spend interpretation and decision record. It preserves the consumed approval state and current effective authorization of none.

This status records the separate execution/status step authorized by `runtime-route-fresh-lab-proof-approval-packet.md`. The approval permitted exactly one tiny synthetic fresh-route lab runtime/model-mode proof attempt, executed through the merged lab/test runtime harness (`executeLabRuntimeModelProof`) after the merged route-recency gate was present. That one approved attempt has now been consumed and completed.

This is a bounded historical lab runtime/model-mode contract signal only. It records that the approved fresh-route attempt ran, the route was fresh at execution preflight, and the harness boundary held. It is not evidence of product, production, or launch readiness; not a provider quality conclusion; not a default model selection; not provider lock-in; not a provider comparison; not graph ingestion; not production use; not product-preview expansion; not corpus expansion; and not any tools, web search, plugins, retrieval, or MCP change. It does not authorize a retry or any further provider call.

## Approval consumption

- approval_id: runtime-route-fresh-lab-proof-20260607a
- approval_ref: docs/runbooks/runtime-route-fresh-lab-proof-approval-packet.md
- approval_consumed: true
- approved_future_attempts: 1
- remaining_approved_future_attempts: 0
- attempts_executed: 1
- retry_requires_new_approval: true
- provider_call_requires_new_approval: true

## Sanitized outcome

- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_ref: injected-model-provider-lab-runtime-harness
- environment: lab
- operation: graph.propose
- corpus_ref: external-corpus/lab-runtime-model-proof.json
- route_recency_status_observed_at_preflight: fresh
- status: completed
- reason_code: lab_runtime_model_proof_completed
- stable_error_code: none
- preflight_ok: true
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- provider_spend: false
- observed_cost_usd: 0
- input_tokens_observed: 523
- output_tokens_observed: 1247
- total_tokens_observed: 1770
- accepted_output_received: true
- exact_output_contract_validated: true
- output_counts: excerpts 9, claims 9, account_objects 9

## Boundary markers

- graph_ingestion_performed: false
- production_writes: false
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

## Future-action authorization markers

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

## Interpretation

The single approved attempt sent exactly one provider request through the injected `ModelProvider` boundary consumed by the lab/test harness, passed route-recency and runtime preflight, and received accepted output that satisfied the exact public output contract. No provider spend was observed, no graph ingestion ran, and no production writes occurred. The runner observed exactly one transport call, matching the one approved provider call.

The value of this status is bounded: it confirms that the exact tiny synthetic fresh-route lab runtime/model-mode path under this packet's scope can produce schema-conforming output through the harness boundary while the one-call limit held with zero spend. It proves nothing about other routes, other providers, other operations, larger corpora, the product preview, the production runtime, graph ingestion, or model defaults.

The approval is now fully consumed: remaining approved future attempts is zero. Any further provider call, retry, scope change, provider comparison, corpus expansion, product-preview expansion, graph ingestion, production use, default model selection, or tools/search/plugin/retrieval/MCP change requires a fresh approval packet.
