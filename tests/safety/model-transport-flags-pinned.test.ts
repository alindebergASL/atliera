// ADR 0003 I-1: model-transport flags pinned "false".
//
// Reaffirms, under the normative greppable name, the behavior the
// injection seam has enforced since PR #173: every model-bound request
// carries the transport-surface flags as the string "false", and the
// seam rejects any request whose metadata flips one. The five flags
// named by ADR 0003 R1 (tools, web_search, plugins, mcp, retrieval) are
// a subset of the seam's full pinned surface, which also includes
// shell_access and file_access.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { bindRuntimeModelOnlyLiveTransportInjectionSeam } from "../../src/model/runtime-model-only-live-transport-injection-seam.ts";
import type {
  ModelOnlyLiveTransport,
  RuntimeModelOnlyLiveTransportInjectionSeamOptions,
} from "../../src/model/runtime-model-only-live-transport-injection-seam.ts";
import type { ModelProviderRequest, ModelProviderResponse } from "../../src/model/provider.ts";

const ADR_FLAGS = ["tools", "web_search", "plugins", "mcp", "retrieval"] as const;
const FULL_PINNED_SURFACE = [
  "tools",
  "shell_access",
  "file_access",
  "web_search",
  "plugins",
  "mcp",
  "retrieval",
] as const;

const SEAM_SOURCE = join(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "model",
  "runtime-model-only-live-transport-injection-seam.ts",
);

function neverCalledTransport(): ModelOnlyLiveTransport {
  return async (_request: ModelProviderRequest): Promise<ModelProviderResponse> => {
    throw new Error("transport must not be invoked");
  };
}

function baseOptions(): RuntimeModelOnlyLiveTransportInjectionSeamOptions {
  return {
    providerRef: "openai-codex",
    modelLabel: "gpt-5.5",
    maxCostUsd: 1,
    transport: neverCalledTransport(),
  };
}

function baseRequest(): ModelProviderRequest {
  return {
    operation: "graph.propose",
    mode: "model",
    model: "gpt-5.5",
    prompt: "synthetic prompt",
    inputGraphRef: "corpus/synthetic-runtime-model-only-live-proof.json",
    idempotencyKey: "synthetic-flags-pinned-check",
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
  };
}

function baseResponse(req: ModelProviderRequest): ModelProviderResponse {
  return {
    provider: "openai-codex",
    model: "gpt-5.5",
    idempotencyKey: req.idempotencyKey,
    output: { excerpts: [], claims: [], account_objects: [] },
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    cost: { currency: "USD", amount: 0 },
  };
}

describe("ADR 0003 I-1", () => {
  test("test_model_transport_flags_pinned_false", async () => {
    // 1. The canonical request fixture carries every pinned flag as the
    //    string "false" — including all five ADR R1 flags.
    const req = baseRequest();
    for (const flag of FULL_PINNED_SURFACE) {
      assert.equal(
        req.metadata[flag],
        "false",
        `canonical request must pin metadata.${flag} to the string "false"`,
      );
    }
    for (const flag of ADR_FLAGS) {
      assert.ok(
        (FULL_PINNED_SURFACE as readonly string[]).includes(flag),
        `ADR R1 flag ${flag} must be part of the pinned surface`,
      );
    }

    // 2. The seam accepts the pinned request and rejects every flip.
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam(baseOptions());
    const fixture = baseResponse(req);
    await seam.proveInjectionSeamNoCall(req, fixture);

    for (const flag of FULL_PINNED_SURFACE) {
      const flipped = baseRequest();
      const metadata = { ...flipped.metadata, [flag]: "true" };
      await assert.rejects(
        () => seam.proveInjectionSeamNoCall({ ...flipped, metadata }, fixture),
        /surface rejected/,
        `seam must reject metadata.${flag} flipped to "true"`,
      );
    }

    // 3. Source-level pin: the seam's SURFACE_FALSE_KEYS constant covers
    //    all five ADR R1 flags, so removing one from the enforced set is
    //    a red build, not a silent relaxation.
    const seamSource = readFileSync(SEAM_SOURCE, "utf8");
    const surfaceBlock = seamSource.slice(seamSource.indexOf("SURFACE_FALSE_KEYS"));
    for (const flag of ADR_FLAGS) {
      assert.ok(
        surfaceBlock.includes(`"${flag}"`),
        `SURFACE_FALSE_KEYS must include "${flag}"`,
      );
    }
  });
});
