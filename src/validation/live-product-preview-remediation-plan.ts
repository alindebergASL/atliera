// Deterministic no-spend remediation planning for weak live product-preview usefulness.
//
// This helper consumes an already-produced, already-sanitized
// LiveProductPreviewUsefulnessAssessment. It does not call providers, spend
// budget, read credentials/env, write files, approve reruns/comparisons, or make
// any readiness claim.

import type {
  LiveProductPreviewUsefulnessAssessment,
  LiveProductPreviewUsefulnessClassification,
  LiveProductPreviewUsefulnessReasonCode,
} from "./live-product-preview-usefulness.ts";

export type LiveProductPreviewRemediationArea =
  | "prompt_contract"
  | "proposal_schema"
  | "workshop_lens_mapping"
  | "product_surface_expectations"
  | "fixture_coverage";

export type LiveProductPreviewRemediationAllowedAction =
  | "no_spend_prompt_contract_revision"
  | "proposal_schema_revision"
  | "workshop_lens_mapping_review"
  | "product_surface_clarification"
  | "deterministic_fixture_update";

export type LiveProductPreviewRemediationBlockedAction =
  | "live_provider_rerun"
  | "provider_comparison"
  | "corpus_expansion"
  | "product_preview_expansion"
  | "launch_readiness_claim"
  | "product_readiness_claim"
  | "production_readiness_claim";

export type LiveProductPreviewRemediationStatus = "needs-remediation";

export interface LiveProductPreviewRemediationRuleTrigger {
  reason_code: Extract<LiveProductPreviewUsefulnessReasonCode, "underproduced_graph_output" | "insufficient_useful_lenses">;
  observed: number;
  threshold: number;
  remediation_areas: readonly LiveProductPreviewRemediationArea[];
  allowed_next_actions: readonly LiveProductPreviewRemediationAllowedAction[];
}

export interface LiveProductPreviewRemediationPlan {
  ok: false;
  status: LiveProductPreviewRemediationStatus;
  preview_ref: string;
  source_classification: "weak-but-valid";
  source_reason_codes: readonly LiveProductPreviewRemediationRuleTrigger["reason_code"][];
  launch_readiness_claim: false;
  product_readiness_claim: false;
  production_readiness_claim: false;
  approves_live_provider_call: false;
  approves_provider_spend: false;
  approves_expansion_or_comparison: false;
  remediation_areas: readonly LiveProductPreviewRemediationArea[];
  allowed_next_actions: readonly LiveProductPreviewRemediationAllowedAction[];
  blocked_next_actions: readonly LiveProductPreviewRemediationBlockedAction[];
  rules_triggered: readonly LiveProductPreviewRemediationRuleTrigger[];
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

type SnapshotReason = LiveProductPreviewRemediationRuleTrigger;

const SAFE_PREVIEW_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_REASON_CODES = ["underproduced_graph_output", "insufficient_useful_lenses"] as const;
const WORKSHOP_LENSES = ["signals", "maps", "plays"] as const;

const AREA_ORDER: readonly LiveProductPreviewRemediationArea[] = [
  "prompt_contract",
  "proposal_schema",
  "workshop_lens_mapping",
  "product_surface_expectations",
  "fixture_coverage",
];

const ACTION_ORDER: readonly LiveProductPreviewRemediationAllowedAction[] = [
  "no_spend_prompt_contract_revision",
  "proposal_schema_revision",
  "workshop_lens_mapping_review",
  "product_surface_clarification",
  "deterministic_fixture_update",
];

const BLOCKED_NEXT_ACTIONS: readonly LiveProductPreviewRemediationBlockedAction[] = [
  "live_provider_rerun",
  "provider_comparison",
  "corpus_expansion",
  "product_preview_expansion",
  "launch_readiness_claim",
  "product_readiness_claim",
  "production_readiness_claim",
];

const RULES = {
  underproduced_graph_output: {
    remediation_areas: ["prompt_contract", "proposal_schema", "fixture_coverage"],
    allowed_next_actions: [
      "no_spend_prompt_contract_revision",
      "proposal_schema_revision",
      "deterministic_fixture_update",
    ],
  },
  insufficient_useful_lenses: {
    remediation_areas: [
      "prompt_contract",
      "proposal_schema",
      "workshop_lens_mapping",
      "product_surface_expectations",
      "fixture_coverage",
    ],
    allowed_next_actions: [
      "no_spend_prompt_contract_revision",
      "proposal_schema_revision",
      "workshop_lens_mapping_review",
      "product_surface_clarification",
      "deterministic_fixture_update",
    ],
  },
} as const satisfies Readonly<Record<SnapshotReason["reason_code"], {
  remediation_areas: readonly LiveProductPreviewRemediationArea[];
  allowed_next_actions: readonly LiveProductPreviewRemediationAllowedAction[];
}>>;

function rejectAssessment(): never {
  throw new Error("live product preview remediation assessment rejected");
}

function assertPlainRecord(value: unknown): asserts value is Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) rejectAssessment();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) rejectAssessment();
  } catch {
    rejectAssessment();
  }
}

function assertExactOwnDataKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): void {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(record);
    symbols = Object.getOwnPropertySymbols(record);
  } catch {
    rejectAssessment();
  }
  if (symbols.length > 0 || names.length !== allowedKeys.length) rejectAssessment();
  for (const name of names) {
    if (!allowedKeys.includes(name)) rejectAssessment();
  }
  for (const key of allowedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(record, key);
    } catch {
      rejectAssessment();
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) rejectAssessment();
  }
}

function readOwnDataField(record: Record<string, unknown>, field: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    rejectAssessment();
  }
  if (!descriptor || !("value" in descriptor)) rejectAssessment();
  return descriptor.value;
}

function readRecord(record: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = readOwnDataField(record, field);
  assertPlainRecord(value);
  return value;
}

function readString(record: Record<string, unknown>, field: string): string {
  const value = readOwnDataField(record, field);
  if (typeof value !== "string") rejectAssessment();
  return value;
}

function readBoolean(record: Record<string, unknown>, field: string): boolean {
  const value = readOwnDataField(record, field);
  if (typeof value !== "boolean") rejectAssessment();
  return value;
}

function readFalse(record: Record<string, unknown>, field: string): false {
  if (readBoolean(record, field) !== false) rejectAssessment();
  return false;
}

function readNonNegativeInteger(record: Record<string, unknown>, field: string): number {
  const value = readOwnDataField(record, field);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) rejectAssessment();
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
    rejectAssessment();
  }
}

function readClassification(record: Record<string, unknown>): LiveProductPreviewUsefulnessClassification {
  const classification = readString(record, "preview_usefulness_classification");
  if (
    classification !== "useful" &&
    classification !== "weak-but-valid" &&
    classification !== "zero-output" &&
    classification !== "contract-failure"
  ) {
    rejectAssessment();
  }
  return classification;
}

function readStringArray(value: unknown, allowed: readonly string[]): readonly string[] {
  let length = 0;
  try {
    if (!Array.isArray(value)) rejectAssessment();
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor)) rejectAssessment();
    length = lengthDescriptor.value;
    const names = Object.getOwnPropertyNames(value);
    const symbols = Object.getOwnPropertySymbols(value);
    const expectedNames = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
    if (symbols.length > 0 || names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
      rejectAssessment();
    }
  } catch {
    rejectAssessment();
  }
  if (!Number.isInteger(length) || length < 0 || length > allowed.length) rejectAssessment();

  const result: string[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value as readonly unknown[], String(index));
    } catch {
      rejectAssessment();
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") rejectAssessment();
    if (!allowed.includes(descriptor.value) || result.includes(descriptor.value)) rejectAssessment();
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function readReasonCode(value: unknown): SnapshotReason["reason_code"] {
  if (value !== "underproduced_graph_output" && value !== "insufficient_useful_lenses") rejectAssessment();
  return value;
}

function expectedReasonMessage(code: SnapshotReason["reason_code"]): string {
  if (code === "underproduced_graph_output") {
    return "sanitized graph output is missing one or more required graph fact types";
  }
  return "fewer than the required number of Workshop lenses are materially useful";
}

function readReasons(value: unknown): readonly SnapshotReason[] {
  let length = 0;
  try {
    if (!Array.isArray(value)) rejectAssessment();
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor)) rejectAssessment();
    length = lengthDescriptor.value;
    const names = Object.getOwnPropertyNames(value);
    const symbols = Object.getOwnPropertySymbols(value);
    const expectedNames = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
    if (symbols.length > 0 || names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
      rejectAssessment();
    }
  } catch {
    rejectAssessment();
  }
  if (!Number.isInteger(length) || length <= 0 || length > ALLOWED_REASON_CODES.length) rejectAssessment();

  const reasons: SnapshotReason[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value as readonly unknown[], String(index));
    } catch {
      rejectAssessment();
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) rejectAssessment();
    const reason = descriptor.value;
    assertPlainRecord(reason);
    assertExactOwnDataKeys(reason, ["code", "severity", "message", "observed", "threshold"]);
    const code = readReasonCode(readOwnDataField(reason, "code"));
    if (reasons.some((existing) => existing.reason_code === code)) rejectAssessment();
    if (readString(reason, "severity") !== "fail") rejectAssessment();
    const message = readString(reason, "message");
    if (message !== expectedReasonMessage(code)) rejectAssessment();
    const observed = readNonNegativeInteger(reason, "observed");
    const threshold = readNonNegativeInteger(reason, "threshold");
    const rule = RULES[code];
    reasons.push(Object.freeze({
      reason_code: code,
      observed,
      threshold,
      remediation_areas: Object.freeze([...rule.remediation_areas]),
      allowed_next_actions: Object.freeze([...rule.allowed_next_actions]),
    }));
  }
  return Object.freeze(reasons);
}

