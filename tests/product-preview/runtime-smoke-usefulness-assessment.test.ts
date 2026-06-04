import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { assessRuntimeSmokeUsefulness } from "../../src/product-preview/runtime-smoke-usefulness-assessment.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const INPUT = join(REPO_ROOT, "fixtures", "validation", "runtime-smoke-corrected-retry-usefulness-input.json");
const ASSESSMENT = join(REPO_ROOT, "fixtures", "validation", "runtime-smoke-corrected-retry-usefulness-assessment.json");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("assesses the corrected runtime smoke as useful from sanitized no-spend facts", () => {
  const input = readJson(INPUT);
  const expected = readJson(ASSESSMENT);

  const assessment = assessRuntimeSmokeUsefulness(input);

  assert.deepEqual(assessment, expected);
  assert.equal(assessment.status, "pass");
  assert.equal(assessment.usefulness_classification, "useful");
  assert.equal(assessment.metrics.provider_calls_executed_source, 1);
  assert.equal(assessment.metrics.provider_calls_executed_by_assessment, 0);
  assert.deepEqual(assessment.metrics.output_counts, { excerpts: 4, claims: 3, account_objects: 4 });
  assert.deepEqual(assessment.metrics.object_type_counts, {
    account_snapshot: 1,
    signal: 1,
    stakeholder: 0,
    initiative: 0,
    risk: 1,
    open_question: 0,
    play: 1,
    recommendation: 0,
  });
  assert.deepEqual(assessment.lens_counts, { maps: 1, signals: 2, plays: 1 });
  assert.deepEqual(assessment.useful_lenses, ["signals", "maps", "plays"]);
  assert.equal(assessment.useful_lens_count, 3);
  assert.deepEqual(assessment.reasons, []);
  assert.equal(assessment.recommends_next_step, "separate-tiny-expansion-approval-packet");
  assert.equal(assessment.authorizes_provider_call, false);
  assert.equal(assessment.authorizes_retry, false);
  assert.equal(assessment.authorizes_product_preview_expansion, false);
  assert.equal(assessment.authorizes_provider_comparison, false);
  assert.equal(assessment.authorizes_default_model_selection, false);
  assert.equal(assessment.authorizes_graph_ingestion, false);
  assert.equal(assessment.authorizes_background_orchestrator_bypass, false);
  assert.equal(assessment.authorizes_production_use, false);
  assert.equal(assessment.launch_readiness_claim, false);
  assert.equal(assessment.product_readiness_claim, false);
  assert.equal(assessment.production_readiness_claim, false);
  assert.equal(assessment.provider_lock_in, false);
  assert.deepEqual(assessment.safety, {
    provider_call: false,
    provider_spend: false,
    network_access: false,
    graph_ingestion: false,
    production_writes: false,
    runtime_model_mode_integration: false,
    provider_or_model_comparison: false,
    default_model_selection: false,
    product_preview_expansion: false,
    readiness_claim: false,
    raw_or_model_output_committed: false,
    private_evidence_committed: false,
    prompt_material_committed: false,
    credentials_committed: false,
  });
});

test("classifies missing lens coverage as blocked rather than useful", () => {
  const input = clone(readJson(INPUT)) as any;
  input.object_type_counts.play = 0;
  input.object_type_counts.recommendation = 0;
  input.output_counts.account_objects = 3;
  input.support_coverage.account_object_summary_presence_count = 3;
  input.support_coverage.account_object_supported_count = 3;

  const assessment = assessRuntimeSmokeUsefulness(input);

  assert.equal(assessment.status, "fail");
  assert.equal(assessment.usefulness_classification, "blocked-by-missing-evidence-or-lens-coverage");
  assert.deepEqual(
    assessment.reasons.map((reason) => reason.code),
    ["missing_required_lens"],
  );
  assert.equal(assessment.authorizes_provider_call, false);
  assert.equal(assessment.recommends_next_step, "stop-live-expansion");
});

test("classifies underproduced but lens-complete output as weak-but-valid", () => {
  const input = clone(readJson(INPUT)) as any;
  input.output_counts.excerpts = 2;
  input.output_counts.claims = 2;
  input.output_counts.account_objects = 3;
  input.object_type_counts = { account_snapshot: 1, signal: 1, play: 1 };
  input.support_coverage = {
    excerpt_text_presence_count: 2,
    claim_text_presence_count: 2,
    claim_supported_count: 2,
    account_object_summary_presence_count: 3,
    account_object_supported_count: 3,
  };

  const assessment = assessRuntimeSmokeUsefulness(input);

  assert.equal(assessment.status, "fail");
  assert.equal(assessment.usefulness_classification, "weak-but-valid");
  assert.deepEqual(
    assessment.reasons.map((reason) => reason.code),
    ["insufficient_excerpt_count"],
  );
  assert.equal(assessment.recommends_next_step, "no-spend-remediation-first");
});

test("rejects forged projection totals before classifying", () => {
  const input = clone(readJson(INPUT)) as any;
  input.object_type_counts.account_snapshot = 9;

  assert.throws(
    () => assessRuntimeSmokeUsefulness(input),
    /object_type_counts total must equal account_objects output count/,
  );
});

test("rejects broadened assessment boundaries", () => {
  const input = clone(readJson(INPUT)) as any;
  input.assessment_boundaries.provider_call = true;

  assert.throws(
    () => assessRuntimeSmokeUsefulness(input),
    /assessment_boundaries\.provider_call must be false/,
  );
});

test("rejects accessor-backed inputs without invoking getters", () => {
  const input = clone(readJson(INPUT)) as Record<string, unknown>;
  let invoked = false;
  Object.defineProperty(input, "assessment_ref", {
    enumerable: true,
    get() {
      invoked = true;
      return "runtime-smoke-corrected-retry-usefulness-20260604e";
    },
  });

  assert.throws(
    () => assessRuntimeSmokeUsefulness(input),
    /assessment_ref must be an enumerable own data field/,
  );
  assert.equal(invoked, false);
});

test("rejects nested accessor-backed count projections without invoking getters", () => {
  const input = clone(readJson(INPUT)) as any;
  let invoked = false;
  Object.defineProperty(input.object_type_counts, "play", {
    enumerable: true,
    get() {
      invoked = true;
      return 1;
    },
  });

  assert.throws(
    () => assessRuntimeSmokeUsefulness(input),
    /object_type_counts\.play must be an enumerable own data field/,
  );
  assert.equal(invoked, false);
});

test("rejects nested accessor-backed safety boundaries without invoking getters", () => {
  const input = clone(readJson(INPUT)) as any;
  let invoked = false;
  Object.defineProperty(input.assessment_boundaries, "provider_call", {
    enumerable: true,
    get() {
      invoked = true;
      return false;
    },
  });

  assert.throws(
    () => assessRuntimeSmokeUsefulness(input),
    /assessment_boundaries\.provider_call must be an enumerable own data field/,
  );
  assert.equal(invoked, false);
});
