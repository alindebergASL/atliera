// Deterministic no-spend usefulness assessment for the live-provider broader-batch
// non-production Workshop preview.
//
// This source-specific helper exists because the live broader-batch ledger is not
// one-provider-call-per-slot: a small bounded number of provider generations
// (some rejected by the private sanitizer, at least one validated) produced a
// larger set of screened batch slots. Overloading the generic
// `provider_calls_executed` field as a per-slot count would misreport the source
// ledger, so this helper keeps the honest provider ledger separate from the
// selected-slot count.
//
// It consumes already-produced, already-sanitized facts only. It performs no
// provider calls, no network access, no credential reads, no environment reads,
// no file reads, no production writes, and no runtime/model-mode integration. A
// useful result is only a bounded historical signal for a later separately
// reviewed approval packet; it never approves expansion, comparison, launch
// readiness, product readiness, or production readiness.

import type { WorkshopLens } from "../workshop/view-model.ts";

export type BroaderBatchPreviewUsefulnessClassification =
  | "useful"
  | "weak-but-valid"
  | "zero-output"
  | "contract-failure";

export type BroaderBatchPreviewSlotRole =
  | "representative-a"
  | "representative-b"
  | "edge-case-a"
  | "edge-case-b"
  | "calibration";

export type BroaderBatchPreviewUsefulnessStatus = "pass" | "fail";

export type BroaderBatchPreviewUsefulnessReasonCode =
  | "validation_chain_failed"
  | "request_surface_broadened"
  | "workshop_side_effect_boundary_failed"
  | "zero_output"
  | "underproduced_graph_output"
  | "insufficient_useful_lenses";

export interface BroaderBatchPreviewOutputCounts {
  excerpts: number;
  claims: number;
  account_objects: number;
}

export interface BroaderBatchPreviewSlotOutputCounts {
  role: BroaderBatchPreviewSlotRole;
  output_counts: BroaderBatchPreviewOutputCounts;
}

// The honest source provider ledger, preserved verbatim from the status doc.
// `provider_calls_executed` is the raw provider request ledger, NOT a per-slot
// or per-account count.
export interface BroaderBatchPreviewProviderLedger {
  provider_api_requests_attempted: number;
  provider_calls_executed: number;
  rejected_generations: number;
  successful_validated_generations: number;
}

export interface BroaderBatchPreviewValidationStatus {
  activation_gates: "passed" | "failed";
  credential_status: "passed" | "failed";
  provider_call: "passed" | "failed";
  response_contract: "passed" | "failed";
  cost_ledger: "succeeded" | "failed";
  graph_validation: "passed" | "failed";
  quality_gate: "pass" | "fail";
  full_pipeline_packaging: "passed" | "failed";
  bootstrap_evidence_verifier: "passed" | "failed";
  workshop_preview: "passed" | "failed";
}

export interface BroaderBatchPreviewRequestSurface {
  tools_or_plugins_requested: boolean;
  online_model_variant_requested: boolean;
  web_search_requested: boolean;
}

export interface BroaderBatchPreviewWorkshopSurface {
  html_rendered: boolean;
  provider_calls_made: number;
  production_writes: boolean;
  useful_lens_count: number;
  useful_lenses: readonly WorkshopLens[];
}

export interface BroaderBatchPreviewUsefulnessInput {
  preview_ref: string;
  selected_slot_count: number;
  provider_ledger: BroaderBatchPreviewProviderLedger;
  output_counts: BroaderBatchPreviewOutputCounts;
  slot_output_counts: readonly BroaderBatchPreviewSlotOutputCounts[];
  validation_status: BroaderBatchPreviewValidationStatus;
  request_surface: BroaderBatchPreviewRequestSurface;
  workshop_surface: BroaderBatchPreviewWorkshopSurface;
  runtime_model_mode_integration: boolean;
}

export interface BroaderBatchPreviewUsefulnessReason {
  code: BroaderBatchPreviewUsefulnessReasonCode;
  severity: BroaderBatchPreviewUsefulnessStatus;
  message: string;
  observed: number;
  threshold: number;
}

export interface BroaderBatchPreviewUsefulnessMetrics {
  selected_slot_count: number;
  provider_ledger: BroaderBatchPreviewProviderLedger;
  output_counts: BroaderBatchPreviewOutputCounts;
  slot_output_counts: readonly BroaderBatchPreviewSlotOutputCounts[];
  useful_lens_count: number;
  useful_lenses: readonly WorkshopLens[];
}

