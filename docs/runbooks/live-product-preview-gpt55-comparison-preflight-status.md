# Live Product Preview GPT-5.5 Comparison Preflight Status

Status: no-spend execution-readiness preflight after `live-product-preview-gpt55-comparison-approval.md` merged.

This document records sanitized local readiness checks only. It does not execute provider calls, does not spend, does not compare model output, does not create raw model evidence, does not approve a replacement credential path, and does not imply readiness or broad provider quality.

## Approval surface checked

- approval packet: `live-product-preview-gpt55-comparison-approval.md`
- approved candidate route: GPT-5.5 through Codex authentication when feasible
- approved operation: `graph.propose`
- approved comparison scope: at most six candidate calls against the already-sanitized six-slot `owl-alpha` baseline shape
- approved max comparison cost: `$30.00`
- required request surface: no tools, no shell access, no file access, no plugins, no web search, no online/retrieval setting

## Sanitized local checks

The local preflight found:

- Codex CLI installed: true
- Codex CLI version observed: `codex-cli 0.134.0`
- standalone Codex auth file present: true
- Hermes auth file present: true
- Codex sandbox smoke check passed: true
- Codex CLI exposes structured-output support: true, via `--output-schema`
- Codex CLI exposes read-only sandbox selection: true, via `--sandbox read-only`

These are tooling-readiness signals only. They do not prove the candidate route can be used as an Atliera `ModelProvider` under the approval packet.

## Execution blocker

Execution is blocked for now.

Reason: the available Codex CLI surface is an autonomous agent execution surface, not yet a credential-neutral, model-only Atliera `ModelProvider` bridge. Even with a read-only sandbox and an output schema, the CLI surface still exposes an agent/tool execution mode rather than a proven no-tools/no-shell/no-file-access provider call.

The approval packet requires the Codex-auth bridge to expose only the Atliera `ModelProvider` request/response contract and not grant tools, shell access, web search, file access, or plugin access to the candidate model request. That bridge has not been proven in this repo yet.

## Follow-up bridge gate

The first no-spend bridge gate is `codex-auth-model-provider-bridge-gate.md`. It adds a credential-neutral `ModelProvider` bridge contract and readiness gate in source, but it still blocks candidate calls until a real injected `model-only-codex-auth` transport is proven outside the autonomous Codex CLI agent surface.

## Required next step before candidate calls

Before any GPT-5.5 candidate provider call, add or prove a credential-neutral Codex-auth bridge that:

1. uses Codex authentication without committing secrets or session material;
2. accepts a `ModelProviderRequest` and returns a `ModelProviderResponse` only;
3. enforces no tools, no shell access, no file access, no plugins, no web search, and no retrieval settings;
4. rejects markdown JSON fences and schema-mismatched output;
5. keeps raw request/response material outside the repository;
6. emits only sanitized status into repository docs;
7. stops with a sanitized blocker if any no-tools guarantee cannot be enforced.

## Safety markers

This status preserves:

- provider_calls_executed: 0
- provider_spend: false
- model_output_compared: false
- raw_provider_evidence_committed: false
- codex_secret_material_committed: false
- replacement_credential_path_approved: false
- tools_or_plugins_approved: false
- web_search_approved: false
- production_writes: false
- runtime_model_mode_integration: false
- launch_readiness_claim: false
- product_readiness_claim: false
- production_readiness_claim: false
- broad_provider_quality_claim: false
