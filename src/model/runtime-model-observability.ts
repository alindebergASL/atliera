import type { ModelProviderCost, ModelProviderUsage } from "./provider.ts";
import type { RuntimeModelExecutionPreflightDecision } from "./runtime-model-execution-preflight.ts";
import type { SelectedModelRoute } from "./validated-route-catalog.ts";

export type RuntimeModelExecutionReportStatus = "preflight-pass-no-call" | "preflight-blocked" | "executed-sanitized";

export interface RuntimeModelExecutionReportInput {
  readonly selectedRoute: SelectedModelRoute;
  readonly preflight: RuntimeModelExecutionPreflightDecision;
  readonly ledgerRef: string;
  readonly usage: ModelProviderUsage;
  readonly cost: ModelProviderCost;
  readonly status: RuntimeModelExecutionReportStatus;
  readonly observedAt: string;
}

export interface RuntimeModelExecutionReport {
  readonly schema_version: "atliera.runtime_model_observability.v1";
  readonly status: RuntimeModelExecutionReportStatus;
  readonly observed_at: string;
  readonly route: {
    readonly route_ref: string;
    readonly provider_ref: string;
    readonly model_label: string;
    readonly route_kind: SelectedModelRoute["route"]["routeKind"];
    readonly validation_refs: readonly string[];
    readonly validation_age_days: number;
    readonly evidence_expires_at: string;
    readonly evidence_status: SelectedModelRoute["routeEvidenceStatus"];
    readonly requires_fresh_approval_before_use: boolean;
    readonly usable_without_revalidation: boolean;
    readonly approval_ref: string | null;
  };
  readonly preflight: {
    readonly ok: boolean;
    readonly credential_ready: boolean;
    readonly refusal_reasons: readonly string[];
  };
  readonly ledger_ref: string;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly total_tokens: number;
  };
  readonly cost: ModelProviderCost;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly runtime_model_mode_integration: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
}

const INPUT_KEYS = new Set(["selectedRoute", "preflight", "ledgerRef", "usage", "cost", "status", "observedAt"]);
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertInputRecord(input: RuntimeModelExecutionReportInput): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("observability input must be a record");
  if (Object.getPrototypeOf(input) !== Object.prototype) throw new Error("observability input must use Object prototype");
  if (Object.getOwnPropertySymbols(input).length > 0) throw new Error("observability symbol fields rejected");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) throw new Error("observability non-enumerable fields rejected");
    if ("get" in descriptor || "set" in descriptor) throw new Error("observability accessor field rejected");
    if (!INPUT_KEYS.has(key)) throw new Error(`unexpected observability field: ${key}`);
  }
  for (const key of INPUT_KEYS) {
    if (!Object.hasOwn(input, key)) throw new Error(`missing observability field: ${key}`);
  }
}

function assertSafeRef(value: string, label: string): void {
  if (!SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.startsWith("/")) {
    throw new Error(`${label} must be a safe ref`);
  }
}

