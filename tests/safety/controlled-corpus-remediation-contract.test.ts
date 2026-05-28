import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const USEFULNESS_CONTRACT_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-corpus-usefulness-validation.md");
const EXPANDED_RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "controlled-2b-expanded-usefulness-validation.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const INDEX_PATH = join(REPO_ROOT, "src", "index.ts");

const FORBIDDEN_REMEDIATION_OVERCLAIMS = [
  /\bremediation[^\n.]+(?:approves?|authorizes?|allows?)[^\n.]+(?:live provider|provider call|spend|comparison|expansion|rerun)/i,
  /\bremediation[^\n.]+(?:proves?|establishes?|claims?)[^\n.]+(?:launch readiness|product readiness|production readiness|broad model quality|multi-account corpus readiness)/i,
  /\b(?:prompt|proposal|rubric|evidence policy)[^\n.]+(?:fix|revision)[^\n.]+(?:approves?|authorizes?|allows?)[^\n.]+(?:live provider|comparison|expansion|readiness)/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoRemediationOverclaims(docs: string): void {
  for (const pattern of FORBIDDEN_REMEDIATION_OVERCLAIMS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    for (const match of docs.matchAll(globalPattern)) {
      const index = match.index ?? 0;
      const prefix = docs.slice(Math.max(0, index - 160), index).toLowerCase();
      const matchText = match[0].toLowerCase();
      const isNegated =
        /(?:does not|do not|must not|not|without|no)\s*$/.test(prefix) ||
        /\bdoes not\b|\bdo not\b|\bmust not\b|\bnot\b|\bwithout\b|\bno\b/.test(matchText);

      assert.ok(isNegated, `forbidden remediation overclaim matched: ${match[0]}`);
    }
  }
}

function assertRemediationContract(docs: string): void {
  assert.match(docs, /controlled corpus weakness remediation/i);
  assert.match(docs, /src\/validation\/controlled-corpus-remediation-plan\.ts/i);
  assert.match(docs, /planControlledCorpusWeaknessRemediation\(\.\.\.\)/i);
  assert.match(docs, /no-spend/i);
  assert.match(docs, /already-produced/i);
  assert.match(docs, /prompt_contract/i);
  assert.match(docs, /proposal_schema/i);
  assert.match(docs, /evidence_policy/i);
  assert.match(docs, /rubric_thresholds/i);
  assert.match(docs, /fixture_coverage/i);
  assert.match(docs, /substrate_contract/i);
  assert.match(docs, /no_spend_prompt_contract_revision/i);
  assert.match(docs, /proposal_schema_revision/i);
  assert.match(docs, /rubric_clarification/i);
  assert.match(docs, /evidence_policy_clarification/i);
  assert.match(docs, /deterministic_fixture_update/i);
  assert.match(docs, /fix_hard_substrate_or_contract_blocker/i);
  assert.match(docs, /live_provider_rerun/i);
  assert.match(docs, /provider_comparison/i);
  assert.match(docs, /corpus_expansion/i);
  assert.match(docs, /approves_live_provider_call: false/i);
  assert.match(docs, /approves_provider_spend: false/i);
  assert.match(docs, /approves_expansion_or_comparison: false/i);
  assert.match(docs, /launch_readiness_claim: false/i);
}

describe("safety: controlled corpus remediation plan contract", () => {
  it("records the no-spend remediation plan helper in the usefulness contract", () => {
    const docs = readRepoFile(USEFULNESS_CONTRACT_PATH);

    assertRemediationContract(docs);
    assertNoRemediationOverclaims(docs);
  });

  it("records remediation-before-rerun in the 2b-expanded runbook", () => {
    const docs = readRepoFile(EXPANDED_RUNBOOK_PATH);

    assertRemediationContract(docs);
    assert.match(docs, /before another live run/i);
    assert.match(docs, /before comparison or expansion/i);
    assertNoRemediationOverclaims(docs);
  });

  it("records remediation-before-rerun in the transition strategy", () => {
    const docs = readRepoFile(STRATEGY_PATH);

    assertRemediationContract(docs);
    assert.match(docs, /before another live run/i);
    assert.match(docs, /before comparison or expansion/i);
    assertNoRemediationOverclaims(docs);
  });

  it("exports the remediation helper from the package entry point", () => {
    const index = readRepoFile(INDEX_PATH);

    assert.match(index, /controlled-corpus-remediation-plan\.ts/);
  });
});
