import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const OPERATOR_SMOKE_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-operator-smoke-status.md");
const BRIDGE_GATE_DOC = join(REPO_ROOT, "docs", "runbooks", "codex-auth-model-provider-bridge-gate.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: GPT-5.5 operator smoke status", () => {
  const docs = readRepoFile(OPERATOR_SMOKE_DOC);

  assert.match(docs, /Status: sanitized operator-connection smoke record only/i);
  assert.match(docs, /Hermes operator-connection smoke test/i);
  assert.match(docs, /OpenAI Codex-authenticated Hermes provider path/i);
  assert.match(docs, /not an Atliera `ModelProvider` execution/i);
  assert.match(docs, /not the approved bounded GPT-5\.5 comparison slice/i);
  assert.match(docs, /not a provider-quality conclusion/i);
  assert.match(docs, /not launch\/product\/production readiness/i);
  assert.match(docs, /synthetic-only/i);
  assert.match(docs, /strict JSON parsed: true/i);
  assert.match(docs, /markdown JSON fence present: false/i);
  assert.match(docs, /excerpts returned: 2/i);
  assert.match(docs, /claims returned: 2/i);
  assert.match(docs, /account objects returned: 3/i);
  assert.match(docs, /citation links valid: true/i);
  assert.match(docs, /atliera_model_provider_bridge: false/i);
  assert.match(docs, /provider_quality_conclusion: false/i);
  assert.match(docs, /production_readiness_claim: false/i);
  assert.match(docs, /does not satisfy the `CodexAuthModelProviderBridge` readiness gate/i);
  assert.match(docs, /Candidate GPT-5\.5 comparison calls remain blocked/i);
  assert.match(docs, /raw_model_payload_committed: false/i);
  assert.match(docs, /private_account_data_used: false/i);
  assert.match(docs, /owl_alpha_baseline_rerun: false/i);
  assert.match(docs, /model_output_compared_to_baseline: false/i);

  for (const forbidden of [
    /\/home\//i,
    /session_id:/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /raw[_ -]?(?:provider|model)?[_ -]?payload\s*[:=]/i,
    /raw[_ -]?(?:provider|model)?[_ -]?response\s*[:=]/i,
    /Atliera `ModelProvider` execution (?:succeeded|passed|completed|was executed)/i,
    /approved bounded GPT-5\.5 comparison (?:succeeded|passed|completed|was executed)/i,
    /provider-quality conclusion (?:is )?(?:proven|claimed|established)/i,
    /production readiness (?:is )?(?:proven|claimed|established)/i,
    /launch readiness (?:is )?(?:proven|claimed|established)/i,
  ]) {
    assert.doesNotMatch(docs, forbidden);
  }

  const bridge = readRepoFile(BRIDGE_GATE_DOC);
  assert.match(bridge, /live-product-preview-gpt55-operator-smoke-status\.md/i);
  assert.match(bridge, /not an Atliera `ModelProvider` execution/i);
  assert.match(bridge, /does not satisfy this bridge gate/i);
});
