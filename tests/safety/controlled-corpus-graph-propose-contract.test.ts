import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("safety: controlled corpus graph.propose remediation contract", () => {
  test("records the no-spend graph.propose prompt contract in the usefulness contract", () => {
    const doc = readRepoFile("docs/runbooks/controlled-corpus-usefulness-validation.md");
    assert.match(doc, /controlled-corpus-graph-propose-contract\.ts/);
    assert.match(doc, /buildControlledCorpusGraphProposePromptContract/);
    assert.match(doc, /Return only strict JSON/);
    assert.match(doc, /excerpts/);
    assert.match(doc, /claims/);
    assert.match(doc, /account_objects/);
    assert.match(doc, /lens_summaries/);
    assert.match(doc, /does not authorize provider calls/);
    assert.match(doc, /does not authorize provider spend/);
    assert.match(doc, /does not approve comparison or expansion/);
  });

  test("records prompt contract remediation before another 2b-expanded rerun", () => {
    const doc = readRepoFile("docs/runbooks/controlled-2b-expanded-usefulness-validation.md");
    assert.match(doc, /controlled-corpus-graph-propose-contract\.ts/);
    assert.match(doc, /prompt\/proposal remediation/);
    assert.match(doc, /strict JSON/);
    assert.match(doc, /accepted account-object/);
    assert.match(doc, /Signals, Maps, or Plays/);
    assert.match(doc, /does not authorize provider calls/);
    assert.match(doc, /does not approve a rerun/);
  });

  test("records the prompt/proposal remediation step in the transition strategy", () => {
    const doc = readRepoFile("docs/strategy/substrate-to-validation-transition.md");
    assert.match(doc, /controlled-corpus-graph-propose-contract\.ts/);
    assert.match(doc, /prompt\/proposal contract remediation/);
    assert.match(doc, /before another live run/);
    assert.match(doc, /strict JSON/);
    assert.match(doc, /account_objects/);
    assert.match(doc, /lens_summaries/);
  });

  test("exports the graph.propose contract helper from the package entry point", () => {
    const index = readRepoFile("src/index.ts");
    assert.match(index, /controlled-corpus-graph-propose-contract\.ts/);
  });

  test("does not broaden validation scope or claim readiness", () => {
    const docs = [
      "docs/runbooks/controlled-corpus-usefulness-validation.md",
      "docs/runbooks/controlled-2b-expanded-usefulness-validation.md",
      "docs/strategy/substrate-to-validation-transition.md",
    ].map(readRepoFile).join("\n");

    const forbiddenPositiveClaims = [
      /authorizes provider calls/i,
      /authorizes provider spend/i,
      /approves (?:another )?(?:live )?(?:provider )?rerun/i,
      /approves provider comparison/i,
      /approves corpus expansion/i,
      /(?:proves|establishes|claims|approves) launch readiness/i,
      /(?:proves|establishes|claims|approves) product readiness/i,
      /(?:proves|establishes|claims|approves) broad model quality/i,
    ];
    for (const pattern of forbiddenPositiveClaims) {
      assert.doesNotMatch(docs, pattern);
    }
  });
});
