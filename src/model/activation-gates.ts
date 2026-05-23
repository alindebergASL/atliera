import type { RuntimeMode } from "../modes/index.ts";

export const MODEL_ACTIVATION_APPROVAL_SCHEMA_VERSION = "atliera.model_activation_approval.v1" as const;
export const MODEL_COST_LEDGER_ENTRY_SCHEMA_VERSION = "atliera.model_cost_ledger_entry.v1" as const;

export type ModelCostLedgerStatus = "estimated" | "succeeded" | "failed" | "refused";

export type ModelActivationMissingGate =
  | "explicit_model_mode"
  | "provider"
  | "model"
  | "max_cost"
  | "out_of_repo_corpus_path"
  | "operator_approval";

export type ModelActivationRefusalReason =
  | "missing_activation_gates"
  | "approval_scope_mismatch"
  | "cumulative_budget_exceeded";

export interface ModelActivationApprovalInput {
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly provider: string;
  readonly model: string;
  readonly maxCostUsd: number;
  readonly corpusRef: string;
  readonly cleanupCommitment: string;
  readonly approvalRef: string;
  readonly budgetLedgerRef: string;
  readonly runEvidenceRef: string;
  readonly cleanupOutcomeRef: string;
}

export interface ModelActivationApproval {
  readonly schema_version: typeof MODEL_ACTIVATION_APPROVAL_SCHEMA_VERSION;
  readonly approval_id: string;
  readonly approved_by: string;
  readonly approved_at: string;
  readonly provider: string;
  readonly model: string;
  readonly max_cost_usd: number;
  readonly corpus_ref: string;
  readonly cleanup_commitment: string;
  readonly approval_ref: string;
  readonly budget_ledger_ref: string;
  readonly run_evidence_ref: string;
  readonly cleanup_outcome_ref: string;
}

export interface ModelCostLedgerEntryInput {
  readonly ledgerEntryId: string;
  readonly approvalId: string;
  readonly runId: string;
  readonly provider: string;
  readonly model: string;
  readonly accountRef: string;
  readonly stage: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly observedCostUsd: number;
  readonly status: ModelCostLedgerStatus;
  readonly retryCount: number;
  readonly error: string | null;
  readonly recordedAt: string;
}

export interface ModelCostLedgerEntry {
  readonly schema_version: typeof MODEL_COST_LEDGER_ENTRY_SCHEMA_VERSION;
  readonly ledger_entry_id: string;
  readonly approval_id: string;
  readonly run_id: string;
  readonly provider: string;
  readonly model: string;
  readonly account_ref: string;
  readonly stage: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost_usd: number;
  readonly observed_cost_usd: number;
  readonly status: ModelCostLedgerStatus;
  readonly retry_count: number;
  readonly error: string | null;
  readonly recorded_at: string;
}

export interface ModelActivationGateInput {
  readonly mode: RuntimeMode;
  readonly provider: string;
  readonly model: string;
  readonly corpusRef: string;
  readonly approval: ModelActivationApproval | null;
  readonly costLedgerEntries: readonly ModelCostLedgerEntry[];
  readonly nextEstimatedCostUsd: number;
  readonly now: string;
}

export interface ModelActivationDecision {
  readonly ok: boolean;
  readonly missing_gates: readonly ModelActivationMissingGate[];
  readonly refusal_reasons: readonly ModelActivationRefusalReason[];
  readonly approved_budget_usd: number | null;
  readonly observed_spend_usd: number;
  readonly next_estimated_cost_usd: number;
  readonly remaining_budget_usd: number | null;
  readonly evaluated_at: string;
}

