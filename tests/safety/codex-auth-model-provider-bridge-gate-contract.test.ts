import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const BRIDGE_DOC = join(REPO_ROOT, "docs", "runbooks", "codex-auth-model-provider-bridge-gate.md");
const PREFLIGHT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-preflight-status.md");
const TRANSPORT_STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "codex-auth-model-only-transport-proof-status.md");

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
  assert.match(docs, /evaluateCodexAuthModelOnlyTransportProof/i);
  assert.match(docs, /createCodexAuthModelProviderBridgeFromProof/i);
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
  assert.match(docs, /authorizes_candidate_calls: false/i);
  assert.match(docs, /raw_evidence_committed: false/i);
  assert.match(docs, /not a provider-quality result/i);
  assert.match(docs, /not runtime\/model-mode integration/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /OPENAI_API_KEY/i,
    /CODEX_AUTH(?:_|\s*[:=])/,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
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

test("safety: Codex-auth model-only transport proof status remains blocked and no-spend", () => {
  const status = readRepoFile(TRANSPORT_STATUS_DOC);
  const bridge = readRepoFile(BRIDGE_DOC);

  assert.match(bridge, /codex-auth-model-only-transport-proof-status\.md/i);

  for (const required of [
    /Status: no-spend transport proof status/i,
    /Codex CLI installed: true/i,
    /Codex CLI version observed: `codex-cli 0\.134\.0`/i,
    /auth file present: true/i,
    /sandbox smoke check passed: true/i,
    /structured-output support present: true/i,
    /read-only sandbox selection present: true/i,
    /web search flag present: true/i,
    /MCP management surface present: true/i,
    /plugin management surface present: true/i,
    /doctor reported provider reachability without a candidate model call/i,
    /still blocked/i,
    /autonomous agent execution surface/i,
    /not a proven model-only transport/i,
    /model_only_transport_proven: false/i,
    /tool_use_disabled: false/i,
    /shell_access_disabled: false/i,
    /file_access_disabled: false/i,
    /web_search_disabled: false/i,
    /plugins_disabled: false/i,
    /retrieval_disabled: false/i,
    /authorizes_candidate_calls: false/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /raw_evidence_committed: false/i,
    /approved_gpt55_comparison_executed: false/i,
    /runtime_model_mode_integration: false/i,
    /launch_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
  ]) {
    assert.match(status, required);
  }

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /OPENAI_API_KEY/i,
    /CODEX_AUTH(?:_|\s*[:=])/,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /approved_gpt55_comparison_executed: true/i,
    /authorizes_candidate_calls: true/i,
    /model_only_transport_proven: true/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /tool_use_disabled: true/i,
    /shell_access_disabled: true/i,
    /file_access_disabled: true/i,
    /web_search_disabled: true/i,
    /plugins_disabled: true/i,
    /retrieval_disabled: true/i,
    /launch_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
  ]) {
    assert.doesNotMatch(status, forbidden);
  }
});
