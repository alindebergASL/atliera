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
  const snapshot = snapshotModelActivationApprovalInput(input);
  assertSafeLogicalId("approvalId", snapshot.approvalId);
  assertSafeLogicalId("approvedBy", snapshot.approvedBy);
  assertStrictIsoTimestamp("approvedAt", snapshot.approvedAt);
  assertSafeLogicalId("provider", snapshot.provider);
  assertSafeLogicalId("model", snapshot.model);
  assertPositiveMoney("maxCostUsd", snapshot.maxCostUsd);
  assertOutOfRepoCorpusRef("corpusRef", snapshot.corpusRef);
  assertNonEmptyString("cleanupCommitment", snapshot.cleanupCommitment);
  assertSafeAuditRef("approvalRef", snapshot.approvalRef);
  assertSafeAuditRef("budgetLedgerRef", snapshot.budgetLedgerRef);
  assertSafeAuditRef("runEvidenceRef", snapshot.runEvidenceRef);
  assertSafeAuditRef("cleanupOutcomeRef", snapshot.cleanupOutcomeRef);

  return Object.freeze({
    schema_version: MODEL_ACTIVATION_APPROVAL_SCHEMA_VERSION,
    approval_id: snapshot.approvalId,
    approved_by: snapshot.approvedBy,
    approved_at: snapshot.approvedAt,
    provider: snapshot.provider,
    model: snapshot.model,
    max_cost_usd: snapshot.maxCostUsd,
    corpus_ref: snapshot.corpusRef,
    cleanup_commitment: snapshot.cleanupCommitment,
    approval_ref: snapshot.approvalRef,
    budget_ledger_ref: snapshot.budgetLedgerRef,
    run_evidence_ref: snapshot.runEvidenceRef,
    cleanup_outcome_ref: snapshot.cleanupOutcomeRef,
  });
}

function snapshotModelActivationApprovalInput(
  input: ModelActivationApprovalInput,
): ModelActivationApprovalInput {
  try {
    return {
      approvalId: input.approvalId,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt,
      provider: input.provider,
      model: input.model,
      maxCostUsd: input.maxCostUsd,
      corpusRef: input.corpusRef,
      cleanupCommitment: input.cleanupCommitment,
      approvalRef: input.approvalRef,
      budgetLedgerRef: input.budgetLedgerRef,
      runEvidenceRef: input.runEvidenceRef,
      cleanupOutcomeRef: input.cleanupOutcomeRef,
    };
  } catch {
    throw new Error("approval input must be a plain data object");
  }
}

export function createModelCostLedgerEntry(
  input: ModelCostLedgerEntryInput,
): ModelCostLedgerEntry {
  const snapshot = snapshotModelCostLedgerEntryInput(input);
  assertSafeLogicalId("ledgerEntryId", snapshot.ledgerEntryId);
  assertSafeLogicalId("approvalId", snapshot.approvalId);
  assertSafeLogicalId("runId", snapshot.runId);
  assertSafeLogicalId("provider", snapshot.provider);
  assertSafeLogicalId("model", snapshot.model);
  assertSafeLogicalId("accountRef", snapshot.accountRef);
  assertSafeStage("stage", snapshot.stage);
  assertNonNegativeInteger("inputTokens", snapshot.inputTokens);
  assertNonNegativeInteger("outputTokens", snapshot.outputTokens);
  assertNonNegativeMoney("estimatedCostUsd", snapshot.estimatedCostUsd);
  assertNonNegativeMoney("observedCostUsd", snapshot.observedCostUsd);
  assertCostLedgerStatus(snapshot.status);
  assertNonNegativeInteger("retryCount", snapshot.retryCount);
  if (snapshot.error !== null) {
    assertNonEmptyString("error", snapshot.error);
  }
  assertStrictIsoTimestamp("recordedAt", snapshot.recordedAt);

  return Object.freeze({
    schema_version: MODEL_COST_LEDGER_ENTRY_SCHEMA_VERSION,
    ledger_entry_id: snapshot.ledgerEntryId,
    approval_id: snapshot.approvalId,
    run_id: snapshot.runId,
    provider: snapshot.provider,
    model: snapshot.model,
    account_ref: snapshot.accountRef,
    stage: snapshot.stage,
    input_tokens: snapshot.inputTokens,
    output_tokens: snapshot.outputTokens,
    estimated_cost_usd: snapshot.estimatedCostUsd,
    observed_cost_usd: snapshot.observedCostUsd,
    status: snapshot.status,
    retry_count: snapshot.retryCount,
    error: snapshot.error,
    recorded_at: snapshot.recordedAt,
  });
}

