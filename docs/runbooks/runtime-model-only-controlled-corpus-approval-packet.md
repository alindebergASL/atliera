# Runtime Model-Only Controlled-Corpus Approval Packet

Status: pre-run docs-only approval packet. This PR does not execute a provider call.

This packet authorizes exactly one future controlled-corpus model-only validation run through the Atliera-owned harness boundary merged in PR #187.

## Prerequisites

- PR #184 recorded a completed tiny synthetic output-contract proof.
- PR #185 defined the promotion boundary and blocked overpromotion.
- PR #186 defined the app-owned model-only harness design.
- PR #187 implemented the deterministic fake-mode harness proof.

## Approved future run

- approval_ref: docs/runbooks/runtime-model-only-controlled-corpus-approval-packet.md
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- harness: Atliera model-only harness
- corpus_ref: controlled-corpus/model-only-harness-smoke-v1
- corpus_size: 3 synthetic controlled accounts
- corpus_roles: representative, edge-case, calibration
- prompt_contract_ref: prompts/controlled-corpus-model-only-v1
- max_provider_calls: 1
- max_attempts: 1
- approved_max_cost_usd: 1
- output_contract: exact JSON object with `excerpts`, `claims`, and `account_objects` arrays
- execution_location: private evidence directory outside repository
- public_status_required: true

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

## Post-run status requirements

The separate status PR must record sanitized facts only:

- status: completed, exception, blocked, or rejected
- route/provider/model/transport labels
- corpus_ref and corpus_size
- provider_calls_executed
- accepted_output_received
- observed_cost_usd and approved_max_cost_usd
- token counts if safe
- stable public error code if any
- output counts if safe
- no-readiness/no-default/no-lock-in markers

The status PR must not include raw controlled account text, raw model output, raw provider bodies, credentials, private paths, or stack traces.

## Non-authorizing markers

- status: pre_run_approval
- provider_call_executed_in_this_pr: false
- authorizes_provider_call: true
- authorizes_provider_call_count: 1
- authorizes_controlled_corpus_run: true
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
