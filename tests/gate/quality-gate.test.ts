import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  runQualityGate,
  summarizeGateRun,
} from "../../src/gate/quality-gate.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

function reasonCodes(report: ReturnType<typeof runQualityGate>): string[] {
  return report.reasons.map((r) => r.code);
}

describe("runQualityGate", () => {
  test("passes the valid baseline and records zero invented ID failures", () => {
    const report = runQualityGate(makeValidBundle());

    assert.equal(report.status, "pass");
    assert.equal(report.ok, true);
    assert.equal(report.metrics.invented_id_failures, 0);
    assert.equal(report.metrics.accepted_excerpt_rate, 1);
    assert.equal(report.metrics.verified_claim_evidence_coverage, 1);
  });

  test("fails when validator hard failures are present", () => {
    const bundle = clone(makeValidBundle());
    bundle.excerpts[0]!.source_document_id = "src_missing_source";

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.ok, false);
    assert.ok(reasonCodes(report).includes("hard_failures_present"));
  });

  test("keeps invented ID failures as a launch-quality metric", () => {
    const bundle = clone(makeValidBundle());
    bundle.claim_evidence[0]!.evidence_excerpt_id = "exc_missing_excerpt";

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.metrics.invented_id_failures, 1);
    assert.ok(reasonCodes(report).includes("invented_id_failures_present"));
  });

  test("marks low accepted excerpt rate as borderline when there are no hard failures", () => {
    const bundle = clone(makeValidBundle());
    bundle.excerpts.push({
      id: "exc_acme_rejected_001",
      source_document_id: "src_acme_press_001",
      text: "Rejected candidate excerpt",
      kind: "literal",
      char_start: 0,
      char_end: 1,
      captured_at: "2026-03-02T12:00:07Z",
      validation_status: "rejected",
      rejection_reason: "not relevant to the claim",
    });
    bundle.excerpts.push({
      id: "exc_acme_rejected_002",
      source_document_id: "src_acme_press_001",
      text: "Another rejected candidate excerpt",
      kind: "literal",
      char_start: 1,
      char_end: 2,
      captured_at: "2026-03-02T12:00:08Z",
      validation_status: "rejected",
      rejection_reason: "not relevant to the claim",
    });

    const report = runQualityGate(bundle);

    assert.equal(report.status, "borderline");
    assert.equal(report.ok, false);
    assert.equal(report.metrics.accepted_excerpt_rate, 1 / 3);
    assert.ok(
      reasonCodes(report).includes("accepted_excerpt_rate_below_threshold"),
    );
    assert.equal(report.validation_report.ok, true);
  });

  test("fails when verified/high-confidence claim evidence coverage is below threshold", () => {
    const bundle = clone(makeValidBundle());
    bundle.claims.push({
      id: "clm_acme_unsupported_high",
      team_id: "team_atliera_lab",
      account_id: "acc_acme_robotics",
      claim_type: "unsupported_high_confidence_claim",
      text: "Acme Robotics has an unsupported high-confidence claim.",
      normalized_subject: "acme_robotics:unsupported_high",
      confidence: "high",
      provenance_status: "unverified",
      status: "active",
      created_by: "model",
      created_at: "2026-03-02T12:00:09Z",
    });

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.metrics.verified_or_high_confidence_claims, 2);
    assert.equal(
      report.metrics.verified_or_high_confidence_claims_with_accepted_supporting_evidence,
      1,
    );
    assert.equal(report.metrics.verified_claim_evidence_coverage, 0.5);
    assert.ok(
      reasonCodes(report).includes(
        "verified_claim_evidence_coverage_below_threshold",
      ),
    );
  });

  test("fails zero-output incidents", () => {
    const emptyBundle = {
      sources: [],
      excerpts: [],
      claims: [],
      claim_evidence: [],
      account_objects: [],
      account_object_claims: [],
      research_runs: [],
      run_artifacts: [],
      audit_events: [],
    };

    const report = runQualityGate(emptyBundle);

    assert.equal(report.status, "fail");
    assert.equal(report.metrics.graph_record_count, 0);
    assert.ok(reasonCodes(report).includes("zero_output_incident"));
  });

  test("summarizes multiple bundles by worst status", () => {
    const pass = { input: "pass.json", ...runQualityGate(makeValidBundle()) };
    const borderlineBundle = clone(makeValidBundle());
    borderlineBundle.excerpts.push({
      id: "exc_borderline_rejected_001",
      source_document_id: "src_acme_press_001",
      text: "Rejected candidate excerpt",
      kind: "literal",
      char_start: 0,
      char_end: 1,
      captured_at: "2026-03-02T12:00:10Z",
      validation_status: "rejected",
      rejection_reason: "not relevant",
    });
    borderlineBundle.excerpts.push({
      id: "exc_borderline_rejected_002",
      source_document_id: "src_acme_press_001",
      text: "Rejected candidate excerpt two",
      kind: "literal",
      char_start: 1,
      char_end: 2,
      captured_at: "2026-03-02T12:00:11Z",
      validation_status: "rejected",
      rejection_reason: "not relevant",
    });
    const borderline = {
      input: "borderline.json",
      ...runQualityGate(borderlineBundle),
    };

    assert.equal(summarizeGateRun([pass]).status, "pass");
    assert.equal(summarizeGateRun([pass, borderline]).status, "borderline");
  });
});
