import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-status.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-approval-packet.md");

const unsafePositiveClaimPatterns = [
  /credential material committed: true/i,
  /provider body committed: true/i,
  /screened account text committed: true/i,
  /model output committed: true/i,
  /local paths committed: true/i,
  /client handles committed: true/i,
  /display name/i,
];

test("runtime smoke status records one consumed exception without authorizing follow-up actions", () => {
  const doc = readFileSync(STATUS, "utf8");

  for (const required of [
    /Status: exception for one approved runtime\/model-mode smoke/i,
    /Approval packet: `runtime-model-only-product-preview-runtime-smoke-approval-packet\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /planner_dry_run: true/i,
    /planner_provider_calls_executed: 0/i,
    /planner_provider_spend_authorized_by_plan: false/i,
    /planner_raw_private_evidence_read: false/i,
    /planner_network_access_performed: false/i,
    /planner_authorizes_provider_call: false/i,
    /job_id: product-preview-runtime-smoke-20260604d/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /corpus_ref: product-preview\/runtime-smoke-single-slot-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /screened_account_slots: 1/i,
    /slot_role: calibration/i,
    /status: exception/i,
    /reason_code: model_only_product_preview_runtime_smoke_exception/i,
    /stable_error_code: v2_contract_account_object_type_invalid/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /approved_max_provider_calls: 1/i,
    /accepted_output_received: false/i,
    /v2_contract_validated: false/i,
    /status_renderer_used: true/i,
    /v2_excerpts: 0/i,
    /v2_claims: 0/i,
    /v2_account_objects: 0/i,
    /input_tokens_observed: 382/i,
    /output_tokens_observed: 452/i,
    /approved_max_cost_usd: 1/i,
    /observed_cost_usd: 0/i,
    /calibration \| exception \| 1 \| false \| false \| 0 \| 0 \| 0 \| 382 \| 452/i,
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
    /wrapper_logs_committed: false/i,
    /prompt_material_committed: false/i,
    /local_paths_committed: false/i,
    /usefulness_evaluated: false/i,
    /graph_ingestion_performed: false/i,
    /provider_comparison_performed: false/i,
    /production_writes: false/i,
    /requires a separate approval packet/i,
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
    ...unsafePositiveClaimPatterns,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("runtime smoke approval points to later sanitized status while preserving pre-run semantics", () => {
  const approval = readFileSync(APPROVAL, "utf8");
  assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i);
  assert.match(approval, /Execution status: `runtime-model-only-product-preview-runtime-smoke-status\.md` records the later sanitized exception status\./i);
  assert.match(approval, /authorizes_provider_call: true/i);
  assert.match(approval, /authorizes_retry: false/i);
  assert.match(approval, /authorizes_graph_ingestion: false/i);
  assert.match(approval, /launch_readiness_claim: false/i);
});
