import {
  createModelCostLedgerEntry,
  evaluateModelActivationGates,
  type ModelActivationApproval,
  type ModelCostLedgerEntry,
} from "./activation-gates.ts";
import {
  assertSafeModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
} from "./provider.ts";

export type ModelProviderValidationCheckName =
  | "activation_gates"
  | "credential_status"
  | "provider_call"
  | "response_contract"
  | "cost_ledger_entry";

export type ModelProviderValidationCredentialStatus = "present" | "missing" | "invalid";

export interface ModelProviderValidationCheck {
  readonly name: ModelProviderValidationCheckName;
  readonly ok: boolean;
  readonly codes: readonly string[];
}

export interface ModelProviderValidationCallSummary {
  readonly provider: string;
  readonly model: string;
  readonly operation: string;
  readonly idempotency_key: string;
}

export interface ValidateModelProviderCompatibilityOptions {
  readonly provider: ModelProvider;
  readonly request: ModelProviderRequest;
  readonly providerName: string;
  readonly approval: ModelActivationApproval | null;
  readonly costLedgerEntries: readonly ModelCostLedgerEntry[];
  readonly corpusRef: string;
  readonly nextEstimatedCostUsd: number;
  readonly credentialStatus: ModelProviderValidationCredentialStatus;
  readonly runId: string;
  readonly accountRef: string;
  readonly stage: string;
  readonly now: string;
}

export interface ModelProviderValidationReport {
  readonly ok: boolean;
  readonly checks: readonly ModelProviderValidationCheck[];
  readonly call: ModelProviderValidationCallSummary;
  readonly cost_ledger_entry: ModelCostLedgerEntry | null;
}

