import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-runtime-workshop-preview-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/runtime-workshop-preview.ts", ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
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

describe("runtime-workshop-preview CLI", () => {
  test("prints a sanitized fake-mode runtime Workshop preview report without writing files", async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, "empty"));

      const result = await runCli(["report", "fixtures/graph/valid/minimal-pass.json"]);

      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      const payload = JSON.parse(result.stdout) as Record<string, unknown>;
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "report");
      assert.equal(payload.kind, "runtime-workshop-preview-cli");
      assert.equal(payload.environment, "test");
      assert.equal(payload.modelProvider, "fake");
      assert.equal(payload.htmlRendered, true);
      assert.equal(typeof payload.htmlLength, "number");
      assert.ok((payload.htmlLength as number) > 100);
      assert.equal(payload.graphSnapshotRead, true);
      assert.equal(payload.serverStarted, false);
      assert.equal(payload.clientsConstructed, false);
      assert.equal(payload.providerCallsMade, 0);
      assert.equal(payload.productionWrites, false);
      assert.equal(Object.hasOwn(payload, "runtime"), false);
      assert.equal(Object.hasOwn(payload, "html"), false);
      assert.equal(Object.hasOwn(payload, "output_path"), false);
      assert.deepEqual(await readdir(join(dir, "empty")), []);
    });
  });

  test("prints Workshop HTML to stdout only after the fake-mode runtime preview succeeds", async () => {
    const result = await runCli(["html", "fixtures/graph/valid/minimal-pass.json"]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /<!doctype html>/i);
    assert.match(result.stdout, /Atliera Workshop/);
    assert.match(result.stdout, /data-lens="signals"/);
    assert.doesNotMatch(result.stdout, /"runtime"/);
    assert.doesNotMatch(result.stdout, /output_path/);
  });

  test("uses deterministic fake-mode config rather than process.env provider settings", async () => {
    const result = await runCli(["report", "fixtures/graph/valid/minimal-pass.json"], {
      env: {
        ATL_ENV: "production",
        MODEL_PROVIDER: "real-provider",
        DATABASE_URL: "postgres://example.invalid/db",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(payload.environment, "test");
    assert.equal(payload.modelProvider, "fake");
    assert.equal(payload.providerCallsMade, 0);
    assert.equal(payload.productionWrites, false);
  });

  test("rejects missing inputs, unknown commands, and unexpected flags", async () => {
    const missing = await runCli(["report"]);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /missing bundle\.json|usage:/i);

    const unknownCommand = await runCli(["write", "fixtures/graph/valid/minimal-pass.json"]);
    assert.equal(unknownCommand.code, 2);
    assert.match(unknownCommand.stderr, /usage:/i);

    const leadingFlag = await runCli(["report", "--out-file"]);
    assert.equal(leadingFlag.code, 2);
    assert.match(leadingFlag.stderr, /unknown flag|usage:/i);

    const unknownFlag = await runCli(["report", "fixtures/graph/valid/minimal-pass.json", "--out-file", "preview.html"]);
    assert.equal(unknownFlag.code, 2);
    assert.match(unknownFlag.stderr, /unknown flag|usage:/i);
  });
});
