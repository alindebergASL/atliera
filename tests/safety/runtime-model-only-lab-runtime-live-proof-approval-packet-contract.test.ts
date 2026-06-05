import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-lab-runtime-live-proof-approval-packet.md",
);
const HARNESS_STATUS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/live-provider-proof-verifier-runtime-harness-status.md",
);

function assertNoForbiddenBroadening(label: string, text: string): void {
  const forbidden = [
    /provider_call_executed_in_this_pr:\s*true/i,
    /adds_runtime_provider_call_source:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_corpus_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /authorizes_mcp:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /retry_requires_new_approval:\s*false/i,
    /approved_future_attempts:\s*[2-9]/i,
    /max_provider_calls:\s*[2-9]/i,
    /max_attempts:\s*[2-9]/i,
    /standing approval/i,
    /may retry without/i,
    /production ready/i,
    /launch ready/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("lab runtime model proof live-attempt packet is a pre-run, one-call, non-broadening approval", () => {
  const approval = readFileSync(APPROVAL_DOC, "utf8");

  // Pre-run, non-executing posture.
  assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i);
  assert.match(approval, /provider_call_executed_in_this_pr: false/i);
  assert.match(approval, /adds_runtime_provider_call_source: false/i);
  assert.match(approval, /one future tiny synthetic lab runtime\/model-mode proof attempt/i);
  assert.match(approval, /separate later execution\/status PR after this packet is merged/i);

  // Bound to the merged lab/test harness and its source.
  assert.match(approval, /harness_status_ref: `live-provider-proof-verifier-runtime-harness-status\.md`/i);
  assert.match(approval, /harness_function: `executeLabRuntimeModelProof`/i);
  assert.match(approval, /tests\/validation\/lab-runtime-model-proof-harness\.test\.ts/i);

  // Exact bounded scope.
  assert.match(approval, /approval_id: lab-runtime-model-proof-live-attempt-20260605f/i);
  assert.match(approval, /approved_future_attempts: 1/i);
  assert.match(approval, /one_call_only: true/i);
  assert.match(approval, /max_attempts: 1/i);
  assert.match(approval, /max_provider_calls: 1/i);
  assert.match(approval, /max_cost_usd: 1/i);
  assert.match(approval, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(approval, /provider_ref: openai-codex/i);
  assert.match(approval, /model_label: gpt-5\.5/i);
  assert.match(approval, /environment: lab/i);
  assert.match(approval, /operation: graph\.propose/i);
  assert.match(approval, /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i);
  assert.match(approval, /corpus_scope: synthetic-only/i);
  assert.match(approval, /explicit and replaceable/i);

  // Required pre-run gate checks.
  assert.match(approval, /selectedRoute\.environment must equal lab/i);
  assert.match(approval, /request model must match the selected route model/i);
  assert.match(approval, /credential readiness must be true at execution time/i);
  assert.match(approval, /execution preflight must pass/i);
  assert.match(approval, /no tools/i);
  assert.match(approval, /no web search/i);
  assert.match(approval, /no plugins/i);
  assert.match(approval, /no MCP/i);
  assert.match(approval, /no retrieval/i);
  assert.match(approval, /no shell/i);
  assert.match(approval, /no file access/i);
  assert.match(approval, /no graph ingestion/i);
  assert.match(approval, /no production writes/i);
  assert.match(approval, /no deployment/i);
  assert.match(approval, /no provider comparison/i);
  assert.match(approval, /no corpus expansion/i);
  assert.match(approval, /no product-preview expansion/i);
  assert.match(approval, /no default model selection/i);
  assert.match(approval, /no provider lock-in/i);

  // Transport boundary: injected ModelProvider via the harness only.
  assert.match(approval, /injected `ModelProvider` boundary/i);
  assert.match(approval, /consumed by `executeLabRuntimeModelProof`/i);
  assert.match(approval, /must not substitute a shell command, curl, a Claude Code session, a Hermes session, or an autonomous-agent session/i);

  // Out-of-repo boundary.
  assert.match(approval, /preview HTML or screenshots/i);
  assert.match(approval, /request identifiers/i);
  assert.match(approval, /private evidence paths/i);

  // Sanitized, separate follow-up status.
  assert.match(approval, /later status follow-up must be sanitized and separate/i);
  assert.match(approval, /retry_requires_new_approval: true/i);

  // Non-authorizing markers.
  assert.match(approval, /authorizes_one_future_lab_runtime_model_mode_attempt: true/i);
  assert.match(approval, /remaining_approved_future_attempts: 1/i);
  assert.match(approval, /authorizes_retry: false/i);
  assert.match(approval, /authorizes_provider_comparison: false/i);
  assert.match(approval, /authorizes_product_preview_expansion: false/i);
  assert.match(approval, /authorizes_corpus_expansion: false/i);
  assert.match(approval, /authorizes_default_model_selection: false/i);
  assert.match(approval, /authorizes_graph_ingestion: false/i);
  assert.match(approval, /authorizes_production_use: false/i);
  assert.match(approval, /authorizes_tools: false/i);
  assert.match(approval, /authorizes_web_search: false/i);
  assert.match(approval, /authorizes_plugins: false/i);
  assert.match(approval, /authorizes_retrieval: false/i);
  assert.match(approval, /authorizes_mcp: false/i);
  assert.match(approval, /default_model_selection_claim: false/i);
  assert.match(approval, /provider_quality_conclusion: false/i);
  assert.match(approval, /product_readiness_claim: false/i);
  assert.match(approval, /production_readiness_claim: false/i);
  assert.match(approval, /launch_readiness_claim: false/i);
  assert.match(approval, /provider_lock_in: false/i);

  assertNoForbiddenBroadening("lab runtime live-attempt approval", approval);
});

test("lab runtime live-attempt packet records consumption without restoring or broadening authorization", () => {
  const approval = readFileSync(APPROVAL_DOC, "utf8");

  // Consumed state documented and pointed at the separate sanitized status.
  assert.match(approval, /approval_consumed: true/i);
  assert.match(approval, /consuming_status_ref: `runtime-model-only-lab-runtime-live-proof-status\.md`/i);
  assert.match(approval, /current_remaining_approved_future_attempts: 0/i);

  // Pre-run packet checks remain intact alongside the consumption note.
  assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i);
  assert.match(approval, /approval_id: lab-runtime-model-proof-live-attempt-20260605f/i);
  assert.match(approval, /authorizes_one_future_lab_runtime_model_mode_attempt: true/i);
  assert.match(approval, /retry_requires_new_approval: true/i);

  // Consumption must not restore or broaden authorization.
  assert.match(approval, /does not add, restore, or broaden any authorization/i);
  assertNoForbiddenBroadening("lab runtime live-attempt approval consumption", approval);
});

test("harness status doc links the live-attempt packet without broadening its own authorization", () => {
  const status = readFileSync(HARNESS_STATUS_DOC, "utf8");
  assert.match(status, /runtime-model-only-lab-runtime-live-proof-approval-packet\.md/i);
  // The status doc itself must not become an authorizer.
  assert.match(status, /authorizes_future_runtime_model_mode_execution: false/i);
  assert.match(status, /provider_call_requires_new_approval: true/i);
});
