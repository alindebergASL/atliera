import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createModelActivationApproval,
  createModelCostLedgerEntry,
} from "../../src/model/activation-gates.js";
import { preflightRuntimeModelExecution } from "../../src/model/runtime-model-execution-preflight.js";
import type { SelectedModelRoute } from "../../src/model/validated-route-catalog.js";

const selectedRoute = (): SelectedModelRoute => ({
  route: {
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
  },
  selectionReason: "explicit-route-ref",
  approvalRef: "approvals/provider-neutral-runtime-integration-pr158",
  environment: "staging",
  validationAgeDays: 1,
  providerCallsExecuted: 0,
  providerSpend: false,
  runtimeModelModeIntegration: false,
  defaultModelSelectionClaim: false,
  providerLockIn: false,
});

const approval = () => createModelActivationApproval({
  approvalId: "approval-pr158",
  approvedBy: "operator",
  approvedAt: "2026-06-02T00:00:00.000Z",
  provider: "openai-codex",
  model: "gpt-5.5",
  maxCostUsd: 1,
  corpusRef: "external-corpus/runtime-model-preflight.json",
  cleanupCommitment: "private evidence remains outside repo",
  approvalRef: "approvals/provider-neutral-runtime-integration-pr158",
  budgetLedgerRef: "ledgers/runtime-model-preflight-pr158",
  runEvidenceRef: "evidence/runtime-model-preflight-pr158",
  cleanupOutcomeRef: "cleanup/runtime-model-preflight-pr158",
});

const ledger = () => createModelCostLedgerEntry({
  ledgerEntryId: "ledger-pr158",
  approvalId: "approval-pr158",
  runId: "run-pr158",
  provider: "openai-codex",
  model: "gpt-5.5",
  accountRef: "synthetic-account",
  stage: "runtime-preflight",
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: 0.1,
  observedCostUsd: 0,
  status: "estimated",
  retryCount: 0,
  error: null,
  recordedAt: "2026-06-02T00:00:00.000Z",
});

describe("runtime model execution preflight", () => {
  test("passes with selected route, approval, budget headroom, and sanitized metadata", () => {
    const decision = preflightRuntimeModelExecution({
      selectedRoute: selectedRoute(),
      mode: "model",
      corpusRef: "external-corpus/runtime-model-preflight.json",
      approval: approval(),
      costLedgerEntries: [ledger()],
      nextEstimatedCostUsd: 0.05,
      credentialReady: true,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: { prompt_contract_ref: "prompt-contracts/graph-propose-v1" },
    });

    assert.equal(decision.ok, true);
    assert.equal(decision.providerCallsExecuted, 0);
    assert.equal(decision.providerSpend, false);
    assert.equal(decision.authorizesProviderCall, false);
    assert.equal(decision.defaultModelSelectionClaim, false);
    assert.deepEqual(decision.refusalReasons, []);
  });

  test("reuses activation gates and refuses missing approval or budget overflow", () => {
    assert.equal(preflightRuntimeModelExecution({
      selectedRoute: selectedRoute(),
      mode: "model",
      corpusRef: "external-corpus/runtime-model-preflight.json",
      approval: null,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0.05,
      credentialReady: true,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: {},
    }).ok, false);

    const overflow = preflightRuntimeModelExecution({
      selectedRoute: selectedRoute(),
      mode: "model",
      corpusRef: "external-corpus/runtime-model-preflight.json",
      approval: approval(),
      costLedgerEntries: [createModelCostLedgerEntry({
        ledgerEntryId: "ledger-overflow",
        approvalId: "approval-pr158",
        runId: "run-overflow",
        provider: "openai-codex",
        model: "gpt-5.5",
        accountRef: "synthetic-account",
        stage: "runtime-preflight",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0.95,
        observedCostUsd: 0.95,
        status: "succeeded",
        retryCount: 0,
        error: null,
        recordedAt: "2026-06-02T00:00:00.000Z",
      })],
      nextEstimatedCostUsd: 0.1,
      credentialReady: true,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: {},
    });
    assert.equal(overflow.ok, false);
    assert.match(overflow.refusalReasons.join(" "), /budget/i);
  });

  test("refuses missing credentials and forbidden tool/search/plugin metadata before provider access", () => {
    const missingCredential = preflightRuntimeModelExecution({
      selectedRoute: selectedRoute(),
      mode: "model",
      corpusRef: "external-corpus/runtime-model-preflight.json",
      approval: approval(),
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0.05,
      credentialReady: false,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: {},
    });
    assert.equal(missingCredential.ok, false);
    assert.match(missingCredential.refusalReasons.join(" "), /credential/i);

    for (const key of ["tools", "shell", "file", "web_search", "plugin", "retrieval", "mcp"]) {
      assert.equal(preflightRuntimeModelExecution({
        selectedRoute: selectedRoute(),
        mode: "model",
        corpusRef: "external-corpus/runtime-model-preflight.json",
        approval: approval(),
        costLedgerEntries: [],
        nextEstimatedCostUsd: 0.05,
        credentialReady: true,
        now: "2026-06-03T00:00:00.000Z",
        requestMetadata: { [key]: "true" },
      }).ok, false, key);
    }
  });

  test("sanitizes hostile metadata accessors without invoking provider transport", () => {
    const metadata = {} as Record<string, string>;
    Object.defineProperty(metadata, "tools", {
      enumerable: true,
      get() {
        throw new Error("leak tools getter");
      },
    });

    const decision = preflightRuntimeModelExecution({
      selectedRoute: selectedRoute(),
      mode: "model",
      corpusRef: "external-corpus/runtime-model-preflight.json",
      approval: approval(),
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0.05,
      credentialReady: true,
      now: "2026-06-03T00:00:00.000Z",
      requestMetadata: metadata,
    });

    assert.equal(decision.ok, false);
    assert.match(decision.refusalReasons.join(" "), /metadata accessor rejected/i);
    assert.equal(decision.providerCallsExecuted, 0);
  });
});
