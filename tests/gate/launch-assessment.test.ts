import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assessLaunchGateCorpusManifest,
  assessLaunchGateCorpusManifestFile,
} from "../../src/gate/launch-assessment.ts";

describe("launch-gate corpus assessment", () => {
  test("assesses the selected deterministic corpus without claiming launch readiness", async () => {
    const assessment = await assessLaunchGateCorpusManifestFile(
      "fixtures/gate-corpus/launch-v0.json",
    );

    assert.equal(assessment.schema_version, "atliera.launch_gate_assessment.v1");
    assert.equal(assessment.manifest.path, "fixtures/gate-corpus/launch-v0.json");
    assert.equal(assessment.manifest.schema_version, "atliera.launch_gate_corpus.v1");
    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.expected_outcomes_ok, true);
    assert.equal(assessment.ok, false);
    assert.equal(assessment.status, "fail");

    assert.deepEqual(assessment.metrics, {
      total_entries: 5,
      usable_gate_accounts: 2,
      borderline_calibrations: 1,
      adversarial_regressions: 2,
      expected_outcome_mismatches: 0,
    });

    assert.equal(assessment.quality_gate_summary.reports.length, 5);
    assert.equal(assessment.quality_gate_summary.status, "fail");
    assert.equal(
      assessment.quality_gate_summary.aggregate.metrics.zero_output_incident_rate,
      0.2,
    );

    assert.equal(assessment.lens_usefulness_summary.metrics.total_accounts, 2);
    assert.equal(assessment.lens_usefulness_summary.metrics.passing_accounts, 1);
    assert.equal(assessment.lens_usefulness_summary.metrics.failing_accounts, 1);
    assert.equal(assessment.lens_usefulness_summary.status, "fail");

    assert.deepEqual(assessment.gate_4_metrics, {
      usable_gate_accounts: 2,
      usable_hard_invariant_failures: 0,
      usable_zero_output_incidents: 0,
      usable_zero_output_incident_rate: 0,
      usable_verified_or_high_confidence_claims: 4,
      usable_verified_or_high_confidence_claims_with_accepted_supporting_evidence: 4,
      usable_material_claim_coverage: 1,
      usable_lens_usefulness_failures: 1,
    });

    assert.deepEqual(
      assessment.entries.map((entry) => ({
        id: entry.id,
        role: entry.role,
        validation_ok: entry.validation_ok,
        gate_status: entry.gate_status,
        lens_status: entry.lens_usefulness?.status ?? null,
        expectation_match: entry.expectation_match,
      })),
      [
        {
          id: "minimal-pass",
          role: "usable_gate_account",
          validation_ok: true,
          gate_status: "pass",
          lens_status: "fail",
          expectation_match: true,
        },
        {
          id: "workshop-three-lane",
          role: "usable_gate_account",
          validation_ok: true,
          gate_status: "pass",
          lens_status: "pass",
          expectation_match: true,
        },
        {
          id: "borderline-low-excerpt-rate",
          role: "borderline_calibration",
          validation_ok: true,
          gate_status: "borderline",
          lens_status: null,
          expectation_match: true,
        },
        {
          id: "invented-source-id",
          role: "adversarial_regression",
          validation_ok: false,
          gate_status: "fail",
          lens_status: null,
          expectation_match: true,
        },
        {
          id: "zero-output",
          role: "adversarial_regression",
          validation_ok: true,
          gate_status: "fail",
          lens_status: null,
          expectation_match: true,
        },
      ],
    );
  });

  test("fails closed on unsafe manifest entry paths before reading fixtures", async () => {
    await assert.rejects(
      () =>
        assessLaunchGateCorpusManifest(
          {
            schema_version: "atliera.launch_gate_corpus.v1",
            name: "unsafe",
            purpose: "must be rejected before fixture reads",
            launch_readiness_claim: false,
            selected_at: "2026-05-25",
            entries: [
              {
                id: "escape",
                path: "../secrets.json",
                role: "usable_gate_account",
                expected_validation_ok: true,
                expected_gate_status: "pass",
                rationale: "unsafe fixture path should be rejected deterministically",
              },
            ],
          },
          { manifestPath: "fixtures/gate-corpus/unsafe.json" },
        ),
      /unsafe launch-gate corpus entry path/,
    );
  });

  test("reports expected-outcome mismatches without hiding actual gate evidence", async () => {
    const assessment = await assessLaunchGateCorpusManifest(
      {
        schema_version: "atliera.launch_gate_corpus.v1",
        name: "mismatch",
        purpose: "exercise deterministic expected-outcome mismatch reporting",
        launch_readiness_claim: false,
        selected_at: "2026-05-25",
        entries: [
          {
            id: "wrong-gate-expectation",
            path: "fixtures/graph/valid/minimal-pass.json",
            role: "usable_gate_account",
            expected_validation_ok: true,
            expected_gate_status: "fail",
            rationale: "minimal pass should not be hidden by manifest expectations",
          },
        ],
      },
      { manifestPath: "fixtures/gate-corpus/mismatch.json" },
    );

    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.expected_outcomes_ok, false);
    assert.equal(assessment.metrics.expected_outcome_mismatches, 1);
    assert.equal(assessment.entries[0]?.validation_ok, true);
    assert.equal(assessment.entries[0]?.gate_status, "pass");
    assert.deepEqual(assessment.entries[0]?.mismatch_codes, ["gate_status_mismatch"]);
    assert.deepEqual(
      assessment.reasons.map((reason) => reason.code),
      ["expected_outcome_mismatches_present", "lens_usefulness_failures_present"],
    );
  });

  test("scopes Gate 4 metrics to usable gate accounts", async () => {
    const assessment = await assessLaunchGateCorpusManifest(
      {
        schema_version: "atliera.launch_gate_corpus.v1",
        name: "usable scoped metrics",
        purpose: "prove adversarial and calibration entries do not pollute usable-account Gate 4 metrics",
        launch_readiness_claim: false,
        selected_at: "2026-05-25",
        entries: [
          {
            id: "usable-minimal",
            path: "fixtures/graph/valid/minimal-pass.json",
            role: "usable_gate_account",
            expected_validation_ok: true,
            expected_gate_status: "pass",
            rationale: "usable account should define the scoped launch metrics",
          },
          {
            id: "adversarial-zero-output",
            path: "fixtures/graph/invalid/zero-output.json",
            role: "adversarial_regression",
            expected_validation_ok: true,
            expected_gate_status: "fail",
            rationale: "adversarial zero-output fixture must remain outside usable-account metrics",
          },
          {
            id: "calibration-borderline",
            path: "fixtures/graph/valid/borderline-low-excerpt-rate.json",
            role: "borderline_calibration",
            expected_validation_ok: true,
            expected_gate_status: "borderline",
            rationale: "calibration fixture must remain outside usable-account metrics",
          },
        ],
      },
      { manifestPath: "fixtures/gate-corpus/scoped.json" },
    );

    assert.equal(assessment.quality_gate_summary.aggregate.metrics.zero_output_incidents, 1);
    assert.equal(assessment.quality_gate_summary.status, "fail");
    assert.deepEqual(assessment.gate_4_metrics, {
      usable_gate_accounts: 1,
      usable_hard_invariant_failures: 0,
      usable_zero_output_incidents: 0,
      usable_zero_output_incident_rate: 0,
      usable_verified_or_high_confidence_claims: 1,
      usable_verified_or_high_confidence_claims_with_accepted_supporting_evidence: 1,
      usable_material_claim_coverage: 1,
      usable_lens_usefulness_failures: 1,
    });
  });
});
