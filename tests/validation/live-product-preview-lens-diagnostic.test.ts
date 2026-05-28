import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  classifyLiveProductPreviewLensDiagnostic,
  type LiveProductPreviewLensDiagnosticReport,
  type LiveProductPreviewLensDiagnosticInput,
} from "../../src/validation/live-product-preview-lens-diagnostic.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const INPUT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-lens-diagnostic-input.json",
);
const REPORT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-lens-diagnostic-report.json",
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function liveInput(): LiveProductPreviewLensDiagnosticInput {
  return readJson<LiveProductPreviewLensDiagnosticInput>(INPUT_FIXTURE);
}

function baseInput(): LiveProductPreviewLensDiagnosticInput {
  return {
    preview_ref: "live-product-preview-test",
    source_classification: "weak-but-valid",
    source_reason_codes: ["insufficient_useful_lenses"],
    validation_status: {
      graph_validation: "passed",
      quality_gate: "pass",
      workshop_preview: "passed",
    },
    output_counts: {
      excerpts: 1,
      claims: 1,
      account_objects: 2,
    },
    graph_supported_lens_item_counts: {
      signals: 1,
      maps: 1,
      plays: 0,
    },
    workshop_lens_item_counts: {
      signals: 1,
      maps: 0,
      plays: 0,
    },
    useful_lens_item_counts: {
      signals: 1,
      maps: 0,
      plays: 0,
    },
    useful_lenses: ["signals"],
    fixture_validation_candidates: ["fixtures/graph/valid/workshop-three-lane.json"],
    safety: {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
      provider_or_model_comparison: false,
      corpus_expansion: false,
      product_preview_expansion: false,
      web_search_or_tools: false,
    },
  };
}

function assertNoExecutionApproval(report: LiveProductPreviewLensDiagnosticReport): void {
  assert.equal(report.launch_readiness_claim, false);
  assert.equal(report.product_readiness_claim, false);
  assert.equal(report.production_readiness_claim, false);
  assert.equal(report.approves_live_provider_call, false);
  assert.equal(report.approves_provider_spend, false);
  assert.equal(report.approves_expansion_or_comparison, false);
  assert.deepEqual(report.safety, {
    live_provider_call: false,
    provider_spend: false,
    production_writes: false,
    runtime_model_mode_integration: false,
    provider_or_model_comparison: false,
    corpus_expansion: false,
    product_preview_expansion: false,
    web_search_or_tools: false,
  });
}

