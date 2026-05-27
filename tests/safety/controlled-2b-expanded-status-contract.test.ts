import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const EXPANDED_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");

const MANIFEST_HASHES = [
  "18be752143b01a5246205f8d4fcd7e3073a20894c9a1798a2010512ecf0f55ab",
  "f25c9f98190a05b7ea020be84ffd397203291c07feb91abd703a402e566f90b6",
  "a11e073a6140c9283303119a466dcd51fe4bc3f51bf8430ca98fa7d93d0713ad",
] as const;

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

const FORBIDDEN_SCOPE_CONTRADICTIONS = [
  /launch readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /product readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /production readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /broad model quality (?:is )?(?:proven|claimed|approved|established)/i,
  /multi-account corpus readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /OpenRouter\s+(?:is|as)\s+(?:required|committed|required provider|the committed provider|locked in|the only route)/i,
  /owl-alpha\s+(?:is|as)\s+(?:launch model|production default|quality winner|the chosen quality model)/i,
  /weak-but-valid[^\n.]+(?:implies|establishes|proves|approves|claims)[^\n.]+launch/i,
  /weak-but-valid[^\n.]+(?:implies|establishes|proves|approves|claims)[^\n.]+production/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateEvidenceLeakage(docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

function assertNoScopeContradictions(docs: string): void {
  for (const pattern of FORBIDDEN_SCOPE_CONTRADICTIONS) {
    assert.doesNotMatch(docs, pattern);
  }
}

function assertControlled2bExpandedStatus(docs: string): void {
  assert.match(docs, /controlled 2b-expanded usefulness validation/i);
  assert.match(docs, /sanitized execution record/i);
  assert.match(docs, /commit `?355c84e/i);
  assert.match(docs, /OpenRouter/i);
  assert.match(docs, /owl-alpha/i);
  assert.match(docs, /graph\.propose/i);
  assert.match(docs, /3-account controlled corpus/i);
  assert.match(docs, /representative/i);
  assert.match(docs, /edge-case/i);
  assert.match(docs, /calibration/i);
  assert.match(docs, /one provider call per selected account/i);
  assert.match(docs, /external-corpus\/controlled-2b-expanded\//i);
  assert.match(docs, /activation gates/i);
  assert.match(docs, /credential status/i);
  assert.match(docs, /provider call/i);
  assert.match(docs, /response contract/i);
  assert.match(docs, /cost ledger/i);
  assert.match(docs, /input tokens[^\n]*374/i);
  assert.match(docs, /output tokens[^\n]*305/i);
  assert.match(docs, /observed cost[^\n]*\$0/i);
  assert.match(docs, /full-pipeline packaging/i);
  assert.match(docs, /bootstrap evidence verifier/i);
  for (const hash of MANIFEST_HASHES) {
    assert.match(docs, new RegExp(hash));
  }
  assert.match(docs, /assessControlledCorpusUsefulness\(\.\.\.\)/i);
  assert.match(docs, /weak-but-valid/i);
  assert.match(docs, /inspect[^\n.]*rubric/i);
  assert.match(docs, /inspect[^\n.]*prompts/i);
  assert.match(docs, /proposal layer/i);
  assert.match(docs, /evidence policy/i);
  assert.match(docs, /before comparison or expansion|before expansion\/comparison/i);
  assert.match(docs, /do not claim readiness/i);
  assert.match(docs, /classification counts[^\n]*weak-but-valid[^\n]*3/i);
  assert.match(docs, /zero-output[^\n]*0/i);
  assert.match(docs, /unsupported\/invented[^\n]*0/i);
  assert.match(docs, /contract failure[^\n]*0/i);
  assert.match(docs, /launch_readiness_claim: false/i);
  assert.match(docs, /no post-validation rereads/i);
  assert.match(docs, /normalized cop(?:y|ies)/i);
  assert.match(docs, /research-run identifier contract/i);
  assert.match(docs, /without retrying provider calls/i);
  assert.match(docs, /private evidence/i);
  assert.match(docs, /outside (?:the )?repository/i);
  assert.match(docs, /no production writes/i);
  assert.match(docs, /no runtime\/model-mode integration/i);
  assert.match(docs, /does not imply launch readiness/i);
  assert.match(docs, /does not imply product readiness/i);
  assert.match(docs, /does not establish production readiness/i);
  assert.match(docs, /does not establish broad model quality/i);
  assert.match(docs, /does not establish multi-account corpus readiness/i);
  assert.match(docs, /provider portability/i);
  assert.match(docs, /Anthropic API/i);
  assert.match(docs, /OpenAI API/i);
}

describe("safety: controlled 2b-expanded execution status docs", () => {
  it("records the sanitized controlled 2b-expanded execution milestone in the runbook", () => {
    const docs = readRepoFile(EXPANDED_RUNBOOK_PATH);

    assertControlled2bExpandedStatus(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  it("records the sanitized controlled 2b-expanded execution milestone in the transition strategy", () => {
    const docs = readRepoFile(STRATEGY_PATH);

    assertControlled2bExpandedStatus(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });
});
