// Deterministic no-spend repeatability assessment for two completed GPT-5.5
// six-slot runtime/model-mode product-preview smokes. This helper consumes only
// already-sanitized public facts. It performs no provider calls, reads no
// private evidence, and cannot authorize runtime integration, provider calls,
// provider comparison, default-model selection, graph ingestion, production use,
// or readiness.

export type RuntimeSmokeGpt55RepeatabilityRole =
  | "representative-a"
  | "representative-b"
  | "edge-case-a"
  | "edge-case-b"
  | "calibration"
  | "sparse-control";

export type RuntimeSmokeGpt55RepeatabilityClassification =
  | "repeatable-useful"
  | "repeatable-weaker"
  | "not-repeatable";

export interface RuntimeSmokeGpt55RepeatabilityCounts {
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface RuntimeSmokeGpt55RepeatabilityObjectTypeCounts {
  readonly account_snapshot: number;
  readonly signal: number;
  readonly stakeholder: number;
  readonly initiative: number;
  readonly risk: number;
  readonly open_question: number;
  readonly play: number;
  readonly recommendation: number;
  readonly map: number;
  readonly relationship: number;
  readonly milestone: number;
}

export interface RuntimeSmokeGpt55RepeatabilitySupportCoverage {
  readonly excerpt_text_presence_count: number;
  readonly claim_text_presence_count: number;
  readonly claim_supported_count: number;
  readonly account_object_summary_presence_count: number;
  readonly account_object_supported_count: number;
}

export interface RuntimeSmokeGpt55RepeatabilitySlotStatus {
  readonly role: RuntimeSmokeGpt55RepeatabilityRole;
  readonly status: "completed" | "exception" | "blocked";
  readonly provider_calls_executed: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly output_counts: RuntimeSmokeGpt55RepeatabilityCounts;
  readonly object_type_counts: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts;
  readonly support_coverage: RuntimeSmokeGpt55RepeatabilitySupportCoverage;
}

export interface RuntimeSmokeGpt55RepeatabilityStatusFacts {
  readonly status_ref: string;
  readonly status: "completed" | "exception" | "blocked";
  readonly provider_calls_executed: number;
  readonly transport_calls_observed_by_runner: number;
  readonly approved_max_provider_calls: number;
  readonly completed_slot_count: number;
  readonly required_slot_roles: readonly RuntimeSmokeGpt55RepeatabilityRole[];
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly runtime_smoke_v2_type_remediation_changes: number;
  readonly output_counts: RuntimeSmokeGpt55RepeatabilityCounts;
  readonly object_type_counts: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts;
  readonly support_coverage: RuntimeSmokeGpt55RepeatabilitySupportCoverage;
  readonly slot_statuses: readonly RuntimeSmokeGpt55RepeatabilitySlotStatus[];
  readonly safety: RuntimeSmokeGpt55RepeatabilitySafety;
}

export interface RuntimeSmokeGpt55RepeatabilitySafety {
  readonly authorizes_provider_call: false;
  readonly authorizes_retry: false;
  readonly authorizes_default_model_selection: false;
  readonly provider_lock_in: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly tools: false;
  readonly web_search: false;
  readonly plugins: false;
  readonly shell: false;
  readonly file_access: false;
  readonly retrieval: false;
  readonly graph_ingestion_performed: false;
  readonly production_writes: false;
}

export interface RuntimeSmokeGpt55RepeatabilityAssessmentInput {
  readonly assessment_ref: string;
  readonly baseline: RuntimeSmokeGpt55RepeatabilityStatusFacts;
  readonly repeatability: RuntimeSmokeGpt55RepeatabilityStatusFacts;
}

export interface RuntimeSmokeGpt55RepeatabilityAssessment {
  readonly assessment_ref: string;
  readonly status: "pass" | "fail";
  readonly repeatability_classification: RuntimeSmokeGpt55RepeatabilityClassification;
  readonly baseline_status_ref: string;
  readonly repeatability_status_ref: string;
  readonly reasons: readonly string[];
  readonly deltas: {
    readonly output_counts: RuntimeSmokeGpt55RepeatabilityCounts;
    readonly object_type_counts: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts;
    readonly support_coverage: RuntimeSmokeGpt55RepeatabilitySupportCoverage;
  };
  readonly metrics: {
    readonly baseline_output_counts: RuntimeSmokeGpt55RepeatabilityCounts;
    readonly repeatability_output_counts: RuntimeSmokeGpt55RepeatabilityCounts;
    readonly repeatability_provider_calls_executed_by_assessment: 0;
    readonly repeated_role_count: number;
    readonly repeated_signal_count: number;
    readonly repeated_map_count: number;
    readonly repeated_play_count: number;
    readonly repeated_supported_claim_count: number;
    readonly repeated_supported_object_count: number;
  };
  readonly recommended_next_step: "provider-neutral-runtime-integration-planning" | "no-spend-remediation-first";
  readonly authorizes_provider_call: false;
  readonly authorizes_retry: false;
  readonly authorizes_product_preview_expansion: false;
  readonly authorizes_provider_comparison: false;
  readonly authorizes_default_model_selection: false;
  readonly authorizes_runtime_model_mode_integration: false;
  readonly authorizes_production_use: false;
  readonly authorizes_graph_ingestion: false;
  readonly launch_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly provider_lock_in: false;
}

const REQUIRED_ROLES = ["representative-a", "representative-b", "edge-case-a", "edge-case-b", "calibration", "sparse-control"] as const;
const ROOT_KEYS = ["assessment_ref", "baseline", "repeatability"] as const;
const STATUS_KEYS = [
  "accepted_output_received",
  "approved_max_provider_calls",
  "completed_slot_count",
  "object_type_counts",
  "output_counts",
  "provider_calls_executed",
  "required_slot_roles",
  "runtime_smoke_v2_type_remediation_changes",
  "safety",
  "slot_statuses",
  "status",
  "status_ref",
  "support_coverage",
  "transport_calls_observed_by_runner",
  "v2_contract_validated",
] as const;
const SLOT_KEYS = ["accepted_output_received", "object_type_counts", "output_counts", "provider_calls_executed", "role", "status", "support_coverage", "v2_contract_validated"] as const;
const COUNT_KEYS = ["account_objects", "claims", "excerpts"] as const;
const OBJECT_TYPE_KEYS = ["account_snapshot", "initiative", "map", "milestone", "open_question", "play", "recommendation", "relationship", "risk", "signal", "stakeholder"] as const;
const SUPPORT_KEYS = ["account_object_summary_presence_count", "account_object_supported_count", "claim_supported_count", "claim_text_presence_count", "excerpt_text_presence_count"] as const;
const SAFETY_KEYS = ["authorizes_default_model_selection", "authorizes_provider_call", "authorizes_retry", "file_access", "graph_ingestion_performed", "launch_readiness_claim", "plugins", "product_readiness_claim", "production_readiness_claim", "production_writes", "provider_lock_in", "retrieval", "shell", "tools", "web_search"] as const;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/;

export function assessRuntimeSmokeGpt55Repeatability(input: RuntimeSmokeGpt55RepeatabilityAssessmentInput): RuntimeSmokeGpt55RepeatabilityAssessment {
  const root = snapshotRecord(input, "repeatability assessment input");
  assertExactKeys(root, "repeatability assessment input", ROOT_KEYS);
  const assessmentRef = readRef(root, "assessment_ref", "repeatability assessment input");
  const baseline = readStatus(readRecord(root, "baseline", "repeatability assessment input"), "baseline");
  const repeatability = readStatus(readRecord(root, "repeatability", "repeatability assessment input"), "repeatability");

  const baselineReasons = validateStatusFacts(baseline, "baseline");
  const repeatabilityReasons = validateStatusFacts(repeatability, "repeatability");
  const repeatabilityFloorReasons = validateRepeatabilityFloor(baseline, repeatability);
  const reasons = [...baselineReasons, ...repeatabilityReasons, ...repeatabilityFloorReasons];
  const deltas = Object.freeze({
    output_counts: subtractCounts(repeatability.output_counts, baseline.output_counts),
    object_type_counts: subtractObjectTypes(repeatability.object_type_counts, baseline.object_type_counts),
    support_coverage: subtractSupport(repeatability.support_coverage, baseline.support_coverage),
  });
  const status = reasons.length === 0 ? "pass" : "fail";
  const classification = classify(status, deltas);

  return Object.freeze({
    assessment_ref: assessmentRef,
    status,
    repeatability_classification: classification,
    baseline_status_ref: baseline.status_ref,
    repeatability_status_ref: repeatability.status_ref,
    reasons: Object.freeze(reasons),
    deltas,
    metrics: Object.freeze({
      baseline_output_counts: baseline.output_counts,
      repeatability_output_counts: repeatability.output_counts,
      repeatability_provider_calls_executed_by_assessment: 0,
      repeated_role_count: repeatability.completed_slot_count,
      repeated_signal_count: repeatability.object_type_counts.signal,
      repeated_map_count: repeatability.object_type_counts.map,
      repeated_play_count: repeatability.object_type_counts.play,
      repeated_supported_claim_count: repeatability.support_coverage.claim_supported_count,
      repeated_supported_object_count: repeatability.support_coverage.account_object_supported_count,
    }),
    recommended_next_step: status === "pass" ? "provider-neutral-runtime-integration-planning" : "no-spend-remediation-first",
    authorizes_provider_call: false,
    authorizes_retry: false,
    authorizes_product_preview_expansion: false,
    authorizes_provider_comparison: false,
    authorizes_default_model_selection: false,
    authorizes_runtime_model_mode_integration: false,
    authorizes_production_use: false,
    authorizes_graph_ingestion: false,
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    provider_lock_in: false,
  });
}

function classify(status: "pass" | "fail", deltas: RuntimeSmokeGpt55RepeatabilityAssessment["deltas"]): RuntimeSmokeGpt55RepeatabilityClassification {
  if (status === "fail") return "not-repeatable";
  if (deltas.output_counts.account_objects < 0 || deltas.object_type_counts.signal < 0 || deltas.object_type_counts.map < 0 || deltas.object_type_counts.play < 0) return "repeatable-weaker";
  return "repeatable-useful";
}

function validateStatusFacts(status: RuntimeSmokeGpt55RepeatabilityStatusFacts, label: string): string[] {
  const reasons: string[] = [];
  if (status.status !== "completed") reasons.push(`${label}: status is not completed`);
  if (status.provider_calls_executed !== 6) reasons.push(`${label}: provider call count mismatch`);
  if (status.transport_calls_observed_by_runner !== status.provider_calls_executed) reasons.push(`${label}: transport call count mismatch`);
  if (status.approved_max_provider_calls !== 6) reasons.push(`${label}: approved call count mismatch`);
  if (status.completed_slot_count !== 6 || status.slot_statuses.length !== 6) reasons.push(`${label}: slot count mismatch`);
  if (!status.accepted_output_received) reasons.push(`${label}: no accepted output`);
  if (!status.v2_contract_validated) reasons.push(`${label}: v2 contract not validated`);
  if (status.runtime_smoke_v2_type_remediation_changes !== 0) reasons.push(`${label}: remediation changes were required`);
  if (status.object_type_counts.signal < 1 || status.object_type_counts.map < 1 || status.object_type_counts.play < 1) reasons.push(`${label}: missing Signals, Maps, or Plays coverage`);
  if (status.support_coverage.claim_supported_count !== status.output_counts.claims) reasons.push(`${label}: claim support coverage mismatch`);
  if (status.support_coverage.account_object_supported_count !== status.output_counts.account_objects) reasons.push(`${label}: object support coverage mismatch`);
  if (status.support_coverage.excerpt_text_presence_count !== status.output_counts.excerpts) reasons.push(`${label}: excerpt text coverage mismatch`);
  assertRoleSet(status.required_slot_roles, `${label}.required_slot_roles`);
  assertRoleSet(status.slot_statuses.map((slot) => slot.role), `${label}.slot_statuses`);
  const slotCounts = status.slot_statuses.reduce((sum, slot) => addCounts(sum, slot.output_counts), zeroCounts());
  const slotTypes = status.slot_statuses.reduce((sum, slot) => addObjectTypes(sum, slot.object_type_counts), zeroTypes());
  const slotSupport = status.slot_statuses.reduce((sum, slot) => addSupport(sum, slot.support_coverage), zeroSupport());
  if (!countsEqual(slotCounts, status.output_counts)) reasons.push(`${label}: aggregate output count mismatch`);
  if (!objectTypesEqual(slotTypes, status.object_type_counts)) reasons.push(`${label}: aggregate object type count mismatch`);
  if (!supportEqual(slotSupport, status.support_coverage)) reasons.push(`${label}: aggregate support count mismatch`);
  for (const slot of status.slot_statuses) {
    if (slot.status !== "completed" || slot.provider_calls_executed !== 1 || !slot.accepted_output_received || !slot.v2_contract_validated) reasons.push(`${label}: slot ${slot.role} did not complete cleanly`);
    if (!countsEqual({ excerpts: slot.support_coverage.excerpt_text_presence_count, claims: slot.support_coverage.claim_supported_count, account_objects: slot.support_coverage.account_object_supported_count }, slot.output_counts)) reasons.push(`${label}: slot ${slot.role} support mismatch`);
    if (sumObjectTypes(slot.object_type_counts) !== slot.output_counts.account_objects) reasons.push(`${label}: slot ${slot.role} object type mismatch`);
  }
  return reasons;
}

function validateRepeatabilityFloor(baseline: RuntimeSmokeGpt55RepeatabilityStatusFacts, repeatability: RuntimeSmokeGpt55RepeatabilityStatusFacts): string[] {
  const reasons: string[] = [];
  if (repeatability.output_counts.excerpts < baseline.output_counts.excerpts) reasons.push("repeatability produced fewer excerpts than baseline");
  if (repeatability.output_counts.claims < baseline.output_counts.claims) reasons.push("repeatability produced fewer claims than baseline");
  if (repeatability.output_counts.account_objects < baseline.output_counts.account_objects) reasons.push("repeatability produced fewer account objects than baseline");
  if (repeatability.object_type_counts.signal < baseline.object_type_counts.signal) reasons.push("repeatability produced fewer signal objects than baseline");
  if (repeatability.object_type_counts.map < baseline.object_type_counts.map) reasons.push("repeatability produced fewer map objects than baseline");
  if (repeatability.object_type_counts.play < baseline.object_type_counts.play) reasons.push("repeatability produced fewer play objects than baseline");
  if (repeatability.support_coverage.claim_supported_count < baseline.support_coverage.claim_supported_count) reasons.push("repeatability supported fewer claims than baseline");
  return reasons;
}

function snapshotRecord(input: unknown, label: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be a plain record`);
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) throw new Error(`${label} must be a plain record`);
  if (Object.getOwnPropertySymbols(input).length !== 0) throw new Error(`${label} must not contain symbol fields`);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
    if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label} fields must be enumerable data properties`);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function assertExactKeys(record: Record<string, unknown>, label: string, keys: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} exact keys mismatch`);
}
function readRecord(record: Record<string, unknown>, key: string, label: string): Record<string, unknown> {
  return snapshotRecord(record[key], `${label}.${key}`);
}
function readRef(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.startsWith("/")) throw new Error(`${label}.${key} must be a safe ref`);
  return value;
}
function readBooleanFalse(record: Record<string, unknown>, key: string, label: string): false {
  if (record[key] !== false) throw new Error(`${label}.${key} must be false`);
  return false;
}
function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  if (typeof record[key] !== "boolean") throw new Error(`${label}.${key} must be boolean`);
  return record[key] as boolean;
}
function readNonNegativeInteger(record: Record<string, unknown>, key: string, label: string): number {
  if (!Number.isInteger(record[key]) || (record[key] as number) < 0) throw new Error(`${label}.${key} must be non-negative integer`);
  return record[key] as number;
}
function readArray(record: Record<string, unknown>, key: string, label: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${label}.${key} must be array`);
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error(`${label}.${key} must not contain symbol fields`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = value.length;
  const allowed = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  for (const [propertyKey, descriptor] of Object.entries(descriptors)) {
    if (!allowed.has(propertyKey)) throw new Error(`${label}.${key} must not contain extra fields`);
    if (propertyKey !== "length" && (!descriptor.enumerable || !("value" in descriptor))) throw new Error(`${label}.${key} elements must be enumerable data properties`);
  }
  return Object.freeze(Array.from({ length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor)) throw new Error(`${label}.${key} elements must be enumerable data properties`);
    return descriptor.value;
  }));
}

