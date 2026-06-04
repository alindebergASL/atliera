import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { assessRuntimeSmokeTinyExpansionUsefulness } from "../../src/product-preview/runtime-smoke-tiny-expansion-usefulness-assessment.ts";

const falseBoundaries = Object.freeze({
  provider_call: false,
  provider_spend: false,
  raw_private_evidence_read: false,
  network_access: false,
  graph_ingestion: false,
  production_writes: false,
  runtime_model_mode_integration: false,
  provider_comparison: false,
  default_model_selection: false,
  product_readiness_claim: false,
  launch_readiness_claim: false,
  provider_lock_in: false,
});

function validInput() {
  const slot = (role: "representative" | "edge-case" | "calibration") => ({
    role,
    status: "completed",
    provider_calls_executed: 1,
    accepted_output_received: true,
    v2_contract_validated: true,
    output_counts: { excerpts: 4, claims: 3, account_objects: 4 },
    object_type_counts: {
      account_snapshot: 1,
      signal: 1,
      stakeholder: 0,
      initiative: 0,
      risk: 1,
      open_question: 0,
      play: 1,
      recommendation: 0,
      map: 0,
      relationship: 0,
      milestone: 0,
    },
    support_coverage: {
      excerpt_text_presence_count: 4,
      claim_text_presence_count: 3,
      claim_supported_count: 3,
      account_object_summary_presence_count: 4,
      account_object_supported_count: 4,
    },
  });
  return {
    assessment_ref: "runtime-smoke-tiny-expansion-usefulness-20260604f",
    status_ref: "runtime-model-only-product-preview-runtime-smoke-tiny-expansion-20260604f",
    source_status: "completed",
    provider_calls_executed: 3,
    screened_account_slots: 3,
    completed_slot_count: 3,
    accepted_output_received: true,
    v2_contract_validated: true,
    required_slot_roles: ["representative", "edge-case", "calibration"],
    output_counts: { excerpts: 12, claims: 9, account_objects: 12 },
    object_type_counts: {
      account_snapshot: 3,
      signal: 3,
      stakeholder: 0,
      initiative: 0,
      risk: 3,
      open_question: 0,
      play: 3,
      recommendation: 0,
      map: 0,
      relationship: 0,
      milestone: 0,
    },
    support_coverage: {
      excerpt_text_presence_count: 12,
      claim_text_presence_count: 9,
      claim_supported_count: 9,
      account_object_summary_presence_count: 12,
      account_object_supported_count: 12,
    },
    slot_statuses: [slot("representative"), slot("edge-case"), slot("calibration")],
    assessment_boundaries: falseBoundaries,
  };
}

test("classifies completed three-slot runtime smoke tiny expansion as useful without authorizing next actions", () => {
  const result = assessRuntimeSmokeTinyExpansionUsefulness(validInput());
  assert.equal(result.status, "pass");
  assert.equal(result.usefulness_classification, "useful");
  assert.deepEqual(result.useful_lenses, ["signals", "maps", "plays"]);
  assert.equal(result.metrics.provider_calls_executed_by_assessment, 0);
  assert.equal(result.metrics.provider_calls_executed_source, 3);
  assert.equal(result.metrics.completed_slot_count, 3);
  assert.equal(result.metrics.output_counts.account_objects, 12);
  assert.equal(result.metrics.lens_counts.maps, 3);
  assert.equal(result.metrics.lens_counts.signals, 6);
  assert.equal(result.metrics.lens_counts.plays, 3);
  assert.equal(result.authorizes_provider_call, false);
  assert.equal(result.authorizes_product_preview_expansion, false);
  assert.equal(result.authorizes_provider_comparison, false);
  assert.equal(result.authorizes_default_model_selection, false);
  assert.equal(result.authorizes_graph_ingestion, false);
  assert.equal(result.product_readiness_claim, false);
});

