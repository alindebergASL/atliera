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
  type SelectedModelRoute,
  type ValidatedModelRouteInput,
} from "../../src/model/validated-route-catalog.js";
import { createAtlieraRuntime } from "../../src/runtime/composition.js";

const NOW = "2026-06-05T00:00:00.000Z";
const APPROVAL_REF = "approvals/runtime-model-only-multi-route-no-call-20260605b";
const CORPUS_REF = "external-corpus/runtime-multi-route-no-call.json";

type RouteCase = {
  readonly route: ValidatedModelRouteInput;
  readonly approvalId: string;
  readonly expectedValidationRef: string;
};

const routeCases: readonly RouteCase[] = Object.freeze([
  {
    route: {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
      routeKind: "candidate",
      validationRefs: [
        "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
        "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
        "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
      ],
      validatedAt: NOW,
      evidenceExpiresAt: "2026-07-05T00:00:00.000Z",
      defaultModelSelectionClaim: false,
      providerLockIn: false,
      productionReadinessClaim: false,
    },
    approvalId: "multi-route-no-call-gpt55-20260605b",
    expectedValidationRef: "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
  },
  {
    route: {
      routeRef: "owl-alpha-openrouter-validation-20260601a",
      providerRef: "openrouter",
      modelLabel: "owl-alpha",
      routeKind: "validation",
      validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
      validatedAt: "2026-06-01T00:00:00.000Z",
      evidenceExpiresAt: "2026-07-01T00:00:00.000Z",
      defaultModelSelectionClaim: false,
      providerLockIn: false,
      productionReadinessClaim: false,
    },
    approvalId: "multi-route-no-call-owl-alpha-20260605b",
    expectedValidationRef: "docs/runbooks/live-product-preview-six-slot-status.md",
  },
]);

function approvalFor(selectedRoute: SelectedModelRoute, approvalId: string) {
  return createModelActivationApproval({
    approvalId,
    approvedBy: "operator",
    approvedAt: NOW,
    provider: selectedRoute.route.providerRef,
    model: selectedRoute.route.modelLabel,
    maxCostUsd: 0.01,
    corpusRef: CORPUS_REF,
    cleanupCommitment: "multi-route runtime selection proof remains no-call",
    approvalRef: APPROVAL_REF,
    budgetLedgerRef: "ledgers/runtime-multi-route-no-call",
    runEvidenceRef: "evidence/runtime-multi-route-no-call",
    cleanupOutcomeRef: "cleanup/runtime-multi-route-no-call",
  });
}

