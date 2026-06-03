import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-live-proof-execution-status.md",
);

test("runtime model-only live proof execution status doc remains fail-closed and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: fail-closed execution status contract/i,
    /This PR does not execute a provider call/i,
    /holds an injected transport-shaped callable by reference but never invokes it/i,
    /fails closed and records a blocked status before provider access/i,
    /never references or invokes any transport callable/i,
    // Sanitized outcome.
    /status: blocked/i,
    /reason_code: model_only_live_transport_unavailable/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /observed_cost_usd: 0/i,
    /approved_max_cost_usd: 1/i,
    /accepted_output_received: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /raw_evidence_committed: false/i,
    // Route boundary.
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    // Forbidden surfaces.
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no provider comparison/i,
    /no default model selection/i,
    /no provider lock-in/i,
    // Required non-authorizing markers.
    /model_only_transport_proven: false/i,
    /model_only_live_transport_implemented: false/i,
    /transport_invoked: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /default_production_model_selection: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /no automatic retry/i,
    /fresh approval packet/i,
  ]) {
    assert.match(doc, required, `execution status runbook must contain: ${required}`);
  }

  // The status must NOT imply a completed live proof, spend, authorization,
  // default selection, comparison, readiness, or any raw/private evidence.
  for (const forbidden of [
    /status: completed/i,
    /live proof completed/i,
    /transport_invoked: true/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /accepted_output_received: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_candidate_calls: true/i,
    /authorizes_comparison_run: true/i,
    /default model selection authorized/i,
    /default production model/i,
    /provider_lock_in: true/i,
    /\bproduction[ -]ready\b/i,
    /launch ready/i,
    /retries authorized/i,
    /comparison authorized/i,
    /raw prompt/i,
    /raw response body/i,
    /private evidence path/i,
    /raw_evidence_committed: true/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `execution status runbook must not contain: ${forbidden}`);
  }
});
