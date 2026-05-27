import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const EXPANDED_APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
const CONTROLLED_2B_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-live-provider-validation.md");
const USEFULNESS_CONTRACT_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-corpus-usefulness-validation.md");
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

const FORBIDDEN_SCOPE_CONTRADICTIONS = [
  /paid fallback (?:is )?allowed/i,
  /automatic retry expansion (?:is )?(?:allowed|approved|authorized)/i,
  /production writes? (?:is|are )?(?:allowed|approved|authorized)/i,
  /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
  /launch readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /product readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /production readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /broad model quality (?:is )?(?:proven|claimed|approved|established)/i,
  /multi-account corpus readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /OpenRouter\s+(?:is|as)\s+(?:required|committed|required provider|the committed provider|locked in|the only route)/i,
  /owl-alpha\s+(?:is|as)\s+(?:launch model|production default|quality winner|the chosen quality model)/i,
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

function assertExpandedApprovalContract(docs: string): void {
  assert.match(docs, /controlled 2b-expanded usefulness validation/i);
  assert.match(docs, /Status: pre-run approval packet/i);
  assert.match(docs, /docs-only/i);
  assert.match(docs, /does not execute/i);
  assert.match(docs, /OpenRouter/i);
  assert.match(docs, /owl-alpha/i);
  assert.match(docs, /free-tier/i);
  assert.match(docs, /graph\.propose/i);
  assert.match(docs, /3-5 account controlled corpus/i);
  assert.match(docs, /representative account/i);
  assert.match(docs, /edge-case account/i);
  assert.match(docs, /calibration account/i);
  assert.match(docs, /up to two additional bounded accounts/i);
  assert.match(docs, /external-corpus\/controlled-2b-expanded\//i);
  assert.match(docs, /max run cost[^\n]*\$0\.50/i);
  assert.match(docs, /expected observed provider cost[^\n]*\$0\.00/i);
  assert.match(docs, /cumulative 2b-expanded cap[^\n]*\$1\.00/i);
  assert.match(docs, /no paid fallback/i);
  assert.match(docs, /no automatic retry expansion/i);
  assert.match(docs, /private evidence/i);
  assert.match(docs, /outside (?:the )?repository/i);
  assert.match(docs, /sanitized status/i);
  assert.match(docs, /assessControlledCorpusUsefulness\(\.\.\.\)/i);
  assert.match(docs, /launch_readiness_claim: false/i);
  assert.match(docs, /no post-validation rereads/i);
  assert.match(docs, /already-produced, already-sanitized account-level facts/i);
  assert.match(docs, /does not imply launch readiness/i);
  assert.match(docs, /does not imply product readiness/i);
  assert.match(docs, /does not establish broad model quality/i);
  assert.match(docs, /does not establish multi-account corpus readiness/i);
}

describe("safety: controlled 2b-expanded usefulness approval packet", () => {
  it("authorizes only the bounded 2b-expanded corpus run after usefulness criteria are locked", () => {
    const docs = readRepoFile(EXPANDED_APPROVAL_PATH);

    assertExpandedApprovalContract(docs);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  it("pre-locks corpus selection, execution limits, and interpretation before execution", () => {
    const docs = readRepoFile(EXPANDED_APPROVAL_PATH);

    for (const required of [
      /corpus selection is frozen before execution/i,
      /post-run substitution is a validation failure/i,
      /one provider call per selected account/i,
      /providerName `openrouter`/i,
      /model `owl-alpha`/i,
      /approval through `atliera\.model_activation_approval\.v1`/i,
      /activation gates pass/i,
      /response contract/i,
      /cost ledger/i,
      /full-pipeline packaging/i,
      /bootstrap evidence verifier/i,
      /all useful/i,
      /weak-but-valid/i,
      /zero-output/i,
      /unsupported\/invented/i,
      /contract failure/i,
      /stop and repair/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  it("preserves provider portability and keeps model comparison separate", () => {
    const docs = readRepoFile(EXPANDED_APPROVAL_PATH);

    assert.match(docs, /provider portability/i);
    assert.match(docs, /OpenRouter lock-in/i);
    assert.match(docs, /Anthropic API/i);
    assert.match(docs, /OpenAI API/i);
    assert.match(docs, /direct provider APIs/i);
    assert.match(docs, /same `ModelProvider` boundary/i);
    assert.match(docs, /not require product-logic rewrites/i);
    assert.match(docs, /model-quality comparison[^\n]*out of scope/i);
    assert.match(docs, /future comparison run requires separate approval/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  it("is linked from the prior 2b runbook, usefulness contract, and transition strategy", () => {
    for (const path of [CONTROLLED_2B_RUNBOOK_PATH, USEFULNESS_CONTRACT_PATH, STRATEGY_PATH]) {
      const docs = readRepoFile(path);
      assert.match(docs, /controlled-2b-expanded-usefulness-validation\.md/i);
      assert.match(docs, /controlled 2b-expanded usefulness validation/i);
      assert.match(docs, /assessControlledCorpusUsefulness/i);
      assertNoPrivateEvidenceLeakage(docs);
      assertNoScopeContradictions(docs);
    }
  });
});
