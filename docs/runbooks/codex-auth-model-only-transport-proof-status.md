# Codex-auth Model-only Transport Proof Status

Status: no-spend transport proof status after `codex-auth-model-provider-bridge-gate.md` and the constructor-input hardening follow-up merged.

This document records sanitized local tool-surface checks only. It does not execute provider calls, does not spend, does not compare model output, does not create raw model evidence, does not approve candidate calls, and does not imply launch, product, production, or broad provider-quality readiness.

## Sanitized local checks

The local no-spend checks observed:

- Codex CLI installed: true
- Codex CLI version observed: `codex-cli 0.134.0`
- auth file present: true
- sandbox smoke check passed: true
- structured-output support present: true, via `--output-schema`
- read-only sandbox selection present: true, via `--sandbox read-only`
- web search flag present: true, via `--search`
- MCP management surface present: true, via `codex mcp`
- plugin management surface present: true, via `codex plugin`
- doctor reported provider reachability without a candidate model call: true

These checks are local/tooling-readiness signals only. They do not prove a credential-neutral Atliera `ModelProvider` transport and do not prove GPT-5.5 candidate-call readiness.

## Blocker

Execution remains still blocked.

Reason: the available Codex surface remains an autonomous agent execution surface, not a proven model-only transport. The CLI exposes agent execution, sandbox selection, MCP management, plugin management, optional web search, and structured final-output support. Those controls are useful for operator workflows, but they do not prove that a candidate request can be restricted to `ModelProviderRequest` in and `ModelProviderResponse` out with no tools, no shell, no file access, no web search, no plugins, and no retrieval.

A read-only sandbox is not the same as no file access, and structured final output is not the same as a provider response contract. The candidate GPT-5.5 comparison path must not use the autonomous agent surface as a substitute for a proven injected `model-only-codex-auth` transport.

## Current proof-state markers

This status preserves:

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

## Required next proof before candidate calls

Before any GPT-5.5 candidate comparison call, Atliera still needs a separately proven injected transport that:

1. accepts only an Atliera `ModelProviderRequest`;
2. returns only an Atliera `ModelProviderResponse`;
3. exposes no tools, no shell access, no file access, no web search, no plugins, and no retrieval to the candidate request;
4. rejects or disables online/search/plugin/MCP surfaces for the candidate request;
5. keeps any raw request, response, transcript, and operational evidence outside the repository;
6. emits only sanitized status into durable repository docs;
7. preserves `authorizes_candidate_calls: false` until the separate approval, pre-call source screen, budget gate, and provider-validation gates are satisfied.

If such a transport cannot be proven, the correct outcome is another sanitized blocker rather than a candidate call, credential-path substitution, or autonomous-agent workaround.
