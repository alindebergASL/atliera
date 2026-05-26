import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  DatabaseVersionedGraphStore,
  type DatabaseGraphStoreClient,
  type DatabaseGraphStoreEvent,
  type DatabaseGraphRow,
} from "../../src/graph/database-versioned-store.ts";
import {
  GraphStoreConflictError,
  GraphStoreValidationError,
  type VersionedGraphStore,
} from "../../src/graph/versioned-store.ts";
import { makeValidBundle, clone } from "../fixtures/valid-graph.ts";

class RecordingDatabaseGraphClient implements DatabaseGraphStoreClient {
  readonly selects: Array<{ table: string; graphId: string }> = [];
  readonly inserts: Array<{ table: string; graphId: string; revision: number; bundleJson: string }> = [];
  readonly updates: Array<{
    table: string;
    graphId: string;
    expectedRevision: number;
    revision: number;
    bundleJson: string;
  }> = [];
  readonly rows = new Map<string, { revision: number; bundleJson: string }>();

  async selectGraph(input: { table: string; graphId: string }): Promise<DatabaseGraphRow | undefined> {
    this.selects.push({ ...input });
    const row = this.rows.get(input.graphId);
    if (row === undefined) {
      return undefined;
    }
    return { graphId: input.graphId, revision: row.revision, bundleJson: row.bundleJson };
  }

  async insertGraph(input: { table: string; graphId: string; revision: number; bundleJson: string }): Promise<
    | { inserted: true }
    | { inserted: false; currentRevision: number }
  > {
    this.inserts.push({ ...input });
    const current = this.rows.get(input.graphId);
    if (current !== undefined) {
      return { inserted: false, currentRevision: current.revision };
    }
    this.rows.set(input.graphId, { revision: input.revision, bundleJson: input.bundleJson });
    return { inserted: true };
  }

  async updateGraph(input: {
    table: string;
    graphId: string;
    expectedRevision: number;
    revision: number;
    bundleJson: string;
  }): Promise<{ updated: true } | { updated: false; currentRevision: number | null }> {
    this.updates.push({ ...input });
    const current = this.rows.get(input.graphId);
    if (current?.revision !== input.expectedRevision) {
      return { updated: false, currentRevision: current?.revision ?? null };
    }
    this.rows.set(input.graphId, { revision: input.revision, bundleJson: input.bundleJson });
    return { updated: true };
  }
}

