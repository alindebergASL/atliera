import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOKS = join(ROOT, "docs", "runbooks");
const PLANS = join(ROOT, "docs", "plans");

const INTERPRETATION = join(RUNBOOKS, "runtime-model-only-lab-runtime-live-proof-interpretation.md");
const STATUS = join(RUNBOOKS, "runtime-model-only-lab-runtime-live-proof-status.md");
const PLAN = join(PLANS, "2026-06-06-provider-neutral-lab-runtime-route-planning.md");

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
    /output text:/i,
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
    /graph_ingestion_performed:\s*true/i,
    /production_writes:\s*true/i,
    /runtime_model_mode_integration:\s*true/i,
    /runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_future_runtime_model_mode_execution:\s*true/i,
    /authorizes_runtime_model_mode_integration:\s*true/i,
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
    /retry_requires_new_approval:\s*false/i,
    /provider_call_requires_new_approval:\s*false/i,
    /remaining_approved_future_attempts:\s*[1-9]/i,
    /approved_future_attempts:\s*[2-9]/i,
    /attempts_executed:\s*[2-9]/i,
    /provider_calls_executed:\s*[1-9]/i,
    /standing approval/i,
    /retry permitted/i,
    /automatic retry/i,
    /may retry without/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `${label} must not broaden with ${forbidden}`);
  }
}

test("lab runtime proof interpretation bounds what the single consumed proof establishes", () => {
  const doc = read(INTERPRETATION);

  // No-spend interpretation posture over the consumed proof.
  assertAll("interpretation", doc, [
    /Status: no-spend interpretation/i,
    /runtime-model-only-lab-runtime-live-proof-status\.md/i,
    /single (?:approved )?(?:lab runtime )?proof/i,
  ]);

  // What the proof DOES establish (bounded, harness/contract-level only).
  assertAll("interpretation", doc, [
    /## What the proof establishes/i,
    /schema-conforming|exact (?:public )?output contract/i,
    /one-call limit held/i,
    /zero (?:provider )?spend/i,
    /harness boundary held/i,
  ]);

  // What the proof DOES NOT establish.
  assertAll("interpretation", doc, [
    /## What the proof does not establish/i,
    /not (?:a )?provider quality conclusion/i,
    /not (?:a )?provider comparison/i,
    /not (?:a )?default model selection/i,
    /not provider lock-in/i,
    /not product, production, or launch readiness/i,
    /other routes|other providers|other operations|larger corpora/i,
  ]);

  // Zero remaining approvals; nothing further authorized.
  assertAll("interpretation", doc, [
    /remaining_approved_future_attempts: 0/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /provider_call_requires_new_approval: true/i,
    /provider_calls_executed_by_interpretation: 0/i,
    /provider_spend: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_future_runtime_model_mode_execution: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_corpus_expansion: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /provider_comparison_claim: false/i,
    /provider_quality_conclusion: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /provider_lock_in: false/i,
  ]);

  assertNoLeakage("interpretation", doc);
  assertNoBroadening("interpretation", doc);
});

test("provider-neutral lab runtime route plan decides foundation-first no-call route-chain hardening", () => {
  const doc = read(PLAN);

  assertAll("plan", doc, [
    /Status: no-spend planning contract/i,
    /runtime-model-only-lab-runtime-live-proof-interpretation\.md/i,
    // Replaceable-provider/model posture preserved.
    /Models get better, and route evidence gets stale/i,
    /not a permanent default/i,
    /same `ModelProvider` boundary/i,
    /validated route catalog/i,
    /explicit by route ref/i,
    // Explicit branch decision among the three candidate branches.
    /## Decision/i,
    /product hardening/i,
    /route-chain hardening/i,
    /docs-only approval packet/i,
    /Decision: .*route-chain hardening/i,
    /foundation-first/i,
    /before (?:another|any further) (?:approval|live run|provider call)/i,
    // Safety markers.
    /provider_calls_executed(?:_by_plan)?: 0/i,
    /runtime_model_mode_integration: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_production_use: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /provider_lock_in: false/i,
  ]);

  assertNoLeakage("plan", doc);
  assertNoBroadening("plan", doc);
});

test("interpretation stays consistent with the consumed status and adds no authorization", () => {
  const interpretation = read(INTERPRETATION);
  const status = read(STATUS);

  // Both agree the one approval is fully consumed with nothing remaining.
  for (const doc of [interpretation, status]) {
    assert.match(doc, /remaining_approved_future_attempts: 0/i);
    assert.match(doc, /retry_requires_new_approval: true/i);
    assert.match(doc, /authorizes_provider_call: false/i);
  }

  // The interpretation explicitly disclaims adding authorization.
  assert.match(
    interpretation,
    /does not add, restore, or broaden any authorization/i,
  );
});
