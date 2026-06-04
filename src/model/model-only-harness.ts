import { parseRuntimeModelOnlyProofOutput } from "./runtime-model-only-live-proof-output-contract.js";

export type ModelOnlyHarnessBoundary = Readonly<{
  tools: boolean;
  shell: boolean;
  file_access: boolean;
  web_search: boolean;
  plugins: boolean;
  mcp: boolean;
  retrieval: boolean;
  session_carryover: boolean;
}>;

export type ModelOnlyHarnessJob = Readonly<{
  job_id: string;
  idempotency_key: string;
  approval_ref: string;
  route_ref: string;
  provider_ref: string;
  model_label: string;
  transport_kind: string;
  corpus_ref: string;
  prompt_contract_ref: string;
  max_attempts: number;
  approved_max_cost_usd: number;
  requested_output_contract: unknown;
  boundary: ModelOnlyHarnessBoundary;
}>;

export type ModelOnlyHarnessApproval = Readonly<{
  approval_ref: string;
  route_ref: string;
  provider_ref: string;
  model_label: string;
  transport_kind: string;
  corpus_ref: string;
  prompt_contract_ref: string;
  max_attempts: number;
  approved_max_cost_usd: number;
}>;

export type ModelOnlyHarnessTransportRequest = Readonly<{
  job_id: string;
  idempotency_key: string;
  approval_ref: string;
  route_ref: string;
  provider_ref: string;
  model_label: string;
  transport_kind: string;
  corpus_ref: string;
  prompt_contract_ref: string;
  output_contract_keys: readonly string[];
}>;

export type ModelOnlyHarnessTransportResult = Readonly<{
  output_text: string;
  input_tokens: number;
  output_tokens: number;
  observed_cost_usd: number;
}>;

export type ModelOnlyHarnessTransport = (
  request: ModelOnlyHarnessTransportRequest,
) => Promise<ModelOnlyHarnessTransportResult> | ModelOnlyHarnessTransportResult;

export type ModelOnlyHarnessStatusName = "completed" | "exception" | "rejected" | "blocked";

export type ModelOnlyHarnessStatus = Readonly<{
  status: ModelOnlyHarnessStatusName;
  reason_code: string;
  stable_error_code: string | null;
  job_id: string;
  approval_ref: string;
  route_ref: string;
  provider_ref: string;
  model_label: string;
  transport_kind: string;
  corpus_ref: string;
  prompt_contract_ref: string;
  provider_calls_executed: number;
  accepted_output_received: boolean;
  observed_cost_usd: number;
  approved_max_cost_usd: number;
  input_tokens_observed: number;
  output_tokens_observed: number;
  completed_at: string;
  authorizes_provider_call: false;
  authorizes_retry: false;
  default_model_selection_claim: false;
  provider_lock_in: false;
  production_readiness_claim: false;
  product_readiness_claim: false;
  launch_readiness_claim: false;
}>;

export type RunModelOnlyHarnessJobOptions = Readonly<{
  job: ModelOnlyHarnessJob;
  approval: ModelOnlyHarnessApproval;
  now: string;
  transport: ModelOnlyHarnessTransport;
}>;

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const OUTPUT_KEYS = ["account_objects", "claims", "excerpts"] as const;
const BOUNDARY_KEYS = [
  "file_access",
  "mcp",
  "plugins",
  "retrieval",
  "session_carryover",
  "shell",
  "tools",
  "web_search",
] as const;

function statusFor(
  job: ModelOnlyHarnessJob,
  now: string,
  status: ModelOnlyHarnessStatusName,
  stableErrorCode: string | null,
  providerCallsExecuted: number,
  acceptedOutputReceived: boolean,
  observedCostUsd = 0,
  inputTokensObserved = 0,
  outputTokensObserved = 0,
): ModelOnlyHarnessStatus {
  const reasonCode =
    status === "completed"
      ? "model_only_harness_completed"
      : status === "rejected"
        ? "model_only_harness_rejected"
        : status === "blocked"
          ? "model_only_harness_blocked"
          : "model_only_harness_exception";

  return Object.freeze({
    status,
    reason_code: reasonCode,
    stable_error_code: stableErrorCode,
    job_id: job.job_id,
    approval_ref: job.approval_ref,
    route_ref: job.route_ref,
    provider_ref: job.provider_ref,
    model_label: job.model_label,
    transport_kind: job.transport_kind,
    corpus_ref: job.corpus_ref,
    prompt_contract_ref: job.prompt_contract_ref,
    provider_calls_executed: providerCallsExecuted,
    accepted_output_received: acceptedOutputReceived,
    observed_cost_usd: observedCostUsd,
    approved_max_cost_usd: job.approved_max_cost_usd,
    input_tokens_observed: inputTokensObserved,
    output_tokens_observed: outputTokensObserved,
    completed_at: now,
    authorizes_provider_call: false,
    authorizes_retry: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    production_readiness_claim: false,
    product_readiness_claim: false,
    launch_readiness_claim: false,
  });
}

