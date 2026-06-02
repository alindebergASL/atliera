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
}

export interface RouteEvidenceRecencyReport {
  readonly schema_version: "atliera.route_evidence_recency.v1";
  readonly generated_at: string;
  readonly entries: readonly RouteEvidenceRecencyEntry[];
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly runtime_model_mode_integration: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
}

const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function daysUntil(expiry: string, now: string): number {
  return (Date.parse(expiry) - Date.parse(now)) / 86_400_000;
}

export function reviewRouteEvidenceRecency(input: RouteEvidenceRecencyInput): RouteEvidenceRecencyReport {
  const entries: RouteEvidenceRecencyEntry[] = [];
  for (const item of input.routes) {
    const route = snapshotValidatedModelRoute(item);
    const remainingDays = daysUntil(route.evidenceExpiresAt, input.now);
    const status: RouteEvidenceRecencyStatus = remainingDays < 0
      ? "expired-needs-revalidation"
      : remainingDays <= input.nearingExpiryDays
        ? "nearing-expiry"
        : "fresh";
    entries.push(Object.freeze({
      ref: route.routeRef,
      model_label: route.modelLabel,
      status,
      evidence_expires_at: route.evidenceExpiresAt,
    }));
  }
  for (const label of input.candidateLabelExamples) {
    if (!SAFE_LABEL.test(label)) throw new Error("candidate label must be safe");
    entries.push(Object.freeze({
      ref: label,
      model_label: label,
      status: "candidate-label-only-not-validated",
      evidence_expires_at: null,
    }));
  }
  return Object.freeze({
    schema_version: "atliera.route_evidence_recency.v1",
    generated_at: input.now,
    entries: Object.freeze(entries),
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_provider_call: false,
    runtime_model_mode_integration: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
  });
}
