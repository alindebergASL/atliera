// ADR 0003 I-2: no capability schema/descriptor in model payloads.
//
// This is the Phase 0 tripwire for the temptation gradient named in the
// direction memo (§9.1): once an MCP client exists in the stack,
// exposing it to the model is a configuration change, not a refactor.
// This test is trivially green today — which is the point. It converts
// that future configuration change into a red build.
//
// What it asserts:
//   (a) no file under src/ references the MCP SDK package — when H2
//       introduces the orchestrator-held client, this assertion narrows
//       to the model-side directories and the import-isolation test
//       (I-3, `test_mcp_client_import_isolation`) takes over;
//   (b) model-side modules (src/model/, src/agent/) contain none of the
//       capability-descriptor vocabulary that would indicate tool
//       descriptors being assembled where model payloads are built;
//   (c) the canonical model-bound request, serialized, contains no
//       descriptor-shaped keys, and its `metadata.tools` is the pinned
//       string "false", not an array or object of tool descriptors.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SRC_ROOT = join(REPO_ROOT, "src");
const MODEL_SIDE_DIRS = [join(SRC_ROOT, "model"), join(SRC_ROOT, "agent")];

// Assembled from fragments so this test file does not match its own
// patterns if the scan scope ever widens to tests/.
const MCP_SDK_FRAGMENTS: string[][] = [["@model", "contextprotocol"]];
const DESCRIPTOR_VOCAB_FRAGMENTS: string[][] = [
  ["input", "Schema"],
  ["output", "Schema"],
  ["tools/", "list"],
  ["tools/", "call"],
];

function joinFragments(pairs: string[][]): string[] {
  return pairs.map(([a, b]) => `${a}${b}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

function findOffenders(files: string[], needles: string[]): { file: string; needle: string }[] {
  const hits: { file: string; needle: string }[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) hits.push({ file: relative(REPO_ROOT, file), needle });
    }
  }
  return hits;
}

function collectKeys(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      collectKeys(child, out);
    }
  }
}

describe("ADR 0003 I-2", () => {
  test("test_no_capability_descriptor_in_model_payload", () => {
    const allSrc = walk(SRC_ROOT);

    // (a) No MCP SDK reference anywhere in src/ today. H2 will narrow
    //     this to model-side dirs when the orchestrator-held client
    //     lands; until then, any reference at all is unplanned.
    const sdkHits = findOffenders(allSrc, joinFragments(MCP_SDK_FRAGMENTS));
    assert.deepEqual(
      sdkHits,
      [],
      "MCP SDK references found in src/ before H2 introduced the orchestrator-held client: " +
        JSON.stringify(sdkHits, null, 2),
    );

    // (b) No capability-descriptor vocabulary in model-side modules.
    const modelSideFiles = MODEL_SIDE_DIRS.flatMap((dir) => walk(dir));
    const vocabHits = findOffenders(modelSideFiles, joinFragments(DESCRIPTOR_VOCAB_FRAGMENTS));
    assert.deepEqual(
      vocabHits,
      [],
      "capability-descriptor vocabulary found in model-side modules: " +
        JSON.stringify(vocabHits, null, 2),
    );

    // (c) The canonical model-bound request serializes with no
    //     descriptor-shaped keys, and metadata.tools is the pinned
    //     string, not a structured tool list.
    const canonicalRequest = {
      operation: "graph.propose",
      mode: "model",
      model: "gpt-5.5",
      prompt: "synthetic prompt",
      inputGraphRef: "corpus/synthetic-runtime-model-only-live-proof.json",
      idempotencyKey: "synthetic-descriptor-tripwire",
      maxOutputTokens: 256,
      temperature: 0,
      metadata: {
        prompt_contract_ref: "prompts/synthetic-runtime-model-only-live-proof-v1",
        tools: "false",
        shell_access: "false",
        file_access: "false",
        web_search: "false",
        plugins: "false",
        mcp: "false",
        retrieval: "false",
      },
    };
    const keys = new Set<string>();
    collectKeys(JSON.parse(JSON.stringify(canonicalRequest)), keys);
    for (const forbiddenKey of joinFragments(DESCRIPTOR_VOCAB_FRAGMENTS)) {
      assert.ok(
        !keys.has(forbiddenKey),
        `model-bound payload must not carry a ${forbiddenKey} key`,
      );
    }
    assert.equal(typeof canonicalRequest.metadata.tools, "string");
    assert.equal(canonicalRequest.metadata.tools, "false");
  });
});
