import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-fresh-approval-packet.md",
);
const REMEDIATION_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-transport-remediation-status.md",
);

function assertNoForbiddenApprovalBroadening(label: string, text: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /provider metadata/i,
    /wrapper log/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /source material/i,
    /account reference/i,
    /local evidence location/i,
    /private[-_ ]provider[-_ ]evidence/i,
    /authorizes_retry:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /standing approval/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("fresh tiny live runtime proof approval is one-call only after remediation and requires later status", () => {
  const remediation = readFileSync(REMEDIATION_DOC, "utf8");
  const approval = readFileSync(APPROVAL_DOC, "utf8");

  assert.match(remediation, /Status: remediated/i);
  assert.match(remediation, /dependency_preflight_result: pass/i);
  assert.match(remediation, /fresh_approval_required_before_retry: true/i);

  assert.match(approval, /Status: historical pre-run docs-only fresh approval packet/i);
  assert.match(approval, /The original approval-packet PR did not execute the live proof/i);
  assert.match(approval, /Later sanitized status: `runtime-model-only-tiny-live-runtime-proof-fresh-status\.md`/i);
  assert.match(approval, /approved attempt was later consumed exactly once/i);
  assert.match(approval, /Current effective authorization after that later status: none/i);
  assert.match(approval, /must not be reused for another provider call/i);
  assert.match(approval, /Before it was consumed, it permitted only one future tiny runtime\/model-mode proof attempt/i);
  assert.match(approval, /remediation_status_ref: `runtime-model-only-tiny-live-runtime-proof-transport-remediation-status\.md`/i);
  assert.match(approval, /previous_status_ref: `runtime-model-only-tiny-live-runtime-proof-status\.md`/i);
  assert.match(approval, /Historical approved attempt scope/i);
  assert.match(approval, /approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k/i);
  assert.match(approval, /approved_future_attempts: 1/i);
  assert.match(approval, /one_call_only: true/i);
  assert.match(approval, /max_provider_calls: 1/i);
  assert.match(approval, /max_cost_usd: 1/i);
  assert.match(approval, /separate later execution status PR required: true/i);
  assert.match(approval, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(approval, /provider_ref: openai-codex/i);
  assert.match(approval, /model_label: gpt-5\.5/i);
  assert.match(approval, /pre_run_transport_interpreter: pinned-hermes-uv-project/i);
  assert.match(approval, /stop_on_exception: true/i);
  assert.match(approval, /retry_requires_new_approval: true/i);

  assert.match(approval, /no tools/i);
  assert.match(approval, /no web search/i);
  assert.match(approval, /no plugins/i);
  assert.match(approval, /no retrieval/i);
  assert.match(approval, /no shell/i);
  assert.match(approval, /no file access/i);
  assert.match(approval, /no production writes/i);

  assert.match(approval, /historical_provider_call_authorized: true/i);
  assert.match(approval, /historical_runtime_model_mode_execution_authorized: true/i);
  assert.match(approval, /historical_approved_future_attempts: 1/i);
  assert.match(approval, /approval_consumed: true/i);
  assert.match(approval, /remaining_approved_future_attempts: 0/i);
  assert.match(approval, /remaining_provider_calls_authorized: 0/i);
  assert.match(approval, /authorizes_provider_call: false/i);
  assert.match(approval, /authorizes_runtime_model_mode_execution: false/i);
  assert.match(approval, /authorizes_retry: false/i);
  assert.match(approval, /authorizes_provider_comparison: false/i);
  assert.match(approval, /authorizes_product_preview_expansion: false/i);
  assert.match(approval, /authorizes_default_model_selection: false/i);
  assert.match(approval, /default_model_selection_claim: false/i);
  assert.match(approval, /provider_lock_in: false/i);
  assert.match(approval, /product_readiness_claim: false/i);
  assert.match(approval, /production_readiness_claim: false/i);
  assert.match(approval, /launch_readiness_claim: false/i);
  assert.match(approval, /raw_private_evidence_committed: false/i);

  assertNoForbiddenApprovalBroadening("fresh approval", approval);
});
