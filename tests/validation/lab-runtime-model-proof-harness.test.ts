import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createModelActivationApproval } from "../../src/model/activation-gates.js";
import { createModelProviderRequest } from "../../src/model/provider.js";
import { selectRouteFromCatalog, validateRouteCatalog } from "../../src/model/validated-route-catalog.js";
import { executeLabRuntimeModelProof } from "../../src/validation/live-provider-moderate-proof-verifier.js";

const NOW = "2026-06-05T00:00:00.000Z";
const ROUTE_REF = "gpt-5.5-openai-codex-repeatability-20260604h";

function selectedRoute(environment: "lab" | "test" = "lab") {
  const catalog = validateRouteCatalog([{
    routeRef: ROUTE_REF,
    providerRef: "openai-codex",
    modelLabel: "gpt-5.5",
    routeKind: "candidate",
    validationRefs: ["docs/runbooks/runtime-model-only-live-provider-moderate-proof-assessment.md"],
    validatedAt: NOW,
    evidenceExpiresAt: "2026-07-05T00:00:00.000Z",
    defaultModelSelectionClaim: false,
    providerLockIn: false,
    productionReadinessClaim: false,
  }], { now: NOW, maxValidationAgeDays: 30 });
  return selectRouteFromCatalog(catalog, {
    routeRef: ROUTE_REF,
    environment,
    approvalRef: "approvals/lab-runtime-model-proof-harness",
    now: NOW,
    maxValidationAgeDays: 30,
  });
}

function approval() {
  return createModelActivationApproval({
    approvalId: "lab-runtime-model-proof-harness",
    approvedBy: "operator",
    approvedAt: NOW,
    provider: "openai-codex",
    model: "gpt-5.5",
    maxCostUsd: 1,
    corpusRef: "external-corpus/lab-runtime-model-proof.json",
    cleanupCommitment: "lab runtime model proof writes no graph records and no production state",
    approvalRef: "approvals/lab-runtime-model-proof-harness",
    budgetLedgerRef: "ledgers/lab-runtime-model-proof-harness",
    runEvidenceRef: "evidence/lab-runtime-model-proof-harness",
    cleanupOutcomeRef: "cleanup/lab-runtime-model-proof-harness",
  });
}

