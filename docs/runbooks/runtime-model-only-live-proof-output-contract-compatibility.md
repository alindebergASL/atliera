# Runtime Model-Only Live Proof Output-Contract Compatibility

Status: no-call output-contract design and guardrail.

This runbook records the next correction class after the parameter-compatible attempt reached provider/model output but failed the strict public proof contract. This document and its tests do not execute a provider call and do not authorize a provider call.

## Sanitized diagnosis

The latest parameter-compatible attempt consumed PR #180's approval and was recorded by PR #181 as a sanitized exception. Private evidence showed the route produced output events, but the proof failed before accepted output because the local stream collector treated two equivalent stream surfaces as additive text.

Sanitized category: stream_output_collection_contract.

This is an output-contract collection issue, not a new provider parameter-compatibility issue and not a model-quality or product-readiness signal.

## Required correction before any further live attempt

The next live attempt may only use this output-contract correction:

- collect `response.output_text.delta` text as the canonical streamed output when any delta events are present
- treat `response.output_item.done` text as a fallback only when no delta text was observed
- never concatenate delta text and completed item text for the same response
- parse exactly one strict JSON object after collection
- require exactly these top-level keys: `excerpts`, `claims`, `account_objects`
- require each top-level value to be an array
- reject duplicate concatenated JSON objects
- reject markdown fences
- reject prose before or after JSON
- reject extra top-level keys
- reject non-array top-level values

This correction must not broaden provider, route, model, transport, prompt/data/tool scope, budget, retry count, evidence policy, comparison scope, or readiness claims.

## Non-authorizing markers

- provider_call_executed_in_this_pr: false
- adds_runtime_provider_call_source: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
- retry_requires_new_approval: true

## Preserved request boundary

Any future approved attempt must still preserve:

- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- no session carryover
- no provider comparison
- no default model selection
- no production writes
- no production deployment
- raw evidence private/out of repo
- sanitized public status only

## Next approval requirement

A further live attempt requires a separate docs/tests approval packet after this no-call output-contract guardrail is merged.

That approval packet must name this correction class, authorize exactly one call, retain max cost <= $1, require private raw evidence, and require a separate later status PR.
