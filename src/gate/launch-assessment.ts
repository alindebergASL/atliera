import { readFile } from "node:fs/promises";

import type { GateStatus, NamedQualityGateReport, QualityGateRunReport } from "./quality-gate.ts";
import { runQualityGate, summarizeGateRun } from "./quality-gate.ts";
import { parseGraphBundle } from "../graph/schema.ts";
import { validateGraphBundleRaw } from "../graph/validate.ts";
import { buildWorkshopViewModel } from "../workshop/view-model.ts";
import type {
  NamedWorkshopLensUsefulnessReview,
  WorkshopLensUsefulnessCorpusSummary,
  WorkshopLensUsefulnessReview,
} from "../workshop/lens-usefulness.ts";
import {
  evaluateWorkshopLensUsefulness,
  summarizeWorkshopLensUsefulnessReviews,
} from "../workshop/lens-usefulness.ts";

export type LaunchGateCorpusEntryRole =
  | "usable_gate_account"
  | "borderline_calibration"
  | "adversarial_regression";

export interface LaunchGateCorpusEntry {
  id: string;
  path: string;
  role: LaunchGateCorpusEntryRole;
  expected_validation_ok: boolean;
  expected_gate_status: GateStatus;
  rationale: string;
}

export interface LaunchGateCorpusManifest {
  schema_version: "atliera.launch_gate_corpus.v1";
  name: string;
  purpose: string;
  launch_readiness_claim: false;
  selected_at: string;
  entries: LaunchGateCorpusEntry[];
}

export type LaunchGateAssessmentStatus = "pass" | "fail";

export type LaunchGateAssessmentReasonCode =
  | "expected_outcome_mismatches_present"
  | "quality_gate_failures_present"
  | "lens_usefulness_failures_present";

export type LaunchGateExpectationMismatchCode =
  | "validation_ok_mismatch"
  | "gate_status_mismatch";

export interface LaunchGateAssessmentReason {
  code: LaunchGateAssessmentReasonCode;
  severity: LaunchGateAssessmentStatus;
  message: string;
  observed: number;
  threshold: number;
}

export interface LaunchGateAssessmentMetrics {
  total_entries: number;
  usable_gate_accounts: number;
  borderline_calibrations: number;
  adversarial_regressions: number;
  expected_outcome_mismatches: number;
}

export interface LaunchGateAssessmentGate4Metrics {
  usable_gate_accounts: number;
  usable_hard_invariant_failures: number;
  usable_zero_output_incidents: number;
  usable_zero_output_incident_rate: number | null;
  usable_verified_or_high_confidence_claims: number;
  usable_verified_or_high_confidence_claims_with_accepted_supporting_evidence: number;
  usable_material_claim_coverage: number | null;
  usable_lens_usefulness_failures: number;
}

export interface LaunchGateAssessmentEntry {
  id: string;
  path: string;
  role: LaunchGateCorpusEntryRole;
  validation_ok: boolean;
  expected_validation_ok: boolean;
  gate_status: GateStatus;
  expected_gate_status: GateStatus;
  expectation_match: boolean;
  mismatch_codes: LaunchGateExpectationMismatchCode[];
  lens_usefulness?: WorkshopLensUsefulnessReview;
}

export interface LaunchGateAssessment {
  schema_version: "atliera.launch_gate_assessment.v1";
  ok: boolean;
  status: LaunchGateAssessmentStatus;
  launch_readiness_claim: false;
  expected_outcomes_ok: boolean;
  manifest: {
    path: string;
    schema_version: LaunchGateCorpusManifest["schema_version"];
    name: string;
    selected_at: string;
  };
  metrics: LaunchGateAssessmentMetrics;
  gate_4_metrics: LaunchGateAssessmentGate4Metrics;
  reasons: LaunchGateAssessmentReason[];
  entries: LaunchGateAssessmentEntry[];
  quality_gate_summary: QualityGateRunReport;
  lens_usefulness_summary: WorkshopLensUsefulnessCorpusSummary;
}

export interface LaunchGateAssessmentOptions {
  manifestPath?: string;
}

const SAFE_ENTRY_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const SAFE_FIXTURE_PATH = /^fixtures\/graph\/(valid|invalid)\/[a-z0-9][a-z0-9._-]*\.json$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function parseRole(value: unknown): LaunchGateCorpusEntryRole {
  if (
    value === "usable_gate_account" ||
    value === "borderline_calibration" ||
    value === "adversarial_regression"
  ) {
    return value;
  }
  throw new Error("invalid launch-gate corpus entry role");
}

function parseGateStatus(value: unknown): GateStatus {
  if (value === "pass" || value === "borderline" || value === "fail") {
    return value;
  }
  throw new Error("invalid launch-gate corpus expected gate status");
}

