import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-preflight-status.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: GPT-5.5 comparison no-spend preflight status", () => {
  const docs = readRepoFile(STATUS_DOC);

  assert.match(docs, /Status: no-spend execution-readiness preflight/i);
  assert.match(docs, /does not execute provider calls/i);
  assert.match(docs, /does not spend/i);
  assert.match(docs, /does not compare model output/i);
  assert.match(docs, /does not approve a replacement credential path/i);
  assert.match(docs, /Codex CLI version observed: `codex-cli 0\.134\.0`/i);
  assert.match(docs, /Codex sandbox smoke check passed: true/i);
  assert.match(docs, /Execution is blocked for now/i);
  assert.match(docs, /autonomous agent execution surface, not yet a credential-neutral, model-only Atliera `ModelProvider` bridge/i);
  assert.match(docs, /no-tools\/no-shell\/no-file-access provider call/i);
  assert.match(docs, /provider_calls_executed: 0/i);
  assert.match(docs, /provider_spend: false/i);
  assert.match(docs, /model_output_compared: false/i);
  assert.match(docs, /raw_provider_evidence_committed: false/i);
  assert.match(docs, /codex_secret_material_committed: false/i);
  assert.match(docs, /tools_or_plugins_approved: false/i);
  assert.match(docs, /web_search_approved: false/i);
  assert.match(docs, /runtime_model_mode_integration: false/i);
  assert.match(docs, /broad_provider_quality_claim: false/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?prompt\s*[:=]/i,
    /provider calls? (?:is|are )?(?:executed|run)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /web search (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /tools? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
    /launch readiness (?:is )?(?:proven|claimed|implied)/i,
    /production readiness (?:is )?(?:proven|claimed|implied)/i,
  ]) {
    assert.doesNotMatch(docs, forbidden);
  }
});
