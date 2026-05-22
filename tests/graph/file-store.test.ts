import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { PathGuardError } from "../../src/io/path-guard.ts";
import {
  FileGraphStore,
  GraphFileParseError,
  GraphFileSchemaError,
  loadGraphBundleFile,
  saveGraphBundleFile,
} from "../../src/graph/file-store.ts";
import { ProductionWriteForbiddenError } from "../../src/modes/index.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-file-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("file-backed graph store", () => {
  test("loads a valid fixture JSON file", async () => {
    const bundle = await loadGraphBundleFile(
      "fixtures/graph/valid/minimal-pass.json",
    );

    assert.equal(bundle.sources.length, 1);
    assert.equal(bundle.claims.length, 1);
  });

  test("rejects invalid JSON before schema parsing", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "broken.json");
      await writeFile(path, "{not-json", "utf8");

      await assert.rejects(
        () => loadGraphBundleFile(path),
        GraphFileParseError,
      );
    });
  });

  test("rejects schema-invalid bundle before save", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "graph.json");
      const bundle = clone(makeValidBundle());
      bundle.excerpts[0]!.source_document_id = "src_missing_source";

      await assert.rejects(
        () => saveGraphBundleFile(path, bundle, { mode: "model", outputRoot: dir }),
        (e: unknown) => e instanceof GraphFileSchemaError &&
          e.report.hard_failures.some(
            (failure) => failure.code === "invented_source_document_id",
          ),
      );
    });
  });

  test("atomic save writes a valid bundle and leaves no temp file behind", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "nested", "graph.json");
      const bundle = makeValidBundle();

      const result = await saveGraphBundleFile(path, bundle, { mode: "model", outputRoot: dir });
      const loaded = await loadGraphBundleFile(path);
      const text = await readFile(path, "utf8");

      assert.equal(result.report?.ok, true);
      assert.equal(loaded.sources[0]?.id, bundle.sources[0]?.id);
      assert.ok(text.endsWith("\n"));
      assert.equal(text.includes('"sources"'), true);

      const parent = await import("node:fs/promises").then((fs) =>
        fs.readdir(join(dir, "nested")),
      );
      assert.deepEqual(parent, ["graph.json"]);
    });
  });

  test("refuses saves outside the explicit output root", async () => {
    await withTempDir(async (dir) => {
      const outputRoot = join(dir, "allowed");
      await mkdir(outputRoot);
      const outside = join(dir, "outside", "graph.json");

      await assert.rejects(
        () => saveGraphBundleFile(outside, makeValidBundle(), { mode: "model", outputRoot }),
        PathGuardError,
      );
    });
  });

  test("refuses overwriting existing output files by default", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "graph.json");
      await writeFile(path, "{}\n", "utf8");

      await assert.rejects(
        () => saveGraphBundleFile(path, makeValidBundle(), { mode: "model", outputRoot: dir }),
        (e: unknown) => e instanceof PathGuardError && /already exists/.test(e.message),
      );
    });
  });

  test("allows overwriting existing output files when explicitly requested", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "graph.json");
      await writeFile(path, "{}\n", "utf8");

      const result = await saveGraphBundleFile(path, makeValidBundle(), {
        mode: "model",
        outputRoot: dir,
        allowOverwrite: true,
      });

      assert.equal(result.path, path);
      const saved = JSON.parse(await readFile(path, "utf8"));
      assert.equal(saved.sources.length, 1);
    });
  });

  test("refuses file saves in validation/fixture/fake safe modes", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "graph.json");
      const bundle = makeValidBundle();

      for (const mode of ["validation", "fixture", "fake"] as const) {
        await assert.rejects(
          () => saveGraphBundleFile(path, bundle, { mode, outputRoot: dir }),
          ProductionWriteForbiddenError,
        );
      }
    });
  });

  test("FileGraphStore wraps the load/save helpers", async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, "graph.json");
      const store = new FileGraphStore(path);
      const bundle = makeValidBundle();

      await store.save(bundle, { mode: "model", outputRoot: dir });
      const loaded = await store.load();

      assert.equal(loaded.account_objects[0]?.id, bundle.account_objects[0]?.id);
    });
  });
});
