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

const remediatedRoute = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
  routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  routeKind: "candidate",
  validationRefs: [
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
  ],
  validatedAt: "2026-06-05T00:00:00.000Z",
  evidenceExpiresAt: "2026-07-05T00:00:00.000Z",
  defaultModelSelectionClaim: false,
  providerLockIn: false,
  productionReadinessClaim: false,
  ...overrides,
});

describe("remediated runtime route chain no-call integration", () => {
  test("passes remediated status through catalog, explicit selection, runtime composition, preflight, and observability with zero provider calls", () => {
    let providerCalls = 0;
    const catalog = validateRouteCatalog([
      remediatedRoute(),
      remediatedRoute({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
        validatedAt: "2026-06-01T00:00:00.000Z",
        evidenceExpiresAt: "2026-07-01T00:00:00.000Z",
      }),
    ], { now: "2026-06-05T00:00:00.000Z", maxValidationAgeDays: 30 });

    const selectedRoute = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-06-05T00:00:00.000Z",
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
          throw new Error("provider must not be called by remediated no-call route chain");
        },
      },
      selectedModelRoute: selectedRoute,
    });

    assert.equal(runtime.selectedModelRoute?.routeRef, "gpt-5.5-openai-codex-repeatability-20260604h");
    assert.equal(runtime.selectedModelRoute?.providerRef, "openai-codex");
    assert.equal(runtime.selectedModelRoute?.runtimeModelModeIntegration, false);
    assert.equal(selectedRoute.route.validationRefs.length, 3);
    assert.deepEqual(selectedRoute.route.validationRefs, [
      "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
      "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
      "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
    ]);

    const approval = createModelActivationApproval({
      approvalId: "runtime-model-only-remediated-route-chain-no-call-20260605a",
      approvedBy: "operator",
      approvedAt: "2026-06-05T00:00:00.000Z",
      provider: "openai-codex",
      model: "gpt-5.5",
      maxCostUsd: 0.01,
      corpusRef: "external-corpus/runtime-route-remediated-no-call.json",
      cleanupCommitment: "no provider call in remediated no-call route chain",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      budgetLedgerRef: "ledgers/runtime-route-remediated-no-call",
      runEvidenceRef: "evidence/runtime-route-remediated-no-call",
      cleanupOutcomeRef: "cleanup/runtime-route-remediated-no-call",
    });

    const preflight = preflightRuntimeModelExecution({
      selectedRoute,
      mode: "model",
      corpusRef: "external-corpus/runtime-route-remediated-no-call.json",
      approval,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0,
      credentialReady: true,
      now: "2026-06-05T00:00:00.000Z",
      requestMetadata: { prompt_contract_ref: "prompt-contracts/runtime-route-remediated-no-call" },
    });

    const report = createRuntimeModelExecutionReport({
      selectedRoute,
      preflight,
      ledgerRef: "ledgers/runtime-route-remediated-no-call",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-pass-no-call",
      observedAt: "2026-06-05T00:00:00.000Z",
    });

    assert.equal(providerCalls, 0);
    assert.equal(catalog.providerCallsExecuted, 0);
    assert.equal(selectedRoute.providerCallsExecuted, 0);
    assert.equal(preflight.ok, true);
    assert.equal(preflight.providerCallsExecuted, 0);
    assert.equal(preflight.providerSpend, false);
    assert.equal(preflight.authorizesProviderCall, false);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.runtime_model_mode_integration, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
    assert.equal(report.route.validation_refs.includes("docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md"), true);
  });

  test("refuses remediated route defaults, stale evidence, fake staging routes, and forbidden request metadata", () => {
    const catalog = validateRouteCatalog([remediatedRoute()], { now: "2026-06-05T00:00:00.000Z", maxValidationAgeDays: 30 });

    assert.throws(() => selectRouteFromCatalog(catalog, {
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-06-05T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /routeRef is required/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      modelLabel: "gpt-5.5",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-06-05T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /modelLabel is not allowed/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      now: "2026-06-05T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /approvalRef is required/i);

    assert.throws(() => selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-08-06T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /stale/i);

    const fakeCatalog = validateRouteCatalog([remediatedRoute({ routeKind: "fake" })], { now: "2026-06-05T00:00:00.000Z", maxValidationAgeDays: 30 });
    assert.throws(() => selectRouteFromCatalog(fakeCatalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-06-05T00:00:00.000Z",
      maxValidationAgeDays: 30,
    }), /fake routes are not allowed/i);

    const selectedRoute = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-repeatability-20260604h",
      environment: "staging",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      now: "2026-06-05T00:00:00.000Z",
      maxValidationAgeDays: 30,
    });

    const approval = createModelActivationApproval({
      approvalId: "runtime-model-only-remediated-route-chain-no-call-20260605a",
      approvedBy: "operator",
      approvedAt: "2026-06-05T00:00:00.000Z",
      provider: "openai-codex",
      model: "gpt-5.5",
      maxCostUsd: 0.01,
      corpusRef: "external-corpus/runtime-route-remediated-no-call.json",
      cleanupCommitment: "no provider call in remediated no-call route chain",
      approvalRef: "approvals/runtime-model-only-remediated-route-chain-no-call-20260605a",
      budgetLedgerRef: "ledgers/runtime-route-remediated-no-call",
      runEvidenceRef: "evidence/runtime-route-remediated-no-call",
      cleanupOutcomeRef: "cleanup/runtime-route-remediated-no-call",
    });

    const preflight = preflightRuntimeModelExecution({
      selectedRoute,
      mode: "model",
      corpusRef: "external-corpus/runtime-route-remediated-no-call.json",
      approval,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0,
      credentialReady: true,
      now: "2026-06-05T00:00:00.000Z",
      requestMetadata: { tools: "true" },
    });

    const report = createRuntimeModelExecutionReport({
      selectedRoute,
      preflight,
      ledgerRef: "ledgers/runtime-route-remediated-no-call",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-blocked",
      observedAt: "2026-06-05T00:00:00.000Z",
    });

    assert.equal(preflight.ok, false);
    assert.deepEqual(report.preflight.refusal_reasons, ["forbidden_metadata_key_rejected"]);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.authorizes_provider_call, false);
  });
});
