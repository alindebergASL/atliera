import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-rerun-status.md");
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-rerun-approval.md");
const EXPANDED_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
const USEFULNESS_CONTRACT_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-corpus-usefulness-validation.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
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

function assertNoPositiveReadinessOrQualityClaim(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /multi-account corpus readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

test("safety: controlled 2b-expanded rerun sanitized status", async (t) => {
  await t.test("records the bounded execution facts without approval contents or private evidence", () => {
    const docs = readRepoFile(STATUS_PATH);
    assert.match(docs, /sanitized execution follow-up/i);
    assert.match(docs, /approval PR was docs-only and did not execute the run/i);
    assert.match(docs, /commit `66a8b6f`/i);
    assert.match(docs, /OpenRouter `owl-alpha`/i);
    assert.match(docs, /`graph\.propose`/i);
    assert.match(docs, /controlled_corpus_graph_propose_prompt\.v1/i);
    assert.match(docs, /controlled_corpus_rerun_request_packet\.v1/i);
    assert.match(docs, /atliera\.model_activation_approval\.v1` was present outside the repository/i);
    assert.match(docs, /external-corpus\/controlled-2b-expanded-rerun\//i);
    assert.match(docs, /selected role count: exactly three roles/i);
    assert.match(docs, /selected roles: representative, edge-case, calibration/i);
    assert.match(docs, /one provider call per selected role/i);
    assert.match(docs, /temperature: 0/i);
    assert.match(docs, /maximum output tokens per account: 700/i);
    assert.match(docs, /observed provider cost: \$0\.00/i);
    assert.match(docs, /estimated ledger cost: \$0\.03/i);
    assert.match(docs, /total input tokens: 2381/i);
    assert.match(docs, /total output tokens: 1122/i);
    assert.match(docs, /production writes: none/i);
    assert.match(docs, /runtime\/model-mode integration: none/i);
    assertNoPrivateLeakage("status doc", docs);
  });

  await t.test("records per-role validation chain and usefulness classification without readiness", () => {
    const docs = readRepoFile(STATUS_PATH);
    for (const required of [
      /activation gates/i,
      /credential status/i,
      /provider call/i,
      /response contract/i,
      /cost ledger/i,
      /full-pipeline packaging/i,
      /bootstrap evidence verifier/i,
      /useful overall/i,
      /useful 3/i,
      /weak-but-valid 0/i,
      /zero-output 0/i,
      /unsupported\/invented 0/i,
      /contract failure 0/i,
      /launch_readiness_claim: false/i,
      /useful tiny-corpus signal/i,
    ]) {
      assert.match(docs, required);
    }
    assert.match(docs, /does not imply launch readiness/i);
    assert.match(docs, /does not imply product readiness/i);
    assert.match(docs, /does not establish production readiness/i);
    assert.match(docs, /does not establish broad model quality/i);
    assert.match(docs, /does not establish multi-account corpus readiness/i);
    assert.match(docs, /not OpenRouter lock-in/i);
    assert.match(docs, /not an `owl-alpha` quality conclusion/i);
    assertNoPositiveReadinessOrQualityClaim("status doc", docs);
  });

  await t.test("links the sanitized status from every durable validation document independently", () => {
    const docs = [
      ["approval", APPROVAL_PATH],
      ["expanded runbook", EXPANDED_RUNBOOK_PATH],
      ["usefulness contract", USEFULNESS_CONTRACT_PATH],
      ["strategy", STRATEGY_PATH],
    ] as const;
    for (const [label, path] of docs) {
      const text = readRepoFile(path);
      assert.match(text, /controlled-2b-expanded-rerun-status\.md/i, `${label} must link status doc`);
      assert.match(text, /useful(?: tiny-corpus)? (?:validation )?signal/i, `${label} must preserve narrow useful-signal interpretation`);
      assert.match(text, /launch_readiness_claim: false|does not imply launch readiness|no-readiness/i, `${label} must preserve no-readiness boundary`);
      assert.match(text, /runtime\/model-mode integration/i, `${label} must preserve runtime boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoPositiveReadinessOrQualityClaim(label, text);
    }
  });
});
