# Runtime Model-Only Product-Preview Runtime Hardening

Status: no-spend runtime integration hardening. This document does not execute or approve a provider call.

## What changed

Added reusable public-safe runtime helpers:

- `src/product-preview/sanitized-runtime-status.ts`
- `src/cli/product-preview-plan.ts`
- `tests/product-preview/sanitized-runtime-status.test.ts`

The helper layer provides:

- sanitized product-preview execution status validation
- descriptor-snapshot/no-reread rejection for status and nested slot inputs
- exact-key validation for status, slot status, boundaries, and dry-run plan inputs
- provider-call/cost consistency checks
- reusable sanitized Markdown rendering for public status facts
- sanitized provider comparison over already-committed public facts
- dry-run product-preview planning CLI that prints planned metadata only

## Dry-run planner example

The planner command shape is:

```sh
npm run product-preview:plan -- \
  --job-id product-preview-runtime-smoke-20260604d \
  --approval-ref docs/runbooks/runtime-model-only-product-preview-runtime-smoke-approval-packet.md \
  --route-ref gpt-5.5-openai-codex-20260602a \
  --provider-ref openai-codex \
  --model-label gpt-5.5 \
  --transport-kind model-only-codex-auth \
  --corpus-ref product-preview/runtime-smoke-single-slot-v1 \
  --prompt-contract-ref prompts/product-preview-model-only-v1 \
  --max-provider-calls 1 \
  --max-cost-usd 1 \
  --slot-roles calibration \
  --runtime-mode model-only-smoke
```

The planner output has:

- dry_run: true
- provider_calls_executed: 0
- provider_spend_authorized_by_plan: false
- raw_private_evidence_read: false
- network_access_performed: false
- authorizes_provider_call: false

Boundary flags are all false for:

- tools
- shell
- file_access
- web_search
- plugins
- mcp
- retrieval
- graph_ingestion
- production_writes
- background_orchestrator

## Non-goals

This hardening does not:

- call a provider
- authorize a provider call
- read raw or private evidence
- run graph ingestion
- run Workshop/runtime model-mode smoke
- authorize background orchestration
- select a default model
- claim product, launch, or production readiness

Any live runtime/model-mode smoke still requires a separate docs/tests-only approval packet and a later execution/status PR.
