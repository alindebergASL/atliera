// Fixture-only Atliera quality gate runner.
//
// The graph validator answers "is this bundle structurally safe?" The
// quality gate answers the next Phase 1.2 question: "is this bundle good
// enough to pass launch-quality thresholds?" It remains deterministic,
// no-spend, and no-network; it only consumes local GraphBundle JSON.

import type { HardFailure, ValidationReport } from "../graph/report.ts";
import type { GraphBundle } from "../graph/types.ts";
import { validateGraphBundleRaw } from "../graph/validate.ts";

export type GateStatus = "pass" | "borderline" | "fail";

export type GateReasonCode =
  | "hard_failures_present"
  | "zero_output_incident"
  | "invented_id_failures_present"
  | "accepted_excerpt_rate_below_threshold"
  | "verified_claim_evidence_coverage_below_threshold";

export type AggregateGateReasonCode =
  | "aggregate_hard_failures_present"
  | "aggregate_zero_output_incident_rate_exceeded"
  | "aggregate_verified_claim_evidence_coverage_below_threshold";

export interface QualityGateThresholds {
  min_accepted_excerpt_rate: number;
  min_verified_claim_evidence_coverage: number;
  max_invented_id_failures: number;
}

export interface AggregateQualityGateThresholds {
  max_zero_output_incident_rate: number;
  min_aggregate_verified_claim_evidence_coverage: number;
  max_hard_failure_bundles: number;
}

export const DEFAULT_AGGREGATE_QUALITY_GATE_THRESHOLDS: AggregateQualityGateThresholds = {
  max_zero_output_incident_rate: 0.1,
  min_aggregate_verified_claim_evidence_coverage: 0.8,
  max_hard_failure_bundles: 0,
};

export const DEFAULT_QUALITY_GATE_THRESHOLDS: QualityGateThresholds = {
  // Phase 1.2 is intentionally conservative: a bundle with excerpts but
  // too few accepted excerpts is not automatically unsafe, but should not
  // be treated as a clean pass.
  min_accepted_excerpt_rate: 0.5,
  // Verified/high-confidence claims must be backed by accepted supporting
  // evidence. The validator enforces this as a hard invariant for each
  // such claim; the gate also exposes it as an aggregate launch metric.
  min_verified_claim_evidence_coverage: 1,
  max_invented_id_failures: 0,
};

export interface QualityGateMetrics {
  total_sources: number;
  total_excerpts: number;
  accepted_excerpts: number;
  accepted_excerpt_rate: number | null;
  total_claims: number;
  verified_or_high_confidence_claims: number;
  verified_or_high_confidence_claims_with_accepted_supporting_evidence: number;
  verified_claim_evidence_coverage: number | null;
  total_account_objects: number;
  graph_record_count: number;
  invented_id_failures: number;
  hard_failures: number;
}

export interface GateReason {
  code: GateReasonCode;
  severity: GateStatus;
  message: string;
  observed?: number | null;
  threshold?: number;
}

export interface AggregateGateReason {
  code: AggregateGateReasonCode;
  severity: GateStatus;
  message: string;
  observed?: number | null;
  threshold?: number;
}

export interface QualityGateReport {
  ok: boolean;
  status: GateStatus;
  reasons: GateReason[];
  thresholds: QualityGateThresholds;
  metrics: QualityGateMetrics;
  validation_report: ValidationReport;
}

export interface AggregateQualityGateMetrics {
  total_bundles: number;
  passing_bundles: number;
  borderline_bundles: number;
  failing_bundles: number;
  hard_failure_bundles: number;
  zero_output_incidents: number;
  zero_output_incident_rate: number | null;
  total_graph_records: number;
  total_verified_or_high_confidence_claims: number;
  total_verified_or_high_confidence_claims_with_accepted_supporting_evidence: number;
  aggregate_verified_claim_evidence_coverage: number | null;
}

