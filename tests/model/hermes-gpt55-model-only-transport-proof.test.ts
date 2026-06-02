import assert from "node:assert/strict";
import test from "node:test";

import {
  createHermesGpt55ModelOnlyRequestPlan,
  HermesGpt55ModelOnlyInjectedTransportProof,
  type HermesGpt55ModelOnlyProviderPayload,
} from "../../src/model/hermes-gpt55-model-only-transport-proof.ts";
import { createModelProviderRequest, type ModelProviderResponse } from "../../src/model/provider.ts";

function validRequest(metadata: Record<string, string> = {}) {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "model",
    model: "gpt-5.5",
    prompt: "Return a minimal graph proposal for the controlled fixture.",
    inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
    idempotencyKey: "hermes-gpt55-proof-smoke",
    maxOutputTokens: 4096,
    temperature: 0,
    metadata,
  });
}

test("creates a no-spend Hermes GPT-5.5 provider payload with no autonomous surfaces", () => {
  const plan = createHermesGpt55ModelOnlyRequestPlan(validRequest({ corpus_ref: "controlled-fixture" }));

  assert.equal(plan.schema_version, "atliera.hermes_gpt55_model_only_transport_proof.v1");
  assert.equal(plan.provider_route, "openai-codex");
  assert.equal(plan.api_mode, "codex_responses");
  assert.equal(plan.model, "gpt-5.5");
  assert.equal(plan.store, false);
  assert.equal(plan.provider_calls_executed, 0);
  assert.equal(plan.provider_spend, false);
  assert.equal(plan.authorizes_candidate_calls, false);
  assert.equal(plan.model_only_transport_proven, false);
  assert.equal(plan.tool_use_allowed, false);
  assert.equal(plan.shell_access_allowed, false);
  assert.equal(plan.file_access_allowed, false);
  assert.equal(plan.web_search_allowed, false);
  assert.equal(plan.plugins_allowed, false);
  assert.equal(plan.retrieval_allowed, false);
  assert.equal(plan.skills_loaded, false);
  assert.equal(plan.memory_loaded, false);
  assert.equal(plan.mcp_allowed, false);

  assert.equal(Object.hasOwn(plan.provider_payload, "tools"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "tool_choice"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "parallel_tool_calls"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "plugins"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "web_search"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "retrieval"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "mcp"), false);
  assert.equal(Object.hasOwn(plan.provider_payload, "extra_headers"), false);

  assert.deepEqual(plan.provider_payload, {
    model: "gpt-5.5",
    instructions: "Return only an Atliera ModelProviderResponse-compatible JSON object. Do not call tools, browse, retrieve, execute code, or use external state.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Return a minimal graph proposal for the controlled fixture.",
          },
        ],
      },
    ],
    store: false,
    max_output_tokens: 4096,
  });
});

test("rejects adversarial metadata that tries to smuggle autonomous surfaces", () => {
  for (const key of [
    "tools",
    "tool_choice",
    "shell_access",
    "file_access",
    "web_search",
    "plugins",
    "plugin",
    "mcp",
    "retrieval",
    "memory",
    "skills",
    "session_id",
    "prompt_cache_key",
    "base_url",
    "endpoint",
    "api_key",
    "authorization",
  ]) {
    assert.throws(
      () => createHermesGpt55ModelOnlyRequestPlan(validRequest({ [key]: "true" })),
      /forbidden metadata key/i,
      key,
    );
  }
});

