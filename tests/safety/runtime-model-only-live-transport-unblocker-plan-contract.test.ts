import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const PLAN = join(import.meta.dirname, "..", "..", "docs", "plans", "runtime-model-only-live-transport-unblocker.md");

test("runtime model-only live transport unblocker plan stays concrete and non-executing", () => {
  const plan = readFileSync(PLAN, "utf8");
  for (const required of [
    /Status: implementation plan only/i,
    /This PR does not execute a provider call/i,
    /blocked status: `runtime-model-only-live-proof-status\.md`/i,
    /accepts only Atliera `ModelProviderRequest`/i,
    /returns only Atliera `ModelProviderResponse`/i,
    /exact top-level request shape/i,
    /exact top-level response shape/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /private raw evidence outside the repository/i,
    /sanitized status follow-up only/i,
    /at most one provider call/i,
    /max_cost_usd: 1/i,
    /retry_requires_new_approval: true/i,
    /must not use Codex\/Hermes autonomous agent surfaces/i,
    /must not use shell\/curl/i,
    /live transport harness/i,
    /contract test/i,
    /approval packet/i,
  ]) assert.match(plan, required);

  for (const forbidden of [
    /execute now/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /default production model/i,
    /production ready/i,
    /comparison authorized/i,
  ]) assert.doesNotMatch(plan, forbidden);
});
