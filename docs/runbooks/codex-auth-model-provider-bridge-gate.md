# Codex-Auth ModelProvider Bridge Gate

Status: no-spend implementation contract for the GPT-5.5 comparison path.

This document describes the credential-neutral Codex-auth bridge gate added after `live-product-preview-gpt55-comparison-preflight-status.md`. It does not execute provider calls, does not spend, does not compare output, and does not prove GPT-5.5 quality or readiness.

## Implemented surface

The implemented source is `src/model/codex-auth-provider-bridge.ts`.

It adds:

- `evaluateCodexAuthBridgeReadiness(...)`, a sanitized readiness gate;
- `CodexAuthModelProviderBridge`, a `ModelProvider` adapter around an injected model-only Codex-auth transport;
- `CodexAuthModelOnlyGuarantee`, an explicit all-true guarantee object required before construction;
- request-surface enforcement that requires explicit model-only/no-tools metadata;
- response-contract enforcement for provider/model/idempotency, graph output arrays, usage arithmetic, and non-negative USD cost;
- sanitized fail-closed errors for transport failures and malformed responses.

## Readiness gate

The readiness gate refuses execution unless all of the following are proven before a candidate call:

- Codex CLI installed;
- Codex authentication present;
- sandbox smoke check passed;
- structured output support present;
- model-only transport proven;
- tool use disabled;
- shell access disabled;
- file access disabled;
- web search disabled;
- plugins disabled;
- retrieval disabled;
- credential neutrality proven;
- private evidence boundary proven.

The readiness report always preserves:

- provider_calls_executed: 0
- provider_spend: false
- tool_use_allowed: false
- shell_access_allowed: false
- file_access_allowed: false
- web_search_allowed: false
- plugins_allowed: false
- retrieval_allowed: false
- credential_material_committed: false

## Request metadata contract

The bridge requires candidate `ModelProviderRequest.metadata` to include:

- `codex_auth_bridge: "model_only"`
- `tools: "false"`
- `plugins: "false"`
- `web_search: "false"`
- `retrieval: "false"`
- `shell_access: "false"`
- `file_access: "false"`
- `online_variant: "false"`

If any marker is missing or broadened, the bridge rejects the request before touching the injected transport.

## Operator smoke status

A separate operator-only GPT-5.5 smoke record exists at `live-product-preview-gpt55-operator-smoke-status.md`. That record confirms the Hermes operator connection can return strict JSON for one synthetic prompt, but it is not an Atliera `ModelProvider` execution and does not satisfy this bridge gate.

## Remaining blocker

The code now provides the bridge gate and adapter contract, but a real candidate GPT-5.5 run is still blocked until deployment/private validation proves an injected `model-only-codex-auth` transport. The current Codex CLI agent surface alone remains insufficient because it has not been proven to be a model-only, no-tools, no-shell, no-file-access provider call.

## Interpretation limits

This bridge gate is not a provider-quality result, not a GPT-5.5 quality conclusion, not a production-model selection, not runtime/model-mode integration, and not launch/product/production readiness.