function readStatus(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilityStatusFacts {
  assertExactKeys(record, label, STATUS_KEYS);
  const status = readRef(record, "status", label);
  if (status !== "completed" && status !== "exception" && status !== "blocked") throw new Error(`${label}.status invalid`);
  return Object.freeze({
    status_ref: readRef(record, "status_ref", label),
    status,
    provider_calls_executed: readNonNegativeInteger(record, "provider_calls_executed", label),
    transport_calls_observed_by_runner: readNonNegativeInteger(record, "transport_calls_observed_by_runner", label),
    approved_max_provider_calls: readNonNegativeInteger(record, "approved_max_provider_calls", label),
    completed_slot_count: readNonNegativeInteger(record, "completed_slot_count", label),
    required_slot_roles: readArray(record, "required_slot_roles", label).map((role) => readRoleValue(role, `${label}.required_slot_roles`)),
    accepted_output_received: readBoolean(record, "accepted_output_received", label),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", label),
    runtime_smoke_v2_type_remediation_changes: readNonNegativeInteger(record, "runtime_smoke_v2_type_remediation_changes", label),
    output_counts: readCounts(readRecord(record, "output_counts", label), `${label}.output_counts`),
    object_type_counts: readObjectTypes(readRecord(record, "object_type_counts", label), `${label}.object_type_counts`),
    support_coverage: readSupport(readRecord(record, "support_coverage", label), `${label}.support_coverage`),
    slot_statuses: readArray(record, "slot_statuses", label).map((slot, index) => readSlot(snapshotRecord(slot, `${label}.slot_statuses[${index}]`), `${label}.slot_statuses[${index}]`)),
    safety: readSafety(readRecord(record, "safety", label), `${label}.safety`),
  });
}

function readSlot(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilitySlotStatus {
  assertExactKeys(record, label, SLOT_KEYS);
  const status = readRef(record, "status", label);
  if (status !== "completed" && status !== "exception" && status !== "blocked") throw new Error(`${label}.status invalid`);
  return Object.freeze({
    role: readRoleValue(record.role, `${label}.role`),
    status,
    provider_calls_executed: readNonNegativeInteger(record, "provider_calls_executed", label),
    accepted_output_received: readBoolean(record, "accepted_output_received", label),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", label),
    output_counts: readCounts(readRecord(record, "output_counts", label), `${label}.output_counts`),
    object_type_counts: readObjectTypes(readRecord(record, "object_type_counts", label), `${label}.object_type_counts`),
    support_coverage: readSupport(readRecord(record, "support_coverage", label), `${label}.support_coverage`),
  });
}
function readSafety(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilitySafety {
  assertExactKeys(record, label, SAFETY_KEYS);
  const out: Record<string, false> = {};
  for (const key of SAFETY_KEYS) out[key] = readBooleanFalse(record, key, label);
  return Object.freeze(out) as unknown as RuntimeSmokeGpt55RepeatabilitySafety;
}
function readRoleValue(value: unknown, label: string): RuntimeSmokeGpt55RepeatabilityRole {
  if (typeof value !== "string" || !REQUIRED_ROLES.includes(value as RuntimeSmokeGpt55RepeatabilityRole)) throw new Error(`${label} invalid`);
  return value as RuntimeSmokeGpt55RepeatabilityRole;
}
function assertRoleSet(values: readonly RuntimeSmokeGpt55RepeatabilityRole[], label: string): void {
  if (values.length !== REQUIRED_ROLES.length) throw new Error(`${label} length mismatch`);
  const seen = new Set(values);
  for (const role of REQUIRED_ROLES) if (!seen.has(role)) throw new Error(`${label} missing ${role}`);
}
function readCounts(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilityCounts {
  assertExactKeys(record, label, COUNT_KEYS);
  return Object.freeze({ excerpts: readNonNegativeInteger(record, "excerpts", label), claims: readNonNegativeInteger(record, "claims", label), account_objects: readNonNegativeInteger(record, "account_objects", label) });
}
function readObjectTypes(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilityObjectTypeCounts {
  assertExactKeys(record, label, OBJECT_TYPE_KEYS);
  return Object.freeze({ account_snapshot: readNonNegativeInteger(record, "account_snapshot", label), signal: readNonNegativeInteger(record, "signal", label), stakeholder: readNonNegativeInteger(record, "stakeholder", label), initiative: readNonNegativeInteger(record, "initiative", label), risk: readNonNegativeInteger(record, "risk", label), open_question: readNonNegativeInteger(record, "open_question", label), play: readNonNegativeInteger(record, "play", label), recommendation: readNonNegativeInteger(record, "recommendation", label), map: readNonNegativeInteger(record, "map", label), relationship: readNonNegativeInteger(record, "relationship", label), milestone: readNonNegativeInteger(record, "milestone", label) });
}
function readSupport(record: Record<string, unknown>, label: string): RuntimeSmokeGpt55RepeatabilitySupportCoverage {
  assertExactKeys(record, label, SUPPORT_KEYS);
  return Object.freeze({ excerpt_text_presence_count: readNonNegativeInteger(record, "excerpt_text_presence_count", label), claim_text_presence_count: readNonNegativeInteger(record, "claim_text_presence_count", label), claim_supported_count: readNonNegativeInteger(record, "claim_supported_count", label), account_object_summary_presence_count: readNonNegativeInteger(record, "account_object_summary_presence_count", label), account_object_supported_count: readNonNegativeInteger(record, "account_object_supported_count", label) });
}

const zeroCounts = (): RuntimeSmokeGpt55RepeatabilityCounts => ({ excerpts: 0, claims: 0, account_objects: 0 });
const zeroTypes = (): RuntimeSmokeGpt55RepeatabilityObjectTypeCounts => ({ account_snapshot: 0, signal: 0, stakeholder: 0, initiative: 0, risk: 0, open_question: 0, play: 0, recommendation: 0, map: 0, relationship: 0, milestone: 0 });
const zeroSupport = (): RuntimeSmokeGpt55RepeatabilitySupportCoverage => ({ excerpt_text_presence_count: 0, claim_text_presence_count: 0, claim_supported_count: 0, account_object_summary_presence_count: 0, account_object_supported_count: 0 });
function addCounts(a: RuntimeSmokeGpt55RepeatabilityCounts, b: RuntimeSmokeGpt55RepeatabilityCounts): RuntimeSmokeGpt55RepeatabilityCounts { return { excerpts: a.excerpts + b.excerpts, claims: a.claims + b.claims, account_objects: a.account_objects + b.account_objects }; }
function addObjectTypes(a: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts, b: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts): RuntimeSmokeGpt55RepeatabilityObjectTypeCounts { return Object.fromEntries(OBJECT_TYPE_KEYS.map((key) => [key, a[key] + b[key]])) as unknown as RuntimeSmokeGpt55RepeatabilityObjectTypeCounts; }
function addSupport(a: RuntimeSmokeGpt55RepeatabilitySupportCoverage, b: RuntimeSmokeGpt55RepeatabilitySupportCoverage): RuntimeSmokeGpt55RepeatabilitySupportCoverage { return Object.fromEntries(SUPPORT_KEYS.map((key) => [key, a[key] + b[key]])) as unknown as RuntimeSmokeGpt55RepeatabilitySupportCoverage; }
function subtractCounts(a: RuntimeSmokeGpt55RepeatabilityCounts, b: RuntimeSmokeGpt55RepeatabilityCounts): RuntimeSmokeGpt55RepeatabilityCounts { return { excerpts: a.excerpts - b.excerpts, claims: a.claims - b.claims, account_objects: a.account_objects - b.account_objects }; }
function subtractObjectTypes(a: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts, b: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts): RuntimeSmokeGpt55RepeatabilityObjectTypeCounts { return Object.fromEntries(OBJECT_TYPE_KEYS.map((key) => [key, a[key] - b[key]])) as unknown as RuntimeSmokeGpt55RepeatabilityObjectTypeCounts; }
function subtractSupport(a: RuntimeSmokeGpt55RepeatabilitySupportCoverage, b: RuntimeSmokeGpt55RepeatabilitySupportCoverage): RuntimeSmokeGpt55RepeatabilitySupportCoverage { return Object.fromEntries(SUPPORT_KEYS.map((key) => [key, a[key] - b[key]])) as unknown as RuntimeSmokeGpt55RepeatabilitySupportCoverage; }
function countsEqual(a: RuntimeSmokeGpt55RepeatabilityCounts, b: RuntimeSmokeGpt55RepeatabilityCounts): boolean { return a.excerpts === b.excerpts && a.claims === b.claims && a.account_objects === b.account_objects; }
function objectTypesEqual(a: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts, b: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts): boolean { return OBJECT_TYPE_KEYS.every((key) => a[key] === b[key]); }
function supportEqual(a: RuntimeSmokeGpt55RepeatabilitySupportCoverage, b: RuntimeSmokeGpt55RepeatabilitySupportCoverage): boolean { return SUPPORT_KEYS.every((key) => a[key] === b[key]); }
function sumObjectTypes(types: RuntimeSmokeGpt55RepeatabilityObjectTypeCounts): number { return OBJECT_TYPE_KEYS.reduce((sum, key) => sum + types[key], 0); }
