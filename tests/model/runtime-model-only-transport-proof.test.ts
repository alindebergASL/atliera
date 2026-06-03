import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createModelProviderRequest } from "../../src/model/provider.js";
import {
  createRuntimeModelOnlyTransportProof,
  type RuntimeModelOnlyInjectedCaller,
} from "../../src/model/runtime-model-only-transport-proof.js";

const request = () => createModelProviderRequest({
  operation: "graph.propose",
  mode: "model",
  model: "gpt-5.5",
  prompt: "Return empty graph proposal arrays for a synthetic smoke only.",
  inputGraphRef: "corpus/runtime-model-gpt55-smoke.json",
  idempotencyKey: "runtime-proof-165",
  maxOutputTokens: 256,
  temperature: 0,
  metadata: { prompt_contract_ref: "prompt-contracts/runtime-model-gpt55-smoke-v1" },
});

const responseJson = JSON.stringify({
  provider: "openai-codex",
  model: "gpt-5.5",
  idempotencyKey: "runtime-proof-165",
  output: { excerpts: [], claims: [], account_objects: [] },
  usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
  cost: { currency: "USD", amount: 0 },
});

describe("runtime model-only transport proof", () => {
  test("uses an injected caller to prove request/response mapping without runtime provider calls", async () => {
    const calls: unknown[] = [];
    const proof = createRuntimeModelOnlyTransportProof({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      caller: async (payload) => {
        calls.push(payload);
        return responseJson;
      },
    });

    assert.equal("generate" in proof, false, "proof seam must not implement runtime ModelProvider");

    const result = await proof.generateNoSpendProof(request());

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      provider_ref: "openai-codex",
      model: "gpt-5.5",
      operation: "graph.propose",
      idempotency_key: "runtime-proof-165",
      input_graph_ref: "corpus/runtime-model-gpt55-smoke.json",
      max_output_tokens: 256,
      temperature: 0,
      store: false,
      metadata: { prompt_contract_ref: "prompt-contracts/runtime-model-gpt55-smoke-v1" },
    });
    assert.deepEqual(result.response, JSON.parse(responseJson));
    assert.equal(result.provider_calls_executed, 0);
    assert.equal(result.provider_spend, false);
    assert.equal(result.authorizes_candidate_calls, false);
    assert.equal(result.model_only_transport_proven, false);
    assert.equal(result.runtime_model_provider_implemented, false);
  });

  test("does not read process.env while planning or parsing", async () => {
    const original = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      const proof = createRuntimeModelOnlyTransportProof({
        providerRef: "openai-codex",
        modelLabel: "gpt-5.5",
        caller: async () => responseJson,
      });
      await proof.generateNoSpendProof(request());
    } finally {
      if (original) Object.defineProperty(process, "env", original);
    }
  });

  test("rejects hostile request metadata before injected caller access", async () => {
    let called = false;
    const proof = createRuntimeModelOnlyTransportProof({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      caller: async () => {
        called = true;
        return responseJson;
      },
    });
    await assert.rejects(
      () => proof.generateNoSpendProof(createModelProviderRequest({
        ...request(),
        metadata: { tool_choice: "none" },
      })),
      /runtime model-only proof metadata rejected/,
    );
    await assert.rejects(
      () => proof.generateNoSpendProof(createModelProviderRequest({
        ...request(),
        metadata: { prompt_contract_ref: "prompt-contracts/../../secret" },
      })),
      /runtime model-only proof metadata rejected/,
    );
    assert.equal(called, false);
  });

  test("rejects forged unsafe request fields before injected caller access", async () => {
    let called = false;
    const proof = createRuntimeModelOnlyTransportProof({
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      caller: async () => {
        called = true;
        return responseJson;
      },
    });
    await assert.rejects(
      () => proof.generateNoSpendProof({
        ...request(),
        operation: "tool.run",
        inputGraphRef: "https://example.test/private",
        maxOutputTokens: -1,
        temperature: 99,
      } as never),
      /runtime model-only proof request rejected/,
    );
    await assert.rejects(
      () => proof.generateNoSpendProof({
        ...request(),
        endpoint: "https://example.invalid/private",
        tool_choice: "auto",
      } as never),
      /runtime model-only proof request rejected/,
    );
    assert.equal(called, false);
  });

  test("rejects response smuggling and malformed provider-shaped JSON", async () => {
    for (const unsafe of [
      "```json\n{}\n```",
      JSON.stringify({
        provider: "openai-codex",
        model: "gpt-5.5",
        idempotencyKey: "runtime-proof-165",
        output: { excerpts: [], claims: [], account_objects: [] },
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
        cost: { currency: "USD", amount: 0 },
        raw_response: "SECRET",
      }),
      JSON.stringify({
        provider: "openai-codex",
        model: "gpt-5.5",
        idempotencyKey: "runtime-proof-165",
        output: { excerpts: [], claims: [], account_objects: [], rawOutput: "SECRET" },
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
        cost: { currency: "USD", amount: 0 },
      }),
      JSON.stringify({
        provider: "openai-codex",
        model: "gpt-5.5",
        idempotencyKey: "runtime-proof-165",
        output: { excerpts: [], claims: [], account_objects: [] },
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
        cost: { currency: "USD", amount: 123 },
      }),
      JSON.stringify({
        provider: "wrong-provider",
        model: "gpt-5.5",
        idempotencyKey: "runtime-proof-165",
        output: { excerpts: [], claims: [], account_objects: [] },
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
        cost: { currency: "USD", amount: 0 },
      }),
    ]) {
      const proof = createRuntimeModelOnlyTransportProof({
        providerRef: "openai-codex",
        modelLabel: "gpt-5.5",
        caller: async () => unsafe,
      });
      await assert.rejects(() => proof.generateNoSpendProof(request()), /runtime model-only proof response rejected/);
    }
  });
});
