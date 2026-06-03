import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bindRuntimeModelOnlyLiveTransportInjectionSeam } from "../../src/model/runtime-model-only-live-transport-injection-seam.ts";
import type {
  ModelOnlyLiveTransport,
  RuntimeModelOnlyLiveTransportInjectionSeamOptions,
} from "../../src/model/runtime-model-only-live-transport-injection-seam.ts";
import type { ModelProviderRequest, ModelProviderResponse } from "../../src/model/provider.ts";

const PROVIDER_REF = "openai-codex";
const MODEL_LABEL = "gpt-5.5";
const MAX_COST = 1;

// A transport that asserts it is never invoked. The seam must hold this
// reference structurally and never call it from any code path in this PR.
function neverCalledTransport(): ModelOnlyLiveTransport & { calls: number } {
  let calls = 0;
  const fn = (async (_request: ModelProviderRequest): Promise<ModelProviderResponse> => {
    calls += 1;
    throw new Error("transport must not be invoked from the injection seam in this PR");
  }) as ModelOnlyLiveTransport & { calls: number };
  Object.defineProperty(fn, "calls", { get: () => calls });
  return fn;
}

function baseOptions(): RuntimeModelOnlyLiveTransportInjectionSeamOptions {
  return {
    providerRef: PROVIDER_REF,
    modelLabel: MODEL_LABEL,
    maxCostUsd: MAX_COST,
    transport: neverCalledTransport(),
  };
}

function baseRequest(): ModelProviderRequest {
  return {
    operation: "graph.propose",
    mode: "model",
    model: MODEL_LABEL,
    prompt: "synthetic-runtime-model-only-live-proof-v1 prompt",
    inputGraphRef: "corpus/synthetic-runtime-model-only-live-proof.json",
    idempotencyKey: "synthetic-runtime-model-only-live-proof-20260602a",
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
    provider: PROVIDER_REF,
    model: MODEL_LABEL,
    idempotencyKey: req.idempotencyKey,
    output: { excerpts: [], claims: [], account_objects: [] },
    usage: { inputTokens: 32, outputTokens: 64, totalTokens: 96 },
    cost: { currency: "USD", amount: 0.25 },
  };
}

