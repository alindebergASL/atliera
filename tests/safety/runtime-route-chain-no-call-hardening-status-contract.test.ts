import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/runtime-route-chain-no-call-hardening-status.md");
const ASSESSMENT = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-usefulness-assessment.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContainsAll(label: string, text: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(text, pattern, `${label} must contain ${pattern}`);
}

function assertNoLeakage(label: string, text: string): void {
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

function assertNoBroadening(label: string, text: string): void {
  for (const pattern of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_revalidation_run: true/i,
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
    /default_model_selection_claim: true/i,
    /provider_comparison_claim: true/i,
    /provider_quality_conclusion: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /provider_lock_in: true/i,
    /(?:approves|authorizes|allows|enables|permits|greenlights)\s+(?:a\s+)?(?:provider call|retry|revalidation|provider comparison|model comparison|default model|graph ingestion|production use|production write|product-preview expansion|corpus expansion|tools|web search|plugins|retrieval|mcp)/i,
    /(?:product|production|launch) readiness (?:is )?(?:proven|established|approved|claimed)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("route-chain hardening status records no-call stale-preflight observability fix without new authorization", () => {
  const status = read(STATUS);

  assertContainsAll("route-chain no-call hardening status", status, [
    /Runtime Route-Chain No-Call Hardening Status/i,
    /Status: completed no-call route-chain hardening/i,
    /runtime-route-fresh-lab-proof-usefulness-assessment\.md/i,
    /assessment_classification: useful_but_bounded_fresh_route_contract_signal/i,
    /catalog validation -> explicit routeRef selection -> runtime composition -> preflight -> sanitized observability/i,
    /selected fresh route expires before preflight/i,
    /preflight-blocked/i,
    /route_evidence_status_reported: expired-needs-revalidation/i,
    /requires_fresh_approval_before_use_reported: true/i,
    /usable_without_revalidation_reported: false/i,
    /validation_age_days_reported_at_observed_time: true/i,
    /throwing_provider_calls_observed: 0/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /assessment_provider_calls_executed: 0/i,
    /current_effective_authorization: none/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_revalidation_run: false/i,
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

  assertNoLeakage("route-chain no-call hardening status", status);
  assertNoBroadening("route-chain no-call hardening status", status);
});

test("fresh-route usefulness assessment points to route-chain hardening status without authorizing execution", () => {
  const assessment = read(ASSESSMENT);

  assertContainsAll("fresh-route usefulness assessment", assessment, [
    /runtime-route-chain-no-call-hardening-status\.md/i,
    /no-call route-chain hardening status/i,
    /current_effective_authorization: none/i,
    /authorizes_provider_call: false/i,
    /authorizes_future_runtime_model_mode_execution: false/i,
  ]);
  assertNoBroadening("fresh-route usefulness assessment", assessment);
}
);
