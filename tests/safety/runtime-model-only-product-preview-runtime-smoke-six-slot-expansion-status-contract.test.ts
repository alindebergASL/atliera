import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(content, pattern);
}

test("runtime-smoke six-slot expansion status records completed bounded execution", () => {
  const status = read(STATUS);
  assertAll(status, [
    /Status: completed for the approved six-slot runtime\/model-mode product-preview expansion\./i,
    /Approval packet: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet\.md`\./i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status\.md`\./i,
    /Source assessment: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment\.md`\./i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /job_id: product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/runtime-smoke-six-slot-screened-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1-runtime-smoke-v2-type-remediation/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /remediation_helper_ref: src\/product-preview\/runtime-smoke-v2-remediation\.ts/i,
    /screened_account_slots: 6/i,
    /required_slot_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control/i,
    /completed_slot_count: 6/i,
    /private_source_screening_passed: true/i,
    /status: completed/i,
    /reason_code: model_only_product_preview_runtime_smoke_six_slot_expansion_completed/i,
    /stable_error_code: none/i,
    /provider_calls_executed: 6/i,
    /transport_calls_observed_by_runner: 6/i,
    /approved_max_provider_calls: 6/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /runtime_smoke_v2_type_remediation_applied: true/i,
    /runtime_smoke_v2_type_remediation_changes: 0/i,
    /status_renderer_used: true/i,
    /v2_excerpts: 30/i,
    /v2_claims: 19/i,
    /v2_account_objects: 29/i,
    /input_tokens_observed: 3174/i,
    /output_tokens_observed: 4471/i,
    /approved_max_cost_usd: 6/i,
    /observed_cost_usd: 0/i,
  ]);
});

test("runtime-smoke six-slot expansion status records each public-safe slot role", () => {
  const status = read(STATUS);
  assertAll(status, [
    /\|\ representative\-a\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 3\ \|\ 5\ \|\ 531\ \|\ 730\ \|/i,
    /\|\ representative\-b\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 3\ \|\ 5\ \|\ 534\ \|\ 744\ \|/i,
    /\|\ edge\-case\-a\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 3\ \|\ 5\ \|\ 527\ \|\ 765\ \|/i,
    /\|\ edge\-case\-b\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 4\ \|\ 6\ \|\ 530\ \|\ 858\ \|/i,
    /\|\ calibration\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 3\ \|\ 4\ \|\ 518\ \|\ 669\ \|/i,
    /\|\ sparse\-control\ \|\ completed\ \|\ 1\ \|\ true\ \|\ true\ \|\ 0\ \|\ 5\ \|\ 3\ \|\ 4\ \|\ 534\ \|\ 705\ \|/i,
    /object_type_account_snapshot: 6/i,
    /object_type_signal: 5/i,
    /object_type_risk: 6/i,
    /object_type_play: 5/i,
    /object_type_map: 5/i,
    /object_type_open_question: 2/i,
    /excerpt_text_presence_count: 30/i,
    /claim_text_presence_count: 19/i,
    /claim_supported_count: 19/i,
    /account_object_summary_presence_count: 29/i,
    /account_object_supported_count: 29/i,
    /# Sanitized Product-Preview Status: product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
  ]);
});

test("runtime-smoke six-slot expansion status preserves planner and runtime boundaries", () => {
  const status = read(STATUS);
  assertAll(status, [
    /planner_dry_run: true/i,
    /planner_provider_calls_executed: 0/i,
    /planner_provider_spend_authorized_by_plan: false/i,
    /planner_raw_private_evidence_read: false/i,
    /planner_network_access_performed: false/i,
    /planner_authorizes_provider_call: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /tools: false/i,
    /web_search: false/i,
    /online_model_variant: false/i,
    /plugins: false/i,
    /mcp: false/i,
    /shell: false/i,
    /file_access: false/i,
    /retrieval: false/i,
    /session_carryover: false/i,
    /background_orchestrator: false/i,
    /production_writes: false/i,
    /graph_ingestion_performed: false/i,
    /provider_comparison_performed: false/i,
  ]);
});

test("runtime-smoke six-slot expansion status records evidence restrictions without private details", () => {
  const status = read(STATUS);
  assertAll(status, [
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
    /usefulness_evaluated: false/i,
    /The next decision gate is a separate deterministic no-spend six-slot usefulness assessment over these sanitized facts\./i,
  ]);
  assert.doesNotMatch(status, /\/home\//i);
  assert.doesNotMatch(status, /acct-[A-Za-z0-9-]+/i);
  assert.doesNotMatch(status, /SCREENED\s+ACCOUNT/i);
  assert.doesNotMatch(status, /Bearer\s+[A-Za-z0-9._-]+/i);
});

test("runtime-smoke six-slot expansion approval remains pre-run historical and links later status", () => {
  const approval = read(APPROVAL);
  assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i);
  assert.match(approval, /Execution status: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status\.md` records the later sanitized completed status\./i);
  assert.match(approval, /future_execution_authorized_after_merge: true/i);
  assert.match(approval, /current_pr_executes_provider_call: false/i);
});