function assertIso(value: string, label: string): void {
  if (!ISO_INSTANT.test(value)) throw new Error(`${label} must be an ISO instant`);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be an ISO instant`);
  }
}

function parseIso(value: string, label: string): number {
  assertIso(value, label);
  return Date.parse(value);
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function assertNonNegativeCost(value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("cost.amount must be non-negative");
}

function sanitizeRefusalReason(reason: string): string {
  const safeReasons = new Map<string, string>([
    ["metadata accessor rejected", "metadata_accessor_rejected"],
    ["metadata symbol fields rejected", "metadata_symbol_fields_rejected"],
    ["metadata non-enumerable fields rejected", "metadata_non_enumerable_fields_rejected"],
    ["metadata values must be strings", "metadata_values_must_be_strings"],
    ["credential readiness is required before runtime model execution", "credential_readiness_required"],
    ["route evidence expired requires revalidation before runtime model execution", "route_evidence_expired_requires_revalidation"],
  ]);
  if (safeReasons.has(reason)) return safeReasons.get(reason)!;
  if (/^forbidden metadata key rejected: [A-Za-z0-9_.-]+$/.test(reason)) return "forbidden_metadata_key_rejected";
  return "unsafe_refusal_reason_redacted";
}

function assertPreflightMatchesSelectedRoute(input: RuntimeModelExecutionReportInput): void {
  if (
    input.preflight.routeRef !== input.selectedRoute.route.routeRef ||
    input.preflight.providerRef !== input.selectedRoute.route.providerRef ||
    input.preflight.modelLabel !== input.selectedRoute.route.modelLabel
  ) {
    throw new Error("preflight route identity must match selected route");
  }
  if (
    input.preflight.routeEvidenceExpiresAt !== input.selectedRoute.routeEvidenceExpiresAt ||
    input.preflight.routeEvidenceExpiresAt !== input.selectedRoute.route.evidenceExpiresAt
  ) {
    throw new Error("preflight route evidence expiry must match selected route");
  }
}

function assertStatusMatchesPreflight(input: RuntimeModelExecutionReportInput): void {
  if (input.status === "preflight-pass-no-call" && input.preflight.ok !== true) {
    throw new Error("preflight-pass-no-call requires passing preflight");
  }
  if (input.status === "preflight-blocked" && input.preflight.ok !== false) {
    throw new Error("preflight-blocked requires blocked preflight");
  }
  if (input.status === "executed-sanitized" && input.preflight.ok !== true) {
    throw new Error("executed-sanitized requires passing preflight");
  }
}

function validationAgeDaysAtObservedTime(input: RuntimeModelExecutionReportInput): number {
  const observedMs = parseIso(input.observedAt, "observedAt");
  const validatedMs = parseIso(input.selectedRoute.route.validatedAt, "route.validatedAt");
  if (observedMs < validatedMs) throw new Error("observedAt must not precede route validation");
  return Math.floor((observedMs - validatedMs) / (24 * 60 * 60 * 1000));
}

export function createRuntimeModelExecutionReport(input: RuntimeModelExecutionReportInput): RuntimeModelExecutionReport {
  assertInputRecord(input);
  assertPreflightMatchesSelectedRoute(input);
  assertStatusMatchesPreflight(input);
  assertSafeRef(input.ledgerRef, "ledgerRef");
  assertIso(input.observedAt, "observedAt");
  const validationAgeDays = validationAgeDaysAtObservedTime(input);
  assertNonNegativeInteger(input.usage.inputTokens, "usage.inputTokens");
  assertNonNegativeInteger(input.usage.outputTokens, "usage.outputTokens");
  assertNonNegativeInteger(input.usage.totalTokens, "usage.totalTokens");
  if (input.usage.totalTokens !== input.usage.inputTokens + input.usage.outputTokens) {
    throw new Error("usage.totalTokens must equal inputTokens + outputTokens");
  }
  if (input.cost.currency !== "USD") throw new Error("cost.currency must be USD");
  assertNonNegativeCost(input.cost.amount);
  if (input.preflight.authorizesProviderCall !== false) throw new Error("preflight must not authorize provider calls");
  if (input.selectedRoute.defaultModelSelectionClaim !== false || input.selectedRoute.providerLockIn !== false) {
    throw new Error("selected route safety markers must be false");
  }

  return Object.freeze({
    schema_version: "atliera.runtime_model_observability.v1",
    status: input.status,
    observed_at: input.observedAt,
    route: Object.freeze({
      route_ref: input.selectedRoute.route.routeRef,
      provider_ref: input.selectedRoute.route.providerRef,
      model_label: input.selectedRoute.route.modelLabel,
      route_kind: input.selectedRoute.route.routeKind,
      validation_refs: Object.freeze([...input.selectedRoute.route.validationRefs]),
      validation_age_days: validationAgeDays,
      evidence_expires_at: input.preflight.routeEvidenceExpiresAt,
      evidence_status: input.preflight.routeEvidenceStatus,
      requires_fresh_approval_before_use: input.preflight.routeRequiresFreshApprovalBeforeUse,
      usable_without_revalidation: input.preflight.routeUsableWithoutRevalidation,
      approval_ref: input.selectedRoute.approvalRef,
    }),
    preflight: Object.freeze({
      ok: input.preflight.ok,
      credential_ready: input.preflight.credentialReady,
      refusal_reasons: Object.freeze(input.preflight.refusalReasons.map(sanitizeRefusalReason)),
    }),
    ledger_ref: input.ledgerRef,
    usage: Object.freeze({
      input_tokens: input.usage.inputTokens,
      output_tokens: input.usage.outputTokens,
      total_tokens: input.usage.totalTokens,
    }),
    cost: Object.freeze({ currency: "USD", amount: input.cost.amount }),
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_provider_call: false,
    runtime_model_mode_integration: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
  });
}