const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_REF_WITH_FRAGMENT = /^[A-Za-z0-9][A-Za-z0-9._/#-]{0,255}$/;
const CREDENTIAL_STATUSES: readonly ModelProviderValidationCredentialStatus[] = [
  "present",
  "missing",
  "invalid",
];

export async function validateModelProviderCompatibility(
  options: ValidateModelProviderCompatibilityOptions,
): Promise<ModelProviderValidationReport> {
  validateHarnessInput(options);
  assertSafeModelProviderRequest(options.request);

  const checks: ModelProviderValidationCheck[] = [];
  const call = Object.freeze({
    provider: options.providerName,
    model: options.request.model,
    operation: options.request.operation,
    idempotency_key: options.request.idempotencyKey,
  });

  const activation = evaluateModelActivationGates({
    mode: options.request.mode,
    provider: options.providerName,
    model: options.request.model,
    corpusRef: options.corpusRef,
    approval: options.approval,
    costLedgerEntries: options.costLedgerEntries,
    nextEstimatedCostUsd: options.nextEstimatedCostUsd,
    now: options.now,
  });

  if (!activation.ok) {
    checks.push(failedCheck("activation_gates", activation.refusal_reasons));
    const ledger = createLedgerEntry(options, "refused", 0, 0, 0, 0, "activation_refused");
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("activation_gates"));

  if (options.credentialStatus !== "present") {
    const code = options.credentialStatus === "missing" ? "credential_missing" : "credential_invalid";
    checks.push(failedCheck("credential_status", [code]));
    const ledger = createLedgerEntry(options, "refused", 0, 0, 0, 0, code);
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("credential_status"));

  let response: unknown;
  try {
    response = await options.provider.generate(options.request);
  } catch {
    checks.push(failedCheck("provider_call", ["provider_call_failed"]));
    const ledger = createLedgerEntry(
      options,
      "failed",
      0,
      0,
      options.nextEstimatedCostUsd,
      0,
      "provider_call_failed",
    );
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("provider_call"));

  let responseCodes: string[];
  try {
    responseCodes = validateResponse(response, options, activation.remaining_budget_usd);
  } catch {
    responseCodes = ["response_schema_mismatch"];
  }
  const status = responseCodes.length === 0 ? "succeeded" : "failed";
  checks.push(
    responseCodes.length === 0
      ? passedCheck("response_contract")
      : failedCheck("response_contract", responseCodes),
  );
  const ledger = createLedgerEntry(
    options,
    status,
    ledgerInteger(responseField(response, "usage", "inputTokens")),
    ledgerInteger(responseField(response, "usage", "outputTokens")),
    options.nextEstimatedCostUsd,
    ledgerMoney(responseField(response, "cost", "amount")),
    status === "succeeded" ? null : "response_contract_failed",
  );
  checks.push(passedCheck("cost_ledger_entry"));
  return freezeReport(responseCodes.length === 0, checks, call, ledger);
}

function validateHarnessInput(options: ValidateModelProviderCompatibilityOptions): void {
  assertSafeLogicalId("providerName", options.providerName);
  assertSafeLogicalId("runId", options.runId);
  assertSafeLogicalId("accountRef", options.accountRef);
  assertSafeLogicalId("stage", options.stage);
  assertOutOfRepoCorpusRef("corpusRef", options.corpusRef);
  if (!CREDENTIAL_STATUSES.includes(options.credentialStatus)) {
    throw new Error("credentialStatus must be present, missing, or invalid");
  }
}

function validateResponse(
  response: unknown,
  options: ValidateModelProviderCompatibilityOptions,
  remainingBudgetUsd: number | null,
): string[] {
  const codes: string[] = [];
  if (!isRecord(response)) {
    return ["response_schema_mismatch"];
  }
  if (response.provider !== options.providerName) codes.push("provider_mismatch");
  if (response.model !== options.request.model) codes.push("model_mismatch");
  if (response.idempotencyKey !== options.request.idempotencyKey) {
    codes.push("idempotency_key_mismatch");
  }

  if (!isArrayOnlyGraphOutput(response.output)) codes.push("output_schema_mismatch");

  const inputTokens = safeInteger(responseField(response, "usage", "inputTokens"));
  const outputTokens = safeInteger(responseField(response, "usage", "outputTokens"));
  const totalTokens = safeInteger(responseField(response, "usage", "totalTokens"));
  if (inputTokens < 0 || outputTokens < 0 || totalTokens < 0) {
    codes.push("usage_schema_mismatch");
  } else if (inputTokens + outputTokens !== totalTokens) {
    codes.push("usage_total_mismatch");
  }

  const costAmount = safeMoney(responseField(response, "cost", "amount"));
  if (responseField(response, "cost", "currency") !== "USD" || costAmount < 0) {
    codes.push("cost_schema_mismatch");
  } else if (remainingBudgetUsd !== null && costAmount > remainingBudgetUsd) {
    codes.push("response_cost_exceeds_remaining_budget");
  }

  return codes;
}

function isArrayOnlyGraphOutput(output: unknown): boolean {
  if (!isRecord(output)) return false;
  const keys = Object.keys(output).sort();
  if (keys.join(",") !== "account_objects,claims,excerpts") return false;
  return Array.isArray(output.excerpts) && Array.isArray(output.claims) && Array.isArray(output.account_objects);
}

function createLedgerEntry(
  options: ValidateModelProviderCompatibilityOptions,
  status: "succeeded" | "failed" | "refused",
  inputTokens: number,
  outputTokens: number,
  estimatedCostUsd: number,
  observedCostUsd: number,
  error: string | null,
): ModelCostLedgerEntry {
  return createModelCostLedgerEntry({
    ledgerEntryId: `${options.runId}_${options.stage}_${status}`,
    approvalId: options.approval?.approval_id ?? "no_approval",
    runId: options.runId,
    provider: options.providerName,
    model: options.request.model,
    accountRef: options.accountRef,
    stage: options.stage,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    observedCostUsd,
    status,
    retryCount: 0,
    error,
    recordedAt: options.now,
  });
}

function passedCheck(name: ModelProviderValidationCheckName): ModelProviderValidationCheck {
  return Object.freeze({ name, ok: true, codes: Object.freeze([]) });
}

function failedCheck(
  name: ModelProviderValidationCheckName,
  codes: readonly string[],
): ModelProviderValidationCheck {
  return Object.freeze({ name, ok: false, codes: Object.freeze([...codes]) });
}

function freezeReport(
  ok: boolean,
  checks: readonly ModelProviderValidationCheck[],
  call: ModelProviderValidationCallSummary,
  costLedgerEntry: ModelCostLedgerEntry | null,
): ModelProviderValidationReport {
  return Object.freeze({
    ok,
    checks: Object.freeze([...checks]),
    call,
    cost_ledger_entry: costLedgerEntry,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseField(response: unknown, parent: string, child: string): unknown {
  try {
    if (!isRecord(response)) return undefined;
    const nested = response[parent];
    return isRecord(nested) ? nested[child] : undefined;
  } catch {
    return undefined;
  }
}

function safeInteger(value: unknown): number {
  return Number.isInteger(value) ? (value as number) : -1;
}

function safeMoney(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function ledgerInteger(value: unknown): number {
  const integer = safeInteger(value);
  return integer >= 0 ? integer : 0;
}

function ledgerMoney(value: unknown): number {
  const money = safeMoney(value);
  return money >= 0 ? money : 0;
}

function assertSafeLogicalId(field: string, value: string): void {
  if (
    value.trim() !== value ||
    !SAFE_LOGICAL_ID.test(value) ||
    value.includes("://") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(`${field} must be a safe logical id`);
  }
}

function assertOutOfRepoCorpusRef(field: string, value: string): void {
  if (
    value.trim() !== value ||
    !SAFE_RELATIVE_REF_WITH_FRAGMENT.test(value) ||
    !value.startsWith("external-corpus/") ||
    value.includes("..") ||
    value.startsWith("/") ||
    value.includes("://") ||
    value.includes("\\")
  ) {
    throw new Error(`${field} must be an explicit out-of-repo relative reference`);
  }
}
