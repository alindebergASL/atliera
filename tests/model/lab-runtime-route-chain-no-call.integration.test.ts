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

// Sanitized public facts mirroring the consumed single lab runtime proof
// (docs/runbooks/runtime-model-only-lab-runtime-live-proof-status.md) re-checked
// here as a fresh no-call route chain. The historical proof executed exactly one
// approved provider call; that approval is fully consumed and this chain executes
// zero further provider calls, retries, comparisons, or runtime-model-mode runs.
const NOW = "2026-06-06T00:00:00.000Z";
const APPROVAL_REF = "approvals/runtime-model-only-lab-runtime-route-chain-no-call-20260606a";
const CORPUS_REF = "external-corpus/lab-runtime-model-proof.json";

const labRuntimeProofRoute = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
  routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  routeKind: "candidate",
  validationRefs: [
    "docs/runbooks/runtime-model-only-lab-runtime-live-proof-status.md",
    "docs/runbooks/runtime-model-only-lab-runtime-live-proof-interpretation.md",
    "docs/runbooks/runtime-model-only-lab-runtime-live-proof-approval-packet.md",
  ],
  validatedAt: "2026-06-05T00:00:00.000Z",
  evidenceExpiresAt: "2026-07-05T00:00:00.000Z",
  defaultModelSelectionClaim: false,
  providerLockIn: false,
  productionReadinessClaim: false,
  ...overrides,
});

describe("lab runtime proof route chain remains no-call", () => {
  test("selects the lab-runtime-proof route explicitly and carries it through runtime, preflight, and observability with zero provider calls", () => {
    let providerCalls = 0;
    const catalog = validateRouteCatalog([
      labRuntimeProofRoute(),
      labRuntimeProofRoute({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
        validatedAt: "2026-06-01T00:00:00.000Z",
        evidenceExpiresAt: "2026-07-01T00:00:00.000Z",
      }),
    ], { now: NOW, maxValidationAgeDays: 30 });

    const selectedRoute = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
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
        name: "throwing-provider",
        async generate() {
          providerCalls += 1;
          throw new Error("provider must not be called by lab runtime proof no-call route chain");
        },
      },
      selectedModelRoute: selectedRoute,
    });

    assert.equal(runtime.selectedModelRoute?.routeRef, "gpt-5.5-openai-codex-repeatability-20260604h");
    assert.equal(runtime.selectedModelRoute?.providerRef, "openai-codex");
    assert.equal(runtime.selectedModelRoute?.modelLabel, "gpt-5.5");
    assert.equal(runtime.selectedModelRoute?.runtimeModelModeIntegration, false);
    assert.equal(runtime.selectedModelRoute?.defaultModelSelectionClaim, false);
    assert.equal(runtime.selectedModelRoute?.providerLockIn, false);
    assert.equal(
      selectedRoute.route.validationRefs.includes(
        "docs/runbooks/runtime-model-only-lab-runtime-live-proof-interpretation.md",
      ),
      true,
    );

    const approval = createModelActivationApproval({
      approvalId: "runtime-model-only-lab-runtime-route-chain-no-call-20260606a",
      approvedBy: "operator",
      approvedAt: NOW,
      provider: "openai-codex",
      model: "gpt-5.5",
      maxCostUsd: 0.01,
      corpusRef: CORPUS_REF,
      cleanupCommitment: "lab runtime proof route chain remains no-call",
      approvalRef: APPROVAL_REF,
      budgetLedgerRef: "ledgers/runtime-model-only-lab-runtime-route-chain-no-call",
      runEvidenceRef: "evidence/runtime-model-only-lab-runtime-route-chain-no-call",
      cleanupOutcomeRef: "cleanup/runtime-model-only-lab-runtime-route-chain-no-call",
    });

    const preflight = preflightRuntimeModelExecution({
      selectedRoute,
      mode: "model",
      corpusRef: CORPUS_REF,
      approval,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0,
      credentialReady: true,
      now: NOW,
      requestMetadata: { prompt_contract_ref: "prompt-contracts/runtime-model-only-lab-runtime-route-chain-no-call" },
    });

    const report = createRuntimeModelExecutionReport({
      selectedRoute,
      preflight,
      ledgerRef: "ledgers/runtime-model-only-lab-runtime-route-chain-no-call",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-pass-no-call",
      observedAt: NOW,
    });

    // The injected throwing provider is never called anywhere in the chain.
    assert.equal(providerCalls, 0);
    assert.equal(catalog.providerCallsExecuted, 0);
    assert.equal(catalog.providerSpend, false);
    assert.equal(selectedRoute.providerCallsExecuted, 0);
    assert.equal(preflight.providerCallsExecuted, 0);
    assert.equal(preflight.ok, true);
    assert.equal(preflight.authorizesProviderCall, false);
    assert.equal(report.route.route_ref, "gpt-5.5-openai-codex-repeatability-20260604h");
    assert.equal(report.route.provider_ref, "openai-codex");
    assert.equal(report.route.model_label, "gpt-5.5");
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.runtime_model_mode_integration, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
  });

  test("refuses default/model-label/unknown shortcuts for the lab-runtime-proof route", () => {
    const catalog = validateRouteCatalog([labRuntimeProofRoute()], { now: NOW, maxValidationAgeDays: 30 });

    assert.throws(() => selectRouteFromCatalog(catalog, {
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: APPROVAL_REF,
      now: NOW,
      maxValidationAgeDays: 30,
    }), /routeRef is required/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: APPROVAL_REF,
      now: NOW,
      maxValidationAgeDays: 30,
    }), /modelLabel is not allowed/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "unknown-route-ref",
      environment: "staging",
      approvalRef: APPROVAL_REF,
      now: NOW,
      maxValidationAgeDays: 30,
    }), /routeRef not found/i);

    assert.throws(() => validateRouteCatalog([
      { ...labRuntimeProofRoute(), providerLockIn: true as false },
    ], { now: NOW, maxValidationAgeDays: 30 }), /providerLockIn must be false/i);
  });
});
