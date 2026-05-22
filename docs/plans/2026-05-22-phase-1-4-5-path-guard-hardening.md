# Phase 1.4.5 Path-Guard Hardening Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Harden Atliera's local file-write seam before the run artifact manifest layer writes multiple files.

**Architecture:** Add a small `src/io/path-guard.ts` utility that constrains writes to an explicit output root, rejects repo/source-control hazards, rejects symlink/path traversal escapes, and controls overwrite behavior. Wire `saveGraphBundleFile` and the graph-store CLI through the guard while keeping Phase 1 deterministic, local-only, no-provider, no-network, and no-DB.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Node test runner, `tsx`, existing Atliera Graph/file-store modules.

---

## Why this PR exists

Opus review of PRs #1-#6 found the schema, validators, per-bundle quality gate, and representative fixture corpus sound enough for the next stage. The one load-bearing gap is file path discipline.

Current Phase 1.4 file store is safe as a local development utility:

- mode-gated writes
- validation before save
- atomic temp-file + rename
- no network, provider, DB, or UI work

But it does not yet provide legacy PR #45-style path-guard discipline:

- it can overwrite arbitrary existing files
- it does not prevent writes inside the repo working tree
- it does not reject tracked files
- it does not restrict writes to an explicit artifact/output root
- it does not defend against symlink/path traversal escapes

Phase 1.5 run manifests will write multiple files per run. Harden the single-file store first so every later writer inherits the same discipline.

## Scope

In scope:

- Add `src/io/path-guard.ts`.
- Add focused path-guard tests.
- Wire `saveGraphBundleFile` through the path guard.
- Update `graph-store save-copy` CLI to require an explicit output root.
- Add tests for CLI output-root behavior.
- Update README docs.

Out of scope:

- No run manifest implementation.
- No provider/model/API calls.
- No database.
- No app runtime integration.
- No migrations.
- No production deploy.
- No generic arbitrary file writer beyond the graph bundle file store.

## Desired safety policy

A guarded write must satisfy all of the following:

1. Caller provides an explicit `outputRoot`.
2. Destination path resolves inside `outputRoot`.
3. Destination path is not inside the repository working tree by default.
4. Destination path is not inside `.git`.
5. Destination path is not a git-tracked file.
6. Existing output file is refused unless `allowOverwrite: true`.
7. Parent directories are created only inside the guarded output root.
8. Existing symlinks in the destination path cannot escape `outputRoot`.
9. Error messages name the violated guard clearly enough for a user/operator to fix the command.

Design note: rejecting repo writes by default is stricter than simply rejecting tracked files. For Phase 1, run artifacts should go to `/tmp`, a configured artifact directory, or another explicit out-of-repo root. If a future workflow needs generated fixtures committed to the repo, that should be a separate intentional fixture-authoring command, not the runtime store path.

---

## Task 1: Add RED tests for the path guard

**Objective:** Specify the path-guard contract before implementation.

**Files:**

- Create: `tests/io/path-guard.test.ts`
- Later create: `src/io/path-guard.ts`

**Step 1: Write failing tests**

Create `tests/io/path-guard.test.ts` with tests for these cases:

```ts
import assert from "node:assert/strict";
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
    });
  });

  test("rejects path traversal outside output root", async () => {
    await withTempDir(async (root) => {
      await assert.rejects(
        guardOutputPath({ outputRoot: root, targetPath: join(root, "..", "escape.json") }),
        (e) => e instanceof PathGuardError && /outside output root/.test(e.message),
      );
    });
  });

  test("rejects writes through symlink escape", async () => {
    await withTempDir(async (root) => {
      const outside = await mkdtemp(join(tmpdir(), "atliera-path-outside-"));
      try {
        await symlink(outside, join(root, "escape"));
        await assert.rejects(
          guardOutputPath({ outputRoot: root, targetPath: join(root, "escape", "graph.json") }),
          (e) => e instanceof PathGuardError && /symlink escape|outside output root/.test(e.message),
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
        guardOutputPath({ outputRoot: root, targetPath: target }),
        (e) => e instanceof PathGuardError && /already exists/.test(e.message),
      );
      const result = await guardOutputPath({ outputRoot: root, targetPath: target, allowOverwrite: true });
      assert.equal(result.targetPath, target);
    });
  });

  test("rejects writes into .git", async () => {
    await withTempDir(async (root) => {
      await mkdir(join(root, ".git"));
      await assert.rejects(
        guardOutputPath({ outputRoot: root, targetPath: join(root, ".git", "objects", "x") }),
        (e) => e instanceof PathGuardError && /\.git/.test(e.message),
      );
    });
  });
});
```

