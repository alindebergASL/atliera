import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";

import {
  PathGuardError,
  guardOutputPath,
} from "../../src/io/path-guard.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-path-guard-"));
  try {
    return await fn(await realpath(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("guardOutputPath", () => {
  test("allows a new JSON file inside an explicit output root", async () => {
    await withTempDir(async (root) => {
      const result = await guardOutputPath({
        outputRoot: root,
        targetPath: join(root, "run", "graph.json"),
      });

      assert.equal(result.outputRoot, root);
      assert.equal(result.targetPath, resolve(root, "run", "graph.json"));
      assert.equal(result.targetDirectory, resolve(root, "run"));
    });
  });

  test("rejects path traversal outside output root", async () => {
    await withTempDir(async (root) => {
      await assert.rejects(
        () => guardOutputPath({
          outputRoot: root,
          targetPath: join(root, "..", "escape.json"),
        }),
        (e: unknown) => e instanceof PathGuardError && /outside output root/.test(e.message),
      );
    });
  });

  test("rejects writes through symlink escape", async () => {
    await withTempDir(async (root) => {
      const outside = await mkdtemp(join(tmpdir(), "atliera-path-outside-"));
      try {
        await symlink(outside, join(root, "escape"));
        await assert.rejects(
          () => guardOutputPath({
            outputRoot: root,
            targetPath: join(root, "escape", "graph.json"),
          }),
          (e: unknown) => e instanceof PathGuardError && /symlink escape|outside output root/.test(e.message),
        );
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    });
  });

  test("rejects existing files unless allowOverwrite is true", async () => {
    await withTempDir(async (root) => {
      const target = join(root, "graph.json");
      await writeFile(target, "{}\n", "utf8");

      await assert.rejects(
        () => guardOutputPath({ outputRoot: root, targetPath: target }),
        (e: unknown) => e instanceof PathGuardError && /already exists/.test(e.message),
      );

      const result = await guardOutputPath({
        outputRoot: root,
        targetPath: target,
        allowOverwrite: true,
      });
      assert.equal(result.targetPath, target);
    });
  });

  test("rejects writes into .git", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".git"));
      await assert.rejects(
        () => guardOutputPath({
          outputRoot: root,
          targetPath: join(root, ".git", "objects", "x"),
        }),
        (e: unknown) => e instanceof PathGuardError && /\.git/.test(e.message),
      );
    });
  });

  test("rejects writes into .git reached through an in-root symlink", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".git"));
      await symlink(join(root, ".git"), join(root, "git-link"));

      await assert.rejects(
        () => guardOutputPath({
          outputRoot: root,
          targetPath: join(root, "git-link", "objects", "x"),
        }),
        (e: unknown) => e instanceof PathGuardError && /\.git/.test(e.message),
      );
    });
  });

  test("rejects dangling target symlinks unless overwrite is explicit", async () => {
    await withTempDir(async (root) => {
      const target = join(root, "dangling.json");
      await symlink(join(root, "missing.json"), target);

      await assert.rejects(
        () => guardOutputPath({ outputRoot: root, targetPath: target }),
        (e: unknown) => e instanceof PathGuardError && /already exists/.test(e.message),
      );
    });
  });

  test("rejects writes into the repository working tree by default", async () => {
    const repoRoot = process.cwd();

    await assert.rejects(
      () => guardOutputPath({
        outputRoot: repoRoot,
        targetPath: join(repoRoot, ".tmp-path-guard-test", "graph.json"),
        repoRoot,
      }),
      (e: unknown) => e instanceof PathGuardError && /repository working tree/.test(e.message),
    );
  });

  test("rejects git-tracked files even when repo path rejection is disabled", async () => {
    const repoRoot = process.cwd();

    await assert.rejects(
      () => guardOutputPath({
        outputRoot: repoRoot,
        targetPath: join(repoRoot, "README.md"),
        repoRoot,
        rejectRepoPaths: false,
        allowOverwrite: true,
      }),
      (e: unknown) => e instanceof PathGuardError && /git-tracked/.test(e.message),
    );
  });

  test("allows an untracked repo path only when repo path rejection is disabled", async () => {
    const repoRoot = process.cwd();
    const targetDir = join(repoRoot, ".tmp-path-guard-test");
    try {
      const result = await guardOutputPath({
        outputRoot: repoRoot,
        targetPath: join(targetDir, "graph.json"),
        repoRoot,
        rejectRepoPaths: false,
      });

      assert.equal(result.targetPath, join(targetDir, "graph.json"));
    } finally {
      await rm(targetDir, { recursive: true, force: true });
    }
  });

  test("fails closed when git tracking status cannot be determined", async () => {
    await withTempDir(async (root) => {
      await assert.rejects(
        () => guardOutputPath({
          outputRoot: root,
          targetPath: join(root, "graph.json"),
          repoRoot: root,
          rejectRepoPaths: false,
        }),
        (e: unknown) => e instanceof PathGuardError && /git tracking status/.test(e.message),
      );
    });
  });
});
