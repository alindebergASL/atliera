import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-corrected-retry-status.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-corrected-retry-approval-packet.md");

const unsafePositiveClaimPatterns = [
  /credential material committed: true/i,
  /provider body committed: true/i,
  /screened account text committed: true/i,
  /model output committed: true/i,
  /local paths committed: true/i,
  /client handles committed: true/i,
  /display name/i,
];

const forbidden = [
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
];

test("corrected retry status records one completed call without authorizing follow-up actions", () => {
  const doc = readFileSync(STATUS, "utf8");

  for (const required of [
    /Status: completed for one approved corrected runtime\/model-mode smoke retry/i,
    /Approval packet: `runtime-model-only-product-preview-runtime-smoke-corrected-retry-approval-packet\.md`/i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-status\.md`/i,
    /Source remediation: `runtime-model-only-product-preview-runtime-smoke-remediation\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /planner_dry_run: true/i,
    /planner_provider_calls_executed: 0/i,
    /planner_provider_spend_authorized_by_plan: false/i,
    /planner_raw_private_evidence_read: false/i,
    /planner_network_access_performed: false/i,
    /planner_authorizes_provider_call: false/i,
    /job_id: product-preview-runtime-smoke-corrected-retry-20260604e/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /corpus_ref: product-preview\/runtime-smoke-single-slot-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1-runtime-smoke-v2-type-remediation/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /remediation_helper_ref: src\/product-preview\/runtime-smoke-v2-remediation\.ts/i,
    /screened_account_slots: 1/i,
    /slot_role: calibration/i,
    /status: completed/i,
    /reason_code: model_only_product_preview_runtime_smoke_corrected_retry_completed/i,
    /stable_error_code: none/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /approved_max_provider_calls: 1/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /runtime_smoke_v2_type_remediation_applied: true/i,
    /runtime_smoke_v2_type_remediation_changes: 0/i,
    /status_renderer_used: true/i,
    /v2_excerpts: 4/i,
    /v2_claims: 3/i,
    /v2_account_objects: 4/i,
    /input_tokens_observed: 477/i,
    /output_tokens_observed: 570/i,
    /approved_max_cost_usd: 1/i,
    /observed_cost_usd: 0/i,
    /calibration \| completed \| 1 \| true \| true \| 4 \| 3 \| 4 \| 477 \| 570/i,
    /# Sanitized Product-Preview Status: runtime-model-only-product-preview-runtime-smoke-corrected-retry-20260604e/i,
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

  for (const pattern of forbidden) assert.doesNotMatch(doc, pattern);
});

test("corrected retry approval points to later sanitized status while preserving pre-run semantics", () => {
  const approval = readFileSync(APPROVAL, "utf8");
  assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i);
  assert.match(approval, /Execution status: `runtime-model-only-product-preview-runtime-smoke-corrected-retry-status\.md` records the later sanitized completed status\./i);
  assert.match(approval, /authorizes_provider_call: true/i);
  assert.match(approval, /authorizes_retry: false/i);
  assert.match(approval, /authorizes_graph_ingestion: false/i);
  assert.match(approval, /launch_readiness_claim: false/i);
});
