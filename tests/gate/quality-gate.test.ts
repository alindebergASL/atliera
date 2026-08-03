import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_AGGREGATE_QUALITY_GATE_THRESHOLDS,
  DEFAULT_QUALITY_GATE_THRESHOLDS,
  runQualityGate,
  summarizeGateRun,
} from "../../src/gate/quality-gate.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

function reasonCodes(report: ReturnType<typeof runQualityGate>): string[] {
  return report.reasons.map((r) => r.code);
}

function relabelIntrinsicOwnership(
  bundle: GraphBundle,
  value: string,
): void {
  for (const record of bundle.sources) {
    record.team_id = value;
    record.account_id = value;
  }
  for (const record of bundle.claims) {
    record.team_id = value;
    record.account_id = value;
  }
  for (const record of bundle.account_objects) {
    record.team_id = value;
    record.account_id = value;
  }
  for (const record of bundle.research_runs) {
    record.team_id = value;
    record.account_id = value;
  }
  for (const audit of bundle.audit_events) audit.team_id = value;
}

describe("runQualityGate", () => {
  test("freezes public defaults and snapshots caller thresholds without aliasing", () => {
    assert.equal(Object.isFrozen(DEFAULT_QUALITY_GATE_THRESHOLDS), true);
    assert.equal(Object.isFrozen(DEFAULT_AGGREGATE_QUALITY_GATE_THRESHOLDS), true);
    assert.equal(
      Reflect.set(
        DEFAULT_QUALITY_GATE_THRESHOLDS as unknown as Record<string, number>,
        "min_verified_claim_evidence_coverage",
        0,
      ),
      false,
    );

    const callerThresholds = {
      min_accepted_excerpt_rate: 0.25,
      min_verified_claim_evidence_coverage: 0.75,
      max_invented_id_failures: 0,
    };
    const report = runQualityGate(makeValidBundle(), callerThresholds);

    assert.notEqual(report.thresholds, callerThresholds);
    assert.deepEqual(report.thresholds, callerThresholds);
    callerThresholds.min_verified_claim_evidence_coverage = 0;
    assert.equal(report.thresholds.min_verified_claim_evidence_coverage, 0.75);
    Object.freeze(report.thresholds);
    assert.equal(Object.isFrozen(callerThresholds), false);
  });

  test("passes the valid baseline and records zero invented ID failures", () => {
    const report = runQualityGate(makeValidBundle());

    assert.equal(report.status, "pass");
    assert.equal(report.ok, true);
    assert.equal(report.metrics.invented_id_failures, 0);
    assert.equal(report.metrics.accepted_excerpt_rate, 1);
    assert.equal(report.metrics.verified_claim_evidence_coverage, 1);
    assert.equal(report.validation_report.metrics.verified_claims, 1);
    assert.equal(report.validation_report.metrics.verified_account_objects, 1);
  });

  test("fails when validator hard failures are present", () => {
    const bundle = clone(makeValidBundle());
    bundle.excerpts[0]!.source_document_id = "src_missing_source";

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.ok, false);
    assert.ok(reasonCodes(report).includes("hard_failures_present"));
  });

  test("propagates an audit-reference hard failure", () => {
    const bundle = clone(makeValidBundle());
    bundle.audit_events[0]!.target_id = "run_missing";

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.ok, false);
    assert.ok(report.validation_report.hard_failures.some(
      (failure) => failure.code === "unresolved_local_audit_target",
    ));
    assert.ok(reasonCodes(report).includes("hard_failures_present"));
  });

  for (const [label, value] of [
    ["blank", ""],
    ["whitespace-only", " \t\n"],
    ["U+0085-only", "\u0085"],
  ] as const) {
    test(`fails coherently ${label} intrinsic ownership through validator hard failures`, () => {
      const bundle = clone(makeValidBundle());
      relabelIntrinsicOwnership(bundle, value);

      const report = runQualityGate(bundle);

      assert.equal(report.status, "fail");
      assert.equal(report.ok, false);
      assert.equal(report.validation_report.ok, false);
      assert.ok(report.validation_report.hard_failures.length > 0);
      assert.ok(
        report.validation_report.hard_failures.every(
          (failure) => failure.code === "subject_scope_mismatch",
        ),
      );
      assert.ok(reasonCodes(report).includes("hard_failures_present"));
    });
  }

  test("fails a coherently U+FEFF-owned bundle through validator hard failures", () => {
    const bundle = clone(makeValidBundle());
    relabelIntrinsicOwnership(bundle, "\uFEFF");

    const report = runQualityGate(bundle);

    assert.equal(report.status, "fail");
    assert.equal(report.ok, false);
    assert.equal(report.validation_report.ok, false);
    assert.ok(report.validation_report.hard_failures.length > 0);
    assert.ok(
      report.validation_report.hard_failures.every(
        (failure) => failure.code === "subject_scope_mismatch",
      ),
    );
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

  for (const sourceStatus of ["stale", "unavailable", "rejected"] as const) {
    test(`fails current coverage without a validator hard failure when the source is ${sourceStatus}`, () => {
      const bundle = clone(makeValidBundle());
      bundle.sources[0]!.status = sourceStatus;

      const report = runQualityGate(bundle);

      assert.equal(report.validation_report.ok, true);
      assert.deepEqual(report.validation_report.hard_failures, []);
      assert.equal(report.validation_report.metrics.verified_claims, 0);
      assert.equal(
        report.validation_report.metrics.verified_account_objects,
        0,
      );
      assert.equal(report.metrics.accepted_excerpts, 0);
      assert.equal(report.metrics.accepted_excerpt_rate, 0);
      assert.equal(report.metrics.verified_or_high_confidence_claims, 1);
      assert.equal(
        report.metrics
          .verified_or_high_confidence_claims_with_accepted_supporting_evidence,
        0,
      );
      assert.equal(report.metrics.verified_claim_evidence_coverage, 0);
      assert.equal(report.status, "fail");
      assert.ok(
        reasonCodes(report).includes(
          "verified_claim_evidence_coverage_below_threshold",
        ),
      );
      assert.ok(!reasonCodes(report).includes("hard_failures_present"));
    });
  }

  for (
    const claimStatus of [
      "contradicted",
      "stale",
      "rejected",
      "superseded",
    ] as const
  ) {
    test(`excludes a ${claimStatus} claim from the current coverage denominator`, () => {
      const bundle = clone(makeValidBundle());
      bundle.claims[0]!.status = claimStatus;

      const report = runQualityGate(bundle);

      assert.equal(report.validation_report.ok, true);
      assert.equal(report.metrics.verified_or_high_confidence_claims, 0);
      assert.equal(report.metrics.verified_claim_evidence_coverage, null);
    });
  }

  for (const provenanceStatus of ["stale", "unsupported"] as const) {
    test(`excludes an active ${provenanceStatus}-provenance claim from current coverage`, () => {
      const bundle = clone(makeValidBundle());
      bundle.claims[0]!.provenance_status = provenanceStatus;

      const report = runQualityGate(bundle);

      assert.equal(report.validation_report.ok, true);
      assert.equal(report.validation_report.metrics.verified_claims, 0);
      assert.equal(
        report.validation_report.metrics.verified_account_objects,
        0,
      );
      assert.equal(report.metrics.verified_or_high_confidence_claims, 0);
      assert.equal(
        report.metrics
          .verified_or_high_confidence_claims_with_accepted_supporting_evidence,
        0,
      );
      assert.equal(report.metrics.verified_claim_evidence_coverage, null);
    });
  }

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

  test("reports aggregate launch-readiness metrics across a gate corpus", () => {
    const pass = { input: "pass.json", ...runQualityGate(makeValidBundle()) };
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
    const zeroOutput = { input: "zero-output.json", ...runQualityGate(emptyBundle) };

    const summary = summarizeGateRun([pass, zeroOutput]);

    assert.equal(summary.status, "fail");
    assert.equal(summary.ok, false);
    assert.deepEqual(summary.aggregate.metrics, {
      total_bundles: 2,
      passing_bundles: 1,
      borderline_bundles: 0,
      failing_bundles: 1,
      hard_failure_bundles: 0,
      zero_output_incidents: 1,
      zero_output_incident_rate: 0.5,
      total_graph_records: pass.metrics.graph_record_count,
      total_verified_or_high_confidence_claims: 1,
      total_verified_or_high_confidence_claims_with_accepted_supporting_evidence: 1,
      aggregate_verified_claim_evidence_coverage: 1,
    });
    assert.deepEqual(
      summary.aggregate.reasons.map((reason) => reason.code),
      ["aggregate_zero_output_incident_rate_exceeded"],
    );
    assert.equal(summary.aggregate.thresholds.max_zero_output_incident_rate, 0.1);
  });

  test("passes aggregate launch-readiness metrics for clean gate corpus reports", () => {
    const first = { input: "first.json", ...runQualityGate(makeValidBundle()) };
    const second = { input: "second.json", ...runQualityGate(makeValidBundle()) };

    const summary = summarizeGateRun([first, second]);

    assert.equal(summary.status, "pass");
    assert.equal(summary.aggregate.ok, true);
    assert.equal(summary.aggregate.status, "pass");
    assert.deepEqual(summary.aggregate.reasons, []);
    assert.equal(summary.aggregate.metrics.total_bundles, 2);
    assert.equal(summary.aggregate.metrics.zero_output_incident_rate, 0);
    assert.equal(summary.aggregate.metrics.aggregate_verified_claim_evidence_coverage, 1);
  });
});
