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

  test("backs up and restores a local durable DB using explicit file and target flags", async () => {
    await withTempDir(async (rootDir) => {
      const sourceRoot = join(rootDir, "source");
      const targetRoot = join(rootDir, "target");
      const backupFile = join(rootDir, "backup.json");
      await runCli(["init", "--root", sourceRoot, "--now", "2026-06-09T00:00:00.000Z"]);

      const backup = await runCli(["backup", "--root", sourceRoot, "--out", backupFile, "--now", "2026-06-09T00:02:00.000Z"]);
      assert.equal(backup.code, 0, backup.stderr);
      assert.equal(backup.stderr, "");
      const backupPayload = JSON.parse(backup.stdout) as Record<string, unknown>;
      assert.equal(backupPayload.command, "backup");
      assert.equal(backupPayload.ok, true);
      assert.equal(backupPayload.backupStatus, "created");
      assert.equal(backupPayload.providerCallsMade, 0);

      const restore = await runCli(["restore", "--backup", backupFile, "--target-root", targetRoot]);
      assert.equal(restore.code, 0, restore.stderr);
      assert.equal(restore.stderr, "");
      const restorePayload = JSON.parse(restore.stdout) as Record<string, unknown>;
      assert.equal(restorePayload.command, "restore");
      assert.equal(restorePayload.ok, true);
      assert.equal(restorePayload.restoreStatus, "restored");

      const inspect = await runCli(["inspect", "--root", targetRoot]);
      assert.equal(inspect.code, 0, inspect.stderr);
      assert.equal((JSON.parse(inspect.stdout) as Record<string, unknown>).databaseStatus, "initialized");
    });
  });

  test("restore refuses non-empty targets unless --allow-overwrite is explicit", async () => {
    await withTempDir(async (rootDir) => {
      const sourceRoot = join(rootDir, "source");
      const targetRoot = join(rootDir, "target");
      const backupFile = join(rootDir, "backup.json");
      await runCli(["init", "--root", sourceRoot, "--now", "2026-06-09T00:00:00.000Z"]);
      await runCli(["backup", "--root", sourceRoot, "--out", backupFile, "--now", "2026-06-09T00:02:00.000Z"]);
      await runCli(["init", "--root", targetRoot, "--now", "2026-06-09T00:03:00.000Z"]);

      const refused = await runCli(["restore", "--backup", backupFile, "--target-root", targetRoot]);
      assert.equal(refused.code, 3);
      assert.equal((JSON.parse(refused.stdout) as Record<string, unknown>).restoreStatus, "refused");

      const overwritten = await runCli(["restore", "--backup", backupFile, "--target-root", targetRoot, "--allow-overwrite"]);
      assert.equal(overwritten.code, 0, overwritten.stderr);
      assert.equal((JSON.parse(overwritten.stdout) as Record<string, unknown>).restoreStatus, "restored");
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
