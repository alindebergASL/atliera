import assert from "node:assert/strict";
import test from "node:test";

import {
  createModelActivationApproval,
  createModelCostLedgerEntry,
} from "../../src/model/activation-gates.ts";
import { createHermesGpt55ActivationPreflightProof } from "../../src/model/hermes-gpt55-activation-preflight-proof.ts";

const approval = createModelActivationApproval({
  approvalId: "approval_gpt55_smoke_1",
  approvedBy: "operator_1",
  approvedAt: "2026-06-02T17:55:00.000Z",
  provider: "openai-codex",
  model: "gpt-5.5",
  maxCostUsd: 0.25,
  corpusRef: "external-corpus/synthetic-gpt55-smoke-v1",
  cleanupCommitment: "delete raw provider evidence after sanitized marker is archived outside repo",
  approvalRef: "approvals/gpt55-smoke-1.json",
  budgetLedgerRef: "ledgers/gpt55-smoke-1.jsonl",
  runEvidenceRef: "runs/gpt55-smoke-1/",
  cleanupOutcomeRef: "cleanup/gpt55-smoke-1.json",
});

function activationInput(overrides = {}) {
  return {
    mode: "model" as const,
    provider: "openai-codex",
    model: "gpt-5.5",
    corpusRef: "external-corpus/synthetic-gpt55-smoke-v1",
    approval,
    costLedgerEntries: [
      createModelCostLedgerEntry({
        ledgerEntryId: "ledger_gpt55_1",
        approvalId: "approval_gpt55_smoke_1",
        runId: "run_gpt55_0",
        provider: "openai-codex",
        model: "gpt-5.5",
        accountRef: "synthetic_account_1",
        stage: "smoke_preflight",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        observedCostUsd: 0,
        status: "estimated",
        retryCount: 0,
        error: null,
        recordedAt: "2026-06-02T17:55:10.000Z",
      }),
    ],
    nextEstimatedCostUsd: 0.02,
    now: "2026-06-02T17:56:00.000Z",
    ...overrides,
  };
}

function preflightInput(overrides = {}) {
  return {
    activation: activationInput(),
    credentialReadiness: { status: "present" as const },
    syntheticPromptRef: "prompts/synthetic-gpt55-smoke-v1.json",
    ...overrides,
  };
}

test("creates a no-spend readiness proof for one synthetic GPT-5.5 smoke without authorizing comparison", () => {
  const proof = createHermesGpt55ActivationPreflightProof(preflightInput());

  assert.deepEqual(proof, {
    schema_version: "atliera.hermes_gpt55_activation_preflight_proof.v1",
    provider_route: "openai-codex",
    api_mode: "codex_responses",
    model: "gpt-5.5",
    ready_for_one_synthetic_smoke: true,
    provider_calls_executed: 0,
    provider_spend: false,
    credential_value_observed: false,
    raw_evidence_committed: false,
    authorizes_comparison_run: false,
    authorizes_candidate_calls: false,
    model_only_transport_proven: false,
    synthetic_only: true,
    credential_status: "present",
    missing_gate_count: 0,
    refusal_reason_count: 0,
    approved_budget_usd: 0.25,
    observed_spend_usd: 0,
    next_estimated_cost_usd: 0.02,
    failure_code: null,
  });
});