describe("DatabaseVersionedGraphStore", () => {
  it("commits and loads graph snapshots through an injected database client", async () => {
    const client = new RecordingDatabaseGraphClient();
    const store: VersionedGraphStore = new DatabaseVersionedGraphStore({
      table: "atliera_graph_snapshots",
      client,
    });
    const bundle = makeValidBundle();

    const committed = await store.commit("teams/team_1/graphs/acme", bundle, {
      expectedRevision: null,
      mode: "model",
    });
    const loaded = await store.load("teams/team_1/graphs/acme");

    assert.equal(committed.graphId, "teams/team_1/graphs/acme");
    assert.equal(committed.revision, "rev_1");
    assert.deepEqual(committed.bundle, bundle);
    assert.deepEqual(loaded, committed);
    assert.deepEqual(client.inserts.map(({ table, graphId, revision }) => ({ table, graphId, revision })), [
      { table: "atliera_graph_snapshots", graphId: "teams/team_1/graphs/acme", revision: 1 },
    ]);
    assert.deepEqual(client.selects, [{ table: "atliera_graph_snapshots", graphId: "teams/team_1/graphs/acme" }]);
  });

  it("returns undefined when the database client reports a missing graph", async () => {
    const client = new RecordingDatabaseGraphClient();
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });

    assert.equal(await store.load("teams/team_1/graphs/missing"), undefined);
    assert.deepEqual(client.selects, [{ table: "graph_snapshots", graphId: "teams/team_1/graphs/missing" }]);
  });

  it("treats mismatched or malformed backend rows as sanitized load failures", async () => {
    const mismatchedClient: DatabaseGraphStoreClient = {
      async selectGraph(input) {
        return { graphId: `${input.graphId}-different`, revision: 1, bundleJson: JSON.stringify(makeValidBundle()) };
      },
      async insertGraph() {
        throw new Error("should not be called");
      },
      async updateGraph() {
        throw new Error("should not be called");
      },
    };
    const malformedRevisionClient: DatabaseGraphStoreClient = {
      async selectGraph(input) {
        return { graphId: input.graphId, revision: 0, bundleJson: JSON.stringify(makeValidBundle()) };
      },
      async insertGraph() {
        throw new Error("should not be called");
      },
      async updateGraph() {
        throw new Error("should not be called");
      },
    };

    for (const client of [mismatchedClient, malformedRevisionClient]) {
      const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });
      await assert.rejects(
        () => store.load("teams/team_1/graphs/acme"),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /DatabaseVersionedGraphStore load failed/);
          assert.doesNotMatch(error.message, /different|revision is invalid/);
          return true;
        },
      );
    }
  });

  it("uses atomic conditional update semantics and rejects stale revisions", async () => {
    const client = new RecordingDatabaseGraphClient();
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });
    const initial = await store.commit("teams/team_1/graphs/acme", makeValidBundle(), {
      expectedRevision: null,
      mode: "model",
    });
    const updatedBundle = makeValidBundle();
    updatedBundle.account_objects[0] = {
      ...updatedBundle.account_objects[0]!,
      title: "Updated signal title",
    };

    const updated = await store.commit("teams/team_1/graphs/acme", updatedBundle, {
      expectedRevision: initial.revision,
      mode: "model",
    });

    assert.equal(updated.revision, "rev_2");
    assert.deepEqual(client.updates.map(({ expectedRevision, revision }) => ({ expectedRevision, revision })), [
      { expectedRevision: 1, revision: 2 },
    ]);
    await assert.rejects(
      () => store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: initial.revision, mode: "model" }),
      (error: unknown) => {
        assert.ok(error instanceof GraphStoreConflictError);
        assert.equal(error.expectedRevision, "rev_1");
        assert.equal(error.actualRevision, "rev_2");
        return true;
      },
    );
  });

  it("treats create-only writes for existing graphs as conflicts", async () => {
    const client = new RecordingDatabaseGraphClient();
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });
    await store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "model" });

    await assert.rejects(
      () => store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "model" }),
      (error: unknown) => {
        assert.ok(error instanceof GraphStoreConflictError);
        assert.equal(error.expectedRevision, null);
        assert.equal(error.actualRevision, "rev_1");
        return true;
      },
    );
  });

  it("treats malformed client write results as sanitized dependency failures", async () => {
    const malformedInsertResults = [
      {},
      { inserted: "true" },
      { inserted: false },
      { inserted: false, currentRevision: 0 },
      { inserted: false, currentRevision: "1" },
      { inserted: false, currentRevision: Number.MAX_SAFE_INTEGER + 1 },
      null,
      undefined,
    ];
    for (const malformedResult of malformedInsertResults) {
      const malformedInsertClient: DatabaseGraphStoreClient = {
        async selectGraph() {
          throw new Error("should not be called");
        },
        async insertGraph() {
          return malformedResult as unknown as { inserted: true } | { inserted: false; currentRevision: number };
        },
        async updateGraph() {
          throw new Error("should not be called");
        },
      };
      const insertStore = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client: malformedInsertClient });

      await assert.rejects(
        () => insertStore.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "model" }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /DatabaseVersionedGraphStore commit failed/);
          assert.doesNotMatch(error.message, /inserted|true|null|undefined/);
          return true;
        },
      );
    }

    const malformedUpdateResults = [
      {},
      { updated: 1 },
      { updated: false },
      { updated: false, currentRevision: 0 },
      { updated: false, currentRevision: "1" },
      { updated: false, currentRevision: Number.MAX_SAFE_INTEGER + 1 },
      { updated: false, currentRevision: 1 },
      null,
      undefined,
    ];
    for (const malformedResult of malformedUpdateResults) {
      const malformedUpdateClient: DatabaseGraphStoreClient = {
        async selectGraph() {
          throw new Error("should not be called");
        },
        async insertGraph() {
          throw new Error("should not be called");
        },
        async updateGraph() {
          return malformedResult as unknown as { updated: true } | { updated: false; currentRevision: number | null };
        },
      };
      const updateStore = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client: malformedUpdateClient });

      await assert.rejects(
        () => updateStore.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: "rev_1", mode: "model" }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /DatabaseVersionedGraphStore commit failed/);
          assert.doesNotMatch(error.message, /updated|1|null|undefined/);
          return true;
        },
      );
    }
  });

  it("rejects unsafe graph ids, unsafe table names, and safe-mode writes before touching the client", async () => {
    const client = new RecordingDatabaseGraphClient();
    assert.throws(
      () => new DatabaseVersionedGraphStore({ table: "../graph_snapshots", client }),
      /table must be a logical database table identifier/,
    );
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });

    await assert.rejects(
      () => store.load("db.internal/team-1"),
      /graph id must/,
    );
    await assert.rejects(
      () => store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "fixture" }),
      /production writes are forbidden/,
    );
    assert.equal(client.selects.length, 0);
    assert.equal(client.inserts.length, 0);
    assert.equal(client.updates.length, 0);
  });

  it("validates graph bundles before database writes", async () => {
    const client = new RecordingDatabaseGraphClient();
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client });
    const invalidBundle = clone(makeValidBundle());
    invalidBundle.claims[0] = { ...invalidBundle.claims[0]!, id: "bad_claim_id" };

    await assert.rejects(
      () => store.commit("teams/team_1/graphs/acme", invalidBundle, { expectedRevision: null, mode: "model" }),
      GraphStoreValidationError,
    );
    assert.equal(client.inserts.length, 0);
    assert.equal(client.updates.length, 0);
  });

  it("returns defensive copies so callers cannot mutate stored graph state", async () => {
    const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client: new RecordingDatabaseGraphClient() });
    const committed = await store.commit("teams/team_1/graphs/acme", makeValidBundle(), {
      expectedRevision: null,
      mode: "model",
    });
    committed.bundle.account_objects[0]!.title = "mutated outside store";

    const loaded = await store.load("teams/team_1/graphs/acme");

    assert.equal(loaded?.bundle.account_objects[0]?.title, "New logistics platform launch");
  });

  it("treats malformed stored rows as sanitized load failures", async () => {
    const client = new RecordingDatabaseGraphClient();
    const events: DatabaseGraphStoreEvent[] = [];
    client.rows.set("teams/team_1/graphs/acme", {
      revision: 1,
      bundleJson: "{\"leaked\":\"database-private-payload\"",
    });
    const store = new DatabaseVersionedGraphStore({
      table: "graph_snapshots",
      client,
      observe: (event) => events.push(event),
    });

    await assert.rejects(
      () => store.load("teams/team_1/graphs/acme"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DatabaseVersionedGraphStore load failed/);
        assert.doesNotMatch(error.message, /database-private-payload|leaked/);
        return true;
      },
    );
    assert.deepEqual(events.map(({ operation, status }) => ({ operation, status })), [
      { operation: "load", status: "start" },
      { operation: "load", status: "failure" },
    ]);
  });

  it("emits sanitized operation events and wraps backend failures without leaking database details", async () => {
    const events: DatabaseGraphStoreEvent[] = [];
    const failingClient: DatabaseGraphStoreClient = {
      async selectGraph() {
        throw new Error("postgres://private-db.internal/atliera?password=secret");
      },
      async insertGraph() {
        throw new Error("token=abc123 graph_snapshots_private");
      },
      async updateGraph() {
        throw new Error("should not be called");
      },
    };
    const store = new DatabaseVersionedGraphStore({
      table: "graph_snapshots",
      client: failingClient,
      observe: (event) => events.push(event),
    });

    await assert.rejects(
      () => store.load("teams/team_1/graphs/acme"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DatabaseVersionedGraphStore load failed/);
        assert.doesNotMatch(error.message, /private-db|password|secret|postgres:\/\//i);
        return true;
      },
    );
    await assert.rejects(
      () => store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "model" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DatabaseVersionedGraphStore commit failed/);
        assert.doesNotMatch(error.message, /abc123|graph_snapshots_private|token/i);
        return true;
      },
    );
    assert.deepEqual(events.map(({ operation, status, graphId }) => ({ operation, status, graphId })), [
      { operation: "load", status: "start", graphId: "teams/team_1/graphs/acme" },
      { operation: "load", status: "failure", graphId: "teams/team_1/graphs/acme" },
      { operation: "commit", status: "start", graphId: "teams/team_1/graphs/acme" },
      { operation: "commit", status: "failure", graphId: "teams/team_1/graphs/acme" },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /private-db|password|secret|abc123|graph_snapshots_private/i);
  });

  it("does not read process.env while constructing, loading, or committing", async () => {
    const originalEnv = process.env;
    process.env = new Proxy(originalEnv, {
      get() {
        throw new Error("process.env must not be read by DatabaseVersionedGraphStore");
      },
    });
    try {
      const store = new DatabaseVersionedGraphStore({ table: "graph_snapshots", client: new RecordingDatabaseGraphClient() });
      await store.commit("teams/team_1/graphs/acme", makeValidBundle(), { expectedRevision: null, mode: "model" });
      assert.equal((await store.load("teams/team_1/graphs/acme"))?.revision, "rev_1");
    } finally {
      process.env = originalEnv;
    }
  });
});
