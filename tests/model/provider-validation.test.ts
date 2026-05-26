import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  createModelActivationApproval,
  createModelCostLedgerEntry,
} from "../../src/model/activation-gates.ts";
import {
  createModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "../../src/model/provider.ts";
import { validateModelProviderCompatibility } from "../../src/model/provider-validation.ts";

const NOW = "2026-05-23T23:00:00.000Z";

function approval() {
  return createModelActivationApproval({
    approvalId: "approval_model_validation_1",
    approvedBy: "operator_1",
    approvedAt: NOW,
    provider: "provider_a",
    model: "model_a",
    maxCostUsd: 0.05,
    corpusRef: "external-corpus/model-validation.jsonl",
    cleanupCommitment: "Delete provider-side validation artifacts after evidence capture.",
    approvalRef: "docs/approvals/model-validation.md#approval",
    budgetLedgerRef: "artifacts/model-validation/budget-ledger.jsonl",
    runEvidenceRef: "artifacts/model-validation/run-evidence.json",
    cleanupOutcomeRef: "artifacts/model-validation/cleanup.md",
  });
}

function request(overrides: Partial<ModelProviderRequest> = {}): ModelProviderRequest {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "model",
    model: "model_a",
    prompt: "Return only graph proposals supported by the supplied source context.",
    inputGraphRef: "graph/model-validation-input.json",
    idempotencyKey: "run_model_validation_1",
    maxOutputTokens: 128,
    temperature: 0,
    metadata: { purpose: "model-validation" },
    ...overrides,
  });
}

function baseOptions(provider: ModelProvider, overrides: Record<string, unknown> = {}) {
  return {
    provider,
    request: request(),
    providerName: "provider_a",
    approval: approval(),
    costLedgerEntries: [],
    corpusRef: "external-corpus/model-validation.jsonl",
    nextEstimatedCostUsd: 0.01,
    credentialStatus: "present" as const,
    runId: "run_model_validation_1",
    accountRef: "account_model_validation",
    stage: "provider_validation",
    now: NOW,
    ...overrides,
  };
}

function providerReturning(response: ModelProviderResponse): ModelProvider & { calls: ModelProviderRequest[] } {
  const calls: ModelProviderRequest[] = [];
  return {
    name: response.provider,
    calls,
    async generate(input: ModelProviderRequest): Promise<ModelProviderResponse> {
      calls.push(input);
      return response;
    },
  };
}

function providerReturningUnknown(response: unknown): ModelProvider & { calls: ModelProviderRequest[] } {
  const calls: ModelProviderRequest[] = [];
  return {
    name: "provider_a",
    calls,
    async generate(input: ModelProviderRequest): Promise<ModelProviderResponse> {
      calls.push(input);
      return response as ModelProviderResponse;
    },
  };
}

function successfulResponse(overrides: Partial<ModelProviderResponse> = {}): ModelProviderResponse {
  return {
    provider: "provider_a",
    model: "model_a",
    idempotencyKey: "run_model_validation_1",
    output: {
      excerpts: [],
      claims: [],
      account_objects: [],
    },
    usage: {
      inputTokens: 12,
      outputTokens: 4,
      totalTokens: 16,
    },
    cost: {
      currency: "USD",
      amount: 0.004,
    },
    ...overrides,
  };
}

