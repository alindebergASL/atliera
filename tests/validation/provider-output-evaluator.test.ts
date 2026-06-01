import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  evaluateProviderOutputBenchmark,
  evaluateProviderOutputCase,
  type ProviderOutputBenchmarkInput,
} from "../../src/validation/provider-output-evaluator.ts";

function loadFixture(name: string): ProviderOutputBenchmarkInput {
  return JSON.parse(readFileSync(new URL(`../../fixtures/provider-comparison/${name}`, import.meta.url), "utf8"));
}

describe("provider output evaluator", () => {
  test("passes strict JSON with schema and arithmetic consistency", () => {
    const result = evaluateProviderOutputCase({
      case_id: "arithmetic_consistency_pass",
      check: "arithmetic_total_equals_phase_sum",
      required_keys: ["total_hours", "phase_hours", "confidence"],
      output_text: JSON.stringify({
        total_hours: 16,
        phase_hours: { A: 3, B: 5, C: 2.5, D: 5.5 },
        confidence: 1,
      }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.valid_json, true);
    assert.equal(result.schema_ok, true);
    assert.equal(result.semantic_ok, true);
    assert.deepEqual(result.reasons, []);
  });

  test("fails schema-valid arithmetic with an inconsistent total", () => {
    const result = evaluateProviderOutputCase({
      case_id: "arithmetic_consistency_fail",
      check: "arithmetic_total_equals_phase_sum",
      required_keys: ["total_hours", "phase_hours", "confidence"],
      output_text: JSON.stringify({
        total_hours: 12,
        phase_hours: { A: 3, B: 5, C: 2.5, D: 5.5 },
        confidence: 1,
      }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.valid_json, true);
    assert.equal(result.schema_ok, true);
    assert.equal(result.semantic_ok, false);
    assert.deepEqual(result.reasons.map((reason) => reason.code), ["arithmetic_total_mismatch"]);
  });

  test("rejects fenced JSON when strict JSON is required", () => {
    const result = evaluateProviderOutputCase({
      case_id: "strict_json_fail",
      check: "required_keys_only",
      required_keys: ["person"],
      output_text: "```json\n{\"person\":\"Nora\"}\n```",
    });

    assert.equal(result.ok, false);
    assert.equal(result.valid_json, false);
    assert.deepEqual(result.reasons.map((reason) => reason.code), ["invalid_json"]);
  });

  test("rejects invented top-level keys for exact schema checks", () => {
    const result = evaluateProviderOutputCase({
      case_id: "invented_field_fail",
      check: "required_keys_only",
      required_keys: ["person", "risk"],
      output_text: JSON.stringify({ person: "Nora", risk: "vendor lock-in", private_note: "invented" }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.schema_ok, false);
    assert.deepEqual(result.reasons.map((reason) => reason.code), ["unexpected_key"]);
  });

  test("requires synthetic Signal/Map/Play extraction coverage", () => {
    const passing = evaluateProviderOutputCase({
      case_id: "smp_pass",
      check: "synthetic_signal_map_play_coverage",
      required_keys: ["signals", "maps", "plays", "open_questions"],
      output_text: JSON.stringify({
        signals: [{ claim: "slow onboarding", support: "duplicate forms" }],
        maps: [{ object: "billing workflow", relationships: "touches CRM and invoicing" }],
        plays: [{ action: "test shared intake form", timing: "next week" }],
        open_questions: ["legal approval required"],
      }),
    });
    assert.equal(passing.ok, true);

    const failing = evaluateProviderOutputCase({
      case_id: "smp_fail",
      check: "synthetic_signal_map_play_coverage",
      required_keys: ["signals", "maps", "plays", "open_questions"],
      output_text: JSON.stringify({ signals: [], maps: [], plays: [], open_questions: [] }),
    });
    assert.equal(failing.ok, false);
    assert.deepEqual(failing.reasons.map((reason) => reason.code), ["missing_signal_map_play_coverage"]);
  });

  test("evaluates checked synthetic fixture without authorizing model runs or readiness", () => {
    const report = evaluateProviderOutputBenchmark(loadFixture("synthetic-provider-output-evaluator-cases.json"));

    assert.equal(report.ok, false);
    assert.equal(report.summary.cases, 4);
    assert.equal(report.summary.passed, 2);
    assert.equal(report.summary.failed, 2);
    assert.equal(report.authorizes_provider_run, false);
    assert.equal(report.authorizes_production_use, false);
    assert.equal(report.launch_readiness_claim, false);
    assert.deepEqual(
      report.checks.map((check) => [check.case_id, check.ok]),
      [
        ["arithmetic_consistency_pass", true],
        ["arithmetic_consistency_fail", false],
        ["schema_invented_field_fail", false],
        ["synthetic_signal_map_play_pass", true],
      ],
    );
  });
});
