// Deterministic no-spend usefulness assessment for a completed runtime/model-mode
// product-preview smoke. The committed helper consumes only a sanitized projection
// of already-captured evidence. It performs no provider calls, network access,
// graph ingestion, production writes, comparison, or default-model selection.

export type RuntimeSmokeUsefulnessLens = "signals" | "maps" | "plays";

export type RuntimeSmokeUsefulnessClassification =
  | "useful"
  | "weak-but-valid"
  | "structurally-valid-not-useful"
  | "blocked-by-missing-evidence-or-lens-coverage"
  | "contract-failure";

export type RuntimeSmokeUsefulnessReasonCode =
  | "source_status_not_completed"
  | "output_contract_not_validated"
  | "zero_output"
  | "insufficient_excerpt_count"
  | "insufficient_claim_count"
  | "insufficient_account_object_count"
  | "missing_required_lens"
  | "missing_excerpt_text_presence"
  | "missing_claim_text_presence"
  | "missing_claim_support"
  | "missing_account_object_summary_presence"
  | "missing_account_object_support";

export interface RuntimeSmokeOutputCounts {
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface RuntimeSmokeObjectTypeCounts {
  readonly account_snapshot: number;
  readonly signal: number;
  readonly stakeholder?: number;
  readonly initiative?: number;
  readonly risk?: number;
  readonly open_question?: number;
  readonly play: number;
  readonly recommendation?: number;
}

export interface RuntimeSmokeSupportCoverage {
  readonly excerpt_text_presence_count: number;
  readonly claim_text_presence_count: number;
  readonly claim_supported_count: number;
  readonly account_object_summary_presence_count: number;
  readonly account_object_supported_count: number;
}

export interface RuntimeSmokeUsefulnessBoundaries {
  readonly provider_call: false;
  readonly provider_spend: false;
  readonly network_access: false;
  readonly graph_ingestion: false;
  readonly production_writes: false;
  readonly runtime_model_mode_integration: false;
  readonly provider_or_model_comparison: false;
  readonly default_model_selection: false;
  readonly product_preview_expansion: false;
  readonly readiness_claim: false;
  readonly raw_or_model_output_committed: false;
  readonly private_evidence_committed: false;
  readonly prompt_material_committed: false;
  readonly credentials_committed: false;
}

export interface RuntimeSmokeUsefulnessInput {
  readonly assessment_ref: string;
  readonly status_ref: string;
  readonly slot_role: "calibration";
  readonly source_status: "completed" | "exception" | "blocked";
  readonly provider_calls_executed: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly output_counts: RuntimeSmokeOutputCounts;
  readonly object_type_counts: RuntimeSmokeObjectTypeCounts;
  readonly support_coverage: RuntimeSmokeSupportCoverage;
  readonly assessment_boundaries: RuntimeSmokeUsefulnessBoundaries;
}

export interface RuntimeSmokeUsefulnessReason {
  readonly code: RuntimeSmokeUsefulnessReasonCode;
  readonly message: string;
  readonly observed: number;
  readonly threshold: number;
}

export interface RuntimeSmokeUsefulnessAssessment {
  readonly assessment_ref: string;
  readonly status_ref: string;
  readonly status: "pass" | "fail";
  readonly usefulness_classification: RuntimeSmokeUsefulnessClassification;
  readonly lens_counts: Record<RuntimeSmokeUsefulnessLens, number>;
  readonly useful_lens_count: number;
  readonly useful_lenses: readonly RuntimeSmokeUsefulnessLens[];
  readonly metrics: {
    readonly provider_calls_executed_source: number;
    readonly provider_calls_executed_by_assessment: 0;
    readonly output_counts: RuntimeSmokeOutputCounts;
    readonly object_type_counts: Required<RuntimeSmokeObjectTypeCounts>;
    readonly support_coverage: RuntimeSmokeSupportCoverage;
  };
  readonly reasons: readonly RuntimeSmokeUsefulnessReason[];
  readonly recommends_next_step: "separate-tiny-expansion-approval-packet" | "no-spend-remediation-first" | "stop-live-expansion";
  readonly authorizes_provider_call: false;
  readonly authorizes_retry: false;
  readonly authorizes_product_preview_expansion: false;
  readonly authorizes_provider_comparison: false;
  readonly authorizes_default_model_selection: false;
  readonly authorizes_graph_ingestion: false;
  readonly authorizes_background_orchestrator_bypass: false;
  readonly authorizes_production_use: false;
  readonly launch_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly provider_lock_in: false;
  readonly safety: RuntimeSmokeUsefulnessBoundaries;
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/;
const MIN_EXCERPTS = 3;
const MIN_CLAIMS = 2;
const MIN_ACCOUNT_OBJECTS = 3;
const REQUIRED_LENSES: readonly RuntimeSmokeUsefulnessLens[] = ["signals", "maps", "plays"];
const OBJECT_TYPE_KEYS = [
  "account_snapshot",
  "signal",
  "stakeholder",
  "initiative",
  "risk",
  "open_question",
  "play",
  "recommendation",
] as const;
const REQUIRED_FALSE_BOUNDARIES = [
  "provider_call",
  "provider_spend",
  "network_access",
  "graph_ingestion",
  "production_writes",
  "runtime_model_mode_integration",
  "provider_or_model_comparison",
  "default_model_selection",
  "product_preview_expansion",
  "readiness_claim",
  "raw_or_model_output_committed",
  "private_evidence_committed",
  "prompt_material_committed",
  "credentials_committed",
] as const;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function ownData(record: Record<string, unknown>, key: string, label: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    throw new Error(`${label}.${key} must be an enumerable own data field`);
  }
  return descriptor.value;
}

function assertExactKeys(record: Record<string, unknown>, label: string, keys: readonly string[]): void {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(record);
    symbols = Object.getOwnPropertySymbols(record);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  const expected = new Set(keys);
  if (symbols.length > 0 || names.length !== keys.length || names.some((name) => !expected.has(name))) {
    throw new Error(`${label} must contain exactly the expected own data keys`);
  }
  for (const key of names) ownData(record, key, label);
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = ownData(record, key, label);
  if (typeof value !== "string") throw new Error(`${label}.${key} must be a string`);
  return value;
}

function readSafeRef(record: Record<string, unknown>, key: string, label: string): string {
  const value = readString(record, key, label);
  if (!SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.includes("/")) {
    throw new Error(`${label}.${key} must be a safe ref`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = ownData(record, key, label);
  if (typeof value !== "boolean") throw new Error(`${label}.${key} must be a boolean`);
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string, label: string): number {
  const value = ownData(record, key, label);
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label}.${key} must be a non-negative integer`);
  }
  return value as number;
}

function readOutputCounts(record: Record<string, unknown>): RuntimeSmokeOutputCounts {
  assertExactKeys(record, "output_counts", ["account_objects", "claims", "excerpts"]);
  return Object.freeze({
    excerpts: readNonNegativeInteger(record, "excerpts", "output_counts"),
    claims: readNonNegativeInteger(record, "claims", "output_counts"),
    account_objects: readNonNegativeInteger(record, "account_objects", "output_counts"),
  });
}

type MutableRuntimeSmokeObjectTypeCounts = {
  -readonly [K in keyof Required<RuntimeSmokeObjectTypeCounts>]: number;
};

function readObjectTypeCounts(record: Record<string, unknown>): Required<RuntimeSmokeObjectTypeCounts> {
  const names = Object.getOwnPropertyNames(record);
  const symbols = Object.getOwnPropertySymbols(record);
  const allowed = new Set<string>(OBJECT_TYPE_KEYS);
  if (symbols.length > 0 || names.some((name) => !allowed.has(name))) {
    throw new Error("object_type_counts must contain only supported public object types");
  }
  const counts = Object.fromEntries(OBJECT_TYPE_KEYS.map((key) => [key, 0])) as unknown as MutableRuntimeSmokeObjectTypeCounts;
  for (const key of names) {
    counts[key as keyof MutableRuntimeSmokeObjectTypeCounts] = readNonNegativeInteger(record, key, "object_type_counts");
  }
  return Object.freeze(counts);
}

function readSupportCoverage(record: Record<string, unknown>): RuntimeSmokeSupportCoverage {
  assertExactKeys(record, "support_coverage", [
    "account_object_summary_presence_count",
    "account_object_supported_count",
    "claim_supported_count",
    "claim_text_presence_count",
    "excerpt_text_presence_count",
  ]);
  return Object.freeze({
    excerpt_text_presence_count: readNonNegativeInteger(record, "excerpt_text_presence_count", "support_coverage"),
    claim_text_presence_count: readNonNegativeInteger(record, "claim_text_presence_count", "support_coverage"),
    claim_supported_count: readNonNegativeInteger(record, "claim_supported_count", "support_coverage"),
    account_object_summary_presence_count: readNonNegativeInteger(record, "account_object_summary_presence_count", "support_coverage"),
    account_object_supported_count: readNonNegativeInteger(record, "account_object_supported_count", "support_coverage"),
  });
}

function readFalseBoundaries(record: Record<string, unknown>): RuntimeSmokeUsefulnessBoundaries {
  assertExactKeys(record, "assessment_boundaries", REQUIRED_FALSE_BOUNDARIES);
  for (const key of REQUIRED_FALSE_BOUNDARIES) {
    if (readBoolean(record, key, "assessment_boundaries") !== false) {
      throw new Error(`assessment_boundaries.${key} must be false`);
    }
  }
  return Object.freeze(Object.fromEntries(REQUIRED_FALSE_BOUNDARIES.map((key) => [key, false])) as unknown as RuntimeSmokeUsefulnessBoundaries);
}

function readRecordField(record: Record<string, unknown>, key: string, label: string): Record<string, unknown> {
  const value = ownData(record, key, label);
  assertRecord(value, `${label}.${key}`);
  return value;
}

function snapshotInput(input: unknown): RuntimeSmokeUsefulnessInput & { object_type_counts: Required<RuntimeSmokeObjectTypeCounts> } {
  assertRecord(input, "runtime smoke usefulness input");
  assertExactKeys(input, "runtime smoke usefulness input", [
    "accepted_output_received",
    "assessment_boundaries",
    "assessment_ref",
    "object_type_counts",
    "output_counts",
    "provider_calls_executed",
    "slot_role",
    "source_status",
    "status_ref",
    "support_coverage",
    "v2_contract_validated",
  ]);
  const slotRole = readString(input, "slot_role", "runtime smoke usefulness input");
  if (slotRole !== "calibration") throw new Error("runtime smoke usefulness input.slot_role must be calibration");
  const sourceStatus = readString(input, "source_status", "runtime smoke usefulness input");
  if (!["completed", "exception", "blocked"].includes(sourceStatus)) {
    throw new Error("runtime smoke usefulness input.source_status unsupported");
  }
  const providerCalls = readNonNegativeInteger(input, "provider_calls_executed", "runtime smoke usefulness input");
  if (providerCalls > 1) throw new Error("runtime smoke usefulness input.provider_calls_executed exceeds one-call status");
  return Object.freeze({
    assessment_ref: readSafeRef(input, "assessment_ref", "runtime smoke usefulness input"),
    status_ref: readSafeRef(input, "status_ref", "runtime smoke usefulness input"),
    slot_role: "calibration",
    source_status: sourceStatus as RuntimeSmokeUsefulnessInput["source_status"],
    provider_calls_executed: providerCalls,
    accepted_output_received: readBoolean(input, "accepted_output_received", "runtime smoke usefulness input"),
    v2_contract_validated: readBoolean(input, "v2_contract_validated", "runtime smoke usefulness input"),
    output_counts: readOutputCounts(readRecordField(input, "output_counts", "runtime smoke usefulness input")),
    object_type_counts: readObjectTypeCounts(readRecordField(input, "object_type_counts", "runtime smoke usefulness input")),
    support_coverage: readSupportCoverage(readRecordField(input, "support_coverage", "runtime smoke usefulness input")),
    assessment_boundaries: readFalseBoundaries(readRecordField(input, "assessment_boundaries", "runtime smoke usefulness input")),
  });
}

function objectTypeTotal(objectTypes: Required<RuntimeSmokeObjectTypeCounts>): number {
  return OBJECT_TYPE_KEYS.reduce((sum, key) => sum + objectTypes[key], 0);
}

function assertProjectionInvariants(input: RuntimeSmokeUsefulnessInput & { object_type_counts: Required<RuntimeSmokeObjectTypeCounts> }): void {
  if (objectTypeTotal(input.object_type_counts) !== input.output_counts.account_objects) {
    throw new Error("object_type_counts total must equal account_objects output count");
  }
  if (input.support_coverage.excerpt_text_presence_count > input.output_counts.excerpts) {
    throw new Error("excerpt text presence count exceeds excerpt output count");
  }
  if (input.support_coverage.claim_text_presence_count > input.output_counts.claims) {
    throw new Error("claim text presence count exceeds claim output count");
  }
  if (input.support_coverage.claim_supported_count > input.output_counts.claims) {
    throw new Error("claim support count exceeds claim output count");
  }
  if (input.support_coverage.account_object_summary_presence_count > input.output_counts.account_objects) {
    throw new Error("account object summary count exceeds account object output count");
  }
  if (input.support_coverage.account_object_supported_count > input.output_counts.account_objects) {
    throw new Error("account object support count exceeds account object output count");
  }
}

function lensCounts(objectTypes: Required<RuntimeSmokeObjectTypeCounts>): Record<RuntimeSmokeUsefulnessLens, number> {
  return Object.freeze({
    maps: objectTypes.account_snapshot + objectTypes.stakeholder + objectTypes.initiative,
    signals: objectTypes.signal + objectTypes.risk + objectTypes.open_question,
    plays: objectTypes.play + objectTypes.recommendation,
  });
}

function addReason(
  reasons: RuntimeSmokeUsefulnessReason[],
  code: RuntimeSmokeUsefulnessReasonCode,
  message: string,
  observed: number,
  threshold: number,
): void {
  reasons.push(Object.freeze({ code, message, observed, threshold }));
}

function classify(
  input: RuntimeSmokeUsefulnessInput & { object_type_counts: Required<RuntimeSmokeObjectTypeCounts> },
  countsByLens: Record<RuntimeSmokeUsefulnessLens, number>,
  reasons: RuntimeSmokeUsefulnessReason[],
): RuntimeSmokeUsefulnessClassification {
  if (input.source_status !== "completed" || input.provider_calls_executed !== 1 || !input.accepted_output_received) {
    addReason(reasons, "source_status_not_completed", "source status did not complete exactly one accepted-output call", input.provider_calls_executed, 1);
  }
  if (!input.v2_contract_validated) {
    addReason(reasons, "output_contract_not_validated", "v2 public output contract was not validated", 0, 1);
  }
  if (reasons.length > 0) return "contract-failure";

  const totalOutput = input.output_counts.excerpts + input.output_counts.claims + input.output_counts.account_objects;
  if (totalOutput === 0) {
    addReason(reasons, "zero_output", "validated output contained no public graph-shaped facts", 0, 1);
    return "structurally-valid-not-useful";
  }

  if (input.output_counts.excerpts < MIN_EXCERPTS) {
    addReason(reasons, "insufficient_excerpt_count", "fewer than the required number of public-safe excerpts were present", input.output_counts.excerpts, MIN_EXCERPTS);
  }
  if (input.output_counts.claims < MIN_CLAIMS) {
    addReason(reasons, "insufficient_claim_count", "fewer than the required number of public-safe claims were present", input.output_counts.claims, MIN_CLAIMS);
  }
  if (input.output_counts.account_objects < MIN_ACCOUNT_OBJECTS) {
    addReason(reasons, "insufficient_account_object_count", "fewer than the required number of public-safe account objects were present", input.output_counts.account_objects, MIN_ACCOUNT_OBJECTS);
  }

  let missingCoverage = false;
  for (const lens of REQUIRED_LENSES) {
    if (countsByLens[lens] < 1) {
      addReason(reasons, "missing_required_lens", `missing required ${lens} lens coverage`, countsByLens[lens], 1);
      missingCoverage = true;
    }
  }
  if (input.support_coverage.excerpt_text_presence_count !== input.output_counts.excerpts) {
    addReason(reasons, "missing_excerpt_text_presence", "one or more excerpts lacked text in private evidence", input.support_coverage.excerpt_text_presence_count, input.output_counts.excerpts);
    missingCoverage = true;
  }
  if (input.support_coverage.claim_text_presence_count !== input.output_counts.claims) {
    addReason(reasons, "missing_claim_text_presence", "one or more claims lacked text in private evidence", input.support_coverage.claim_text_presence_count, input.output_counts.claims);
    missingCoverage = true;
  }
  if (input.support_coverage.claim_supported_count !== input.output_counts.claims) {
    addReason(reasons, "missing_claim_support", "one or more claims lacked resolvable excerpt support", input.support_coverage.claim_supported_count, input.output_counts.claims);
    missingCoverage = true;
  }
  if (input.support_coverage.account_object_summary_presence_count !== input.output_counts.account_objects) {
    addReason(reasons, "missing_account_object_summary_presence", "one or more account objects lacked summaries in private evidence", input.support_coverage.account_object_summary_presence_count, input.output_counts.account_objects);
    missingCoverage = true;
  }
  if (input.support_coverage.account_object_supported_count !== input.output_counts.account_objects) {
    addReason(reasons, "missing_account_object_support", "one or more account objects lacked resolvable excerpt support", input.support_coverage.account_object_supported_count, input.output_counts.account_objects);
    missingCoverage = true;
  }

  if (missingCoverage) return "blocked-by-missing-evidence-or-lens-coverage";
  return reasons.length === 0 ? "useful" : "weak-but-valid";
}

function nextStep(classification: RuntimeSmokeUsefulnessClassification): RuntimeSmokeUsefulnessAssessment["recommends_next_step"] {
  if (classification === "useful") return "separate-tiny-expansion-approval-packet";
  if (classification === "weak-but-valid") return "no-spend-remediation-first";
  return "stop-live-expansion";
}

export function assessRuntimeSmokeUsefulness(input: unknown): RuntimeSmokeUsefulnessAssessment {
  const snapshot = snapshotInput(input);
  assertProjectionInvariants(snapshot);
  const countsByLens = lensCounts(snapshot.object_type_counts);
  const usefulLenses = REQUIRED_LENSES.filter((lens) => countsByLens[lens] > 0);
  const reasons: RuntimeSmokeUsefulnessReason[] = [];
  const classification = classify(snapshot, countsByLens, reasons);
  const status = classification === "useful" ? "pass" : "fail";
  const safety = Object.freeze({ ...snapshot.assessment_boundaries });
  return Object.freeze({
    assessment_ref: snapshot.assessment_ref,
    status_ref: snapshot.status_ref,
    status,
    usefulness_classification: classification,
    lens_counts: countsByLens,
    useful_lens_count: usefulLenses.length,
    useful_lenses: Object.freeze(usefulLenses),
    metrics: Object.freeze({
      provider_calls_executed_source: snapshot.provider_calls_executed,
      provider_calls_executed_by_assessment: 0,
      output_counts: Object.freeze({ ...snapshot.output_counts }),
      object_type_counts: Object.freeze({ ...snapshot.object_type_counts }),
      support_coverage: Object.freeze({ ...snapshot.support_coverage }),
    }),
    reasons: Object.freeze([...reasons]),
    recommends_next_step: nextStep(classification),
    authorizes_provider_call: false,
    authorizes_retry: false,
    authorizes_product_preview_expansion: false,
    authorizes_provider_comparison: false,
    authorizes_default_model_selection: false,
    authorizes_graph_ingestion: false,
    authorizes_background_orchestrator_bypass: false,
    authorizes_production_use: false,
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    provider_lock_in: false,
    safety,
  });
}
