import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import { runQualityGate } from "../../src/gate/quality-gate.ts";
import type { GateReasonCode } from "../../src/gate/quality-gate.ts";
import type { HardFailureCode } from "../../src/graph/report.ts";
import { validateGraphBundleRaw } from "../../src/graph/validate.ts";

type CorpusCase = {
  path: string;
  validationOk: boolean;
  gateStatus: "pass" | "borderline" | "fail";
  expectedReasonCodes?: GateReasonCode[];
  expectedHardFailureCodes?: HardFailureCode[];
};

const CASES: CorpusCase[] = [
  {
    path: "fixtures/graph/valid/minimal-pass.json",
    validationOk: true,
    gateStatus: "pass",
  },
  {
    path: "fixtures/graph/valid/borderline-low-excerpt-rate.json",
    validationOk: true,
    gateStatus: "borderline",
    expectedReasonCodes: ["accepted_excerpt_rate_below_threshold"],
  },
  {
    path: "fixtures/graph/invalid/invented-source-id.json",
    validationOk: false,
    gateStatus: "fail",
    expectedReasonCodes: ["hard_failures_present", "invented_id_failures_present"],
    expectedHardFailureCodes: ["invented_source_document_id"],
  },
  {
    path: "fixtures/graph/invalid/excerpt-span-mismatch.json",
    validationOk: false,
    gateStatus: "fail",
    expectedReasonCodes: ["hard_failures_present"],
    expectedHardFailureCodes: ["excerpt_span_text_mismatch"],
  },
  {
    path: "fixtures/graph/invalid/unsupported-verified-claim.json",
    validationOk: false,
    gateStatus: "fail",
    expectedReasonCodes: [
      "hard_failures_present",
      "verified_claim_evidence_coverage_below_threshold",
    ],
    expectedHardFailureCodes: ["verified_claim_without_evidence"],
  },
  {
    path: "fixtures/graph/invalid/zero-output.json",
    validationOk: true,
    gateStatus: "fail",
    expectedReasonCodes: ["zero_output_incident"],
  },
];

async function loadJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("fixture corpus", () => {
  for (const c of CASES) {
    test(`${c.path} has expected validator and gate outcome`, async () => {
      const raw = await loadJson(c.path);
      const validationReport = validateGraphBundleRaw(raw, { mode: "fixture" });
      const gateReport = runQualityGate(raw);

      assert.equal(validationReport.ok, c.validationOk);
      assert.equal(gateReport.status, c.gateStatus);
      assert.equal(gateReport.ok, c.gateStatus === "pass");

      const hardFailureCodes = validationReport.hard_failures.map((f) => f.code);
      for (const expected of c.expectedHardFailureCodes ?? []) {
        assert.ok(
          hardFailureCodes.includes(expected),
          `${c.path} expected hard failure ${expected}, got ${hardFailureCodes.join(", ")}`,
        );
      }

      const reasonCodes = gateReport.reasons.map((r) => r.code);
      for (const expected of c.expectedReasonCodes ?? []) {
        assert.ok(
          reasonCodes.includes(expected),
          `${c.path} expected gate reason ${expected}, got ${reasonCodes.join(", ")}`,
        );
      }
    });
  }

  test("corpus includes both valid and invalid concrete JSON fixture files", () => {
    assert.ok(CASES.some((c) => c.validationOk && c.gateStatus === "pass"));
    assert.ok(CASES.some((c) => c.validationOk && c.gateStatus === "borderline"));
    assert.ok(CASES.some((c) => !c.validationOk && c.gateStatus === "fail"));
  });
});
