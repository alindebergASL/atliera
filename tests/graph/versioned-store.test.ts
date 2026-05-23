import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  GraphStoreConflictError,
  InMemoryVersionedGraphStore,
  assertSafeGraphId,
  type VersionedGraphStore,
} from "../../src/graph/versioned-store.ts";
import { ProductionWriteForbiddenError } from "../../src/modes/index.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

describe("VersionedGraphStore contract", () => {
  it("commits and loads a GraphBundle through a logical graph id with a revision token", async () => {
    const store: VersionedGraphStore = new InMemoryVersionedGraphStore();
    const bundle = makeValidBundle();

    const committed = await store.commit("team-1/account-1/workshop", bundle, {
      mode: "model",
      expectedRevision: null,
    });
    const loaded = await store.load("team-1/account-1/workshop");

    assert.equal(committed.revision, "rev_1");
    assert.equal(loaded?.revision, "rev_1");
    assert.equal(loaded?.bundle.account_objects[0]?.id, bundle.account_objects[0]?.id);
  });

  it("rejects stale optimistic-concurrency writes instead of silently overwriting", async () => {
    const store = new InMemoryVersionedGraphStore();
    const original = makeValidBundle();
    const first = await store.commit("team-1/account-1/workshop", original, {
      mode: "model",
      expectedRevision: null,
    });
    const staleWriterBundle = clone(original);
    staleWriterBundle.account_objects[0]!.title = "stale writer title";
    const freshWriterBundle = clone(original);
    freshWriterBundle.account_objects[0]!.title = "fresh writer title";

    await store.commit("team-1/account-1/workshop", freshWriterBundle, {
      mode: "model",
      expectedRevision: first.revision,
    });

    await assert.rejects(
      () => store.commit("team-1/account-1/workshop", staleWriterBundle, {
        mode: "model",
        expectedRevision: first.revision,
      }),
      (e: unknown) => e instanceof GraphStoreConflictError &&
        e.graphId === "team-1/account-1/workshop" &&
        e.expectedRevision === "rev_1" &&
        e.actualRevision === "rev_2",
    );

    const loaded = await store.load("team-1/account-1/workshop");
    assert.equal(loaded?.bundle.account_objects[0]?.title, "fresh writer title");
  });

  it("refuses to create an existing graph when expected revision is null", async () => {
    const store = new InMemoryVersionedGraphStore();
    const bundle = makeValidBundle();

    await store.commit("team-1/account-1/workshop", bundle, {
      mode: "model",
      expectedRevision: null,
    });

    await assert.rejects(
      () => store.commit("team-1/account-1/workshop", bundle, {
        mode: "model",
        expectedRevision: null,
      }),
      GraphStoreConflictError,
    );
  });

  it("returns defensive bundle copies so callers cannot mutate stored graph state", async () => {
    const store = new InMemoryVersionedGraphStore();
    const bundle = makeValidBundle();

    const committed = await store.commit("team-1/account-1/workshop", bundle, {
      mode: "model",
      expectedRevision: null,
    });
    committed.bundle.account_objects[0]!.title = "mutated return value";
    const loaded = await store.load("team-1/account-1/workshop");
    loaded!.bundle.account_objects[0]!.title = "mutated loaded value";

    const reloaded = await store.load("team-1/account-1/workshop");
    assert.equal(reloaded?.bundle.account_objects[0]?.title, bundle.account_objects[0]?.title);
  });

  it("rejects unsafe graph ids before touching stored state", async () => {
    for (const graphId of [
      "",
      " team-1/account-1",
      "/team-1/account-1",
      "team-1//account-1",
      "team-1/../account-1",
      "team-1\\account-1",
      "https://graph.example.invalid/team-1",
      "s3://bucket/team-1",
      "localhost/team-1",
      "db.internal/team-1",
      "graph.example.invalid/team-1",
      "127.0.0.1/team-1",
    ]) {
      assert.throws(() => assertSafeGraphId(graphId), /graph id must/);
    }
  });

  it("refuses graph commits in safe runtime modes", async () => {
    const store = new InMemoryVersionedGraphStore();
    const bundle = makeValidBundle();

    for (const mode of ["validation", "fixture", "fake"] as const) {
      await assert.rejects(
        () => store.commit(`team-1/account-1/${mode}`, bundle, {
          mode,
          expectedRevision: null,
        }),
        ProductionWriteForbiddenError,
      );
    }
  });

  it("does not read process.env while defining, committing, or loading graphs", async () => {
    const originalEnv = process.env;
    const reads: string[] = [];
    process.env = new Proxy(originalEnv, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          reads.push(prop);
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    try {
      const store = new InMemoryVersionedGraphStore();
      const result = await store.commit("team-1/account-1/workshop", makeValidBundle(), {
        mode: "model",
        expectedRevision: null,
      });
      await store.load("team-1/account-1/workshop");
      assert.equal(result.revision, "rev_1");
      assert.deepEqual(reads, []);
    } finally {
      process.env = originalEnv;
    }
  });
});
