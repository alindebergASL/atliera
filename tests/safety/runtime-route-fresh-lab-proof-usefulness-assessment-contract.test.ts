import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const DOC = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-usefulness-assessment.md");
const STATUS = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-status.md");

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

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]\s*bearer/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoPositiveBroadening(label: string, text: string): void {
  for (const pattern of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_future_runtime_model_mode_execution: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_product_preview_expansion: true/i,
    /authorizes_corpus_expansion: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_tools: true/i,
    /authorizes_web_search: true/i,
    /authorizes_plugins: true/i,
    /authorizes_retrieval: true/i,
    /authorizes_mcp: true/i,
    /authorizes_graph_ingestion: true/i,
    /authorizes_production_use: true/i,
    /launch_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /provider_lock_in: true/i,
    /default_model_selection_claim: true/i,
    /provider_comparison_claim: true/i,
    /provider_quality_conclusion: true/i,
    /(?:approves|authorizes|allows|enables|permits|greenlights)\s+(?:a\s+)?(?:provider call|retry|provider comparison|model comparison|default model|graph ingestion|production use|production write|product-preview expansion|corpus expansion|tools|web search|plugins|retrieval|mcp)/i,
    /may\s+(?:run|execute|perform)\s+(?:a\s+)?(?:provider call|retry|provider comparison|model comparison|graph ingestion|production write|product-preview expansion|corpus expansion)/i,
    /(?:product|production|launch) readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /default model (?:is )?(?:selected|approved|chosen)/i,
    /provider quality (?:is )?(?:proven|established|concluded)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("fresh-route proof usefulness assessment interprets the completed status without spending or broadening", () => {
  const doc = read(DOC);

  assertContainsAll("fresh-route usefulness assessment", doc, [
    /Runtime Route Fresh Lab Proof Usefulness Assessment/i,
    /Status: no-spend interpretation and decision record/i,
    /Source status: `runtime-route-fresh-lab-proof-status\.md`/i,
    /assessment_provider_calls_executed: 0/i,
    /assessment_provider_spend: false/i,
    /assessment_network_access: false/i,
    /assessment_classification: useful_but_bounded_fresh_route_contract_signal/i,
    /recommended_next_step: no-call-route-chain-hardening/i,
    /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_ref: injected-model-provider-lab-runtime-harness/i,
    /operation: graph\.propose/i,
    /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i,
    /route_recency_status_observed_at_preflight: fresh/i,
    /source_provider_calls_executed: 1/i,
    /source_transport_calls_observed_by_runner: 1/i,
    /source_observed_cost_usd: 0/i,
    /source_output_counts: excerpts 9, claims 9, account_objects 9/i,
    /exact_output_contract_validated: true/i,
    /approval_consumed: true/i,
    /remaining_approved_future_attempts: 0/i,
    /retry_requires_new_approval: true/i,
    /provider_call_requires_new_approval: true/i,
    /catalog validation -> explicit routeRef selection -> runtime composition -> preflight -> sanitized observability/i,
    /injected throwing provider/i,
    /never called/i,
    /Future direct provider API routes \(including Anthropic API and OpenAI API\) and gateway routes/i,
    /same `ModelProvider` boundary/i,
  ]);

  assertExactMarker("fresh-route usefulness assessment", doc, "assessment_provider_calls_executed", "0");
  assertExactMarker("fresh-route usefulness assessment", doc, "source_provider_calls_executed", "1");
  assertExactMarker("fresh-route usefulness assessment", doc, "source_transport_calls_observed_by_runner", "1");
  assertExactMarker("fresh-route usefulness assessment", doc, "source_observed_cost_usd", "0");
  assertExactMarker("fresh-route usefulness assessment", doc, "remaining_approved_future_attempts", "0");

  assertContainsAll("fresh-route usefulness assessment boundaries", doc, [
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
  ]);

  assertNoPrivateLeakage("fresh-route usefulness assessment", doc);
  assertNoPositiveBroadening("fresh-route usefulness assessment", doc);
});

test("fresh-route proof status links the no-spend assessment while preserving consumed authorization", () => {
  const status = read(STATUS);

  assertContainsAll("fresh-route proof status assessment link", status, [
    /Follow-up assessment: `runtime-route-fresh-lab-proof-usefulness-assessment\.md` is a no-spend interpretation and decision record\. It preserves the consumed approval state and current effective authorization of none\./i,
    /no-spend interpretation and decision record/i,
    /remaining_approved_future_attempts: 0/i,
    /provider_call_requires_new_approval: true/i,
    /retry_requires_new_approval: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_future_runtime_model_mode_execution: false/i,
  ]);

  assertExactMarker("fresh-route proof status", status, "remaining_approved_future_attempts", "0");
  assertNoPrivateLeakage("fresh-route proof status", status);
  assertNoPositiveBroadening("fresh-route proof status", status);
});
