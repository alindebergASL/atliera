import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const ASSESSMENT = join(ROOT, "runtime-model-only-product-preview-retry-usefulness-assessment.md");
const OPTIONS = join(ROOT, "runtime-model-only-product-preview-next-validation-options.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-tiny-expansion-approval-packet.md");

test("retry usefulness assessment is sanitized no-spend and non-authorizing", () => {
  const doc = readFileSync(ASSESSMENT, "utf8");

  for (const required of [
    /Status: no-spend usefulness assessment/i,
    /This document does not execute or approve a provider call/i,
    /Source status: `runtime-model-only-product-preview-retry-status\.md`/i,
    /job_id: product-preview-retry-20260604b/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /v2_excerpts: 4/i,
    /v2_claims: 3/i,
    /v2_account_objects: 1/i,
    /account_ref_count: 1/i,
    /classification: useful_transport_contract_signal/i,
    /status: pass/i,
    /provider_calls_executed_during_assessment: 0/i,
    /provider_spend_during_assessment: false/i,
    /network_access_during_assessment: false/i,
    /raw_or_model_output_read: false/i,
    /private_evidence_read: false/i,
    /approves_provider_call: false/i,
    /approves_retry: false/i,
    /approves_expansion_or_comparison: false/i,
    /approves_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /approves_provider_call: true/i,
    /approves_retry: true/i,
    /approves_expansion_or_comparison: true/i,
    /approves_graph_ingestion: true/i,
    /default_model_selection_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /HarborOps/i,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("next validation options cover 3A, 3B, and 3C without authorizing execution", () => {
  const doc = readFileSync(OPTIONS, "utf8");

  for (const required of [
    /Status: no-spend options packet/i,
    /This document does not execute or approve a provider call/i,
    /lane_id: 3A_product_preview_expansion/i,
    /proposed_next_live_slice: tiny_multi_slot_product_preview/i,
    /proposed_screened_account_slots: 3/i,
    /proposed_max_provider_calls: 3/i,
    /proposed_max_cost_usd: 3/i,
    /lane_id: 3B_no_spend_provider_comparison/i,
    /provider_calls_authorized: 0/i,
    /comparison_mode: deterministic_sanitized_facts_only/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /lane_id: 3C_runtime_integration_hardening/i,
    /graph_ingestion_authorized: false/i,
    /background_orchestrator_authorized: false/i,
    /production_writes_authorized: false/i,
    /recommended_next_lane: 3A_product_preview_expansion/i,
    /requires_separate_approval_packet: true/i,
    /approval_packet_should_be_docs_only: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_calls_authorized: [1-9]/i,
    /provider_spend_authorized: true/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
    /private-provider-evidence/i,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("tiny expansion approval authorizes only one bounded future 3A slice", () => {
  const doc = readFileSync(APPROVAL, "utf8");

  for (const required of [
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute a provider call/i,
    /No execution may occur in this approval PR/i,
    /retry_usefulness_assessment_classification: useful_transport_contract_signal/i,
    /recommended_next_lane: 3A_product_preview_expansion/i,
    /max_attempts: 1/i,
    /max_provider_calls: 3/i,
    /approved_max_cost_usd: 3/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/tiny-screened-three-slot-v1/i,
    /screened_account_slots: 3/i,
    /required_slot_roles: representative, edge-case, calibration/i,
    /tools: false/i,
    /web_search: false/i,
    /plugins: false/i,
    /mcp: false/i,
    /shell: false/i,
    /file_access: false/i,
    /retrieval: false/i,
    /production_writes: false/i,
    /graph_ingestion: false/i,
    /private_source_screening_required_before_each_call: true/i,
    /stop_instead_of_substitute_if_slot_fails_screening: true/i,
    /no_paid_fallback: true/i,
    /no_retry_beyond_approved_call_count: true/i,
    /authorizes_tiny_product_preview_expansion: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_retry_after_this_attempt: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /status_followup_required: true/i,
    /raw_or_model_output_must_remain_private: true/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_retry_after_this_attempt: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /tools: true/i,
    /web_search: true/i,
    /plugins: true/i,
    /mcp: true/i,
    /shell: true/i,
    /file_access: true/i,
    /retrieval: true/i,
    /production_writes: true/i,
    /graph_ingestion: true/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /product ready/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ]) assert.doesNotMatch(doc, forbidden);
});
