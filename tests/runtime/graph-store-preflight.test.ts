import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import {
  GraphStoreConflictError,
  InMemoryVersionedGraphStore,
  type VersionedGraphCommitOptions,
  type VersionedGraphSnapshot,
} from "../../src/graph/versioned-store.ts";
import { defineGraphStorePreflightCheck } from "../../src/runtime/graph-store-preflight.ts";
import { runResourcePreflight } from "../../src/runtime/resource-preflight.ts";
import { makeValidBundle, clone } from "../fixtures/valid-graph.ts";

class RecordingVersionedGraphStore extends InMemoryVersionedGraphStore {
  readonly commits: Array<{ graphId: string; options: VersionedGraphCommitOptions }> = [];
  readonly loads: string[] = [];

  override async commit(
    graphId: string,
    bundle: Parameters<InMemoryVersionedGraphStore["commit"]>[1],
    options: VersionedGraphCommitOptions,
  ): Promise<VersionedGraphSnapshot> {
    this.commits.push({ graphId, options });
    return super.commit(graphId, bundle, options);
  }

  override async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    this.loads.push(graphId);
    return super.load(graphId);
  }
}

class FailingVersionedGraphStore extends InMemoryVersionedGraphStore {
  constructor(private readonly failureMode: "commit" | "load") {
    super();
  }

  override async commit(
    graphId: string,
    bundle: Parameters<InMemoryVersionedGraphStore["commit"]>[1],
    options: VersionedGraphCommitOptions,
  ): Promise<VersionedGraphSnapshot> {
    if (this.failureMode === "commit") {
      throw new Error("postgres://secret-db.internal/atliera failed with token abc123");
    }
    return super.commit(graphId, bundle, options);
  }

  override async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    if (this.failureMode === "load") {
      throw new Error("https://db.example.invalid/private-graph");
    }
    return super.load(graphId);
  }
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectKeys);
  }

  if (value !== null && typeof value === "object") {
    const reordered: Record<string, unknown> = {};
    for (const key of Object.keys(value).reverse()) {
      reordered[key] = reverseObjectKeys((value as Record<string, unknown>)[key]);
    }
    return reordered;
  }

  return value;
}

