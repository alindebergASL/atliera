import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOKS = join(ROOT, "docs", "runbooks");
const PLANS = join(ROOT, "docs", "plans");

const ASSESSMENT = join(RUNBOOKS, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md");
const DECISION = join(RUNBOOKS, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md");
const PLAN = join(PLANS, "2026-06-04-provider-neutral-runtime-route-planning-after-gpt55-repeatability.md");
const APPROVAL = join(RUNBOOKS, "runtime-model-only-tiny-runtime-integration-no-call-smoke-approval-packet.md");
const STATUS = join(RUNBOOKS, "runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(doc: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(doc, pattern);
}

function assertNoPrivateLeakage(label: string, doc: string): void {
  for (const forbidden of [
    /\/home\//i,
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /source_text\s*[:=]/i,
    /acct-[A-Za-z0-9-]+/i,
    /SCREENED\s+ACCOUNT/i,
    /(?:^|\s)(?:\d{1,3}\.){3}\d{1,3}(?:\s|$)/i,
  ]) assert.doesNotMatch(doc, forbidden, `${label} leaked ${forbidden}`);
}

function assertNoCurrentAuthorizationOrReadiness(label: string, doc: string): void {
  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_runtime_model_mode_integration: true/i,
    /authorizes_runtime_model_mode_execution: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_lock_in: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /default production model/i,
    /product ready/i,
    /production ready/i,
    /launch ready/i,
  ]) assert.doesNotMatch(doc, forbidden, `${label} broadened scope with ${forbidden}`);
}

test("repeatability assessment records deterministic no-spend pass without granting execution", () => {
  const doc = read(ASSESSMENT);
  assertAll(doc, [
    /Status: pass\./i,
    /Repeatability classification: repeatable-useful\./i,
    /deterministic no-spend assessment/i,
    /runtime-smoke-gpt55-repeatability-usefulness-20260604h/i,
    /baseline_status_ref: runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
    /repeatability_status_ref: runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-20260604h/i,
    /repeatability_provider_calls_executed_by_assessment: 0/i,
    /repeated_role_count: 6/i,
    /delta_v2_account_objects: 4/i,
    /delta_object_type_signal: 1/i,
    /delta_object_type_map: 1/i,
    /delta_object_type_play: 0/i,
    /reasons: none/i,
    /recommended_next_step: provider-neutral-runtime-integration-planning/i,
    /authorizes_provider_call: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /provider_lock_in: false/i,
  ]);
  assertNoPrivateLeakage("repeatability assessment", doc);
  assertNoCurrentAuthorizationOrReadiness("repeatability assessment", doc);
});

test("repeatability decision chooses no-spend route planning and blocks live expansion", () => {
  const doc = read(DECISION);
  assertAll(doc, [
    /Status: no-spend decision record/i,
    /Proceed with provider-neutral runtime route planning and no-call integration tests/i,
    /Do not proceed to another provider call/i,
    /GPT-5\.5 as a validated candidate route/i,
    /Preserve `owl-alpha` as a validation route/i,
    /provider_calls_executed_by_decision: 0/i,
    /runtime_model_mode_integration: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_default_model_selection: false/i,
    /product_readiness_claim: false/i,
  ]);
  assertNoPrivateLeakage("repeatability decision", doc);
  assertNoCurrentAuthorizationOrReadiness("repeatability decision", doc);
});

test("provider-neutral runtime route plan preserves replaceable route strategy", () => {
  const doc = read(PLAN);
  assertAll(doc, [
    /Status: no-spend planning contract/i,
    /Models get better, and route evidence gets stale/i,
    /GPT-5\.5 is a currently validated candidate/i,
    /not a permanent default/i,
    /`owl-alpha` remains a validation route/i,
    /Opus 4\.8/i,
    /GPT-5\.6/i,
    /direct Anthropic API/i,
    /direct OpenAI API/i,
    /same `ModelProvider` boundary/i,
    /validated route catalog/i,
    /explicit by route ref/i,
    /runtime composition binding/i,
    /provider_calls_executed: 0/i,
    /authorizes_provider_call: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
  ]);
  assertNoPrivateLeakage("runtime route plan", doc);
  assertNoCurrentAuthorizationOrReadiness("runtime route plan", doc);
});

test("tiny runtime integration approval is no-call only", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /Status: pre-run docs-only approval packet/i,
    /does not execute any provider call/i,
    /future tiny no-call runtime integration smoke only/i,
    /max_provider_calls: 0/i,
    /cost_preflight_guard_usd: 0\.01/i,
    /expected_provider_spend_usd: 0/i,
    /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
    /provider_calls_must_remain_zero: true/i,
    /provider_spend_must_remain_zero: true/i,
    /fake_or_throwing_provider_dependency_required: true/i,
    /planner_provider_calls_executed: 0/i,
    /planner_authorizes_provider_call: false/i,
    /no_provider_sdk_imports_required: true/i,
    /no_env_credential_reads_required: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_runtime_model_mode_execution: false/i,
    /product_readiness_claim: false/i,
  ]);
  assertNoPrivateLeakage("tiny no-call approval", doc);
  assertNoCurrentAuthorizationOrReadiness("tiny no-call approval", doc);
});

test("repeatability status links the later no-spend assessment as historical interpretation", () => {
  const doc = read(STATUS);
  assert.match(doc, /runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment\.md/i);
  assert.match(doc, /The `usefulness_evaluated: false` marker below remains a historical marker/i);
  assert.match(doc, /authorizes_provider_call: false/i);
  assertNoPrivateLeakage("repeatability status", doc);
  assertNoCurrentAuthorizationOrReadiness("repeatability status", doc);
});
