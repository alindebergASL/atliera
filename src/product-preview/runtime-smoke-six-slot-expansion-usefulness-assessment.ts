// Deterministic no-spend usefulness assessment for a completed six-slot
// runtime/model-mode product-preview expansion. This helper consumes only
// sanitized public counts and cannot authorize provider calls, expansion,
// comparison, graph ingestion, production use, or readiness.

export type RuntimeSmokeSixSlotExpansionLens = "signals" | "maps" | "plays";
export type RuntimeSmokeSixSlotExpansionClassification = "useful" | "weak-but-valid" | "contract-failure";
export type RuntimeSmokeSixSlotExpansionReasonCode =
  | "source_status_not_completed"
  | "provider_call_count_mismatch"
  | "slot_count_mismatch"
  | "slot_not_completed"
  | "slot_underproduced"
  | "aggregate_count_mismatch"
  | "missing_required_lens"
  | "missing_support_coverage";

export interface RuntimeSmokeSixSlotExpansionCounts {
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface RuntimeSmokeSixSlotExpansionObjectTypeCounts {
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

export interface RuntimeSmokeSixSlotExpansionSupportCoverage {
  readonly excerpt_text_presence_count: number;
  readonly claim_text_presence_count: number;
  readonly claim_supported_count: number;
  readonly account_object_summary_presence_count: number;
  readonly account_object_supported_count: number;
}

export interface RuntimeSmokeSixSlotExpansionSlotStatus {
  readonly role: "representative-a" | "representative-b" | "edge-case-a" | "edge-case-b" | "calibration" | "sparse-control";
  readonly status: "completed" | "exception" | "blocked";
  readonly provider_calls_executed: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly output_counts: RuntimeSmokeSixSlotExpansionCounts;
  readonly object_type_counts: RuntimeSmokeSixSlotExpansionObjectTypeCounts;
  readonly support_coverage: RuntimeSmokeSixSlotExpansionSupportCoverage;
}

export interface RuntimeSmokeSixSlotExpansionBoundaries {
  readonly provider_call: false;
  readonly provider_spend: false;
  readonly raw_private_evidence_read: false;
  readonly network_access: false;
  readonly graph_ingestion: false;
  readonly production_writes: false;
  readonly runtime_model_mode_integration: false;
  readonly provider_comparison: false;
  readonly default_model_selection: false;
  readonly product_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly provider_lock_in: false;
}

export interface RuntimeSmokeSixSlotExpansionUsefulnessInput {
  readonly assessment_ref: string;
  readonly status_ref: string;
  readonly source_status: "completed" | "exception" | "blocked";
  readonly provider_calls_executed: number;
  readonly screened_account_slots: number;
  readonly completed_slot_count: number;
  readonly accepted_output_received: boolean;
  readonly v2_contract_validated: boolean;
  readonly required_slot_roles: readonly RuntimeSmokeSixSlotExpansionSlotStatus["role"][];
  readonly output_counts: RuntimeSmokeSixSlotExpansionCounts;
  readonly object_type_counts: RuntimeSmokeSixSlotExpansionObjectTypeCounts;
  readonly support_coverage: RuntimeSmokeSixSlotExpansionSupportCoverage;
  readonly slot_statuses: readonly RuntimeSmokeSixSlotExpansionSlotStatus[];
  readonly assessment_boundaries: RuntimeSmokeSixSlotExpansionBoundaries;
}

export interface RuntimeSmokeSixSlotExpansionReason {
  readonly code: RuntimeSmokeSixSlotExpansionReasonCode;
  readonly message: string;
  readonly observed: number;
  readonly threshold: number;
}

export interface RuntimeSmokeSixSlotExpansionUsefulnessAssessment {
  readonly assessment_ref: string;
  readonly status_ref: string;
  readonly status: "pass" | "fail";
  readonly usefulness_classification: RuntimeSmokeSixSlotExpansionClassification;
  readonly useful_lenses: readonly RuntimeSmokeSixSlotExpansionLens[];
  readonly reasons: readonly RuntimeSmokeSixSlotExpansionReason[];
  readonly metrics: {
    readonly provider_calls_executed_source: number;
    readonly provider_calls_executed_by_assessment: 0;
    readonly screened_account_slots: number;
    readonly completed_slot_count: number;
    readonly output_counts: RuntimeSmokeSixSlotExpansionCounts;
    readonly object_type_counts: RuntimeSmokeSixSlotExpansionObjectTypeCounts;
    readonly support_coverage: RuntimeSmokeSixSlotExpansionSupportCoverage;
    readonly lens_counts: Record<RuntimeSmokeSixSlotExpansionLens, number>;
  };
  readonly recommends_next_step: "no-spend-remediation-first" | "separate-reviewed-next-approval-required" | "stop-live-expansion";
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
  readonly safety: RuntimeSmokeSixSlotExpansionBoundaries;
}

const REQUIRED_ROLES = ["representative-a", "representative-b", "edge-case-a", "edge-case-b", "calibration", "sparse-control"] as const;
const INPUT_KEYS = [
  "accepted_output_received",
  "assessment_boundaries",
  "assessment_ref",
  "completed_slot_count",
  "object_type_counts",
  "output_counts",
  "provider_calls_executed",
  "required_slot_roles",
  "screened_account_slots",
  "slot_statuses",
  "source_status",
  "status_ref",
  "support_coverage",
  "v2_contract_validated",
] as const;
const SLOT_KEYS = [
  "accepted_output_received",
  "object_type_counts",
  "output_counts",
  "provider_calls_executed",
  "role",
  "status",
  "support_coverage",
  "v2_contract_validated",
] as const;
const COUNT_KEYS = ["account_objects", "claims", "excerpts"] as const;
const OBJECT_TYPE_KEYS = [
  "account_snapshot",
  "initiative",
  "map",
  "milestone",
  "open_question",
  "play",
  "recommendation",
  "relationship",
  "risk",
  "signal",
  "stakeholder",
] as const;
const SUPPORT_KEYS = [
  "account_object_summary_presence_count",
  "account_object_supported_count",
  "claim_supported_count",
  "claim_text_presence_count",
  "excerpt_text_presence_count",
] as const;
const BOUNDARY_KEYS = [
  "default_model_selection",
  "graph_ingestion",
  "launch_readiness_claim",
  "network_access",
  "product_readiness_claim",
  "production_writes",
  "provider_call",
  "provider_comparison",
  "provider_lock_in",
  "provider_spend",
  "raw_private_evidence_read",
  "runtime_model_mode_integration",
] as const;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/;

function snapshotRecord(input: unknown, label: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be a plain record`);
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) throw new Error(`${label} must be a plain record`);
  if (Object.getOwnPropertySymbols(input).length !== 0) throw new Error(`${label} must not contain symbol fields`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label} fields must be enumerable data properties`);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function assertExactKeys(record: Record<string, unknown>, label: string, expected: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const want = [...expected].sort();
  if (actual.length !== want.length || actual.some((key, index) => key !== want[index])) throw new Error(`${label} exact keys mismatch`);
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${label}.${key} must be a string`);
  return value;
}
function readRef(record: Record<string, unknown>, key: string, label: string): string {
  const value = readString(record, key, label);
  if (!SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.startsWith("/")) throw new Error(`${label}.${key} must be safe`);
  return value;
}
function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${label}.${key} must be boolean`);
  return value;
}
function readNonNegativeInteger(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label}.${key} must be a non-negative integer`);
  return value as number;
}
function readRecord(record: Record<string, unknown>, key: string, label: string): Record<string, unknown> {
  return snapshotRecord(record[key], `${label}.${key}`);
}
function readArray(record: Record<string, unknown>, key: string, label: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${label}.${key} must be array`);
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error(`${label}.${key} must not contain symbol fields`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowedKeys = new Set(["length", ...Array.from({ length: value.length }, (_, index) => String(index))]);
  for (const propertyKey of Object.keys(descriptors)) {
    if (!allowedKeys.has(propertyKey)) throw new Error(`${label}.${key} must not contain extra fields`);
  }
  const out: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label}.${key} must contain enumerable data elements`);
    out.push(descriptor.value);
  }
  return Object.freeze(out);
}

function readCounts(record: Record<string, unknown>, label: string): RuntimeSmokeSixSlotExpansionCounts {
  assertExactKeys(record, label, COUNT_KEYS);
  return Object.freeze({
    excerpts: readNonNegativeInteger(record, "excerpts", label),
    claims: readNonNegativeInteger(record, "claims", label),
    account_objects: readNonNegativeInteger(record, "account_objects", label),
  });
}
function readObjectTypes(record: Record<string, unknown>, label: string): RuntimeSmokeSixSlotExpansionObjectTypeCounts {
  assertExactKeys(record, label, OBJECT_TYPE_KEYS);
  return Object.freeze(Object.fromEntries(OBJECT_TYPE_KEYS.map((key) => [key, readNonNegativeInteger(record, key, label)])) as unknown as RuntimeSmokeSixSlotExpansionObjectTypeCounts);
}
function readSupport(record: Record<string, unknown>, label: string): RuntimeSmokeSixSlotExpansionSupportCoverage {
  assertExactKeys(record, label, SUPPORT_KEYS);
  return Object.freeze(Object.fromEntries(SUPPORT_KEYS.map((key) => [key, readNonNegativeInteger(record, key, label)])) as unknown as RuntimeSmokeSixSlotExpansionSupportCoverage);
}
function readBoundaries(record: Record<string, unknown>): RuntimeSmokeSixSlotExpansionBoundaries {
  assertExactKeys(record, "assessment_boundaries", BOUNDARY_KEYS);
  for (const key of BOUNDARY_KEYS) {
    if (record[key] !== false) throw new Error(`assessment_boundaries.${key} must be false`);
  }
  return Object.freeze({ ...(record as unknown as RuntimeSmokeSixSlotExpansionBoundaries) });
}
function readRole(value: unknown): RuntimeSmokeSixSlotExpansionSlotStatus["role"] {
  if (value !== "representative-a" && value !== "representative-b" && value !== "edge-case-a" && value !== "edge-case-b" && value !== "calibration" && value !== "sparse-control") throw new Error("required slot roles must be representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control");
  return value;
}
function readSlot(input: unknown): RuntimeSmokeSixSlotExpansionSlotStatus {
  const record = snapshotRecord(input, "slot_status");
  assertExactKeys(record, "slot_status", SLOT_KEYS);
  const status = readString(record, "status", "slot_status");
  if (status !== "completed" && status !== "exception" && status !== "blocked") throw new Error("slot_status.status unsupported");
  return Object.freeze({
    role: readRole(record.role),
    status,
    provider_calls_executed: readNonNegativeInteger(record, "provider_calls_executed", "slot_status"),
    accepted_output_received: readBoolean(record, "accepted_output_received", "slot_status"),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", "slot_status"),
    output_counts: readCounts(readRecord(record, "output_counts", "slot_status"), "slot_status.output_counts"),
    object_type_counts: readObjectTypes(readRecord(record, "object_type_counts", "slot_status"), "slot_status.object_type_counts"),
    support_coverage: readSupport(readRecord(record, "support_coverage", "slot_status"), "slot_status.support_coverage"),
  });
}

function snapshotInput(input: unknown): RuntimeSmokeSixSlotExpansionUsefulnessInput {
  const record = snapshotRecord(input, "runtime smoke six-slot expansion usefulness input");
  assertExactKeys(record, "runtime smoke six-slot expansion usefulness input", INPUT_KEYS);
  const sourceStatus = readString(record, "source_status", "runtime smoke six-slot expansion usefulness input");
  if (sourceStatus !== "completed" && sourceStatus !== "exception" && sourceStatus !== "blocked") throw new Error("source_status unsupported");
  const roles = readArray(record, "required_slot_roles", "runtime smoke six-slot expansion usefulness input").map(readRole);
  if (roles.length !== REQUIRED_ROLES.length || REQUIRED_ROLES.some((role) => !roles.includes(role))) throw new Error("required slot roles must include representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control");
  const slots = readArray(record, "slot_statuses", "runtime smoke six-slot expansion usefulness input").map(readSlot);
  if (slots.length !== REQUIRED_ROLES.length) throw new Error("slot_statuses must include exactly six required roles");
  const roleSet = new Set(slots.map((slot) => slot.role));
  if (roleSet.size !== REQUIRED_ROLES.length || REQUIRED_ROLES.some((role) => !roleSet.has(role))) throw new Error("slot_statuses must include each required role exactly once");
  const providerCalls = readNonNegativeInteger(record, "provider_calls_executed", "runtime smoke six-slot expansion usefulness input");
  if (providerCalls > 6) throw new Error("provider_calls_executed exceeds approved six-slot-expansion cap");
  return Object.freeze({
    assessment_ref: readRef(record, "assessment_ref", "runtime smoke six-slot expansion usefulness input"),
    status_ref: readRef(record, "status_ref", "runtime smoke six-slot expansion usefulness input"),
    source_status: sourceStatus,
    provider_calls_executed: providerCalls,
    screened_account_slots: readNonNegativeInteger(record, "screened_account_slots", "runtime smoke six-slot expansion usefulness input"),
    completed_slot_count: readNonNegativeInteger(record, "completed_slot_count", "runtime smoke six-slot expansion usefulness input"),
    accepted_output_received: readBoolean(record, "accepted_output_received", "runtime smoke six-slot expansion usefulness input"),
    v2_contract_validated: readBoolean(record, "v2_contract_validated", "runtime smoke six-slot expansion usefulness input"),
    required_slot_roles: Object.freeze(roles),
    output_counts: readCounts(readRecord(record, "output_counts", "runtime smoke six-slot expansion usefulness input"), "output_counts"),
    object_type_counts: readObjectTypes(readRecord(record, "object_type_counts", "runtime smoke six-slot expansion usefulness input"), "object_type_counts"),
    support_coverage: readSupport(readRecord(record, "support_coverage", "runtime smoke six-slot expansion usefulness input"), "support_coverage"),
    slot_statuses: Object.freeze(slots),
    assessment_boundaries: readBoundaries(readRecord(record, "assessment_boundaries", "runtime smoke six-slot expansion usefulness input")),
  });
}

function addCounts(a: RuntimeSmokeSixSlotExpansionCounts, b: RuntimeSmokeSixSlotExpansionCounts): RuntimeSmokeSixSlotExpansionCounts {
  return { excerpts: a.excerpts + b.excerpts, claims: a.claims + b.claims, account_objects: a.account_objects + b.account_objects };
}
function addObjectTypes(a: RuntimeSmokeSixSlotExpansionObjectTypeCounts, b: RuntimeSmokeSixSlotExpansionObjectTypeCounts): RuntimeSmokeSixSlotExpansionObjectTypeCounts {
  const next = { ...a };
  for (const key of OBJECT_TYPE_KEYS) next[key] += b[key];
  return next;
}
function addSupport(a: RuntimeSmokeSixSlotExpansionSupportCoverage, b: RuntimeSmokeSixSlotExpansionSupportCoverage): RuntimeSmokeSixSlotExpansionSupportCoverage {
  return {
    excerpt_text_presence_count: a.excerpt_text_presence_count + b.excerpt_text_presence_count,
    claim_text_presence_count: a.claim_text_presence_count + b.claim_text_presence_count,
    claim_supported_count: a.claim_supported_count + b.claim_supported_count,
    account_object_summary_presence_count: a.account_object_summary_presence_count + b.account_object_summary_presence_count,
    account_object_supported_count: a.account_object_supported_count + b.account_object_supported_count,
  };
}
function equalCounts(a: RuntimeSmokeSixSlotExpansionCounts, b: RuntimeSmokeSixSlotExpansionCounts): boolean {
  return a.excerpts === b.excerpts && a.claims === b.claims && a.account_objects === b.account_objects;
}
function lensCounts(types: RuntimeSmokeSixSlotExpansionObjectTypeCounts): Record<RuntimeSmokeSixSlotExpansionLens, number> {
  return Object.freeze({
    maps: types.account_snapshot + types.map + types.stakeholder + types.initiative,
    signals: types.signal + types.risk + types.open_question,
    plays: types.play + types.recommendation,
  });
}
function objectTypeTotal(types: RuntimeSmokeSixSlotExpansionObjectTypeCounts): number {
  return OBJECT_TYPE_KEYS.reduce((sum, key) => sum + types[key], 0);
}
function equalObjectTypes(a: RuntimeSmokeSixSlotExpansionObjectTypeCounts, b: RuntimeSmokeSixSlotExpansionObjectTypeCounts): boolean {
  return OBJECT_TYPE_KEYS.every((key) => a[key] === b[key]);
}
function equalSupport(a: RuntimeSmokeSixSlotExpansionSupportCoverage, b: RuntimeSmokeSixSlotExpansionSupportCoverage): boolean {
  return SUPPORT_KEYS.every((key) => a[key] === b[key]);
}
function supportComplete(support: RuntimeSmokeSixSlotExpansionSupportCoverage, counts: RuntimeSmokeSixSlotExpansionCounts): boolean {
  return (
    support.excerpt_text_presence_count === counts.excerpts &&
    support.claim_text_presence_count === counts.claims &&
    support.claim_supported_count === counts.claims &&
    support.account_object_summary_presence_count === counts.account_objects &&
    support.account_object_supported_count === counts.account_objects
  );
}
function addReason(reasons: RuntimeSmokeSixSlotExpansionReason[], code: RuntimeSmokeSixSlotExpansionReasonCode, message: string, observed: number, threshold: number): void {
  reasons.push(Object.freeze({ code, message, observed, threshold }));
}

export function assessRuntimeSmokeSixSlotExpansionUsefulness(input: unknown): RuntimeSmokeSixSlotExpansionUsefulnessAssessment {
  const snapshot = snapshotInput(input);
  const reasons: RuntimeSmokeSixSlotExpansionReason[] = [];
  const aggregateFromSlots = snapshot.slot_statuses.reduce((sum, slot) => addCounts(sum, slot.output_counts), { excerpts: 0, claims: 0, account_objects: 0 });
  const objectTypesFromSlots = snapshot.slot_statuses.reduce(
    (sum, slot) => addObjectTypes(sum, slot.object_type_counts),
    Object.fromEntries(OBJECT_TYPE_KEYS.map((key) => [key, 0])) as unknown as RuntimeSmokeSixSlotExpansionObjectTypeCounts,
  );
  const supportFromSlots = snapshot.slot_statuses.reduce(
    (sum, slot) => addSupport(sum, slot.support_coverage),
    { excerpt_text_presence_count: 0, claim_text_presence_count: 0, claim_supported_count: 0, account_object_summary_presence_count: 0, account_object_supported_count: 0 },
  );
  const countsByLens = lensCounts(snapshot.object_type_counts);
  if (snapshot.source_status !== "completed" || !snapshot.accepted_output_received || !snapshot.v2_contract_validated) {
    addReason(reasons, "source_status_not_completed", "source status did not complete with accepted contract-valid output", 0, 1);
  }
  if (snapshot.provider_calls_executed !== 6) addReason(reasons, "provider_call_count_mismatch", "provider calls did not equal the approved six-slot scope", snapshot.provider_calls_executed, 6);
  if (snapshot.screened_account_slots !== 6 || snapshot.completed_slot_count !== 6 || snapshot.slot_statuses.length !== 6) {
    addReason(reasons, "slot_count_mismatch", "slot counts did not match the approved six-slot scope", snapshot.completed_slot_count, 6);
  }
  if (!equalCounts(aggregateFromSlots, snapshot.output_counts) || objectTypeTotal(snapshot.object_type_counts) !== snapshot.output_counts.account_objects) {
    addReason(reasons, "aggregate_count_mismatch", "aggregate counts did not match per-slot counts", aggregateFromSlots.account_objects, snapshot.output_counts.account_objects);
  }
  if (!equalObjectTypes(objectTypesFromSlots, snapshot.object_type_counts)) {
    addReason(reasons, "aggregate_count_mismatch", "aggregate object type counts did not match per-slot counts", objectTypeTotal(objectTypesFromSlots), objectTypeTotal(snapshot.object_type_counts));
  }
  if (!equalSupport(supportFromSlots, snapshot.support_coverage)) {
    addReason(reasons, "aggregate_count_mismatch", "aggregate support coverage did not match per-slot coverage", supportFromSlots.account_object_supported_count, snapshot.support_coverage.account_object_supported_count);
  }
  if (!supportComplete(snapshot.support_coverage, snapshot.output_counts) || !supportComplete(supportFromSlots, aggregateFromSlots)) {
    addReason(reasons, "missing_support_coverage", "support coverage did not match public output counts", snapshot.support_coverage.account_object_supported_count, snapshot.output_counts.account_objects);
  }
  for (const slot of snapshot.slot_statuses) {
    if (slot.status !== "completed" || slot.provider_calls_executed !== 1 || !slot.accepted_output_received || !slot.v2_contract_validated) {
      addReason(reasons, "slot_not_completed", `slot ${slot.role} did not complete as an accepted one-call contract-valid output`, slot.provider_calls_executed, 1);
    }
    if (objectTypeTotal(slot.object_type_counts) !== slot.output_counts.account_objects) {
      addReason(reasons, "aggregate_count_mismatch", `slot ${slot.role} object type counts did not match its output count`, objectTypeTotal(slot.object_type_counts), slot.output_counts.account_objects);
    }
    if (!supportComplete(slot.support_coverage, slot.output_counts)) {
      addReason(reasons, "missing_support_coverage", `slot ${slot.role} support coverage did not match its output counts`, slot.support_coverage.account_object_supported_count, slot.output_counts.account_objects);
    }
    if (slot.output_counts.excerpts < 3 || slot.output_counts.claims < 2 || slot.output_counts.account_objects < 1) {
      addReason(reasons, "slot_underproduced", `slot ${slot.role} did not meet minimum public output counts`, slot.output_counts.account_objects, 1);
    }
  }
  for (const lens of REQUIRED_ROLES.length ? (["signals", "maps", "plays"] as const) : []) {
    if (countsByLens[lens] < 1) addReason(reasons, "missing_required_lens", `missing required ${lens} lens coverage`, countsByLens[lens], 1);
  }

  const contractFailure = reasons.some((reason) => reason.code !== "slot_underproduced");
  const classification: RuntimeSmokeSixSlotExpansionClassification = reasons.length === 0 ? "useful" : contractFailure ? "contract-failure" : "weak-but-valid";
  const usefulLenses = (["signals", "maps", "plays"] as const).filter((lens) => countsByLens[lens] > 0);
  return Object.freeze({
    assessment_ref: snapshot.assessment_ref,
    status_ref: snapshot.status_ref,
    status: classification === "useful" ? "pass" : "fail",
    usefulness_classification: classification,
    useful_lenses: Object.freeze(usefulLenses),
    reasons: Object.freeze(reasons),
    metrics: Object.freeze({
      provider_calls_executed_source: snapshot.provider_calls_executed,
      provider_calls_executed_by_assessment: 0,
      screened_account_slots: snapshot.screened_account_slots,
      completed_slot_count: snapshot.completed_slot_count,
      output_counts: Object.freeze({ ...snapshot.output_counts }),
      object_type_counts: Object.freeze({ ...snapshot.object_type_counts }),
      support_coverage: Object.freeze({ ...snapshot.support_coverage }),
      lens_counts: countsByLens,
    }),
    recommends_next_step: classification === "useful" ? "separate-reviewed-next-approval-required" : classification === "weak-but-valid" ? "no-spend-remediation-first" : "stop-live-expansion",
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
    safety: snapshot.assessment_boundaries,
  });
}