describe("multi-route provider-neutral runtime chain remains no-call", () => {
  test("selects each route explicitly and carries only the selected route through runtime, preflight, and observability", () => {
    const catalog = validateRouteCatalog(routeCases.map((entry) => entry.route), { now: NOW, maxValidationAgeDays: 30 });
    const providerCallCounts = new Map(routeCases.map((entry) => [entry.route.providerRef, 0]));
    const reports = routeCases.map((entry) => {
      const selectedRoute = selectRouteFromCatalog(catalog, {
        routeRef: entry.route.routeRef,
        environment: "staging",
        approvalRef: APPROVAL_REF,
        now: NOW,
        maxValidationAgeDays: 30,
      });

      const runtime = createAtlieraRuntime({
        config: parseAtlieraRuntimeConfig({ ATL_ENV: "staging", MODEL_PROVIDER: "external" }),
        graphStore: new InMemoryGraphStore(),
        artifactStore: new InMemoryArtifactStore(),
        jobQueue: new InMemoryJobQueue(),
        modelAdapter: new FakeModelAdapter(),
        modelProvider: {
          name: `${entry.route.providerRef}-throwing-boundary`,
          async generate() {
            providerCallCounts.set(entry.route.providerRef, (providerCallCounts.get(entry.route.providerRef) ?? 0) + 1);
            throw new Error(`provider must not be called for ${entry.route.routeRef}`);
          },
        },
        selectedModelRoute: selectedRoute,
      });

      const preflight = preflightRuntimeModelExecution({
        selectedRoute,
        mode: "model",
        corpusRef: CORPUS_REF,
        approval: approvalFor(selectedRoute, entry.approvalId),
        costLedgerEntries: [],
        nextEstimatedCostUsd: 0,
        credentialReady: true,
        now: NOW,
        requestMetadata: { prompt_contract_ref: "prompt-contracts/runtime-multi-route-no-call" },
      });

      const report = createRuntimeModelExecutionReport({
        selectedRoute,
        preflight,
        ledgerRef: "ledgers/runtime-multi-route-no-call",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-pass-no-call",
        observedAt: NOW,
      });

      assert.equal(runtime.selectedModelRoute?.routeRef, entry.route.routeRef);
      assert.equal(runtime.selectedModelRoute?.providerRef, entry.route.providerRef);
      assert.equal(runtime.selectedModelRoute?.modelLabel, entry.route.modelLabel);
      assert.equal(runtime.selectedModelRoute?.runtimeModelModeIntegration, false);
      assert.equal(runtime.selectedModelRoute?.defaultModelSelectionClaim, false);
      assert.equal(runtime.selectedModelRoute?.providerLockIn, false);
      assert.equal(selectedRoute.route.validationRefs.includes(entry.expectedValidationRef), true);
      assert.equal(preflight.ok, true);
      assert.equal(preflight.authorizesProviderCall, false);
      assert.equal(report.route.route_ref, entry.route.routeRef);
      assert.equal(report.route.provider_ref, entry.route.providerRef);
      assert.equal(report.route.model_label, entry.route.modelLabel);
      assert.equal(report.authorizes_provider_call, false);
      assert.equal(report.provider_calls_executed, 0);
      assert.equal(report.provider_spend, false);
      assert.equal(report.default_model_selection_claim, false);
      assert.equal(report.provider_lock_in, false);
      return report;
    });

    assert.deepEqual([...providerCallCounts.values()], [0, 0]);
    assert.deepEqual(reports.map((report) => report.route.route_ref), [
      "gpt-5.5-openai-codex-repeatability-20260604h",
      "owl-alpha-openrouter-validation-20260601a",
    ]);
    assert.deepEqual(reports.map((report) => report.route.provider_ref), ["openai-codex", "openrouter"]);
    assert.equal(catalog.providerCallsExecuted, 0);
    assert.equal(catalog.providerSpend, false);
    assert.equal(catalog.defaultModelSelectionClaim, false);
    assert.equal(catalog.providerLockIn, false);
  });

  test("refuses ambiguous and provider-locking multi-route catalog shortcuts", () => {
    const catalog = validateRouteCatalog(routeCases.map((entry) => entry.route), { now: NOW, maxValidationAgeDays: 30 });

    assert.throws(() => selectRouteFromCatalog(catalog, {
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: APPROVAL_REF,
      now: NOW,
      maxValidationAgeDays: 30,
    }), /routeRef is required/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "unknown-route-ref",
      environment: "staging",
      approvalRef: APPROVAL_REF,
      now: NOW,
      maxValidationAgeDays: 30,
    }), /routeRef not found/i);

    const candidateRoute = routeCases[0]?.route;
    const validationRoute = routeCases[1]?.route;
    assert.ok(candidateRoute);
    assert.ok(validationRoute);

    assert.throws(() => validateRouteCatalog([
      candidateRoute,
      { ...validationRoute, routeRef: candidateRoute.routeRef },
    ], { now: NOW, maxValidationAgeDays: 30 }), /duplicate routeRef/i);

    assert.throws(() => validateRouteCatalog([
      candidateRoute,
      { ...validationRoute, providerLockIn: true as false },
    ], { now: NOW, maxValidationAgeDays: 30 }), /providerLockIn must be false/i);
  });
});
