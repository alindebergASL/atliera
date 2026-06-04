import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DOC = join(REPO_ROOT, "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-usefulness-assessment.md");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-corrected-retry-status.md");
const INPUT = join(REPO_ROOT, "fixtures", "validation", "runtime-smoke-corrected-retry-usefulness-input.json");
const ASSESSMENT = join(REPO_ROOT, "fixtures", "validation", "runtime-smoke-corrected-retry-usefulness-assessment.json");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoPositiveBroadening(label: string, text: string): void {
  for (const pattern of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_graph_ingestion: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /launch_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /provider_lock_in: true/i,
    /(?:approves|authorizes|allows|enables)\s+(?:another\s+)?(?:provider call|retry|provider comparison|model comparison|default model|graph ingestion|production use|production write|product-preview expansion|background orchestrator)/i,
    /(?:product|production|launch) readiness (?:is )?(?:proven|established|approved|claimed)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("runtime smoke usefulness assessment records a useful no-spend interpretation without broadening scope", () => {
  const doc = read(DOC);

  for (const required of [
    /Runtime Model-Only Product-Preview Runtime Smoke Usefulness Assessment/i,
    /Status: applied deterministic no-spend assessment/i,
    /runtime-model-only-product-preview-runtime-smoke-corrected-retry-status\.md/i,
    /src\/product-preview\/runtime-smoke-usefulness-assessment\.ts/i,
    /runtime-smoke-corrected-retry-usefulness-input\.json/i,
    /runtime-smoke-corrected-retry-usefulness-assessment\.json/i,
    /assessment_ref: runtime-smoke-corrected-retry-usefulness-20260604e/i,
    /source_provider_calls_executed: 1/i,
    /assessment_provider_calls_executed: 0/i,
    /status: pass/i,
    /usefulness_classification: useful/i,
    /useful_lens_count: 3/i,
    /useful_lenses: `signals`, `maps`, `plays`/i,
    /lens_counts: maps 1, signals 2, plays 1/i,
    /output counts: excerpts 4, claims 3, account_objects 4/i,
    /object_type_counts: account_snapshot 1, signal 1, risk 1, play 1/i,
    /claim support 3\/3/i,
    /account-object support 4\/4/i,
    /reasons: none/i,
    /recommends_next_step: separate-tiny-expansion-approval-packet/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /launch_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /provider_lock_in: false/i,
    /provider_call_by_assessment: false/i,
    /provider_spend_by_assessment: false/i,
    /network_access_by_assessment: false/i,
    /raw_or_model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /separate docs-only tiny expansion approval packet/i,
    /does not approve that expansion/i,
    /does not request another provider call/i,
  ]) assert.match(doc, required);

  assertNoPrivateLeakage("assessment doc", doc);
  assertNoPositiveBroadening("assessment doc", doc);
});

test("runtime smoke usefulness fixtures are sanitized and non-authorizing", () => {
  const input = read(INPUT);
  const assessment = read(ASSESSMENT);

  for (const [label, text] of [["input fixture", input], ["assessment fixture", assessment]] as const) {
    assertNoPrivateLeakage(label, text);
    assertNoPositiveBroadening(label, text);
    const parsed = JSON.parse(text) as unknown;
    const serialized = JSON.stringify(parsed);
    assert.doesNotMatch(serialized, /"(?:text|summary|claim|account_ref|request|response|provider_metadata|credential|prompt)"\s*:/i);
  }

  assert.match(input, /"object_type_counts"/i);
  assert.match(input, /"account_snapshot": 1/i);
  assert.match(input, /"risk": 1/i);
  assert.match(input, /"play": 1/i);
  assert.match(assessment, /"usefulness_classification": "useful"/i);
  assert.match(assessment, /"provider_calls_executed_by_assessment": 0/i);
  assert.match(assessment, /"authorizes_product_preview_expansion": false/i);
  assert.match(assessment, /"authorizes_provider_call": false/i);
});

test("corrected retry status links the later usefulness assessment while preserving historical execution markers", () => {
  const status = read(STATUS_DOC);

  assert.match(status, /runtime-model-only-product-preview-runtime-smoke-usefulness-assessment\.md/i);
  assert.match(status, /deterministic no-spend usefulness assessment/i);
  assert.match(status, /usefulness_evaluated: false/i);
  assert.match(status, /historical marker for this execution-status record/i);
  assertNoPrivateLeakage("status doc", status);
  assertNoPositiveBroadening("status doc", status);
});