describe("ModelProvider validation harness", () => {
  it("runs an injected provider only after activation and credential gates pass, then records sanitized evidence", async () => {
    const provider = providerReturning(successfulResponse());

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok]), [
      ["activation_gates", true],
      ["credential_status", true],
      ["provider_call", true],
      ["response_contract", true],
      ["cost_ledger_entry", true],
    ]);
    assert.deepEqual(report.call, {
      provider: "provider_a",
      model: "model_a",
      operation: "graph.propose",
      idempotency_key: "run_model_validation_1",
    });
    assert.equal(report.cost_ledger_entry?.status, "succeeded");
    assert.equal(report.cost_ledger_entry?.observed_cost_usd, 0.004);
    assert.equal(JSON.stringify(report).includes("Return only graph proposals"), false);
  });

  it("refuses before provider calls when activation gates fail", async () => {
    const provider = providerReturning(successfulResponse());

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, {
        request: request({ mode: "fixture" }),
      }),
    );

    assert.equal(report.ok, false);
    assert.equal(provider.calls.length, 0);
    assert.equal(report.checks[0]?.name, "activation_gates");
    assert.equal(report.checks[0]?.ok, false);
    assert.deepEqual(report.checks[0]?.codes, ["missing_activation_gates"]);
    assert.equal(report.cost_ledger_entry?.status, "refused");
  });

  it("refuses before provider calls when credential status is missing or invalid", async () => {
    const provider = providerReturning(successfulResponse());

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, {
        credentialStatus: "missing",
      }),
    );

    assert.equal(report.ok, false);
    assert.equal(provider.calls.length, 0);
    assert.equal(report.checks[1]?.name, "credential_status");
    assert.equal(report.checks[1]?.ok, false);
    assert.deepEqual(report.checks[1]?.codes, ["credential_missing"]);
    assert.equal(JSON.stringify(report).includes("API_KEY"), false);
  });

  it("fails closed with sanitized response-contract errors for mismatched provider output", async () => {
    const provider = providerReturning(
      successfulResponse({
        provider: "provider_b",
        usage: {
          inputTokens: 10,
          outputTokens: 10,
          totalTokens: 999,
        },
        cost: {
          currency: "USD",
          amount: 1,
        },
      }),
    );

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, false);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", true, []],
      [
        "response_contract",
        false,
        [
          "provider_mismatch",
          "usage_total_mismatch",
          "response_cost_exceeds_remaining_budget",
        ],
      ],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "failed");
    assert.equal(JSON.stringify(report).includes("provider_b"), false);
  });

  it("returns sanitized failed ledger entries for malformed usage or cost responses", async () => {
    const malformedResponses: Array<{
      response: ModelProviderResponse;
      expectedInputTokens: number;
      expectedOutputTokens: number;
      expectedObservedCostUsd: number;
    }> = [
      {
        response: successfulResponse({
          usage: {
            inputTokens: -1,
            outputTokens: 1,
            totalTokens: 0,
          },
        }),
        expectedInputTokens: 0,
        expectedOutputTokens: 1,
        expectedObservedCostUsd: 0.004,
      },
      {
        response: successfulResponse({
          cost: {
            currency: "USD",
            amount: Number.NaN,
          },
        }),
        expectedInputTokens: 12,
        expectedOutputTokens: 4,
        expectedObservedCostUsd: 0,
      },
    ];

    for (const { response, expectedInputTokens, expectedOutputTokens, expectedObservedCostUsd } of malformedResponses) {
      const report = await validateModelProviderCompatibility(baseOptions(providerReturning(response)));

      assert.equal(report.ok, false);
      assert.equal(report.cost_ledger_entry?.status, "failed");
      assert.equal(report.cost_ledger_entry?.input_tokens, expectedInputTokens);
      assert.equal(report.cost_ledger_entry?.output_tokens, expectedOutputTokens);
      assert.equal(report.cost_ledger_entry?.observed_cost_usd, expectedObservedCostUsd);
      assert.equal(report.cost_ledger_entry?.error, "response_contract_failed");
      assert.equal(
        report.checks.some(
          (check) =>
            check.name === "response_contract" &&
            !check.ok &&
            (check.codes.includes("usage_schema_mismatch") ||
              check.codes.includes("cost_schema_mismatch")),
        ),
        true,
      );
    }
  });

  it("records prompt-contract output compatibility when provider output matches the selected contract", async () => {
    const provider = providerReturningUnknown(
      successfulResponse({
        output: {
          excerpts: [{ proposed: "excerpt" }],
          claims: [],
          account_objects: [],
        } as unknown as ModelProviderResponse["output"],
      }),
    );

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, {
        promptContractOperation: "propose.excerpts",
      }),
    );

    assert.equal(report.ok, true);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", true, []],
      ["response_contract", true, []],
      ["prompt_contract_output", true, []],
      ["cost_ledger_entry", true, []],
    ]);
  });

  it("fails closed when provider output contains records outside the selected prompt contract", async () => {
    const provider = providerReturningUnknown(
      successfulResponse({
        output: {
          excerpts: [],
          claims: [],
          account_objects: [{ proposed: "account object" }],
        } as unknown as ModelProviderResponse["output"],
      }),
    );

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, {
        promptContractOperation: "propose.excerpts",
      }),
    );

    assert.equal(report.ok, false);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", true, []],
      ["response_contract", true, []],
      ["prompt_contract_output", false, ["prompt_contract_output_kind_not_allowed"]],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "failed");
    assert.equal(report.cost_ledger_entry?.error, "prompt_contract_output_failed");
  });

  it("rejects unsupported prompt-contract operations before provider calls", async () => {
    const provider = providerReturning(successfulResponse());

    for (const promptContractOperation of ["propose.unsupported", "summarize.lens"]) {
      await assert.rejects(
        () =>
          validateModelProviderCompatibility(
            baseOptions(provider, {
              promptContractOperation,
            }),
          ),
        /prompt contract operation is not supported for model provider graph proposal validation/,
      );
    }
    assert.equal(provider.calls.length, 0);
  });

  it("snapshots prompt-contract output once instead of rereading provider-controlled getters", async () => {
    let outputReads = 0;
    const response = successfulResponse() as unknown as Record<string, unknown>;
    Object.defineProperty(response, "output", {
      enumerable: true,
      get() {
        outputReads += 1;
        if (outputReads > 1) {
          return {
            excerpts: [],
            claims: [],
            account_objects: [{ proposed: "SECRET_VALUE late unsafe account object" }],
          };
        }
        return {
          excerpts: [],
          claims: [],
          account_objects: [],
        };
      },
    });
    const provider = providerReturningUnknown(response);

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, {
        promptContractOperation: "propose.excerpts",
      }),
    );

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.equal(outputReads, 1);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", true, []],
      ["response_contract", true, []],
      ["prompt_contract_output", true, []],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "succeeded");
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|late unsafe|Return only graph/i);
  });

  it("does not reread harness option metadata after validation snapshotting", async () => {
    let providerNameReads = 0;
    const provider = providerReturning(successfulResponse());
    const rawOptions = baseOptions(provider);
    const options = new Proxy(rawOptions,
      {
        get(target, property, receiver) {
          if (property === "providerName") {
            providerNameReads += 1;
            if (providerNameReads > 1) {
              throw new Error("late providerName leaked api_key=SECRET_VALUE");
            }
          }
          return Reflect.get(target, property, receiver);
        },
      },
    ) as ReturnType<typeof baseOptions>;

    const report = await validateModelProviderCompatibility(options);

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.equal(providerNameReads, 1);
    assert.equal(report.call.provider, "provider_a");
    assert.equal(report.cost_ledger_entry?.provider, "provider_a");
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|api_key|late providerName|Return only graph/i);
  });

  it("returns sanitized errors when harness option snapshot access throws before provider calls", async () => {
    const provider = providerReturning(successfulResponse());
    const rawOptions = baseOptions(provider);
    const options = new Proxy(rawOptions,
      {
        get(target, property, receiver) {
          if (property === "providerName") {
            throw new Error("providerName getter leaked api_key=SECRET_VALUE");
          }
          return Reflect.get(target, property, receiver);
        },
      },
    ) as ReturnType<typeof baseOptions>;

    await assert.rejects(
      () => validateModelProviderCompatibility(options),
      /model provider validation options must be a plain data object/,
    );
    assert.equal(provider.calls.length, 0);
  });

  it("does not reread approval ids after activation snapshotting", async () => {
    let approvalIdReads = 0;
    const provider = providerReturning(successfulResponse());
    const rawApproval = approval();
    const proxiedApproval = new Proxy(rawApproval,
      {
        get(target, property, receiver) {
          if (property === "approval_id") {
            approvalIdReads += 1;
            if (approvalIdReads > 1) {
              throw new Error("late approval id leaked api_key=SECRET_VALUE");
            }
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const report = await validateModelProviderCompatibility(
      baseOptions(provider, { approval: proxiedApproval }),
    );

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.equal(approvalIdReads, 1);
    assert.equal(report.cost_ledger_entry?.approval_id, "approval_model_validation_1");
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|api_key|late approval|Return only graph/i);
  });

  it("prevents injected providers from mutating the validation request baseline", async () => {
    const provider: ModelProvider & { calls: number } = {
      name: "provider_a",
      calls: 0,
      async generate(input: ModelProviderRequest): Promise<ModelProviderResponse> {
        this.calls += 1;
        (input as unknown as { model: string }).model = "model_b";
        return successfulResponse();
      },
    };

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, false);
    assert.equal(provider.calls, 1);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", false, ["provider_call_failed"]],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "failed");
    assert.equal(report.cost_ledger_entry?.model, "model_a");
  });

  it("does not reread the top-level approval option while snapshotting", async () => {
    let approvalOptionReads = 0;
    const provider = providerReturning(successfulResponse());
    const rawOptions = baseOptions(provider);
    const options = new Proxy(rawOptions,
      {
        get(target, property, receiver) {
          if (property === "approval") {
            approvalOptionReads += 1;
            if (approvalOptionReads > 1) {
              throw new Error("late top-level approval leaked api_key=SECRET_VALUE");
            }
          }
          return Reflect.get(target, property, receiver);
        },
      },
    ) as ReturnType<typeof baseOptions>;

    const report = await validateModelProviderCompatibility(options);

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.equal(approvalOptionReads, 1);
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|api_key|late top-level approval|Return only graph/i);
  });

  it("snapshots validated usage and cost once before creating ledger entries", async () => {
    let usageReads = 0;
    let costReads = 0;
    const response = successfulResponse() as unknown as Record<string, unknown>;
    Object.defineProperty(response, "usage", {
      enumerable: true,
      get() {
        usageReads += 1;
        if (usageReads > 1) {
          return {
            inputTokens: 9000,
            outputTokens: 9000,
            totalTokens: 18000,
            secret: "SECRET_VALUE late usage payload",
          };
        }
        return {
          inputTokens: 12,
          outputTokens: 4,
          totalTokens: 16,
        };
      },
    });
    Object.defineProperty(response, "cost", {
      enumerable: true,
      get() {
        costReads += 1;
        if (costReads > 1) {
          return {
            currency: "USD",
            amount: 0.049,
            secret: "SECRET_VALUE late cost payload",
          };
        }
        return {
          currency: "USD",
          amount: 0.004,
        };
      },
    });
    const provider = providerReturningUnknown(response);

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, true);
    assert.equal(provider.calls.length, 1);
    assert.equal(usageReads, 1);
    assert.equal(costReads, 1);
    assert.equal(report.cost_ledger_entry?.status, "succeeded");
    assert.equal(report.cost_ledger_entry?.input_tokens, 12);
    assert.equal(report.cost_ledger_entry?.output_tokens, 4);
    assert.equal(report.cost_ledger_entry?.observed_cost_usd, 0.004);
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|late usage|late cost|Return only graph/i);
  });

  it("returns sanitized failed ledger entries when providers return non-object response envelopes", async () => {
    for (const response of [null, undefined, "not-json", 7]) {
      const provider = providerReturningUnknown(response);
      const report = await validateModelProviderCompatibility(baseOptions(provider));

      assert.equal(report.ok, false);
      assert.equal(provider.calls.length, 1);
      assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
        ["activation_gates", true, []],
        ["credential_status", true, []],
        ["provider_call", true, []],
        ["response_contract", false, ["response_schema_mismatch"]],
        ["cost_ledger_entry", true, []],
      ]);
      assert.equal(report.cost_ledger_entry?.status, "failed");
      assert.equal(report.cost_ledger_entry?.input_tokens, 0);
      assert.equal(report.cost_ledger_entry?.output_tokens, 0);
      assert.equal(report.cost_ledger_entry?.observed_cost_usd, 0);
      assert.equal(report.cost_ledger_entry?.error, "response_contract_failed");
      assert.doesNotMatch(JSON.stringify(report), /Return only graph proposals|prompt|SECRET_VALUE/i);
    }
  });

  it("returns sanitized failed reports for adversarial response property access", async () => {
    const response = {} as Record<string, unknown>;
    Object.defineProperty(response, "provider", {
      enumerable: true,
      get() {
        throw new Error("SECRET_VALUE prompt leak");
      },
    });
    Object.defineProperty(response, "usage", {
      enumerable: true,
      get() {
        throw new Error("SECRET_VALUE nested usage leak");
      },
    });
    const provider = providerReturningUnknown(response);

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, false);
    assert.equal(provider.calls.length, 1);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", true, []],
      ["response_contract", false, ["response_schema_mismatch"]],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "failed");
    assert.equal(report.cost_ledger_entry?.input_tokens, 0);
    assert.equal(report.cost_ledger_entry?.output_tokens, 0);
    assert.equal(report.cost_ledger_entry?.observed_cost_usd, 0);
    assert.equal(report.cost_ledger_entry?.error, "response_contract_failed");
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|prompt leak|nested usage leak|Return only graph/i);
  });

  it("wraps provider exceptions without leaking thrown secrets or prompts", async () => {
    const provider: ModelProvider & { calls: number } = {
      name: "provider_a",
      calls: 0,
      async generate(): Promise<ModelProviderResponse> {
        this.calls += 1;
        throw new Error("provider failed with api_key=SECRET_VALUE and prompt text");
      },
    };

    const report = await validateModelProviderCompatibility(baseOptions(provider));

    assert.equal(report.ok, false);
    assert.equal(provider.calls, 1);
    assert.deepEqual(report.checks.map((check) => [check.name, check.ok, check.codes]), [
      ["activation_gates", true, []],
      ["credential_status", true, []],
      ["provider_call", false, ["provider_call_failed"]],
      ["cost_ledger_entry", true, []],
    ]);
    assert.equal(report.cost_ledger_entry?.status, "failed");
    assert.doesNotMatch(JSON.stringify(report), /SECRET_VALUE|api_key|prompt text|Return only graph/i);
  });

  it("preserves safe plain request validation errors before provider calls", async () => {
    const provider = providerReturning(successfulResponse());

    await assert.rejects(
      () =>
        validateModelProviderCompatibility(
          baseOptions(provider, {
            request: {
              ...request(),
              model: "bad/model",
            },
          }),
        ),
      /model must be a safe logical model id/,
    );
    assert.equal(provider.calls.length, 0);
  });

  it("sanitizes request snapshot getter errors before provider calls", async () => {
    const provider = providerReturning(successfulResponse());
    const rawRequest = request();
    const proxiedRequest = new Proxy(rawRequest,
      {
        get(target, property, receiver) {
          if (property === "prompt") {
            throw new Error("request prompt getter leaked api_key=SECRET_VALUE");
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );

    await assert.rejects(
      () =>
        validateModelProviderCompatibility(
          baseOptions(provider, { request: proxiedRequest }),
        ),
      /model provider validation request must be a plain data object/,
    );
    assert.equal(provider.calls.length, 0);
  });

  it("sanitizes spoofed request validation errors from adversarial field objects", async () => {
    const provider = providerReturning(successfulResponse());
    const adversarialModel = {
      trim() {
        throw new Error("model must be a safe logical model id: api_key=SECRET_VALUE");
      },
    };

    await assert.rejects(
      () =>
        validateModelProviderCompatibility(
          baseOptions(provider, {
            request: {
              ...request(),
              model: adversarialModel,
            },
          }),
        ),
      /model provider validation request must be a plain data object/,
    );
    assert.equal(provider.calls.length, 0);
  });

  it("rejects malformed harness input before provider calls", async () => {
    const provider = providerReturning(successfulResponse());

    await assert.rejects(
      () =>
        validateModelProviderCompatibility(
          baseOptions(provider, {
            providerName: "https://provider.example",
          }),
        ),
      /providerName must be a safe logical id/,
    );
    assert.equal(provider.calls.length, 0);
  });

  it("does not read process.env while validating an injected provider", async () => {
    const provider = providerReturning(successfulResponse());
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });

    try {
      const report = await validateModelProviderCompatibility(baseOptions(provider));
      assert.equal(report.ok, true);
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
