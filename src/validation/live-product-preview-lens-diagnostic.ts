// Deterministic no-spend diagnostic for weak live product-preview lens coverage.
//
// This helper consumes only sanitized aggregate graph/lens facts. It never reads
// private evidence, env, provider credentials, or raw graph text; it does not
// approve live reruns, provider comparison, expansion, spend, or readiness.

export type LiveProductPreviewDiagnosticLens = "signals" | "maps" | "plays";

export type LiveProductPreviewLensDiagnosticClassification =
  | "structure-present-mapping-gap"
  | "structure-absent-account-limitation"
  | "insufficient-sanitized-evidence"
  | "contract-failure";

export type LiveProductPreviewLensDiagnosticTerminalAction =
  | "fix_workshop_lens_mapping_against_existing_outputs"
  | "stop_current_account_remediation"
  | "stop_until_sanitized_graph_lens_counts_exist"
  | "stop_until_contract_failure_is_fixed";

export type LiveProductPreviewLensDiagnosticAllowedFollowup =
  | "deterministic_workshop_lens_mapping_fix"
  | "use_existing_three_lane_fixture_for_mapping_validation"
  | "publish_sanitized_graph_lens_count_fixture"
  | "repair_validation_contract_before_lens_remediation";

export type LiveProductPreviewLensDiagnosticBlockedAction =
  | "live_provider_rerun"
  | "provider_comparison"
  | "corpus_expansion"
  | "product_preview_expansion"
  | "prompt_or_schema_pressure_for_unsupported_lens_content"
  | "launch_readiness_claim"
  | "product_readiness_claim"
  | "production_readiness_claim";

export interface LiveProductPreviewLensDiagnosticCounts {
  signals: number;
  maps: number;
  plays: number;
}

export interface LiveProductPreviewLensDiagnosticInput {
  preview_ref: string;
  source_classification: "weak-but-valid";
  source_reason_codes: readonly ["insufficient_useful_lenses"];
  validation_status: {
    graph_validation: "passed" | "failed";
    quality_gate: "pass" | "fail";
    workshop_preview: "passed" | "failed";
  };
  output_counts: {
    excerpts: number;
    claims: number;
    account_objects: number;
  };
  graph_supported_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
  workshop_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
  useful_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
  useful_lenses: readonly LiveProductPreviewDiagnosticLens[];
  fixture_validation_candidates: readonly string[];
  safety: {
    live_provider_call: false;
    provider_spend: false;
    production_writes: false;
    runtime_model_mode_integration: false;
    provider_or_model_comparison: false;
    corpus_expansion: false;
    product_preview_expansion: false;
    web_search_or_tools: false;
  };
}

export interface LiveProductPreviewLensDiagnosticReport {
  ok: false;
  status: "decision";
  preview_ref: string;
  classification: LiveProductPreviewLensDiagnosticClassification;
  terminal_next_action: LiveProductPreviewLensDiagnosticTerminalAction;
  allowed_no_spend_followups: readonly LiveProductPreviewLensDiagnosticAllowedFollowup[];
  blocked_next_actions: readonly LiveProductPreviewLensDiagnosticBlockedAction[];
  launch_readiness_claim: false;
  product_readiness_claim: false;
  production_readiness_claim: false;
  approves_live_provider_call: false;
  approves_provider_spend: false;
  approves_expansion_or_comparison: false;
  diagnostic_basis: {
    output_counts: LiveProductPreviewLensDiagnosticInput["output_counts"];
    graph_supported_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
    workshop_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
    useful_lens_item_counts: LiveProductPreviewLensDiagnosticCounts;
    useful_lenses: readonly LiveProductPreviewDiagnosticLens[];
    present_supported_lenses: readonly LiveProductPreviewDiagnosticLens[];
    absent_supported_lenses: readonly LiveProductPreviewDiagnosticLens[];
    unsurfaced_supported_lenses: readonly LiveProductPreviewDiagnosticLens[];
    fixture_validation_candidates: readonly string[];
    exit_criterion_met: false;
    exit_criterion: "two_materially_useful_lenses_in_fixture_mode_against_supported_existing_outputs";
  };
  safety: LiveProductPreviewLensDiagnosticInput["safety"];
}

