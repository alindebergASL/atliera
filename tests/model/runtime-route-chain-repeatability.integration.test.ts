import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FakeModelAdapter } from "../../src/agent/model-adapter.js";
import { InMemoryArtifactStore } from "../../src/artifacts/store.js";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.js";
import { InMemoryGraphStore } from "../../src/graph/store.js";
import { InMemoryJobQueue } from "../../src/jobs/queue.js";
import { createModelActivationApproval } from "../../src/model/activation-gates.js";
import { preflightRuntimeModelExecution } from "../../src/model/runtime-model-execution-preflight.js";
import { createRuntimeModelExecutionReport } from "../../src/model/runtime-model-observability.js";
import {
  selectRouteFromCatalog,
  validateRouteCatalog,
  type ValidatedModelRouteInput,
} from "../../src/model/validated-route-catalog.js";
import { createAtlieraRuntime } from "../../src/runtime/composition.js";

const repeatabilityRoute = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
  routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  routeKind: "candidate",
  validationRefs: [
    "docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status.md",
    "docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md",
    "docs/runbooks/runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md",
  ],
  validatedAt: "2026-06-04T00:00:00.000Z",
  evidenceExpiresAt: "2026-07-04T00:00:00.000Z",
  defaultModelSelectionClaim: false,
  providerLockIn: false,
  productionReadinessClaim: false,
  ...overrides,
});

describe("GPT-5.5 repeatability route chain no-call integration", () => {
  test("selects the repeatability-backed route explicitly and composes runtime/preflight/observability with zero provider calls", () => {
    let providerCalls = 0;
    const catalog = validateRouteCatalog([
      repeatabilityRoute(),
      repeatabilityRoute({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
        validatedAt: "2026-06-01T00:00:00.000Z",
        evidenceExpiresAt: "2026-07-01T00:00:00.000Z",
      }),
    ], { now: "2026-06-04T00:00:00.000Z", maxValidationAgeDays: 30 });

    const selectedRoute = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i",
      now: "2026-06-04T00:00:00.000Z",
      maxValidationAgeDays: 30,
    });

    const runtime = createAtlieraRuntime({
      config: parseAtlieraRuntimeConfig({ ATL_ENV: "staging", MODEL_PROVIDER: "external" }),
      graphStore: new InMemoryGraphStore(),
      artifactStore: new InMemoryArtifactStore(),
      jobQueue: new InMemoryJobQueue(),
      modelAdapter: new FakeModelAdapter(),
      modelProvider: {
        name: "throwing-provider",
        async generate() {
          providerCalls += 1;
          throw new Error("provider must not be called by no-call route chain");
        },
      },
      selectedModelRoute: selectedRoute,
    });

    assert.equal(runtime.selectedModelRoute?.routeRef, "gpt-5.5-openai-codex-repeatability-20260604h");

    const approval = createModelActivationApproval({
      approvalId: "runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i",
      approvedBy: "operator",
      approvedAt: "2026-06-04T00:00:00.000Z",
      provider: "openai-codex",
      model: "gpt-5.5",
      maxCostUsd: 0.01,
      corpusRef: "external-corpus/runtime-route-repeatability-no-call.json",
      cleanupCommitment: "no provider call in no-call route chain",
      approvalRef: "approvals/runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i",
      budgetLedgerRef: "ledgers/runtime-route-repeatability-no-call",
      runEvidenceRef: "evidence/runtime-route-repeatability-no-call",
      cleanupOutcomeRef: "cleanup/runtime-route-repeatability-no-call",
    });

    const preflight = preflightRuntimeModelExecution({
      selectedRoute,
      mode: "model",
      corpusRef: "external-corpus/runtime-route-repeatability-no-call.json",
      approval,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0,
      credentialReady: true,
      now: "2026-06-04T00:00:00.000Z",
      requestMetadata: { prompt_contract_ref: "prompt-contracts/runtime-route-repeatability-no-call" },
    });

    const report = createRuntimeModelExecutionReport({
      selectedRoute,
      preflight,
      ledgerRef: "ledgers/runtime-route-repeatability-no-call",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-pass-no-call",
      observedAt: "2026-06-04T00:00:00.000Z",
    });

    assert.equal(providerCalls, 0);
    assert.equal(catalog.providerCallsExecuted, 0);
    assert.equal(selectedRoute.providerCallsExecuted, 0);
    assert.equal(preflight.providerCallsExecuted, 0);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.runtime_model_mode_integration, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
  });

  test("keeps repeatability route selection explicit and refuses default/model-label shortcuts", () => {
    const catalog = validateRouteCatalog([repeatabilityRoute()], { now: "2026-06-04T00:00:00.000Z", maxValidationAgeDays: 30 });

    assert.throws(() => selectRouteFromCatalog(catalog, {
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i",
      now: "2026-06-04T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /routeRef is required/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i",
      now: "2026-06-04T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /modelLabel is not allowed/i);
  });
});
