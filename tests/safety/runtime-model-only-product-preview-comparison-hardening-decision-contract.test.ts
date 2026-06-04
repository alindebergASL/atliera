import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const COMPARISON = join(ROOT, "runtime-model-only-product-preview-sanitized-provider-comparison.md");
const HARDENING = join(ROOT, "runtime-model-only-product-preview-runtime-hardening.md");
const DECISION = join(ROOT, "runtime-model-only-product-preview-post-comparison-decision.md");

const privateLeakagePatterns = [
  /api[_-]?key/i,
  /bearer /i,
  /authorization header/i,
  /private-provider-evidence/i,
  /raw_provider_output/i,
  /raw_harness_transport_request/i,
  /screened account text committed: true/i,
];

test("sanitized provider comparison is no-spend and non-authorizing", () => {
  const doc = readFileSync(COMPARISON, "utf8");
  for (const required of [
    /Status: no-spend comparison/i,
    /This document does not execute or approve a provider call/i,
    /status_ref: live-product-preview-six-slot-20260601a/i,
    /provider_ref: openrouter/i,
    /model_label: owl-alpha/i,
    /status_ref: product-preview-tiny-expansion-20260604c/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /comparison_ref: runtime-model-only-gpt55-tiny-vs-owl-alpha-six-slot-20260604c/i,
    /status: pass/i,
    /classification: candidate-contract-valid-lower-scope/i,
    /recommended_next_lane: runtime-model-mode-smoke-approval/i,
    /provider_calls_delta: -3/i,
    /excerpts_delta: -6/i,
    /claims_delta: -8/i,
    /account_objects_delta: -13/i,
    /input_tokens_delta: -4883/i,
    /output_tokens_delta: -3703/i,
    /provider_call_during_comparison: false/i,
    /provider_spend_during_comparison: false/i,
    /raw_private_evidence_read: false/i,
    /network_access: false/i,
    /graph_ingestion: false/i,
    /production_writes: false/i,
    /runtime_model_mode_integration_performed: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_default_model_selection: false/i,
    /provider_lock_in: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) assert.match(doc, required);
  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_default_model_selection: true/i,
    /provider_lock_in: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /default production model/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("runtime hardening records schema/renderer and dry-run planner boundaries", () => {
  const doc = readFileSync(HARDENING, "utf8");
  for (const required of [
    /Status: no-spend runtime integration hardening/i,
    /src\/product-preview\/sanitized-runtime-status\.ts/i,
    /src\/cli\/product-preview-plan\.ts/i,
    /descriptor-snapshot\/no-reread rejection/i,
    /dry_run: true/i,
    /provider_calls_executed: 0/i,
    /provider_spend_authorized_by_plan: false/i,
    /raw_private_evidence_read: false/i,
    /network_access_performed: false/i,
    /authorizes_provider_call: false/i,
    /graph_ingestion/i,
    /background_orchestrator/i,
    /This hardening does not:/i,
    /call a provider/i,
    /authorize a provider call/i,
    /select a default model/i,
  ]) assert.match(doc, required);
  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend_authorized_by_plan: true/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("decision packet selects runtime smoke lane but does not authorize execution", () => {
  const doc = readFileSync(DECISION, "utf8");
  for (const required of [
    /Status: docs-only decision packet/i,
    /This document does not execute or approve a provider call/i,
    /selected_next_lane: runtime-model-mode-smoke-approval/i,
    /selected_scope: one_call_single_slot_runtime_model_mode_smoke/i,
    /max_attempts: 1/i,
    /max_provider_calls: 1/i,
    /approved_max_cost_usd: 1/i,
    /slot_role: calibration/i,
    /planner_required_before_execution: true/i,
    /status_renderer_required_after_execution: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_live_expansion: false/i,
    /authorizes_provider_comparison_execution: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) assert.match(doc, required);
  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_live_expansion: true/i,
    /authorizes_provider_comparison_execution: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_graph_ingestion: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});
