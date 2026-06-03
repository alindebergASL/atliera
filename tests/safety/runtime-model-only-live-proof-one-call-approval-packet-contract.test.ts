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
  "runtime-model-only-live-proof-one-call-approval-packet.md",
);

test("runtime model-only live proof one-call approval packet is docs-only and bounds exactly one call", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    // Docs-only, non-executing posture.
    /Status: pre-run docs-only one-call approval packet/i,
    /This PR does not execute a provider call/i,
    /exactly one future synthetic live proof attempt through the now-proven no-call `model-only-codex-auth` boundary/i,
    /adds no runtime source that can call a provider/i,
    // Execution belongs to a separate later PR.
    /separate later PR/i,
    /execution_requires_separate_later_pr: true/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
    // Built on the merged no-call prerequisites #173/#174/#175.
    /PR #173 merged the no-call runtime model-only live transport injection seam/i,
    /PR #174 merged the fail-closed runtime model-only live proof execution gate/i,
    /PR #175 merged the no-call `model-only-codex-auth` live transport boundary proof/i,
    /model-only-codex-auth-live-transport-proof\.md/i,
    // The single-call envelope: route/provider/model/transport facts.
    /one approved route\/provider\/transport boundary/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /at most one provider call \(max_attempts: 1\)/i,
    /approved max cost <= \$1/i,
    /max_cost_usd: 1/i,
    /one_call_only: true/i,
    /max_attempts: 1/i,
    /synthetic model-only proof, no production data/i,
    /sanitized public evidence only/i,
    /private raw evidence must remain outside the repository/i,
    /must be recorded through the merged status writer/i,
    // Status writer outcomes.
    /blocked: provider_calls_executed must be 0/i,
    /exception: .*must not claim accepted output/i,
    /completed: requires exactly one provider call and accepted_output_received: true/i,
    // Sanitization markers (marker style, not raw nouns).
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /raw_evidence_committed: false/i,
    // Non-authorizing markers.
    /retry_requires_new_approval: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
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
    /Any retry requires a fresh approval packet/i,
  ]) {
    assert.match(doc, required, `one-call approval packet must contain: ${required}`);
  }

  // The packet must NOT imply more than one call, retries, comparisons,
  // candidate calls, readiness, default model choice, provider lock-in,
  // production deployment, in-PR execution, or raw evidence publication.
  // Each pattern targets an affirmative dangerous claim, so a negation like
  // "no provider comparison" or "Do not retry automatically" does not trip it.
  for (const forbidden of [
    /retries authorized/i,
    /retry authorized/i,
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
    /provider_calls_executed: [1-9]/i,
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
      `one-call approval packet must not contain: ${forbidden}`,
    );
  }
});