function assertSafeEntryPath(path: string): void {
  if (!SAFE_FIXTURE_PATH.test(path) || path.includes("..") || path.startsWith("/")) {
    throw new Error("unsafe launch-gate corpus entry path");
  }
}

export function parseLaunchGateCorpusManifest(raw: unknown): LaunchGateCorpusManifest {
  assertRecord(raw, "launch-gate corpus manifest");
  if (raw.schema_version !== "atliera.launch_gate_corpus.v1") {
    throw new Error("unsupported launch-gate corpus manifest schema_version");
  }
  if (raw.launch_readiness_claim !== false) {
    throw new Error("launch-gate corpus manifest must not claim launch readiness");
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new Error("launch-gate corpus manifest name is required");
  }
  if (typeof raw.purpose !== "string" || raw.purpose.trim().length < 20) {
    throw new Error("launch-gate corpus manifest purpose is required");
  }
  if (typeof raw.selected_at !== "string" || !DATE_ONLY.test(raw.selected_at)) {
    throw new Error("launch-gate corpus manifest selected_at must be YYYY-MM-DD");
  }
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) {
    throw new Error("launch-gate corpus manifest entries are required");
  }

  const ids = new Set<string>();
  const entries = raw.entries.map((entryRaw) => {
    assertRecord(entryRaw, "launch-gate corpus entry");
    const id = entryRaw.id;
    const path = entryRaw.path;
    const rationale = entryRaw.rationale;
    if (typeof id !== "string" || !SAFE_ENTRY_ID.test(id)) {
      throw new Error("unsafe launch-gate corpus entry id");
    }
    if (ids.has(id)) {
      throw new Error("duplicate launch-gate corpus entry id");
    }
    ids.add(id);
    if (typeof path !== "string") {
      throw new Error("launch-gate corpus entry path is required");
    }
    assertSafeEntryPath(path);
    if (typeof entryRaw.expected_validation_ok !== "boolean") {
      throw new Error("launch-gate corpus expected validation status is required");
    }
    if (typeof rationale !== "string" || rationale.trim().length < 20) {
      throw new Error("launch-gate corpus entry rationale is required");
    }

    return {
      id,
      path,
      role: parseRole(entryRaw.role),
      expected_validation_ok: entryRaw.expected_validation_ok,
      expected_gate_status: parseGateStatus(entryRaw.expected_gate_status),
      rationale,
    };
  });

  return {
    schema_version: "atliera.launch_gate_corpus.v1",
    name: raw.name,
    purpose: raw.purpose,
    launch_readiness_claim: false,
    selected_at: raw.selected_at,
    entries,
  };
}