test("fails closed when approval or activation gates are missing and never reports credential values", () => {
  const proof = createHermesGpt55ActivationPreflightProof(preflightInput({
    activation: activationInput({ approval: null, nextEstimatedCostUsd: 999 }),
  }));

  assert.equal(proof.ready_for_one_synthetic_smoke, false);
  assert.equal(proof.failure_code, "activation_refused");
  assert.equal(proof.provider_calls_executed, 0);
  assert.equal(proof.provider_spend, false);
  assert.equal(proof.authorizes_comparison_run, false);
  assert.equal(proof.credential_value_observed, false);
  assert.doesNotMatch(JSON.stringify(proof), /approval_gpt55_smoke_1|sk-|secret|token|credential_value_observed":true/i);
});

test("fails closed when the next synthetic smoke estimate would exceed the approval budget", () => {
  const expensiveApproval = createModelActivationApproval({
    approvalId: "approval_gpt55_tiny_budget",
    approvedBy: "operator_1",
    approvedAt: "2026-06-02T17:55:00.000Z",
    provider: "openai-codex",
    model: "gpt-5.5",
    maxCostUsd: 0.01,
    corpusRef: "external-corpus/synthetic-gpt55-smoke-v1",
    cleanupCommitment: "delete raw provider evidence after sanitized marker is archived outside repo",
    approvalRef: "approvals/gpt55-tiny-budget.json",
    budgetLedgerRef: "ledgers/gpt55-tiny-budget.jsonl",
    runEvidenceRef: "runs/gpt55-tiny-budget/",
    cleanupOutcomeRef: "cleanup/gpt55-tiny-budget.json",
  });

  const proof = createHermesGpt55ActivationPreflightProof(preflightInput({
    activation: activationInput({ approval: expensiveApproval, nextEstimatedCostUsd: 0.02 }),
  }));

  assert.equal(proof.ready_for_one_synthetic_smoke, false);
  assert.equal(proof.failure_code, "activation_refused");
  assert.equal(proof.provider_calls_executed, 0);
  assert.equal(proof.authorizes_candidate_calls, false);
});

test("fails closed for missing or invalid sanitized credential readiness", () => {
  for (const status of ["missing", "invalid"] as const) {
    const proof = createHermesGpt55ActivationPreflightProof(preflightInput({
      credentialReadiness: { status },
    }));

    assert.equal(proof.ready_for_one_synthetic_smoke, false);
    assert.equal(proof.failure_code, `credential_${status}`);
    assert.equal(proof.credential_status, status);
    assert.equal(proof.credential_value_observed, false);
    assert.doesNotMatch(JSON.stringify(proof), /API_KEY|sk-|secret|token|credential_value_observed":true/i);
  }
});

test("rejects malformed credential readiness and non-synthetic corpus or prompt refs", () => {
  assert.throws(
    () => createHermesGpt55ActivationPreflightProof(preflightInput({
      credentialReadiness: { status: "present", value: "sk-should-not-exist" },
    })),
    /credential readiness must be sanitized/i,
  );

  const nonSyntheticApproval = createModelActivationApproval({
    approvalId: "approval_gpt55_live_scope",
    approvedBy: "operator_1",
    approvedAt: "2026-06-02T17:55:00.000Z",
    provider: "openai-codex",
    model: "gpt-5.5",
    maxCostUsd: 0.25,
    corpusRef: "external-corpus/live-customer-v1",
    cleanupCommitment: "delete raw provider evidence after sanitized marker is archived outside repo",
    approvalRef: "approvals/gpt55-live-scope.json",
    budgetLedgerRef: "ledgers/gpt55-live-scope.jsonl",
    runEvidenceRef: "runs/gpt55-live-scope/",
    cleanupOutcomeRef: "cleanup/gpt55-live-scope.json",
  });
  const proof = createHermesGpt55ActivationPreflightProof(preflightInput({
    activation: activationInput({
      approval: nonSyntheticApproval,
      corpusRef: "external-corpus/live-customer-v1",
    }),
  }));
  assert.equal(proof.ready_for_one_synthetic_smoke, false);
  assert.equal(proof.failure_code, "non_synthetic_scope");

  assert.throws(
    () => createHermesGpt55ActivationPreflightProof(preflightInput({
      syntheticPromptRef: "prompts/live-customer-smoke.json",
    })),
    /synthetic prompt ref must be scoped to synthetic prompts/i,
  );
});

test("rejects credential readiness accessors before they can observe process.env", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const credentialReadiness = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        void process.env;
        return "present";
      },
    });
    assert.throws(
      () => createHermesGpt55ActivationPreflightProof(preflightInput({ credentialReadiness })),
      /credential readiness must be sanitized/i,
    );
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

test("does not read process.env while creating the activation preflight proof", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const proof = createHermesGpt55ActivationPreflightProof(preflightInput());
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
