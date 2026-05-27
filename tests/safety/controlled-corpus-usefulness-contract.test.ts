import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const USEFULNESS_CONTRACT_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-corpus-usefulness-validation.md");
const CONTROLLED_2B_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-live-provider-validation.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");

const FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS = [
  /\/home\//i,
  /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
  /run[-_]evidence\.(?:json|jsonl|txt|log)/i,
  /approval[_ -]?ref\s*[:=]/i,
  /api[_ -]?key\s*[:=]/i,
  /credential[_ -]?name\s*[:=]/i,
  /raw provider response\s*[:=]/i,
  /raw prompt\s*[:=]/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  /\blab\d*\.[a-z0-9-]+\.(?:com|net|org|io)\b/i,
];

const FORBIDDEN_SCOPE_EXPANSION_PATTERNS = [
  /\b(?:live provider runs?|provider calls?|provider spend|spend|paid fallback|production writes?|runtime\/model-mode integration)\s+(?:is|are)\s+(?:approved|authorized|allowed)\b/i,
  /\b(?:approves?|approved|authorizes?|authorized|allows?|allowed)\s+(?:another\s+)?(?:live provider runs?|provider calls?|provider spend|spend|paid fallback|production writes?|runtime\/model-mode integration)\b/i,
  /\b(?:launch readiness|product readiness|production readiness|multi-account corpus readiness|broad model quality)\s+(?:is|are)\s+(?:proven|claimed|approved|established)\b/i,
  /\b(?:proves?|claims?|approves?|establishes?)\s+(?:launch readiness|product readiness|production readiness|multi-account corpus readiness|broad model quality)\b/i,
  /\bOpenRouter\s+(?:is|as)\s+(?:required|committed|required provider|the committed provider|locked in|the only route)\b/i,
  /\bowl-alpha\s+(?:is|as)\s+(?:launch model|production default|quality winner|the chosen quality model)\b/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateEvidenceLeakage(docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

function assertNoScopeExpansionContradictions(docs: string): void {
  for (const pattern of FORBIDDEN_SCOPE_EXPANSION_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    for (const match of docs.matchAll(globalPattern)) {
      const index = match.index ?? 0;
      const prefix = docs.slice(Math.max(0, index - 240), index).toLowerCase();
      const isNegated =
        /(?:does not(?: itself)?|do not|must not|not|without|no)\s*$/.test(prefix) ||
        /does not authorize:\s*(?:[-;\s\w/,]*)$/.test(prefix) ||
        /not (?:include|record):[\s\S]*$/.test(prefix) ||
        /before any additional live\s*$/.test(prefix);

      assert.ok(isNegated, `forbidden scope expansion matched: ${match[0]}`);
    }
  }
}

function assertNoSpendNextStepBoundaries(docs: string): void {
  assert.match(docs, /no-spend/i);
  assert.match(docs, /before another live provider run/i);
  assert.match(docs, /(?:does not authorize provider calls|without authorizing provider calls)/i);
  assert.match(docs, /(?:does not (?:authorize|approve) (?:provider )?spend|without authorizing provider calls, spend|provider spend)/i);
  assert.match(docs, /(?:does not approve production writes|no production writes|without authorizing provider calls, spend, production writes)/i);
  assert.match(docs, /(?:does not approve runtime\/model-mode integration|no runtime\/model-mode integration|runtime\/model-mode integration)/i);
}

function assertProviderPortabilityBoundary(docs: string): void {
  assert.match(docs, /provider portability/i);
  assert.match(docs, /(?:OpenRouter lock-in|provider lock-in)/i);
  assert.match(docs, /Anthropic API/i);
  assert.match(docs, /OpenAI API/i);
}

function assertUsefulnessContract(docs: string): void {
  assert.match(docs, /controlled corpus usefulness validation/i);
  assert.match(docs, /Status: proposed contract/i);
  assert.match(docs, /no-spend/i);
  assert.match(docs, /does not authorize provider calls/i);
  assert.match(docs, /3-5 account/i);
  assert.match(docs, /representative account/i);
  assert.match(docs, /edge-case account/i);
  assert.match(docs, /calibration account/i);
  assert.match(docs, /selection criteria/i);
  assert.match(docs, /tie-break/i);
  assert.match(docs, /useful/i);
  assert.match(docs, /weak-but-valid/i);
  assert.match(docs, /zero-output/i);
  assert.match(docs, /unsupported\/invented/i);
  assert.match(docs, /contract failure/i);
  assert.match(docs, /hard invariants/i);
  assert.match(docs, /no invented IDs/i);
  assert.match(docs, /provenance required/i);
  assert.match(docs, /graph validates/i);
  assert.match(docs, /no private leakage/i);
  assert.match(docs, /soft quality signals/i);
  assert.match(docs, /materiality/i);
  assert.match(docs, /specificity/i);
  assert.match(docs, /account usefulness/i);
  assert.match(docs, /lens usefulness/i);
  assert.match(docs, /executable no-spend assessment helper/i);
  assert.match(docs, /src\/validation\/controlled-corpus-usefulness\.ts/i);
  assert.match(docs, /already-produced, already-sanitized account-level facts/i);
  assert.match(docs, /preserves the worst per-account classification/i);
  assert.match(docs, /launch_readiness_claim: false/i);
  assert.match(docs, /pre-locked decision tree/i);
  assert.match(docs, /substrate still passes[^\n]*weak output/i);
  assert.match(docs, /substrate failure/i);
  assert.match(docs, /useful output on the tiny corpus/i);
  assert.match(docs, /operational provider failure/i);
  assert.match(docs, /separate approval/i);
  assert.match(docs, /OpenRouter lock-in/i);
  assert.match(docs, /Anthropic API/i);
  assert.match(docs, /OpenAI API/i);
  assert.match(docs, /does not imply launch readiness/i);
  assert.match(docs, /does not imply product readiness/i);
  assert.match(docs, /does not establish broad model quality/i);
  assert.match(docs, /does not establish multi-account corpus readiness/i);
}

describe("safety: controlled corpus usefulness validation contract", () => {
  it("defines a no-spend usefulness contract before another live provider run", () => {
    const docs = readRepoFile(USEFULNESS_CONTRACT_PATH);

    assertUsefulnessContract(docs);
    assertNoSpendNextStepBoundaries(docs);
    assertProviderPortabilityBoundary(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("links the usefulness contract from the controlled 2b runbook", () => {
    const docs = readRepoFile(CONTROLLED_2B_RUNBOOK_PATH);

    assert.match(docs, /controlled-corpus-usefulness-validation\.md/i);
    assert.match(docs, /controlled corpus usefulness validation/i);
    assertNoSpendNextStepBoundaries(docs);
    assertProviderPortabilityBoundary(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("records the usefulness contract as the next validation step in the transition strategy", () => {
    const docs = readRepoFile(STRATEGY_PATH);

    assert.match(docs, /controlled-corpus-usefulness-validation\.md/i);
    assert.match(docs, /controlled corpus usefulness validation/i);
    assert.match(docs, /src\/validation\/controlled-corpus-usefulness\.ts/i);
    assert.match(docs, /deterministic no-spend assessment helper/i);
    assert.match(docs, /preserves the worst per-account classification/i);
    assertNoSpendNextStepBoundaries(docs);
    assertProviderPortabilityBoundary(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });
});