describe("live product preview lens diagnostic", () => {
  test("classifies the first live preview as structure absent for Maps and Plays", () => {
    const report = classifyLiveProductPreviewLensDiagnostic(liveInput());

    assert.deepEqual(report, readJson<LiveProductPreviewLensDiagnosticReport>(REPORT_FIXTURE));
    assert.equal(report.ok, false);
    assert.equal(report.status, "decision");
    assert.equal(report.preview_ref, "live-product-preview-20260528a");
    assert.equal(report.classification, "structure-absent-account-limitation");
    assert.equal(report.terminal_next_action, "stop_current_account_remediation");
    assert.deepEqual(report.diagnostic_basis.absent_supported_lenses, ["maps", "plays"]);
    assert.deepEqual(report.diagnostic_basis.present_supported_lenses, ["signals"]);
    assert.deepEqual(report.allowed_no_spend_followups, ["use_existing_three_lane_fixture_for_mapping_validation"]);
    assert.deepEqual(report.blocked_next_actions, [
      "live_provider_rerun",
      "provider_comparison",
      "corpus_expansion",
      "product_preview_expansion",
      "prompt_or_schema_pressure_for_unsupported_lens_content",
      "launch_readiness_claim",
      "product_readiness_claim",
      "production_readiness_claim",
    ]);
    assertNoExecutionApproval(report);
  });

  test("classifies present graph structure that fails to surface as a mapping gap", () => {
    const input = baseInput();
    const report = classifyLiveProductPreviewLensDiagnostic(input);

    assert.equal(report.classification, "structure-present-mapping-gap");
    assert.equal(report.terminal_next_action, "fix_workshop_lens_mapping_against_existing_outputs");
    assert.deepEqual(report.diagnostic_basis.present_supported_lenses, ["signals", "maps"]);
    assert.deepEqual(report.diagnostic_basis.unsurfaced_supported_lenses, ["maps"]);
    assert.deepEqual(report.allowed_no_spend_followups, ["deterministic_workshop_lens_mapping_fix"]);
    assertNoExecutionApproval(report);
  });

  test("classifies insufficient sanitized evidence without spawning more diagnostics", () => {
    const input = {
      ...baseInput(),
      output_counts: { excerpts: 0, claims: 0, account_objects: 0 },
      graph_supported_lens_item_counts: { signals: 0, maps: 0, plays: 0 },
      workshop_lens_item_counts: { signals: 0, maps: 0, plays: 0 },
      useful_lens_item_counts: { signals: 0, maps: 0, plays: 0 },
      useful_lenses: [],
    } satisfies LiveProductPreviewLensDiagnosticInput;

    const report = classifyLiveProductPreviewLensDiagnostic(input);

    assert.equal(report.classification, "insufficient-sanitized-evidence");
    assert.equal(report.terminal_next_action, "stop_until_sanitized_graph_lens_counts_exist");
    assert.deepEqual(report.allowed_no_spend_followups, ["publish_sanitized_graph_lens_count_fixture"]);
    assertNoExecutionApproval(report);
  });

  test("classifies contract failure as stop-only rather than remediation", () => {
    const input = {
      ...baseInput(),
      validation_status: {
        graph_validation: "failed",
        quality_gate: "pass",
        workshop_preview: "passed",
      },
    } satisfies LiveProductPreviewLensDiagnosticInput;

    const report = classifyLiveProductPreviewLensDiagnostic(input);

    assert.equal(report.classification, "contract-failure");
    assert.equal(report.terminal_next_action, "stop_until_contract_failure_is_fixed");
    assert.deepEqual(report.allowed_no_spend_followups, ["repair_validation_contract_before_lens_remediation"]);
    assertNoExecutionApproval(report);
  });

  test("rejects unsafe or internally inconsistent diagnostic inputs", () => {
    assert.throws(
      () => classifyLiveProductPreviewLensDiagnostic({ ...baseInput(), preview_ref: "../private" }),
      /live product preview lens diagnostic input rejected/,
    );
    assert.throws(
      () =>
        classifyLiveProductPreviewLensDiagnostic({
          ...baseInput(),
          source_classification: "useful",
        }),
      /live product preview lens diagnostic input rejected/,
    );
    assert.throws(
      () =>
        classifyLiveProductPreviewLensDiagnostic({
          ...baseInput(),
          source_reason_codes: ["underproduced_graph_output"],
        }),
      /live product preview lens diagnostic input rejected/,
    );
    assert.throws(
      () =>
        classifyLiveProductPreviewLensDiagnostic({
          ...baseInput(),
          useful_lenses: ["signals", "maps"],
        }),
      /live product preview lens diagnostic input rejected/,
    );
    assert.throws(
      () =>
        classifyLiveProductPreviewLensDiagnostic({
          ...baseInput(),
          safety: { ...baseInput().safety, provider_spend: true },
        }),
      /live product preview lens diagnostic input rejected/,
    );
    assert.throws(
      () => classifyLiveProductPreviewLensDiagnostic({ ...baseInput(), unexpected_provider_payload: "private" }),
      /live product preview lens diagnostic input rejected/,
    );
  });

  test("rejects hostile accessors and non-enumerable array indices", () => {
    const hostile = baseInput() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "graph_supported_lens_item_counts", {
      enumerable: true,
      get() {
        throw new Error("private diagnostic getter detail must not leak");
      },
    });
    assert.throws(
      () => classifyLiveProductPreviewLensDiagnostic(hostile),
      /live product preview lens diagnostic input rejected/,
    );

    const nonEnumerable = baseInput();
    const candidates = ["fixtures/graph/valid/workshop-three-lane.json"];
    Object.defineProperty(candidates, "0", {
      value: "fixtures/graph/valid/workshop-three-lane.json",
      enumerable: false,
      configurable: true,
      writable: true,
    });
    assert.throws(
      () => classifyLiveProductPreviewLensDiagnostic({ ...nonEnumerable, fixture_validation_candidates: candidates }),
      /live product preview lens diagnostic input rejected/,
    );
  });

  test("does not read process.env while classifying", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      const report = classifyLiveProductPreviewLensDiagnostic(liveInput());
      assert.equal(report.status, "decision");
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
