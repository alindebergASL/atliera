# Runtime Model-Only Product-Preview Retry Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

Prior consumed approval: `runtime-model-only-product-preview-approval-packet.md`.
Prior status: `runtime-model-only-product-preview-status.md`.
No-spend remediation preflight: `runtime-model-only-product-preview-transport-remediation.md`.

This packet is a bounded decision to retry exactly one future product-preview model-only attempt after the private transport dependency/interpreter remediation. Approval consumes exactly one future retry attempt.

No execution may occur in this approval PR. The execution and sanitized status must be a separate later step.

## Preconditions

- prior_approval_consumed: true
- prior_retry_requires_new_approval: true
- transport_remediation_recorded: true
- provider_api_requests_executed_during_remediation: 0
- provider_spend_during_remediation: false
- firewall_or_network_blocker_observed: false

The remediation preflight observed dependency/import readiness and DNS/TCP 443 reachability only. It did not send credentials, prompts, screened account text, request bodies, provider bodies, or provider API requests.

## Approved future retry

- max_attempts: 1
- max_provider_calls: 1
- approved_max_cost_usd: 1
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_surface: app-owned-model-only-harness
- corpus_ref: product-preview/single-screened-account-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- screened_account_slots: 1

## Runtime boundary

- tools: false
- web_search: false
- plugins: false
- mcp: false
- shell: false
- file_access: false
- retrieval: false
- production_writes: false
- graph_ingestion: false

The retry must use the app-owned model-only harness boundary. It must not use Hermes as a product runtime, must not use an autonomous agent surface, and must not bypass the harness.

## Authorization state

- authorizes_product_preview_retry: true
- authorizes_product_preview_run: true
- authorizes_provider_call: true
- authorizes_retry_after_this_attempt: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

## Evidence and status requirements

- status_followup_required: true
- raw_or_model_output_must_remain_private: true

The later status follow-up must record whether the approved retry completed, blocked, or failed. It must record only sanitized facts and must not commit raw account text, prompts, requests, responses, model output, provider bodies, credential material, stack traces, private evidence details, endpoint details, or client handles.

If the retry blocks or fails, no additional retry is authorized by this packet.

## Non-claims

This retry approval packet does not claim:

- product readiness
- production readiness
- launch readiness
- default model selection
- provider comparison
- provider lock-in
- graph ingestion readiness
- background orchestrator readiness

A completed future retry would be a bounded historical signal only. Any further retry, comparison, default selection, graph ingestion, production use, or background orchestration decision would require a separate approval packet.