export interface BroaderBatchPreviewUsefulnessAssessment {
  ok: boolean;
  status: BroaderBatchPreviewUsefulnessStatus;
  preview_ref: string;
  preview_usefulness_classification: BroaderBatchPreviewUsefulnessClassification;
  launch_readiness_claim: false;
  product_readiness_claim: false;
  production_readiness_claim: false;
  approves_expansion_or_comparison: false;
  metrics: BroaderBatchPreviewUsefulnessMetrics;
  reasons: readonly BroaderBatchPreviewUsefulnessReason[];
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

const SAFE_PREVIEW_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WORKSHOP_LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];
const SLOT_ROLES: readonly BroaderBatchPreviewSlotRole[] = [
  "representative-a",
  "representative-b",
  "edge-case-a",
  "edge-case-b",
  "calibration",
];
const MIN_USEFUL_LENSES = 2;
const MIN_SELECTED_SLOT_COUNT = 1;
const MAX_SELECTED_SLOT_COUNT = SLOT_ROLES.length;

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
  record: Record<string, unknown>,
  label: string,
  expectedKeys: readonly string[],
): void {
  let names: string[];
  let symbols: symbol[];
  try {
    names = Object.getOwnPropertyNames(record);
    symbols = Object.getOwnPropertySymbols(record);
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
    const descriptor = Object.getOwnPropertyDescriptor(record, name);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error(`${label}.${name} must be an enumerable own data field`);
    }
  }
}

function readOwnDataField(record: Record<string, unknown>, field: string, label: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, field);
  } catch {
    throw new Error(`invalid ${label}`);
  }
  if (!descriptor || !("value" in descriptor)) {
    throw new Error(`${label}.${field} must be an own data field`);
  }
  return descriptor.value;
}

