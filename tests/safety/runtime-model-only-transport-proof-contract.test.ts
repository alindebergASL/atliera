import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-transport-proof.md");

test("runtime model-only transport proof doc remains no-spend and non-runtime", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /injected no-spend caller/i,
    /generateNoSpendProof/i,
    /does not implement ModelProvider/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_candidate_calls: false/i,
    /model_only_transport_proven: false/i,
    /runtime_model_provider_implemented: false/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/live smoke completed/i, /production ready/i, /default production model/i, /provider call executed/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
