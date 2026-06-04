import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const OPTIONS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-post-six-slot-next-validation-options.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(doc: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(doc, pattern);
}

function assertNoPrivateLeakage(doc: string): void {
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

test("post-six-slot next validation options are no-spend and select bounded GPT-5.5 repeatability", () => {
  const doc = read(OPTIONS);
  assertAll(doc, [
    /Status: no-spend options analysis/i,
    /This document does not execute or approve a provider call/i,
    /Input status: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status\.md`/i,
    /Input assessment: `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment\.md`/i,
    /option_id: bounded_gpt55_repeatability_check/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /proposed_job_id: product-preview-runtime-smoke-six-slot-gpt55-repeatability-20260604h/i,
    /proposed_max_attempts: 1/i,
    /proposed_max_provider_calls: 6/i,
    /proposed_max_cost_usd: 6/i,
    /recommended_option: bounded_gpt55_repeatability_check/i,
    /requires_separate_approval_packet: true/i,
    /approval_packet_should_be_docs_only: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]);
  assertNoPrivateLeakage(doc);
});

test("GPT-5.5 repeatability approval authorizes only one future bounded attempt", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute a provider call/i,
    /No execution may occur in this approval PR/i,
    /job_id: product-preview-runtime-smoke-six-slot-gpt55-repeatability-20260604h/i,
    /approval_id: runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-20260604h/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/runtime-smoke-six-slot-screened-v1/i,
    /required_slot_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control/i,
    /screened_account_slots: 6/i,
    /max_attempts: 1/i,
    /max_provider_calls: 6/i,
    /approved_max_cost_usd: 6/i,
    /retry_authorized: false/i,
    /planner_required_before_execution: true/i,
    /planner_must_be_dry_run: true/i,
    /private_source_screening_required_before_each_call: true/i,
    /stop_instead_of_substitute_if_slot_fails_screening: true/i,
    /tools: false/i,
    /web_search: false/i,
    /online_model_variant: false/i,
    /plugins: false/i,
    /mcp: false/i,
    /shell: false/i,
    /file_access: false/i,
    /retrieval: false/i,
    /production_writes: false/i,
    /graph_ingestion: false/i,
    /provider_comparison: false/i,
    /authorizes_gpt55_repeatability_attempt: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_retry_after_this_attempt: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_tools_or_search: false/i,
    /provider_lock_in: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]);
  assertNoPrivateLeakage(doc);
  for (const forbidden of [
    /authorizes_retry_after_this_attempt: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /authorizes_tools_or_search: true/i,
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
