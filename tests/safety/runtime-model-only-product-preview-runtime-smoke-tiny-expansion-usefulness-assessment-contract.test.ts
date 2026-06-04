import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..", "..");
const DOC = join(ROOT, "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment.md");
const STATUS = join(ROOT, "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status.md");
const INPUT = join(ROOT, "fixtures", "validation", "runtime-smoke-tiny-expansion-usefulness-input.json");
const ASSESSMENT = join(ROOT, "fixtures", "validation", "runtime-smoke-tiny-expansion-usefulness-assessment.json");

function read(path: string): string {
  return readFileSync(path, "utf8");
}
function assertAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(content, pattern);
}

test("runtime-smoke tiny expansion usefulness assessment records no-spend useful classification", () => {
  const doc = read(DOC);
  assertAll(doc, [
    /Status: no-spend usefulness assessment over the sanitized runtime-smoke tiny-expansion status\./i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status\.md`\./i,
    /Input fixture: `fixtures\/validation\/runtime-smoke-tiny-expansion-usefulness-input\.json`\./i,
    /Assessment fixture: `fixtures\/validation\/runtime-smoke-tiny-expansion-usefulness-assessment\.json`\./i,
    /assessment_ref: runtime-smoke-tiny-expansion-usefulness-20260604f/i,
    /status: pass/i,
    /usefulness_classification: useful/i,
    /useful_lenses: signals, maps, plays/i,
    /useful_lens_count: 3/i,
    /recommends_next_step: separate-reviewed-next-approval-required/i,
    /provider_calls_executed_source: 3/i,
    /provider_calls_executed_by_assessment: 0/i,
    /screened_account_slots: 3/i,
    /completed_slot_count: 3/i,
    /required_slot_roles: representative, edge-case, calibration/i,
  ]);
});

test("runtime-smoke tiny expansion usefulness assessment records public metrics and coverage", () => {
  const doc = read(DOC);
  assertAll(doc, [
    /output_excerpts: 12/i,
    /output_claims: 9/i,
    /output_account_objects: 12/i,
    /object_type_account_snapshot: 3/i,
    /object_type_signal: 3/i,
    /object_type_risk: 3/i,
    /object_type_play: 3/i,
    /lens_count_maps: 3/i,
    /lens_count_signals: 6/i,
    /lens_count_plays: 3/i,
    /excerpt_text_presence_count: 12/i,
    /claim_text_presence_count: 9/i,
    /claim_supported_count: 9/i,
    /account_object_summary_presence_count: 12/i,
    /account_object_supported_count: 12/i,
  ]);
});

test("runtime-smoke tiny expansion usefulness assessment remains non-authorizing", () => {
  const doc = read(DOC);
  assertAll(doc, [
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
    /safety_provider_call: false/i,
    /safety_provider_spend: false/i,
    /safety_raw_private_evidence_read: false/i,
    /safety_network_access: false/i,
    /safety_graph_ingestion: false/i,
    /safety_production_writes: false/i,
    /safety_runtime_model_mode_integration: false/i,
    /safety_provider_comparison: false/i,
    /safety_default_model_selection: false/i,
    /This is a no-spend interpretation gate, not a new approval\./i,
  ]);
});

test("runtime-smoke tiny expansion usefulness fixtures are sanitized", () => {
  for (const content of [read(INPUT), read(ASSESSMENT), read(DOC)]) {
    assert.doesNotMatch(content, /\/home\//i);
    assert.doesNotMatch(content, /acct-[A-Za-z0-9-]+/i);
    assert.doesNotMatch(content, /SCREENED ACCOUNT:/i);
  }
});

test("source status links later assessment while preserving historical false marker", () => {
  const status = read(STATUS);
  assert.match(status, /Follow-up interpretation: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment\.md` records a later deterministic no-spend usefulness assessment\./i);
  assert.match(status, /usefulness_evaluated: false/i);
});
