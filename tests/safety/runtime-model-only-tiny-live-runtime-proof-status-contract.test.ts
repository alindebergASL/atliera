import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(REPO_ROOT, "docs", "runbooks", "runtime-model-only-tiny-live-runtime-proof-status.md");
const APPROVAL = join(REPO_ROOT, "docs", "runbooks", "runtime-model-only-tiny-live-runtime-proof-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoLeakage(label: string, text: string): void {
  for (const forbidden of [
    /PRIVATE_EVIDENCE_DIR/i,
    /atliera-private-provider-evidence/i,
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider metadata/i,
    /wrapper log/i,
    /auth header/i,
    /account id/i,
    /source text/i,
    /ModuleNotFoundError/i,
    /traceback/i,
    /site-packages/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not leak ${forbidden}`);
  }
}

function assertNoBroadening(label: string, text: string): void {
  for (const forbidden of [
    /production ready/i,
    /product ready/i,
    /launch ready/i,
    /default production model/i,
    /default model selected/i,
    /provider_lock_in:\s*true/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /retry permitted/i,
    /automatic retry/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not broaden with ${forbidden}`);
  }
}

test("tiny live runtime proof status records a fail-closed blocked attempt before provider access", () => {
  const status = read(STATUS);
  assert.match(status, /Status: blocked/i);
  assert.match(status, /approval_id: runtime-model-only-tiny-live-runtime-proof-20260604j/i);
  assert.match(status, /approval_consumed: true/i);
  assert.match(status, /approved_future_attempts: 1/i);
  assert.match(status, /attempts_executed: 1/i);
  assert.match(status, /provider_calls_executed: 0/i);
  assert.match(status, /provider_spend: false/i);
  assert.match(status, /observed_cost_usd: 0/i);
  assert.match(status, /accepted_output_received: false/i);
  assert.match(status, /stable_error_code: local_transport_runtime_unavailable/i);
  assert.match(status, /blocked_before_provider_access: true/i);
  assert.match(status, /retry_requires_new_approval: true/i);
  assert.match(status, /authorizes_provider_call: false/i);
  assert.match(status, /default_model_selection_claim: false/i);
  assert.match(status, /provider_lock_in: false/i);
  assertNoLeakage("tiny live proof status", status);
  assertNoBroadening("tiny live proof status", status);
});

test("tiny live proof approval packet links the later blocked status while preserving pre-run semantics", () => {
  const approval = read(APPROVAL);
  assert.match(approval, /Status: pre-run docs-only approval packet/i);
  assert.match(approval, /This PR does not execute the live proof/i);
  assert.match(approval, /Later sanitized status: `runtime-model-only-tiny-live-runtime-proof-status\.md`/i);
  assertNoLeakage("tiny live proof approval", approval);
  assertNoBroadening("tiny live proof approval", approval);
});
