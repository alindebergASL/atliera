import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOK = join(REPO_ROOT, "docs", "runbooks", "runtime-model-only-tiny-live-runtime-proof-transport-remediation-status.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoLeakageOrBroadening(label: string, text: string): void {
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
    /traceback/i,
    /site-packages/i,
    /ModuleNotFoundError/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not contain ${forbidden}`);
  }
}

test("tiny live runtime proof transport remediation status records no-spend local runtime fix without authorization", () => {
  const doc = read(RUNBOOK);
  assert.match(doc, /Status: remediated/i);
  assert.match(doc, /previous_status: runtime-model-only-tiny-live-runtime-proof-status\.md/i);
  assert.match(doc, /root_cause: local_python_interpreter_missing_pinned_model_transport_dependency/i);
  assert.match(doc, /remediation: use_pinned_hermes_uv_project_interpreter/i);
  assert.match(doc, /^- provider_calls_executed: 0$/im);
  assert.match(doc, /^- provider_spend: false$/im);
  assert.match(doc, /^- observed_cost_usd: 0$/im);
  assert.match(doc, /dependency_preflight_result: pass/i);
  assert.match(doc, /dependency_preflight_provider_calls_executed: 0/i);
  assert.match(doc, /dependency_preflight_provider_spend: false/i);
  assert.match(doc, /network_provider_access_performed: false/i);
  assert.match(doc, /credential_value_observed: false/i);
  assert.match(doc, /accepted_output_received: false/i);
  assert.match(doc, /fresh_approval_required_before_retry: true/i);
  assert.match(doc, /authorizes_provider_call: false/i);
  assert.match(doc, /authorizes_retry: false/i);
  assert.match(doc, /authorizes_runtime_model_mode_execution: false/i);
  assert.match(doc, /authorizes_provider_comparison: false/i);
  assert.match(doc, /authorizes_product_preview_expansion: false/i);
  assert.match(doc, /authorizes_default_model_selection: false/i);
  assert.match(doc, /default_model_selection_claim: false/i);
  assert.match(doc, /provider_lock_in: false/i);
  assertNoLeakageOrBroadening("transport remediation status", doc);
});