test("constructs the no-spend plan without reading process.env", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const plan = createHermesGpt55ModelOnlyRequestPlan(validRequest());
    assert.equal(plan.provider_calls_executed, 0);
    assert.equal(plan.provider_spend, false);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

function successfulRawResponse(request = validRequest()): string {
  const response: ModelProviderResponse = {
    provider: "hermes-gpt55-model-only-proof",
    model: "gpt-5.5",
    idempotencyKey: request.idempotencyKey,
    output: {
      excerpts: [],
      claims: [],
      account_objects: [],
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    cost: {
      currency: "USD",
      amount: 0,
    },
  };
  return JSON.stringify(response);
}

test("injected transport proof maps a strict fake caller response without provider spend", async () => {
  const calls: HermesGpt55ModelOnlyProviderPayload[] = [];
  const request = validRequest({ corpus_ref: "controlled-fixture" });
  const provider = new HermesGpt55ModelOnlyInjectedTransportProof({
    fakeCaller: {
      kind: "no-spend-fake-caller",
      respond: (payload) => {
        calls.push(payload);
        return { rawJson: successfulRawResponse(request) };
      },
    },
  });

  const response = provider.generateNoSpendProof(request);

  assert.equal(provider.name, "hermes-gpt55-model-only-proof");
  assert.equal(response.provider, "hermes-gpt55-model-only-proof");
  assert.equal(response.model, "gpt-5.5");
  assert.equal(response.idempotencyKey, request.idempotencyKey);
  assert.deepEqual(response.output, { excerpts: [], claims: [], account_objects: [] });
  assert.deepEqual(response.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  assert.deepEqual(response.cost, { currency: "USD", amount: 0 });

  assert.equal(calls.length, 1);
  const call = calls[0] as HermesGpt55ModelOnlyProviderPayload;
  assert.equal(call.store, false);
  assert.equal(Object.hasOwn(call, "tools"), false);
  assert.equal(Object.hasOwn(call, "tool_choice"), false);
  assert.equal(Object.hasOwn(call, "parallel_tool_calls"), false);
  assert.equal(Object.hasOwn(call, "plugins"), false);
  assert.equal(Object.hasOwn(call, "web_search"), false);
  assert.equal(Object.hasOwn(call, "retrieval"), false);
  assert.equal(Object.hasOwn(call, "mcp"), false);
});

test("injected transport proof rejects smuggled surfaces before invoking the caller", async () => {
  let calls = 0;
  const provider = new HermesGpt55ModelOnlyInjectedTransportProof({
    fakeCaller: {
      kind: "no-spend-fake-caller",
      respond: () => {
        calls += 1;
        return { rawJson: successfulRawResponse() };
      },
    },
  });

  assert.throws(
    () => provider.generateNoSpendProof(validRequest({ tools: "true" })),
    /forbidden metadata key/i,
  );
  assert.equal(calls, 0);
});

test("injected transport proof fails closed on malformed fake caller responses", () => {
  const provider = new HermesGpt55ModelOnlyInjectedTransportProof({
    fakeCaller: {
      kind: "no-spend-fake-caller",
      respond: () => ({ rawJson: JSON.stringify({ provider: "wrong", output: {} }) }),
    },
  });

  assert.throws(
    () => provider.generateNoSpendProof(validRequest()),
    /invalid Hermes GPT-5.5 model-only response/i,
  );
});

test("injected transport proof rejects extra raw or credential-like response fields", () => {
  const request = validRequest();
  const parsed = JSON.parse(successfulRawResponse(request));
  parsed.raw_response = "forbidden";
  const provider = new HermesGpt55ModelOnlyInjectedTransportProof({
    fakeCaller: {
      kind: "no-spend-fake-caller",
      respond: () => ({ rawJson: JSON.stringify(parsed) }),
    },
  });

  assert.throws(
    () => provider.generateNoSpendProof(request),
    /invalid Hermes GPT-5.5 model-only response/i,
  );
});

test("injected transport proof does not read process.env while generating through the fake caller", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const provider = new HermesGpt55ModelOnlyInjectedTransportProof({
      fakeCaller: {
        kind: "no-spend-fake-caller",
        respond: () => ({ rawJson: successfulRawResponse() }),
      },
    });
    const response = provider.generateNoSpendProof(validRequest());
    assert.equal(response.cost.amount, 0);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
