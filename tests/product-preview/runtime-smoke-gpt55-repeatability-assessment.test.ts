import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assessRuntimeSmokeGpt55Repeatability,
  type RuntimeSmokeGpt55RepeatabilityAssessmentInput,
  type RuntimeSmokeGpt55RepeatabilitySlotStatus,
} from "../../src/product-preview/runtime-smoke-gpt55-repeatability-assessment.js";

const FIXTURE = join(import.meta.dirname, "..", "..", "fixtures", "validation", "runtime-smoke-gpt55-repeatability-assessment-input.json");

function fixture(): RuntimeSmokeGpt55RepeatabilityAssessmentInput {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as RuntimeSmokeGpt55RepeatabilityAssessmentInput;
}

test("classifies the sanitized GPT-5.5 repeatability status as repeatable-useful without authorizing next actions", () => {
  const assessment = assessRuntimeSmokeGpt55Repeatability(fixture());

  assert.equal(assessment.status, "pass");
  assert.equal(assessment.repeatability_classification, "repeatable-useful");
  assert.equal(assessment.baseline_status_ref, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g");
  assert.equal(assessment.repeatability_status_ref, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-20260604h");
  assert.deepEqual(assessment.reasons, []);
  assert.deepEqual(assessment.deltas.output_counts, { excerpts: 0, claims: 0, account_objects: 4 });
  assert.equal(assessment.deltas.object_type_counts.signal, 1);
  assert.equal(assessment.deltas.object_type_counts.map, 1);
  assert.equal(assessment.deltas.object_type_counts.play, 0);
  assert.equal(assessment.metrics.repeated_role_count, 6);
  assert.equal(assessment.metrics.repeated_signal_count, 6);
  assert.equal(assessment.metrics.repeated_map_count, 6);
  assert.equal(assessment.metrics.repeated_play_count, 5);
  assert.equal(assessment.metrics.repeated_supported_claim_count, 19);
  assert.equal(assessment.metrics.repeated_supported_object_count, 33);
  assert.equal(assessment.metrics.repeatability_provider_calls_executed_by_assessment, 0);
  assert.equal(assessment.recommended_next_step, "provider-neutral-runtime-integration-planning");
  assert.equal(assessment.authorizes_provider_call, false);
  assert.equal(assessment.authorizes_retry, false);
  assert.equal(assessment.authorizes_product_preview_expansion, false);
  assert.equal(assessment.authorizes_provider_comparison, false);
  assert.equal(assessment.authorizes_default_model_selection, false);
  assert.equal(assessment.authorizes_runtime_model_mode_integration, false);
  assert.equal(assessment.authorizes_production_use, false);
  assert.equal(assessment.authorizes_graph_ingestion, false);
  assert.equal(assessment.launch_readiness_claim, false);
  assert.equal(assessment.product_readiness_claim, false);
  assert.equal(assessment.production_readiness_claim, false);
  assert.equal(assessment.provider_lock_in, false);
});

test("fails closed when repeatability underproduces an approved role or lens", () => {
  const input = fixture();
  const weakened = structuredClone(input) as unknown as Record<string, any>;
  weakened.repeatability.slot_statuses = weakened.repeatability.slot_statuses.map((slot: RuntimeSmokeGpt55RepeatabilitySlotStatus) =>
    slot.role === "sparse-control"
      ? {
          ...slot,
          output_counts: { excerpts: 5, claims: 3, account_objects: 0 },
          object_type_counts: {
            account_snapshot: 0,
            signal: 0,
            stakeholder: 0,
            initiative: 0,
            risk: 0,
            open_question: 0,
            play: 0,
            recommendation: 0,
            map: 0,
            relationship: 0,
            milestone: 0,
          },
          support_coverage: {
            excerpt_text_presence_count: 5,
            claim_text_presence_count: 3,
            claim_supported_count: 3,
            account_object_summary_presence_count: 0,
            account_object_supported_count: 0,
          },
        }
      : slot,
  );
  weakened.repeatability.output_counts = { excerpts: 30, claims: 19, account_objects: 28 };
  weakened.repeatability.object_type_counts = { ...weakened.repeatability.object_type_counts, account_snapshot: 5, signal: 5, risk: 5, open_question: 3, map: 5 };
  weakened.repeatability.support_coverage = { ...weakened.repeatability.support_coverage, account_object_summary_presence_count: 28, account_object_supported_count: 28 };

  const assessment = assessRuntimeSmokeGpt55Repeatability(weakened as unknown as RuntimeSmokeGpt55RepeatabilityAssessmentInput);

  assert.equal(assessment.status, "fail");
  assert.equal(assessment.repeatability_classification, "not-repeatable");
  assert.match(assessment.reasons.join("\n"), /repeatability produced fewer account objects than baseline/i);
  assert.equal(assessment.recommended_next_step, "no-spend-remediation-first");
  assert.equal(assessment.authorizes_provider_call, false);
});

test("rejects malformed, broadened, private-shaped, and accessor-backed sanitized facts", () => {
  const input = fixture();
  assert.throws(() => assessRuntimeSmokeGpt55Repeatability({ ...input, unexpected: true } as unknown as RuntimeSmokeGpt55RepeatabilityAssessmentInput), /exact keys/i);
  assert.throws(() => assessRuntimeSmokeGpt55Repeatability({ ...input, assessment_ref: "../private/path" }), /safe ref/i);
  assert.throws(() => assessRuntimeSmokeGpt55Repeatability({ ...input, repeatability: { ...input.repeatability, safety: { ...input.repeatability.safety, authorizes_provider_call: true } } } as unknown as RuntimeSmokeGpt55RepeatabilityAssessmentInput), /must be false/i);

  const hostile = fixture() as unknown as Record<string, unknown>;
  Object.defineProperty(hostile, "assessment_ref", {
    enumerable: true,
    get() {
      throw new Error("leak getter should not surface");
    },
  });
  assert.throws(() => assessRuntimeSmokeGpt55Repeatability(hostile as unknown as RuntimeSmokeGpt55RepeatabilityAssessmentInput), /enumerable data properties/i);
});
