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
  "runtime-model-only-live-transport-injection-seam.md",
);

test("runtime model-only live transport injection seam doc remains no-call and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-call injection seam contract/i,
    /This PR does not execute a provider call/i,
    /proves only the injected transport boundary/i,
    /does not authorize the live proof/i,
    /does not execute the live proof/i,
    /does not implement the real model-only live transport/i,
    // The injected seam shape.
    /injected `transport` callable/i,
    /function of arity 1/i,
    /holds the transport callable by reference but never invokes it/i,
    /max_cost_usd: 1/i,
    /accepts only Atliera `ModelProviderRequest`/i,
    /returns only Atliera `ModelProviderResponse`/i,
    /exact top-level request shape/i,
    /exact top-level response shape/i,
    /corpus\/synthetic-/i,
    /prompts\/synthetic-/i,
    // Forbidden surfaces.
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    // Required markers.
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /transport_invoked: false/i,
    /transport_injection_seam_proven: true/i,
    /model_only_live_transport_implemented: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /fresh approval packet/i,
  ]) {
    assert.match(doc, required, `seam runbook must contain: ${required}`);
  }

  // The seam runbook must NOT imply that the live proof is executed,
  // authorized, retried, comparable, default-selected, or production-ready.
  for (const forbidden of [
    /live proof completed/i,
    /transport_invoked: true/i,
    /transport_injection_seam_proven: false/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_comparison_run: true/i,
    /default model selection authorized/i,
    /default production model/i,
    /\bproduction[ -]ready\b/i,
    /launch ready/i,
    /retries authorized/i,
    /comparison authorized/i,
    /raw prompt/i,
    /raw response body/i,
    /private evidence path/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `seam runbook must not contain: ${forbidden}`);
  }
});