export interface AggregateQualityGateReport {
  ok: boolean;
  status: GateStatus;
  reasons: AggregateGateReason[];
  thresholds: AggregateQualityGateThresholds;
  metrics: AggregateQualityGateMetrics;
}

export interface NamedQualityGateReport extends QualityGateReport {
  input: string;
}

export interface QualityGateRunReport {
  ok: boolean;
  status: GateStatus;
  reports: NamedQualityGateReport[];
  aggregate: AggregateQualityGateReport;
}

const INVENTED_ID_CODES = new Set<string>([
  "invented_source_document_id",
  "invented_evidence_excerpt_id",
  "invented_claim_id",
  "invented_claim_evidence_id",
  "invented_account_object_id",
  "invented_account_object_claim_id",
]);

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function worstStatus(statuses: GateStatus[]): GateStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("borderline")) return "borderline";
  return "pass";
}

function countInventedIdFailures(failures: HardFailure[]): number {
  return failures.filter((f) => INVENTED_ID_CODES.has(f.code)).length;
}

function isVerifiedOrHighConfidenceClaim(claim: GraphBundle["claims"][number]): boolean {
  return claim.provenance_status === "verified" || claim.confidence === "high";
}

function computeMetrics(
  bundle: GraphBundle,
  validationReport: ValidationReport,
): QualityGateMetrics {
  const acceptedExcerptIds = new Set(
    bundle.excerpts
      .filter((e) => e.validation_status === "accepted")
      .map((e) => e.id),
  );
  const supportingEvidenceClaimIds = new Set(
    bundle.claim_evidence
      .filter(
        (ce) =>
          ce.relationship === "supports" &&
          acceptedExcerptIds.has(ce.evidence_excerpt_id),
      )
      .map((ce) => ce.claim_id),
  );
  const verifiedOrHighConfidenceClaims = bundle.claims.filter(
    isVerifiedOrHighConfidenceClaim,
  );
  const supportedVerifiedOrHighConfidenceClaims = verifiedOrHighConfidenceClaims.filter(
    (claim) => supportingEvidenceClaimIds.has(claim.id),
  );
  const graphRecordCount =
    bundle.sources.length +
    bundle.excerpts.length +
    bundle.claims.length +
    bundle.claim_evidence.length +
    bundle.account_objects.length +
    bundle.account_object_claims.length +
    bundle.research_runs.length +
    bundle.run_artifacts.length +
    bundle.audit_events.length;

  return {
    total_sources: bundle.sources.length,
    total_excerpts: bundle.excerpts.length,
    accepted_excerpts: bundle.excerpts.filter(
      (e) => e.validation_status === "accepted",
    ).length,
    accepted_excerpt_rate: rate(
      bundle.excerpts.filter((e) => e.validation_status === "accepted").length,
      bundle.excerpts.length,
    ),
    total_claims: bundle.claims.length,
    verified_or_high_confidence_claims: verifiedOrHighConfidenceClaims.length,
    verified_or_high_confidence_claims_with_accepted_supporting_evidence:
      supportedVerifiedOrHighConfidenceClaims.length,
    verified_claim_evidence_coverage: rate(
      supportedVerifiedOrHighConfidenceClaims.length,
      verifiedOrHighConfidenceClaims.length,
    ),
    total_account_objects: bundle.account_objects.length,
    graph_record_count: graphRecordCount,
    invented_id_failures: countInventedIdFailures(
      validationReport.hard_failures,
    ),
    hard_failures: validationReport.hard_failures.length,
  };
}

