import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const GATE_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const STRATEGY_DOC = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const SCOPE_DOC = join(REPO_ROOT, "docs", "strategy", "product-facing-fake-mode-runtime-scope.md");
const INDEX = join(REPO_ROOT, "src", "index.ts");

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

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: live product preview usefulness gate", async (t) => {
  await t.test("documents a no-spend assessment gate before any expansion", () => {
    const docs = readRepoFile(GATE_DOC);

    assert.match(docs, /Live Product Preview Usefulness Gate/i);
    assert.match(docs, /assessLiveProductPreviewUsefulness\(\.\.\.\)/i);
    assert.match(docs, /already-produced, already-sanitized/i);
    assert.match(docs, /one-run live product preview/i);
    assert.match(docs, /no-spend/i);
    assert.match(docs, /no provider calls/i);
    assert.match(docs, /no provider spend/i);
    assert.match(docs, /no production writes/i);
    assert.match(docs, /no runtime\/model-mode integration/i);
    assert.match(docs, /no provider comparison/i);
    assert.match(docs, /no corpus expansion/i);
    assert.match(docs, /no product-preview expansion/i);
    assert.match(docs, /no web search/i);
    assert.match(docs, /no tools or plugins/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /useful/i);
    assert.match(docs, /weak-but-valid/i);
    assert.match(docs, /zero-output/i);
    assert.match(docs, /contract-failure/i);
    assert.match(docs, /separate approval packet/i);
    assertNoPrivateLeakage("gate doc", docs);
    assertNoScopeBroadening("gate doc", docs);
  });

  await t.test("links the gate from durable live-preview transition docs independently", () => {
    for (const [label, path] of [
      ["status", STATUS_DOC],
      ["strategy", STRATEGY_DOC],
      ["product fake-mode scope", SCOPE_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-usefulness-gate\.md/i, `${label} must link usefulness gate`);
      assert.match(text, /assessLiveProductPreviewUsefulness/i, `${label} must name assessment helper`);
      assert.match(text, /no-spend|no provider calls/i, `${label} must preserve no-spend boundary`);
      assert.match(text, /launch_readiness_claim: false|does not imply launch readiness|no-readiness/i, `${label} must preserve no-readiness boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
    }
  });

  await t.test("exports the helper from the public package entrypoint", () => {
    const index = readRepoFile(INDEX);
    assert.match(index, /validation\/live-product-preview-usefulness\.ts/i);
  });
});
