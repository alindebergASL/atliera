import { snapshotValidatedModelRoute, type ValidatedModelRouteInput } from "./validated-route-catalog.ts";

export type RouteEvidenceRecencyStatus =
  | "fresh"
  | "nearing-expiry"
  | "expired-needs-revalidation"
  | "candidate-label-only-not-validated";

export interface RouteEvidenceRecencyInput {
  readonly routes: readonly ValidatedModelRouteInput[];
  readonly candidateLabelExamples: readonly string[];
  readonly now: string;
  readonly nearingExpiryDays: number;
}

export interface RouteEvidenceRecencyEntry {
  readonly ref: string;
  readonly model_label: string;
  readonly status: RouteEvidenceRecencyStatus;
  readonly evidence_expires_at: string | null;
  readonly requires_fresh_approval_before_use: boolean;
  readonly usable_without_revalidation: boolean;
}

export interface RouteEvidenceRecencyReport {
  readonly schema_version: "atliera.route_evidence_recency.v1";
  readonly generated_at: string;
  readonly nearing_expiry_days: number;
  readonly entries: readonly RouteEvidenceRecencyEntry[];
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly authorizes_runtime_use: false;
  readonly authorizes_retry: false;
  readonly authorizes_revalidation_run: false;
  readonly authorizes_provider_comparison: false;
  readonly authorizes_product_preview_expansion: false;
  readonly authorizes_corpus_expansion: false;
  readonly authorizes_default_model_selection: false;
  readonly authorizes_tools: false;
  readonly authorizes_web_search: false;
  readonly authorizes_plugins: false;
  readonly authorizes_retrieval: false;
  readonly authorizes_mcp: false;
  readonly authorizes_graph_ingestion: false;
  readonly authorizes_production_use: false;
  readonly runtime_model_mode_integration: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
  readonly product_readiness_claim: false;
  readonly production_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly stale_or_candidate_requires_fresh_approval: true;
  readonly revalidation_requires_new_approval: true;
}

const ROOT_KEYS = ["routes", "candidateLabelExamples", "now", "nearingExpiryDays"] as const;
const ROOT_KEY_SET = new Set<string>(ROOT_KEYS);
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_ROUTES = 64;
const MAX_LABELS = 64;

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain record`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must use Object prototype`);
  }
}

function assertExactOwnKeys(record: Record<string, unknown>, label: string): void {
  const symbols = Object.getOwnPropertySymbols(record);
  if (symbols.length > 0) throw new Error(`${label} symbol fields rejected`);

  const descriptors = Object.getOwnPropertyDescriptors(record);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) throw new Error(`${label} non-enumerable fields rejected`);
    if ("get" in descriptor || "set" in descriptor) throw new Error(`${label} accessor field rejected`);
    if (!ROOT_KEY_SET.has(key)) throw new Error(`${label} unexpected field: ${key}`);
  }

  for (const key of ROOT_KEYS) {
    if (!Object.hasOwn(record, key)) throw new Error(`${label} missing field: ${key}`);
  }
}

function assertSafeArray(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error(`${label} array prototype rejected`);
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) throw new Error(`${label} symbol fields rejected`);
  if (value.length > max) throw new Error(`${label} length invalid`);

  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length") continue;
    if (!/^\d+$/.test(key)) throw new Error(`${label} unexpected array field rejected`);
    if (!descriptor.enumerable) throw new Error(`${label} non-enumerable fields rejected`);
    if ("get" in descriptor || "set" in descriptor) throw new Error(`${label} accessor field rejected`);
  }
  return value;
}