test("fails closed when a required slot is missing or underproduced", () => {
  const missing = validInput();
  missing.required_slot_roles = ["representative", "calibration"];
  assert.throws(() => assessRuntimeSmokeTinyExpansionUsefulness(missing), /required slot roles/);

  const weak = validInput();
  const weakSlot = weak.slot_statuses[1]!;
  weakSlot.output_counts.account_objects = 0;
  weakSlot.object_type_counts.account_snapshot = 0;
  weakSlot.object_type_counts.signal = 0;
  weakSlot.object_type_counts.risk = 0;
  weakSlot.object_type_counts.play = 0;
  weakSlot.support_coverage.account_object_summary_presence_count = 0;
  weakSlot.support_coverage.account_object_supported_count = 0;
  weak.output_counts.account_objects = 8;
  weak.object_type_counts.account_snapshot = 2;
  weak.object_type_counts.signal = 2;
  weak.object_type_counts.risk = 2;
  weak.object_type_counts.play = 2;
  weak.support_coverage.account_object_summary_presence_count = 8;
  weak.support_coverage.account_object_supported_count = 8;
  const assessed = assessRuntimeSmokeTinyExpansionUsefulness(weak);
  assert.equal(assessed.status, "fail");
  assert.equal(assessed.usefulness_classification, "weak-but-valid");
  assert.match(assessed.reasons.map((reason) => reason.code).join(","), /slot_underproduced/);
});

test("rejects malformed/private-shaped or contradictory sanitized inputs before assessment", () => {
  const extra = validInput() as Record<string, unknown>;
  extra.private_path = "/tmp/private";
  assert.throws(() => assessRuntimeSmokeTinyExpansionUsefulness(extra), /exact keys/);

  const broadened = validInput();
  const unsafeBoundaries = { ...(falseBoundaries as unknown as Record<string, boolean>), provider_call: true } as any;
  (broadened as any).assessment_boundaries = unsafeBoundaries;
  assert.throws(() => assessRuntimeSmokeTinyExpansionUsefulness(broadened), /must be false/);

  const inconsistent = validInput();
  inconsistent.provider_calls_executed = 4;
  assert.throws(() => assessRuntimeSmokeTinyExpansionUsefulness(inconsistent), /provider_calls_executed/);

  const objectTypeMismatch = validInput();
  objectTypeMismatch.object_type_counts.account_snapshot = 2;
  objectTypeMismatch.object_type_counts.map = 1;
  const mismatchAssessment = assessRuntimeSmokeTinyExpansionUsefulness(objectTypeMismatch);
  assert.equal(mismatchAssessment.status, "fail");
  assert.equal(mismatchAssessment.usefulness_classification, "contract-failure");
  assert.match(mismatchAssessment.reasons.map((reason) => reason.code).join(","), /aggregate_count_mismatch/);
});

test("rejects accessor-backed fields without invoking getters", () => {
  const input = validInput();
  Object.defineProperty(input, "source_status", {
    enumerable: true,
    get() {
      throw new Error("leak getter invoked");
    },
  });
  assert.throws(() => assessRuntimeSmokeTinyExpansionUsefulness(input), /enumerable data/);
});


test("checked runtime-smoke tiny expansion usefulness fixtures stay in sync", () => {
  const fixtureRoot = join(import.meta.dirname, "..", "..", "fixtures", "validation");
  const input = JSON.parse(readFileSync(join(fixtureRoot, "runtime-smoke-tiny-expansion-usefulness-input.json"), "utf8"));
  const expected = JSON.parse(readFileSync(join(fixtureRoot, "runtime-smoke-tiny-expansion-usefulness-assessment.json"), "utf8"));
  assert.deepEqual(assessRuntimeSmokeTinyExpansionUsefulness(input), expected);
  assert.equal(expected.status, "pass");
  assert.equal(expected.usefulness_classification, "useful");
  assert.equal(expected.metrics.provider_calls_executed_by_assessment, 0);
  assert.equal(expected.authorizes_provider_call, false);
});
