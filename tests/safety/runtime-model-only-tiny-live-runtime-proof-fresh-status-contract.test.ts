import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-fresh-status.md",
);
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-fresh-approval-packet.md",
);

function assertNoLeakageOrBroadening(label: string, doc: string): void {
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
    /request id/i,
    /authorizes_provider_call:\s*true/i,
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
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("fresh tiny live runtime proof status records consumed exception without retry or broadening", () => {
  const approval = readFileSync(APPROVAL_DOC, "utf8");
  const doc = readFileSync(STATUS_DOC, "utf8");

  assert.match(approval, /approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k/i);
  assert.match(approval, /approved_future_attempts: 1/i);
  assert.match(approval, /max_provider_calls: 1/i);

  assert.match(doc, /Status: exception/i);
  assert.match(doc, /approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k/i);
  assert.match(doc, /approval_consumed: true/i);
  assert.match(doc, /attempts_executed: 1/i);
  assert.match(doc, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(doc, /provider_ref: openai-codex/i);
  assert.match(doc, /model_label: gpt-5\.5/i);
  assert.match(doc, /transport_kind: model-only-codex-auth/i);
  assert.match(doc, /^- provider_calls_executed: 1$/im);
  assert.match(doc, /transport_calls_observed_by_runner: 1/i);
  assert.match(doc, /^- provider_spend: false$/im);
  assert.match(doc, /^- observed_cost_usd: 0$/im);
  assert.match(doc, /input_tokens_observed: 0/i);
  assert.match(doc, /output_tokens_observed: 0/i);
  assert.match(doc, /accepted_output_received: false/i);
  assert.match(doc, /v2_contract_validated: false/i);
  assert.match(doc, /reason_code: tiny_live_runtime_proof_exception/i);
  assert.match(doc, /stable_error_code: provider_call_or_v2_contract_failed/i);
  assert.match(doc, /retry_requires_new_approval: true/i);
  assert.match(doc, /authorizes_provider_call: false/i);
  assert.match(doc, /authorizes_retry: false/i);
  assert.match(doc, /authorizes_runtime_model_mode_execution: false/i);
  assert.match(doc, /authorizes_provider_comparison: false/i);
  assert.match(doc, /authorizes_product_preview_expansion: false/i);
  assert.match(doc, /authorizes_default_model_selection: false/i);
  assert.match(doc, /authorizes_tools: false/i);
  assert.match(doc, /authorizes_web_search: false/i);
  assert.match(doc, /authorizes_plugins: false/i);
  assert.match(doc, /authorizes_retrieval: false/i);
  assert.match(doc, /default_model_selection_claim: false/i);
  assert.match(doc, /provider_lock_in: false/i);
  assert.match(doc, /product_readiness_claim: false/i);
  assert.match(doc, /production_readiness_claim: false/i);
  assert.match(doc, /launch_readiness_claim: false/i);
  assertNoLeakageOrBroadening("fresh tiny live status", doc);
});
