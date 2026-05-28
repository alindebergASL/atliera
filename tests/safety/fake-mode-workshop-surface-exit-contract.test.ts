import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const EXIT_DOC = "docs/strategy/fake-mode-workshop-surface-exit-criteria.md";
const SCOPE_DOC = "docs/strategy/product-facing-fake-mode-runtime-scope.md";
const DEMO_RUNBOOK = "docs/runbooks/workshop-runtime-preview-demo.md";
const LIVE_APPROVAL = "docs/runbooks/live-product-preview-approval.md";
const DEMO_REPORT = "fixtures/workshop/runtime-preview-demo-report.json";

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
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /product-preview expansion (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /live provider execution (?:is )?(?:approved|authorized|allowed)/i,
    /live provider calls? (?:are|is )?(?:approved|authorized|allowed)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed)/i,
    /production deployment (?:is )?(?:approved|authorized|allowed)/i,
    /production writes (?:are )?(?:approved|authorized|allowed)/i,
    /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

function assertExitDocLinked(label: string, text: string): void {
  assert.match(text, /fake-mode-workshop-surface-exit-criteria\.md/i, `${label} must link exit criteria`);
}

describe("safety: fake-mode Workshop surface exit criteria", () => {
  test("codifies deterministic three-lane surface gates without approving live execution", () => {
    const doc = readRepoFile(EXIT_DOC);

    assert.match(doc, /Status: Accepted/i);
    assert.match(doc, /product-facing-fake-mode-runtime-scope\.md/i);
    assert.match(doc, /workshop-runtime-preview-demo\.md/i);
    assert.match(doc, /tests\/cli\/runtime-workshop-preview-demo-report\.test\.ts/i);
    assert.match(doc, /tests\/workshop\/render-html-edge-cases\.test\.ts/i);
    assert.match(doc, /fixtures\/graph\/valid\/workshop-three-lane\.json/i);
    assert.match(doc, /fixtures\/workshop\/runtime-preview-demo-report\.json/i);
    assert.match(doc, /Signals, Maps, and Plays render from graph-backed data/i);
    assert.match(doc, /lensItemCounts/i);
    assert.match(doc, /signals: 1/i);
    assert.match(doc, /maps: 1/i);
    assert.match(doc, /plays: 1/i);
    assert.match(doc, /lensEvidencePacketCounts/i);
    assert.match(doc, /Empty and sparse graph states render visibly/i);
    assert.match(doc, /Unsupported, unverified, stale, and source-document-only/i);
    assert.match(doc, /accepted evidence packets/i);
    assert.match(doc, /HTML-escaped/i);
    assert.match(doc, /Unsafe source URLs are omitted/i);
    assert.match(doc, /No raw runtime object/i);
    assert.match(doc, /No raw HTML appears in JSON reports/i);
    assert.match(doc, /No output paths/i);
    assert.match(doc, /Unknown or missing publishers are handled safely/i);
    assert.match(doc, /checked demo report exists/i);
    assert.match(doc, /checked report sync test/i);
    assert.match(doc, /npm run --silent workshop:runtime-preview -- fixtures\/graph\/valid\/workshop-three-lane\.json/i);
    assert.match(doc, /npm run --silent workshop:runtime-preview:html -- fixtures\/graph\/valid\/workshop-three-lane\.json/i);
    assert.match(doc, /MODEL_PROVIDER=fake/i);
    assert.match(doc, /providerCallsMade: 0/i);
    assert.match(doc, /productionWrites: false/i);
    assert.match(doc, /serverStarted: false/i);
    assert.match(doc, /clientsConstructed: false/i);
    assert.match(doc, /Hostile ambient provider environment is ignored/i);
    assert.match(doc, /fake-mode gates happen before graph reads/i);
    assert.match(doc, /request, but not execute, a separate one-run live-provider product-preview approval packet/i);
    assert.match(doc, /does not approve live provider execution/i);
    assert.match(doc, /does not approve provider spend/i);
    assert.match(doc, /does not approve production writes/i);
    assert.match(doc, /does not claim launch readiness/i);
    assert.match(doc, /does not claim product readiness/i);
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
    assertNoPrivateLeakage("exit doc", doc);
    assertNoScopeExpansion("exit doc", doc);
  });

  test("keeps checked three-lane report sanitized and lane-complete", () => {
    const report = JSON.parse(readRepoFile(DEMO_REPORT)) as Record<string, unknown>;

    assert.equal(report.ok, true);
    assert.equal(report.modelProvider, "fake");
    assert.deepEqual(report.lensItemCounts, { signals: 1, maps: 1, plays: 1 });
    assert.deepEqual(report.lensEvidencePacketCounts, { signals: 1, maps: 1, plays: 1 });
    assert.equal(report.providerCallsMade, 0);
    assert.equal(report.productionWrites, false);
    assert.equal(report.serverStarted, false);
    assert.equal(report.clientsConstructed, false);
    assert.equal(Object.hasOwn(report, "runtime"), false);
    assert.equal(Object.hasOwn(report, "html"), false);
    assert.equal(Object.hasOwn(report, "output_path"), false);
    assertNoPrivateLeakage("demo report", JSON.stringify(report));
  });

  test("links exit criteria from every durable fake-mode and live-preview handoff doc", () => {
    for (const [label, path] of [
      ["scope doc", SCOPE_DOC],
      ["demo runbook", DEMO_RUNBOOK],
      ["live approval", LIVE_APPROVAL],
    ] as const) {
      const doc = readRepoFile(path);
      assertExitDocLinked(label, doc);
      if (path === LIVE_APPROVAL) {
        assert.match(doc, /approves exactly one controlled live-provider product preview/i);
        assert.match(doc, /one representative account/i);
        assert.match(doc, /provider calls: exactly one/i);
        assert.match(doc, /Workshop renders: exactly one/i);
        assert.match(doc, /no more than one account/i);
        assert.match(doc, /no more than one provider call/i);
      }
      assertNoPrivateLeakage(label, doc);
      assertNoScopeExpansion(label, doc);
    }
  });
});
