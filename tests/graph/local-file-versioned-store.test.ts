import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { LocalFileVersionedGraphStore } from "../../src/graph/local-file-versioned-store.ts";
import { GraphStoreConflictError } from "../../src/graph/versioned-store.ts";
import { ProductionWriteForbiddenError } from "../../src/modes/index.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-local-versioned-store-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function graphPath(root: string, graphId: string): string {
  const name = createHash("sha256").update(graphId, "utf8").digest("hex");
  return join(root, "graphs", `${name}.json`);
}

describe("LocalFileVersionedGraphStore", () => {
  test("permits local-product only on this store and verifies its stored integrity digest on load", async () => {
    await withTempDir(async (root) => {
      const graphId = "teams/team_1/graphs/local_product";
      const store = new LocalFileVersionedGraphStore(root);
      const committed = await store.commit(graphId, makeValidBundle(), {
        mode: "local-product",
        expectedRevision: null,
      });
      const loaded = await store.load(graphId);
      const envelope = JSON.parse(await readFile(graphPath(root, graphId), "utf8"));

      assert.equal(committed.revision, "rev_1");
      assert.deepEqual(loaded, committed);
      assert.equal(envelope.schemaVersion, "2");
      assert.match(envelope.integritySha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(await readdir(join(root, "graphs")), [
        `${createHash("sha256").update(graphId, "utf8").digest("hex")}.json`,
      ]);
    });
  });

  test("preserves model-mode behavior and refuses safe or unknown modes", async () => {
    await withTempDir(async (root) => {
      const store = new LocalFileVersionedGraphStore(root);
      await store.commit("teams/team_1/graphs/model", makeValidBundle(), {
        mode: "model",
        expectedRevision: null,
      });
      for (const mode of ["fixture", "unknown-runtime-mode"] as const) {
        await assert.rejects(
          () => store.commit(`teams/team_1/graphs/${mode}`, makeValidBundle(), {
            mode: mode as never,
            expectedRevision: null,
          }),
          ProductionWriteForbiddenError,
        );
      }
    });
  });

  test("uses a graph-scoped single-attempt lock and does not remove a contended lock", async () => {
    await withTempDir(async (root) => {
      const graphId = "teams/team_1/graphs/locked";
      const path = graphPath(root, graphId);
      const lockPath = `${path}.lock`;
      await mkdir(join(root, "graphs"), { recursive: true });
      await writeFile(lockPath, "held\n", { flag: "wx" });

      await assert.rejects(
        () => new LocalFileVersionedGraphStore(root).commit(graphId, makeValidBundle(), {
          mode: "local-product",
          expectedRevision: null,
        }),
        /busy; zero retries performed/,
      );
      assert.equal(await readFile(lockPath, "utf8"), "held\n");
    });
  });

  test("arbitrates create and stale-revision conflicts across store instances", async () => {
    await withTempDir(async (root) => {
      const graphId = "teams/team_1/graphs/concurrent_writers";
      const firstStore = new LocalFileVersionedGraphStore(root);
      const secondStore = new LocalFileVersionedGraphStore(root);
      const first = await firstStore.commit(graphId, makeValidBundle(), {
        mode: "local-product",
        expectedRevision: null,
      });
      await assert.rejects(
        () => secondStore.commit(graphId, makeValidBundle(), {
          mode: "local-product",
          expectedRevision: null,
        }),
        GraphStoreConflictError,
      );

      const updated = clone(makeValidBundle());
      updated.account_objects[0]!.title = "new revision";
      await firstStore.commit(graphId, updated, {
        mode: "local-product",
        expectedRevision: first.revision,
      });
      await assert.rejects(
        () => secondStore.commit(graphId, makeValidBundle(), {
          mode: "local-product",
          expectedRevision: first.revision,
        }),
        (error: unknown) => error instanceof GraphStoreConflictError &&
          error.expectedRevision === "rev_1" &&
          error.actualRevision === "rev_2",
      );
    });
  });

  test("refuses malformed stored content", async () => {
    await withTempDir(async (root) => {
      const graphId = "teams/team_1/graphs/malformed";
      const store = new LocalFileVersionedGraphStore(root);
      await store.commit(graphId, makeValidBundle(), {
        mode: "local-product",
        expectedRevision: null,
      });
      await writeFile(graphPath(root, graphId), "{not-json\n");

      await assert.rejects(() => store.load(graphId), /contains invalid JSON/);
    });
  });

  test("refuses schema-valid bundle substitution when the canonical digest no longer matches", async () => {
    await withTempDir(async (root) => {
      const graphId = "teams/team_1/graphs/substituted";
      const store = new LocalFileVersionedGraphStore(root);
      await store.commit(graphId, makeValidBundle(), {
        mode: "local-product",
        expectedRevision: null,
      });
      const path = graphPath(root, graphId);
      const envelope = JSON.parse(await readFile(path, "utf8"));
      envelope.bundle.account_objects[0].title = "schema-valid substituted title";
      await writeFile(path, `${JSON.stringify(envelope, null, 2)}\n`);

      await assert.rejects(() => store.load(graphId), /integrity digest mismatch/);
    });
  });

  test("removes a synced temp file and lock after atomic replacement failure", async () => {
    class FailingReplaceStore extends LocalFileVersionedGraphStore {
      protected override async replaceGraphFile(): Promise<void> {
        throw new Error("synthetic replacement failure");
      }
    }

    await withTempDir(async (root) => {
      await assert.rejects(
        () => new FailingReplaceStore(root).commit("teams/team_1/graphs/failure", makeValidBundle(), {
          mode: "local-product",
          expectedRevision: null,
        }),
        /synthetic replacement failure/,
      );
      assert.deepEqual(await readdir(join(root, "graphs")), []);
    });
  });
});
