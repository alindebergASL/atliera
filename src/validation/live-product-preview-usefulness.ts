// Deterministic no-spend live product-preview usefulness assessment.
//
// This helper consumes already-produced, already-sanitized one-run preview facts.
// It performs no provider calls, no network access, no credential reads, no
// production writes, and no runtime/model-mode integration. A useful result is
// only a bounded signal for a later approval packet; it never approves expansion,
// comparison, launch readiness, product readiness, or production readiness.

import type { WorkshopLens } from "../workshop/view-model.ts";

export type LiveProductPreviewUsefulnessClassification = "useful" | "weak-but-valid" | "zero-output" | "contract-failure";

export type LiveProductPreviewUsefulnessStatus = "pass" | "fail";

export type LiveProductPreviewUsefulnessReasonCode =
  | "validation_chain_failed"
  | "request_surface_broadened"
  | "workshop_side_effect_boundary_failed"
  | "zero_output"
  | "underproduced_graph_output"
  | "insufficient_useful_lenses";

export interface LiveProductPreviewOutputCounts {
  excerpts: number;
  claims: number;
  account_objects: number;
}

export interface LiveProductPreviewValidationStatus {
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

export interface LiveProductPreviewRequestSurface {
  tools_or_plugins_requested: boolean;
  online_model_variant_requested: boolean;
  web_search_requested: boolean;
}

export interface LiveProductPreviewWorkshopSurface {
  html_rendered: boolean;
  provider_calls_made: number;
  production_writes: boolean;
  useful_lens_count: number;
  useful_lenses: readonly WorkshopLens[];
}

export interface LiveProductPreviewUsefulnessInput {
  preview_ref: string;
  account_count: number;
  provider_calls_executed: number;
  output_counts: LiveProductPreviewOutputCounts;
  validation_status: LiveProductPreviewValidationStatus;
  request_surface: LiveProductPreviewRequestSurface;
  workshop_surface: LiveProductPreviewWorkshopSurface;
  runtime_model_mode_integration: boolean;
}

export interface LiveProductPreviewUsefulnessReason {
  code: LiveProductPreviewUsefulnessReasonCode;
  severity: LiveProductPreviewUsefulnessStatus;
  message: string;
  observed: number;
  threshold: number;
}

export interface LiveProductPreviewUsefulnessMetrics {
  account_count: number;
  provider_calls_executed: number;
  output_counts: LiveProductPreviewOutputCounts;
  useful_lens_count: number;
  useful_lenses: readonly WorkshopLens[];
}

export interface LiveProductPreviewUsefulnessAssessment {
  ok: boolean;
  status: LiveProductPreviewUsefulnessStatus;
  preview_ref: string;
  preview_usefulness_classification: LiveProductPreviewUsefulnessClassification;
  launch_readiness_claim: false;
  product_readiness_claim: false;
  production_readiness_claim: false;
  approves_expansion_or_comparison: false;
  metrics: LiveProductPreviewUsefulnessMetrics;
  reasons: readonly LiveProductPreviewUsefulnessReason[];
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
const MIN_USEFUL_LENSES = 2;

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
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

function readExactInteger(record: Record<string, unknown>, field: string, label: string, expected: number): number {
  const value = readNonNegativeInteger(record, field, label);
  if (value !== expected) {
    const expectedLabel = expected === 1 ? "one" : String(expected);
    throw new Error(`${field} must be exactly ${expectedLabel}`);
  }
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
    throw new Error("preview_ref must be a safe live product preview ref");
  }
}

function readOutputCounts(record: Record<string, unknown>): LiveProductPreviewOutputCounts {
  const output = readRecord(record, "output_counts", "live product preview input");
  return Object.freeze({
    excerpts: readNonNegativeInteger(output, "excerpts", "output_counts"),
    claims: readNonNegativeInteger(output, "claims", "output_counts"),
    account_objects: readNonNegativeInteger(output, "account_objects", "output_counts"),
  });
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

function readValidationStatus(record: Record<string, unknown>): LiveProductPreviewValidationStatus {
  const validation = readRecord(record, "validation_status", "live product preview input");
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

function readRequestSurface(record: Record<string, unknown>): LiveProductPreviewRequestSurface {
  const request = readRecord(record, "request_surface", "live product preview input");
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
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
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
  const result: WorkshopLens[] = [];
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new Error("invalid workshop_surface.useful_lenses");
    }
    if (!descriptor || !("value" in descriptor)) {
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

function readWorkshopSurface(record: Record<string, unknown>): LiveProductPreviewWorkshopSurface {
  const workshop = readRecord(record, "workshop_surface", "live product preview input");
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

function snapshotInput(input: unknown): LiveProductPreviewUsefulnessInput {
  let record: Record<string, unknown>;
  try {
    assertPlainRecord(input, "live product preview input");
    record = input;
    const previewRef = readString(record, "preview_ref", "live product preview input");
    assertSafePreviewRef(previewRef);
    return Object.freeze({
      preview_ref: previewRef,
      account_count: readExactInteger(record, "account_count", "live product preview input", 1),
      provider_calls_executed: readExactInteger(record, "provider_calls_executed", "live product preview input", 1),
      output_counts: readOutputCounts(record),
      validation_status: readValidationStatus(record),
      request_surface: readRequestSurface(record),
      workshop_surface: readWorkshopSurface(record),
      runtime_model_mode_integration: readBoolean(record, "runtime_model_mode_integration", "live product preview input"),
    });
  } catch (error) {
    if (error instanceof Error && /safe live product preview ref|account_count must be exactly one|provider_calls_executed must be exactly one/.test(error.message)) {
      throw error;
    }
    throw new Error("invalid live product preview input");
  }
}

function validationChainPassed(status: LiveProductPreviewValidationStatus): boolean {
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
  reasons: LiveProductPreviewUsefulnessReason[],
  code: LiveProductPreviewUsefulnessReasonCode,
  message: string,
  observed: number,
  threshold: number,
): void {
  reasons.push(Object.freeze({ code, severity: "fail", message, observed, threshold }));
}

function classify(
  input: LiveProductPreviewUsefulnessInput,
  reasons: LiveProductPreviewUsefulnessReason[],
): LiveProductPreviewUsefulnessClassification {
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
    addReason(reasons, "zero_output", "provider output produced no sanitized graph facts", 0, 1);
    return "zero-output";
  }

  if (input.output_counts.excerpts === 0 || input.output_counts.claims === 0 || input.output_counts.account_objects === 0) {
    addReason(reasons, "underproduced_graph_output", "sanitized graph output is missing one or more required graph fact types", totalOutputs, 3);
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

export function assessLiveProductPreviewUsefulness(input: unknown): LiveProductPreviewUsefulnessAssessment {
  const snapshot = snapshotInput(input);
  const reasons: LiveProductPreviewUsefulnessReason[] = [];
  const classification = classify(snapshot, reasons);
  const ok = classification === "useful";

  return Object.freeze({
    ok,
    status: ok ? "pass" : "fail",
    preview_ref: snapshot.preview_ref,
    preview_usefulness_classification: classification,
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    approves_expansion_or_comparison: false,
    metrics: Object.freeze({
      account_count: snapshot.account_count,
      provider_calls_executed: snapshot.provider_calls_executed,
      output_counts: Object.freeze({ ...snapshot.output_counts }),
      useful_lens_count: snapshot.workshop_surface.useful_lens_count,
      useful_lenses: Object.freeze([...snapshot.workshop_surface.useful_lenses]),
    }),
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
