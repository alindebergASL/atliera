import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  FakeModelProvider,
  MODEL_PROVIDER_SAFETY_CONTRACT,
  assertSafeModelProviderRequest,
  createModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
} from "../../src/model/provider.ts";

function validRequest(overrides: Partial<ModelProviderRequest> = {}): ModelProviderRequest {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "fixture",
    model: "fake-empty-v1",
    prompt: "Summarize supported evidence only.",
    inputGraphRef: "graph/minimal-pass.json",
    idempotencyKey: "run_2026_05_23_minimal",
    maxOutputTokens: 512,
    temperature: 0,
    metadata: { purpose: "contract-test" },
    ...overrides,
  });
}

describe("ModelProvider contract", () => {
  it("requires pre-call budget estimation before every paid provider call", () => {
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.budget.requiresPreCallEstimate, true);
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.budget.estimateMustBeCheckedAgainstRemainingBudget,
      true,
    );
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.budget.requiresCumulativeLedgerAcrossRuns, true);
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.budget.refuseBeforeCallWhenEstimateWouldExceedBudget,
      true,
    );
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.budget.postCallCostIsReportingOnly, true);
  });

  it("specifies adversarial provider-response validation outcomes", () => {
    assert.deepEqual(MODEL_PROVIDER_SAFETY_CONTRACT.responseValidation, {
      invalid_json: "retry_once_then_fail_stage",
      schema_mismatch: "retry_once_then_fail_stage",
      hallucinated_source_ids: "reject_without_retry",
      excerpt_text_mismatch: "reject_without_retry",
      claim_without_evidence: "reject_without_retry",
    });
  });

  it("requires explicit activation gates before real model mode", () => {
    assert.deepEqual(MODEL_PROVIDER_SAFETY_CONTRACT.activation.requiredGates, [
      "explicit_model_mode",
      "provider",
      "model",
      "max_cost",
      "out_of_repo_corpus_path",
      "operator_approval",
    ]);
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.activation.aggregateMissingGatesBeforeRefusal,
      true,
    );
  });

  it("requires safe credential refusal before provider calls", () => {
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.credentials.refuseBeforeCallWhenMissingOrInvalid,
      true,
    );
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.credentials.errorNamesMissingCredential, true);
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.credentials.neverPrintCredentialValue, true);
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.credentials.exitsNonZeroForCliActivation, true);
  });

  it("requires static-import safety for real provider SDKs", () => {
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.imports.noStaticProviderSdkImports, true);
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.imports.dynamicImportOnlyInsideActivatedProviderPath,
      true,
    );
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.imports.fakeAndFixtureModesMustNotLoadProviderSdk,
      true,
    );
  });

  it("requires fake and real providers to share the same contract boundary", () => {
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.fakeProvider.implementsSameInterfaceAsRealProviders,
      true,
    );
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.fakeProvider.deterministicNoSpendOutput, true);
    assert.equal(MODEL_PROVIDER_SAFETY_CONTRACT.fakeProvider.rejectedByProductionLikePreflight, true);
    assert.equal(
      MODEL_PROVIDER_SAFETY_CONTRACT.fakeProvider.realProvidersUseSameModelProviderBoundary,
      true,
    );
  });

  it("defines a pure provider request shape without API keys, SDK clients, or transport endpoints", () => {
    const request = validRequest();

    assert.deepEqual(Object.keys(request).sort(), [
      "idempotencyKey",
      "inputGraphRef",
      "maxOutputTokens",
      "metadata",
      "mode",
      "model",
      "operation",
      "prompt",
      "temperature",
    ]);
    assert.equal("apiKey" in request, false);
    assert.equal("client" in request, false);
    assert.equal("baseUrl" in request, false);
    assert.equal("endpoint" in request, false);
    assert.equal("transport" in request, false);
  });

  it("strips forbidden transport and secret fields from untyped request input", () => {
    const request = createModelProviderRequest({
      operation: "graph.propose",
      mode: "fixture",
      model: "fake-empty-v1",
      prompt: "Summarize supported evidence only.",
      inputGraphRef: "graph/minimal-pass.json",
      idempotencyKey: "run_2026_05_23_minimal",
      maxOutputTokens: 512,
      temperature: 0,
      metadata: { purpose: "contract-test" },
      apiKey: "must-not-survive",
      client: { sdk: true },
      baseUrl: "https://provider.example",
      endpoint: "https://provider.example/v1",
      transport: "http",
    } as Parameters<typeof createModelProviderRequest>[0]);

    assert.equal("apiKey" in request, false);
    assert.equal("client" in request, false);
    assert.equal("baseUrl" in request, false);
    assert.equal("endpoint" in request, false);
    assert.equal("transport" in request, false);
  });

  it("validates request bounds before any provider implementation can run", () => {
    assert.doesNotThrow(() => assertSafeModelProviderRequest(validRequest()));

    assert.throws(
      () => validRequest({ operation: "chat.completions" as ModelProviderRequest["operation"] }),
      /operation must be one of/,
    );
    assert.throws(
      () => validRequest({ model: "https://provider.example/model" }),
      /model must be a safe logical model id/,
    );
    assert.throws(
      () => validRequest({ inputGraphRef: "../graph.json" }),
      /inputGraphRef must be a safe relative reference/,
    );
    assert.throws(
      () => validRequest({ idempotencyKey: "run key with spaces" }),
      /idempotencyKey must be a safe logical id/,
    );
    assert.throws(
      () => validRequest({ maxOutputTokens: 0 }),
      /maxOutputTokens must be an integer from 1 to 200000/,
    );
    assert.throws(
      () => validRequest({ temperature: -0.1 }),
      /temperature must be a number from 0 to 2/,
    );
  });

  it("keeps the fake provider deterministic and no-spend in safe modes", async () => {
    const provider: ModelProvider = new FakeModelProvider();
    const request = validRequest();

    const response = await provider.generate(request);

    assert.deepEqual(response, {
      provider: "fake",
      model: "fake-empty-v1",
      idempotencyKey: "run_2026_05_23_minimal",
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
    });
  });

  it("refuses model mode until a real provider activation gate exists", async () => {
    const provider = new FakeModelProvider();

    await assert.rejects(
      () => provider.generate(validRequest({ mode: "model" })),
      /model mode is not activated/,
    );
  });

  it("does not read process.env while building or validating requests", () => {
    const previous = process.env.MODEL_PROVIDER;
    process.env.MODEL_PROVIDER = "real-provider-should-not-leak";
    try {
      const request = validRequest({ model: "fake-empty-v1" });
      assert.equal(request.model, "fake-empty-v1");
      assert.doesNotThrow(() => assertSafeModelProviderRequest(request));
    } finally {
      if (previous === undefined) {
        delete process.env.MODEL_PROVIDER;
      } else {
        process.env.MODEL_PROVIDER = previous;
      }
    }
  });
});