const SAFE_PREVIEW_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LENSES: readonly LiveProductPreviewDiagnosticLens[] = ["signals", "maps", "plays"];
const BLOCKED_NEXT_ACTIONS: readonly LiveProductPreviewLensDiagnosticBlockedAction[] = Object.freeze([
  "live_provider_rerun",
  "provider_comparison",
  "corpus_expansion",
  "product_preview_expansion",
  "prompt_or_schema_pressure_for_unsupported_lens_content",
  "launch_readiness_claim",
  "product_readiness_claim",
  "production_readiness_claim",
]);

function rejectInput(): never {
  throw new Error("live product preview lens diagnostic input rejected");
}

function assertPlainRecord(value: unknown): asserts value is Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) rejectInput();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) rejectInput();
  } catch {
    rejectInput();
  }
}

function assertExactOwnDataKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(record);
    symbols = Object.getOwnPropertySymbols(record);
  } catch {
    rejectInput();
  }
  if (symbols.length > 0 || names.length !== allowedKeys.length) rejectInput();
  for (const name of names) {
    if (!allowedKeys.includes(name)) rejectInput();
  }
  for (const key of allowedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(record, key);
    } catch {
      rejectInput();
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) rejectInput();
  }
}

function readOwnDataField(record: Record<string, unknown>, field: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    rejectInput();
  }
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) rejectInput();
  return descriptor.value;
}

function readRecord(record: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = readOwnDataField(record, field);
  assertPlainRecord(value);
  return value;
}

function readString(record: Record<string, unknown>, field: string): string {
  const value = readOwnDataField(record, field);
  if (typeof value !== "string") rejectInput();
  return value;
}

function readFalse(record: Record<string, unknown>, field: string): false {
  const value = readOwnDataField(record, field);
  if (value !== false) rejectInput();
  return false;
}

function readNonNegativeInteger(record: Record<string, unknown>, field: string): number {
  const value = readOwnDataField(record, field);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) rejectInput();
  return value;
}

function assertSafePreviewRef(previewRef: string): void {
  if (
    !SAFE_PREVIEW_REF.test(previewRef) ||
    previewRef.includes("..") ||
    previewRef.includes("://") ||
    previewRef.includes("/") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(previewRef)
  ) {
    rejectInput();
  }
}

function readLensCounts(record: Record<string, unknown>, field: string): LiveProductPreviewLensDiagnosticCounts {
  const counts = readRecord(record, field);
  assertExactOwnDataKeys(counts, LENSES);
  return Object.freeze({
    signals: readNonNegativeInteger(counts, "signals"),
    maps: readNonNegativeInteger(counts, "maps"),
    plays: readNonNegativeInteger(counts, "plays"),
  });
}

function readOutputCounts(record: Record<string, unknown>): LiveProductPreviewLensDiagnosticInput["output_counts"] {
  const output = readRecord(record, "output_counts");
  assertExactOwnDataKeys(output, ["excerpts", "claims", "account_objects"]);
  return Object.freeze({
    excerpts: readNonNegativeInteger(output, "excerpts"),
    claims: readNonNegativeInteger(output, "claims"),
    account_objects: readNonNegativeInteger(output, "account_objects"),
  });
}

function readExactStringArray<T extends string>(value: unknown, allowed: readonly T[], maxLength: number): readonly T[] {
  let length: number;
  try {
    if (!Array.isArray(value)) rejectInput();
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor) || typeof lengthDescriptor.value !== "number") rejectInput();
    length = lengthDescriptor.value;
  } catch {
    rejectInput();
  }
  if (!Number.isInteger(length) || length < 0 || length > maxLength) rejectInput();

  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    rejectInput();
  }
  const expectedNames = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  if (symbols.length > 0 || names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
    rejectInput();
  }

  const result: T[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value as readonly unknown[], String(index));
    } catch {
      rejectInput();
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") rejectInput();
    if (!allowed.includes(descriptor.value as T) || result.includes(descriptor.value as T)) rejectInput();
    result.push(descriptor.value as T);
  }
  return Object.freeze(result);
}

function readFixtureCandidates(value: unknown): readonly string[] {
  const candidates = readExactStringArray(value, ["fixtures/graph/valid/workshop-three-lane.json"] as const, 1);
  if (candidates.length !== 1) rejectInput();
  return candidates;
}

