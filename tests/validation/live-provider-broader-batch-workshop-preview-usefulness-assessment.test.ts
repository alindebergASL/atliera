import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { assessBroaderBatchWorkshopPreviewUsefulness } from "../../src/validation/live-provider-broader-batch-workshop-preview-usefulness.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const INPUT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-provider-broader-batch-workshop-preview-20260605a-usefulness-input.json",
);
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-provider-broader-batch-workshop-preview-20260605a-usefulness-assessment.json",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("applies the usefulness gate to the live-provider broader-batch Workshop preview facts", () => {
  const input = readJson(INPUT_FIXTURE);
  const expected = readJson(ASSESSMENT_FIXTURE);

  const assessment = assessBroaderBatchWorkshopPreviewUsefulness(input);

  assert.deepEqual(assessment, expected);
  assert.equal(assessment.preview_ref, "live-provider-broader-batch-workshop-preview-20260605a");
  assert.equal(assessment.preview_usefulness_classification, "useful");
  assert.equal(assessment.ok, true);
  assert.equal(assessment.status, "pass");
  assert.deepEqual(assessment.reasons, []);
  assert.deepEqual(assessment.metrics.output_counts, { excerpts: 10, claims: 10, account_objects: 15 });

  // The honest source ledger counts must be preserved verbatim and must NOT be
  // overloaded with the per-slot count of 5.
  assert.deepEqual(assessment.metrics.provider_ledger, {
    provider_api_requests_attempted: 2,
    provider_calls_executed: 2,
    rejected_generations: 1,
    successful_validated_generations: 1,
  });
  assert.equal(assessment.metrics.provider_ledger.provider_api_requests_attempted, 2);
  assert.equal(assessment.metrics.provider_ledger.provider_calls_executed, 2);

  // The slot/account fan-out is a distinct metric and is 5.
  assert.equal(assessment.metrics.selected_slot_count, 5);
  assert.equal(assessment.metrics.slot_output_counts.length, 5);
  // selected_slot_count must not leak into the provider ledger.
  assert.notEqual(assessment.metrics.provider_ledger.provider_calls_executed, assessment.metrics.selected_slot_count);

  assert.equal(assessment.metrics.useful_lens_count, 3);
  assert.deepEqual(assessment.metrics.useful_lenses, ["signals", "maps", "plays"]);
  assert.equal(assessment.launch_readiness_claim, false);
  assert.equal(assessment.product_readiness_claim, false);
  assert.equal(assessment.production_readiness_claim, false);
  assert.equal(assessment.approves_expansion_or_comparison, false);
  assert.deepEqual(assessment.safety, {
    live_provider_call: false,
    provider_spend: false,
    production_writes: false,
    runtime_model_mode_integration: false,
    provider_or_model_comparison: false,
    corpus_expansion: false,
    product_preview_expansion: false,
    web_search_or_tools: false,
  });
});

test("rejects an assessment input that overloads the provider ledger with the slot count", () => {
  const input = readJson(INPUT_FIXTURE) as { provider_ledger: Record<string, number> };
  input.provider_ledger.provider_calls_executed = 5;
  input.provider_ledger.provider_api_requests_attempted = 5;

  // 5 executed calls cannot reconcile with 1 rejected + 1 validated generation.
  assert.throws(
    () => assessBroaderBatchWorkshopPreviewUsefulness(input),
    /rejected_generations plus successful_validated_generations must equal provider_calls_executed/,
  );
});
