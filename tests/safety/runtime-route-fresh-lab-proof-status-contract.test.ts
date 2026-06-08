import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-status.md");
const APPROVAL = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-approval-packet.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContainsAll(label: string, text: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(text, pattern, `${label} must contain ${pattern}`);
}

function assertExactMarker(label: string, text: string, marker: string, value: string): void {
  assert.match(
    text,
    new RegExp(`^- ${marker}: ${value}$`, "mi"),
    `${label} must contain exact marker ${marker}: ${value}`,
  );
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
    /provider_call_requires_new_approval:\s*false/i,
    /^- remaining_approved_future_attempts:\s*(?!0$)\d+/im,
    /^- approved_future_attempts:\s*(?!1$)\d+/im,
    /^- attempts_executed:\s*(?!1$)\d+/im,
    /^- provider_calls_executed:\s*(?!1$)\d+/im,
    /^- transport_calls_observed_by_runner:\s*(?!1$)\d+/im,
    /standing approval/i,
    /retry permitted/i,
    /automatic retry/i,
    /may retry without/i,
  ]) {
    assert.doesNotMatch(text, forbidden, `${label} must not broaden with ${forbidden}`);
  }
}

test("fresh-route lab proof status records the single approved attempt as consumed and completed", () => {
  const status = read(STATUS);

  assertContainsAll("fresh-route proof status", status, [
    /Status: completed/i,
    /bounded historical lab runtime\/model-mode contract signal only/i,
    /approval_id: runtime-route-fresh-lab-proof-20260607a/i,
    /approval_ref: docs\/runbooks\/runtime-route-fresh-lab-proof-approval-packet\.md/i,
    /approval_consumed: true/i,
    /approved_future_attempts: 1/i,
    /remaining_approved_future_attempts: 0/i,
    /attempts_executed: 1/i,
    /retry_requires_new_approval: true/i,
    /provider_call_requires_new_approval: true/i,
    /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_ref: injected-model-provider-lab-runtime-harness/i,
    /environment: lab/i,
    /operation: graph\.propose/i,
    /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i,
    /route_recency_status_observed_at_preflight: fresh/i,
    /reason_code: lab_runtime_model_proof_completed/i,
    /stable_error_code: none/i,
    /preflight_ok: true/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /provider_spend: false/i,
    /observed_cost_usd: 0/i,
    /input_tokens_observed: 523/i,
    /output_tokens_observed: 1247/i,
    /total_tokens_observed: 1770/i,
    /accepted_output_received: true/i,
    /exact_output_contract_validated: true/i,
    /output_counts: excerpts 9, claims 9, account_objects 9/i,
  ]);

  assertExactMarker("fresh-route proof status", status, "approved_future_attempts", "1");
  assertExactMarker("fresh-route proof status", status, "remaining_approved_future_attempts", "0");
  assertExactMarker("fresh-route proof status", status, "attempts_executed", "1");
  assertExactMarker("fresh-route proof status", status, "provider_calls_executed", "1");
  assertExactMarker("fresh-route proof status", status, "transport_calls_observed_by_runner", "1");
  assertExactMarker("fresh-route proof status", status, "observed_cost_usd", "0");

  assertContainsAll("fresh-route proof status boundaries", status, [
    /graph_ingestion_performed: false/i,
    /production_writes: false/i,
    /provider_payload_committed: false/i,
    /model_output_committed: false/i,
    /raw_prompt_committed: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_material_committed: false/i,
    /request_identifier_committed: false/i,
    /current_effective_authorization: none/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_future_runtime_model_mode_execution: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_corpus_expansion: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_tools: false/i,
    /authorizes_web_search: false/i,
    /authorizes_plugins: false/i,
    /authorizes_retrieval: false/i,
    /authorizes_mcp: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_production_use: false/i,
    /default_model_selection_claim: false/i,
    /provider_comparison_claim: false/i,
    /provider_quality_conclusion: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /provider_lock_in: false/i,
  ]);

  assertNoLeakage("fresh-route proof status", status);
  assertNoBroadening("fresh-route proof status", status);
});

test("fresh-route approval packet links consumed status without restoring authorization", () => {
  const approval = read(APPROVAL);

  assertContainsAll("fresh-route approval consumption note", approval, [
    /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i,
    /runtime-route-fresh-lab-proof-status\.md/i,
    /approval_consumed: true/i,
    /current_effective_authorization: none/i,
    /remaining_approved_future_attempts: 0/i,
    /historical_remaining_approved_future_attempts_at_approval_time: 1/i,
    /attempts_executed: 1/i,
    /provider_calls_executed: 1/i,
    /provider_call_requires_new_approval: true/i,
    /retry_requires_new_approval: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_future_runtime_model_mode_execution: false/i,
  ]);

  assertExactMarker("fresh-route approval consumption note", approval, "approved_future_attempts", "1");
  assertExactMarker("fresh-route approval consumption note", approval, "remaining_approved_future_attempts", "0");
  assertExactMarker("fresh-route approval consumption note", approval, "historical_remaining_approved_future_attempts_at_approval_time", "1");
  assertExactMarker("fresh-route approval consumption note", approval, "attempts_executed", "1");
  assertExactMarker("fresh-route approval consumption note", approval, "provider_calls_executed", "1");

  assertNoBroadening("fresh-route approval consumption note", approval);
});