function assertWeakDerivability(record: Record<string, unknown>, reasons: readonly SnapshotReason[]): void {
  const metrics = readRecord(record, "metrics");
  assertExactOwnDataKeys(metrics, ["account_count", "provider_calls_executed", "output_counts", "useful_lens_count", "useful_lenses"]);
  if (readNonNegativeInteger(metrics, "account_count") !== 1) rejectAssessment();
  if (readNonNegativeInteger(metrics, "provider_calls_executed") !== 1) rejectAssessment();
  const output = readRecord(metrics, "output_counts");
  assertExactOwnDataKeys(output, ["excerpts", "claims", "account_objects"]);
  const excerpts = readNonNegativeInteger(output, "excerpts");
  const claims = readNonNegativeInteger(output, "claims");
  const accountObjects = readNonNegativeInteger(output, "account_objects");
  const usefulLensCount = readNonNegativeInteger(metrics, "useful_lens_count");
  const usefulLenses = readStringArray(readOwnDataField(metrics, "useful_lenses"), WORKSHOP_LENSES);
  if (usefulLensCount !== usefulLenses.length) rejectAssessment();

  const reasonCodes = reasons.map((reason) => reason.reason_code);
  const totalOutput = excerpts + claims + accountObjects;
  if (totalOutput === 0) rejectAssessment();
  const shouldHaveUnderproduced = excerpts === 0 || claims === 0 || accountObjects === 0;
  if (reasonCodes.includes("underproduced_graph_output") !== shouldHaveUnderproduced) rejectAssessment();
  const shouldHaveInsufficientLenses = usefulLensCount < 2;
  if (reasonCodes.includes("insufficient_useful_lenses") !== shouldHaveInsufficientLenses) rejectAssessment();
  if (!shouldHaveUnderproduced && !shouldHaveInsufficientLenses) rejectAssessment();

  for (const reason of reasons) {
    if (reason.reason_code === "insufficient_useful_lenses") {
      if (reason.observed !== usefulLensCount || reason.threshold !== 2) rejectAssessment();
    }
    if (reason.reason_code === "underproduced_graph_output") {
      if (reason.observed !== totalOutput || reason.threshold !== 3) rejectAssessment();
    }
  }
}

function snapshotAssessment(input: unknown): { preview_ref: string; reasons: readonly SnapshotReason[] } {
  try {
    assertPlainRecord(input);
    assertExactOwnDataKeys(input, [
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
    const previewRef = readString(input, "preview_ref");
    assertSafePreviewRef(previewRef);
    if (readBoolean(input, "ok") !== false) rejectAssessment();
    if (readString(input, "status") !== "fail") rejectAssessment();
    if (readClassification(input) !== "weak-but-valid") rejectAssessment();
    readFalse(input, "launch_readiness_claim");
    readFalse(input, "product_readiness_claim");
    readFalse(input, "production_readiness_claim");
    readFalse(input, "approves_expansion_or_comparison");

    const safety = readRecord(input, "safety");
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
    readFalse(safety, "live_provider_call");
    readFalse(safety, "provider_spend");
    readFalse(safety, "production_writes");
    readFalse(safety, "runtime_model_mode_integration");
    readFalse(safety, "provider_or_model_comparison");
    readFalse(safety, "corpus_expansion");
    readFalse(safety, "product_preview_expansion");
    readFalse(safety, "web_search_or_tools");

    const reasons = readReasons(readOwnDataField(input, "reasons"));
    assertWeakDerivability(input, reasons);
    return Object.freeze({ preview_ref: previewRef, reasons });
  } catch {
    rejectAssessment();
  }
}

function orderedUnique<T extends string>(values: readonly T[], order: readonly T[]): readonly T[] {
  const set = new Set(values);
  return Object.freeze(order.filter((value) => set.has(value)));
}

export function planLiveProductPreviewUsefulnessRemediation(input: unknown): LiveProductPreviewRemediationPlan {
  const snapshot = snapshotAssessment(input);
  const remediationAreas = orderedUnique(
    snapshot.reasons.flatMap((reason) => reason.remediation_areas),
    AREA_ORDER,
  );
  const allowedNextActions = orderedUnique(
    snapshot.reasons.flatMap((reason) => reason.allowed_next_actions),
    ACTION_ORDER,
  );

  return Object.freeze({
    ok: false,
    status: "needs-remediation",
    preview_ref: snapshot.preview_ref,
    source_classification: "weak-but-valid",
    source_reason_codes: Object.freeze(snapshot.reasons.map((reason) => reason.reason_code)),
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    approves_live_provider_call: false,
    approves_provider_spend: false,
    approves_expansion_or_comparison: false,
    remediation_areas: remediationAreas,
    allowed_next_actions: allowedNextActions,
    blocked_next_actions: Object.freeze([...BLOCKED_NEXT_ACTIONS]),
    rules_triggered: Object.freeze([...snapshot.reasons]),
    safety: Object.freeze({
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
      provider_or_model_comparison: false,
      corpus_expansion: false,
      product_preview_expansion: false,
      web_search_or_tools: false,
    }),
  });
}
