import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const EXIT_DOC = "docs/strategy/first-validation-cycle-exit.md";
const TRANSITION_DOC = "docs/strategy/substrate-to-validation-transition.md";
const BLOCKERS_DOC = "docs/BLOCKERS.md";

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

function assertNoPositiveScopeClaim(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /multi-account corpus readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /production writes (?:are )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

describe("safety: first validation cycle exit contract", () => {
  test("records the first-cycle exit decision as no-spend methodology, not a launch claim", () => {
    const doc = readRepoFile(EXIT_DOC);
    assert.match(doc, /Status: Accepted/i);
    assert.match(doc, /first validation cycle/i);
    assert.match(doc, /exit assessment/i);
    assert.match(doc, /no-spend/i);
    assert.match(doc, /methodology/i);
    assert.match(doc, /controlled-2b-expanded-rerun-status\.md/i);
    assert.match(doc, /useful tiny-corpus signal/i);
    assert.match(doc, /launch_readiness_claim: false/i);
    assert.match(doc, /does not imply launch readiness/i);
    assert.match(doc, /does not imply product readiness/i);
    assert.match(doc, /does not establish production readiness/i);
    assert.match(doc, /does not establish broad model quality/i);
    assert.match(doc, /does not approve provider comparison/i);
    assert.match(doc, /does not approve corpus expansion/i);
    assert.match(doc, /does not approve runtime\/model-mode integration/i);
    assert.match(doc, /does not approve production writes/i);
    assertNoPrivateLeakage("exit doc", doc);
    assertNoPositiveScopeClaim("exit doc", doc);
  });

  test("chooses a bounded next phase without authorizing new live execution", () => {
    const doc = readRepoFile(EXIT_DOC);
    assert.match(doc, /codify the validated engineering practice/i);
    assert.match(doc, /narrow product-facing fake-mode runtime/i);
    assert.match(doc, /deterministic\/fake-mode first/i);
    assert.match(doc, /src\/runtime\/workshop-preview\.ts/i);
    assert.match(doc, /providerCallsMade: 0/i);
    assert.match(doc, /productionWrites: false/i);
    assert.match(doc, /no live provider call/i);
    assert.match(doc, /separate explicit approval packet/i);
    assert.match(doc, /gateway and direct provider APIs/i);
    assert.match(doc, /OpenRouter is not a commitment/i);
    assert.match(doc, /Anthropic API/i);
    assert.match(doc, /OpenAI API/i);
    assertNoPositiveScopeClaim("exit doc", doc);
  });

  test("links the exit decision from durable gate and strategy docs independently", () => {
    for (const [label, path] of [
      ["transition strategy", TRANSITION_DOC],
      ["blockers", BLOCKERS_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /first-validation-cycle-exit\.md/i, `${label} must link exit decision`);
      assert.match(text, /first validation cycle/i, `${label} must preserve first-cycle context`);
      assert.match(text, /does not imply launch readiness|launch_readiness_claim: false|no launch readiness/i, `${label} must preserve no-readiness boundary`);
      assert.doesNotMatch(text, /\/home\//i, `${label} must not add private home-directory evidence paths`);
      assert.doesNotMatch(text, /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i, `${label} must not add private evidence markers`);
      assertNoPositiveScopeClaim(label, text);
    }
  });
});
