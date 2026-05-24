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

type LaunchGateCorpusManifest = {
  schema_version: "atliera.launch_gate_corpus.v1";
  name: string;
  purpose: string;
  launch_readiness_claim: false;
  selected_at: string;
  entries: Array<{
    id: string;
    path: string;
    role: "usable_gate_account" | "borderline_calibration" | "adversarial_regression";
    expected_validation_ok: boolean;
    expected_gate_status: "pass" | "borderline" | "fail";
    rationale: string;
  }>;
};

const LAUNCH_GATE_CORPUS_MANIFEST = "fixtures/gate-corpus/launch-v0.json";

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
    path: "fixtures/graph/valid/workshop-three-lane.json",
    validationOk: true,
    gateStatus: "pass",
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

function assertLaunchGateManifest(raw: unknown): asserts raw is LaunchGateCorpusManifest {
  assert.equal(typeof raw, "object");
  assert.notEqual(raw, null);
  const manifest = raw as Partial<LaunchGateCorpusManifest>;
  assert.equal(manifest.schema_version, "atliera.launch_gate_corpus.v1");
  assert.equal(manifest.launch_readiness_claim, false);
  assert.equal(typeof manifest.name, "string");
  assert.equal(typeof manifest.purpose, "string");
  assert.match(manifest.selected_at ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(manifest.entries));
  assert.ok(manifest.entries.length >= 4);
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

  test("documents a selected launch-gate corpus without claiming launch readiness", async () => {
    const manifestRaw = await loadJson(LAUNCH_GATE_CORPUS_MANIFEST);
    assertLaunchGateManifest(manifestRaw);

    const ids = new Set<string>();
    const roles = new Set(manifestRaw.entries.map((entry) => entry.role));
    assert.ok(roles.has("usable_gate_account"));
    assert.ok(roles.has("borderline_calibration"));
    assert.ok(roles.has("adversarial_regression"));

    for (const entry of manifestRaw.entries) {
      assert.match(entry.id, /^[a-z0-9][a-z0-9._-]{2,63}$/);
      assert.equal(ids.has(entry.id), false, `duplicate launch corpus id ${entry.id}`);
      ids.add(entry.id);
      assert.equal(entry.path.startsWith("fixtures/graph/"), true);
      assert.equal(entry.path.includes(".."), false);
      assert.equal(entry.rationale.length > 20, true);

      const raw = await loadJson(entry.path);
      const validationReport = validateGraphBundleRaw(raw, { mode: "fixture" });
      const gateReport = runQualityGate(raw);
      assert.equal(validationReport.ok, entry.expected_validation_ok, entry.path);
      assert.equal(gateReport.status, entry.expected_gate_status, entry.path);
    }
  });
});
