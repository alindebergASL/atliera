import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const PROVIDER_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-model-provider-validation.md");
const EC2_BOOTSTRAP_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-ec2-bootstrap-validation.md");

const FULL_PIPELINE_MANIFEST_HASH = "cc9b26b50b12031368a9399fcdd9d949af90f8dd8e21c2b8628a9a9ff4b3eaab";

const FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS = [
  /\/home\//i,
  new RegExp("atliera-private-" + "provider-evidence", "i"),
  /run-evidence\.json/i,
  /approval[_ -]?ref\s*[:=]/i,
  /api[_ -]?key\s*[:=]/i,
  /credential[_ -]?name\s*[:=]/i,
  /raw provider response\s*[:=]/i,
  /raw prompt\s*[:=]/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  new RegExp("lab" + "\\d*" + "\\.atliera" + "\\.com", "i"),
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

function assertEc2BootstrapMilestone(docs: string): void {
  assert.match(docs, /EC2 bootstrap validation/i);
  assert.match(docs, /operator-approved lab EC2/i);
  assert.match(docs, /commit `?f862bbf/i);
  assert.match(docs, /npm ci/i);
  assert.match(docs, /npm run ci/i);
  assert.match(docs, /402 tests/i);
  assert.match(docs, /63 suites/i);
  assert.match(docs, /deterministic manifest hash/i);
  assert.match(docs, new RegExp(FULL_PIPELINE_MANIFEST_HASH));
  assert.match(docs, /no live provider call/i);
  assert.match(docs, /no network/i);
  assert.match(docs, /no credential read/i);
  assert.match(docs, /DNS name/i);
  assert.match(docs, /raw IP/i);
  assert.match(docs, /does not imply (?:production|launch) readiness/i);
}

function assertRepeatableEc2Procedure(docs: string): void {
  assert.match(docs, /fresh clone/i);
  assert.match(docs, /git rev-parse --short HEAD/i);
  assert.match(docs, /private evidence root/i);
  assert.match(docs, /--provider-report/i);
  assert.match(docs, /--out-root/i);
  assert.match(docs, /--run-slug/i);
  assert.match(docs, /--now/i);
  assert.match(docs, /--allow-overwrite/i);
  assert.match(docs, /sha256sum/i);
  assert.match(docs, /artifact paths are relative/i);
  assert.match(docs, /credential\/secret marker scan/i);
  assert.match(docs, /validation:bootstrap-evidence/i);
  assert.match(docs, /bootstrap_validation_evidence\.v1/i);
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

  it("records the clean EC2 bootstrap validation milestone in the transition document", () => {
    const strategy = readRepoFile(STRATEGY_PATH);

    assertEc2BootstrapMilestone(strategy);
    assertNoPrivateEvidenceLeakage(strategy);
  });

  it("keeps the EC2 bootstrap validation runbook repeatable and sanitized", () => {
    const runbook = readRepoFile(EC2_BOOTSTRAP_RUNBOOK_PATH);

    assertEc2BootstrapMilestone(runbook);
    assertRepeatableEc2Procedure(runbook);
    assertNoPrivateEvidenceLeakage(runbook);
  });
});
