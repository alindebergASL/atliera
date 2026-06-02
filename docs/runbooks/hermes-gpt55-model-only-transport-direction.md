# Hermes GPT-5.5 Model-only Transport Direction

Status: no-spend direction record.

This document records the approved next direction: investigate whether Atliera can reuse the same underlying provider route that makes GPT-5.5 available to the operator environment, while refusing to use the live Hermes operator runtime itself as a candidate provider. This record does not execute provider calls, does not spend, does not compare model output, does not capture raw model evidence, and does not approve candidate calls.

## Decision

The viable direction is the same underlying provider route, not this live Hermes operator session and not this agent API.

The operator runtime has skills, tools, memory, shell/file/web capabilities, session history, and task context. Those are useful for later Atliera operator workflows and reviews, but they must stay outside the GPT-5.5 comparison candidate call boundary.

For the model comparison route, the target must be a dedicated model-only adapter that maps exactly:

1. Atliera `ModelProviderRequest` in;
2. provider model call through a narrow request builder;
3. Atliera `ModelProviderResponse` out;
4. no extra operator context, no agent loop, and no autonomous tool surface.

## Sanitized Hermes provider-route facts

No-spend source inspection found a plausible implementation seam in Hermes, separate from the Codex CLI autonomous-agent surface:

- provider profile: `openai-codex`;
- api_mode: `codex_responses`;
- profile type: `ProviderProfile`;
- transport type: `ResponsesApiTransport`;
- the provider route is Responses-API shaped rather than Codex CLI app-server shaped;
- `ResponsesApiTransport.build_kwargs` only adds a `tools` field when converted response tools exist;
- tools omitted when no functions are exposed;
- the operator agent loop is still outside the acceptable boundary and must not be reused directly.

These facts make the direction worth pursuing, but they do not by themselves prove a transport.

## Required adapter shape

A future adapter must be independent of the live operator process. It must start from a minimal process or library boundary that has:

- model-only adapter;
- Atliera `ModelProviderRequest` accepted as the only request contract;
- Atliera `ModelProviderResponse` returned as the only response contract;
- no skills loaded;
- no memory loaded;
- no terminal;
- no file tools;
- no browser;
- no web search;
- no MCP;
- no plugins;
- no retrieval;
- credential-neutral behavior at the Atliera boundary;
- raw request, raw response, transcript, and operational evidence kept outside the repository;
- sanitized status only in committed docs.

The first implementation artifact is `createHermesGpt55ModelOnlyRequestPlan`, a no-spend request-factory/proof harness. It verifies that the planned outgoing provider payload has no tools, no shell/file/web/plugin/retrieval affordances, and no session/memory/skill context. After the sanitized streaming-shape diagnostic in `hermes-gpt55-streaming-shape-diagnostic-status.md`, this planned payload uses the observed accepted shape with `stream: true` and without `max_output_tokens`, and records the requested Atliera output cap only as `requested_max_output_tokens_not_sent` in the no-spend plan.

The second implementation artifact is `HermesGpt55ModelOnlyInjectedTransportProof`, a no-spend injected transport proof seam. It accepts Atliera `ModelProviderRequest`, builds the same safe provider payload, invokes only an injected fake caller through `generateNoSpendProof`, parses exact-schema strict JSON back into Atliera `ModelProviderResponse`, rejects malformed or extra-field responses, and preserves zero spend. It is intentionally not a `ModelProvider` runtime implementation and still does not create credentials, clients, SDK imports, network access, or candidate-call authorization.

The third implementation artifact is `createHermesGpt55ActivationPreflightProof`, a no-spend activation preflight proof. It evaluates existing model activation gates for provider `openai-codex`, model `gpt-5.5`, a synthetic-only external corpus and `prompts/synthetic-*` prompt ref, explicit approval and budget limits, and sanitized injected credential readiness. It can mark `ready_for_one_synthetic_smoke: true`, but still records `provider_calls_executed: 0`, `provider_spend: false`, `credential_value_observed: false`, `raw_evidence_committed: false`, `authorizes_comparison_run: false`, and `model_only_transport_proven: false`. The proof helper accepts already-materialized plain data from Atliera activation/credential wiring; hostile JavaScript Proxy objects are outside this proof boundary because introspection traps can run caller-supplied code before any helper can validate them.

The fourth implementation artifact is `HermesGpt55StreamingModelProvider`, an injected streaming-response adapter seam. It implements `ModelProvider` only through injected stream caller dependency injection, consumes `response.output_text.delta` events, requires a `response.completed` terminal event, and fails closed on `response.failed` and `response.incomplete`. It maps exact-schema JSON text into Atliera `ModelProviderResponse`, rejects malformed or extra-field responses, and does not construct credentials, clients, SDK imports, or network access. The adapter seam proves runtime shape without approving broad candidate execution; comparison execution remains blocked.

The first approved live synthetic smoke is recorded in `hermes-gpt55-model-only-live-smoke-status.md`. It executed one provider call under a $1.00 cap and failed with `BadRequestError`; at that checkpoint `model_only_transport_proven: false` remained active. A later approved diagnostic is recorded in `hermes-gpt55-streaming-shape-diagnostic-status.md`: it isolated the stable failure to non-streaming requests and observed accepted synthetic output only when `stream: true` was sent.

## Current no-spend proof-state markers

The no-spend proof artifacts preserve:

- model_only_transport_proven: false
- tool_use_disabled: false
- shell_access_disabled: false
- file_access_disabled: false
- web_search_disabled: false
- plugins_disabled: false
- retrieval_disabled: false
- credential_neutrality_proven: false
- private_evidence_boundary_proven: false
- authorizes_candidate_calls: false
- provider_calls_executed: 0
- provider_spend: false
- raw_evidence_committed: false
- approved_gpt55_comparison_executed: false
- runtime_model_mode_integration: false
- launch_readiness_claim: false
- product_readiness_claim: false
- production_readiness_claim: false
- broad_provider_quality_claim: false

## Non-goals

This record does not claim that Hermes-as-operated is provider-quality. It does not change the Codex-auth blocker status. It does not authorize GPT-5.5 comparison calls. It does not make skills or tools part of candidate calls. It only narrows the next engineering path from the Codex CLI surface to a possible Responses-API model-only adapter derived from the same provider route.

## Next no-spend slice

1. Add a pure request factory for the Hermes-backed GPT-5.5 direction or a fixture-equivalent proof harness.
2. Feed adversarial Atliera request metadata with forbidden fields such as tool, shell, file, web, MCP, plugin, retrieval, session, memory, and endpoint override hints.
3. Verify the outgoing provider payload rejects or strips those fields and omits tools entirely.
4. Verify the harness cannot read process environment or credential material while constructing the safe payload.
5. Keep the existing Codex status blocked until the transport proof, budget gate, source screen, and explicit operator approval all pass.
