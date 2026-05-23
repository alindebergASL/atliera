import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  createModelActivationApproval,
  createModelCostLedgerEntry,
} from "../../src/model/activation-gates.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import { defineModelProviderActivationPreflightCheck } from "../../src/runtime/model-provider-preflight.ts";
import { runResourcePreflight } from "../../src/runtime/resource-preflight.ts";

const approval = createModelActivationApproval({
  approvalId: "approval_123",
  approvedBy: "operator_1",
  approvedAt: "2026-05-23T22:30:00.000Z",
  provider: "anthropic",
  model: "claude_sonnet_4",
  maxCostUsd: 1,
  corpusRef: "external-corpus/tiny-validation-v1",
  cleanupCommitment: "delete provider artifacts after validation report is archived",
  approvalRef: "approvals/approval-123.json",
  budgetLedgerRef: "ledgers/approval-123.jsonl",
  runEvidenceRef: "runs/provider-validation-123/",
  cleanupOutcomeRef: "cleanup/provider-validation-123.json",
});

function activationInput(overrides = {}) {
  return {
    mode: "model" as const,
    provider: "anthropic",
    model: "claude_sonnet_4",
    corpusRef: "external-corpus/tiny-validation-v1",
    approval,
    costLedgerEntries: [
      createModelCostLedgerEntry({
        ledgerEntryId: "ledger_1",
        approvalId: "approval_123",
        runId: "run_1",
        provider: "anthropic",
        model: "claude_sonnet_4",
        accountRef: "account_1",
        stage: "graph_propose",
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: 0.05,
        observedCostUsd: 0.05,
        status: "succeeded",
        retryCount: 0,
        error: null,
        recordedAt: "2026-05-23T22:31:00.000Z",
      }),
    ],
    nextEstimatedCostUsd: 0.1,
    now: "2026-05-23T22:32:00.000Z",
    ...overrides,
  };
}

