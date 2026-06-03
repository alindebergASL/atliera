import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createModelActivationApproval } from "../../src/model/activation-gates.js";
import { createModelProviderRequest } from "../../src/model/provider.js";
import { createRuntimeModelOnlyActivationPreflightProof } from "../../src/model/runtime-model-only-proof-preflight.js";
import { selectRouteFromCatalog, validateRouteCatalog, type ValidatedModelRouteInput } from "../../src/model/validated-route-catalog.js";

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

const selectedRoute = () => selectRouteFromCatalog(validateRouteCatalog([route()]), {
  routeRef: "gpt-5.5-openai-codex-20260602a",
  environment: "staging",
  approvalRef: "approvals/runtime-model-only-live-proof-pr167",
  now: "2026-06-03T00:00:00.000Z",
  maxValidationAgeDays: 30,
});

const approval = () => createModelActivationApproval({
  approvalId: "approval-pr167",
  approvedBy: "operator",
  approvedAt: "2026-06-03T00:00:00.000Z",
  provider: "openai-codex",
  model: "gpt-5.5",
  maxCostUsd: 1,
  corpusRef: "external-corpus/synthetic-runtime-model-only-live-proof.json",
  cleanupCommitment: "one synthetic live proof only after docs approval",
  approvalRef: "approvals/runtime-model-only-live-proof-pr167",
  budgetLedgerRef: "ledgers/runtime-model-only-live-proof-pr167",
  runEvidenceRef: "evidence/runtime-model-only-live-proof-pr167",
  cleanupOutcomeRef: "cleanup/runtime-model-only-live-proof-pr167",
});

const request = () => createModelProviderRequest({
  operation: "graph.propose",
  mode: "model",
  model: "gpt-5.5",
  prompt: "Synthetic proof prompt. Return empty graph proposal arrays only.",
  inputGraphRef: "corpus/synthetic-runtime-model-only-live-proof.json",
  idempotencyKey: "runtime-model-only-proof-preflight-166",
  maxOutputTokens: 256,
  temperature: 0,
  metadata: { prompt_contract_ref: "prompts/synthetic-runtime-model-only-live-proof-v1" },
});

const responseJson = JSON.stringify({
  provider: "openai-codex",
  model: "gpt-5.5",
  idempotencyKey: "runtime-model-only-proof-preflight-166",
  output: { excerpts: [], claims: [], account_objects: [] },
  usage: { inputTokens: 8, outputTokens: 9, totalTokens: 17 },
  cost: { currency: "USD", amount: 0 },
});

describe("runtime model-only activation preflight proof", () => {
  test("composes activation gate, runtime preflight, and no-spend transport proof without authorizing calls", async () => {
    let calls = 0;
    const proof = await createRuntimeModelOnlyActivationPreflightProof({
      selectedRoute: selectedRoute(),
      approval: approval(),
      request: request(),
      credentialReadiness: { status: "present" },
      nextEstimatedCostUsd: 0.01,
      now: "2026-06-03T00:00:00.000Z",
      caller: async () => {
        calls += 1;
        return responseJson;
      },
    });

    assert.equal(calls, 1);
    assert.equal(proof.status, "ready-for-one-synthetic-live-proof");
    assert.equal(proof.ready_for_one_synthetic_live_proof, true);
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
    assert.equal(proof.authorizes_candidate_calls, false);
    assert.equal(proof.authorizes_comparison_run, false);
    assert.equal(proof.model_only_transport_proven, false);
    assert.equal(proof.runtime_model_provider_implemented, false);
    assert.equal(proof.credential_value_observed, false);
    assert.equal(proof.raw_evidence_committed, false);
  });

  test("fails closed for over-budget or non-synthetic scope before caller access", async () => {
    let calls = 0;
    await assert.rejects(
      () => createRuntimeModelOnlyActivationPreflightProof({
        selectedRoute: selectedRoute(),
        approval: approval(),
        request: request(),
        credentialReadiness: { status: "present" },
        nextEstimatedCostUsd: 2,
        now: "2026-06-03T00:00:00.000Z",
        caller: async () => {
          calls += 1;
          return responseJson;
        },
      }),
      /runtime model-only activation preflight refused/,
    );

    await assert.rejects(
      () => createRuntimeModelOnlyActivationPreflightProof({
        selectedRoute: selectedRoute(),
        approval: { ...approval(), corpus_ref: "external-corpus/runtime-model-only-live-proof.json" },
        request: request(),
        credentialReadiness: { status: "present" },
        nextEstimatedCostUsd: 0.01,
        now: "2026-06-03T00:00:00.000Z",
        caller: async () => {
          calls += 1;
          return responseJson;
        },
      }),
      /runtime model-only synthetic scope rejected/,
    );

    await assert.rejects(
      () => createRuntimeModelOnlyActivationPreflightProof({
        selectedRoute: selectedRoute(),
        approval: approval(),
        request: createModelProviderRequest({
          ...request(),
          inputGraphRef: "corpus/real-account-data.json",
        }),
        credentialReadiness: { status: "present" },
        nextEstimatedCostUsd: 0.01,
        now: "2026-06-03T00:00:00.000Z",
        caller: async () => {
          calls += 1;
          return responseJson;
        },
      }),
      /runtime model-only synthetic scope rejected/,
    );
    assert.equal(calls, 0);
  });

  test("rejects unsafe credential readiness and does not read process.env", async () => {
    const original = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      await assert.rejects(
        () => createRuntimeModelOnlyActivationPreflightProof({
          selectedRoute: selectedRoute(),
          approval: approval(),
          request: request(),
          credentialReadiness: { status: "present", token: "SECRET" } as never,
          nextEstimatedCostUsd: 0.01,
          now: "2026-06-03T00:00:00.000Z",
          caller: async () => responseJson,
        }),
        /runtime model-only credential readiness rejected/,
      );

      const accessor = {} as { status: "present" };
      Object.defineProperty(accessor, "status", {
        enumerable: true,
        get() {
          throw new Error("credential getter must not run");
        },
      });
      await assert.rejects(
        () => createRuntimeModelOnlyActivationPreflightProof({
          selectedRoute: selectedRoute(),
          approval: approval(),
          request: request(),
          credentialReadiness: accessor,
          nextEstimatedCostUsd: 0.01,
          now: "2026-06-03T00:00:00.000Z",
          caller: async () => responseJson,
        }),
        /runtime model-only credential readiness rejected/,
      );
    } finally {
      if (original) Object.defineProperty(process, "env", original);
    }
  });
});
