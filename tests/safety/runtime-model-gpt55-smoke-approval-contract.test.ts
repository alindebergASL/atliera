import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-gpt55-smoke-approval.md");

test("runtime GPT-5.5 smoke approval packet is docs-only and bounded", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute the smoke/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /at most one provider call/i,
    /synthetic-only corpus/i,
    /max_cost_usd: 1/i,
    /no tools/i,
    /no web search/i,
    /no shell/i,
    /no file access/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /private raw evidence/i,
    /sanitized status follow-up/i,
    /retry_requires_new_approval: true/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/paid fallback allowed/i, /production writes allowed/i, /default production model/i, /launch-ready/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
