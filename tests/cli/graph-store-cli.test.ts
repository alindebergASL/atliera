import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { spawn } from "node:child_process";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-graph-store-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/graph-store.ts", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => resolve({
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
}

describe("graph-store CLI", () => {
  test("load prints a validated bundle summary", async () => {
    const result = await runCli(["load", "fixtures/graph/valid/minimal-pass.json"]);

    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.command, "load");
    assert.equal(parsed.counts.sources, 1);
    assert.equal(parsed.counts.claims, 1);
    assert.equal(parsed.counts.graph_records, 9);
  });

  test("load invalid JSON exits 2", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "broken.json");
      await writeFile(path, "{bad", "utf8");

      const result = await runCli(["load", path]);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /failed to parse GraphBundle JSON/);
    });
  });

  test("save-copy writes through the file store when explicitly in model mode", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "copy.json");

      const result = await runCli([
        "save-copy",
        "fixtures/graph/valid/minimal-pass.json",
        output,
        "--mode",
        "model",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.command, "save-copy");
      assert.equal(parsed.counts.sources, 1);

      const saved = JSON.parse(await readFile(output, "utf8"));
      assert.equal(saved.sources.length, 1);
    });
  });

  test("save-copy refuses safe-mode writes", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "copy.json");

      const result = await runCli([
        "save-copy",
        "fixtures/graph/valid/minimal-pass.json",
        output,
        "--mode",
        "fixture",
      ]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /production writes are forbidden/);
    });
  });
});