function snapshotArrayValues(value: unknown, label: string, max: number): readonly unknown[] {
  const raw = assertSafeArray(value, label, max);
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const snapshot: unknown[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
      throw new Error(`${label}[${index}] descriptor invalid`);
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

function assertIsoInstant(value: unknown, label: string): string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) {
    throw new Error(`${label} must be an ISO instant`);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be an ISO instant`);
  }
  return value;
}

// Read candidate labels exactly once into a frozen snapshot; later logic must consume
// only the returned snapshot and never reread the original (possibly attacker-controlled) array.
function snapshotCandidateLabels(value: unknown): readonly string[] {
  const raw = snapshotArrayValues(value, "recency.candidateLabelExamples", MAX_LABELS);
  const labels: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (typeof entry !== "string") throw new Error(`recency.candidateLabelExamples[${index}] must be a string`);
    if (!SAFE_LABEL.test(entry)) throw new Error("candidate label must be safe");
    labels.push(entry);
  }
  return Object.freeze(labels);
}

function daysUntil(expiry: string, now: string): number {
  return (Date.parse(expiry) - Date.parse(now)) / 86_400_000;
}

export function reviewRouteEvidenceRecency(input: RouteEvidenceRecencyInput): RouteEvidenceRecencyReport {
  assertPlainRecord(input, "recency");
  assertExactOwnKeys(input, "recency");

  const now = assertIsoInstant(input.now, "recency.now");

  const nearingExpiryDays = input.nearingExpiryDays;
  if (!Number.isInteger(nearingExpiryDays) || nearingExpiryDays < 0) {
    throw new Error("recency.nearingExpiryDays must be a non-negative integer");
  }

  const rawRoutes = snapshotArrayValues(input.routes, "recency.routes", MAX_ROUTES);
  // Snapshot candidate labels before processing routes; no reread of the original array afterwards.
  const labels = snapshotCandidateLabels(input.candidateLabelExamples);

  const entries: RouteEvidenceRecencyEntry[] = [];
  const seenRefs = new Set<string>();
  const validatedLabels = new Set<string>();

  for (const item of rawRoutes) {
    const route = snapshotValidatedModelRoute(item as ValidatedModelRouteInput);
    if (seenRefs.has(route.routeRef)) throw new Error(`duplicate route ref rejected: ${route.routeRef}`);
    seenRefs.add(route.routeRef);
    validatedLabels.add(route.modelLabel);

    const remainingDays = daysUntil(route.evidenceExpiresAt, now);
    const status: RouteEvidenceRecencyStatus = remainingDays < 0
      ? "expired-needs-revalidation"
      : remainingDays <= nearingExpiryDays
        ? "nearing-expiry"
        : "fresh";
    const requiresFreshApproval = status === "expired-needs-revalidation";

    entries.push(Object.freeze({
      ref: route.routeRef,
      model_label: route.modelLabel,
      status,
      evidence_expires_at: route.evidenceExpiresAt,
      requires_fresh_approval_before_use: requiresFreshApproval,
      usable_without_revalidation: !requiresFreshApproval,
    }));
  }

  const seenLabels = new Set<string>();
  for (const label of labels) {
    if (seenLabels.has(label)) throw new Error(`duplicate candidate label rejected: ${label}`);
    seenLabels.add(label);
    if (seenRefs.has(label) || validatedLabels.has(label)) {
      throw new Error(`candidate label conflicts with validated route: ${label}`);
    }

    entries.push(Object.freeze({
      ref: label,
      model_label: label,
      status: "candidate-label-only-not-validated",
      evidence_expires_at: null,
      requires_fresh_approval_before_use: true,
      usable_without_revalidation: false,
    }));
  }

  return Object.freeze({
    schema_version: "atliera.route_evidence_recency.v1",
    generated_at: now,
    nearing_expiry_days: nearingExpiryDays,
    entries: Object.freeze(entries),
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_provider_call: false,
    authorizes_runtime_use: false,
    authorizes_retry: false,
    authorizes_revalidation_run: false,
    authorizes_provider_comparison: false,
    authorizes_product_preview_expansion: false,
    authorizes_corpus_expansion: false,
    authorizes_default_model_selection: false,
    authorizes_tools: false,
    authorizes_web_search: false,
    authorizes_plugins: false,
    authorizes_retrieval: false,
    authorizes_mcp: false,
    authorizes_graph_ingestion: false,
    authorizes_production_use: false,
    runtime_model_mode_integration: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    launch_readiness_claim: false,
    stale_or_candidate_requires_fresh_approval: true,
    revalidation_requires_new_approval: true,
  });
}
