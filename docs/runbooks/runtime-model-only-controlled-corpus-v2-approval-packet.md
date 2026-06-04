# Runtime Model-Only Controlled-Corpus V2 Corrected-Run Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

This packet authorizes exactly one future corrected controlled-corpus model-only validation run through the Atliera-owned harness, using the v2 output contract merged in PR #192.

## Prerequisites

- PR #189 recorded one completed v1 controlled-corpus model-only run.
- PR #190 recorded the no-spend usefulness assessment as `unsupported/invented`.
- PR #191 recorded the no-spend remediation plan.
- PR #192 added the no-call v2 controlled-corpus output contract and fake-mode regressions.

## Prior approval consumed

The PR #188 approval was consumed by the v1 run recorded in PR #189. It is not reusable.

## Approved future run

- approval_ref: docs/runbooks/runtime-model-only-controlled-corpus-v2-approval-packet.md
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- harness: Atliera model-only harness
- corpus_ref: controlled-corpus/model-only-harness-smoke-v1
- corpus_size: 3 synthetic controlled accounts
- corpus_roles: representative, edge-case, calibration
- prompt_contract_ref: prompts/controlled-corpus-model-only-v2
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- max_provider_calls: 1
- max_attempts: 1
- approved_max_cost_usd: 1
- execution_location: private evidence directory outside repository
- public_status_required: true

## V2 correction scope

The future run may change only the prompt/output contract enough to require:

- canonical account_ref on excerpts, claims, and account_objects
- nonempty supporting_excerpt_ids on every claim and account_object
- supporting_excerpt_ids resolving to known same-account excerpt ids
- rejection of display-name-only account labels in the validation path
- rejection of account_objects without provenance

It must not broaden corpus, tools, transport, provider, model, budget, data source, retrieval, or product scope.

## Boundary flags

The approved run must use:

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

## Stop conditions

The run must stop after exactly one provider request or before provider access if the harness rejects/blocks the job.

Do not retry under this approval if:

- the route rejects the request
- the model returns malformed output
- strict output parsing fails
- v2 provenance validation fails
- usage/cost accounting is unavailable
- the harness records blocked, rejected, or exception status

A failed or completed run consumes this approval. Any further provider call requires another fresh approval packet.

## Evidence policy

Keep all raw evidence private and out of the repository:

- raw prompts
- raw controlled account text
- raw provider requests
- raw provider responses
- model output text
- provider bodies
- headers
- credentials
- stack traces
- private evidence paths

Commit only sanitized status in a later status PR.

## Non-authorizing markers

- status: pre_run_approval
- provider_call_executed_in_this_pr: false
- authorizes_provider_call: true
- authorizes_provider_call_count: 1
- authorizes_v2_corrected_run: true
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