const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_REF_WITH_FRAGMENT = /^[A-Za-z0-9][A-Za-z0-9._/#-]{0,255}$/;
const SAFE_STAGE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const COST_LEDGER_STATUSES: readonly ModelCostLedgerStatus[] = [
  "estimated",
  "succeeded",
  "failed",
  "refused",
];

export function createModelActivationApproval(
  input: ModelActivationApprovalInput,
): ModelActivationApproval {
  assertSafeLogicalId("approvalId", input.approvalId);
  assertSafeLogicalId("approvedBy", input.approvedBy);
  assertStrictIsoTimestamp("approvedAt", input.approvedAt);
  assertSafeLogicalId("provider", input.provider);
  assertSafeLogicalId("model", input.model);
  assertPositiveMoney("maxCostUsd", input.maxCostUsd);
  assertOutOfRepoCorpusRef("corpusRef", input.corpusRef);
  assertNonEmptyString("cleanupCommitment", input.cleanupCommitment);
  assertSafeAuditRef("approvalRef", input.approvalRef);
  assertSafeAuditRef("budgetLedgerRef", input.budgetLedgerRef);
  assertSafeAuditRef("runEvidenceRef", input.runEvidenceRef);
  assertSafeAuditRef("cleanupOutcomeRef", input.cleanupOutcomeRef);

  return Object.freeze({
    schema_version: MODEL_ACTIVATION_APPROVAL_SCHEMA_VERSION,
    approval_id: input.approvalId,
    approved_by: input.approvedBy,
    approved_at: input.approvedAt,
    provider: input.provider,
    model: input.model,
    max_cost_usd: input.maxCostUsd,
    corpus_ref: input.corpusRef,
    cleanup_commitment: input.cleanupCommitment,
    approval_ref: input.approvalRef,
    budget_ledger_ref: input.budgetLedgerRef,
    run_evidence_ref: input.runEvidenceRef,
    cleanup_outcome_ref: input.cleanupOutcomeRef,
  });
}

export function createModelCostLedgerEntry(
  input: ModelCostLedgerEntryInput,
): ModelCostLedgerEntry {
  assertSafeLogicalId("ledgerEntryId", input.ledgerEntryId);
  assertSafeLogicalId("approvalId", input.approvalId);
  assertSafeLogicalId("runId", input.runId);
  assertSafeLogicalId("provider", input.provider);
  assertSafeLogicalId("model", input.model);
  assertSafeLogicalId("accountRef", input.accountRef);
  assertSafeStage("stage", input.stage);
  assertNonNegativeInteger("inputTokens", input.inputTokens);
  assertNonNegativeInteger("outputTokens", input.outputTokens);
  assertNonNegativeMoney("estimatedCostUsd", input.estimatedCostUsd);
  assertNonNegativeMoney("observedCostUsd", input.observedCostUsd);
  assertCostLedgerStatus(input.status);
  assertNonNegativeInteger("retryCount", input.retryCount);
  if (input.error !== null) {
    assertNonEmptyString("error", input.error);
  }
  assertStrictIsoTimestamp("recordedAt", input.recordedAt);

  return Object.freeze({
    schema_version: MODEL_COST_LEDGER_ENTRY_SCHEMA_VERSION,
    ledger_entry_id: input.ledgerEntryId,
    approval_id: input.approvalId,
    run_id: input.runId,
    provider: input.provider,
    model: input.model,
    account_ref: input.accountRef,
    stage: input.stage,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    estimated_cost_usd: input.estimatedCostUsd,
    observed_cost_usd: input.observedCostUsd,
    status: input.status,
    retry_count: input.retryCount,
    error: input.error,
    recorded_at: input.recordedAt,
  });
}

export function evaluateModelActivationGates(
  input: ModelActivationGateInput,
): ModelActivationDecision {
  assertStrictIsoTimestamp("now", input.now);
  assertNonNegativeMoney("nextEstimatedCostUsd", input.nextEstimatedCostUsd);

  const missingGates: ModelActivationMissingGate[] = [];
  if (input.mode !== "model") missingGates.push("explicit_model_mode");
  if (!isSafeLogicalId(input.provider)) missingGates.push("provider");
  if (!isSafeLogicalId(input.model)) missingGates.push("model");
  if (!isOutOfRepoCorpusRef(input.corpusRef)) missingGates.push("out_of_repo_corpus_path");
  if (input.approval === null) {
    missingGates.push("max_cost");
    missingGates.push("operator_approval");
  }

  const observedSpend = sumObservedSpend(input.costLedgerEntries);
  const refusalReasons: ModelActivationRefusalReason[] = [];
  let approvedBudget: number | null = null;
  let remainingBudget: number | null = null;

  if (missingGates.length > 0) {
    refusalReasons.push("missing_activation_gates");
  } else if (input.approval !== null) {
    assertModelActivationApproval(input.approval);
    approvedBudget = input.approval.max_cost_usd;
    remainingBudget = roundUsd(approvedBudget - observedSpend);

    if (
      input.approval.provider !== input.provider ||
      input.approval.model !== input.model ||
      input.approval.corpus_ref !== input.corpusRef
    ) {
      refusalReasons.push("approval_scope_mismatch");
    }

    if (roundUsd(observedSpend + input.nextEstimatedCostUsd) > approvedBudget) {
      refusalReasons.push("cumulative_budget_exceeded");
    }
  }

  return Object.freeze({
    ok: refusalReasons.length === 0,
    missing_gates: Object.freeze([...missingGates]),
    refusal_reasons: Object.freeze(refusalReasons),
    approved_budget_usd: approvedBudget,
    observed_spend_usd: observedSpend,
    next_estimated_cost_usd: input.nextEstimatedCostUsd,
    remaining_budget_usd: remainingBudget,
    evaluated_at: input.now,
  });
}

function assertModelActivationApproval(approval: ModelActivationApproval): void {
  if (approval.schema_version !== MODEL_ACTIVATION_APPROVAL_SCHEMA_VERSION) {
    throw new Error("approval schema version is not supported");
  }
  assertSafeLogicalId("approvalId", approval.approval_id);
  assertSafeLogicalId("approvedBy", approval.approved_by);
  assertStrictIsoTimestamp("approvedAt", approval.approved_at);
  assertSafeLogicalId("provider", approval.provider);
  assertSafeLogicalId("model", approval.model);
  assertPositiveMoney("maxCostUsd", approval.max_cost_usd);
  assertOutOfRepoCorpusRef("corpusRef", approval.corpus_ref);
  assertNonEmptyString("cleanupCommitment", approval.cleanup_commitment);
  assertSafeAuditRef("approvalRef", approval.approval_ref);
  assertSafeAuditRef("budgetLedgerRef", approval.budget_ledger_ref);
  assertSafeAuditRef("runEvidenceRef", approval.run_evidence_ref);
  assertSafeAuditRef("cleanupOutcomeRef", approval.cleanup_outcome_ref);
}

function sumObservedSpend(entries: readonly ModelCostLedgerEntry[]): number {
  let total = 0;
  for (const entry of entries) {
    assertCostLedgerEntry(entry);
    total += entry.observed_cost_usd;
  }
  return roundUsd(total);
}

function assertCostLedgerEntry(entry: ModelCostLedgerEntry): void {
  if (entry.schema_version !== MODEL_COST_LEDGER_ENTRY_SCHEMA_VERSION) {
    throw new Error("cost ledger entry schema version is not supported");
  }
  assertSafeLogicalId("ledgerEntryId", entry.ledger_entry_id);
  assertSafeLogicalId("approvalId", entry.approval_id);
  assertSafeLogicalId("runId", entry.run_id);
  assertSafeLogicalId("provider", entry.provider);
  assertSafeLogicalId("model", entry.model);
  assertSafeLogicalId("accountRef", entry.account_ref);
  assertSafeStage("stage", entry.stage);
  assertNonNegativeInteger("inputTokens", entry.input_tokens);
  assertNonNegativeInteger("outputTokens", entry.output_tokens);
  assertNonNegativeMoney("estimatedCostUsd", entry.estimated_cost_usd);
  assertNonNegativeMoney("observedCostUsd", entry.observed_cost_usd);
  assertCostLedgerStatus(entry.status);
  assertNonNegativeInteger("retryCount", entry.retry_count);
  if (entry.error !== null) {
    assertNonEmptyString("error", entry.error);
  }
  assertStrictIsoTimestamp("recordedAt", entry.recorded_at);
}

function assertSafeLogicalId(field: string, value: string): void {
  if (!isSafeLogicalId(value)) {
    throw new Error(`${field} must be a safe logical identifier`);
  }
}

function isSafeLogicalId(value: string): boolean {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    SAFE_LOGICAL_ID.test(value) &&
    !value.includes("://") &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function assertSafeStage(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() !== value || !SAFE_STAGE.test(value)) {
    throw new Error(`${field} must be a safe stage identifier`);
  }
}

function assertSafeAuditRef(field: string, value: string): void {
  if (!isSafeAuditRef(value)) {
    throw new Error(`${field} must be a safe relative audit reference`);
  }
}

function assertOutOfRepoCorpusRef(field: string, value: string): void {
  if (!isOutOfRepoCorpusRef(value)) {
    throw new Error(`${field} must be a safe out-of-repo corpus reference`);
  }
}

function isOutOfRepoCorpusRef(value: string): boolean {
  return isSafeAuditRef(value) && value.startsWith("external-corpus/");
}

function isSafeAuditRef(value: string): boolean {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    SAFE_RELATIVE_REF_WITH_FRAGMENT.test(value) &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    !value.includes("://") &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((segment, index, segments) => {
        const isTrailingDirectoryMarker = index === segments.length - 1 && segment.length === 0;
        return isTrailingDirectoryMarker || (segment.length > 0 && segment !== "." && !segment.startsWith("."));
      })
  );
}

function assertNonEmptyString(field: string, value: string): void {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertStrictIsoTimestamp(field: string, value: string): void {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
}

function assertPositiveMoney(field: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive finite USD amount`);
  }
}

function assertNonNegativeMoney(field: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite USD amount`);
  }
}

function assertNonNegativeInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function assertCostLedgerStatus(status: ModelCostLedgerStatus): void {
  if (!COST_LEDGER_STATUSES.includes(status)) {
    throw new Error("cost ledger status is not supported");
  }
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