function readRecord(record: Record<string, unknown>, field: string, label: string): Record<string, unknown> {
  const value = readOwnDataField(record, field, label);
  try {
    assertPlainRecord(value, `${label}.${field}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label}.${field}`)) {
      throw error;
    }
    throw new Error(`invalid ${label}.${field}`);
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

function readBoolean(record: Record<string, unknown>, field: string, label: string): boolean {
  const value = readOwnDataField(record, field, label);
  if (typeof value !== "boolean") {
    throw new Error(`${label}.${field} must be a boolean`);
  }
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, field: string, label: string): number {
  const value = readOwnDataField(record, field, label);
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label}.${field} must be a non-negative integer`);
  }
  return value as number;
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

function assertSafePreviewRef(previewRef: string): void {
  if (
    !SAFE_PREVIEW_REF.test(previewRef) ||
    previewRef.includes("..") ||
    previewRef.includes("://") ||
    previewRef.includes("/") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(previewRef)
  ) {
    throw new Error("preview_ref must be a safe live product preview ref");
  }
}

function readSelectedSlotCount(record: Record<string, unknown>): number {
  const slotCount = readNonNegativeInteger(record, "selected_slot_count", "broader batch preview input");
  if (slotCount < MIN_SELECTED_SLOT_COUNT || slotCount > MAX_SELECTED_SLOT_COUNT) {
    throw new Error(`selected_slot_count must be between ${MIN_SELECTED_SLOT_COUNT} and ${MAX_SELECTED_SLOT_COUNT}`);
  }
  return slotCount;
}

function readProviderLedger(record: Record<string, unknown>): BroaderBatchPreviewProviderLedger {
  const ledger = readRecord(record, "provider_ledger", "broader batch preview input");
  assertExactOwnEnumerableDataKeys(ledger, "provider_ledger", [
    "provider_api_requests_attempted",
    "provider_calls_executed",
    "rejected_generations",
    "successful_validated_generations",
  ]);
  const attempted = readNonNegativeInteger(ledger, "provider_api_requests_attempted", "provider_ledger");
  const executed = readNonNegativeInteger(ledger, "provider_calls_executed", "provider_ledger");
  const rejected = readNonNegativeInteger(ledger, "rejected_generations", "provider_ledger");
  const validated = readNonNegativeInteger(ledger, "successful_validated_generations", "provider_ledger");
  if (executed !== attempted) {
    throw new Error("provider_calls_executed must equal provider_api_requests_attempted");
  }
  if (rejected + validated !== executed) {
    throw new Error("rejected_generations plus successful_validated_generations must equal provider_calls_executed");
  }
  return Object.freeze({
    provider_api_requests_attempted: attempted,
    provider_calls_executed: executed,
    rejected_generations: rejected,
    successful_validated_generations: validated,
  });
}

function readOutputCountsFrom(record: Record<string, unknown>, field: string, label: string): BroaderBatchPreviewOutputCounts {
  const output = readRecord(record, field, label);
  assertExactOwnEnumerableDataKeys(output, `${label}.${field}`, ["excerpts", "claims", "account_objects"]);
  return Object.freeze({
    excerpts: readNonNegativeInteger(output, "excerpts", `${label}.${field}`),
    claims: readNonNegativeInteger(output, "claims", `${label}.${field}`),
    account_objects: readNonNegativeInteger(output, "account_objects", `${label}.${field}`),
  });
}

function readSlotOutputCounts(
  record: Record<string, unknown>,
  selectedSlotCount: number,
): readonly BroaderBatchPreviewSlotOutputCounts[] {
  const value = readOwnDataField(record, "slot_output_counts", "broader batch preview input");
  if (!Array.isArray(value)) {
    throw new Error("slot_output_counts must be an array");
  }
  let lengthDescriptor: PropertyDescriptor | undefined;
  let names: string[];
  let symbols: symbol[];
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new Error("invalid slot_output_counts");
  }
  if (!lengthDescriptor || !("value" in lengthDescriptor)) {
    throw new Error("invalid slot_output_counts");
  }
  const length = lengthDescriptor.value;
  if (!Number.isInteger(length) || length !== selectedSlotCount) {
    throw new Error("slot_output_counts length must equal selected_slot_count");
  }
  const expectedNames = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  if (symbols.length > 0 || names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
    throw new Error("slot_output_counts must contain only array indices");
  }

  const roles = new Set<BroaderBatchPreviewSlotRole>();
  const slots: BroaderBatchPreviewSlotOutputCounts[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new Error("invalid slot_output_counts");
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error("invalid slot_output_counts");
    }
    const slot = descriptor.value;
    assertPlainRecord(slot, "slot_output_counts entry");
    assertExactOwnEnumerableDataKeys(slot, "slot_output_counts entry", ["role", "output_counts"]);
    const role = readStatus(slot, "role", "slot_output_counts entry", SLOT_ROLES);
    if (roles.has(role)) {
      throw new Error("slot_output_counts must contain distinct roles");
    }
    roles.add(role);
    slots.push(Object.freeze({
      role,
      output_counts: readOutputCountsFrom(slot, "output_counts", "slot_output_counts entry"),
    }));
  }
  return Object.freeze(slots);
}

function readValidationStatus(record: Record<string, unknown>): BroaderBatchPreviewValidationStatus {
  const validation = readRecord(record, "validation_status", "broader batch preview input");
  assertExactOwnEnumerableDataKeys(validation, "validation_status", [
    "activation_gates",
    "credential_status",
    "provider_call",
    "response_contract",
    "cost_ledger",
    "graph_validation",
    "quality_gate",
    "full_pipeline_packaging",
    "bootstrap_evidence_verifier",
    "workshop_preview",
  ]);
  const passedOrFailed = ["passed", "failed"] as const;
  return Object.freeze({
    activation_gates: readStatus(validation, "activation_gates", "validation_status", passedOrFailed),
    credential_status: readStatus(validation, "credential_status", "validation_status", passedOrFailed),
    provider_call: readStatus(validation, "provider_call", "validation_status", passedOrFailed),
    response_contract: readStatus(validation, "response_contract", "validation_status", passedOrFailed),
    cost_ledger: readStatus(validation, "cost_ledger", "validation_status", ["succeeded", "failed"] as const),
    graph_validation: readStatus(validation, "graph_validation", "validation_status", passedOrFailed),
    quality_gate: readStatus(validation, "quality_gate", "validation_status", ["pass", "fail"] as const),
    full_pipeline_packaging: readStatus(validation, "full_pipeline_packaging", "validation_status", passedOrFailed),
    bootstrap_evidence_verifier: readStatus(validation, "bootstrap_evidence_verifier", "validation_status", passedOrFailed),
    workshop_preview: readStatus(validation, "workshop_preview", "validation_status", passedOrFailed),
  });
}

function readRequestSurface(record: Record<string, unknown>): BroaderBatchPreviewRequestSurface {
  const request = readRecord(record, "request_surface", "broader batch preview input");
  assertExactOwnEnumerableDataKeys(request, "request_surface", [
    "tools_or_plugins_requested",
    "online_model_variant_requested",
    "web_search_requested",
  ]);
  return Object.freeze({
    tools_or_plugins_requested: readBoolean(request, "tools_or_plugins_requested", "request_surface"),
    online_model_variant_requested: readBoolean(request, "online_model_variant_requested", "request_surface"),
    web_search_requested: readBoolean(request, "web_search_requested", "request_surface"),
  });
}

function readUsefulLenses(record: Record<string, unknown>): readonly WorkshopLens[] {
  const value = readOwnDataField(record, "useful_lenses", "workshop_surface");
  if (!Array.isArray(value)) {
    throw new Error("workshop_surface.useful_lenses must be an array");
  }
  let lengthDescriptor: PropertyDescriptor | undefined;
  let names: string[];
  let symbols: symbol[];
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    names = Object.getOwnPropertyNames(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    throw new Error("invalid workshop_surface.useful_lenses");
  }
  if (!lengthDescriptor || !("value" in lengthDescriptor)) {
    throw new Error("invalid workshop_surface.useful_lenses");
  }
  const length = lengthDescriptor.value;
  if (!Number.isInteger(length) || length < 0 || length > WORKSHOP_LENSES.length) {
    throw new Error("workshop_surface.useful_lenses has invalid length");
  }
  const expectedNames = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  if (symbols.length > 0 || names.length !== expectedNames.size || names.some((name) => !expectedNames.has(name))) {
    throw new Error("workshop_surface.useful_lenses must contain only array indices");
  }
  const result: WorkshopLens[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new Error("invalid workshop_surface.useful_lenses");
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new Error("invalid workshop_surface.useful_lenses");
    }
    const lens = descriptor.value;
    if (!WORKSHOP_LENSES.includes(lens as WorkshopLens) || result.includes(lens as WorkshopLens)) {
      throw new Error("workshop_surface.useful_lenses contains an invalid lens");
    }
    result.push(lens as WorkshopLens);
  }
  return Object.freeze(result);
}

function readWorkshopSurface(record: Record<string, unknown>): BroaderBatchPreviewWorkshopSurface {
  const workshop = readRecord(record, "workshop_surface", "broader batch preview input");
  assertExactOwnEnumerableDataKeys(workshop, "workshop_surface", [
    "html_rendered",
    "provider_calls_made",
    "production_writes",
    "useful_lens_count",
    "useful_lenses",
  ]);
  const usefulLenses = readUsefulLenses(workshop);
  const usefulLensCount = readNonNegativeInteger(workshop, "useful_lens_count", "workshop_surface");
  if (usefulLensCount !== usefulLenses.length) {
    throw new Error("workshop_surface.useful_lens_count must match useful_lenses length");
  }
  return Object.freeze({
    html_rendered: readBoolean(workshop, "html_rendered", "workshop_surface"),
    provider_calls_made: readNonNegativeInteger(workshop, "provider_calls_made", "workshop_surface"),
    production_writes: readBoolean(workshop, "production_writes", "workshop_surface"),
    useful_lens_count: usefulLensCount,
    useful_lenses: usefulLenses,
  });
}

function snapshotInput(input: unknown): BroaderBatchPreviewUsefulnessInput {
  try {
    assertPlainRecord(input, "broader batch preview input");
    const record = input;
    assertExactOwnEnumerableDataKeys(record, "broader batch preview input", [
      "preview_ref",
      "selected_slot_count",
      "provider_ledger",
      "output_counts",
      "slot_output_counts",
      "validation_status",
      "request_surface",
      "workshop_surface",
      "runtime_model_mode_integration",
    ]);
    const previewRef = readString(record, "preview_ref", "broader batch preview input");
    assertSafePreviewRef(previewRef);
    const selectedSlotCount = readSelectedSlotCount(record);
    return Object.freeze({
      preview_ref: previewRef,
      selected_slot_count: selectedSlotCount,
      provider_ledger: readProviderLedger(record),
      output_counts: readOutputCountsFrom(record, "output_counts", "broader batch preview input"),
      slot_output_counts: readSlotOutputCounts(record, selectedSlotCount),
      validation_status: readValidationStatus(record),
      request_surface: readRequestSurface(record),
      workshop_surface: readWorkshopSurface(record),
      runtime_model_mode_integration: readBoolean(record, "runtime_model_mode_integration", "broader batch preview input"),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /safe live product preview ref|selected_slot_count must be between|provider_calls_executed must equal provider_api_requests_attempted|rejected_generations plus successful_validated_generations must equal provider_calls_executed|slot_output_counts length must equal selected_slot_count|slot_output_counts must contain distinct roles/.test(
        error.message,
      )
    ) {
      throw error;
    }
    throw new Error("invalid broader batch preview input");
  }
}

function validationChainPassed(status: BroaderBatchPreviewValidationStatus): boolean {
  return (
    status.activation_gates === "passed" &&
    status.credential_status === "passed" &&
    status.provider_call === "passed" &&
    status.response_contract === "passed" &&
    status.cost_ledger === "succeeded" &&
    status.graph_validation === "passed" &&
    status.quality_gate === "pass" &&
    status.full_pipeline_packaging === "passed" &&
    status.bootstrap_evidence_verifier === "passed" &&
    status.workshop_preview === "passed"
  );
}

function addReason(
  reasons: BroaderBatchPreviewUsefulnessReason[],
  code: BroaderBatchPreviewUsefulnessReasonCode,
  message: string,
  observed: number,
  threshold: number,
): void {
  reasons.push(Object.freeze({ code, severity: "fail", message, observed, threshold }));
}

function classify(
  input: BroaderBatchPreviewUsefulnessInput,
  reasons: BroaderBatchPreviewUsefulnessReason[],
): BroaderBatchPreviewUsefulnessClassification {
  if (!validationChainPassed(input.validation_status)) {
    addReason(reasons, "validation_chain_failed", "one or more validation-chain statuses did not pass", 0, 1);
  }

  const requestSurfaceBroadened =
    input.request_surface.tools_or_plugins_requested ||
    input.request_surface.online_model_variant_requested ||
    input.request_surface.web_search_requested;
  if (requestSurfaceBroadened) {
    addReason(reasons, "request_surface_broadened", "request surface requested tools, plugins, online mode, or web search", 1, 0);
  }

  if (
    !input.workshop_surface.html_rendered ||
    input.workshop_surface.provider_calls_made !== 0 ||
    input.workshop_surface.production_writes ||
    input.runtime_model_mode_integration
  ) {
    addReason(reasons, "workshop_side_effect_boundary_failed", "Workshop preview side-effect boundary did not hold", 1, 0);
  }

  if (reasons.length > 0) {
    return "contract-failure";
  }

  const totalOutputs = input.output_counts.excerpts + input.output_counts.claims + input.output_counts.account_objects;
  if (totalOutputs === 0) {
    addReason(reasons, "zero_output", "validated generation produced no sanitized graph facts", 0, 1);
    return "zero-output";
  }

  const minimumObservedKindOutput = Math.min(
    ...input.slot_output_counts.flatMap((slot) => [
      slot.output_counts.excerpts,
      slot.output_counts.claims,
      slot.output_counts.account_objects,
    ]),
  );
  if (minimumObservedKindOutput < 1) {
    addReason(
      reasons,
      "underproduced_graph_output",
      "one or more sanitized batch slots produced fewer than one required graph fact type",
      minimumObservedKindOutput,
      1,
    );
  }

  if (input.workshop_surface.useful_lens_count < MIN_USEFUL_LENSES) {
    addReason(
      reasons,
      "insufficient_useful_lenses",
      "fewer than the required number of Workshop lenses are materially useful",
      input.workshop_surface.useful_lens_count,
      MIN_USEFUL_LENSES,
    );
  }

  return reasons.length === 0 ? "useful" : "weak-but-valid";
}

export function assessBroaderBatchWorkshopPreviewUsefulness(
  input: unknown,
): BroaderBatchPreviewUsefulnessAssessment {
  const snapshot = snapshotInput(input);
  const reasons: BroaderBatchPreviewUsefulnessReason[] = [];
  const classification = classify(snapshot, reasons);
  const ok = classification === "useful";

  const metrics: BroaderBatchPreviewUsefulnessMetrics = Object.freeze({
    selected_slot_count: snapshot.selected_slot_count,
    provider_ledger: Object.freeze({ ...snapshot.provider_ledger }),
    output_counts: Object.freeze({ ...snapshot.output_counts }),
    slot_output_counts: Object.freeze(
      snapshot.slot_output_counts.map((slot) =>
        Object.freeze({
          role: slot.role,
          output_counts: Object.freeze({ ...slot.output_counts }),
        }),
      ),
    ),
    useful_lens_count: snapshot.workshop_surface.useful_lens_count,
    useful_lenses: Object.freeze([...snapshot.workshop_surface.useful_lenses]),
  });

  return Object.freeze({
    ok,
    status: ok ? "pass" : "fail",
    preview_ref: snapshot.preview_ref,
    preview_usefulness_classification: classification,
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    approves_expansion_or_comparison: false,
    metrics,
    reasons: Object.freeze([...reasons]),
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