describe("model provider activation resource preflight", () => {
  it("defines a model_provider check that validates activation and credential readiness without calling a provider", async () => {
    let credentialChecks = 0;
    const check = defineModelProviderActivationPreflightCheck({
      activation: activationInput(),
      credential: {
        name: "ANTHROPIC_API_KEY",
        check: () => {
          credentialChecks += 1;
          return { status: "present" };
        },
      },
    });

    assert.equal(check.target, "model_provider");
    assert.equal(check.name, "model provider activation probe");

    const result = await check.run();

    assert.deepEqual(result, {
      status: "pass",
      code: "model_provider_ready",
      message: "model provider activation probe passed",
      metadata: {
        adapter: "model_provider",
        probe: "activation",
        provider: "anthropic",
        model: "claude_sonnet_4",
        approved_budget_usd: 1,
        observed_spend_usd: 0.05,
        next_estimated_cost_usd: 0.1,
      },
    });
    assert.equal(credentialChecks, 1);
  });

  it("integrates with production-like resource preflight without constructing providers or reading credentials itself", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      { target: "database", name: "database ping", run: () => ({ status: "pass", code: "reachable", message: "ok" }) },
      { target: "artifact_store", name: "artifact store read", run: () => ({ status: "pass", code: "artifact_store_reachable", message: "ok" }) },
      { target: "queue_backend", name: "queue enqueue", run: () => ({ status: "pass", code: "queue_reachable", message: "ok" }) },
      defineModelProviderActivationPreflightCheck({
        activation: activationInput(),
        credential: { name: "ANTHROPIC_API_KEY", check: () => ({ status: "present" }) },
      }),
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
    assert.deepEqual(
      report.checks.map((check) => [check.target, check.code, check.status]),
      [
        ["database", "reachable", "pass"],
        ["artifact_store", "artifact_store_reachable", "pass"],
        ["queue_backend", "queue_reachable", "pass"],
        ["model_provider", "model_provider_ready", "pass"],
      ],
    );
  });

  it("fails closed before credential checks when activation gates refuse", async () => {
    let credentialChecks = 0;
    const check = defineModelProviderActivationPreflightCheck({
      activation: activationInput({
        mode: "test",
        approval: null,
        nextEstimatedCostUsd: 999,
      }),
      credential: {
        name: "ANTHROPIC_API_KEY",
        check: () => {
          credentialChecks += 1;
          return { status: "present" };
        },
      },
    });

    const result = await check.run();

    assert.equal(result.status, "fail");
    assert.equal(result.code, "model_activation_refused");
    assert.equal(result.message, "model provider activation gates refused");
    assert.deepEqual(result.metadata, {
      adapter: "model_provider",
      probe: "activation",
      provider: "anthropic",
      model: "claude_sonnet_4",
      missing_gate_count: 3,
      refusal_reason_count: 1,
      observed_spend_usd: 0.05,
      next_estimated_cost_usd: 999,
    });
    assert.equal(credentialChecks, 0);
    assert.doesNotMatch(JSON.stringify(result), /approval_123|external-corpus|ANTHROPIC_API_KEY|secret|token/i);
  });

  it("fails closed with sanitized credential status without exposing secret names or values", async () => {
    for (const status of ["missing", "invalid"] as const) {
      const check = defineModelProviderActivationPreflightCheck({
        activation: activationInput(),
        credential: {
          name: "ANTHROPIC_API_KEY",
          check: () => ({ status }),
        },
      });

      const result = await check.run();

      assert.equal(result.status, "fail");
      assert.equal(result.code, status === "missing" ? "model_credential_missing" : "model_credential_invalid");
      assert.equal(result.message, "model provider credential check failed");
      assert.deepEqual(result.metadata, {
        adapter: "model_provider",
        probe: "activation",
        provider: "anthropic",
        model: "claude_sonnet_4",
      });
      assert.doesNotMatch(JSON.stringify(result), /ANTHROPIC_API_KEY|sk-|secret|token|credential_value/i);
    }
  });

  it("returns sanitized failures when the credential check throws", async () => {
    const check = defineModelProviderActivationPreflightCheck({
      activation: activationInput(),
      credential: {
        name: "ANTHROPIC_API_KEY",
        check: () => {
          throw new Error("ANTHROPIC_API_KEY=sk-private-value failed");
        },
      },
    });

    const result = await check.run();

    assert.deepEqual(result, {
      status: "fail",
      code: "model_credential_check_failed",
      message: "model provider credential check failed",
      metadata: {
        adapter: "model_provider",
        probe: "activation",
        provider: "anthropic",
        model: "claude_sonnet_4",
      },
    });
    assert.doesNotMatch(JSON.stringify(result), /ANTHROPIC_API_KEY|sk-private-value|secret|token/i);
  });

  it("fails closed through resource preflight when a credential checker returns malformed status", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      { target: "database", name: "database ping", run: () => ({ status: "pass", code: "reachable", message: "ok" }) },
      { target: "artifact_store", name: "artifact store read", run: () => ({ status: "pass", code: "artifact_store_reachable", message: "ok" }) },
      { target: "queue_backend", name: "queue enqueue", run: () => ({ status: "pass", code: "queue_reachable", message: "ok" }) },
      defineModelProviderActivationPreflightCheck({
        activation: activationInput(),
        credential: {
          name: "ANTHROPIC_API_KEY",
          check: () => ({ status: "present_but_debug_secret_sk_123" as "present" }),
        },
      }),
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(report.failures, [
      {
        target: "model_provider",
        code: "resource_check_threw",
        message: "model_provider resource check threw",
      },
    ]);
    assert.doesNotMatch(JSON.stringify(report), /ANTHROPIC_API_KEY|sk_123|secret|token/i);
  });

  it("rejects unsafe credential check names before any probe can run", async () => {
    assert.throws(
      () =>
        defineModelProviderActivationPreflightCheck({
          activation: activationInput(),
          credential: { name: "https://metadata.example.invalid/token", check: () => ({ status: "present" }) },
        }),
      /credential name/,
    );
  });

  it("does not read process.env while defining or running the model provider preflight", async () => {
    const original = Object.getOwnPropertyDescriptor(process, "env");
    let envReads = 0;
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        envReads += 1;
        throw new Error("process.env should not be read by model provider preflight");
      },
    });

    try {
      const check = defineModelProviderActivationPreflightCheck({
        activation: activationInput(),
        credential: { name: "ANTHROPIC_API_KEY", check: () => ({ status: "present" }) },
      });
      const result = await check.run();
      assert.equal(result.status, "pass");
    } finally {
      if (original) Object.defineProperty(process, "env", original);
    }

    assert.equal(envReads, 0);
  });
});
