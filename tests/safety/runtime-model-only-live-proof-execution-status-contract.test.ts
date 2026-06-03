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

test("runtime model-only live proof execution status records exactly one sanitized corrected-retry exception and remains non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: exception after one approved corrected synthetic provider request/i,
    /Approval packet: `runtime-model-only-live-proof-corrected-retry-approval-packet\.md`/i,
    /corrected retry was performed after PR #178 merged/i,
    /sanitized public status only/i,
    /does not authorize another provider request/i,
    // Prior attempt history.
    /PR #176 approved exactly one synthetic attempt/i,
    /PR #177 recorded that attempt as an exception/i,
    /PR #177 recorded provider_calls_executed: 1 and accepted_output_received: false/i,
    /PR #178 supplied the fresh approval packet for exactly one corrected retry/i,
    // Sanitized corrected-retry outcome.
    /status: exception/i,
    /reason_code: synthetic_model_only_live_proof_exception/i,
    /stable_error_code: provider_call_or_parse_failed/i,
    /provider_calls_executed: 1/i,
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
    /transport_kind: model-only-codex-auth/i,
    // Forbidden surfaces.
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
    /no production writes/i,
    /no production deployment/i,
    /no autonomous-agent substitution/i,
    // Required non-authorizing markers.
    /max_attempts: 1/i,
    /one_call_only: true/i,
    /corrected_retry_only: true/i,
    /prior_approval_consumed: true/i,
    /corrected_retry_approval_consumed: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /no automatic retry/i,
    /no live proof completed/i,
    /no accepted model output recorded/i,
    /Do not treat either PR #176 or PR #178 as reusable authorization/i,
  ]) {
    assert.match(doc, required, `execution status runbook must contain: ${required}`);
  }

  for (const forbidden of [
    /status: completed/i,
    /accepted_output_received: true/i,
    /provider_spend: true/i,
    /provider_calls_executed: [2-9]/i,
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
    /credential_value_observed: true/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `execution status runbook must not contain: ${forbidden}`);
  }
});
