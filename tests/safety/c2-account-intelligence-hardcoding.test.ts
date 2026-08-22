import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = join(process.cwd(), "src", "account-intelligence");

async function files(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const result: string[] = [];
  for (const entry of entries) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) result.push(full);
  }
  return result;
}

test("generic C2 production paths contain no account, Utah, university, or scenario-specific logic", async () => {
  const productionFiles = await files(ROOT);
  assert.ok(productionFiles.length >= 6);
  for (const file of productionFiles) {
    const text = await readFile(file, "utf8");
    const name = relative(process.cwd(), file);
    assert.doesNotMatch(text, /University of Utah|Utah Health|\bUtah\b|\bFedEx\b|\$4\.94M|\$5M|4,?940,?000|5,?000,?000/iu, name);
    assert.doesNotMatch(text, /(?:if|switch)\s*\([^)]*(?:accountName|accountId|sector)[^)]*(?:university|higher education|health system)/iu, name);
  }
});

test("generic C2 core has no direct network, credentials, persistence, customer route, or provider SDK", async () => {
  for (const file of await files(ROOT)) {
    const text = await readFile(file, "utf8");
    const name = relative(process.cwd(), file);
    assert.doesNotMatch(text, /\bfetch\s*\(|node:https?|node:child_process|process\.env|OPENAI_API_KEY|OPENROUTER_API_KEY/iu, name);
    assert.doesNotMatch(text, /(?:graph|database|db)\.(?:save|write|insert|update)|createServer\s*\(|customer[-_ ]route/iu, name);
    assert.doesNotMatch(text, /from\s+["'](?:openai|@anthropic-ai|openrouter|@google\/generative-ai)/iu, name);
  }
});
