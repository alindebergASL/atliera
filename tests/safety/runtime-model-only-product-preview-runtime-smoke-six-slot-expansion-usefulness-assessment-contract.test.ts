import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const ASSESSMENT = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment.md");
const STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(content, pattern);
}

test("six-slot runtime smoke usefulness assessment records no-spend useful result", () => {
  const doc = read(ASSESSMENT);
  assertAll(doc, [
    /Status: pass\./i,
    /Usefulness classification: useful\./i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status\.md`\./i,
    /assessment_ref: runtime-smoke-six-slot-expansion-usefulness-20260604g/i,
    /status_ref: runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
    /provider_calls_executed_source: 6/i,
    /provider_calls_executed_by_assessment: 0/i,
    /screened_account_slots: 6/i,
    /completed_slot_count: 6/i,
    /recommends_next_step: separate-reviewed-next-approval-required/i,
    /useful_lenses: signals, maps, plays/i,
    /reasons: none/i,
  ]);
});

test("six-slot runtime smoke usefulness assessment validates strict sanitized counts", () => {
  const doc = read(ASSESSMENT);
  assertAll(doc, [
    /exact_root_keys_required: true/i,
    /exact_slot_keys_required: true/i,
    /exact_count_keys_required: true/i,
    /exact_object_type_keys_required: true/i,
    /exact_support_coverage_keys_required: true/i,
    /required_slot_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control/i,
    /path_shaped_refs_rejected: true/i,
    /broadened_slot_arrays_rejected: true/i,
    /per_slot_object_type_counts_must_match_slot_output_counts: true/i,
    /per_slot_support_coverage_must_match_slot_output_counts: true/i,
    /aggregate_output_counts_compared_to_per_slot_counts: true/i,
    /aggregate_object_type_counts_compared_per_key_to_per_slot_counts: true/i,
    /aggregate_support_coverage_compared_per_key_to_per_slot_counts: true/i,
    /accessor_backed_fields_rejected: true/i,
    /symbol_fields_rejected: true/i,
    /array_accessor_fields_rejected: true/i,
    /array_extra_fields_rejected: true/i,
    /v2_excerpts: 30/i,
    /v2_claims: 19/i,
    /v2_account_objects: 29/i,
    /object_type_account_snapshot: 6/i,
    /object_type_signal: 5/i,
    /object_type_risk: 6/i,
    /object_type_play: 5/i,
    /object_type_map: 5/i,
    /object_type_open_question: 2/i,
    /lens_count_signals: 13/i,
    /lens_count_maps: 11/i,
    /lens_count_plays: 5/i,
    /claim_supported_count: 19/i,
    /account_object_supported_count: 29/i,
  ]);
});

test("six-slot runtime smoke usefulness assessment is non-authorizing", () => {
  const doc = read(ASSESSMENT);
  assertAll(doc, [
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /launch_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /provider_lock_in: false/i,
    /provider_call: false/i,
    /provider_spend: false/i,
    /raw_private_evidence_read: false/i,
    /network_access: false/i,
    /graph_ingestion: false/i,
    /production_writes: false/i,
    /runtime_model_mode_integration: false/i,
    /provider_comparison: false/i,
    /default_model_selection: false/i,
  ]);
});

test("six-slot runtime smoke usefulness assessment records evidence restrictions without private details", () => {
  const doc = read(ASSESSMENT);
  assertAll(doc, [
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_screened_account_text_committed: false/i,
    /model_output_committed: false/i,
    /provider_body_committed: false/i,
    /credential_material_committed: false/i,
    /private_evidence_committed: false/i,
    /private_paths_committed: false/i,
    /provider_metadata_committed: false/i,
    /account_identifiers_committed: false/i,
    /wrapper_logs_committed: false/i,
    /prompt_material_committed: false/i,
    /local_paths_committed: false/i,
    /This assessment can inform that decision, but it does not approve another provider call/i,
  ]);
  assert.doesNotMatch(doc, /\/home\//i);
  assert.doesNotMatch(doc, /acct-[A-Za-z0-9-]+/i);
  assert.doesNotMatch(doc, /SCREENED\s+ACCOUNT/i);
  assert.doesNotMatch(doc, /Bearer\s+[A-Za-z0-9._-]+/i);
});

test("six-slot status remains historical while linking later usefulness assessment", () => {
  const status = read(STATUS);
  assert.match(status, /Status: completed for the approved six-slot runtime\/model-mode product-preview expansion\./i);
  assert.match(status, /Follow-up interpretation: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment\.md` records a later deterministic no-spend usefulness assessment\./i);
  assert.match(status, /usefulness_evaluated: false/i);
  assert.match(status, /authorizes_provider_call: false/i);
});