describe("graph store resource preflight", () => {
  it("defines a database check that commits and loads a caller-scoped graph probe", async () => {
    const store = new RecordingVersionedGraphStore();
    const probeBundle = makeValidBundle();
    const check = defineGraphStorePreflightCheck({
      store,
      graphId: "preflight/run-123/graph-store",
      bundle: probeBundle,
      mode: "model",
    });

    assert.equal(check.target, "database");
    assert.equal(check.name, "graph store commit load probe");

    const result = await check.run();

    assert.deepEqual(result, {
      status: "pass",
      code: "graph_store_reachable",
      message: "graph store commit load probe passed",
      metadata: { adapter: "graph_store", probe: "commit_load" },
    });
    assert.equal(store.commits.length, 1);
    assert.equal(store.loads.length, 1);
    assert.equal(store.commits[0]?.graphId, "preflight/run-123/graph-store");
    assert.equal(store.loads[0], "preflight/run-123/graph-store");
    assert.deepEqual(store.commits[0]?.options, {
      expectedRevision: null,
      mode: "model",
    });
  });

  it("integrates with production-like resource preflight without constructing clients itself", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      defineGraphStorePreflightCheck({
        store: new InMemoryVersionedGraphStore(),
        graphId: "preflight/staging-123/graph-store",
        bundle: makeValidBundle(),
        mode: "model",
      }),
      { target: "artifact_store", name: "artifact store probe", run: () => ({ status: "pass", code: "reachable", message: "ok" }) },
      { target: "queue_backend", name: "queue enqueue probe", run: () => ({ status: "pass", code: "enqueueable", message: "ok" }) },
      { target: "model_provider", name: "model credential probe", run: () => ({ status: "pass", code: "credentials_present", message: "ok" }) },
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
    assert.deepEqual(
      report.checks.map((check) => [check.target, check.code, check.status]),
      [
        ["database", "graph_store_reachable", "pass"],
        ["artifact_store", "reachable", "pass"],
        ["queue_backend", "enqueueable", "pass"],
        ["model_provider", "credentials_present", "pass"],
      ],
    );
  });

  it("rejects unsafe graph probe ids before touching the graph store", async () => {
    const store = new RecordingVersionedGraphStore();

    for (const graphId of [
      "../private",
      "localhost/team-1",
      "db.internal/team-1",
      "graph.example.invalid/team-1",
      "127.0.0.1/team-1",
      "s3://bucket/team-1",
    ]) {
      assert.throws(
        () => defineGraphStorePreflightCheck({
          store,
          graphId,
          bundle: makeValidBundle(),
          mode: "model",
        }),
        /graph id/,
      );
    }
    assert.equal(store.commits.length, 0);
    assert.equal(store.loads.length, 0);
  });

  it("returns sanitized failures when the graph store commit or load fails", async () => {
    for (const failureMode of ["commit", "load"] as const) {
      const check = defineGraphStorePreflightCheck({
        store: new FailingVersionedGraphStore(failureMode),
        graphId: `preflight/${failureMode}/graph-store`,
        bundle: makeValidBundle(),
        mode: "model",
      });

      const result = await check.run();

      assert.equal(result.status, "fail");
      assert.equal(result.code, "graph_store_unreachable");
      assert.equal(result.message, "graph store commit load probe failed");
      assert.deepEqual(result.metadata, { adapter: "graph_store", probe: "commit_load" });
      assert.doesNotMatch(JSON.stringify(result), /abc123|secret-db|private-graph|postgres:\/\/|https:\/\//i);
    }
  });

  it("fails when read-back revision or graph content does not match the committed probe", async () => {
    class MismatchedVersionedGraphStore extends InMemoryVersionedGraphStore {
      override async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
        const record = await super.load(graphId);
        if (record === undefined) {
          return undefined;
        }
        return {
          ...record,
          revision: record.revision === "rev_1" ? "rev_2" : "rev_1",
        };
      }
    }

    const check = defineGraphStorePreflightCheck({
      store: new MismatchedVersionedGraphStore(),
      graphId: "preflight/mismatch/graph-store",
      bundle: makeValidBundle(),
      mode: "model",
    });

    const result = await check.run();

    assert.deepEqual(result, {
      status: "fail",
      code: "graph_store_mismatch",
      message: "graph store commit load probe returned mismatched graph state",
      metadata: { adapter: "graph_store", probe: "commit_load" },
    });
  });

  it("passes when the loaded graph bundle is semantically equal with reordered object keys", async () => {
    class ReorderingVersionedGraphStore extends InMemoryVersionedGraphStore {
      override async commit(
        graphId: string,
        bundle: Parameters<InMemoryVersionedGraphStore["commit"]>[1],
        options: VersionedGraphCommitOptions,
      ): Promise<VersionedGraphSnapshot> {
        const snapshot = await super.commit(graphId, bundle, options);
        return { ...snapshot, bundle: reverseObjectKeys(snapshot.bundle) as typeof snapshot.bundle };
      }

      override async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
        const snapshot = await super.load(graphId);
        if (snapshot === undefined) {
          return undefined;
        }
        return { ...snapshot, bundle: reverseObjectKeys(snapshot.bundle) as typeof snapshot.bundle };
      }
    }

    const check = defineGraphStorePreflightCheck({
      store: new ReorderingVersionedGraphStore(),
      graphId: "preflight/reordered/graph-store",
      bundle: makeValidBundle(),
      mode: "model",
    });

    const result = await check.run();

    assert.equal(result.status, "pass");
    assert.equal(result.code, "graph_store_reachable");
  });

  it("fails when commit and load return the same corrupted graph bundle", async () => {
    class CorruptingVersionedGraphStore extends InMemoryVersionedGraphStore {
      override async commit(
        graphId: string,
        bundle: Parameters<InMemoryVersionedGraphStore["commit"]>[1],
        options: VersionedGraphCommitOptions,
      ): Promise<VersionedGraphSnapshot> {
        const corrupted = clone(bundle);
        corrupted.account_objects[0] = {
          ...corrupted.account_objects[0]!,
          title: "Corrupted graph probe title",
        };
        return super.commit(graphId, corrupted, options);
      }
    }

    const check = defineGraphStorePreflightCheck({
      store: new CorruptingVersionedGraphStore(),
      graphId: "preflight/corrupted/graph-store",
      bundle: makeValidBundle(),
      mode: "model",
    });

    const result = await check.run();

    assert.deepEqual(result, {
      status: "fail",
      code: "graph_store_mismatch",
      message: "graph store commit load probe returned mismatched graph state",
      metadata: { adapter: "graph_store", probe: "commit_load" },
    });
  });

  it("treats an existing probe graph as a conflict instead of overwriting it", async () => {
    const store = new InMemoryVersionedGraphStore();
    await store.commit("preflight/reused/graph-store", makeValidBundle(), {
      expectedRevision: null,
      mode: "model",
    });
    const check = defineGraphStorePreflightCheck({
      store,
      graphId: "preflight/reused/graph-store",
      bundle: makeValidBundle(),
      mode: "model",
    });

    const result = await check.run();

    assert.equal(result.status, "fail");
    assert.equal(result.code, "graph_store_conflict");
    assert.equal(result.message, "graph store commit load probe graph already exists");
    assert.deepEqual(result.metadata, { adapter: "graph_store", probe: "commit_load" });
  });

  it("does not read process.env while defining or running the graph store probe", async () => {
    const originalEnv = process.env;
    process.env = new Proxy(originalEnv, {
      get() {
        throw new Error("process.env must not be read by graph store preflight");
      },
    });
    try {
      const check = defineGraphStorePreflightCheck({
        store: new InMemoryVersionedGraphStore(),
        graphId: "preflight/no-env/graph-store",
        bundle: makeValidBundle(),
        mode: "model",
      });
      const result = await check.run();
      assert.equal(result.status, "pass");
    } finally {
      process.env = originalEnv;
    }
  });
});
