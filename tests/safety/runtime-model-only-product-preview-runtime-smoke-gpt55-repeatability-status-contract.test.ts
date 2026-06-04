import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(doc: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(doc, pattern);
}

function assertNoLeakage(doc: string): void {
  for (const forbidden of [
    /\/home\//i,
    /Bearer\s+[A-Za-z0-9._-]+/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /source_text\s*[:=]/i,
    /acct-[A-Za-z0-9-]+/i,
    /SCREENED\s+ACCOUNT/i,
  ]) assert.doesNotMatch(doc, forbidden);
}

test("GPT-5.5 repeatability status records the consumed bounded execution", () => {
  const doc = read(STATUS);
  assertAll(doc, [
    /Status: completed for the approved GPT-5\.5 six-slot runtime\/model-mode repeatability attempt\./i,
    /Approval packet: `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-approval-packet\.md`/i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status\.md`/i,
    /Source assessment: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /job_id: product-preview-runtime-smoke-six-slot-gpt55-repeatability-20260604h/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/runtime-smoke-six-slot-screened-v1/i,
    /completed_slot_count: 6/i,
    /status: completed/i,
    /provider_calls_executed: 6/i,
    /transport_calls_observed_by_runner: 6/i,
    /approved_max_provider_calls: 6/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /runtime_smoke_v2_type_remediation_changes: 0/i,
    /v2_excerpts: 30/i,
    /v2_claims: 19/i,
    /v2_account_objects: 33/i,
    /input_tokens_observed: 3174/i,
    /output_tokens_observed: 4672/i,
    /approved_max_cost_usd: 6/i,
    /observed_cost_usd: 0/i,
  ]);
  assertNoLeakage(doc);
});

test("GPT-5.5 repeatability status records per-slot and support counts", () => {
  const doc = read(STATUS);
  assertAll(doc, [
    /representative-a \| completed \| 1 \| true \| true \| 0 \| 5 \| 3 \| 5 \| 531 \| 720/i,
    /representative-b \| completed \| 1 \| true \| true \| 0 \| 5 \| 4 \| 6 \| 534 \| 854/i,
    /edge-case-a \| completed \| 1 \| true \| true \| 0 \| 5 \| 3 \| 6 \| 527 \| 785/i,
    /edge-case-b \| completed \| 1 \| true \| true \| 0 \| 5 \| 3 \| 6 \| 530 \| 829/i,
    /calibration \| completed \| 1 \| true \| true \| 0 \| 5 \| 3 \| 5 \| 518 \| 717/i,
    /sparse-control \| completed \| 1 \| true \| true \| 0 \| 5 \| 3 \| 5 \| 534 \| 767/i,
    /object_type_account_snapshot: 6/i,
    /object_type_signal: 6/i,
    /object_type_risk: 6/i,
    /object_type_play: 5/i,
    /object_type_map: 6/i,
    /object_type_open_question: 4/i,
    /excerpt_text_presence_count: 30/i,
    /claim_text_presence_count: 19/i,
    /claim_supported_count: 19/i,
    /account_object_summary_presence_count: 33/i,
    /account_object_supported_count: 33/i,
  ]);
});

test("GPT-5.5 repeatability status preserves no-retry and no-readiness boundaries", () => {
  const doc = read(STATUS);
  assertAll(doc, [
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
    /launch-readiness, product-readiness, production-readiness, broad model-quality, sparse-account-readiness, provider-lock-in, default-model-selection/i,
  ]);
  for (const forbidden of [
    /authorizes_retry: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /tools: true/i,
    /web_search: true/i,
    /plugins: true/i,
    /shell: true/i,
    /file_access: true/i,
    /retrieval: true/i,
    /product ready/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ]) assert.doesNotMatch(doc, forbidden);
});

test("historical approval packet links later status without pretending it executed in approval PR", () => {
  const approval = read(APPROVAL);
  assert.match(approval, /Status: historical pre-run docs-only approval packet/i);
  assert.match(approval, /did not execute a provider call/i);
  assert.match(approval, /runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status\.md/i);
  assert.match(approval, /historically_authorized_gpt55_repeatability_attempt: true/i);
  assert.match(approval, /historically_authorized_provider_call: true/i);
  assert.match(approval, /authorization_consumed_by_status: true/i);
  assert.match(approval, /current_authorizes_provider_call: false/i);
  assert.match(approval, /current_authorizes_retry: false/i);
  assert.doesNotMatch(approval, /authorizes_gpt55_repeatability_attempt: true/i);
  assert.doesNotMatch(approval, /authorizes_provider_call: true/i);
  assert.match(approval, /authorizes_retry_after_this_attempt: false/i);
  assert.match(approval, /authorizes_provider_comparison: false/i);
  assert.match(approval, /product_readiness_claim: false/i);
  assertNoLeakage(approval);
});
