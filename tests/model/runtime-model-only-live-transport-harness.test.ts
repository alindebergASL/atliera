import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createModelProviderRequest, type ModelProviderResponse } from "../../src/model/provider.js";
import { createRuntimeModelOnlyLiveTransportHarness } from "../../src/model/runtime-model-only-live-transport-harness.js";

const request = () => createModelProviderRequest({
  operation: "graph.propose",
  mode: "model",
  model: "gpt-5.5",
  prompt: "Synthetic harness proof prompt. Return exact graph proposal JSON only.",
  inputGraphRef: "corpus/synthetic-runtime-model-only-live-proof.json",
  idempotencyKey: "runtime-model-only-live-harness-170",
  maxOutputTokens: 256,
  temperature: 0,
  metadata: {
    prompt_contract_ref: "prompts/synthetic-runtime-model-only-live-proof-v1",
    tools: "false",
    shell_access: "false",
    file_access: "false",
    web_search: "false",
    plugins: "false",
    mcp: "false",
    retrieval: "false",
  },
});

const response = (): ModelProviderResponse => ({
  provider: "openai-codex",
  model: "gpt-5.5",
  idempotencyKey: "runtime-model-only-live-harness-170",
  output: { excerpts: [], claims: [], account_objects: [] },
  usage: { inputTokens: 8, outputTokens: 9, totalTokens: 17 },
  cost: { currency: "USD", amount: 0.01 },
});

describe("runtime model-only live transport harness", () => {
  test("validates a fake live transport boundary without executing provider calls", async () => {
    const harness = createRuntimeModelOnlyLiveTransportHarness({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      maxCostUsd: 1,
      responseFixture: response(),
    });

    const proof = await harness.proveNoCallBoundary(request());
    assert.equal(proof.status, "no-call-harness-boundary-proven");
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
    assert.equal(proof.authorizes_provider_call, false);
    assert.equal(proof.authorizes_candidate_calls, false);
    assert.equal(proof.authorizes_comparison_run, false);
    assert.equal(proof.model_only_live_transport_implemented, false);
    assert.equal(proof.max_cost_usd, 1);
    assert.equal(proof.request_shape, "exact");
    assert.equal(proof.response_shape, "exact");
  });

  test("rejects unsafe logical identifiers and prototype-backed smuggling", async () => {
    assert.throws(
      () => createRuntimeModelOnlyLiveTransportHarness({
        providerRef: "openai/codex",
        modelLabel: "gpt-5.5",
        maxCostUsd: 1,
        responseFixture: response(),
      }),
      /runtime model-only live transport provider rejected/,
    );
    assert.throws(
      () => createRuntimeModelOnlyLiveTransportHarness({
        providerRef: "openai-codex",
        modelLabel: "provider/gpt-5.5",
        maxCostUsd: 1,
        responseFixture: response(),
      }),
      /runtime model-only live transport model rejected/,
    );

    const protoBacked = Object.create({ endpoint: "https://example.invalid" }) as ReturnType<typeof request>;
    Object.assign(protoBacked, request());
    const harness = createRuntimeModelOnlyLiveTransportHarness({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      maxCostUsd: 1,
      responseFixture: response(),
    });
    await assert.rejects(
      () => harness.proveNoCallBoundary(protoBacked),
      /runtime model-only live transport request rejected/,
    );
  });

  test("rejects request smuggling and forbidden surfaces before transport access", async () => {
    let calls = 0;
    const harness = createRuntimeModelOnlyLiveTransportHarness({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      maxCostUsd: 1,
      responseFixture: response(),
    });

    await assert.rejects(
      () => harness.proveNoCallBoundary({ ...request(), endpoint: "https://example.invalid", tool_choice: "auto" } as never),
      /runtime model-only live transport request rejected/,
    );
    await assert.rejects(
      () => harness.proveNoCallBoundary(createModelProviderRequest({
        ...request(),
        inputGraphRef: "corpus/real-account-data.json",
      })),
      /runtime model-only live transport synthetic scope rejected/,
    );
    await assert.rejects(
      () => harness.proveNoCallBoundary(createModelProviderRequest({
        ...request(),
        metadata: { ...request().metadata, web_search: "true" },
      })),
      /runtime model-only live transport surface rejected/,
    );
    assert.equal(calls, 0);
  });

  test("rejects malformed or smuggled responses from fake transport", async () => {
    const badResponses: readonly unknown[] = [
      { ...response(), rawResponse: "SECRET" },
      { ...response(), provider: "wrong-provider" },
      { ...response(), cost: { currency: "USD", amount: 2 } },
      { ...response(), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 99 } },
    ];

    for (const badResponse of badResponses) {
      const harness = createRuntimeModelOnlyLiveTransportHarness({
        providerRef: "openai-codex",
        modelLabel: "gpt-5.5",
        maxCostUsd: 1,
        responseFixture: badResponse as ModelProviderResponse,
      });
      await assert.rejects(
        () => harness.proveNoCallBoundary(request()),
        /runtime model-only live transport response rejected/,
      );
    }
  });

  test("rejects function-backed transport injection and response output smuggling", async () => {
    assert.throws(
      () => createRuntimeModelOnlyLiveTransportHarness({
        providerRef: "openai-codex",
        modelLabel: "gpt-5.5",
        maxCostUsd: 1,
        transport: async () => response(),
      } as never),
      /runtime model-only live transport fixture rejected/,
    );

    const harness = createRuntimeModelOnlyLiveTransportHarness({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      maxCostUsd: 1,
      responseFixture: {
        ...response(),
        output: { excerpts: [{ rawResponse: "SECRET" }], claims: [], account_objects: [] },
      } as never,
    });

    await assert.rejects(
      () => harness.proveNoCallBoundary(request()),
      /runtime model-only live transport response rejected/,
    );

    const smuggledArray = [] as unknown[] & { rawResponse?: string };
    smuggledArray.rawResponse = "SECRET";
    const propertyHarness = createRuntimeModelOnlyLiveTransportHarness({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      maxCostUsd: 1,
      responseFixture: {
        ...response(),
        output: { excerpts: smuggledArray, claims: [], account_objects: [] },
      } as never,
    });

    await assert.rejects(
      () => propertyHarness.proveNoCallBoundary(request()),
      /runtime model-only live transport response rejected/,
    );
  });

  test("does not read process.env while proving the no-call harness boundary", async () => {
    const original = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      const harness = createRuntimeModelOnlyLiveTransportHarness({
        providerRef: "openai-codex",
        modelLabel: "gpt-5.5",
        maxCostUsd: 1,
        responseFixture: response(),
      });
      await harness.proveNoCallBoundary(request());
    } finally {
      if (original) Object.defineProperty(process, "env", original);
    }
  });
});
