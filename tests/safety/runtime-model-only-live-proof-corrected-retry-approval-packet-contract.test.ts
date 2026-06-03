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
  "runtime-model-only-live-proof-corrected-retry-approval-packet.md",
);

test("runtime model-only live proof corrected-retry approval packet is docs-only and bounds exactly one retry", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    // Docs-only, non-executing posture.
    /Status: pre-run docs-only corrected-retry approval packet/i,
    /This PR does not execute a provider call/i,
    /fresh approval packet only/i,
    /adds no runtime source that can call a provider/i,
    /separate later PR/i,
    /execution_requires_separate_later_pr: true/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
    // Prior attempt consumed.
    /PR #176 merged `runtime-model-only-live-proof-one-call-approval-packet\.md`/i,
    /approved exactly one synthetic attempt/i,
    /PR #177 recorded that the one approved synthetic provider request was attempted/i,
    /PR #177 recorded `status: exception`/i,
    /`provider_calls_executed: 1`/i,
    /`accepted_output_received: false`/i,
    /`stable_error_code: provider_call_or_parse_failed`/i,
    /prior_approval_consumed: true/i,
    /prior_status: exception/i,
    /prior_provider_calls_executed: 1/i,
    /prior_accepted_output_received: false/i,
    // Correction boundary.
    /may address only the execution-envelope issue/i,
    /must not broaden model, route, provider, transport, prompt scope, data scope, tool scope, budget, or retry count/i,
    /same route\/provider\/model\/transport envelope/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    // Single retry envelope.
    /max_attempts: 1/i,
    /corrected_retry_only: true/i,
    /one_call_only: true/i,
    /approved max cost <= \$1/i,
    /max_cost_usd: 1/i,
    /synthetic model-only proof, no production data/i,
    /sanitized public evidence only/i,
    /private raw evidence must remain outside the repository/i,
    /must be recorded through the merged status writer/i,
    // Status writer outcomes.
    /blocked: provider_calls_executed must be 0/i,
    /exception: .*must not claim accepted output/i,
    /completed: requires exactly one provider call and accepted_output_received: true/i,
    // Sanitization markers.
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /raw_evidence_committed: false/i,
    // Non-authorizing markers.
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    // Forbidden surfaces.
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no session carryover/i,
    /no production deployment/i,
    /no provider comparison/i,
    /no default model selection/i,
    /no provider lock-in/i,
    /no autonomous-agent substitution/i,
    // Retry discipline.
    /Any further attempt after this corrected retry requires another fresh approval packet/i,
  ]) {
    assert.match(doc, required, `corrected-retry approval packet must contain: ${required}`);
  }

  for (const forbidden of [
    /retries authorized/i,
    /automatic retry allowed/i,
    /comparison authorized/i,
    /comparison run authorized/i,
    /candidate calls authorized/i,
    /default production model/i,
    /default model selection authorized/i,
    /provider_lock_in: true/i,
    /provider lock-in authorized/i,
    /\bproduction[ -]ready\b/i,
    /launch ready/i,
    /production writes allowed/i,
    /production deployment authorized/i,
    /provider call executed in this pr/i,
    /max_attempts: [2-9]/i,
    /prior_provider_calls_executed: [2-9]/i,
    /prior_accepted_output_received: true/i,
    /raw prompt/i,
    /raw request body/i,
    /raw response body/i,
    /private evidence path/i,
    /credential value:/i,
    /raw_evidence_committed: true/i,
  ]) {
    assert.doesNotMatch(
      doc,
      forbidden,
      `corrected-retry approval packet must not contain: ${forbidden}`,
    );
  }
});
