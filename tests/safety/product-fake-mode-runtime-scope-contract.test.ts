import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SCOPE_DOC = "docs/strategy/product-facing-fake-mode-runtime-scope.md";
const EXIT_DOC = "docs/strategy/first-validation-cycle-exit.md";

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  const forbiddenPatterns = [
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
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeExpansion(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad[- ]corpus (?:quality|readiness|coverage) (?:is )?(?:proven|established|approved|claimed)/i,
    /multi[- ]provider (?:support|validation|readiness) (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /live provider execution (?:is )?(?:approved|authorized|allowed)/i,
    /live provider calls? (?:are|is )?(?:approved|authorized|allowed)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed)/i,
    /production deployment (?:is )?(?:approved|authorized|allowed)/i,
    /production writes (?:are )?(?:approved|authorized|allowed)/i,
    /customer-data access (?:is )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

describe("safety: product-facing fake-mode runtime scope", () => {
  test("defines the narrow fake-mode Workshop/product surface without approving spend or live execution", () => {
    const doc = readRepoFile(SCOPE_DOC);
    assert.match(doc, /Status: Accepted/i);
    assert.match(doc, /first-validation-cycle-exit\.md/i);
    assert.match(doc, /src\/runtime\/workshop-preview\.ts/i);
    assert.match(doc, /prepareRuntimeWorkshopPreview/i);
    assert.match(doc, /prepareRuntimeWorkshopHtmlPreview/i);
    assert.match(doc, /src\/cli\/runtime-workshop-preview\.ts/i);
    assert.match(doc, /stdout-only HTML/i);
    assert.match(doc, /MODEL_PROVIDER=fake/i);
    assert.match(doc, /deterministic\/fake-mode/i);
    assert.match(doc, /existing validated graph-backed outputs/i);
    assert.match(doc, /useful 3/i);
    assert.match(doc, /zero-output 0/i);
    assert.match(doc, /contract failure 0/i);
    assert.match(doc, /providerCallsMade: 0/i);
    assert.match(doc, /productionWrites: false/i);
    assert.match(doc, /no new provider calls/i);
    assert.match(doc, /no provider spend/i);
    assert.match(doc, /no runtime\/model-mode integration/i);
    assert.match(doc, /no production deployment/i);
    assertNoPrivateLeakage("scope doc", doc);
    assertNoScopeExpansion("scope doc", doc);
  });

  test("records known limitations so fake-mode product work cannot overclaim the validation result", () => {
    const doc = readRepoFile(SCOPE_DOC);
    assert.match(doc, /fake-mode product work can mask integration gaps/i);
    assert.match(doc, /useful on three roles/i);
    assert.match(doc, /does not prove product usefulness at scale/i);
    assert.match(doc, /provider portability is an architectural commitment/i);
    assert.match(doc, /does not prove multi-provider validation/i);
    assert.match(doc, /budget gates were traversed at \$0\.00/i);
    assert.match(doc, /does not prove paid-spend enforcement/i);
    assert.match(doc, /response contract was validated against one approved provider route/i);
    assert.match(doc, /does not guarantee all provider response shapes/i);
    assert.match(doc, /separate explicit approval packet/i);
    assertNoPrivateLeakage("scope doc", doc);
    assertNoScopeExpansion("scope doc", doc);
  });

  test("links the scope definition from the cycle-exit record", () => {
    const exitDoc = readRepoFile(EXIT_DOC);
    assert.match(exitDoc, /product-facing-fake-mode-runtime-scope\.md/i);
    assert.match(exitDoc, /known limitations/i);
    assert.match(exitDoc, /fake-mode product work/i);
    assertNoPrivateLeakage("exit doc", exitDoc);
    assertNoScopeExpansion("exit doc", exitDoc);
  });
});
