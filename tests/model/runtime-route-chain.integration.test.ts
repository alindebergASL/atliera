import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FakeModelAdapter } from "../../src/agent/model-adapter.js";
import { InMemoryArtifactStore } from "../../src/artifacts/store.js";
import { createModelActivationApproval } from "../../src/model/activation-gates.js";
import { preflightRuntimeModelExecution } from "../../src/model/runtime-model-execution-preflight.js";
import { createRuntimeModelExecutionReport } from "../../src/model/runtime-model-observability.js";
import {
  selectRouteFromCatalog,
  validateRouteCatalog,
  type ValidatedModelRouteInput,
} from "../../src/model/validated-route-catalog.js";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.js";
import { InMemoryGraphStore } from "../../src/graph/store.js";
import { InMemoryJobQueue } from "../../src/jobs/queue.js";
import { createAtlieraRuntime } from "../../src/runtime/composition.js";

const route = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
  routeRef: "gpt-5.5-openai-codex-20260602a",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  routeKind: "candidate",
  validationRefs: ["docs/runbooks/live-product-preview-gpt55-comparison-status.md"],
  validatedAt: "2026-06-02T00:00:00.000Z",
  evidenceExpiresAt: "2026-07-02T00:00:00.000Z",
  defaultModelSelectionClaim: false,
  providerLockIn: false,
  productionReadinessClaim: false,
  ...overrides,
});

describe("runtime route chain no-call integration", () => {
  test("composes catalog, selection, runtime binding, preflight, and observability without provider access", () => {
    let providerCalls = 0;
    const catalog = validateRouteCatalog([
      route(),
      route({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
        validatedAt: "2026-06-01T00:00:00.000Z",
      }),
    ], { now: "2026-06-03T00:00:00.000Z", maxValidationAgeDays: 30 });

    const selectedRoute = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-20260602a",
      environment: "staging",
      approvalRef: "approvals/runtime-route-chain-pr160",
      now: "2026-06-03T00:00:00.000Z",
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
          throw new Error("provider must not be called");
        },
      },
      selectedModelRoute: selectedRoute,
    });

    assert.equal(runtime.selectedModelRoute?.routeRef, "gpt-5.5-openai-codex-20260602a");

    const approval = createModelActivationApproval({
      approvalId: "approval-pr160",
      approvedBy: "operator",
      approvedAt: "2026-06-02T00:00:00.000Z",
      provider: "openai-codex",
      model: "gpt-5.5",
      maxCostUsd: 1,
      corpusRef: "external-corpus/runtime-route-chain.json",
      cleanupCommitment: "no provider call in PR160",
      approvalRef: "approvals/runtime-route-chain-pr160",
      budgetLedgerRef: "ledgers/runtime-route-chain-pr160",
      runEvidenceRef: "evidence/runtime-route-chain-pr160",
      cleanupOutcomeRef: "cleanup/runtime-route-chain-pr160",
    });

    const preflight = preflightRuntimeModelExecution({
      selectedRoute,
      mode: "model",
      corpusRef: "external-corpus/runtime-route-chain.json",
      approval,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0.01,
      credentialReady: true,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: { prompt_contract_ref: "prompt-contracts/runtime-route-chain-pr160" },
    });

    const report = createRuntimeModelExecutionReport({
      selectedRoute,
      preflight,
      ledgerRef: "ledgers/runtime-route-chain-pr160",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-pass-no-call",
      observedAt: "2026-06-03T00:00:00.000Z",
    });

    assert.equal(providerCalls, 0);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.runtime_model_mode_integration, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
  });
});
