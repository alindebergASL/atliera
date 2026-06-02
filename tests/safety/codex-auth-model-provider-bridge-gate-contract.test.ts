import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const BRIDGE_DOC = join(REPO_ROOT, "docs", "runbooks", "codex-auth-model-provider-bridge-gate.md");
const PREFLIGHT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-preflight-status.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: Codex-auth ModelProvider bridge gate docs", () => {
  const docs = readRepoFile(BRIDGE_DOC);

  assert.match(docs, /Status: no-spend implementation contract/i);
  assert.match(docs, /does not execute provider calls/i);
  assert.match(docs, /does not spend/i);
  assert.match(docs, /does not compare output/i);
  assert.match(docs, /evaluateCodexAuthBridgeReadiness/i);
  assert.match(docs, /CodexAuthModelProviderBridge/i);
  assert.match(docs, /CodexAuthModelOnlyGuarantee/i);
  assert.match(docs, /model-only transport proven/i);
  assert.match(docs, /tool use disabled/i);
  assert.match(docs, /shell access disabled/i);
  assert.match(docs, /file access disabled/i);
  assert.match(docs, /web search disabled/i);
  assert.match(docs, /plugins disabled/i);
  assert.match(docs, /retrieval disabled/i);
  assert.match(docs, /codex_auth_bridge: "model_only"/i);
  assert.match(docs, /tools: "false"/i);
  assert.match(docs, /web_search: "false"/i);
  assert.match(docs, /shell_access: "false"/i);
  assert.match(docs, /file_access: "false"/i);
  assert.match(docs, /online_variant: "false"/i);
  assert.match(docs, /still blocked until deployment\/private validation proves an injected `model-only-codex-auth` transport/i);
  assert.match(docs, /not a provider-quality result/i);
  assert.match(docs, /not runtime\/model-mode integration/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /provider calls? (?:is|are )?(?:executed|run)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /web search (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /tools? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /launch readiness (?:is )?(?:proven|claimed|implied)/i,
    /production readiness (?:is )?(?:proven|claimed|implied)/i,
  ]) {
    assert.doesNotMatch(docs, forbidden);
  }

  const preflight = readRepoFile(PREFLIGHT_DOC);
  assert.match(preflight, /codex-auth-model-provider-bridge-gate\.md/i);
  assert.match(preflight, /still blocks candidate calls/i);
});
