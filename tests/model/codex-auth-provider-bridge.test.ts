import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CodexAuthModelProviderBridge,
  evaluateCodexAuthBridgeReadiness,
  type CodexAuthModelOnlyGuarantee,
  type CodexAuthModelProviderTransport,
} from "../../src/model/codex-auth-provider-bridge.ts";
import { createModelProviderRequest, type ModelProviderRequest, type ModelProviderResponse } from "../../src/model/provider.ts";

const GUARANTEE: CodexAuthModelOnlyGuarantee = Object.freeze({
  modelOnlyTransport: true,
  toolUseDisabled: true,
  shellAccessDisabled: true,
  fileAccessDisabled: true,
  webSearchDisabled: true,
  pluginsDisabled: true,
  retrievalDisabled: true,
  credentialNeutral: true,
  privateEvidenceOutsideRepo: true,
});

function request(metadata: Record<string, string> = {}) {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "model",
    model: "gpt-5.5",
    prompt: "Return graph.propose JSON only.",
    inputGraphRef: "external-corpus/live-product-preview-six-slot/representative-a",
    idempotencyKey: "gpt55_comparison_slot_a",
    maxOutputTokens: 4096,
    temperature: 0,
    metadata: {
      codex_auth_bridge: "model_only",
      tools: "false",
      plugins: "false",
      web_search: "false",
      retrieval: "false",
      shell_access: "false",
      file_access: "false",
      online_variant: "false",
      ...metadata,
    },
  });
}

function response(input: ModelProviderRequest, overrides: Partial<ModelProviderResponse> = {}): ModelProviderResponse {
  return {
    provider: "codex-auth",
    model: input.model,
    idempotencyKey: input.idempotencyKey,
    output: { excerpts: [], claims: [], account_objects: [] },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    cost: { currency: "USD", amount: 0.01 },
    ...overrides,
  };
}

function providerTransport(fn?: (input: ModelProviderRequest) => Promise<ModelProviderResponse>): CodexAuthModelProviderTransport & { calls: ModelProviderRequest[] } {
  const calls: ModelProviderRequest[] = [];
  return {
    kind: "model-only-codex-auth",
    calls,
    async generate(input: ModelProviderRequest) {
      calls.push(input);
      return fn === undefined ? response(input) : fn(input);
    },
  };
}

describe("Codex-auth ModelProvider bridge", () => {
  it("fails closed until every no-tools and credential-neutral readiness proof is present", () => {
    const report = evaluateCodexAuthBridgeReadiness({
      codexCliInstalled: true,
      codexAuthPresent: true,
      sandboxSmokePassed: true,
      structuredOutputSupported: true,
      modelOnlyTransportProven: false,
      toolUseDisabled: false,
      shellAccessDisabled: false,
      fileAccessDisabled: false,
      webSearchDisabled: false,
      pluginsDisabled: false,
      retrievalDisabled: false,
      credentialNeutral: false,
      privateEvidenceBoundaryProven: false,
    });

    assert.equal(report.ok, false);
    assert.deepEqual(report.refusal_reasons, [
      "model_only_transport_unproven",
      "tool_disable_unproven",
      "shell_access_disable_unproven",
      "file_access_disable_unproven",
      "web_search_disable_unproven",
      "plugin_disable_unproven",
      "retrieval_disable_unproven",
      "credential_neutrality_unproven",
      "private_evidence_boundary_unproven",
    ]);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.tool_use_allowed, false);
    assert.equal(report.shell_access_allowed, false);
    assert.equal(report.file_access_allowed, false);
    assert.equal(report.web_search_allowed, false);
    assert.equal(report.plugins_allowed, false);
    assert.equal(report.retrieval_allowed, false);
    assert.equal(report.credential_material_committed, false);
  });

  it("passes readiness only when the model-only transport and all no-tools guarantees are proven", () => {
    const report = evaluateCodexAuthBridgeReadiness({
      codexCliInstalled: true,
      codexAuthPresent: true,
      sandboxSmokePassed: true,
      structuredOutputSupported: true,
      modelOnlyTransportProven: true,
      toolUseDisabled: true,
      shellAccessDisabled: true,
      fileAccessDisabled: true,
      webSearchDisabled: true,
      pluginsDisabled: true,
      retrievalDisabled: true,
      credentialNeutral: true,
      privateEvidenceBoundaryProven: true,
    });

    assert.equal(report.ok, true);
    assert.deepEqual(report.refusal_reasons, []);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
  });

  it("adapts a proven model-only transport through the ModelProvider request and response contract", async () => {
    const transport = providerTransport();
    const provider = new CodexAuthModelProviderBridge({
      name: "codex-auth",
      candidateModel: "gpt-5.5",
      guarantee: GUARANTEE,
      transport,
    });

    const output = await provider.generate(request());

    assert.equal(output.provider, "codex-auth");
    assert.equal(output.model, "gpt-5.5");
    assert.equal(output.idempotencyKey, "gpt55_comparison_slot_a");
    assert.deepEqual(output.output, { excerpts: [], claims: [], account_objects: [] });
    assert.equal(transport.calls.length, 1);
  });

  it("rejects construction unless the injected transport is explicitly model-only and credential-neutral", () => {
    assert.throws(
      () => new CodexAuthModelProviderBridge({
        name: "codex-auth",
        candidateModel: "gpt-5.5",
        guarantee: { ...GUARANTEE, shellAccessDisabled: false } as unknown as CodexAuthModelOnlyGuarantee,
        transport: providerTransport(),
      }),
      /codex auth bridge guarantee rejected/,
    );
    assert.throws(
      () => new CodexAuthModelProviderBridge({
        name: "codex-auth",
        candidateModel: "gpt-5.5",
        guarantee: GUARANTEE,
        transport: { ...providerTransport(), kind: "agent-codex-auth" } as unknown as CodexAuthModelProviderTransport,
      }),
      /codex auth bridge transport rejected/,
    );
  });

  it("rejects requests that omit or broaden the explicit no-tools request-surface metadata", async () => {
    const provider = new CodexAuthModelProviderBridge({
      name: "codex-auth",
      candidateModel: "gpt-5.5",
      guarantee: GUARANTEE,
      transport: providerTransport(),
    });

    await assert.rejects(
      () => provider.generate(request({ web_search: "true" })),
      /codex auth bridge request surface rejected/,
    );
    await assert.rejects(
      () => provider.generate(request({ codex_auth_bridge: "agent" })),
      /codex auth bridge metadata missing model-only marker/,
    );
    await assert.rejects(
      () => provider.generate(request({ shell_access: "true" })),
      /codex auth bridge request surface rejected/,
    );
  });

  it("fails closed with sanitized errors for transport failures or malformed responses", async () => {
    const failing = new CodexAuthModelProviderBridge({
      name: "codex-auth",
      candidateModel: "gpt-5.5",
      guarantee: GUARANTEE,
      transport: providerTransport(async () => {
        throw new Error("raw secret provider transcript");
      }),
    });
    await assert.rejects(
      () => failing.generate(request()),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "codex auth bridge transport failed");
        assert.doesNotMatch(error.message, /secret|transcript/i);
        return true;
      },
    );

    const malformed = new CodexAuthModelProviderBridge({
      name: "codex-auth",
      candidateModel: "gpt-5.5",
      guarantee: GUARANTEE,
      transport: providerTransport(async (input) => response(input, { usage: { inputTokens: 3, outputTokens: 2, totalTokens: 99 } })),
    });
    await assert.rejects(
      () => malformed.generate(request()),
      /codex auth bridge response rejected/,
    );
  });
});
