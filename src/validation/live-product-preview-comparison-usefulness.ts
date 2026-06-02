// Deterministic no-spend comparison usefulness assessment.
//
// Consumes already-produced, already-sanitized usefulness assessments and public
// aggregate token/cost facts. It performs no provider calls, no network access,
// no credential reads, no raw private-evidence reads, no production writes, and
// no runtime/model-mode integration. A positive result is only a bounded
// comparison signal; it never selects a default model or approves another run.

import type {
  LiveProductPreviewOutputCounts,
  LiveProductPreviewUsefulnessAssessment,
} from "./live-product-preview-usefulness.ts";

export type LiveProductPreviewComparisonUsefulnessClassification =
  | "candidate-comparable-useful"
  | "baseline-stronger-on-sanitized-facts"
  | "candidate-stronger-on-sanitized-facts"
  | "not-comparable";

export type LiveProductPreviewComparisonRecommendedNextStep =
  | "provider-neutral-runtime-integration-planning"
  | "remediate-before-runtime-integration-planning";

export interface LiveProductPreviewComparisonTokens {
  readonly input: number;
  readonly output: number;
}

export interface LiveProductPreviewComparisonSideInput {
  readonly label: "baseline" | "candidate";
  readonly provider_route: string;
  readonly model: string;
  readonly preview_ref: string;
  readonly assessment: LiveProductPreviewUsefulnessAssessment;
  readonly tokens: LiveProductPreviewComparisonTokens;
  readonly observed_cost_usd: number;
  readonly estimated_cost_usd: number;
}

export interface LiveProductPreviewComparisonUsefulnessInput {
  readonly comparison_ref: string;
  readonly baseline: LiveProductPreviewComparisonSideInput;
  readonly candidate: LiveProductPreviewComparisonSideInput;
}

export interface LiveProductPreviewComparisonSideSummary {
  readonly label: "baseline" | "candidate";
  readonly provider_route: string;
  readonly model: string;
  readonly preview_ref: string;
  readonly preview_usefulness_classification: string;
  readonly output_counts: LiveProductPreviewOutputCounts;
  readonly useful_lens_count: number;
  readonly useful_lenses: readonly string[];
  readonly tokens: LiveProductPreviewComparisonTokens;
  readonly observed_cost_usd: number;
  readonly estimated_cost_usd: number;
}

