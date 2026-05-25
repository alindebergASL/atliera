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
});
