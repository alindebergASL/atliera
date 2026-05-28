import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { assessLiveProductPreviewUsefulness } from "../../src/validation/live-product-preview-usefulness.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const INPUT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-20260528a-usefulness-input.json");
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-usefulness-assessment.json",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("applies the live product preview usefulness gate to the first sanitized preview facts", () => {
  const input = readJson(INPUT_FIXTURE);
  const expected = readJson(ASSESSMENT_FIXTURE);

  const assessment = assessLiveProductPreviewUsefulness(input);

  assert.deepEqual(assessment, expected);
  assert.equal(assessment.preview_ref, "live-product-preview-20260528a");
  assert.equal(assessment.preview_usefulness_classification, "weak-but-valid");
  assert.equal(assessment.ok, false);
  assert.equal(assessment.status, "fail");
  assert.deepEqual(assessment.metrics.output_counts, { excerpts: 1, claims: 1, account_objects: 1 });
  assert.deepEqual(assessment.metrics.useful_lenses, ["signals"]);
  assert.deepEqual(
    assessment.reasons.map((reason) => reason.code),
    ["insufficient_useful_lenses"],
  );
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
