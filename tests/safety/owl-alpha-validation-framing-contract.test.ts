import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const FRAMING_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");
const USEFULNESS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-approval.md");
const STRATEGY_DOC = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoSafetyBypass(label: string, text: string): void {
  for (const pattern of [
    /owl-alpha[^\n.]*bypass(?:es)?[^\n.]*safety/i,
    /owl-alpha[^\n.]*bypass(?:es)?[^\n.]*provenance/i,
    /owl-alpha[^\n.]*bypass(?:es)?[^\n.]*quality/i,
    /owl-alpha[^\n.]*approves?[^\n.]*launch/i,
    /owl-alpha[^\n.]*approves?[^\n.]*production/i,
    /owl-alpha[^\n.]*approves?[^\n.]*customer[- ]data/i,
    /(?:Opus|Anthropic|OpenAI|GPT)[^\n.]*not[^\n.]*spend[- ]gated/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} weakened safety/cost boundary with ${pattern}`);
  }
}

test("safety: owl-alpha validation framing", async (t) => {
  await t.test("documents owl-alpha as no-cost broad-validation path without weakening safety gates", () => {
    const docs = readRepoFile(FRAMING_DOC);

    assert.match(docs, /Owl Alpha Validation Framing/i);
    assert.match(docs, /OpenRouter `owl-alpha`/i);
    assert.match(docs, /cost[- ]limited: false/i);
    assert.match(docs, /sample[- ]limited[- ]by[- ]cost: false/i);
    assert.match(docs, /broader validation/i);
    assert.match(docs, /not artificially limited by spend/i);
    assert.match(docs, /safety_provenance_quality_gates: required/i);
    assert.match(docs, /private evidence/i);
    assert.match(docs, /sanitized status/i);
    assert.match(docs, /no hidden web search/i);
    assert.match(docs, /no tools or plugins/i);
    assert.match(docs, /no production writes/i);
    assert.match(docs, /no runtime\/model-mode integration/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /provider_or_model_comparison: separate approval/i);
    assert.match(docs, /paid_or_premium_models: spend-gated/i);
    assert.match(docs, /Opus 4\.8/i);
    assert.match(docs, /spend cap/i);
    assert.match(docs, /direct Anthropic API and OpenAI API/i);
    assert.match(docs, /not OpenRouter lock-in/i);
    assertNoPrivateLeakage("framing doc", docs);
    assertNoSafetyBypass("framing doc", docs);
  });

  await t.test("links the framing from live-preview transition documents independently", () => {
    for (const [label, path] of [
      ["usefulness gate", USEFULNESS_DOC],
      ["live-preview status", STATUS_DOC],
      ["live-preview approval", APPROVAL_DOC],
      ["strategy", STRATEGY_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /owl-alpha-validation-framing\.md/i, `${label} must link owl-alpha framing`);
      assert.match(text, /cost[- ]limited: false|not artificially limited by spend|not cost-limited/i, `${label} must preserve owl-alpha cost framing`);
      assert.match(text, /safety|provenance|quality/i, `${label} must preserve non-cost gates`);
      assertNoPrivateLeakage(label, text);
      assertNoSafetyBypass(label, text);
    }
  });
});
