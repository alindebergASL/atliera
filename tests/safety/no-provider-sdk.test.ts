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

describe("safety: src/ contains no provider SDK imports or API key reads and confines network deps", () => {
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

  it("confines outbound node http/https modules while admitting the reviewed C3 inbound loopback server", () => {
    const hits = findOffenders(files, joinFragments(NETWORK_FRAGMENTS));
    assert.deepEqual(
      hits,
      [
        { file: "src/c3/service.ts", needle: "node:http" },
        { file: "src/capability/m4-sec-live-adapter.ts", needle: "node:http" },
        { file: "src/capability/m4-sec-live-adapter.ts", needle: "node:https" },
      ],
      "network module references escaped the reviewed exact-target adapter: " + JSON.stringify(hits, null, 2),
    );
    const c3 = readFileSync(join(SRC_ROOT, "c3", "service.ts"), "utf8");
    assert.match(c3, /^import \{ createServer, type IncomingMessage, type Server, type ServerResponse \} from "node:http";$/m);
    assert.match(c3, /server\.listen\(options\.port \?\? 0, "127\.0\.0\.1"/);
    assert.doesNotMatch(c3, /\b(?:node:https|node:net|node:tls|node:dns|undici)\b/);
  });

  it("confines global fetch() to fixed same-origin C3 browser POST requests", () => {
    const hits = findOffenders(files, ["fetch("]);
    assert.deepEqual(
      hits,
      [{ file: "src/c3/render.ts", needle: "fetch(" }],
      "found fetch() call sites in src/: " + JSON.stringify(hits, null, 2),
    );
    const renderer = readFileSync(join(SRC_ROOT, "c3", "render.ts"), "utf8");
    assert.equal((renderer.match(/\bfetch\s*\(/g) ?? []).length, 1);
    assert.match(renderer, /fetch\(url, \{ method: 'POST'/);
    const endpoints = [...renderer.matchAll(/requestJson\('(\/api\/[a-z]+)'/g)].map((match) => match[1]);
    assert.deepEqual([...new Set(endpoints)].sort(), ["/api/cancel", "/api/generate", "/api/note", "/api/revise"]);
  });
});