function evaluateReasons(
  metrics: QualityGateMetrics,
  validationReport: ValidationReport,
  thresholds: QualityGateThresholds,
): GateReason[] {
  const reasons: GateReason[] = [];

  if (validationReport.hard_failures.length > 0) {
    reasons.push({
      code: "hard_failures_present",
      severity: "fail",
      message: "validator reported hard failures",
      observed: validationReport.hard_failures.length,
      threshold: 0,
    });
  }

  if (metrics.graph_record_count === 0) {
    reasons.push({
      code: "zero_output_incident",
      severity: "fail",
      message: "bundle contains zero graph records",
      observed: metrics.graph_record_count,
      threshold: 1,
    });
  }

  if (metrics.invented_id_failures > thresholds.max_invented_id_failures) {
    reasons.push({
      code: "invented_id_failures_present",
      severity: "fail",
      message: "invented ID failures exceed threshold",
      observed: metrics.invented_id_failures,
      threshold: thresholds.max_invented_id_failures,
    });
  }

  if (
    metrics.accepted_excerpt_rate !== null &&
    metrics.accepted_excerpt_rate < thresholds.min_accepted_excerpt_rate
  ) {
    reasons.push({
      code: "accepted_excerpt_rate_below_threshold",
      severity: "borderline",
      message: "accepted excerpt rate is below launch-quality threshold",
      observed: metrics.accepted_excerpt_rate,
      threshold: thresholds.min_accepted_excerpt_rate,
    });
  }

  if (
    metrics.verified_claim_evidence_coverage !== null &&
    metrics.verified_claim_evidence_coverage <
      thresholds.min_verified_claim_evidence_coverage
  ) {
    reasons.push({
      code: "verified_claim_evidence_coverage_below_threshold",
      severity: "fail",
      message:
        "verified/high-confidence claim evidence coverage is below threshold",
      observed: metrics.verified_claim_evidence_coverage,
      threshold: thresholds.min_verified_claim_evidence_coverage,
    });
  }

  return reasons;
}

function isBundleLike(rawBundle: unknown): rawBundle is GraphBundle {
  if (typeof rawBundle !== "object" || rawBundle === null) return false;
  const candidate = rawBundle as Record<string, unknown>;
  return [
    "sources",
    "excerpts",
    "claims",
    "claim_evidence",
    "account_objects",
    "account_object_claims",
    "research_runs",
    "run_artifacts",
    "audit_events",
  ].every((key) => Array.isArray(candidate[key]));
}

function emptyGateMetrics(validationReport: ValidationReport): QualityGateMetrics {
  return {
    total_sources: 0,
    total_excerpts: 0,
    accepted_excerpts: 0,
    accepted_excerpt_rate: null,
    total_claims: 0,
    verified_or_high_confidence_claims: 0,
    verified_or_high_confidence_claims_with_accepted_supporting_evidence: 0,
    verified_claim_evidence_coverage: null,
    total_account_objects: 0,
    graph_record_count: 0,
    invented_id_failures: countInventedIdFailures(
      validationReport.hard_failures,
    ),
    hard_failures: validationReport.hard_failures.length,
  };
}

export function runQualityGate(
  rawBundle: unknown,
  thresholds: QualityGateThresholds = DEFAULT_QUALITY_GATE_THRESHOLDS,
): QualityGateReport {
  const validationReport = validateGraphBundleRaw(rawBundle, { mode: "fixture" });
  const metrics = isBundleLike(rawBundle)
    ? computeMetrics(rawBundle, validationReport)
    : emptyGateMetrics(validationReport);
  const reasons = evaluateReasons(metrics, validationReport, thresholds);
  const status = worstStatus(reasons.map((r) => r.severity));

  return {
    ok: status === "pass",
    status,
    reasons,
    thresholds,
    metrics,
    validation_report: validationReport,
  };
}

