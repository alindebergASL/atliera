import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-rerun-approval.md");
const EXPANDED_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
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
  /paid fallback (?:is )?(?:allowed|approved|authorized)/i,
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

describe("safety: controlled 2b-expanded rerun approval packet", () => {
  test("authorizes exactly one bounded rerun after no-spend request packet review", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /controlled 2b-expanded rerun approval/i);
    assert.match(docs, /Status: pre-run docs-only approval packet/i);
    assert.match(docs, /authorizes exactly one bounded controlled 2b-expanded rerun/i);
    assert.match(docs, /This PR does not execute the run/i);
    assert.match(docs, /buildControlledCorpusRerunRequestPacket\(\.\.\.\)/i);
    assert.match(docs, /PR #99's `src\/agent\/controlled-corpus-graph-propose-contract\.ts`/i);
    assert.match(docs, /PR #100's `src\/validation\/controlled-corpus-rerun-request-packet\.ts`/i);
    assert.match(docs, /controlled_corpus_rerun_request_packet\.v1/i);
    assert.match(docs, /controlled_corpus_graph_propose_prompt\.v1/i);
    assert.match(docs, /approves_live_provider_call: false/i);
    assert.match(docs, /requires_separate_live_run_approval: true/i);
    assert.match(docs, /atliera\.model_activation_approval\.v1/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  test("pre-locks provider route, corpus roles, cost bounds, and request parameters", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    for (const required of [
      /provider route: OpenRouter/i,
      /public model id: `owl-alpha`/i,
      /provider tier: free-tier/i,
      /operation: `graph\.propose`/i,
      /exactly one provider call per selected role/i,
      /selected role count: exactly three roles/i,
      /selected roles: representative, edge-case, calibration/i,
      /external-corpus\/controlled-2b-expanded-rerun\//i,
      /maximum output tokens per account: no more than 700/i,
      /temperature: 0/i,
      /max run cost[^\n]*\$0\.50/i,
      /expected observed provider cost[^\n]*\$0\.00/i,
      /no paid fallback/i,
      /Post-output substitution is a validation failure/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  test("keeps execution and interpretation bounded to sanitized follow-up status", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    for (const required of [
      /Activation gates must pass/i,
      /response contract/i,
      /sanitized provider-validation evidence privately/i,
      /deterministic full-pipeline helper/i,
      /bootstrap evidence verifier/i,
      /assessControlledCorpusUsefulness\(\.\.\.\)/i,
      /No post-validation rereads/i,
      /all three accounts are useful/i,
      /weak-but-valid/i,
      /zero-output/i,
      /unsupported\/invented/i,
      /contract failure/i,
      /observed token counts and observed cost/i,
      /no readiness or broad-quality claim/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  test("preserves provider portability and excludes comparison or expansion", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /provider portability/i);
    assert.match(docs, /not OpenRouter lock-in/i);
    assert.match(docs, /not an `owl-alpha` quality conclusion/i);
    assert.match(docs, /Anthropic API/i);
    assert.match(docs, /OpenAI API/i);
    assert.match(docs, /same `ModelProvider` boundary/i);
    assert.match(docs, /does not allow:[\s\S]*provider or model comparison/i);
    assert.match(docs, /does not allow:[\s\S]*corpus expansion/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeContradictions(docs);
  });

  test("is linked from the existing validation docs and transition strategy", () => {
    for (const path of [EXPANDED_RUNBOOK_PATH, USEFULNESS_CONTRACT_PATH, STRATEGY_PATH]) {
      const docs = readRepoFile(path);
      assert.match(docs, /controlled-2b-expanded-rerun-approval\.md/i);
      assert.match(docs, /controlled 2b-expanded rerun approval/i);
      assertNoPrivateEvidenceLeakage(docs);
      assertNoScopeContradictions(docs);
    }
  });
});
