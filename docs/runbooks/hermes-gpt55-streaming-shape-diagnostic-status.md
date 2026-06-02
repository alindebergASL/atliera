# Hermes GPT-5.5 Streaming Shape Diagnostic Status

Status: sanitized request-shape diagnostic record.

This document records the follow-up private diagnostic after the first approved live synthetic smoke failed with `BadRequestError`. The user approved continued digging and clarified that subscription-backed GPT-5.5 use should not be treated as a cost blocker for this investigation. Raw request/response material remains outside the repository.

## Scope

- provider route: `openai-codex`;
- API mode: `codex_responses`;
- model: `gpt-5.5`;
- synthetic_only: true;
- private evidence retained outside the repository;
- no tools, web search, MCP, plugins, retrieval, shell, files, or operator session context were exposed to the candidate prompt.

This diagnostic was request-shape debugging only. It is not a provider-quality conclusion, not a production/default model selection, not a launch/product/production readiness claim, and not a comparison execution.

## Sanitized diagnostic matrix

- provider_calls_executed: 3
- raw_evidence_committed: false
- credential_value_observed: false
- private_account_data_used: false
- authorizes_comparison_run: false

Variants:

1. `nonstream_with_max_output_tokens`
   - status: exception
   - error_code: BadRequestError
   - stable_error_detail: `Stream must be set to true`
   - accepted_output_observed: false

2. `nonstream_no_max_output_tokens`
   - status: exception
   - error_code: BadRequestError
   - stable_error_detail: `Stream must be set to true`
   - accepted_output_observed: false

3. `stream_no_max_output_tokens`
   - status: completed
   - accepted_output_observed: true
   - accepted_output_chars: 14
   - raw_response_sha256_recorded_privately: true

## Root cause

- root_cause: nonstreaming Responses requests are rejected by the Codex backend.
- proof_update: provider payload uses the observed accepted shape with `stream: true` and without `max_output_tokens` for this route.

The earlier failure was caused by sending a non-streaming Responses request. The diagnostic also showed that removing `max_output_tokens` alone is insufficient; the backend still rejects non-streaming requests with the same stable error detail. The accepted diagnostic variant used streaming and omitted `max_output_tokens`, matching the Hermes transport pattern for the Codex backend.

## Resulting repo change

The no-spend proof payload in `createHermesGpt55ModelOnlyRequestPlan` now records a streaming payload shape:

- `stream: true` is sent;
- `max_output_tokens` is not sent;
- the requested Atliera max-output value is retained only as `requested_max_output_tokens_not_sent` in the no-spend plan.

## Remaining blocker

Atliera runtime `ModelProvider` execution remains unimplemented. The streaming diagnostic proves the provider route can accept a synthetic model-only streaming request and return accepted output, but it does not by itself implement the Atliera runtime adapter or authorize the comparison run.

## Next step

- retry_requires_new_approval: false
- recommended_next_action: implement an injected streaming-response adapter seam that consumes streaming Responses events, maps sanitized accepted output into `ModelProviderResponse`, and keeps comparison execution blocked until the adapter is reviewed.

The next step can stay local/no-spend by using recorded event-shape fixtures or injected fake streaming events before any additional live comparison work.
