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
  "runtime-model-only-live-proof-approval-packet.md",
);

test("runtime model-only live proof approval packet is docs-only and exactly bounded to one attempt", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    // Docs-only, non-executing posture.
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute the live proof/i,
    /exactly one future bounded runtime model-only live proof attempt/i,
    // Built on the two merged building blocks.
    /PR #170 merged the runtime model-only live transport harness/i,
    /PR #171 merged the runtime model-only live proof status writer/i,
    // The single-call envelope.
    /one approved route\/provider boundary/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /at most one provider call/i,
    /approved max cost <= \$1/i,
    /max_cost_usd: 1/i,
    /sanitized public evidence only/i,
    /private raw evidence must remain outside the repository/i,
    /must be recorded through the status writer/i,
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
    // Forbidden surfaces incl. the two new ones for this packet.
    /no production deployment/i,
    /no provider comparison/i,
    /no default model selection/i,
    // Retry discipline.
    /Any retry requires a fresh approval packet/i,
  ]) {
    assert.match(doc, required, `approval packet must contain: ${required}`);
  }

  // The packet must NOT imply retries, comparisons, readiness, default model
  // choice, production deployment, or raw evidence publication. Each pattern
  // targets an affirmative dangerous claim, so a negation like
  // "no provider comparison" or "Do not retry automatically" does not trip it.
  for (const forbidden of [
    /retries authorized/i,
    /retry authorized/i,
    /automatic retry allowed/i,
    /comparison authorized/i,
    /comparison run authorized/i,
    /default production model/i,
    /default model selection authorized/i,
    /\bproduction[ -]ready\b/i,
    /launch ready/i,
    /production writes allowed/i,
    /production deployment authorized/i,
    /raw prompt/i,
    /raw request body/i,
    /raw response body/i,
    /private evidence path/i,
    /credential value:/i,
  ]) {
    assert.doesNotMatch(
      doc,
      forbidden,
      `approval packet must not contain: ${forbidden}`,
    );
  }
});
