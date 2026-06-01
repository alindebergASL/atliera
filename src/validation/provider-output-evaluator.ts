// Deterministic no-spend evaluator for synthetic provider outputs.
//
// This helper does not call models, read credentials, access the network, write
// production data, or authorize provider runs. It converts already-captured
// synthetic output text into bounded quality checks so provider experiments do
// not masquerade as product-readiness evidence.

export type ProviderOutputCheck =
  | "required_keys_only"
  | "arithmetic_total_equals_phase_sum"
  | "synthetic_signal_map_play_coverage";

export type ProviderOutputEvaluatorReasonCode =
  | "invalid_case"
  | "invalid_json"
  | "parsed_output_not_object"
  | "missing_required_key"
  | "unexpected_key"
  | "arithmetic_fields_invalid"
  | "arithmetic_total_mismatch"
  | "missing_signal_map_play_coverage";

export interface ProviderOutputCaseInput {
  case_id: string;
  check: ProviderOutputCheck;
  required_keys: readonly string[];
  output_text: string;
}

export interface ProviderOutputBenchmarkInput {
  benchmark_id: string;
  cases: readonly ProviderOutputCaseInput[];
}

export interface ProviderOutputEvaluatorReason {
  code: ProviderOutputEvaluatorReasonCode;
  message: string;
  observed?: unknown;
  expected?: unknown;
}

export interface ProviderOutputCaseResult {
  case_id: string;
  ok: boolean;
  valid_json: boolean;
  schema_ok: boolean;
  semantic_ok: boolean;
  check: ProviderOutputCheck;
  reasons: readonly ProviderOutputEvaluatorReason[];
}

export interface ProviderOutputBenchmarkReport {
  ok: boolean;
  benchmark_id: string;
  summary: {
    cases: number;
    passed: number;
    failed: number;
  };
  checks: readonly ProviderOutputCaseResult[];
  authorizes_provider_run: false;
  authorizes_production_use: false;
  launch_readiness_claim: false;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CHECKS: readonly ProviderOutputCheck[] = [
  "required_keys_only",
  "arithmetic_total_equals_phase_sum",
  "synthetic_signal_map_play_coverage",
];
const EPSILON = 1e-9;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isProviderOutputCheck(value: unknown): value is ProviderOutputCheck {
  return typeof value === "string" && CHECKS.includes(value as ProviderOutputCheck);
}

function invalidCaseResult(caseId: string, check: ProviderOutputCheck, message: string): ProviderOutputCaseResult {
  const reasons: readonly ProviderOutputEvaluatorReason[] = Object.freeze([{ code: "invalid_case", message }]);
  return Object.freeze({
    case_id: caseId,
    ok: false,
    valid_json: false,
    schema_ok: false,
    semantic_ok: false,
    check,
    reasons,
  });
}

function snapshotCase(input: ProviderOutputCaseInput): ProviderOutputCaseInput | ProviderOutputCaseResult {
  if (!isPlainRecord(input)) {
    return invalidCaseResult("invalid-case", "required_keys_only", "case must be a plain object");
  }

  const caseId = input.case_id;
  if (typeof caseId !== "string" || !SAFE_ID.test(caseId)) {
    return invalidCaseResult("invalid-case", "required_keys_only", "case_id must be a safe logical id");
  }

  const check = input.check;
  if (!isProviderOutputCheck(check)) {
    return invalidCaseResult(caseId, "required_keys_only", "check must be a supported deterministic evaluator check");
  }

  if (!Array.isArray(input.required_keys)) {
    return invalidCaseResult(caseId, check, "required_keys must be an array");
  }
  const requiredKeys = input.required_keys.map((key) => {
    if (typeof key !== "string" || !SAFE_ID.test(key)) {
      throw new Error("required_keys must contain safe string keys");
    }
    return key;
  });

  if (typeof input.output_text !== "string") {
    return invalidCaseResult(caseId, check, "output_text must be a string");
  }

  return Object.freeze({
    case_id: caseId,
    check,
    required_keys: Object.freeze([...requiredKeys]),
    output_text: input.output_text,
  });
}

function parseStrictJson(outputText: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(outputText) };
  } catch {
    return { ok: false };
  }
}

function checkRequiredKeysOnly(parsed: Record<string, unknown>, requiredKeys: readonly string[]): ProviderOutputEvaluatorReason[] {
  const reasons: ProviderOutputEvaluatorReason[] = [];
  const names = Object.keys(parsed);
  const expected = new Set(requiredKeys);
  const observed = new Set(names);

  for (const key of requiredKeys) {
    if (!observed.has(key)) {
      reasons.push({ code: "missing_required_key", message: `missing required key: ${key}`, expected: key });
    }
  }
  for (const key of names) {
    if (!expected.has(key)) {
      reasons.push({ code: "unexpected_key", message: `unexpected top-level key: ${key}`, observed: key });
    }
  }

  return reasons;
}

