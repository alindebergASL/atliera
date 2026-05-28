import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const EXIT_CRITERIA_DOC = "docs/strategy/fake-mode-workshop-surface-exit-criteria.md";
const SCOPE_DOC = "docs/strategy/product-facing-fake-mode-runtime-scope.md";
const DEMO_RUNBOOK = "docs/runbooks/workshop-runtime-preview-demo.md";

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
    /live provider execution (?:is )?(?:approved|authorized|allowed)/i,
    /live provider calls? (?:are|is )?(?:approved|authorized|allowed)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /production writes (?:are )?(?:approved|authorized|allowed)/i,
    /production deployment (?:is )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

describe("safety: fake-mode Workshop surface exit criteria", () => {
  test("defines the accepted fake-mode Workshop surface exit without approving live execution", () => {
    const doc = readRepoFile(EXIT_CRITERIA_DOC);

    assert.match(doc, /Status: Accepted/i);
    assert.match(doc, /product-facing-fake-mode-runtime-scope\.md/i);
    assert.match(doc, /workshop-runtime-preview-demo\.md/i);
    assert.match(doc, /fixtures\/workshop\/runtime-preview-demo-report\.json/i);
    assert.match(doc, /tests\/cli\/runtime-workshop-preview-demo-report\.test\.ts/i);
    assert.match(doc, /tests\/workshop\/render-html-edge-cases\.test\.ts/i);
    assert.match(doc, /sufficient to request, but not execute, a separate one-run live-provider product-preview approval packet/i);
    assert.match(doc, /does not approve live provider execution/i);
    assert.match(doc, /does not approve provider spend/i);
    assert.match(doc, /does not approve production writes/i);
    assert.match(doc, /does not claim launch readiness/i);
    assert.match(doc, /does not claim product readiness/i);
    assertNoPrivateLeakage("exit criteria doc", doc);
    assertNoScopeExpansion("exit criteria doc", doc);
  });

  test("requires product-surface, rendering, runtime, and report evidence gates", () => {
    const doc = readRepoFile(EXIT_CRITERIA_DOC);

    for (const required of [
      /Signals, Maps, and Plays all render/i,
      /empty and sparse graph states render visibly/i,
      /unsupported, unverified, stale, and source-document-only objects are visibly labeled/i,
      /accepted evidence packets/i,
      /Graph text is HTML-escaped/i,
      /Unsafe source URLs are omitted/i,
      /Unknown or missing publishers are handled safely/i,
      /No raw runtime object is returned/i,
      /No raw HTML appears in JSON reports/i,
      /No output paths are emitted/i,
      /MODEL_PROVIDER=fake/i,
      /providerCallsMade: 0/i,
      /productionWrites: false/i,
      /serverStarted: false/i,
      /clientsConstructed: false/i,
      /hostile ambient provider environment/i,
      /fake-mode gates before graph reads/i,
      /checked demo report exists/i,
      /checked report sync test/i,
      /npm run --silent workshop:runtime-preview -- fixtures\/graph\/valid\/workshop-three-lane\.json/i,
      /npm run --silent workshop:runtime-preview:html -- fixtures\/graph\/valid\/workshop-three-lane\.json/i,
    ]) {
      assert.match(doc, required);
    }
    assertNoPrivateLeakage("exit criteria doc", doc);
    assertNoScopeExpansion("exit criteria doc", doc);
  });

  test("preserves interpretation limits before the next live-preview approval packet", () => {
    const doc = readRepoFile(EXIT_CRITERIA_DOC);

    assert.match(doc, /does not prove provider quality/i);
    assert.match(doc, /does not prove multi-account readiness/i);
    assert.match(doc, /does not prove paid-budget enforcement/i);
    assert.match(doc, /does not prove launch, product, or production readiness/i);
    assert.match(doc, /separate docs-only approval packet/i);
    assert.match(doc, /provider\/model/i);
    assert.match(doc, /tiny account or corpus/i);
    assert.match(doc, /budget cap/i);
    assert.match(doc, /private evidence/i);
    assert.match(doc, /success\/failure interpretation/i);
    assert.match(doc, /pre-run decision tree/i);
    assertNoPrivateLeakage("exit criteria doc", doc);
    assertNoScopeExpansion("exit criteria doc", doc);
  });

  test("links the exit criteria from existing fake-mode scope and demo docs", () => {
    const scopeDoc = readRepoFile(SCOPE_DOC);
    const demoRunbook = readRepoFile(DEMO_RUNBOOK);

    assert.match(scopeDoc, /fake-mode-workshop-surface-exit-criteria\.md/i);
    assert.match(demoRunbook, /fake-mode-workshop-surface-exit-criteria\.md/i);
    assertNoPrivateLeakage("scope doc", scopeDoc);
    assertNoScopeExpansion("scope doc", scopeDoc);
    assertNoPrivateLeakage("demo runbook", demoRunbook);
    assertNoScopeExpansion("demo runbook", demoRunbook);
  });
});