export interface LiveProductPreviewComparisonUsefulnessAssessment {
  readonly ok: boolean;
  readonly status: "pass" | "fail";
  readonly comparison_ref: string;
  readonly comparison_usefulness_classification: LiveProductPreviewComparisonUsefulnessClassification;
  readonly recommended_next_step: LiveProductPreviewComparisonRecommendedNextStep;
  readonly baseline: LiveProductPreviewComparisonSideSummary;
  readonly candidate: LiveProductPreviewComparisonSideSummary;
  readonly deltas: {
    readonly output_counts: LiveProductPreviewOutputCounts;
    readonly useful_lens_count: number;
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly observed_cost_usd: number;
    readonly estimated_cost_usd: number;
  };
  readonly reasons: readonly string[];
  readonly launch_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
  readonly approves_provider_call: false;
  readonly approves_expansion_or_comparison: false;
  readonly safety: {
    readonly live_provider_call: false;
    readonly provider_spend: false;
    readonly raw_private_evidence_read: false;
    readonly production_writes: false;
    readonly runtime_model_mode_integration: false;
    readonly provider_or_model_selection: false;
    readonly corpus_expansion: false;
    readonly product_preview_expansion: false;
    readonly web_search_or_tools: false;
  };
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const SAFETY = Object.freeze({
  live_provider_call: false,
  provider_spend: false,
  raw_private_evidence_read: false,
  production_writes: false,
  runtime_model_mode_integration: false,
  provider_or_model_selection: false,
  corpus_expansion: false,
  product_preview_expansion: false,
  web_search_or_tools: false,
} as const);

export function compareLiveProductPreviewProviderUsefulness(
  input: LiveProductPreviewComparisonUsefulnessInput,
): LiveProductPreviewComparisonUsefulnessAssessment {
  const record = snapshotInput(input);
  const comparisonRef = readSafeRef(record, "comparison_ref", "comparison_ref must be safe");
  const baseline = readSide(readRecord(record, "baseline", "comparison input"), "baseline", "baseline");
  const candidate = readSide(readRecord(record, "candidate", "comparison input"), "candidate", "candidate");

  const baselineSummary = summarizeSide(baseline);
  const candidateSummary = summarizeSide(candidate);
  const deltas = Object.freeze({
    output_counts: Object.freeze({
      excerpts: candidateSummary.output_counts.excerpts - baselineSummary.output_counts.excerpts,
      claims: candidateSummary.output_counts.claims - baselineSummary.output_counts.claims,
      account_objects: candidateSummary.output_counts.account_objects - baselineSummary.output_counts.account_objects,
    }),
    useful_lens_count: candidateSummary.useful_lens_count - baselineSummary.useful_lens_count,
    input_tokens: candidateSummary.tokens.input - baselineSummary.tokens.input,
    output_tokens: candidateSummary.tokens.output - baselineSummary.tokens.output,
    observed_cost_usd: roundMoney(candidateSummary.observed_cost_usd - baselineSummary.observed_cost_usd),
    estimated_cost_usd: roundMoney(candidateSummary.estimated_cost_usd - baselineSummary.estimated_cost_usd),
  });

  const failReasons = nonComparableReasons(baseline.assessment, candidate.assessment);
  if (failReasons.length > 0) {
    return Object.freeze({
      ok: false,
      status: "fail",
      comparison_ref: comparisonRef,
      comparison_usefulness_classification: "not-comparable",
      recommended_next_step: "remediate-before-runtime-integration-planning",
      baseline: baselineSummary,
      candidate: candidateSummary,
      deltas,
      reasons: Object.freeze(failReasons),
      launch_readiness_claim: false,
      product_readiness_claim: false,
      production_readiness_claim: false,
      default_model_selection_claim: false,
      provider_lock_in: false,
      approves_provider_call: false,
      approves_expansion_or_comparison: false,
      safety: SAFETY,
    });
  }

  return Object.freeze({
    ok: true,
    status: "pass",
    comparison_ref: comparisonRef,
    comparison_usefulness_classification: classifyComparable(deltas),
    recommended_next_step: "provider-neutral-runtime-integration-planning",
    baseline: baselineSummary,
    candidate: candidateSummary,
    deltas,
    reasons: Object.freeze([
      "candidate matched the baseline sanitized usefulness floor across six screened slots",
      "candidate matched baseline graph-supported Signals, Maps, and Plays counts",
      deltas.output_tokens < 0
        ? "candidate used fewer provider-reported output tokens in this bounded slice"
        : "candidate did not use fewer provider-reported output tokens in this bounded slice",
      "result is not a model-quality, readiness, lock-in, or default-selection claim",
    ]),
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    approves_provider_call: false,
    approves_expansion_or_comparison: false,
    safety: SAFETY,
  });
}

function classifyComparable(
  deltas: LiveProductPreviewComparisonUsefulnessAssessment["deltas"],
): LiveProductPreviewComparisonUsefulnessClassification {
  const outputDelta = deltas.output_counts.excerpts + deltas.output_counts.claims + deltas.output_counts.account_objects;
  if (outputDelta > 0 || deltas.useful_lens_count > 0) return "candidate-stronger-on-sanitized-facts";
  if (outputDelta < 0 || deltas.useful_lens_count < 0) return "baseline-stronger-on-sanitized-facts";
  return "candidate-comparable-useful";
}

function nonComparableReasons(
  baseline: LiveProductPreviewUsefulnessAssessment,
  candidate: LiveProductPreviewUsefulnessAssessment,
): string[] {
  const reasons: string[] = [];
  if (!isPassingUsefulAssessment(baseline)) reasons.push("baseline assessment is not passing useful");
  if (!isPassingUsefulAssessment(candidate)) reasons.push("candidate assessment is not passing useful");
  return reasons;
}

function isPassingUsefulAssessment(assessment: LiveProductPreviewUsefulnessAssessment): boolean {
  return assessment.ok === true && assessment.status === "pass" && assessment.preview_usefulness_classification === "useful";
}

function summarizeSide(side: LiveProductPreviewComparisonSideInput): LiveProductPreviewComparisonSideSummary {
  return Object.freeze({
    label: side.label,
    provider_route: side.provider_route,
    model: side.model,
    preview_ref: side.preview_ref,
    preview_usefulness_classification: side.assessment.preview_usefulness_classification,
    output_counts: Object.freeze({ ...side.assessment.metrics.output_counts }),
    useful_lens_count: side.assessment.metrics.useful_lens_count,
    useful_lenses: Object.freeze([...side.assessment.metrics.useful_lenses]),
    tokens: Object.freeze({ ...side.tokens }),
    observed_cost_usd: side.observed_cost_usd,
    estimated_cost_usd: side.estimated_cost_usd,
  });
}

function snapshotInput(input: unknown): Record<string, unknown> {
  try {
    assertPlainRecord(input, "comparison input");
    assertExactOwnEnumerableDataKeys(input, "comparison input", ["comparison_ref", "baseline", "candidate"]);
    return input;
  } catch {
    throw new Error("invalid comparison input");
  }
}

function readSide(
  record: Record<string, unknown>,
  expectedLabel: "baseline" | "candidate",
  label: "baseline" | "candidate",
): LiveProductPreviewComparisonSideInput {
  try {
    assertExactOwnEnumerableDataKeys(record, `${label} comparison input`, [
      "label",
      "provider_route",
      "model",
      "preview_ref",
      "assessment",
      "tokens",
      "observed_cost_usd",
      "estimated_cost_usd",
    ]);
    const sideLabel = readString(record, "label", `${label} comparison input`);
    if (sideLabel !== expectedLabel) throw new Error(`${label} label rejected`);
    const providerRoute = readSafeRef(record, "provider_route", "provider_route must be safe");
    const model = readSafeRef(record, "model", "model must be safe");
    const previewRef = readSafeRef(record, "preview_ref", "preview_ref must be safe");
    const assessment = readAssessment(record, "assessment", `${label} comparison input`, previewRef);
    const tokens = readTokens(readRecord(record, "tokens", `${label} comparison input`));
    return Object.freeze({
      label: expectedLabel,
      provider_route: providerRoute,
      model,
      preview_ref: previewRef,
      assessment,
      tokens,
      observed_cost_usd: readNonNegativeNumber(record, "observed_cost_usd", `${label} comparison input`),
      estimated_cost_usd: readNonNegativeNumber(record, "estimated_cost_usd", `${label} comparison input`),
    });
  } catch (error) {
    if (error instanceof Error && /must be safe/.test(error.message)) throw error;
    throw new Error(`invalid ${label} comparison input`);
  }
}

function readAssessment(
  record: Record<string, unknown>,
  field: string,
  label: string,
  expectedPreviewRef: string,
): LiveProductPreviewUsefulnessAssessment {
  const value = readOwnDataField(record, field, label);
  assertPlainRecord(value, `${label}.${field}`);
  assertExactOwnEnumerableDataKeys(value, `${label}.${field}`, [
    "ok",
    "status",
    "preview_ref",
    "preview_usefulness_classification",
    "launch_readiness_claim",
    "product_readiness_claim",
    "production_readiness_claim",
    "approves_expansion_or_comparison",
    "metrics",
    "reasons",
    "safety",
  ]);

  const previewRef = readSafeRef(value, "preview_ref", "preview_ref must be safe");
  if (previewRef !== expectedPreviewRef) {
    throw new Error("assessment preview_ref must match side preview_ref");
  }
  const assessment = Object.freeze({
    ok: readBoolean(value, "ok", `${label}.${field}`),
    status: readStatus(value, "status", `${label}.${field}`, ["pass", "fail"] as const),
    preview_ref: previewRef,
    preview_usefulness_classification: readStatus(value, "preview_usefulness_classification", `${label}.${field}`, [
      "useful",
      "weak-but-valid",
      "zero-output",
      "contract-failure",
    ] as const),
    launch_readiness_claim: readFalse(value, "launch_readiness_claim", `${label}.${field}`),
    product_readiness_claim: readFalse(value, "product_readiness_claim", `${label}.${field}`),
    production_readiness_claim: readFalse(value, "production_readiness_claim", `${label}.${field}`),
    approves_expansion_or_comparison: readFalse(value, "approves_expansion_or_comparison", `${label}.${field}`),
    metrics: readUsefulnessMetrics(readRecord(value, "metrics", `${label}.${field}`)),
    reasons: readReasons(readOwnDataField(value, "reasons", `${label}.${field}`)),
    safety: readUsefulnessSafety(readRecord(value, "safety", `${label}.${field}`)),
  } satisfies LiveProductPreviewUsefulnessAssessment);
  if (assessment.ok !== (assessment.status === "pass")) {
    throw new Error("assessment ok/status mismatch");
  }
  if (assessment.ok && assessment.preview_usefulness_classification !== "useful") {
    throw new Error("passing assessment must be useful");
  }
  return assessment;
}

function readUsefulnessMetrics(record: Record<string, unknown>): LiveProductPreviewUsefulnessAssessment["metrics"] {
  const hasSlotOutputCounts = hasOwnDataField(record, "slot_output_counts", "metrics");
  assertExactOwnEnumerableDataKeys(record, "metrics", hasSlotOutputCounts
    ? ["account_count", "provider_calls_executed", "output_counts", "slot_output_counts", "useful_lens_count", "useful_lenses"]
    : ["account_count", "provider_calls_executed", "output_counts", "useful_lens_count", "useful_lenses"]);
  const metrics = {
    account_count: readNonNegativeInteger(record, "account_count", "metrics"),
    provider_calls_executed: readNonNegativeInteger(record, "provider_calls_executed", "metrics"),
    output_counts: readOutputCounts(readRecord(record, "output_counts", "metrics")),
    ...(hasSlotOutputCounts ? { slot_output_counts: readSlotOutputCounts(readOwnDataField(record, "slot_output_counts", "metrics")) } : {}),
    useful_lens_count: readNonNegativeInteger(record, "useful_lens_count", "metrics"),
    useful_lenses: readUsefulLenses(readOwnDataField(record, "useful_lenses", "metrics")),
  } satisfies LiveProductPreviewUsefulnessAssessment["metrics"];
  if (metrics.provider_calls_executed !== metrics.account_count) {
    throw new Error("assessment metrics provider_calls_executed must equal account_count");
  }
  if (metrics.useful_lens_count !== metrics.useful_lenses.length) {
    throw new Error("assessment useful_lens_count must match useful_lenses length");
  }
  if (metrics.slot_output_counts !== undefined && metrics.slot_output_counts.length !== metrics.account_count) {
    throw new Error("assessment slot_output_counts must match account_count");
  }
  return Object.freeze(metrics);
}

function readOutputCounts(record: Record<string, unknown>): LiveProductPreviewOutputCounts {
  assertExactOwnEnumerableDataKeys(record, "output_counts", ["excerpts", "claims", "account_objects"]);
  return Object.freeze({
    excerpts: readNonNegativeInteger(record, "excerpts", "output_counts"),
    claims: readNonNegativeInteger(record, "claims", "output_counts"),
    account_objects: readNonNegativeInteger(record, "account_objects", "output_counts"),
  });
}

function readSlotOutputCounts(value: unknown): NonNullable<LiveProductPreviewUsefulnessAssessment["metrics"]["slot_output_counts"]> {
  const elements = readSafeArray(value, "slot_output_counts");
  const seen = new Set<string>();
  return Object.freeze(elements.map((element) => {
    assertPlainRecord(element, "slot_output_counts entry");
    assertExactOwnEnumerableDataKeys(element, "slot_output_counts entry", ["role", "output_counts"]);
    const role = readString(element, "role", "slot_output_counts entry");
    if (seen.has(role)) throw new Error("slot_output_counts must contain distinct roles");
    seen.add(role);
    return Object.freeze({ role: role as never, output_counts: readOutputCounts(readRecord(element, "output_counts", "slot_output_counts entry")) });
  }));
}

function readUsefulLenses(value: unknown): readonly ("signals" | "maps" | "plays")[] {
  const elements = readSafeArray(value, "useful_lenses");
  const seen = new Set<string>();
  return Object.freeze(elements.map((element) => {
    if (typeof element !== "string" || !["signals", "maps", "plays"].includes(element)) {
      throw new Error("useful_lenses contains unsupported lens");
    }
    if (seen.has(element)) throw new Error("useful_lenses must contain distinct lenses");
    seen.add(element);
    return element as "signals" | "maps" | "plays";
  }));
}

function readReasons(value: unknown): LiveProductPreviewUsefulnessAssessment["reasons"] {
  const elements = readSafeArray(value, "reasons");
  return Object.freeze(elements.map((element) => {
    assertPlainRecord(element, "reason");
    assertExactOwnEnumerableDataKeys(element, "reason", ["code", "severity", "message", "observed", "threshold"]);
    return Object.freeze({
      code: readString(element, "code", "reason") as never,
      severity: readStatus(element, "severity", "reason", ["pass", "fail"] as const),
      message: readString(element, "message", "reason"),
      observed: readNonNegativeInteger(element, "observed", "reason"),
      threshold: readNonNegativeInteger(element, "threshold", "reason"),
    });
  }));
}

function readUsefulnessSafety(record: Record<string, unknown>): LiveProductPreviewUsefulnessAssessment["safety"] {
  assertExactOwnEnumerableDataKeys(record, "assessment safety", [
    "live_provider_call",
    "provider_spend",
    "production_writes",
    "runtime_model_mode_integration",
    "provider_or_model_comparison",
    "corpus_expansion",
    "product_preview_expansion",
    "web_search_or_tools",
  ]);
  return Object.freeze({
    live_provider_call: readFalse(record, "live_provider_call", "assessment safety"),
    provider_spend: readFalse(record, "provider_spend", "assessment safety"),
    production_writes: readFalse(record, "production_writes", "assessment safety"),
    runtime_model_mode_integration: readFalse(record, "runtime_model_mode_integration", "assessment safety"),
    provider_or_model_comparison: readFalse(record, "provider_or_model_comparison", "assessment safety"),
    corpus_expansion: readFalse(record, "corpus_expansion", "assessment safety"),
    product_preview_expansion: readFalse(record, "product_preview_expansion", "assessment safety"),
    web_search_or_tools: readFalse(record, "web_search_or_tools", "assessment safety"),
  });
}

function readSafeArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (symbols.length > 0) throw new Error(`invalid ${label}`);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
    throw new Error(`invalid ${label}`);
  }
  const length = lengthDescriptor.value as number;
  const allowed = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  for (const name of names) {
    if (!allowed.has(name)) throw new Error(`invalid ${label}`);
    if (name !== "length") {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error(`invalid ${label}`);
    }
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error(`invalid ${label}`);
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function readTokens(record: Record<string, unknown>): LiveProductPreviewComparisonTokens {
  assertExactOwnEnumerableDataKeys(record, "tokens", ["input", "output"]);
  return Object.freeze({
    input: readNonNegativeInteger(record, "input", "tokens"),
    output: readNonNegativeInteger(record, "output", "tokens"),
  });
}

function readSafeRef(record: Record<string, unknown>, field: string, errorMessage: string): string {
  const value = readString(record, field, "comparison input");
  if (!SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.includes("/") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    throw new Error(errorMessage);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, field: string, label: string): boolean {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

function readFalse(record: Record<string, unknown>, field: string, label: string): false {
  const value = readBoolean(record, field, label);
  if (value !== false) {
    throw new Error(`${label}.${field} must be false`);
  }
  return false;
}

function readStatus<T extends string>(
  record: Record<string, unknown>,
  field: string,
  label: string,
  allowed: readonly T[],
): T {
  const value = readString(record, field, label);
  if (!allowed.includes(value as T)) {
    throw new Error(`${label}.${field} has unsupported status`);
  }
  return value as T;
}

function hasOwnDataField(record: Record<string, unknown>, field: string, label: string): boolean {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (descriptor === undefined) return false;
  if (!("value" in descriptor) || !descriptor.enumerable) {
    throw new Error(`${label}.${field} must be an enumerable own data field`);
  }
  return true;
}

function readNonNegativeInteger(record: Record<string, unknown>, field: string, label: string): number {
  const value = readOwnDataField(record, field, label);
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value as number;
}

function readNonNegativeNumber(record: Record<string, unknown>, field: string, label: string): number {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative number`);
  }
  return value;
}

function readString(record: Record<string, unknown>, field: string, label: string): string {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "string") {
    throw new Error(`${label}.${field} must be a string`);
  }
  return value;
}

function readRecord(record: Record<string, unknown>, field: string, label: string): Record<string, unknown> {
  const value = readOwnDataField(record, field, label);
  assertPlainRecord(value, `${label}.${field}`);
  return value;
}

function readOwnDataField(record: Record<string, unknown>, field: string, label: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    throw new Error(`${label}.${field} must be an enumerable own data field`);
  }
  return descriptor.value;
}

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function assertExactOwnEnumerableDataKeys(
  value: unknown,
  label: string,
  expectedKeys: readonly string[],
): asserts value is Record<string, unknown> {
  assertPlainRecord(value, label);
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (symbols.length > 0 || names.length !== expectedKeys.length) {
    throw new Error(`${label} must contain exactly the expected own data keys`);
  }
  const expected = new Set(expectedKeys);
  for (const name of names) {
    if (!expected.has(name)) {
      throw new Error(`${label} must contain exactly the expected own data keys`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(`${label}.${name} must be an enumerable own data field`);
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