function isSafeId(value: string): boolean {
  return SAFE_ID.test(value) && !value.includes("--");
}

function isSafeRef(value: string): boolean {
  return SAFE_REF.test(value) && !value.includes("..") && !value.includes("://") && !value.startsWith("/");
}

function validateOutputContract(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== OUTPUT_KEYS.length || keys.some((key, index) => key !== OUTPUT_KEYS[index])) return false;
  return OUTPUT_KEYS.every((key) => Array.isArray(record[key]));
}

function validateJob(job: ModelOnlyHarnessJob, approval: ModelOnlyHarnessApproval): string | null {
  if (!isSafeId(job.job_id) || !isSafeId(job.idempotency_key)) return "unsafe_job_identifier";
  for (const value of [job.approval_ref, job.route_ref, job.provider_ref, job.model_label, job.transport_kind, job.corpus_ref, job.prompt_contract_ref]) {
    if (!isSafeRef(value)) return "unsafe_job_reference";
  }
  if (job.max_attempts !== 1 || approval.max_attempts !== 1) return "max_attempts_not_one";
  if (!Number.isFinite(job.approved_max_cost_usd) || job.approved_max_cost_usd <= 0) return "invalid_cost_cap";
  if (job.approved_max_cost_usd > approval.approved_max_cost_usd) return "approval_cost_cap_exceeded";
  for (const key of BOUNDARY_KEYS) {
    if (job.boundary[key] !== false) return "boundary_flag_open";
  }
  if (!validateOutputContract(job.requested_output_contract)) return "output_contract_invalid";
  for (const key of ["approval_ref", "route_ref", "provider_ref", "model_label", "transport_kind", "corpus_ref", "prompt_contract_ref"] as const) {
    if (job[key] !== approval[key]) return "approval_scope_mismatch";
  }
  return null;
}

function buildTransportRequest(job: ModelOnlyHarnessJob): ModelOnlyHarnessTransportRequest {
  return Object.freeze({
    job_id: job.job_id,
    idempotency_key: job.idempotency_key,
    approval_ref: job.approval_ref,
    route_ref: job.route_ref,
    provider_ref: job.provider_ref,
    model_label: job.model_label,
    transport_kind: job.transport_kind,
    corpus_ref: job.corpus_ref,
    prompt_contract_ref: job.prompt_contract_ref,
    output_contract_keys: Object.freeze([...OUTPUT_KEYS]),
  });
}

function validTransportResult(result: ModelOnlyHarnessTransportResult): boolean {
  return (
    typeof result.output_text === "string" &&
    Number.isFinite(result.input_tokens) &&
    result.input_tokens >= 0 &&
    Number.isFinite(result.output_tokens) &&
    result.output_tokens >= 0 &&
    Number.isFinite(result.observed_cost_usd) &&
    result.observed_cost_usd >= 0
  );
}

export async function runModelOnlyHarnessJob(options: RunModelOnlyHarnessJobOptions): Promise<ModelOnlyHarnessStatus> {
  const { job, approval, now, transport } = options;
  const rejectionCode = validateJob(job, approval);
  if (rejectionCode) return statusFor(job, now, "rejected", rejectionCode, 0, false);

  let providerCallsExecuted = 0;
  try {
    providerCallsExecuted = 1;
    const result = await transport(buildTransportRequest(job));
    if (!validTransportResult(result)) {
      return statusFor(job, now, "exception", "transport_result_invalid", providerCallsExecuted, false);
    }
    try {
      parseRuntimeModelOnlyProofOutput(result.output_text);
    } catch {
      return statusFor(job, now, "exception", "output_contract_failed", providerCallsExecuted, false);
    }
    if (result.observed_cost_usd > job.approved_max_cost_usd) {
      return statusFor(job, now, "exception", "observed_cost_exceeded_approval", providerCallsExecuted, false);
    }
    return statusFor(
      job,
      now,
      "completed",
      null,
      providerCallsExecuted,
      true,
      result.observed_cost_usd,
      result.input_tokens,
      result.output_tokens,
    );
  } catch {
    return statusFor(job, now, "exception", "transport_failed", providerCallsExecuted, false);
  }
}
