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
  "runtime-model-only-live-proof-output-contract-approval-packet.md",
);

test("output-contract approval packet bounds exactly one future model-only attempt", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: pre-run docs-only output-contract-compatible approval packet/i,
    /does not execute a provider call/i,
    /authorizes exactly one future synthetic model-only live proof attempt/i,
    /separate later PR/i,
    /PR #176 approved exactly one synthetic attempt/i,
    /PR #178 approved exactly one corrected retry/i,
    /PR #180 approved exactly one parameter-compatible attempt/i,
    /PR #182 must be merged/i,
    /collect streamed `response\.output_text\.delta` text as canonical output/i,
    /`response\.output_item\.done` text only as fallback/i,
    /never concatenate delta text and completed item text/i,
    /parse exactly one strict JSON object/i,
    /exact top-level keys: `excerpts`, `claims`, `account_objects`/i,
    /reject duplicate concatenated JSON objects/i,
    /reject markdown fences and prose wrappers/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /max_attempts: 1/i,
    /one_call_only: true/i,
    /output_contract_compatible_attempt_only: true/i,
    /max_cost_usd: 1/i,
    /approved max cost <= \$1/i,
    /synthetic model-only proof, no production data/i,
    /private raw evidence must remain outside the repository/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no session carryover/i,
    /no provider comparison/i,
    /no default model selection/i,
    /no provider lock-in/i,
    /no autonomous-agent substitution/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /raw_evidence_committed: false/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
    /execution_requires_separate_later_pr: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /Do not retry automatically/i,
    /requires another fresh approval packet/i,
  ]) {
    assert.match(doc, required, `approval packet must contain: ${required}`);
  }

  for (const forbidden of [
    /provider_call_executed_in_this_pr: true/i,
    /adds_runtime_provider_call_source: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_candidate_calls: true/i,
    /authorizes_comparison_run: true/i,
    /default model selected/i,
    /default production model/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /max_attempts: [2-9]/i,
    /raw prompt/i,
    /raw request body/i,
    /raw response body/i,
    /private evidence path/i,
    /credential value:/i,
    /automatic retry authorized/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `approval packet must not contain: ${forbidden}`);
  }
});
