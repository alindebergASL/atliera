import {
  createModelCostLedgerEntry,
  evaluateModelActivationGates,
  type ModelActivationApproval,
  type ModelCostLedgerEntry,
} from "./activation-gates.ts";
import {
  getPromptContract,
  type PromptContractOperation,
  type PromptContractOutputRecordKind,
} from "../agent/prompt-contracts.ts";
import {
  createModelProviderRequest,
  assertSafeModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
} from "./provider.ts";

export type ModelProviderValidationCheckName =
  | "activation_gates"
  | "credential_status"
  | "provider_call"
  | "response_contract"
  | "prompt_contract_output"
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
  readonly promptContractOperation?: PromptContractOperation;
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

interface SnapshotGraphOutput {
  readonly excerpts: readonly unknown[];
  readonly claims: readonly unknown[];
  readonly account_objects: readonly unknown[];
}

interface SnapshotUsage {
  readonly inputTokens: unknown;
  readonly outputTokens: unknown;
  readonly totalTokens: unknown;
}

interface SnapshotCost {
  readonly currency: unknown;
  readonly amount: unknown;
}

interface SnapshotModelProviderResponse {
  readonly provider: unknown;
  readonly model: unknown;
  readonly idempotencyKey: unknown;
  readonly output: SnapshotGraphOutput | null;
  readonly usage: SnapshotUsage;
  readonly cost: SnapshotCost;
}