function computeAggregateMetrics(
  reports: NamedQualityGateReport[],
): AggregateQualityGateMetrics {
  const totalBundles = reports.length;
  const totalVerifiedOrHighConfidenceClaims = reports.reduce(
    (sum, report) => sum + report.metrics.verified_or_high_confidence_claims,
    0,
  );
  const totalSupportedVerifiedOrHighConfidenceClaims = reports.reduce(
    (sum, report) =>
      sum +
      report.metrics
        .verified_or_high_confidence_claims_with_accepted_supporting_evidence,
    0,
  );

  return {
    total_bundles: totalBundles,
    passing_bundles: reports.filter((report) => report.status === "pass").length,
    borderline_bundles: reports.filter((report) => report.status === "borderline")
      .length,
    failing_bundles: reports.filter((report) => report.status === "fail").length,
    hard_failure_bundles: reports.filter(
      (report) => report.metrics.hard_failures > 0,
    ).length,
    zero_output_incidents: reports.filter(
      (report) => report.metrics.graph_record_count === 0,
    ).length,
    zero_output_incident_rate: rate(
      reports.filter((report) => report.metrics.graph_record_count === 0).length,
      totalBundles,
    ),
    total_graph_records: reports.reduce(
      (sum, report) => sum + report.metrics.graph_record_count,
      0,
    ),
    total_verified_or_high_confidence_claims: totalVerifiedOrHighConfidenceClaims,
    total_verified_or_high_confidence_claims_with_accepted_supporting_evidence:
      totalSupportedVerifiedOrHighConfidenceClaims,
    aggregate_verified_claim_evidence_coverage: rate(
      totalSupportedVerifiedOrHighConfidenceClaims,
      totalVerifiedOrHighConfidenceClaims,
    ),
  };
}

function evaluateAggregateReasons(
  metrics: AggregateQualityGateMetrics,
  thresholds: AggregateQualityGateThresholds,
): AggregateGateReason[] {
  const reasons: AggregateGateReason[] = [];

  if (metrics.hard_failure_bundles > thresholds.max_hard_failure_bundles) {
    reasons.push({
      code: "aggregate_hard_failures_present",
      severity: "fail",
      message: "one or more corpus bundles reported validator hard failures",
      observed: metrics.hard_failure_bundles,
      threshold: thresholds.max_hard_failure_bundles,
    });
  }

  if (
    metrics.zero_output_incident_rate !== null &&
    metrics.zero_output_incident_rate > thresholds.max_zero_output_incident_rate
  ) {
    reasons.push({
      code: "aggregate_zero_output_incident_rate_exceeded",
      severity: "fail",
      message: "zero-output incident rate exceeds launch-readiness threshold",
      observed: metrics.zero_output_incident_rate,
      threshold: thresholds.max_zero_output_incident_rate,
    });
  }

  if (
    metrics.aggregate_verified_claim_evidence_coverage !== null &&
    metrics.aggregate_verified_claim_evidence_coverage <
      thresholds.min_aggregate_verified_claim_evidence_coverage
  ) {
    reasons.push({
      code: "aggregate_verified_claim_evidence_coverage_below_threshold",
      severity: "fail",
      message:
        "aggregate verified/high-confidence claim evidence coverage is below launch-readiness threshold",
      observed: metrics.aggregate_verified_claim_evidence_coverage,
      threshold: thresholds.min_aggregate_verified_claim_evidence_coverage,
    });
  }

  return reasons;
}

function summarizeAggregateGateRun(
  reports: NamedQualityGateReport[],
  thresholds: AggregateQualityGateThresholds,
): AggregateQualityGateReport {
  const metrics = computeAggregateMetrics(reports);
  const reasons = evaluateAggregateReasons(metrics, thresholds);
  const status = worstStatus(reasons.map((r) => r.severity));

  return {
    ok: status === "pass",
    status,
    reasons,
    thresholds,
    metrics,
  };
}

export function summarizeGateRun(
  reports: NamedQualityGateReport[],
  aggregateThresholds: AggregateQualityGateThresholds = DEFAULT_AGGREGATE_QUALITY_GATE_THRESHOLDS,
): QualityGateRunReport {
  const aggregate = summarizeAggregateGateRun(reports, aggregateThresholds);
  const status = worstStatus([
    ...reports.map((r) => r.status),
    aggregate.status,
  ]);
  return {
    ok: status === "pass",
    status,
    reports,
    aggregate,
  };
}
