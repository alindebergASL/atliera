# Atliera Model-Only Harness Design

Status: no-call harness design.

This document defines the application-owned model-only harness that should sit between approval packets and any provider/model route. Hermes-like orchestration may operate around this harness, but must not bypass it.

## Purpose

The harness is the Atliera-owned runtime boundary for future model-only validation jobs. It converts one approved job envelope into at most one injected model transport call and one sanitized status record.

The harness is not a model provider selector, product-readiness gate, or autonomous agent runtime.

## Required inputs

A harness job must include:

- job_id: safe logical ID
- idempotency_key: safe logical ID
- approval_ref: durable approval packet reference
- route_ref: approved route reference
- provider_ref: approved provider reference
- model_label: approved model label
- transport_kind: approved transport kind
- corpus_ref: approved controlled corpus reference
- prompt_contract_ref: approved prompt contract reference
- max_attempts: exactly 1 for live validation packets
- approved_max_cost_usd: explicit numeric cap
- requested_output_contract: exact JSON object with `excerpts`, `claims`, and `account_objects` arrays
- boundary flags: no tools, no shell, no file access, no web search, no plugins, no MCP, no retrieval, no session carryover

## Required lifecycle

The harness status lifecycle is:

1. pending
2. approved
3. running
4. completed, exception, blocked, or rejected

No terminal status may be overwritten. No implicit retry may be scheduled by the harness.

## Required validation order

The harness must validate before transport access:

1. exact top-level request keys
2. safe logical identifiers and references
3. approval route/provider/model/transport match
4. corpus and prompt contract scope
5. `max_attempts: 1`
6. cost cap is positive and within the approval packet
7. all no-tools/no-shell/no-file/no-web/no-plugin/no-MCP/no-retrieval/no-session flags are closed
8. output contract is exact

Only after validation may the harness call an injected transport.

## Transport boundary

The harness owns no provider SDK import, no credential read, and no network implementation in source.

Transport requirements:

- injected by caller
- receives a validated frozen request snapshot
- returns provider-shaped text or structured output
- cannot receive raw credentials from the harness
- cannot be invoked more than once per job
- failures become sanitized status with a stable public code

## Evidence policy

Raw evidence remains outside the repository:

- raw prompts
- raw source text
- raw provider requests
- raw provider responses
- model output text
- provider bodies
- headers
- credentials
- stack traces
- private evidence paths

Repository records contain only sanitized status facts:

- status
- reason_code
- route/provider/model/transport labels
- provider_calls_executed
- accepted_output_received
- observed_cost_usd
- approved_max_cost_usd
- token counts if safe
- stable public error code
- no-readiness/no-default/no-lock-in markers

## Hermes-like orchestrator boundary

A Hermes-like orchestrator may be useful on an Atliera server only as an operator automation layer. It may:

- prepare approval packets
- trigger predefined harness jobs after explicit approval
- observe sanitized status
- open status PRs or operator reports
- run CI and regression checks

It must not:

- bypass the harness
- directly call providers for product runtime work
- directly mutate production graph state
- retry without fresh approval
- choose a default model
- convert validation evidence into readiness claims

## Fake-mode proof required before live controlled-corpus execution

Before any controlled-corpus provider call, a deterministic fake-mode harness proof must show:

- exact request validation
- approval mismatch rejection
- boundary-flag rejection
- max-attempt rejection
- strict output contract validation
- one injected transport invocation at most
- blocked/rejected statuses perform zero provider calls
- completed status records accepted output but does not authorize another call
- no process.env read
- no raw/private evidence in sanitized status

## Non-authorizing markers

- status: no_call_design
- provider_call_executed_in_this_pr: false
- authorizes_provider_call: false
- authorizes_controlled_corpus_run: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
