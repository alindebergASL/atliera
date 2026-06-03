import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-live-proof-approval.md");

test("runtime model-only live proof approval is docs-only and exactly bounded", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute the live proof/i,
    /prerequisite: PR #166/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /at most one provider call/i,
    /max_cost_usd: 1/i,
    /external-corpus\/synthetic-runtime-model-only-live-proof\.json/i,
    /corpus\/synthetic-runtime-model-only-live-proof\.json/i,
    /prompts\/synthetic-runtime-model-only-live-proof-v1/i,
    /private raw evidence/i,
    /sanitized status follow-up/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no paid fallback/i,
    /retry_requires_new_approval: true/i,
    /authorizes_comparison_run: false/i,
    /authorizes_candidate_calls: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/production writes allowed/i, /default production model/i, /comparison authorized/i, /launch ready/i, /broad model quality/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
