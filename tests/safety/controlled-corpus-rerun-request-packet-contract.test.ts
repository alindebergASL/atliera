import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

describe("safety: controlled corpus rerun request packet contract", () => {
  const usefulness = "docs/runbooks/controlled-corpus-usefulness-validation.md";
  const expanded = "docs/runbooks/controlled-2b-expanded-usefulness-validation.md";
  const strategy = "docs/strategy/substrate-to-validation-transition.md";

  test("records the no-spend rerun request packet in the usefulness contract", () => {
    const doc = readRepoFile(usefulness);
    assert.match(doc, /controlled-corpus-rerun-request-packet\.ts/);
    assert.match(doc, /buildControlledCorpusRerunRequestPacket/);
    assert.match(doc, /no-spend request packet/i);
    assert.match(doc, /prompt schema version/i);
    assert.match(doc, /representative/i);
    assert.match(doc, /edge-case/i);
    assert.match(doc, /calibration/i);
    assert.match(doc, /requires a separate live-run approval/i);
  });

  test("records request packet before approval and execution in the 2b-expanded runbook", () => {
    const doc = readRepoFile(expanded);
    assert.match(doc, /request packet/i);
    assert.match(doc, /buildControlledCorpusRerunRequestPacket/);
    assert.match(doc, /does not authorize provider calls/i);
    assert.match(doc, /does not authorize provider spend/i);
    assert.match(doc, /separate approval packet/i);
  });

  test("records request packet as the next transition step before live rerun", () => {
    const doc = readRepoFile(strategy);
    assert.match(doc, /controlled corpus rerun request packet/i);
    assert.match(doc, /prompt\/proposal contract/i);
    assert.match(doc, /separate approval packet/i);
  });

  test("exports the rerun request packet helper from the package entry point", () => {
    const index = readRepoFile("src/index.ts");
    assert.match(index, /controlled-corpus-rerun-request-packet\.ts/);
  });

  test("does not broaden validation scope or claim readiness", () => {
    const combined = [usefulness, expanded, strategy].map(readRepoFile).join("\n---\n");
    const requiredBoundaries = [
      /does not authorize provider calls/i,
      /does not authorize provider spend/i,
      /does not approve comparison or expansion/i,
      /does not approve a rerun/i,
      /does not imply launch readiness/i,
      /does not imply product readiness/i,
    ];
    for (const boundary of requiredBoundaries) {
      assert.match(combined, boundary);
    }

    const forbiddenPositiveClaims = [
      /authorizes provider calls/i,
      /authorizes provider spend/i,
      /approves (?:another )?(?:live )?(?:provider )?rerun/i,
      /approves provider comparison/i,
      /approves corpus expansion/i,
      /implies launch readiness/i,
      /implies product readiness/i,
      /establishes broad model quality/i,
    ];
    for (const forbidden of forbiddenPositiveClaims) {
      assert.doesNotMatch(combined, forbidden);
    }
  });
});
