import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  createModelActivationApproval,
  createModelCostLedgerEntry,
  evaluateModelActivationGates,
} from "../../src/model/activation-gates.ts";

describe("model activation approval and budget gates", () => {
  const approvalInput = {
    approvalId: "apr_model_validation_1",
    approvedBy: "operator_alice",
    approvedAt: "2026-05-23T21:15:00.000Z",
    provider: "anthropic",
    model: "claude-sonnet-4",
    maxCostUsd: 2,
    corpusRef: "external-corpus/validation/minimal",
    cleanupCommitment: "delete provider-response artifacts after validation report is retained",
    approvalRef: "github/issues/123#issuecomment-456",
    budgetLedgerRef: "runs/model-validation/cost-ledger.jsonl",
    runEvidenceRef: "runs/model-validation/evidence/",
    cleanupOutcomeRef: "runs/model-validation/cleanup-report.json",
  };

  it("creates an auditable operator approval record with explicit artifact locations", () => {
    const approval = createModelActivationApproval(approvalInput);

    assert.deepEqual(approval, {
      schema_version: "atliera.model_activation_approval.v1",
      approval_id: "apr_model_validation_1",
      approved_by: "operator_alice",
      approved_at: "2026-05-23T21:15:00.000Z",
      provider: "anthropic",
      model: "claude-sonnet-4",
      max_cost_usd: 2,
      corpus_ref: "external-corpus/validation/minimal",
      cleanup_commitment: "delete provider-response artifacts after validation report is retained",
      approval_ref: "github/issues/123#issuecomment-456",
      budget_ledger_ref: "runs/model-validation/cost-ledger.jsonl",
      run_evidence_ref: "runs/model-validation/evidence/",
      cleanup_outcome_ref: "runs/model-validation/cleanup-report.json",
    });
    assert.equal(Object.isFrozen(approval), true);
  });

  it("rejects approvals that omit identity, scope, approval provenance, or artifact locations", () => {
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, approvedBy: "" }),
      /approvedBy/i,
    );
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, maxCostUsd: 0 }),
      /maxCostUsd/i,
    );
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, approvalRef: "https://github.com/org/repo/issues/1" }),
      /approvalRef/i,
    );
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, corpusRef: "corpora/validation/minimal" }),
      /corpusRef/i,
    );
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, budgetLedgerRef: "../cost-ledger.jsonl" }),
      /budgetLedgerRef/i,
    );
    assert.throws(
      () => createModelActivationApproval({ ...approvalInput, cleanupOutcomeRef: "" }),
      /cleanupOutcomeRef/i,
    );
  });

  it("creates cost ledger entries with provider/model/account/stage/token/cost status fields", () => {
    const entry = createModelCostLedgerEntry({
      ledgerEntryId: "cost_entry_1",
      approvalId: "apr_model_validation_1",
      runId: "run_validation_1",
      provider: "anthropic",
      model: "claude-sonnet-4",
      accountRef: "acct_test_1",
      stage: "propose.excerpts",
      inputTokens: 100,
      outputTokens: 25,
      estimatedCostUsd: 0.1,
      observedCostUsd: 0.08,
      status: "succeeded",
      retryCount: 1,
      error: null,
      recordedAt: "2026-05-23T21:16:00.000Z",
    });

    assert.deepEqual(entry, {
      schema_version: "atliera.model_cost_ledger_entry.v1",
      ledger_entry_id: "cost_entry_1",
      approval_id: "apr_model_validation_1",
      run_id: "run_validation_1",
      provider: "anthropic",
      model: "claude-sonnet-4",
      account_ref: "acct_test_1",
      stage: "propose.excerpts",
      input_tokens: 100,
      output_tokens: 25,
      estimated_cost_usd: 0.1,
      observed_cost_usd: 0.08,
      status: "succeeded",
      retry_count: 1,
      error: null,
      recorded_at: "2026-05-23T21:16:00.000Z",
    });
    assert.equal(Object.isFrozen(entry), true);
  });

  it("refuses activation when cumulative observed plus estimated spend would exceed approval", () => {
    const approval = createModelActivationApproval(approvalInput);
    const existingEntries = [
      createModelCostLedgerEntry({
        ledgerEntryId: "cost_entry_1",
        approvalId: "apr_model_validation_1",
        runId: "run_validation_1",
        provider: "anthropic",
        model: "claude-sonnet-4",
        accountRef: "acct_test_1",
        stage: "propose.excerpts",
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: 0.4,
        observedCostUsd: 1.5,
        status: "succeeded",
        retryCount: 0,
        error: null,
        recordedAt: "2026-05-23T21:16:00.000Z",
      }),
    ];

    const decision = evaluateModelActivationGates({
      mode: "model",
      provider: "anthropic",
      model: "claude-sonnet-4",
      corpusRef: "external-corpus/validation/minimal",
      approval,
      costLedgerEntries: existingEntries,
      nextEstimatedCostUsd: 0.6,
      now: "2026-05-23T21:17:00.000Z",
    });

    assert.equal(decision.ok, false);
    assert.deepEqual(decision.missing_gates, []);
    assert.deepEqual(decision.refusal_reasons, ["cumulative_budget_exceeded"]);
    assert.equal(decision.approved_budget_usd, 2);
    assert.equal(decision.observed_spend_usd, 1.5);
    assert.equal(decision.next_estimated_cost_usd, 0.6);
    assert.equal(decision.remaining_budget_usd, 0.5);
  });

  it("aggregates missing activation gates before refusal", () => {
    const decision = evaluateModelActivationGates({
      mode: "fixture",
      provider: "",
      model: "",
      corpusRef: "",
      approval: null,
      costLedgerEntries: [],
      nextEstimatedCostUsd: 0.25,
      now: "2026-05-23T21:17:00.000Z",
    });

    assert.equal(decision.ok, false);
    assert.deepEqual(decision.missing_gates, [
      "explicit_model_mode",
      "provider",
      "model",
      "out_of_repo_corpus_path",
      "max_cost",
      "operator_approval",
    ]);
    assert.deepEqual(decision.refusal_reasons, ["missing_activation_gates"]);
  });

  it("does not read process.env while creating approvals, ledger entries, or decisions", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read by model activation gates");
      },
    });

    try {
      const approval = createModelActivationApproval(approvalInput);
      const entry = createModelCostLedgerEntry({
        ledgerEntryId: "cost_entry_1",
        approvalId: approval.approval_id,
        runId: "run_validation_1",
        provider: approval.provider,
        model: approval.model,
        accountRef: "acct_test_1",
        stage: "propose.claims",
        inputTokens: 10,
        outputTokens: 5,
        estimatedCostUsd: 0.05,
        observedCostUsd: 0.04,
        status: "succeeded",
        retryCount: 0,
        error: null,
        recordedAt: "2026-05-23T21:18:00.000Z",
      });
      assert.equal(
        evaluateModelActivationGates({
          mode: "model",
          provider: approval.provider,
          model: approval.model,
          corpusRef: approval.corpus_ref,
          approval,
          costLedgerEntries: [entry],
          nextEstimatedCostUsd: 0.1,
          now: "2026-05-23T21:19:00.000Z",
        }).ok,
        true,
      );
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(process, "env", originalDescriptor);
      }
    }
  });
});
