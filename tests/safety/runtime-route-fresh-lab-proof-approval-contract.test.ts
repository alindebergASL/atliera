import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_DOC = join(
  ROOT,
  "docs/runbooks/runtime-route-fresh-lab-proof-approval-packet.md",
);
const RECENCY_STATUS_DOC = join(
  ROOT,
  "docs/runbooks/runtime-route-recency-enforcement-status.md",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContainsAll(label: string, text: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(text, pattern, `${label} must contain ${pattern}`);
}

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
    /authorizes_revalidation_run:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /retry_requires_new_approval:\s*false/i,
    /fresh_route_required_at_execution_time:\s*false/i,
    /^- approved_future_attempts:\s*(?!1$)\d+/im,
    /^- remaining_approved_future_attempts:\s*(?!1$)\d+/im,
    /^- max_provider_calls:\s*(?!1$)\d+/im,
    /^- max_attempts:\s*(?!1$)\d+/im,
    /^- max_cost_usd:\s*(?!1$)\d+/im,
    /standing approval/i,
    /may retry without/i,
    /production ready/i,
    /launch ready/i,
    /default model selected/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

function assertExactMarker(label: string, text: string, marker: string, value: string): void {
  assert.match(
    text,
    new RegExp(`^- ${marker}: ${value}$`, "mi"),
    `${label} must contain exact marker ${marker}: ${value}`,
  );
}

test("fresh route lab proof approval packet is pre-run docs-only and bound to recency enforcement", () => {
  const approval = read(APPROVAL_DOC);
  const recency = read(RECENCY_STATUS_DOC);

  assert.match(recency, /Status: no-spend runtime route recency enforcement/i);
  assert.match(recency, /expired-needs-revalidation` route evidence is blocked before provider access/i);
  assert.match(recency, /Expired route evidence requires fresh approval/i);

  assertContainsAll("approval packet", approval, [
    /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i,
    /runtime-route-recency-enforcement-status\.md/i,
    /fresh_route_required_at_execution_time: true/i,
    /route_recency_status_required: fresh/i,
    /stale_or_candidate_label_only_route_blocks_before_provider_access: true/i,
    /selected route evidence must still be fresh at execution preflight time/i,
    /stale, expired, nearing-expiry, or candidate-label-only route evidence blocks before provider access/i,
    /If route evidence is stale at execution time, record a blocked status with provider_calls_executed: 0/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
  ]);

  assertNoForbiddenBroadening("fresh route lab proof approval", approval);
});

test("fresh route lab proof approval names exact one-call lab runtime scope and route", () => {
  const approval = read(APPROVAL_DOC);

  assertContainsAll("approval scope", approval, [
    /approval_id: runtime-route-fresh-lab-proof-20260607a/i,
    /one_call_only: true/i,
    /separate later execution status PR required: true/i,
    /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_ref: injected-model-provider-lab-runtime-harness/i,
    /environment: lab/i,
    /operation: graph\.propose/i,
    /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i,
    /corpus_scope: synthetic-only/i,
    /route_kind: candidate/i,
    /evidence_expires_at: 2026-07-05T00:00:00\.000Z/i,
    /stop_on_exception: true/i,
    /retry_requires_new_approval: true/i,
  ]);

  assertExactMarker("approval scope", approval, "approved_future_attempts", "1");
  assertExactMarker("approval scope", approval, "max_attempts", "1");
  assertExactMarker("approval scope", approval, "max_provider_calls", "1");
  assertExactMarker("approval scope", approval, "max_cost_usd", "1");

  assertNoForbiddenBroadening("fresh route lab proof approval scope", approval);
});

test("fresh route lab proof approval keeps runtime and provider capability boundaries closed", () => {
  const approval = read(APPROVAL_DOC);

  assertContainsAll("boundary markers", approval, [
    /current route catalog still contains the exact route_ref/i,
    /route selection uses route_ref only, not model label shortcuts/i,
    /preflightRuntimeModelExecution must pass/i,
    /route recency metadata must report fresh/i,
    /requires_fresh_approval_before_use must be false/i,
    /usable_without_revalidation must be true/i,
    /credential readiness must be true at execution time/i,
    /no tools/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no shell/i,
    /no file access/i,
    /no session carryover/i,
    /no background orchestrator/i,
    /no graph ingestion/i,
    /no production writes/i,
    /no deployment/i,
    /no provider comparison/i,
    /no corpus expansion/i,
    /no product-preview expansion/i,
    /no default model selection/i,
    /no provider lock-in/i,
    /injected `ModelProvider` boundary/i,
    /must not substitute a shell command, curl, a Claude Code session, a Hermes session, or an autonomous-agent session/i,
  ]);

  assertContainsAll("authorization state", approval, [
    /authorizes_one_future_fresh_lab_runtime_model_mode_attempt: true/i,
    /runtime_model_mode_execution_authorized_for_one_future_attempt: true/i,
    /authorizes_retry: false/i,
    /authorizes_revalidation_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_corpus_expansion: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_production_use: false/i,
    /authorizes_tools: false/i,
    /authorizes_web_search: false/i,
    /authorizes_plugins: false/i,
    /authorizes_retrieval: false/i,
    /authorizes_mcp: false/i,
    /default_model_selection_claim: false/i,
    /provider_comparison_claim: false/i,
    /provider_quality_conclusion: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /provider_lock_in: false/i,
  ]);

  assertExactMarker("authorization state", approval, "remaining_approved_future_attempts", "1");

  assertNoForbiddenBroadening("fresh route lab proof approval boundaries", approval);
});

test("fresh route lab proof approval requires sanitized separate status and private raw evidence boundary", () => {
  const approval = read(APPROVAL_DOC);

  assertContainsAll("status requirements", approval, [
    /The later status follow-up must be sanitized and separate from this packet/i,
    /status: completed, exception, or blocked/i,
    /provider_calls_executed/i,
    /provider_spend/i,
    /observed_cost_usd/i,
    /whether accepted output satisfied the exact output contract/i,
    /non-authorizing boundary markers/i,
    /raw prompt text/i,
    /raw request, raw response, or provider payload bodies/i,
    /model output text/i,
    /request identifiers/i,
    /credential-bearing values or auth headers/i,
    /private evidence paths or local evidence locations/i,
  ]);

  assertNoForbiddenBroadening("fresh route lab proof approval status", approval);
});
