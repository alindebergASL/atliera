import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const STATUS = join(ROOT, "runtime-model-only-product-preview-tiny-expansion-status.md");
const ASSESSMENT = join(ROOT, "runtime-model-only-product-preview-tiny-expansion-usefulness-assessment.md");
const NEXT = join(ROOT, "runtime-model-only-product-preview-post-tiny-expansion-next-steps.md");

const privateLeakagePatterns = [
  /api[_-]?key/i,
  /authorization header/i,
  /bearer /i,
  /private-provider-evidence/i,
  /raw_provider_output_text/i,
  /raw_harness_transport_request/i,
  /raw_provider_metadata/i,
  /Northstar/i,
  /Meridian/i,
  /Atlas Field/i,
];

test("tiny-expansion status records sanitized completion without authorizing follow-up actions", () => {
  const doc = readFileSync(STATUS, "utf8");

  for (const required of [
    /Status: completed for one approved tiny model-only product-preview expansion/i,
    /Approval packet: `runtime-model-only-product-preview-tiny-expansion-approval-packet\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /job_id: product-preview-tiny-expansion-20260604c/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /transport_kind: model-only-codex-auth/i,
    /corpus_ref: product-preview\/tiny-screened-three-slot-v1/i,
    /screened_account_slots: 3/i,
    /completed_slot_count: 3/i,
    /required_slot_roles_completed: representative, edge-case, calibration/i,
    /status: completed/i,
    /reason_code: model_only_product_preview_tiny_expansion_completed/i,
    /stable_error_code: none/i,
    /provider_calls_executed: 3/i,
    /transport_calls_observed_by_runner: 3/i,
    /approved_max_provider_calls: 3/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /v2_excerpts: 12/i,
    /v2_claims: 10/i,
    /v2_account_objects: 5/i,
    /input_tokens_observed: 1075/i,
    /output_tokens_observed: 1614/i,
    /approved_max_cost_usd: 3/i,
    /observed_cost_usd: 0/i,
    /representative \| completed \| 1 \| 4 \| 3 \| 1 \| 358 \| 555/i,
    /edge-case \| completed \| 1 \| 4 \| 4 \| 3 \| 360 \| 581/i,
    /calibration \| completed \| 1 \| 4 \| 3 \| 1 \| 357 \| 478/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_screened_account_text_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /usefulness_evaluated: false/i,
    /graph_ingestion_performed: false/i,
    /provider_comparison_performed: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /product ready/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("tiny-expansion usefulness assessment is no-spend and non-authorizing", () => {
  const doc = readFileSync(ASSESSMENT, "utf8");

  for (const required of [
    /Status: no-spend usefulness assessment/i,
    /This document does not execute or approve a provider call/i,
    /job_id: product-preview-tiny-expansion-20260604c/i,
    /provider_calls_executed: 3/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /screened_account_slots: 3/i,
    /completed_slot_count: 3/i,
    /classification: useful_tiny_expansion_contract_signal/i,
    /status: pass/i,
    /provider_calls_executed_during_assessment: 0/i,
    /provider_spend_during_assessment: false/i,
    /network_access_during_assessment: false/i,
    /raw_or_model_output_read: false/i,
    /private_evidence_read: false/i,
    /recommends_no_spend_provider_comparison: true/i,
    /recommends_runtime_integration_hardening: true/i,
    /recommends_no_immediate_live_expansion: true/i,
    /approves_provider_call: false/i,
    /approves_retry: false/i,
    /approves_broader_expansion: false/i,
    /approves_provider_comparison_execution: false/i,
    /approves_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /approves_provider_call: true/i,
    /approves_retry: true/i,
    /approves_broader_expansion: true/i,
    /approves_provider_comparison_execution: true/i,
    /approves_graph_ingestion: true/i,
    /default_model_selection_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("post tiny-expansion next steps prefer no-spend comparison and hardening", () => {
  const doc = readFileSync(NEXT, "utf8");

  for (const required of [
    /Status: no-spend next-step packet/i,
    /This document does not execute or approve a provider call/i,
    /Run a no-spend provider comparison over sanitized facts/i,
    /Harden runtime integration boundaries with no provider calls/i,
    /step_id: no_spend_sanitized_provider_comparison/i,
    /provider_calls_authorized: 0/i,
    /provider_spend_authorized: false/i,
    /comparison_execution_authorized: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /step_id: runtime_integration_hardening_no_spend/i,
    /graph_ingestion_authorized: false/i,
    /background_orchestrator_authorized: false/i,
    /production_writes_authorized: false/i,
    /no_immediate_live_provider_call: true/i,
    /no_broader_expansion_before_comparison_and_hardening: true/i,
    /no_graph_ingestion_before_runtime_boundary_review: true/i,
    /no_background_orchestrator_before_runtime_boundary_review: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_broader_expansion: false/i,
    /authorizes_provider_comparison_execution: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_broader_expansion: true/i,
    /authorizes_provider_comparison_execution: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_calls_authorized: [1-9]/i,
    /provider_spend_authorized: true/i,
    ...privateLeakagePatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});
