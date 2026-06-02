import assert from "node:assert/strict";
import test from "node:test";

import { createHermesGpt55ModelOnlyRequestPlan } from "../../src/model/hermes-gpt55-model-only-transport-proof.ts";
import { createModelProviderRequest } from "../../src/model/provider.ts";

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