Add repo-specific tests only after Task 2 defines the API for repo detection.

**Step 2: Run RED test**

Run:

```bash
node --import tsx --test tests/io/path-guard.test.ts
```

Expected:

- FAIL because `src/io/path-guard.ts` does not exist.

---

## Task 2: Implement `src/io/path-guard.ts`

**Objective:** Add the minimal utility needed to pass Task 1 tests.

**Files:**

- Create: `src/io/path-guard.ts`

**Implementation requirements:**

Export:

```ts
export class PathGuardError extends Error {}

export interface GuardOutputPathOptions {
  outputRoot: string;
  targetPath: string;
  allowOverwrite?: boolean;
  rejectRepoPaths?: boolean;
  repoRoot?: string | null;
}

export interface GuardedOutputPath {
  outputRoot: string;
  targetPath: string;
  targetDirectory: string;
}

export async function guardOutputPath(options: GuardOutputPathOptions): Promise<GuardedOutputPath>;
```

Implementation guidance:

- Use `resolve()` and `relative()` to check lexical containment.
- Use `realpath()` for existing output root.
- For a target whose file does not exist yet, realpath the deepest existing parent directory.
- Reject if the real target parent escapes output root.
- Reject any path segment equal to `.git`.
- Reject existing file unless `allowOverwrite: true`.
- Use a helper like `isInside(parent, child)` where `relative(parent, child)` must not start with `..` and must not be absolute.
- Keep this module deterministic and local-only: no network, provider, DB, env-var reads, or model calls.

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/io/path-guard.test.ts
npm run typecheck
```

Expected:

- path-guard tests pass
- typecheck passes

---

## Task 3: Add repo/tracked-file protection tests

**Objective:** Specify the repo-specific guard behavior before wiring it into file-store writes.

**Files:**

- Modify: `tests/io/path-guard.test.ts`
- Modify: `src/io/path-guard.ts`

**Tests to add:**

1. Reject target inside the current git repo by default.

Use repo root from `process.cwd()` in tests. Create a target like:

```ts
const repoRoot = process.cwd();
await assert.rejects(
  guardOutputPath({
    outputRoot: repoRoot,
    targetPath: join(repoRoot, "tmp", "graph.json"),
    repoRoot,
  }),
  /repository working tree/,
);
```

2. Allow repo path only when explicitly opted out, but still reject tracked files.

```ts
const repoRoot = process.cwd();
await assert.rejects(
  guardOutputPath({
    outputRoot: repoRoot,
    targetPath: join(repoRoot, "README.md"),
    repoRoot,
    rejectRepoPaths: false,
    allowOverwrite: true,
  }),
  /git-tracked/,
);
```

3. Allow an untracked path inside repo only with `rejectRepoPaths: false` and within output root.

Use a temp path under `repoRoot/.tmp-path-guard-test/graph.json`; clean it up after test.

**Implementation guidance:**

- Implement a helper that calls git only when `repoRoot` is provided and the target is inside repoRoot.
- Prefer `git -C <repoRoot> ls-files --error-unmatch -- <path>` or `git -C <repoRoot> ls-files -- <path>` via `node:child_process` promisified `execFile`.
- Do not shell interpolate paths.
- Treat git command failure for non-tracked file as not tracked.
- If `rejectRepoPaths !== false` and target is inside repo root, reject before tracked-file check.
- Always reject tracked files even if `rejectRepoPaths: false`.

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/io/path-guard.test.ts
npm run typecheck
```

Expected:

- all path-guard tests pass
- typecheck passes

---

## Task 4: Wire file-store saves through the guard

**Objective:** Make graph bundle saves inherit the guarded output-root policy.

**Files:**

- Modify: `src/graph/file-store.ts`
- Modify: `tests/graph/file-store.test.ts`

**API change:**

Extend `SaveGraphBundleFileOptions`:

```ts
export type SaveGraphBundleFileOptions = {
  mode: RuntimeMode;
  validate?: boolean;
  outputRoot: string;
  allowOverwrite?: boolean;
  rejectRepoPaths?: boolean;
  repoRoot?: string | null;
};
```

Inside `saveGraphBundleFile`, after `assertProductionWriteAllowed(options.mode)` and before validation/write:

```ts
const guarded = await guardOutputPath({
  outputRoot: options.outputRoot,
  targetPath: path,
  allowOverwrite: options.allowOverwrite,
  rejectRepoPaths: options.rejectRepoPaths,
  repoRoot: options.repoRoot,
});
const resolved = guarded.targetPath;
const directory = guarded.targetDirectory;
```