function computeMetrics(entries: LaunchGateAssessmentEntry[]): LaunchGateAssessmentMetrics {
  return {
    total_entries: entries.length,
    usable_gate_accounts: entries.filter((entry) => entry.role === "usable_gate_account").length,
    borderline_calibrations: entries.filter((entry) => entry.role === "borderline_calibration").length,
    adversarial_regressions: entries.filter((entry) => entry.role === "adversarial_regression").length,
    expected_outcome_mismatches: entries.filter((entry) => !entry.expectation_match).length,
  };
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function computeGate4Metrics(
  entries: LaunchGateAssessmentEntry[],
  reports: NamedQualityGateReport[],
  lensUsefulnessSummary: WorkshopLensUsefulnessCorpusSummary,
): LaunchGateAssessmentGate4Metrics {
  const reportByInput = new Map(reports.map((report) => [report.input, report]));
  const usableEntries = entries.filter((entry) => entry.role === "usable_gate_account");
  const usableReports = usableEntries
    .map((entry) => reportByInput.get(entry.path))
    .filter((report): report is NamedQualityGateReport => report !== undefined);
  const usableVerifiedClaims = usableReports.reduce(
    (sum, report) => sum + report.metrics.verified_or_high_confidence_claims,
    0,
  );
  const usableSupportedVerifiedClaims = usableReports.reduce(
    (sum, report) =>
      sum +
      report.metrics
        .verified_or_high_confidence_claims_with_accepted_supporting_evidence,
    0,
  );
  const usableZeroOutputIncidents = usableReports.filter(
    (report) => report.metrics.graph_record_count === 0,
  ).length;

  return {
    usable_gate_accounts: usableEntries.length,
    usable_hard_invariant_failures: usableReports.filter(
      (report) => report.metrics.hard_failures > 0,
    ).length,
    usable_zero_output_incidents: usableZeroOutputIncidents,
    usable_zero_output_incident_rate: rate(usableZeroOutputIncidents, usableEntries.length),
    usable_verified_or_high_confidence_claims: usableVerifiedClaims,
    usable_verified_or_high_confidence_claims_with_accepted_supporting_evidence:
      usableSupportedVerifiedClaims,
    usable_material_claim_coverage: rate(
      usableSupportedVerifiedClaims,
      usableVerifiedClaims,
    ),
    usable_lens_usefulness_failures: lensUsefulnessSummary.metrics.failing_accounts,
  };
}

function assessReasons(
  metrics: LaunchGateAssessmentMetrics,
  qualityGateSummary: QualityGateRunReport,
  lensUsefulnessSummary: WorkshopLensUsefulnessCorpusSummary,
): LaunchGateAssessmentReason[] {
  const reasons: LaunchGateAssessmentReason[] = [];
  if (metrics.expected_outcome_mismatches > 0) {
    reasons.push({
      code: "expected_outcome_mismatches_present",
      severity: "fail",
      message: "one or more launch-gate corpus entries did not match expected deterministic outcomes",
      observed: metrics.expected_outcome_mismatches,
      threshold: 0,
    });
  }
  if (!qualityGateSummary.ok) {
    reasons.push({
      code: "quality_gate_failures_present",
      severity: "fail",
      message: "launch-gate corpus quality-gate summary is not passing",
      observed: qualityGateSummary.reports.filter((report) => report.status !== "pass").length,
      threshold: 0,
    });
  }
  if (!lensUsefulnessSummary.ok) {
    reasons.push({
      code: "lens_usefulness_failures_present",
      severity: "fail",
      message: "one or more usable gate accounts failed Workshop lens-usefulness review",
      observed: lensUsefulnessSummary.metrics.failing_accounts,
      threshold: 0,
    });
  }
  return reasons;
}

export async function assessLaunchGateCorpusManifest(
  rawManifest: unknown,
  options: LaunchGateAssessmentOptions = {},
): Promise<LaunchGateAssessment> {
  const manifest = parseLaunchGateCorpusManifest(rawManifest);
  const reports: NamedQualityGateReport[] = [];
  const lensReviews: NamedWorkshopLensUsefulnessReview[] = [];
  const entries: LaunchGateAssessmentEntry[] = [];

  for (const entry of manifest.entries) {
    const rawBundle = JSON.parse(await readFile(entry.path, "utf8")) as unknown;
    const validationReport = validateGraphBundleRaw(rawBundle, { mode: "fixture" });
    const gateReport = runQualityGate(rawBundle);
    reports.push({ input: entry.path, ...gateReport });

    const mismatchCodes: LaunchGateExpectationMismatchCode[] = [];
    if (validationReport.ok !== entry.expected_validation_ok) {
      mismatchCodes.push("validation_ok_mismatch");
    }
    if (gateReport.status !== entry.expected_gate_status) {
      mismatchCodes.push("gate_status_mismatch");
    }

    let lensUsefulness: WorkshopLensUsefulnessReview | undefined;
    if (entry.role === "usable_gate_account" && validationReport.ok) {
      const parsed = parseGraphBundle(rawBundle);
      if (parsed.ok) {
        lensUsefulness = evaluateWorkshopLensUsefulness(
          buildWorkshopViewModel(parsed.value),
        );
        lensReviews.push({ input: entry.path, ...lensUsefulness });
      }
    }

    entries.push({
      id: entry.id,
      path: entry.path,
      role: entry.role,
      validation_ok: validationReport.ok,
      expected_validation_ok: entry.expected_validation_ok,
      gate_status: gateReport.status,
      expected_gate_status: entry.expected_gate_status,
      expectation_match: mismatchCodes.length === 0,
      mismatch_codes: mismatchCodes,
      ...(lensUsefulness ? { lens_usefulness: lensUsefulness } : {}),
    });
  }

  const qualityGateSummary = summarizeGateRun(reports);
  const lensUsefulnessSummary = summarizeWorkshopLensUsefulnessReviews(lensReviews);
  const metrics = computeMetrics(entries);
  const gate4Metrics = computeGate4Metrics(entries, reports, lensUsefulnessSummary);
  const reasons = assessReasons(metrics, qualityGateSummary, lensUsefulnessSummary);

  return {
    schema_version: "atliera.launch_gate_assessment.v1",
    ok: reasons.length === 0,
    status: reasons.length === 0 ? "pass" : "fail",
    launch_readiness_claim: false,
    expected_outcomes_ok: metrics.expected_outcome_mismatches === 0,
    manifest: {
      path: options.manifestPath ?? "<memory>",
      schema_version: manifest.schema_version,
      name: manifest.name,
      selected_at: manifest.selected_at,
    },
    metrics,
    gate_4_metrics: gate4Metrics,
    reasons,
    entries,
    quality_gate_summary: qualityGateSummary,
    lens_usefulness_summary: lensUsefulnessSummary,
  };
}

export async function assessLaunchGateCorpusManifestFile(
  manifestPath: string,
): Promise<LaunchGateAssessment> {
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  return assessLaunchGateCorpusManifest(raw, { manifestPath });
}
