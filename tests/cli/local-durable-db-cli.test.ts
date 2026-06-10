import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-local-db-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/local-durable-db.ts", ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("local durable DB CLI", () => {
  test("initializes and inspects a local durable DB using machine-readable stdout only", async () => {
    await withTempDir(async (rootDir) => {
      const init = await runCli(["init", "--root", rootDir, "--now", "2026-06-09T00:00:00.000Z"]);
      assert.equal(init.code, 0, init.stderr);
      assert.equal(init.stderr, "");
      const initPayload = JSON.parse(init.stdout) as Record<string, unknown>;
      assert.equal(initPayload.ok, true);
      assert.equal(initPayload.command, "init");
      assert.equal(initPayload.databaseStatus, "initialized");
      assert.deepEqual(initPayload.migrationsApplied, ["001_local_durable_boot"]);
      assert.equal(initPayload.providerCallsMade, 0);
      assert.equal(initPayload.productionWrites, false);
      assert.equal(initPayload.platformLockIn, false);

      const inspect = await runCli(["inspect", "--root", rootDir]);
      assert.equal(inspect.code, 0, inspect.stderr);
      assert.equal(inspect.stderr, "");
      const inspectPayload = JSON.parse(inspect.stdout) as Record<string, unknown>;
      assert.equal(inspectPayload.ok, true);
      assert.equal(inspectPayload.command, "inspect");
      assert.equal(inspectPayload.databaseStatus, "initialized");

      const manifestText = await readFile(join(rootDir, "atliera-local-db.json"), "utf8");
      assert.match(manifestText, /atliera-local-durable-db/);
    });
  });

  test("rejects missing root and unknown flags before touching storage", async () => {
    const missing = await runCli(["init"]);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /missing --root|usage:/i);

    const unknown = await runCli(["inspect", "--root", "tmp", "--output", "file"]);
    assert.equal(unknown.code, 2);
    assert.match(unknown.stderr, /unknown flag|usage:/i);
  });
});
