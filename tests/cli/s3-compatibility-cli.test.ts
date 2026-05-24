import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-s3-compatibility-cli-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/s3-compatibility.ts", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("s3-compatibility CLI", () => {
  test("validates the filesystem-backed S3 compatibility client and emits a sanitized report", async () => {
    await withTempDir(async (rootDir) => {
      const result = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--prefix",
        "validation-prefix",
        "--probe-id",
        "cli-probe-1",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "validate-filesystem");
      assert.equal(payload.backend.adapter, "s3_compatible");
      assert.equal(payload.backend.client, "filesystem_s3_compatibility");
      assert.equal(payload.backend.emulator_limit, "filesystem-backed local emulator; not proof of provider-specific S3 behavior");
      assert.equal(payload.report.ok, true);
      assert.deepEqual(
        payload.report.checks.map((check: { name: string; status: string }) => [check.name, check.status]),
        [
          ["round_trip_text", "pass"],
          ["missing_object_returns_undefined", "pass"],
          ["overwrite_last_write_wins", "pass"],
          ["prefix_isolation", "pass"],
          ["max_payload_guard", "pass"],
        ],
      );
      assert.doesNotMatch(result.stdout, /atliera-validation-test|validation-prefix|secret|token|signed/i);
      await stat(join(rootDir, "buckets"));
    });
  });

  test("requires explicit root, bucket, and probe arguments", async () => {
    const result = await runCli(["validate-filesystem", "--bucket", "atliera-validation-test"]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/);
  });

  test("rejects duplicate flags and unsafe probe identifiers before writing objects", async () => {
    await withTempDir(async (rootDir) => {
      const duplicate = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--probe-id",
        "cli-probe-2",
      ]);
      assert.equal(duplicate.code, 2);
      assert.match(duplicate.stderr, /usage:/);

      const unsafeProbe = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--probe-id",
        "../prod",
      ]);
      assert.equal(unsafeProbe.code, 2);
      assert.match(unsafeProbe.stderr, /validation configuration rejected/);
      assert.doesNotMatch(unsafeProbe.stderr, /prod/);

      await assert.rejects(() => stat(join(rootDir, "buckets")), /ENOENT/);
    });
  });

  test("rejects unsafe bucket and prefix values without leaking them or writing objects", async () => {
    await withTempDir(async (rootDir) => {
      const invalidBucket = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "../secret-bucket",
        "--probe-id",
        "cli-probe-3",
      ]);
      assert.equal(invalidBucket.code, 2);
      assert.match(invalidBucket.stderr, /validation configuration rejected/);
      assert.doesNotMatch(invalidBucket.stderr, /secret-bucket/);

      const invalidPrefix = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--prefix",
        "../secret-prefix",
        "--probe-id",
        "cli-probe-4",
      ]);
      assert.equal(invalidPrefix.code, 2);
      assert.match(invalidPrefix.stderr, /validation configuration rejected/);
      assert.doesNotMatch(invalidPrefix.stderr, /secret-prefix/);

      await assert.rejects(() => stat(join(rootDir, "buckets")), /ENOENT/);
    });
  });
});