const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_REF_WITH_FRAGMENT = /^[A-Za-z0-9][A-Za-z0-9._/#-]{0,255}$/;
const CREDENTIAL_STATUSES: readonly ModelProviderValidationCredentialStatus[] = [
  "present",
  "missing",
  "invalid",
];
const MODEL_PROVIDER_PROMPT_CONTRACT_OPERATIONS: readonly PromptContractOperation[] = [
  "propose.excerpts",
  "propose.claims",
  "propose.account_objects",
];

export async function validateModelProviderCompatibility(
  options: ValidateModelProviderCompatibilityOptions,
): Promise<ModelProviderValidationReport> {
  const input = snapshotValidationOptions(options);
  validateHarnessInput(input);
  assertSafeModelProviderRequest(input.request);

  const checks: ModelProviderValidationCheck[] = [];
  const call = Object.freeze({
    provider: input.providerName,
    model: input.request.model,
    operation: input.request.operation,
    idempotency_key: input.request.idempotencyKey,
  });

  const activation = evaluateModelActivationGates({
    mode: input.request.mode,
    provider: input.providerName,
    model: input.request.model,
    corpusRef: input.corpusRef,
    approval: input.approval,
    costLedgerEntries: input.costLedgerEntries,
    nextEstimatedCostUsd: input.nextEstimatedCostUsd,
    now: input.now,
  });

  if (!activation.ok) {
    checks.push(failedCheck("activation_gates", activation.refusal_reasons));
    const ledger = createLedgerEntry(input, "refused", 0, 0, 0, 0, "activation_refused");
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("activation_gates"));

  if (input.credentialStatus !== "present") {
    const code = input.credentialStatus === "missing" ? "credential_missing" : "credential_invalid";
    checks.push(failedCheck("credential_status", [code]));
    const ledger = createLedgerEntry(input, "refused", 0, 0, 0, 0, code);
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("credential_status"));

  let response: unknown;
  try {
    response = await input.provider.generate(input.request);
  } catch {
    checks.push(failedCheck("provider_call", ["provider_call_failed"]));
    const ledger = createLedgerEntry(
      input,
      "failed",
      0,
      0,
      input.nextEstimatedCostUsd,
      0,
      "provider_call_failed",
    );
    checks.push(passedCheck("cost_ledger_entry"));
    return freezeReport(false, checks, call, ledger);
  }
  checks.push(passedCheck("provider_call"));

  const snapshot = snapshotModelProviderResponse(response);
  const responseCodes = snapshot === null
    ? ["response_schema_mismatch"]
    : validateResponse(snapshot, input, activation.remaining_budget_usd);
  checks.push(
    responseCodes.length === 0
      ? passedCheck("response_contract")
      : failedCheck("response_contract", responseCodes),
  );

  let promptContractCodes: string[] = [];
  if (responseCodes.length === 0 && input.promptContractOperation !== undefined) {
    promptContractCodes = validatePromptContractOutput(
      snapshot,
      input.promptContractOperation,
    );
    checks.push(
      promptContractCodes.length === 0
        ? passedCheck("prompt_contract_output")
        : failedCheck("prompt_contract_output", promptContractCodes),
    );
  }

  const status = responseCodes.length === 0 && promptContractCodes.length === 0 ? "succeeded" : "failed";
  const error = status === "succeeded"
    ? null
    : responseCodes.length > 0
      ? "response_contract_failed"
      : "prompt_contract_output_failed";
  const ledger = createLedgerEntry(
    input,
    status,
    ledgerInteger(snapshot?.usage.inputTokens),
    ledgerInteger(snapshot?.usage.outputTokens),
    input.nextEstimatedCostUsd,
    ledgerMoney(snapshot?.cost.amount),
    error,
  );
  checks.push(passedCheck("cost_ledger_entry"));
  return freezeReport(responseCodes.length === 0 && promptContractCodes.length === 0, checks, call, ledger);
}

function snapshotValidationOptions(
  options: ValidateModelProviderCompatibilityOptions,
): ValidateModelProviderCompatibilityOptions {
  try {
    const provider = options.provider;
    const request = options.request;
    const providerName = options.providerName;
    const approval = options.approval;
    const costLedgerEntries = options.costLedgerEntries;
    const corpusRef = options.corpusRef;
    const nextEstimatedCostUsd = options.nextEstimatedCostUsd;
    const credentialStatus = options.credentialStatus;
    const promptContractOperation = options.promptContractOperation;
    const runId = options.runId;
    const accountRef = options.accountRef;
    const stage = options.stage;
    const now = options.now;

    return Object.freeze({
      provider,
      request: freezeModelProviderRequest(createModelProviderRequest(request)),
      providerName,
      approval: approval === null ? null : snapshotValidationApproval(approval),
      costLedgerEntries: Object.freeze([...costLedgerEntries]),
      corpusRef,
      nextEstimatedCostUsd,
      credentialStatus,
      promptContractOperation,
      runId,
      accountRef,
      stage,
      now,
    });
  } catch {
    throw new Error("model provider validation options must be a plain data object");
  }
}

function snapshotValidationApproval(approval: ModelActivationApproval): ModelActivationApproval {
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

function freezeModelProviderRequest(request: ModelProviderRequest): ModelProviderRequest {
  const metadata = Object.freeze({ ...request.metadata });
  return Object.freeze({
    operation: request.operation,
    mode: request.mode,
    model: request.model,
    prompt: request.prompt,
    inputGraphRef: request.inputGraphRef,
    idempotencyKey: request.idempotencyKey,
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    metadata,
  });
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
  if (options.promptContractOperation !== undefined) {
    if (!MODEL_PROVIDER_PROMPT_CONTRACT_OPERATIONS.includes(options.promptContractOperation)) {
      throw new Error(
        "prompt contract operation is not supported for model provider graph proposal validation",
      );
    }
    getPromptContract(options.promptContractOperation);
  }
}

function validateResponse(
  response: SnapshotModelProviderResponse,
  options: ValidateModelProviderCompatibilityOptions,
  remainingBudgetUsd: number | null,
): string[] {
  const codes: string[] = [];
  if (response.provider !== options.providerName) codes.push("provider_mismatch");
  if (response.model !== options.request.model) codes.push("model_mismatch");
  if (response.idempotencyKey !== options.request.idempotencyKey) {
    codes.push("idempotency_key_mismatch");
  }

  if (response.output === null) codes.push("output_schema_mismatch");

  const inputTokens = safeInteger(response.usage.inputTokens);
  const outputTokens = safeInteger(response.usage.outputTokens);
  const totalTokens = safeInteger(response.usage.totalTokens);
  if (inputTokens < 0 || outputTokens < 0 || totalTokens < 0) {
    codes.push("usage_schema_mismatch");
  } else if (inputTokens + outputTokens !== totalTokens) {
    codes.push("usage_total_mismatch");
  }

  const costAmount = safeMoney(response.cost.amount);
  if (response.cost.currency !== "USD" || costAmount < 0) {
    codes.push("cost_schema_mismatch");
  } else if (remainingBudgetUsd !== null && costAmount > remainingBudgetUsd) {
    codes.push("response_cost_exceeds_remaining_budget");
  }

  return codes;
}

function validatePromptContractOutput(
  response: SnapshotModelProviderResponse | null,
  operation: PromptContractOperation,
): string[] {
  const contract = getPromptContract(operation);
  const allowedKinds = new Set<PromptContractOutputRecordKind>(contract.allowed_output_record_kinds);
  const output = response?.output ?? null;
  if (output === null) return ["prompt_contract_output_schema_mismatch"];

  const outputKinds: Array<[key: keyof SnapshotGraphOutput, kind: PromptContractOutputRecordKind]> = [
    ["excerpts", "evidence_excerpt"],
    ["claims", "claim"],
    ["account_objects", "account_object"],
  ];
  for (const [key, kind] of outputKinds) {
    const records = output[key];
    if (records.length > 0 && !allowedKinds.has(kind)) {
      return ["prompt_contract_output_kind_not_allowed"];
    }
  }

  return [];
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

function snapshotModelProviderResponse(response: unknown): SnapshotModelProviderResponse | null {
  try {
    if (!isRecord(response)) return null;
    const provider = response.provider;
    const model = response.model;
    const idempotencyKey = response.idempotencyKey;
    const output = snapshotGraphOutput(response.output);
    const usage = snapshotUsage(response.usage);
    const cost = snapshotCost(response.cost);
    return Object.freeze({
      provider,
      model,
      idempotencyKey,
      output,
      usage,
      cost,
    });
  } catch {
    return null;
  }
}

function snapshotGraphOutput(output: unknown): SnapshotGraphOutput | null {
  try {
    if (!isRecord(output)) return null;
    const keys = Object.keys(output).sort();
    if (keys.join(",") !== "account_objects,claims,excerpts") return null;
    const excerpts = output.excerpts;
    const claims = output.claims;
    const accountObjects = output.account_objects;
    if (!Array.isArray(excerpts) || !Array.isArray(claims) || !Array.isArray(accountObjects)) {
      return null;
    }
    return Object.freeze({
      excerpts: Object.freeze([...excerpts]),
      claims: Object.freeze([...claims]),
      account_objects: Object.freeze([...accountObjects]),
    });
  } catch {
    return null;
  }
}

function snapshotUsage(usage: unknown): SnapshotUsage {
  try {
    if (!isRecord(usage)) return Object.freeze({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined });
    return Object.freeze({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    });
  } catch {
    return Object.freeze({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined });
  }
}

function snapshotCost(cost: unknown): SnapshotCost {
  try {
    if (!isRecord(cost)) return Object.freeze({ currency: undefined, amount: undefined });
    return Object.freeze({
      currency: cost.currency,
      amount: cost.amount,
    });
  } catch {
    return Object.freeze({ currency: undefined, amount: undefined });
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