Keep validation-before-save.

**Test updates:**

- Existing atomic-save tests should use a temp dir as `outputRoot`.
- Add test that save outside `outputRoot` rejects with `PathGuardError`.
- Add test that overwrite rejects by default.
- Add test that overwrite succeeds with `allowOverwrite: true`.
- Keep safe-mode write refusal tests; they should still fail before path-guard write occurs.

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/graph/file-store.test.ts
npm run typecheck
```

Expected:

- file-store tests pass
- typecheck passes

---

## Task 5: Update graph-store CLI for explicit output root

**Objective:** Prevent CLI save-copy from writing arbitrary paths.

**Files:**

- Modify: `src/cli/graph-store.ts`
- Modify: `tests/cli/graph-store-cli.test.ts`
- Modify: `package.json`
- Modify: `README.md`

**CLI contract:**

Change save-copy usage from:

```bash
npm run graph:save-copy -- <input.json> <output.json> --mode model
```

to:

```bash
npm run graph:save-copy -- <input.json> <output.json> --mode model --out-root /tmp/atliera-output
```

Optional flags:

```bash
--allow-overwrite
```

Do not expose `rejectRepoPaths: false` through the public CLI in Phase 1. If tests need it, call the library directly.

**Test updates:**

- CLI save-copy without `--out-root` exits `2` with usage.
- CLI save-copy with output outside root exits nonzero and mentions outside output root.
- CLI save-copy with output inside root succeeds.
- CLI save-copy with existing output fails unless `--allow-overwrite` is present.
- CLI save-copy with `--mode fixture` still fails due production-write guard.

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/cli/graph-store-cli.test.ts
npm run typecheck
```

Expected:

- CLI tests pass
- typecheck passes

---

## Task 6: Documentation and verification

**Objective:** Document the hardening and prove the repo remains no-spend/no-network.

**Files:**

- Modify: `README.md`
- Optional: Modify `docs/adr/0002-phase1-edges.md` with a short note that future relationship needs should add typed edge records through review, not payload-only relationships. Only do this if it is missing and can be done in 1-2 paragraphs.

**README additions:**

- File-backed graph store now requires explicit output root for saves.
- Example:

```bash
mkdir -p /tmp/atliera-graph-output
npm run graph:save-copy -- fixtures/graph/valid/minimal-pass.json /tmp/atliera-graph-output/copy.json --mode model --out-root /tmp/atliera-graph-output
```

- Explain that repo writes/tracked-file overwrites are intentionally rejected by default.

**Full verification:**

Run:

```bash
npm run ci
node --import tsx --test tests/io/path-guard.test.ts
node --import tsx --test tests/graph/file-store.test.ts
node --import tsx --test tests/cli/graph-store-cli.test.ts
npm run graph:load -- fixtures/graph/valid/minimal-pass.json
mkdir -p /tmp/atliera-graph-output
npm run graph:save-copy -- fixtures/graph/valid/minimal-pass.json /tmp/atliera-graph-output/copy.json --mode model --out-root /tmp/atliera-graph-output
git diff --check
```

Safety greps:

```bash
if grep -RInE "from ['\"](@anthropic-ai|openai|ai|langchain|@ai-sdk)" src tests; then exit 1; fi
if grep -RInE "ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY" src tests; then exit 1; fi
if grep -RInE "from ['\"](node:https|node:http|https|http)['\"]" src tests; then exit 1; fi
if grep -RIn "fetch(" src tests; then exit 1; fi
```

Expected:

- full CI passes
- targeted tests pass
- CLI smoke passes
- no provider/network/env-key greps match
- working tree clean after commit

---

## PR checklist

PR title:

```text
feat(io): add guarded output path discipline
```

PR body must include:

- Summary of path-guard policy.
- Explicit note that this is Phase 1.4.5 hardening before Phase 1.5 run manifests.
- Verification commands and results.
- Safety-grep results.
- Caveat: no manifest layer included yet.

## Acceptance criteria

- `src/io/path-guard.ts` exists and is tested.
- File-store save requires `outputRoot`.
- CLI save-copy requires `--out-root`.
- Existing tracked files cannot be overwritten through guarded save.
- Repo writes are rejected by default.
- Path traversal and symlink escape are rejected.
- Existing output overwrite requires explicit `allowOverwrite` / `--allow-overwrite`.
- No provider/network/DB behavior added.

## Follow-up after merge

After this PR is merged, proceed to Phase 1.5 run artifact manifest layer. The manifest implementation should route every file write through the guarded file-store/path-guard path and should not invent a parallel writer.
