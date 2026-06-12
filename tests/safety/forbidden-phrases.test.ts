// ADR 0003 vocabulary enforcement: forbidden-phrase lint.
//
// The phrases below (assembled from fragments so this file does not
// match itself) describe model-invoked capability surfaces, which do
// not exist in Atliera and must not be normalized into existence
// through language drift. They must not appear in code, comments, or
// docs anywhere in the tree.
//
// ALLOWLIST POLICY (operator directive, 2026-06-12): the allowlist is
// fixed to exactly two paths — the direction memo and ADR 0003, the
// documents that define the list. ADDITIONS TO THE ALLOWLIST REQUIRE
// OPERATOR SIGN-OFF. Do not extend it in the same PR that introduces a
// new match; surface the conflict instead.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SELF = new URL(import.meta.url).pathname;

// Fixed two-path allowlist. Additions require operator sign-off.
const ALLOWLIST = new Set([
  "docs/strategy/mcp-and-skills-direction.md",
  "docs/adr/0003-system-capabilities-over-mcp-skills-as-instructions.md",
]);

const FORBIDDEN_PHRASE_FRAGMENTS: string[][] = [
  ["the agent's fetch", "er tool"],
  ["give the model acc", "ess to"],
  ["let the model c", "all"],
  ["the model's M", "CP"],
  ["skill exec", "ution"],
];

const SCANNED_EXTENSIONS = new Set([".ts", ".js", ".md", ".json", ".yml", ".yaml", ".txt"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

function joinFragments(pairs: string[][]): string[] {
  return pairs.map(([a, b]) => `${a}${b}`.toLowerCase());
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const dot = name.lastIndexOf(".");
      const ext = dot === -1 ? "" : name.slice(dot);
      if (SCANNED_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

describe("ADR 0003 vocabulary", () => {
  test("forbidden_phrases_absent_outside_fixed_allowlist", () => {
    const phrases = joinFragments(FORBIDDEN_PHRASE_FRAGMENTS);
    const files = walk(REPO_ROOT).filter((path) => {
      if (path === SELF) return false;
      return !ALLOWLIST.has(relative(REPO_ROOT, path));
    });

    const hits: { file: string; phrase: string }[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          hits.push({ file: relative(REPO_ROOT, file), phrase });
        }
      }
    }

    assert.deepEqual(
      hits,
      [],
      "forbidden phrases found outside the fixed allowlist (allowlist additions require operator sign-off): " +
        JSON.stringify(hits, null, 2),
    );
  });

  test("allowlist_remains_exactly_two_paths", () => {
    // The allowlist is part of the operator directive, not a convenience
    // knob. If this test fails, an allowlist edit happened without
    // updating the directive trail — get operator sign-off first.
    assert.deepEqual(
      [...ALLOWLIST].sort(),
      [
        "docs/adr/0003-system-capabilities-over-mcp-skills-as-instructions.md",
        "docs/strategy/mcp-and-skills-direction.md",
      ],
      "forbidden-phrase allowlist changed; operator sign-off required",
    );
  });
});
