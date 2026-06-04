import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOKS = join(REPO_ROOT, "docs", "runbooks");
const PLANS = join(REPO_ROOT, "docs", "plans");

const NO_CALL_STATUS = join(RUNBOOKS, "runtime-model-only-tiny-runtime-integration-no-call-smoke-status.md");
const PRODUCT_SLICE_STATUS = join(RUNBOOKS, "runtime-model-only-product-vertical-slice-deterministic-status.md");
const PRODUCT_SLICE_PLAN = join(PLANS, "2026-06-04-product-vertical-slice-after-runtime-no-call-smoke.md");
const LIVE_PROOF_APPROVAL = join(RUNBOOKS, "runtime-model-only-tiny-live-runtime-proof-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const forbidden of [
    /PRIVATE_EVIDENCE_DIR/i,
    /atliera-private-provider-evidence/i,
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider metadata/i,
    /wrapper log/i,
    /credential/i,
    /auth header/i,
    /account id/i,
    /source text/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not leak ${forbidden}`);
  }
}

function assertNoReadinessOrLockIn(label: string, text: string): void {
  for (const forbidden of [
    /production ready/i,
    /product ready/i,
    /launch ready/i,
    /default production model/i,
    /default model selected/i,
    /provider lock[- ]?in[: ]+true/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not broaden scope with ${forbidden}`);
  }
}

test("no-call runtime smoke status records the single approved execution without broadening authorization", () => {
  const doc = read(NO_CALL_STATUS);
  assert.match(doc, /Status: completed/i);
  assert.match(doc, /approval_id: runtime-model-only-tiny-runtime-integration-no-call-smoke-20260604i/i);
  assert.match(doc, /approval_consumed: true/i);
  assert.match(doc, /max_attempts: 1/i);
  assert.match(doc, /attempts_executed: 1/i);
  assert.match(doc, /provider_calls_executed: 0/i);
  assert.match(doc, /provider_spend: false/i);
  assert.match(doc, /observed_cost_usd: 0/i);
  assert.match(doc, /fake_or_throwing_provider_dependency_used: true/i);
  assert.match(doc, /route_catalog_validation_exercised: true/i);
  assert.match(doc, /explicit_route_selection_exercised: true/i);
  assert.match(doc, /runtime_composition_exercised: true/i);
  assert.match(doc, /execution_preflight_exercised: true/i);
  assert.match(doc, /sanitized_observability_exercised: true/i);
  assert.match(doc, /runtime_model_mode_execution: false/i);
  assert.match(doc, /default_model_selection_claim: false/i);
  assert.match(doc, /provider_lock_in: false/i);
  assert.match(doc, /retry_requires_new_approval: true/i);
  assertNoPrivateLeakage("no-call status", doc);
  assertNoReadinessOrLockIn("no-call status", doc);
});

test("product vertical slice plan and deterministic status pivot from validation to product shape without spend", () => {
  const plan = read(PRODUCT_SLICE_PLAN);
  const status = read(PRODUCT_SLICE_STATUS);
  assert.match(plan, /thin product-grade vertical slice/i);
  assert.match(plan, /input graph bundle/i);
  assert.match(plan, /Workshop-ready view/i);
  assert.match(plan, /Signals, Maps, Plays/i);
  assert.match(plan, /deterministic fake-mode first/i);
  assert.match(plan, /provider calls: 0/i);
  assert.match(status, /Status: completed/i);
  assert.match(status, /runtime Workshop preview/i);
  assert.match(status, /providerCallsMade: 0/i);
  assert.match(status, /productionWrites: false/i);
  assert.match(status, /htmlRendered: true/i);
  assert.match(status, /human_product_review_required: true/i);
  assertNoPrivateLeakage("product vertical slice plan", plan);
  assertNoPrivateLeakage("product vertical slice status", status);
  assertNoReadinessOrLockIn("product vertical slice plan", plan);
  assertNoReadinessOrLockIn("product vertical slice status", status);
});

test("tiny live runtime proof approval remains a separate bounded approval and not a standing authorization", () => {
  const approval = read(LIVE_PROOF_APPROVAL);
  assert.match(approval, /Status: pre-run docs-only approval packet/i);
  assert.match(approval, /This PR does not execute the live proof/i);
  assert.match(approval, /approved_future_attempts: 1/i);
  assert.match(approval, /max_provider_calls: 1/i);
  assert.match(approval, /one_call_only: true/i);
  assert.match(approval, /separate later execution status PR required: true/i);
  assert.match(approval, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(approval, /fake_or_throwing_no_call_smoke_prerequisite: completed/i);
  assert.match(approval, /deterministic_product_vertical_slice_prerequisite: completed/i);
  assert.match(approval, /no tools/i);
  assert.match(approval, /no web search/i);
  assert.match(approval, /no plugins/i);
  assert.match(approval, /no retrieval/i);
  assert.match(approval, /no production writes/i);
  assert.match(approval, /not a standing approval/i);
  assert.match(approval, /retry_requires_new_approval: true/i);
  assert.match(approval, /default_model_selection_claim: false/i);
  assert.match(approval, /provider_lock_in: false/i);
  assertNoPrivateLeakage("live proof approval", approval);
  assertNoReadinessOrLockIn("live proof approval", approval);
});
