import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-run-manifest-cli-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/run-manifest.ts", ...args], {
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

describe("run-manifest CLI", () => {
  test("writes a local manifest package for a valid fixture", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "cli-fixture-run",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "write");
      assert.equal(payload.manifest.quality_gate.status, "pass");
      assert.match(payload.manifest_path, /cli-fixture-run\/manifest\.json$/);

      const savedManifest = JSON.parse(await readFile(payload.manifest_path, "utf8"));
      assert.equal(savedManifest.run_slug, "cli-fixture-run");
      assert.equal(savedManifest.quality_gate.status, "pass");
    });
  });

  test("requires --out-root and --run-slug", async () => {
    const result = await runCli([
      "write",
      "fixtures/graph/valid/minimal-pass.json",
      "--mode",
      "model",
    ]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/);
  });

  test("refuses output outside the explicit root through unsafe slug", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "../escape",
      ]);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /run slug/);
    });
  });

  test("refuses safe-mode writes", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "fixture",
        "--out-root",
        outputRoot,
        "--run-slug",
        "safe-mode-run",
      ]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /production writes are forbidden/);
    });
  });

  test("rejects unexpected trailing positional arguments", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "strict-cli",
        "extra",
      ]);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /usage:/);
    });
  });

  test("rejects duplicate non-repeatable flags", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--mode",
        "fixture",
        "--out-root",
        outputRoot,
        "--run-slug",
        "duplicate-flags",
      ]);

      assert.equal(result.code, 2);
      assert.match(result.stderr, /usage:/);
    });
  });

  test("refuses existing manifest artifacts unless --allow-overwrite is present", async () => {
    await withTempDir(async (outputRoot) => {
      const first = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "overwrite-run",
      ]);
      assert.equal(first.code, 0, first.stderr);

      const second = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "overwrite-run",
      ]);
      assert.equal(second.code, 2);
      assert.match(second.stderr, /already exists/);

      const third = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "overwrite-run",
        "--allow-overwrite",
      ]);
      assert.equal(third.code, 0, third.stderr);
    });
  });

  test("cleans partial files if one manifest artifact is preblocked", async () => {
    await withTempDir(async (outputRoot) => {
      const runDir = join(outputRoot, "blocked-cli-run");
      await mkdir(runDir);
      await writeFile(join(runDir, "quality-gate-report.json"), "existing\n");

      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--mode",
        "model",
        "--out-root",
        outputRoot,
        "--run-slug",
        "blocked-cli-run",
      ]);

      assert.equal(result.code, 2);
      await assert.rejects(() => readFile(join(runDir, "graph-bundle.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(runDir, "manifest.json"), "utf8"), /ENOENT/);
    });
  });
});