function checkArithmeticTotal(parsed: Record<string, unknown>): ProviderOutputEvaluatorReason[] {
  const totalHours = parsed.total_hours;
  const phaseHours = parsed.phase_hours;
  if (typeof totalHours !== "number" || !Number.isFinite(totalHours) || !isPlainRecord(phaseHours)) {
    return [{ code: "arithmetic_fields_invalid", message: "total_hours must be finite and phase_hours must be an object" }];
  }

  let sum = 0;
  for (const [phase, hours] of Object.entries(phaseHours)) {
    if (typeof hours !== "number" || !Number.isFinite(hours)) {
      return [{ code: "arithmetic_fields_invalid", message: `phase ${phase} must have finite numeric hours` }];
    }
    sum += hours;
  }

  if (Math.abs(sum - totalHours) > EPSILON) {
    return [
      {
        code: "arithmetic_total_mismatch",
        message: "total_hours must equal the sum of phase_hours",
        observed: totalHours,
        expected: sum,
      },
    ];
  }
  return [];
}

function hasNonEmptyRecordArray(value: unknown, requiredFields: readonly string[]): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const item of value) {
    if (!isPlainRecord(item)) return false;
    for (const field of requiredFields) {
      if (typeof item[field] !== "string" || item[field].trim() === "") return false;
    }
  }
  return true;
}

function checkSyntheticSignalMapPlayCoverage(parsed: Record<string, unknown>): ProviderOutputEvaluatorReason[] {
  const ok =
    hasNonEmptyRecordArray(parsed.signals, ["claim", "support"]) &&
    hasNonEmptyRecordArray(parsed.maps, ["object", "relationships"]) &&
    hasNonEmptyRecordArray(parsed.plays, ["action", "timing"]) &&
    Array.isArray(parsed.open_questions) &&
    parsed.open_questions.length > 0 &&
    parsed.open_questions.every((question) => typeof question === "string" && question.trim() !== "");

  return ok
    ? []
    : [
        {
          code: "missing_signal_map_play_coverage",
          message: "synthetic Signal/Map/Play output must include non-empty supported signals, maps, plays, and open questions",
        },
      ];
}

export function evaluateProviderOutputCase(input: ProviderOutputCaseInput): ProviderOutputCaseResult {
  let snapshot: ProviderOutputCaseInput | ProviderOutputCaseResult;
  try {
    snapshot = snapshotCase(input);
  } catch (error) {
    return invalidCaseResult(
      isPlainRecord(input) && typeof input.case_id === "string" ? input.case_id : "invalid-case",
      isPlainRecord(input) && isProviderOutputCheck(input.check) ? input.check : "required_keys_only",
      error instanceof Error ? error.message : "invalid case",
    );
  }
  if ("ok" in snapshot) return snapshot;

  const parsed = parseStrictJson(snapshot.output_text);
  if (!parsed.ok) {
    const reasons: readonly ProviderOutputEvaluatorReason[] = Object.freeze([
      { code: "invalid_json", message: "output_text must be strict JSON without markdown fences" },
    ]);
    return Object.freeze({
      case_id: snapshot.case_id,
      ok: false,
      valid_json: false,
      schema_ok: false,
      semantic_ok: false,
      check: snapshot.check,
      reasons,
    });
  }

  if (!isPlainRecord(parsed.value)) {
    const reasons: readonly ProviderOutputEvaluatorReason[] = Object.freeze([
      { code: "parsed_output_not_object", message: "parsed output must be a JSON object" },
    ]);
    return Object.freeze({
      case_id: snapshot.case_id,
      ok: false,
      valid_json: true,
      schema_ok: false,
      semantic_ok: false,
      check: snapshot.check,
      reasons,
    });
  }

  const schemaReasons = checkRequiredKeysOnly(parsed.value, snapshot.required_keys);
  const semanticReasons =
    snapshot.check === "arithmetic_total_equals_phase_sum"
      ? checkArithmeticTotal(parsed.value)
      : snapshot.check === "synthetic_signal_map_play_coverage"
        ? checkSyntheticSignalMapPlayCoverage(parsed.value)
        : [];

  const schemaOk = schemaReasons.length === 0;
  const semanticOk = semanticReasons.length === 0;
  const reasons = Object.freeze([...schemaReasons, ...semanticReasons]);

  return Object.freeze({
    case_id: snapshot.case_id,
    ok: schemaOk && semanticOk,
    valid_json: true,
    schema_ok: schemaOk,
    semantic_ok: semanticOk,
    check: snapshot.check,
    reasons,
  });
}

export function evaluateProviderOutputBenchmark(input: ProviderOutputBenchmarkInput): ProviderOutputBenchmarkReport {
  if (!isPlainRecord(input)) {
    throw new Error("provider output benchmark input must be a plain object");
  }
  if (typeof input.benchmark_id !== "string" || !SAFE_ID.test(input.benchmark_id)) {
    throw new Error("benchmark_id must be a safe logical id");
  }
  if (!Array.isArray(input.cases) || input.cases.length === 0 || input.cases.length > 25) {
    throw new Error("benchmark cases must contain 1 to 25 cases");
  }

  const checks = Object.freeze(input.cases.map((providerCase) => evaluateProviderOutputCase(providerCase)));
  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  return Object.freeze({
    ok: failed === 0,
    benchmark_id: input.benchmark_id,
    summary: Object.freeze({ cases: checks.length, passed, failed }),
    checks,
    authorizes_provider_run: false,
    authorizes_production_use: false,
    launch_readiness_claim: false,
  });
}