describe("runtime model-only live transport injection seam", () => {
  test("emits a sanitized no-call proof and never invokes the injected transport", async () => {
    const transport = neverCalledTransport();
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), transport });
    const req = baseRequest();
    const proof = await seam.proveInjectionSeamNoCall(req, baseResponse(req));

    assert.equal(proof.status, "no-call-injection-seam-proven");
    assert.equal(proof.provider_ref, PROVIDER_REF);
    assert.equal(proof.model_label, MODEL_LABEL);
    assert.equal(proof.max_cost_usd, MAX_COST);
    assert.equal(proof.request_shape, "exact");
    assert.equal(proof.response_shape, "exact");
    assert.equal(proof.transport_injection_seam_proven, true);
    assert.equal(proof.transport_invoked, false);
    assert.equal(proof.model_only_live_transport_implemented, false);
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
    assert.equal(proof.authorizes_provider_call, false);
    assert.equal(proof.authorizes_candidate_calls, false);
    assert.equal(proof.authorizes_comparison_run, false);
    assert.equal(proof.default_model_selection_claim, false);
    assert.equal(proof.provider_lock_in, false);
    assert.equal(proof.production_readiness_claim, false);
    assert.equal(proof.product_readiness_claim, false);
    assert.equal(proof.launch_readiness_claim, false);
    assert.equal(proof.retry_requires_new_approval, true);
    // The injected transport must not have been invoked anywhere in
    // the seam path. This is the load-bearing safety property.
    assert.equal(transport.calls, 0);
  });

  test("rejects a non-function or wrong-arity transport at bind time", () => {
    assert.throws(
      () =>
        bindRuntimeModelOnlyLiveTransportInjectionSeam({
          ...baseOptions(),
          transport: "not a function" as unknown as ModelOnlyLiveTransport,
        }),
      /injection seam transport rejected/,
    );
    assert.throws(
      () =>
        bindRuntimeModelOnlyLiveTransportInjectionSeam({
          ...baseOptions(),
          transport: (async () => baseResponse(baseRequest())) as unknown as ModelOnlyLiveTransport,
        }),
      /injection seam transport rejected/,
      "transport must accept exactly one declared parameter",
    );
  });

  test("rejects unsafe provider/model logical IDs and over-cap budgets at bind time", () => {
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), providerRef: "../etc/passwd" }),
      /injection seam provider rejected/,
    );
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), modelLabel: "https://evil" }),
      /injection seam model rejected/,
    );
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), maxCostUsd: 2 }),
      /injection seam budget rejected/,
    );
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), maxCostUsd: 0 }),
      /injection seam budget rejected/,
    );
  });

  test("rejects extra option keys, prototype-backed options, accessors, and symbols", () => {
    assert.throws(
      () =>
        bindRuntimeModelOnlyLiveTransportInjectionSeam({
          ...baseOptions(),
          bonus: "extra",
        } as unknown as RuntimeModelOnlyLiveTransportInjectionSeamOptions),
      /injection seam options rejected/,
    );
    const protoBacked = Object.create({ authorizationHeader: "Bearer SECRET" });
    Object.assign(protoBacked, baseOptions());
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam(protoBacked),
      /injection seam options rejected/,
    );
    const withAccessor = { ...baseOptions() } as Record<string, unknown>;
    Object.defineProperty(withAccessor, "providerRef", { get: () => "openai-codex", enumerable: true, configurable: true });
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam(withAccessor as unknown as RuntimeModelOnlyLiveTransportInjectionSeamOptions),
      /injection seam options rejected/,
    );
    const withSymbol = { ...baseOptions() } as Record<string | symbol, unknown>;
    withSymbol[Symbol("smuggle")] = "x";
    assert.throws(
      () => bindRuntimeModelOnlyLiveTransportInjectionSeam(withSymbol as unknown as RuntimeModelOnlyLiveTransportInjectionSeamOptions),
      /injection seam options rejected/,
    );
  });

  test("rejects request shape violations: extra keys, wrong operation/mode/model, oversized prompt", async () => {
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam(baseOptions());
    const fixture = baseResponse(baseRequest());

    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), bonus: "x" } as unknown as ModelProviderRequest, fixture),
      /injection seam request rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), operation: "graph.write" as never }, fixture),
      /injection seam request rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), mode: "fixture" as never }, fixture),
      /injection seam request rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), model: "other-model" }, fixture),
      /injection seam request rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), prompt: "x".repeat(4001) }, fixture),
      /injection seam request rejected/,
    );
  });

  test("rejects broadened metadata surfaces (tools/shell/file/web/plugins/mcp/retrieval flipped to true)", async () => {
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam(baseOptions());
    const fixture = baseResponse(baseRequest());

    for (const flag of ["tools", "shell_access", "file_access", "web_search", "plugins", "mcp", "retrieval"]) {
      const req = baseRequest();
      const metadata = { ...req.metadata, [flag]: "true" };
      await assert.rejects(
        () => seam.proveInjectionSeamNoCall({ ...req, metadata }, fixture),
        /injection seam surface rejected/,
        `broadened ${flag} must be rejected`,
      );
    }

    const extraKey = baseRequest();
    const metadata = { ...extraKey.metadata, extra_surface: "false" };
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...extraKey, metadata }, fixture),
      /injection seam surface rejected/,
    );
  });

  test("rejects unsafe refs and synthetic-only scope violations", async () => {
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam(baseOptions());
    const fixture = baseResponse(baseRequest());

    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), inputGraphRef: "corpus/../escape.json" }, fixture),
      /synthetic scope rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), inputGraphRef: "https://example.invalid/x.json" }, fixture),
      /synthetic scope rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...baseRequest(), inputGraphRef: "corpus/real-customer-account.json" }, fixture),
      /synthetic scope rejected/,
    );
    const req = baseRequest();
    const metadata = { ...req.metadata, prompt_contract_ref: "prompts/production-default-v1" };
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall({ ...req, metadata }, fixture),
      /synthetic scope rejected/,
    );
  });

  test("rejects malformed response shape, accounting errors, and provider/model/idempotency mismatch", async () => {
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam(baseOptions());
    const req = baseRequest();
    const good = baseResponse(req);

    await assert.rejects(
      () => seam.proveInjectionSeamNoCall(req, { ...good, bonus: "x" } as unknown as ModelProviderResponse),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall(req, { ...good, provider: "other-provider" }),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall(req, { ...good, model: "other-model" }),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () => seam.proveInjectionSeamNoCall(req, { ...good, idempotencyKey: "wrong" }),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () =>
        seam.proveInjectionSeamNoCall(req, {
          ...good,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 999 },
        }),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () =>
        seam.proveInjectionSeamNoCall(req, {
          ...good,
          output: { excerpts: [], claims: [{ smuggled: true } as never], account_objects: [] },
        }),
      /injection seam response rejected/,
    );
  });

  test("Proxy-backed request whose get trap returns hostile values does not fire during accepted proof", async () => {
    const transport = neverCalledTransport();
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam({
      ...baseOptions(),
      transport,
    });

    // Build a hostile Proxy whose target is a valid request. Its `get`
    // trap returns unsafe multi-line / wrong-shape values for every
    // top-level field. If the seam re-reads via [[Get]] anywhere after
    // descriptor-snapshot validation, this trap will fire (caught by the
    // counter) and likely also cause validation rejection.
    const req = baseRequest();
    let reqGetCount = 0;
    const hostileRequest = new Proxy(req, {
      get(target, property, receiver) {
        reqGetCount += 1;
        // Return a clearly hostile value for every string key.
        if (typeof property === "string") return "safe\n- raw_prompt: SECRET";
        return Reflect.get(target, property, receiver);
      },
    });

    // Hostile Proxy for the response too. The target is a valid response;
    // the get trap returns hostile values that would trip the validator
    // immediately if any [[Get]] fires.
    const resp = baseResponse(req);
    let respGetCount = 0;
    const hostileResponse = new Proxy(resp, {
      get(target, property, receiver) {
        respGetCount += 1;
        if (typeof property === "string") return "safe\n- raw_response: SECRET";
        return Reflect.get(target, property, receiver);
      },
    });

    const proof = await seam.proveInjectionSeamNoCall(
      hostileRequest as unknown as ModelProviderRequest,
      hostileResponse as unknown as ModelProviderResponse,
    );

    // The injection seam must read every field via descriptor snapshots
    // only, so neither hostile `get` trap may fire during accepted proof.
    assert.equal(reqGetCount, 0, `request proxy get trap fired ${reqGetCount} times during accepted proof`);
    assert.equal(respGetCount, 0, `response proxy get trap fired ${respGetCount} times during accepted proof`);
    // The injected transport must not have been invoked either.
    assert.equal(transport.calls, 0);
    // Proof reflects the seam's own snapshot of providerRef/modelLabel
    // (not anything injected by the hostile get trap), and continues to
    // assert no provider call / no transport invocation.
    assert.equal(proof.provider_ref, PROVIDER_REF);
    assert.equal(proof.model_label, MODEL_LABEL);
    assert.equal(proof.transport_invoked, false);
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
    assert.equal(proof.transport_injection_seam_proven, true);
  });

  test("Proxy-backed nested objects (metadata, output, usage, cost) do not fire get traps during accepted proof", async () => {
    const transport = neverCalledTransport();
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam({
      ...baseOptions(),
      transport,
    });

    const req = baseRequest();
    const resp = baseResponse(req);

    let metaCount = 0;
    const hostileMeta = new Proxy(req.metadata, {
      get(target, prop, receiver) {
        metaCount += 1;
        if (typeof prop === "string") return "true";
        return Reflect.get(target, prop, receiver);
      },
    });
    const reqWithHostileMeta = { ...req, metadata: hostileMeta as unknown as ModelProviderRequest["metadata"] };

    let outputCount = 0;
    const hostileOutput = new Proxy(resp.output, {
      get(target, prop, receiver) {
        outputCount += 1;
        return Reflect.get(target, prop, receiver);
      },
    });
    let usageCount = 0;
    const hostileUsage = new Proxy(resp.usage, {
      get(target, prop, receiver) {
        usageCount += 1;
        return Reflect.get(target, prop, receiver);
      },
    });
    let costCount = 0;
    const hostileCost = new Proxy(resp.cost, {
      get(target, prop, receiver) {
        costCount += 1;
        if (prop === "amount") return 999;
        return Reflect.get(target, prop, receiver);
      },
    });
    const respWithHostileNested = {
      ...resp,
      output: hostileOutput as unknown as ModelProviderResponse["output"],
      usage: hostileUsage as unknown as ModelProviderResponse["usage"],
      cost: hostileCost as unknown as ModelProviderResponse["cost"],
    };

    const proof = await seam.proveInjectionSeamNoCall(reqWithHostileMeta, respWithHostileNested);

    // None of the nested hostile get traps may fire during accepted proof.
    assert.equal(metaCount, 0, `metadata proxy get trap fired ${metaCount} times`);
    assert.equal(outputCount, 0, `output proxy get trap fired ${outputCount} times`);
    assert.equal(usageCount, 0, `usage proxy get trap fired ${usageCount} times`);
    assert.equal(costCount, 0, `cost proxy get trap fired ${costCount} times`);
    assert.equal(transport.calls, 0);
    assert.equal(proof.transport_invoked, false);
  });

  test("rejects response cost over cap", async () => {
    const seam = bindRuntimeModelOnlyLiveTransportInjectionSeam({ ...baseOptions(), maxCostUsd: 0.5 });
    const req = baseRequest();
    await assert.rejects(
      () =>
        seam.proveInjectionSeamNoCall(req, {
          ...baseResponse(req),
          cost: { currency: "USD", amount: 0.51 },
        }),
      /injection seam response rejected/,
    );
    await assert.rejects(
      () =>
        seam.proveInjectionSeamNoCall(req, {
          ...baseResponse(req),
          cost: { currency: "EUR" as never, amount: 0.1 },
        }),
      /injection seam response rejected/,
    );
  });
});