function readValidationStatus(record: Record<string, unknown>): LiveProductPreviewLensDiagnosticInput["validation_status"] {
  const status = readRecord(record, "validation_status");
  assertExactOwnDataKeys(status, ["graph_validation", "quality_gate", "workshop_preview"]);
  const graphValidation = readString(status, "graph_validation");
  const qualityGate = readString(status, "quality_gate");
  const workshopPreview = readString(status, "workshop_preview");
  if ((graphValidation !== "passed" && graphValidation !== "failed") || (qualityGate !== "pass" && qualityGate !== "fail") || (workshopPreview !== "passed" && workshopPreview !== "failed")) {
    rejectInput();
  }
  return Object.freeze({ graph_validation: graphValidation, quality_gate: qualityGate, workshop_preview: workshopPreview });
}

function readSafety(record: Record<string, unknown>): LiveProductPreviewLensDiagnosticInput["safety"] {
  const safety = readRecord(record, "safety");
  assertExactOwnDataKeys(safety, [
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
    live_provider_call: readFalse(safety, "live_provider_call"),
    provider_spend: readFalse(safety, "provider_spend"),
    production_writes: readFalse(safety, "production_writes"),
    runtime_model_mode_integration: readFalse(safety, "runtime_model_mode_integration"),
    provider_or_model_comparison: readFalse(safety, "provider_or_model_comparison"),
    corpus_expansion: readFalse(safety, "corpus_expansion"),
    product_preview_expansion: readFalse(safety, "product_preview_expansion"),
    web_search_or_tools: readFalse(safety, "web_search_or_tools"),
  });
}

function snapshotInput(input: unknown): Required<LiveProductPreviewLensDiagnosticInput> {
  try {
    assertPlainRecord(input);
    assertExactOwnDataKeys(input, [
      "preview_ref",
      "source_classification",
      "source_reason_codes",
      "validation_status",
      "output_counts",
      "graph_supported_lens_item_counts",
      "workshop_lens_item_counts",
      "useful_lens_item_counts",
      "useful_lenses",
      "fixture_validation_candidates",
      "safety",
    ]);
    const previewRef = readString(input, "preview_ref");
    assertSafePreviewRef(previewRef);
    if (readString(input, "source_classification") !== "weak-but-valid") rejectInput();
    const sourceReasonCodes = readExactStringArray(readOwnDataField(input, "source_reason_codes"), ["insufficient_useful_lenses"] as const, 1);
    if (sourceReasonCodes.length !== 1 || sourceReasonCodes[0] !== "insufficient_useful_lenses") rejectInput();
    const outputCounts = readOutputCounts(input);
    const graphSupportedLensItemCounts = readLensCounts(input, "graph_supported_lens_item_counts");
    const workshopLensItemCounts = readLensCounts(input, "workshop_lens_item_counts");
    const usefulLensItemCounts = readLensCounts(input, "useful_lens_item_counts");
    const usefulLenses = readExactStringArray(readOwnDataField(input, "useful_lenses"), LENSES, LENSES.length);
    const derivedUsefulLenses = LENSES.filter((lens) => usefulLensItemCounts[lens] > 0);
    if (usefulLenses.length !== derivedUsefulLenses.length || usefulLenses.some((lens, index) => lens !== derivedUsefulLenses[index])) rejectInput();
    if (usefulLenses.length >= 2) rejectInput();
    for (const lens of LENSES) {
      if (usefulLensItemCounts[lens] > workshopLensItemCounts[lens]) rejectInput();
      if (workshopLensItemCounts[lens] > graphSupportedLensItemCounts[lens]) rejectInput();
    }
    return Object.freeze({
      preview_ref: previewRef,
      source_classification: "weak-but-valid",
      source_reason_codes: ["insufficient_useful_lenses"] as const,
      validation_status: readValidationStatus(input),
      output_counts: outputCounts,
      graph_supported_lens_item_counts: graphSupportedLensItemCounts,
      workshop_lens_item_counts: workshopLensItemCounts,
      useful_lens_item_counts: usefulLensItemCounts,
      useful_lenses: usefulLenses,
      fixture_validation_candidates: readFixtureCandidates(readOwnDataField(input, "fixture_validation_candidates")),
      safety: readSafety(input),
    });
  } catch {
    rejectInput();
  }
}

function lensesWhere(counts: LiveProductPreviewLensDiagnosticCounts, predicate: (count: number) => boolean): readonly LiveProductPreviewDiagnosticLens[] {
  return Object.freeze(LENSES.filter((lens) => predicate(counts[lens])));
}