function snapshotModelCostLedgerEntryInput(
  input: ModelCostLedgerEntryInput,
): ModelCostLedgerEntryInput {
  try {
    return {
      ledgerEntryId: input.ledgerEntryId,
      approvalId: input.approvalId,
      runId: input.runId,
      provider: input.provider,
      model: input.model,
      accountRef: input.accountRef,
      stage: input.stage,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      observedCostUsd: input.observedCostUsd,
      status: input.status,
      retryCount: input.retryCount,
      error: input.error,
      recordedAt: input.recordedAt,
    };
  } catch {
    throw new Error("cost ledger input must be a plain data object");
  }
}

export function evaluateModelActivationGates(
  input: ModelActivationGateInput,
): ModelActivationDecision {
  const snapshot = snapshotModelActivationGateInput(input);
  assertStrictIsoTimestamp("now", snapshot.now);
  assertNonNegativeMoney("nextEstimatedCostUsd", snapshot.nextEstimatedCostUsd);

  const missingGates: ModelActivationMissingGate[] = [];
  if (snapshot.mode !== "model") missingGates.push("explicit_model_mode");
  if (!isSafeLogicalId(snapshot.provider)) missingGates.push("provider");
  if (!isSafeLogicalId(snapshot.model)) missingGates.push("model");
  if (!isOutOfRepoCorpusRef(snapshot.corpusRef)) missingGates.push("out_of_repo_corpus_path");
  if (snapshot.approval === null) {
    missingGates.push("max_cost");
    missingGates.push("operator_approval");
  }

  const observedSpend = sumObservedSpend(snapshot.costLedgerEntries);
  const refusalReasons: ModelActivationRefusalReason[] = [];
  let approvedBudget: number | null = null;
  let remainingBudget: number | null = null;

  if (missingGates.length > 0) {
    refusalReasons.push("missing_activation_gates");
  } else if (snapshot.approval !== null) {
    assertModelActivationApproval(snapshot.approval);
    approvedBudget = snapshot.approval.max_cost_usd;
    remainingBudget = roundUsd(approvedBudget - observedSpend);

    if (
      snapshot.approval.provider !== snapshot.provider ||
      snapshot.approval.model !== snapshot.model ||
      snapshot.approval.corpus_ref !== snapshot.corpusRef
    ) {
      refusalReasons.push("approval_scope_mismatch");
    }

    if (roundUsd(observedSpend + snapshot.nextEstimatedCostUsd) > approvedBudget) {
      refusalReasons.push("cumulative_budget_exceeded");
    }
  }

  return Object.freeze({
    ok: refusalReasons.length === 0,
    missing_gates: Object.freeze([...missingGates]),
    refusal_reasons: Object.freeze(refusalReasons),
    approved_budget_usd: approvedBudget,
    observed_spend_usd: observedSpend,
    next_estimated_cost_usd: snapshot.nextEstimatedCostUsd,
    remaining_budget_usd: remainingBudget,
    evaluated_at: snapshot.now,
  });
}

function snapshotModelActivationGateInput(
  input: ModelActivationGateInput,
): ModelActivationGateInput {
  try {
    return {
      mode: input.mode,
      provider: input.provider,
      model: input.model,
      corpusRef: input.corpusRef,
      approval: input.approval === null ? null : snapshotModelActivationApprovalRecord(input.approval),
      costLedgerEntries: Object.freeze(
        [...input.costLedgerEntries].map((entry) => snapshotModelCostLedgerEntryRecord(entry)),
      ),
      nextEstimatedCostUsd: input.nextEstimatedCostUsd,
      now: input.now,
    };
  } catch {
    throw new Error("activation gate input must be a plain data object");
  }
}

function snapshotModelActivationApprovalRecord(
  approval: ModelActivationApproval,
): ModelActivationApproval {
  return Object.freeze({
    schema_version: approval.schema_version,
    approval_id: approval.approval_id,
    approved_by: approval.approved_by,
    approved_at: approval.approved_at,
    provider: approval.provider,
    model: approval.model,
    max_cost_usd: approval.max_cost_usd,
    corpus_ref: approval.corpus_ref,
    cleanup_commitment: approval.cleanup_commitment,
    approval_ref: approval.approval_ref,
    budget_ledger_ref: approval.budget_ledger_ref,
    run_evidence_ref: approval.run_evidence_ref,
    cleanup_outcome_ref: approval.cleanup_outcome_ref,
  });
}

function snapshotModelCostLedgerEntryRecord(
  entry: ModelCostLedgerEntry,
): ModelCostLedgerEntry {
  return Object.freeze({
    schema_version: entry.schema_version,
    ledger_entry_id: entry.ledger_entry_id,
    approval_id: entry.approval_id,
    run_id: entry.run_id,
    provider: entry.provider,
    model: entry.model,
    account_ref: entry.account_ref,
    stage: entry.stage,
    input_tokens: entry.input_tokens,
    output_tokens: entry.output_tokens,
    estimated_cost_usd: entry.estimated_cost_usd,
    observed_cost_usd: entry.observed_cost_usd,
    status: entry.status,
    retry_count: entry.retry_count,
    error: entry.error,
    recorded_at: entry.recorded_at,
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
