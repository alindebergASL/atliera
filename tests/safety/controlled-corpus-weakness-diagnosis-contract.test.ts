import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const USEFULNESS_CONTRACT_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-corpus-usefulness-validation.md");
const EXPANDED_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const INDEX_PATH = join(REPO_ROOT, "src", "index.ts");

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

const FORBIDDEN_DIAGNOSIS_OVERCLAIMS = [
  /\b(?:diagnosis|weakness diagnosis)[^\n.]+(?:approves?|authorizes?|allows?)[^\n.]+(?:comparison|expansion|live provider|provider call|spend)/i,
  /\b(?:diagnosis|weakness diagnosis)[^\n.]+(?:proves?|establishes?|claims?)[^\n.]+(?:launch readiness|product readiness|production readiness|broad model quality|multi-account corpus readiness)/i,
  /\bweak-but-valid[^\n.]+(?:is|means|proves|establishes)[^\n.]+(?:ready|readiness|quality winner|comparison-ready|expansion-ready)/i,
  /\b(?:OpenRouter|owl-alpha)[^\n.]+(?:required|locked in|quality winner|production default|launch model)\b/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateEvidenceLeakage(docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

function assertNoDiagnosisOverclaims(docs: string): void {
  for (const pattern of FORBIDDEN_DIAGNOSIS_OVERCLAIMS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    for (const match of docs.matchAll(globalPattern)) {
      const index = match.index ?? 0;
      const prefix = docs.slice(Math.max(0, index - 160), index).toLowerCase();
      const matchText = match[0].toLowerCase();
      const isNegated =
        /(?:does not|do not|must not|not|without|no)\s*$/.test(prefix) ||
        /\bdoes not\b|\bdo not\b|\bmust not\b|\bnot\b|\bwithout\b|\bno\b/.test(matchText);

      assert.ok(isNegated, `forbidden diagnosis overclaim matched: ${match[0]}`);
    }
  }
}

function assertWeaknessDiagnosisContract(docs: string): void {
  assert.match(docs, /controlled corpus weakness diagnosis/i);
  assert.match(docs, /src\/validation\/controlled-corpus-weakness-diagnosis\.ts/i);
  assert.match(docs, /diagnoseControlledCorpusWeakness\(\.\.\.\)/i);
  assert.match(docs, /no-spend/i);
  assert.match(docs, /already-produced, already-sanitized account-level facts/i);
  assert.match(docs, /weak-but-valid/i);
  assert.match(docs, /low_materiality/i);
  assert.match(docs, /low_specificity/i);
  assert.match(docs, /missing_account_objects/i);
  assert.match(docs, /missing_lens_usefulness/i);
  assert.match(docs, /insufficient_evidence_density/i);
  assert.match(docs, /rubric_threshold_gap/i);
  assert.match(docs, /proposal_layer_underproduction/i);
  assert.match(docs, /evidence_policy_gap/i);
  assert.match(docs, /non_weak_blocker/i);
  assert.match(docs, /inspect_rubric/i);
  assert.match(docs, /inspect_prompts/i);
  assert.match(docs, /inspect_proposal_layer/i);
  assert.match(docs, /inspect_evidence_policy/i);
  assert.match(docs, /approves_expansion_or_comparison: false/i);
  assert.match(docs, /launch_readiness_claim: false/i);
  assert.match(docs, /does not authorize provider calls/i);
  assert.match(docs, /does not authorize provider spend/i);
  assert.match(docs, /does not approve comparison or expansion/i);
  assert.match(docs, /does not imply launch readiness/i);
  assert.match(docs, /does not establish broad model quality/i);
}

describe("safety: controlled corpus weakness diagnosis contract", () => {
  it("records the no-spend weakness diagnosis helper in the usefulness contract", () => {
    const docs = readRepoFile(USEFULNESS_CONTRACT_PATH);

    assertWeaknessDiagnosisContract(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoDiagnosisOverclaims(docs);
  });

  it("records the weak-but-valid follow-up path in the 2b-expanded runbook", () => {
    const docs = readRepoFile(EXPANDED_RUNBOOK_PATH);

    assertWeaknessDiagnosisContract(docs);
    assert.match(docs, /controlled 2b-expanded/i);
    assert.match(docs, /diagnosis[^\n.]+not a new execution record/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoDiagnosisOverclaims(docs);
  });

  it("records the weak-but-valid follow-up path in the transition strategy", () => {
    const docs = readRepoFile(STRATEGY_PATH);

    assertWeaknessDiagnosisContract(docs);
    assert.match(docs, /before comparison or expansion/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoDiagnosisOverclaims(docs);
  });

  it("exports the weakness diagnosis helper from the package entry point", () => {
    const index = readRepoFile(INDEX_PATH);

    assert.match(index, /controlled-corpus-weakness-diagnosis\.ts/);
  });
});
