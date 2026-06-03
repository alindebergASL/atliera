import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-live-transport-harness.md");

test("runtime model-only live transport harness doc remains no-call and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /Status: no-call harness contract/i,
    /This PR does not execute a provider call/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /model_only_live_transport_implemented: false/i,
    /exact top-level request shape/i,
    /exact top-level response shape/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /fresh approval packet/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/live proof completed/i, /provider_calls_executed: [1-9]/i, /provider_spend: true/i, /production ready/i, /default production model/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
