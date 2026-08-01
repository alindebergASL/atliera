import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, test } from "node:test";

import {
  unlinkCreatedRegularFileIfIdentityMatchesBestEffort,
  writeExclusiveArtifactSet,
} from "../../scripts/lib/exclusive-artifact-set-writer.mts";

const ROOT = join(import.meta.dirname, "..", "..");
const ACTIVE_GENERATORS = [
  "scripts/generate-m5b-fedex-system-acquired-prewrite.mts",
  "scripts/generate-m5b-fedex-gate-b-synthetic-prewrite.mts",
] as const;

describe("M5b frozen generator destinations", () => {
  test("an occupied destination preserves its bytes and prevents every missing sibling write", async () => {
    const root = await mkdtemp(join(tmpdir(), "atliera-m5b-exclusive-writer-"));
    try {
      for (let occupiedIndex = 0; occupiedIndex < 3; occupiedIndex += 1) {
        const caseRoot = join(root, `occupied-${occupiedIndex}`);
        await mkdir(caseRoot);
        const paths = [join(caseRoot, "first.json"), join(caseRoot, "middle.json"), join(caseRoot, "last.html")];
        await writeFile(paths[occupiedIndex]!, "frozen sentinel bytes\n", { flag: "wx" });

        await assert.rejects(
          () => writeExclusiveArtifactSet([
            { path: paths[0]!, data: "new first\n" },
            { path: paths[1]!, data: "new middle\n" },
            { path: paths[2]!, data: "new last\n" },
          ]),
          /destination already exists/i,
        );

        assert.equal(await readFile(paths[occupiedIndex]!, "utf8"), "frozen sentinel bytes\n");
        assert.deepEqual(await readdir(caseRoot), [basename(paths[occupiedIndex]!)]);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("both active generators use the exclusive set writer and never direct-write", async () => {
    for (const relativePath of ACTIVE_GENERATORS) {
      const source = await readFile(join(ROOT, relativePath), "utf8");
      assert.match(source, /writeExclusiveArtifactSet/);
      assert.doesNotMatch(source, /\bwriteFile\b/);
    }
    const helper = await readFile(join(ROOT, "scripts/lib/exclusive-artifact-set-writer.mts"), "utf8");
    assert.match(helper, /open\(path, "wx"\)/);
  });

  test("identity-guard cleanup removes only the matching created path", async () => {
    const root = await mkdtemp(join(tmpdir(), "atliera-m5b-identity-cleanup-"));
    try {
      const matchingPath = join(root, "matching.json");
      await writeFile(matchingPath, "created bytes\n", { flag: "wx" });
      const matchingStats = await lstat(matchingPath, { bigint: true });

      await unlinkCreatedRegularFileIfIdentityMatchesBestEffort({
        path: matchingPath,
        dev: matchingStats.dev,
        ino: matchingStats.ino,
      });
      await assert.rejects(() => lstat(matchingPath), { code: "ENOENT" });

      const replacedPath = join(root, "replaced.json");
      const displacedPath = join(root, "displaced-created.json");
      await writeFile(replacedPath, "created bytes\n", { flag: "wx" });
      const createdStats = await lstat(replacedPath, { bigint: true });
      await rename(replacedPath, displacedPath);
      await writeFile(replacedPath, "concurrent replacement bytes\n", { flag: "wx" });

      await unlinkCreatedRegularFileIfIdentityMatchesBestEffort({
        path: replacedPath,
        dev: createdStats.dev,
        ino: createdStats.ino,
      });
      assert.equal(await readFile(replacedPath, "utf8"), "concurrent replacement bytes\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
