// Asserts that legacy forbidden terms have not been introduced into
// Atliera source or docs. The Atliera repo is a clean-slate product —
// `brief_json` / `fromBriefJson` / `briefParity` / `dual-render` /
// `backfill` belong to the legacy account-research system and must not
// appear in this codebase except inside this assertion test itself.
//
// Forbidden terms are stored as fragment arrays so this file does not
// itself match them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SELF = new URL(import.meta.url).pathname;

const FORBIDDEN_FRAGMENTS: string[][] = [
  ["brief", "_json"],
  ["fromBrief", "Json"],
  ["brief", "Parity"],
  ["dual", "-render"],
  ["back", "fill"],
];

function joinFragments(pairs: string[][]): string[] {
  return pairs.map(([a, b]) => `${a}${b}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("safety: no legacy forbidden terms in Atliera", () => {
  it("no source or doc file contains brief_json / fromBriefJson / briefParity / dual-render / backfill", () => {
    const needles = joinFragments(FORBIDDEN_FRAGMENTS);
    const files = walk(REPO_ROOT).filter(
      (p) =>
        (p.endsWith(".ts") || p.endsWith(".md") || p.endsWith(".json")) &&
        // The assertion file itself, the ADR/architecture docs, the
        // legacy-comparison protocol, and the BLOCKERS doc explicitly
        // assert these terms' absence and so are allowed to mention
        // them.
        p !== SELF &&
        !p.endsWith("docs/adr/0001-atliera-fresh-system.md") &&
        !p.endsWith("docs/architecture/atliera-product-architecture.md") &&
        !p.endsWith("docs/architecture/provenance-and-validation.md") &&
        !p.endsWith("docs/qa/legacy-comparison-protocol.md") &&
        !p.endsWith("docs/BLOCKERS.md"),
    );

    const hits: { file: string; needle: string }[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const needle of needles) {
        if (text.includes(needle)) {
          hits.push({ file: relative(REPO_ROOT, file), needle });
        }
      }
    }
    assert.deepEqual(
      hits,
      [],
      "found legacy forbidden terms outside whitelist: " +
        JSON.stringify(hits, null, 2),
    );
  });
});
