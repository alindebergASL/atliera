import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(
  REPO_ROOT,
  "docs",
  "runbooks",
  "runtime-model-only-lab-runtime-live-proof-status.md",
);
const APPROVAL = join(
  REPO_ROOT,
  "docs",
  "runbooks",
  "runtime-model-only-lab-runtime-live-proof-approval-packet.md",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoLeakage(label: string, text: string): void {
  for (const forbidden of [
    /raw prompt/i,
    /raw request/i,
    /raw response/i,
    /raw output/i,
    /provider payload/i,
    /model output text/i,
    /auth header/i,
    /authorization:\s*bearer/i,
    /account id/i,
    /source text/i,
    /source excerpt text/i,
    /request id/i,
    /request_identifier:\s*[a-z0-9]/i,
    /preview html/i,
    /screenshot/i,
    /private evidence/i,
    /evidence dir/i,
    /\/home\//i,
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
    /provider_quality_conclusion:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /raw_prompt_committed:\s*true/i,
    /raw_request_committed:\s*true/i,
    /raw_response_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_future_runtime_model_mode_execution:\s*true/i,
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
    /remaining_approved_future_attempts:\s*[1-9]/i,
    /approved_future_attempts:\s*[2-9]/i,
    /attempts_executed:\s*[2-9]/i,
    /provider_calls_executed:\s*[2-9]/i,
    /standing approval/i,
    /retry permitted/i,
    /automatic retry/i,
    /may retry without/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not broaden with ${forbidden}`);
  }
}

test("lab runtime model proof status records the one approved attempt as consumed and completed", () => {
  const status = read(STATUS);

  // Completed posture, bounded historical signal only.
  assert.match(status, /Status: completed/i);
  assert.match(status, /bounded historical lab runtime\/model-mode contract signal only/i);

  // Approval consumption: one attempt, now fully consumed.
  assert.match(status, /approval_id: lab-runtime-model-proof-live-attempt-20260605f/i);
  assert.match(status, /approval_consumed: true/i);
  assert.match(status, /approved_future_attempts: 1/i);
  assert.match(status, /remaining_approved_future_attempts: 0/i);
  assert.match(status, /attempts_executed: 1/i);
  assert.match(status, /retry_requires_new_approval: true/i);

  // Sanitized outcome facts.
  assert.match(status, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(status, /provider_ref: openai-codex/i);
  assert.match(status, /model_label: gpt-5\.5/i);
  assert.match(status, /environment: lab/i);
  assert.match(status, /operation: graph\.propose/i);
  assert.match(status, /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i);
  assert.match(status, /reason_code: lab_runtime_model_proof_completed/i);
  assert.match(status, /stable_error_code: none/i);
  assert.match(status, /preflight_ok: true/i);
  assert.match(status, /provider_calls_executed: 1/i);
  assert.match(status, /transport_calls_observed_by_runner: 1/i);
  assert.match(status, /provider_spend: false/i);
  assert.match(status, /observed_cost_usd: 0/i);
  assert.match(status, /input_tokens_observed: 523/i);
  assert.match(status, /output_tokens_observed: 1307/i);
  assert.match(status, /total_tokens_observed: 1830/i);
  assert.match(status, /accepted_output_received: true/i);
  assert.match(status, /exact_output_contract_validated: true/i);
  assert.match(status, /output_counts: excerpts 9, claims 9, account_objects 9/i);

  // Boundary markers held closed.
  assert.match(status, /graph_ingestion_performed: false/i);
  assert.match(status, /production_writes: false/i);
  assert.match(status, /provider_payload_committed: false/i);
  assert.match(status, /model_output_committed: false/i);
  assert.match(status, /private_evidence_committed: false/i);
  assert.match(status, /credential_material_committed: false/i);
  assert.match(status, /request_identifier_committed: false/i);

  // Claims explicitly not made.
  assert.match(status, /default_model_selection_claim: false/i);
  assert.match(status, /provider_comparison_claim: false/i);
  assert.match(status, /provider_quality_conclusion: false/i);
  assert.match(status, /product_readiness_claim: false/i);
  assert.match(status, /production_readiness_claim: false/i);
  assert.match(status, /launch_readiness_claim: false/i);
  assert.match(status, /provider_lock_in: false/i);

  // Future-action authorization markers all false.
  assert.match(status, /authorizes_provider_call: false/i);
  assert.match(status, /authorizes_retry: false/i);
  assert.match(status, /authorizes_future_runtime_model_mode_execution: false/i);
  assert.match(status, /authorizes_provider_comparison: false/i);
  assert.match(status, /authorizes_product_preview_expansion: false/i);
  assert.match(status, /authorizes_corpus_expansion: false/i);
  assert.match(status, /authorizes_default_model_selection: false/i);
  assert.match(status, /authorizes_tools: false/i);
  assert.match(status, /authorizes_web_search: false/i);
  assert.match(status, /authorizes_plugins: false/i);
  assert.match(status, /authorizes_retrieval: false/i);
  assert.match(status, /authorizes_mcp: false/i);
  assert.match(status, /authorizes_graph_ingestion: false/i);
  assert.match(status, /authorizes_production_use: false/i);

  assert.match(status, /provider_call_requires_new_approval: true/i);

  assertNoLeakage("lab runtime model proof status", status);
  assertNoBroadening("lab runtime model proof status", status);
});

test("lab runtime model proof approval packet records the status as consuming the one approval", () => {
  const approval = read(APPROVAL);

  // Pre-run packet semantics preserved.
  assert.match(approval, /Status: pre-run docs-only approval packet/i);
  assert.match(approval, /approval_id: lab-runtime-model-proof-live-attempt-20260605f/i);

  // Consumption recorded: links the later status and zeroes remaining authorization.
  assert.match(approval, /runtime-model-only-lab-runtime-live-proof-status\.md/i);
  assert.match(approval, /remaining_approved_future_attempts: 0/i);
  assert.match(approval, /retry_requires_new_approval: true/i);

  // Non-authorizing follow-up markers preserved.
  assert.match(approval, /authorizes_retry: false/i);
  assert.match(approval, /authorizes_provider_comparison: false/i);
  assert.match(approval, /authorizes_default_model_selection: false/i);
  assert.match(approval, /provider_lock_in: false/i);

  // The approval packet legitimately enumerates out-of-repo boundary vocabulary
  // (e.g. "request identifiers", "private evidence paths") as forbidden-to-commit
  // categories, and preserves its historical approval-time markers. Its own packet
  // contract test owns its leakage/broadening posture; here we only cross-check that
  // the consumption note records the consumed state and does not restore authorization.
  assert.match(approval, /does not add, restore, or broaden any authorization/i);
});
