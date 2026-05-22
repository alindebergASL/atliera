// Static safety tests.
//
// These walk the `src/` tree and assert that no fixture/fake/default
// code path imports a provider SDK, reads an API key from the
// environment, or opens a network connection. The intent is to fail
// loudly the moment Phase 2+ work accidentally introduces an
// import-time side effect that violates the no-spend/no-network
// invariant.
//
// The patterns themselves are stored as character-fragment arrays so
// this test file does not itself match the patterns when scanned.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SRC_ROOT = join(REPO_ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

// Fragments are assembled at runtime so the literal forbidden strings
// never appear in this test file as exact substrings.
const PROVIDER_SDK_FRAGMENTS = [
  ["@anthropic-ai", "/sdk"],
  ["openai", ""],
  ["@google/generative", "-ai"],
  ["cohere-ai", ""],
  ["mistral", "ai"],
  ["@aws-sdk/client-bedrock", "-runtime"],
];

const API_KEY_FRAGMENTS = [
  ["process.env.ANTHROPIC", "_API_KEY"],
  ["process.env.OPENAI", "_API_KEY"],
  ["process.env.GOOGLE", "_API_KEY"],
  ["process.env.COHERE", "_API_KEY"],
];

const NETWORK_FRAGMENTS = [
  ["node:http", ""],
  ["node:https", ""],
  ["node-fetch", ""],
  ["undici", ""],
];

function joinFragments(pairs: string[][]): string[] {
  return pairs.map(([a, b]) => `${a}${b}`);
}

function findOffenders(
  files: string[],
  needles: string[],
): { file: string; needle: string }[] {
  const hits: { file: string; needle: string }[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) {
        hits.push({ file: relative(REPO_ROOT, file), needle });
      }
    }
  }
  return hits;
}

describe("safety: src/ contains no provider SDK imports, API key reads, or network deps", () => {
  const files = walk(SRC_ROOT);

  it("imports no provider SDK packages", () => {
    const hits = findOffenders(files, joinFragments(PROVIDER_SDK_FRAGMENTS));
    assert.deepEqual(
      hits,
      [],
      "found provider SDK references in src/: " + JSON.stringify(hits, null, 2),
    );
  });

  it("reads no provider API key env vars", () => {
    const hits = findOffenders(files, joinFragments(API_KEY_FRAGMENTS));
    assert.deepEqual(
      hits,
      [],
      "found API key env reads in src/: " + JSON.stringify(hits, null, 2),
    );
  });

  it("imports no node http/https/fetch network modules from default paths", () => {
    const hits = findOffenders(files, joinFragments(NETWORK_FRAGMENTS));
    assert.deepEqual(
      hits,
      [],
      "found network module references in src/: " + JSON.stringify(hits, null, 2),
    );
  });

  it("does not call global fetch() in default paths", () => {
    // Allow the *identifier* to appear in comments/docs, but flag the
    // call form `fetch(`. The CLI uses `readFile` instead.
    const hits = findOffenders(files, ["fetch("]);
    assert.deepEqual(
      hits,
      [],
      "found fetch() call sites in src/: " + JSON.stringify(hits, null, 2),
    );
  });
});
