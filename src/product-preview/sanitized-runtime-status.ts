// Sanitized product-preview runtime status helpers.
//
// These helpers consume only public-safe status/plan metadata. They never read
// process.env, perform network access, call a provider, inspect private evidence,
// or authorize follow-up execution.

export type ProductPreviewStatus = "completed" | "exception" | "blocked";
export type ProductPreviewNextLane =
  | "no-spend-provider-comparison"
  | "runtime-model-mode-smoke-approval"
  | "stop-live-validation";

export interface ProductPreviewOutputCounts {
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface ProductPreviewSlotStatus {
  readonly role: string;
  readonly status: ProductPreviewStatus;
  readonly provider_calls_executed: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly output_counts: ProductPreviewOutputCounts;
}

export interface ProductPreviewExecutionStatus {
  readonly status_ref: string;
  readonly status: ProductPreviewStatus;
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly transport_kind: string;
  readonly corpus_ref: string;
  readonly provider_calls_executed: number;
  readonly approved_max_provider_calls: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly observed_cost_usd: number;
  readonly approved_max_cost_usd: number;
  readonly input_tokens_observed: number;
  readonly output_tokens_observed: number;
  readonly output_counts: ProductPreviewOutputCounts;
  readonly slot_statuses: readonly ProductPreviewSlotStatus[];
  readonly boundaries: {
    readonly raw_private_evidence_read: false;
    readonly raw_or_model_output_committed: false;
    readonly provider_comparison_performed: false;
    readonly graph_ingestion_performed: false;
    readonly runtime_model_mode_integration: false;
    readonly production_writes: false;
    readonly readiness_claim: false;
    readonly default_model_selection_claim: false;
    readonly provider_lock_in: false;
    readonly authorizes_provider_call: false;
  };
}

export interface ProductPreviewPlanInput {
  readonly job_id: string;
  readonly approval_ref: string;
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly transport_kind: string;
  readonly corpus_ref: string;
  readonly prompt_contract_ref: string;
  readonly max_provider_calls: number;
  readonly max_cost_usd: number;
  readonly slot_roles: readonly string[];
  readonly runtime_mode: "model-only-smoke" | "product-preview-expansion";
}

export interface ProductPreviewDryRunPlan extends ProductPreviewPlanInput {
  readonly dry_run: true;
  readonly provider_calls_executed: 0;
  readonly provider_spend_authorized_by_plan: false;
  readonly raw_private_evidence_read: false;
  readonly network_access_performed: false;
  readonly authorizes_provider_call: false;
  readonly boundary: {
    readonly tools: false;
    readonly shell: false;
    readonly file_access: false;
    readonly web_search: false;
    readonly plugins: false;
    readonly mcp: false;
    readonly retrieval: false;
    readonly graph_ingestion: false;
    readonly production_writes: false;
    readonly background_orchestrator: false;
  };
}

export interface ProductPreviewComparisonInput {
  readonly comparison_ref: string;
  readonly baseline: ProductPreviewExecutionStatus;
  readonly candidate: ProductPreviewExecutionStatus;
}

export interface ProductPreviewSanitizedComparison {
  readonly comparison_ref: string;
  readonly status: "pass" | "fail";
  readonly classification:
    | "candidate-contract-valid-lower-scope"
    | "candidate-contract-valid-comparable-scope"
    | "baseline-stronger-sanitized-scope"
    | "not-comparable";
  readonly baseline_status_ref: string;
  readonly candidate_status_ref: string;
  readonly deltas: {
    readonly provider_calls_executed: number;
    readonly excerpts: number;
    readonly claims: number;
    readonly account_objects: number;
    readonly input_tokens_observed: number;
    readonly output_tokens_observed: number;
    readonly observed_cost_usd: number;
  };
  readonly recommended_next_lane: ProductPreviewNextLane;
  readonly reasons: readonly string[];
  readonly authorizes_provider_call: false;
  readonly authorizes_default_model_selection: false;
  readonly provider_lock_in: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly safety: {
    readonly provider_call: false;
    readonly provider_spend: false;
    readonly raw_private_evidence_read: false;
    readonly network_access: false;
    readonly graph_ingestion: false;
    readonly production_writes: false;
    readonly runtime_model_mode_integration: false;
  };
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,160}$/;
const SAFE_ROLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

const FALSE_BOUNDARIES = Object.freeze({
  raw_private_evidence_read: false,
  raw_or_model_output_committed: false,
  provider_comparison_performed: false,
  graph_ingestion_performed: false,
  runtime_model_mode_integration: false,
  production_writes: false,
  readiness_claim: false,
  default_model_selection_claim: false,
  provider_lock_in: false,
  authorizes_provider_call: false,
} as const);

const DRY_RUN_BOUNDARY = Object.freeze({
  tools: false,
  shell: false,
  file_access: false,
  web_search: false,
  plugins: false,
  mcp: false,
  retrieval: false,
  graph_ingestion: false,
  production_writes: false,
  background_orchestrator: false,
} as const);

const COMPARISON_SAFETY = Object.freeze({
  provider_call: false,
  provider_spend: false,
  raw_private_evidence_read: false,
  network_access: false,
  graph_ingestion: false,
  production_writes: false,
  runtime_model_mode_integration: false,
} as const);

export function validateSanitizedProductPreviewStatus(input: unknown): ProductPreviewExecutionStatus {
  const record = snapshotRecord(input, "product-preview status");
  assertExactKeys(record, "product-preview status", [
    "status_ref",
    "status",
    "route_ref",
    "provider_ref",
    "model_label",
    "transport_kind",
    "corpus_ref",
    "provider_calls_executed",
    "approved_max_provider_calls",
    "accepted_output_received",
    "v2_contract_validated",
    "observed_cost_usd",
    "approved_max_cost_usd",
    "input_tokens_observed",
    "output_tokens_observed",
    "output_counts",
    "slot_statuses",
    "boundaries",
  ]);
  const status = readStatus(record, "status", ["completed", "exception", "blocked"] as const);
  const slotStatuses = readArray(record, "slot_statuses", "product-preview status").map(readSlotStatus);
  const providerCalls = readNonNegativeInteger(record, "provider_calls_executed", "product-preview status");
  const statusOut = Object.freeze({
    status_ref: readSafe(record, "status_ref", SAFE_REF, "status_ref"),
    status,
    route_ref: readSafe(record, "route_ref", SAFE_REF, "route_ref"),
    provider_ref: readSafe(record, "provider_ref", SAFE_REF, "provider_ref"),
    model_label: readSafe(record, "model_label", SAFE_REF, "model_label"),
    transport_kind: readSafe(record, "transport_kind", SAFE_REF, "transport_kind"),
    corpus_ref: readSafe(record, "corpus_ref", SAFE_REF, "corpus_ref"),
    provider_calls_executed: providerCalls,
    approved_max_provider_calls: readNonNegativeInteger(record, "approved_max_provider_calls", "product-preview status"),
    accepted_output_received: readBoolean(record, "accepted_output_received", "product-preview status"),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", "product-preview status"),
    observed_cost_usd: readNonNegativeNumber(record, "observed_cost_usd", "product-preview status"),
    approved_max_cost_usd: readNonNegativeNumber(record, "approved_max_cost_usd", "product-preview status"),
    input_tokens_observed: readNonNegativeInteger(record, "input_tokens_observed", "product-preview status"),
    output_tokens_observed: readNonNegativeInteger(record, "output_tokens_observed", "product-preview status"),
    output_counts: readOutputCounts(readRecord(record, "output_counts", "product-preview status")),
    slot_statuses: Object.freeze(slotStatuses),
    boundaries: readFalseBoundaries(readRecord(record, "boundaries", "product-preview status")),
  } satisfies ProductPreviewExecutionStatus);
  const slotCallSum = statusOut.slot_statuses.reduce((sum, slot) => sum + slot.provider_calls_executed, 0);
  if (slotCallSum !== statusOut.provider_calls_executed) throw new Error("slot provider call sum mismatch");
  if (statusOut.provider_calls_executed > statusOut.approved_max_provider_calls) throw new Error("provider calls exceed approval");
  if (statusOut.observed_cost_usd > statusOut.approved_max_cost_usd) throw new Error("observed cost exceeds approval");
  if (statusOut.status === "completed" && (!statusOut.accepted_output_received || !statusOut.v2_contract_validated)) {
    throw new Error("completed status must have accepted output and v2 contract validation");
  }
  return statusOut;
}

export function compareSanitizedProductPreviewStatuses(input: ProductPreviewComparisonInput): ProductPreviewSanitizedComparison {
  const record = snapshotRecord(input, "product-preview comparison");
  assertExactKeys(record, "product-preview comparison", ["comparison_ref", "baseline", "candidate"]);
  const comparisonRef = readSafe(record, "comparison_ref", SAFE_REF, "comparison_ref");
  const baseline = validateSanitizedProductPreviewStatus(readOwnDataField(record, "baseline", "product-preview comparison"));
  const candidate = validateSanitizedProductPreviewStatus(readOwnDataField(record, "candidate", "product-preview comparison"));
  const complete = baseline.status === "completed" && candidate.status === "completed" && baseline.v2_contract_validated && candidate.v2_contract_validated;
  const deltas = Object.freeze({
    provider_calls_executed: candidate.provider_calls_executed - baseline.provider_calls_executed,
    excerpts: candidate.output_counts.excerpts - baseline.output_counts.excerpts,
    claims: candidate.output_counts.claims - baseline.output_counts.claims,
    account_objects: candidate.output_counts.account_objects - baseline.output_counts.account_objects,
    input_tokens_observed: candidate.input_tokens_observed - baseline.input_tokens_observed,
    output_tokens_observed: candidate.output_tokens_observed - baseline.output_tokens_observed,
    observed_cost_usd: roundMoney(candidate.observed_cost_usd - baseline.observed_cost_usd),
  });
  const candidateLowerScope = candidate.provider_calls_executed < baseline.provider_calls_executed;
  const classification = !complete
    ? "not-comparable"
    : candidateLowerScope
      ? "candidate-contract-valid-lower-scope"
      : deltas.excerpts >= 0 && deltas.claims >= 0 && deltas.account_objects >= 0
        ? "candidate-contract-valid-comparable-scope"
        : "baseline-stronger-sanitized-scope";
  const status = complete ? "pass" : "fail";
  return Object.freeze({
    comparison_ref: comparisonRef,
    status,
    classification,
    baseline_status_ref: baseline.status_ref,
    candidate_status_ref: candidate.status_ref,
    deltas,
    recommended_next_lane: complete ? "runtime-model-mode-smoke-approval" : "stop-live-validation",
    reasons: Object.freeze(
      complete
        ? [
            "both sides are completed sanitized contract-valid product-preview records",
            candidateLowerScope
              ? "candidate has lower provider-call scope, so this is not a full model quality comparison"
              : "candidate has comparable provider-call scope on sanitized records",
            "result does not select a default model, lock in a provider, or approve production use",
          ]
        : ["one or both sides are not completed contract-valid sanitized records"],
    ),
    authorizes_provider_call: false,
    authorizes_default_model_selection: false,
    provider_lock_in: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    launch_readiness_claim: false,
    safety: COMPARISON_SAFETY,
  });
}

export function buildProductPreviewDryRunPlan(input: ProductPreviewPlanInput): ProductPreviewDryRunPlan {
  const record = snapshotRecord(input, "product-preview dry-run plan");
  assertExactKeys(record, "product-preview dry-run plan", [
    "job_id",
    "approval_ref",
    "route_ref",
    "provider_ref",
    "model_label",
    "transport_kind",
    "corpus_ref",
    "prompt_contract_ref",
    "max_provider_calls",
    "max_cost_usd",
    "slot_roles",
    "runtime_mode",
  ]);
  const slotRoles = readArray(record, "slot_roles", "product-preview dry-run plan").map((role) => {
    if (typeof role !== "string" || !SAFE_ROLE.test(role)) throw new Error("slot_roles must be safe");
    return role;
  });
  if (slotRoles.length < 1 || slotRoles.length > 6) throw new Error("slot_roles length must be 1..6");
  const maxProviderCalls = readNonNegativeInteger(record, "max_provider_calls", "product-preview dry-run plan");
  if (maxProviderCalls < 1 || maxProviderCalls > slotRoles.length) throw new Error("max_provider_calls must be 1..slot_roles.length");
  const maxCostUsd = readNonNegativeNumber(record, "max_cost_usd", "product-preview dry-run plan");
  if (maxCostUsd <= 0 || maxCostUsd > 10) throw new Error("max_cost_usd must be > 0 and <= 10");
  const runtimeMode = readStatus(record, "runtime_mode", ["model-only-smoke", "product-preview-expansion"] as const);
  return Object.freeze({
    job_id: readSafe(record, "job_id", SAFE_REF, "job_id"),
    approval_ref: readSafe(record, "approval_ref", SAFE_REF, "approval_ref"),
    route_ref: readSafe(record, "route_ref", SAFE_REF, "route_ref"),
    provider_ref: readSafe(record, "provider_ref", SAFE_REF, "provider_ref"),
    model_label: readSafe(record, "model_label", SAFE_REF, "model_label"),
    transport_kind: readSafe(record, "transport_kind", SAFE_REF, "transport_kind"),
    corpus_ref: readSafe(record, "corpus_ref", SAFE_REF, "corpus_ref"),
    prompt_contract_ref: readSafe(record, "prompt_contract_ref", SAFE_REF, "prompt_contract_ref"),
    max_provider_calls: maxProviderCalls,
    max_cost_usd: maxCostUsd,
    slot_roles: Object.freeze(slotRoles),
    runtime_mode: runtimeMode,
    dry_run: true,
    provider_calls_executed: 0,
    provider_spend_authorized_by_plan: false,
    raw_private_evidence_read: false,
    network_access_performed: false,
    authorizes_provider_call: false,
    boundary: DRY_RUN_BOUNDARY,
  });
}

export function renderProductPreviewStatusMarkdown(statusInput: ProductPreviewExecutionStatus): string {
  const status = validateSanitizedProductPreviewStatus(statusInput);
  const lines = [
    `# Sanitized Product-Preview Status: ${status.status_ref}`,
    "",
    `- status: ${status.status}`,
    `- route_ref: ${status.route_ref}`,
    `- provider_ref: ${status.provider_ref}`,
    `- model_label: ${status.model_label}`,
    `- transport_kind: ${status.transport_kind}`,
    `- corpus_ref: ${status.corpus_ref}`,
    `- provider_calls_executed: ${status.provider_calls_executed}`,
    `- approved_max_provider_calls: ${status.approved_max_provider_calls}`,
    `- accepted_output_received: ${status.accepted_output_received}`,
    `- v2_contract_validated: ${status.v2_contract_validated}`,
    `- v2_excerpts: ${status.output_counts.excerpts}`,
    `- v2_claims: ${status.output_counts.claims}`,
    `- v2_account_objects: ${status.output_counts.account_objects}`,
    `- observed_cost_usd: ${status.observed_cost_usd}`,
    `- approved_max_cost_usd: ${status.approved_max_cost_usd}`,
    "",
    "## Boundaries",
    "",
    `- authorizes_provider_call: ${status.boundaries.authorizes_provider_call}`,
    `- default_model_selection_claim: ${status.boundaries.default_model_selection_claim}`,
    `- provider_lock_in: ${status.boundaries.provider_lock_in}`,
    `- graph_ingestion_performed: ${status.boundaries.graph_ingestion_performed}`,
    `- runtime_model_mode_integration: ${status.boundaries.runtime_model_mode_integration}`,
    `- production_writes: ${status.boundaries.production_writes}`,
  ];
  return `${lines.join("\n")}\n`;
}

function readSlotStatus(input: unknown): ProductPreviewSlotStatus {
  const record = snapshotRecord(input, "slot status");
  assertExactKeys(record, "slot status", [
    "role",
    "status",
    "provider_calls_executed",
    "accepted_output_received",
    "v2_contract_validated",
    "output_counts",
  ]);
  return Object.freeze({
    role: readSafe(record, "role", SAFE_ROLE, "role"),
    status: readStatus(record, "status", ["completed", "exception", "blocked"] as const),
    provider_calls_executed: readNonNegativeInteger(record, "provider_calls_executed", "slot status"),
    accepted_output_received: readBoolean(record, "accepted_output_received", "slot status"),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", "slot status"),
    output_counts: readOutputCounts(readRecord(record, "output_counts", "slot status")),
  });
}

function readOutputCounts(record: Record<string, unknown>): ProductPreviewOutputCounts {
  assertExactKeys(record, "output counts", ["excerpts", "claims", "account_objects"]);
  return Object.freeze({
    excerpts: readNonNegativeInteger(record, "excerpts", "output counts"),
    claims: readNonNegativeInteger(record, "claims", "output counts"),
    account_objects: readNonNegativeInteger(record, "account_objects", "output counts"),
  });
}

function readFalseBoundaries(record: Record<string, unknown>): ProductPreviewExecutionStatus["boundaries"] {
  assertExactKeys(record, "status boundaries", Object.keys(FALSE_BOUNDARIES));
  for (const key of Object.keys(FALSE_BOUNDARIES)) readFalse(record, key, "status boundaries");
  return FALSE_BOUNDARIES;
}

function snapshotRecord(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be a plain record`);
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) throw new Error(`${label} must be a plain record`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label} fields must be enumerable data properties`);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function assertExactKeys(record: Record<string, unknown>, label: string, keys: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unexpected keys`);
  }
}

function readOwnDataField(record: Record<string, unknown>, field: string, label: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, field)) throw new Error(`${label}.${field} is required`);
  return record[field];
}

function readRecord(record: Record<string, unknown>, field: string, label: string): Record<string, unknown> {
  return snapshotRecord(readOwnDataField(record, field, label), `${label}.${field}`);
}

function readArray(record: Record<string, unknown>, field: string, label: string): readonly unknown[] {
  const value = readOwnDataField(record, field, label);
  if (!Array.isArray(value)) throw new Error(`${label}.${field} must be an array`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label}.${field} must contain data elements`);
  }
  return Object.freeze([...value]);
}

function readSafe(record: Record<string, unknown>, field: string, pattern: RegExp, label: string): string {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${field} must be safe`);
  return value;
}

function readBoolean(record: Record<string, unknown>, field: string, label: string): boolean {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "boolean") throw new Error(`${label}.${field} must be boolean`);
  return value;
}

function readFalse(record: Record<string, unknown>, field: string, label: string): false {
  if (readBoolean(record, field, label) !== false) throw new Error(`${label}.${field} must be false`);
  return false;
}

function readStatus<const T extends readonly string[]>(record: Record<string, unknown>, field: string, allowed: T): T[number] {
  const value = readOwnDataField(record, field, field);
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${field} has invalid status`);
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, field: string, label: string): number {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value;
}

function readNonNegativeNumber(record: Record<string, unknown>, field: string, label: string): number {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label}.${field} must be a non-negative number`);
  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}
