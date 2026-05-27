import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const PROVIDER_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-model-provider-validation.md");

const FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS = [
  /\/home\//i,
  new RegExp("atliera-private-" + "provider-evidence", "i"),
  /run-evidence\.json/i,
  /approval[_ -]?ref\s*[:=]/i,
  /api[_ -]?key\s*[:=]/i,
  /credential[_ -]?name\s*[:=]/i,
  /raw provider response\s*[:=]/i,
  /raw prompt\s*[:=]/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertSanitizedStatus(docs: string): void {
  assert.match(docs, /first provider-boundary validation/i);
  assert.match(docs, /OpenRouter/i);
  assert.match(docs, /owl-alpha/i);
  assert.match(docs, /graph\.propose/i);
  assert.match(docs, /commit `?6e67b11/i);
  assert.match(docs, /activation gates/i);
  assert.match(docs, /credential status/i);
  assert.match(docs, /provider call/i);
  assert.match(docs, /response contract/i);
  assert.match(docs, /cost ledger/i);
  assert.match(docs, /observed cost[^.\n]*\$0/i);
  assert.match(docs, /private evidence/i);
  assert.match(docs, /outside (?:the )?repository/i);
  assert.match(docs, /not .*launch readiness|does not imply launch readiness/i);
  assert.match(docs, /not .*product readiness|does not imply product readiness/i);
}

function assertNoPrivateEvidenceLeakage(docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

describe("safety: first provider validation status docs", () => {
  it("records the first provider-boundary validation status in the strategy document", () => {
    const strategy = readRepoFile(STRATEGY_PATH);

    assertSanitizedStatus(strategy);
    assertNoPrivateEvidenceLeakage(strategy);
  });

  it("records sanitized provider validation evidence status in the lab runbook", () => {
    const runbook = readRepoFile(PROVIDER_RUNBOOK_PATH);

    assertSanitizedStatus(runbook);
    assertNoPrivateEvidenceLeakage(runbook);
  });
});
