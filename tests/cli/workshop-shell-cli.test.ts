import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

const SUBJECT_ARGS = [
  "--expected-team-id",
  "team_atliera_lab",
  "--expected-account-id",
  "acc_acme_robotics",
];

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-workshop-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/workshop-shell.ts", ...args], {
      cwd: process.cwd(),
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

describe("workshop-shell CLI", () => {
  test("writes a fixture Workshop shell HTML file under an explicit output root", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout) as { output_path: string };
      assert.equal(payload.output_path, join(outputRoot, "workshop", "acme.html"));
      const html = await readFile(payload.output_path, "utf8");
      assert.match(html, /Atliera Workshop/);
      assert.match(html, /Signals/);
      assert.match(html, /Reviewed · source-backed/);
      assert.doesNotMatch(html, />Verified</);
      assert.match(html, /Evidence/);
    });
  });

  test("defaults to a fake-mode preview label when no --preview-mode is given", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout) as { preview_mode: string; output_path: string };
      assert.equal(payload.preview_mode, "fake");
      const html = await readFile(payload.output_path, "utf8");
      assert.match(html, /Fake-mode preview/);
      assert.doesNotMatch(html, /Validation preview/);
    });
  });

  test("renders a non-production validation preview label with --preview-mode validation", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
        "--preview-mode",
        "validation",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout) as { preview_mode: string; output_path: string };
      assert.equal(payload.preview_mode, "validation");
      const html = await readFile(payload.output_path, "utf8");
      assert.match(html, /Validation preview \(non-production\)/);
      assert.doesNotMatch(html, /Fake-mode preview/);
      // Non-production boundaries are preserved regardless of preview mode.
      assert.match(html, /No provider calls/);
      assert.match(html, /No production writes/);
    });
  });

  test("rejects unknown --preview-mode values", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "--preview-mode",
        "production",
      ]);
      assert.equal(result.code, 2);
      assert.match(result.stderr, /invalid --preview-mode|fake or validation/i);
    });
  });

  test("rejects a missing --preview-mode value", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "--preview-mode",
      ]);
      assert.equal(result.code, 2);
      assert.match(result.stderr, /missing value for --preview-mode|usage:/i);
    });
  });

  test("rejects a duplicate --preview-mode flag", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "--preview-mode",
        "fake",
        "--preview-mode",
        "validation",
      ]);
      assert.equal(result.code, 2);
      assert.match(result.stderr, /duplicate/i);
    });
  });

  test("requires explicit --out-root and --out-file", async () => {
    const result = await runCli(["write", "fixtures/graph/valid/minimal-pass.json"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/i);
  });

  test("requires an explicit expected team and account subject", async () => {
    await withTempDir(async (outputRoot) => {
      const base = [
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ];
      const missingTeam = await runCli([
        ...base,
        "--expected-account-id",
        "acc_acme_robotics",
      ]);
      assert.equal(missingTeam.code, 2);
      assert.match(missingTeam.stderr, /missing --expected-team-id/i);

      const missingAccount = await runCli([
        ...base,
        "--expected-team-id",
        "team_atliera_lab",
      ]);
      assert.equal(missingAccount.code, 2);
      assert.match(missingAccount.stderr, /missing --expected-account-id/i);
    });
  });

  test("rejects a bundle outside the explicitly expected account", async () => {
    await withTempDir(async (outputRoot) => {
      const outputPath = join(outputRoot, "workshop", "other.html");
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/other.html",
        "--expected-team-id",
        "team_atliera_lab",
        "--expected-account-id",
        "acc_other",
      ]);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /Workshop graph validation failed/i);
      assert.match(result.stderr, /subject_scope_mismatch/i);
      await assert.rejects(() => readFile(outputPath, "utf8"));
    });
  });

  test("rejects duplicate flags and trailing positional arguments", async () => {
    await withTempDir(async (outputRoot) => {
      const duplicate = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ]);
      assert.equal(duplicate.code, 2);
      assert.match(duplicate.stderr, /duplicate/i);

      const trailing = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "extra",
      ]);
      assert.equal(trailing.code, 2);
      assert.match(trailing.stderr, /usage:|unexpected/i);
    });
  });

  test("rejects missing flag values and non-html outputs", async () => {
    await withTempDir(async (outputRoot) => {
      const missing = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
      ]);
      assert.equal(missing.code, 2);
      assert.match(missing.stderr, /missing|usage:/i);

      const nonHtml = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.txt",
        ...SUBJECT_ARGS,
      ]);
      assert.notEqual(nonHtml.code, 0);
      assert.match(nonHtml.stderr, /html/i);
    });
  });

  test("refuses absolute output files and traversal outside explicit output root", async () => {
    await withTempDir(async (outputRoot) => {
      const absolute = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        join(outputRoot, "absolute.html"),
        ...SUBJECT_ARGS,
      ]);
      assert.notEqual(absolute.code, 0);
      assert.match(absolute.stderr, /relative|absolute|path/i);

      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "../escape.html",
        ...SUBJECT_ARGS,
      ]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /outside output root|invalid output path|path/i);
    });
  });

  test("refuses overwrite through a dangling symlink escape", async () => {
    await withTempDir(async (outputRoot) => {
      const outside = await mkdtemp(join(tmpdir(), "atliera-workshop-outside-"));
      try {
        await mkdir(join(outputRoot, "workshop"), { recursive: true });
        const outsidePath = join(outside, "escape.html");
        await symlink(outsidePath, join(outputRoot, "workshop", "linked.html"));

        const result = await runCli([
          "write",
          "fixtures/graph/valid/minimal-pass.json",
          "--out-root",
          outputRoot,
          "--out-file",
          "workshop/linked.html",
          ...SUBJECT_ARGS,
          "--allow-overwrite",
        ]);

        assert.notEqual(result.code, 0);
        assert.match(result.stderr, /symlink|path/i);
        await assert.rejects(() => readFile(outsidePath, "utf8"));
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });

  test("refuses implicit overwrite", async () => {
    await withTempDir(async (outputRoot) => {
      await mkdir(join(outputRoot, "workshop"), { recursive: true });
      const first = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
      ]);
      assert.equal(first.code, 0, first.stderr);

      const second = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
      ]);
      assert.notEqual(second.code, 0);
      assert.match(second.stderr, /already exists|overwrite/i);

      const overwrite = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        ...SUBJECT_ARGS,
        "--allow-overwrite",
      ]);
      assert.equal(overwrite.code, 0, overwrite.stderr);
    });
  });
});
