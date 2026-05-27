import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-live-provider-validation.md");
const PROVIDER_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-model-provider-validation.md");
const ARCHITECTURE_PATH = join(REPO_ROOT, "docs", "architecture", "durable-adapter-contracts.md");

const FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS = [
  /\/home\//i,
  new RegExp("atliera-private-" + "provider-evidence", "i"),
  /run-evidence\.json/i,
  /api[_ -]?key\s*[:=]/i,
  /credential[_ -]?name\s*[:=]/i,
  /raw provider response\s*[:=]/i,
  /raw prompt\s*[:=]/i,
  /approval[_ -]?ref\s*[:=]/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  new RegExp("lab" + "\\d*" + "\\.atliera" + "\\.com", "i"),
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

const FORBIDDEN_SCOPE_EXPANSION_PATTERNS = [
  /paid fallback (?:is )?allowed/i,
  /multi-account (?:run|validation|corpus) (?:is )?approved/i,
  /production writes? (?:is|are )?allowed/i,
  /runtime\/model-mode integration (?:is )?approved/i,
  /launch readiness (?:is )?(?:proven|claimed|approved)/i,
  /product readiness (?:is )?(?:proven|claimed|approved)/i,
];

function assertNoPrivateEvidenceLeakage(docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_EVIDENCE_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

function assertNoScopeExpansionContradictions(docs: string): void {
  for (const pattern of FORBIDDEN_SCOPE_EXPANSION_PATTERNS) {
    assert.doesNotMatch(docs, pattern);
  }
}

describe("safety: controlled 2b live-provider approval packet", () => {
  it("pins the first 2b run to OpenRouter owl-alpha with one tiny approved scope", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /controlled 2b live-provider validation/i);
    assert.match(docs, /OpenRouter/i);
    assert.match(docs, /owl-alpha/i);
    assert.match(docs, /free-tier/i);
    assert.match(docs, /one representative account/i);
    assert.match(docs, /single provider call/i);
    assert.match(docs, /graph\.propose/i);
    assert.match(docs, /max run cost[^\n]*\$0\.10/i);
    assert.match(docs, /expected observed provider cost[^\n]*\$0\.00/i);
    assert.match(docs, /cumulative 2b cap[^\n]*\$1\.00/i);
    assert.match(docs, /no paid fallback/i);
    assert.match(docs, /approval through `atliera\.model_activation_approval\.v1`/i);
    assert.match(docs, /external-corpus\/controlled-2b/i);
    assert.match(docs, /private evidence/i);
    assert.match(docs, /outside (?:the )?repository/i);
    assert.match(docs, /does not imply launch readiness/i);
    assert.match(docs, /does not imply product readiness/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("locks success criteria and failure-mode interpretation before the run", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    for (const required of [
      /activation gates pass/i,
      /provider call completes/i,
      /response contract/i,
      /cost ledger/i,
      /full-pipeline/i,
      /bootstrap evidence verifier/i,
      /sanitized summary/i,
      /Provider integration failure/i,
      /Output quality failure/i,
      /Validation pipeline failure/i,
      /Evidence packaging failure/i,
      /post-run decision tree/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("keeps model-quality comparison and product runtime wiring out of the first 2b run", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /model quality comparison[^\n]*out of scope/i);
    assert.match(docs, /Anthropic[^\n]*out of scope/i);
    assert.match(docs, /GPT-5\.5[^\n]*out of scope/i);
    assert.match(docs, /no production writes/i);
    assert.match(docs, /no runtime\/model-mode integration/i);
    assert.match(docs, /no broad corpus expansion/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("documents owl-alpha as a deliberate non-lock-in provider-neutral first run", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /provider neutrality/i);
    assert.match(docs, /OpenRouter[^\n]*abstraction layer/i);
    assert.match(docs, /1M token context window/i);
    assert.match(docs, /not establish a production default/i);
    assert.match(docs, /not establish[^\n]*quality preference/i);
    assert.match(docs, /not establish[^\n]*provider commitment/i);
    assert.match(docs, /not establish[^\n]*launch model/i);
    assert.match(docs, /model flexibility/i);
    assert.match(docs, /Claude Sonnet through OpenRouter/i);
    assert.match(docs, /GPT-5\.5 through OpenRouter/i);
    assert.match(docs, /each future comparison run requires separate approval/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("records OpenRouter-specific operational failure modes before execution", () => {
    const docs = readRepoFile(APPROVAL_PATH);

    assert.match(docs, /OpenRouter outage/i);
    assert.match(docs, /OpenRouter rate limit/i);
    assert.match(docs, /routing layer/i);
    assert.match(docs, /free-tier/i);
    assert.match(docs, /operational failure/i);
    assertNoPrivateEvidenceLeakage(docs);
    assertNoScopeExpansionContradictions(docs);
  });

  it("preserves provider-neutral architecture beyond the runbook", () => {
    const architecture = readRepoFile(ARCHITECTURE_PATH);

    assert.match(architecture, /provider-neutral/i);
    assert.match(architecture, /ModelProvider/i);
    assert.match(architecture, /provider selection is a configuration choice/i);
    assert.match(architecture, /not an architectural commitment/i);
    assert.match(architecture, /OpenRouter/i);
    assert.match(architecture, /direct provider/i);
    assert.match(architecture, /SDK-neutral/i);
    assertNoPrivateEvidenceLeakage(architecture);
    assertNoScopeExpansionContradictions(architecture);
  });

  it("links the controlled 2b packet from the provider validation runbook", () => {
    const runbook = readRepoFile(PROVIDER_RUNBOOK_PATH);

    assert.match(runbook, /controlled-2b-live-provider-validation\.md/i);
    assert.match(runbook, /controlled 2b live-provider validation/i);
    assertNoPrivateEvidenceLeakage(runbook);
    assertNoScopeExpansionContradictions(runbook);
  });
});
