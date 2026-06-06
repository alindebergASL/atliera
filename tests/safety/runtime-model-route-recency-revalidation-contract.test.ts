import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOK = join(ROOT, "docs", "runbooks", "runtime-model-route-recency-revalidation-contract.md");
const PLAN = join(ROOT, "docs", "plans", "2026-06-06-runtime-route-recency-revalidation.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(label: string, doc: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(doc, pattern, `${label} must contain ${pattern}`);
}

function assertNoLeakage(label: string, doc: string): void {
  for (const forbidden of [
    /raw prompt/i,
    /raw request/i,
    /raw response/i,
    /raw output/i,
    /raw transcript/i,
    /provider payload/i,
    /model output text/i,
    /source text/i,
    /source excerpt text/i,
    /auth header/i,
    /authorization:\s*bearer/i,
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /account id/i,
    /acct-[A-Za-z0-9-]+/i,
    /request id\b/i,
    /request_identifier:\s*[a-z0-9]/i,
    /preview html/i,
    /screenshot/i,
    /private evidence path/i,
    /evidence dir/i,
    /\/home\//i,
    /traceback/i,
    /site-packages/i,
    /(?:^|\s)(?:\d{1,3}\.){3}\d{1,3}(?:\s|$)/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `${label} must not leak ${forbidden}`);
  }
}

function assertNoBroadening(label: string, doc: string): void {
  for (const forbidden of [
    /production ready/i,
    /product ready/i,
    /launch ready/i,
    /default production model/i,
    /default model selected/i,
    /provider_lock_in:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /runtime_model_mode_integration:\s*true/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_runtime_use:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_revalidation_run:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_corpus_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /authorizes_mcp:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /revalidation_requires_new_approval:\s*false/i,
    /stale_or_candidate_requires_fresh_approval:\s*false/i,
    /standing approval/i,
    /automatic revalidation/i,
    /may revalidate without/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `${label} must not broaden with ${forbidden}`);
  }
}

test("route recency runbook records no-spend revalidation contract and false authorization markers", () => {
  const doc = read(RUNBOOK);

  assertAll("runbook", doc, [
    /Status: no-spend route recency\/revalidation contract/i,
    /reviewRouteEvidenceRecency/i,
    /fresh/i,
    /nearing-expiry/i,
    /expired-needs-revalidation/i,
    /candidate-label-only-not-validated/i,
    /requires_fresh_approval_before_use/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_runtime_use: false/i,
    /authorizes_retry: false/i,
    /authorizes_revalidation_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /runtime_model_mode_integration: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /stale_or_candidate_requires_fresh_approval: true/i,
    /revalidation_requires_new_approval: true/i,
    /does not authorize/i,
    /fresh approval packet/i,
  ]);

  assertNoLeakage("runbook", doc);
  assertNoBroadening("runbook", doc);
});

test("route recency plan preserves replaceable-provider posture and chooses no-spend revalidation before live use", () => {
  const doc = read(PLAN);

  assertAll("plan", doc, [
    /Status: no-spend planning contract/i,
    /runtime-model-route-recency-revalidation-contract\.md/i,
    /Models get better, and route evidence gets stale/i,
    /not a permanent default/i,
    /same `ModelProvider` boundary/i,
    /validated route catalog/i,
    /explicit route ref/i,
    /GPT-5\.5/i,
    /owl-alpha/i,
    /Opus 4\.8|Opus/i,
    /GPT-5\.6/i,
    /direct Anthropic API/i,
    /direct OpenAI API/i,
    /Decision: .*no-spend route recency/i,
    /before any fresh live approval/i,
    /provider_calls_executed(?:_by_plan)?: 0/i,
    /authorizes_provider_call: false/i,
    /authorizes_revalidation_run: false/i,
    /authorizes_default_model_selection: false/i,
    /provider_lock_in: false/i,
  ]);

  assertNoLeakage("plan", doc);
  assertNoBroadening("plan", doc);
});