function followups(values: readonly LiveProductPreviewLensDiagnosticAllowedFollowup[]): readonly LiveProductPreviewLensDiagnosticAllowedFollowup[] {
  return Object.freeze([...values]);
}

function classify(snapshot: Required<LiveProductPreviewLensDiagnosticInput>): {
  classification: LiveProductPreviewLensDiagnosticClassification;
  terminal_next_action: LiveProductPreviewLensDiagnosticTerminalAction;
  allowed_no_spend_followups: readonly LiveProductPreviewLensDiagnosticAllowedFollowup[];
} {
  if (
    snapshot.validation_status.graph_validation !== "passed" ||
    snapshot.validation_status.quality_gate !== "pass" ||
    snapshot.validation_status.workshop_preview !== "passed"
  ) {
    return Object.freeze({
      classification: "contract-failure",
      terminal_next_action: "stop_until_contract_failure_is_fixed",
      allowed_no_spend_followups: followups(["repair_validation_contract_before_lens_remediation"]),
    });
  }

  const totalOutput = snapshot.output_counts.excerpts + snapshot.output_counts.claims + snapshot.output_counts.account_objects;
  const totalSupported = snapshot.graph_supported_lens_item_counts.signals + snapshot.graph_supported_lens_item_counts.maps + snapshot.graph_supported_lens_item_counts.plays;
  if (totalOutput === 0 || totalSupported === 0) {
    return Object.freeze({
      classification: "insufficient-sanitized-evidence",
      terminal_next_action: "stop_until_sanitized_graph_lens_counts_exist",
      allowed_no_spend_followups: followups(["publish_sanitized_graph_lens_count_fixture"]),
    });
  }

  const unsurfacedMapsOrPlays = (["maps", "plays"] as const).filter(
    (lens) => snapshot.graph_supported_lens_item_counts[lens] > 0 && snapshot.useful_lens_item_counts[lens] === 0,
  );
  if (unsurfacedMapsOrPlays.length > 0) {
    return Object.freeze({
      classification: "structure-present-mapping-gap",
      terminal_next_action: "fix_workshop_lens_mapping_against_existing_outputs",
      allowed_no_spend_followups: followups(["deterministic_workshop_lens_mapping_fix"]),
    });
  }

  return Object.freeze({
    classification: "structure-absent-account-limitation",
    terminal_next_action: "stop_current_account_remediation",
    allowed_no_spend_followups: followups(["use_existing_three_lane_fixture_for_mapping_validation"]),
  });
}

export function classifyLiveProductPreviewLensDiagnostic(input: unknown): LiveProductPreviewLensDiagnosticReport {
  const snapshot = snapshotInput(input);
  const decision = classify(snapshot);
  const presentSupportedLenses = lensesWhere(snapshot.graph_supported_lens_item_counts, (count) => count > 0);
  const absentSupportedLenses = lensesWhere(snapshot.graph_supported_lens_item_counts, (count) => count === 0);
  const unsurfacedSupportedLenses = Object.freeze(presentSupportedLenses.filter((lens) => snapshot.useful_lens_item_counts[lens] === 0));

  return Object.freeze({
    ok: false,
    status: "decision",
    preview_ref: snapshot.preview_ref,
    classification: decision.classification,
    terminal_next_action: decision.terminal_next_action,
    allowed_no_spend_followups: decision.allowed_no_spend_followups,
    blocked_next_actions: BLOCKED_NEXT_ACTIONS,
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    approves_live_provider_call: false,
    approves_provider_spend: false,
    approves_expansion_or_comparison: false,
    diagnostic_basis: Object.freeze({
      output_counts: snapshot.output_counts,
      graph_supported_lens_item_counts: snapshot.graph_supported_lens_item_counts,
      workshop_lens_item_counts: snapshot.workshop_lens_item_counts,
      useful_lens_item_counts: snapshot.useful_lens_item_counts,
      useful_lenses: snapshot.useful_lenses,
      present_supported_lenses: presentSupportedLenses,
      absent_supported_lenses: absentSupportedLenses,
      unsurfaced_supported_lenses: unsurfacedSupportedLenses,
      fixture_validation_candidates: snapshot.fixture_validation_candidates,
      exit_criterion_met: false,
      exit_criterion: "two_materially_useful_lenses_in_fixture_mode_against_supported_existing_outputs",
    }),
    safety: snapshot.safety,
  });
}