describe("lab runtime model proof harness", () => {
  test("calls injected provider exactly once only after explicit route and activation gates pass", async () => {
    let providerCalls = 0;
    const route = selectedRoute();
    const request = createModelProviderRequest({
      operation: "graph.propose",
      mode: "model",
      model: "gpt-5.5",
      prompt: "Return synthetic graph JSON only.",
      inputGraphRef: "external-corpus/lab-runtime-model-proof.json",
      idempotencyKey: "lab-runtime-model-proof-harness.1",
      maxOutputTokens: 1024,
      temperature: 0,
      metadata: { prompt_contract_ref: "prompt-contracts/lab-runtime-model-proof" },
    });

    const report = await executeLabRuntimeModelProof({
      selectedRoute: route,
      provider: {
        name: "fixture-live-provider-boundary",
        async generate(received) {
          providerCalls += 1;
          assert.equal(received, request);
          return {
            provider: "openai-codex",
            model: "gpt-5.5",
            idempotencyKey: received.idempotencyKey,
            output: { excerpts: [], claims: [], account_objects: [] },
            usage: { inputTokens: 11, outputTokens: 13, totalTokens: 24 },
            cost: { currency: "USD", amount: 0 },
          };
        },
      },
      request,
      approval: approval(),
      costLedgerEntries: [],
      now: NOW,
      corpusRef: "external-corpus/lab-runtime-model-proof.json",
      environment: "lab",
      nextEstimatedCostUsd: 0,
      credentialReady: true,
    });

    assert.equal(providerCalls, 1);
    assert.equal(report.ok, true);
    assert.equal(report.provider_calls_executed, 1);
    assert.equal(report.observed_cost_usd, 0);
    assert.equal(report.total_tokens, 24);
    assert.equal(report.graph_ingestion_performed, false);
    assert.equal(report.production_writes_performed, false);
    assert.equal(report.provider_payload_committed, false);
    assert.equal(report.model_output_committed, false);
    assert.equal(report.request_identifier_committed, false);
  });

  test("blocks expired selected-route evidence at harness preflight before provider call", async () => {
    let providerCalls = 0;
    const route = selectedRoute("test");
    const request = createModelProviderRequest({
      operation: "graph.propose",
      mode: "model",
      model: "gpt-5.5",
      prompt: "Return synthetic graph JSON only.",
      inputGraphRef: "external-corpus/lab-runtime-model-proof.json",
      idempotencyKey: "lab-runtime-model-proof-harness.expired-evidence",
      maxOutputTokens: 1024,
      temperature: 0,
      metadata: { prompt_contract_ref: "prompt-contracts/lab-runtime-model-proof" },
    });

    const report = await executeLabRuntimeModelProof({
      selectedRoute: {
        ...route,
        routeEvidenceStatus: "fresh",
        routeEvidenceExpiresAt: "2026-06-04T00:00:00.000Z",
        routeRequiresFreshApprovalBeforeUse: false,
        routeUsableWithoutRevalidation: true,
        route: { ...route.route, evidenceExpiresAt: "2026-06-04T00:00:00.000Z" },
      },
      provider: {
        name: "must-not-call-expired-evidence",
        async generate() {
          providerCalls += 1;
          throw new Error("should not be called");
        },
      },
      request,
      approval: approval(),
      costLedgerEntries: [],
      now: "2026-06-05T00:00:00.000Z",
      corpusRef: "external-corpus/lab-runtime-model-proof.json",
      environment: "test",
      nextEstimatedCostUsd: 0,
      credentialReady: true,
    });

    assert.equal(providerCalls, 0);
    assert.equal(report.ok, false);
    assert.equal(report.status, "blocked");
    assert.equal(report.provider_calls_executed, 0);
    assert.match(report.refusal_reasons.join(" "), /route evidence expired requires revalidation/i);
  });

  test("blocks before provider call when gates fail and refuses non-lab environments", async () => {
    let providerCalls = 0;
    const route = selectedRoute("test");
    const request = createModelProviderRequest({
      operation: "graph.propose",
      mode: "model",
      model: "gpt-5.5",
      prompt: "Return synthetic graph JSON only.",
      inputGraphRef: "external-corpus/lab-runtime-model-proof.json",
      idempotencyKey: "lab-runtime-model-proof-harness.2",
      maxOutputTokens: 1024,
      temperature: 0,
      metadata: { tools: "true" },
    });

    const report = await executeLabRuntimeModelProof({
      selectedRoute: route,
      provider: {
        name: "must-not-call",
        async generate() {
          providerCalls += 1;
          throw new Error("should not be called");
        },
      },
      request,
      approval: approval(),
      costLedgerEntries: [],
      now: NOW,
      corpusRef: "external-corpus/lab-runtime-model-proof.json",
      environment: "test",
      nextEstimatedCostUsd: 0,
      credentialReady: true,
    });

    assert.equal(providerCalls, 0);
    assert.equal(report.ok, false);
    assert.equal(report.status, "blocked");
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.refusal_reasons.includes("forbidden metadata key rejected: tools"), true);

    await assert.rejects(() => executeLabRuntimeModelProof({
      selectedRoute: route,
      provider: { name: "unused", async generate() { throw new Error("unused"); } },
      request: createModelProviderRequest({ ...request, metadata: { prompt_contract_ref: "ok" } }),
      approval: approval(),
      costLedgerEntries: [],
      now: NOW,
      corpusRef: "external-corpus/lab-runtime-model-proof.json",
      environment: "production" as "lab",
      nextEstimatedCostUsd: 0,
      credentialReady: true,
    }), /lab\/test only/i);

    let mismatchedRouteProviderCalls = 0;
    await assert.rejects(() => executeLabRuntimeModelProof({
      selectedRoute: { ...route, environment: "staging" },
      provider: {
        name: "must-not-call-selected-route-mismatch",
        async generate() {
          mismatchedRouteProviderCalls += 1;
          throw new Error("should not be called");
        },
      },
      request: createModelProviderRequest({ ...request, metadata: { prompt_contract_ref: "ok" } }),
      approval: approval(),
      costLedgerEntries: [],
      now: NOW,
      corpusRef: "external-corpus/lab-runtime-model-proof.json",
      environment: "lab",
      nextEstimatedCostUsd: 0,
      credentialReady: true,
    }), /selected route environment must match lab\/test harness environment/i);
    assert.equal(mismatchedRouteProviderCalls, 0);
  });
});
