import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  DatabaseJobQueue,
  DatabaseJobQueueDependencyError,
  type DatabaseJobQueueClient,
  type DatabaseJobQueueEvent,
  type DatabaseJobRow,
} from "../../src/jobs/database-queue.ts";

describe("DatabaseJobQueue", () => {
  it("enqueues, leases, completes, and reads jobs through an injected database client", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue<{ graphKey: string }>({ table: "job_queue", client, generateJobId: () => "job_0001" });

    const enqueued = await queue.enqueue("graph-synthesis", { graphKey: "runs/run-1/graph-bundle.json" });

    assert.deepEqual(enqueued, {
      id: "job_0001",
      queue: "graph-synthesis",
      payload: { graphKey: "runs/run-1/graph-bundle.json" },
      status: "queued",
      attempts: 0,
    });
    assert.deepEqual(client.inserts, [
      {
        table: "job_queue",
        id: "job_0001",
        queue: "graph-synthesis",
        payloadJson: JSON.stringify({ graphKey: "runs/run-1/graph-bundle.json" }),
      },
    ]);

    const leased = await queue.dequeue("graph-synthesis");
    assert.deepEqual(leased, {
      id: "job_0001",
      queue: "graph-synthesis",
      payload: { graphKey: "runs/run-1/graph-bundle.json" },
      status: "leased",
      attempts: 1,
    });
    assert.deepEqual(client.leases, [{ table: "job_queue", queue: "graph-synthesis" }]);

    assert.deepEqual(await queue.get("job_0001"), leased);
    await queue.complete("job_0001");
    assert.deepEqual(client.completes, [{ table: "job_queue", id: "job_0001" }]);
    assert.equal(await queue.get("job_0001"), undefined);
  });

  it("returns undefined when no job is available or a job id is missing", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue({ table: "job_queue", client, generateJobId: () => "job_0001" });

    assert.equal(await queue.dequeue("graph-synthesis"), undefined);
    assert.equal(await queue.get("job_missing"), undefined);
  });

  it("rejects unsafe queue names, unsafe table names, and unsafe job ids before touching the client", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    assert.throws(() => new DatabaseJobQueue({ table: "jobs;drop", client }), /table name must/);

    const queue = new DatabaseJobQueue({ table: "job_queue", client });

    await assert.rejects(() => queue.enqueue("redis://queue/0", {}), /queue name must/);
    await assert.rejects(() => queue.dequeue("127.0.0.1"), /queue name must/);
    await assert.rejects(() => queue.get("job/../secret"), /job id must/);
    await assert.rejects(() => queue.complete("https://queue.example.invalid/job_1"), /job id must/);

    assert.equal(client.calls, 0);
  });

  it("requires JSON-serializable payloads before enqueue reaches the client", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue({ table: "job_queue", client, generateJobId: () => "job_0001" });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await assert.rejects(() => queue.enqueue("graph-synthesis", circular), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", undefined), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", { dropped: undefined }), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", { dropped: () => undefined }), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", { dropped: Symbol("not-json") }), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", { lossy: Number.NaN }), /payload must be JSON serializable/);
    await assert.rejects(() => queue.enqueue("graph-synthesis", { lossy: Infinity }), /payload must be JSON serializable/);
    const symbolKeyedPayload = { visible: true } as Record<PropertyKey, unknown>;
    symbolKeyedPayload[Symbol("hidden")] = "lost";
    await assert.rejects(() => queue.enqueue("graph-synthesis", symbolKeyedPayload), /payload must be JSON serializable/);
    const nonEnumerablePayload = { visible: true };
    Object.defineProperty(nonEnumerablePayload, "hidden", { value: "lost", enumerable: false });
    await assert.rejects(() => queue.enqueue("graph-synthesis", nonEnumerablePayload), /payload must be JSON serializable/);
    const accessorPayload = { visible: true };
    Object.defineProperty(accessorPayload, "private", {
      enumerable: true,
      get() {
        throw new Error("payload getter leaked private queue secret");
      },
    });
    await assert.rejects(() => queue.enqueue("graph-synthesis", accessorPayload), /payload must be JSON serializable/);
    const toJsonPayload = { visible: true };
    Object.defineProperty(toJsonPayload, "toJSON", { value: () => ({ transformed: true }), enumerable: false });
    await assert.rejects(() => queue.enqueue("graph-synthesis", toJsonPayload), /payload must be JSON serializable/);
    const sparseArrayPayload = { values: ["present", , "present"] };
    await assert.rejects(() => queue.enqueue("graph-synthesis", sparseArrayPayload), /payload must be JSON serializable/);
    const arrayWithExtraProperty = { values: ["present"] as unknown[] & { extra?: string } };
    arrayWithExtraProperty.values.extra = "lost";
    await assert.rejects(() => queue.enqueue("graph-synthesis", arrayWithExtraProperty), /payload must be JSON serializable/);
    assert.equal(client.calls, 0);
  });

  it("rejects proxy-backed payload trap failures with sanitized errors before enqueue reaches the client", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue({ table: "job_queue", client, generateJobId: () => "job_0001" });
    const proxyPayloads = [
      new Proxy({ ok: true }, {
        ownKeys() {
          throw new Error("postgres://payload.internal?password=secret");
        },
      }),
      new Proxy({ ok: true }, {
        getOwnPropertyDescriptor() {
          throw new Error("token=abc123 descriptor leak");
        },
      }),
      new Proxy(["ok"], {
        getOwnPropertyDescriptor() {
          throw new Error("array payload descriptor secret should not leak");
        },
      }),
      new Proxy({ ok: true }, {
        getPrototypeOf() {
          throw new Error("payload prototype trap secret should not leak");
        },
      }),
    ];

    for (const proxyPayload of proxyPayloads) {
      await assert.rejects(
        () => queue.enqueue("graph-synthesis", proxyPayload),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /payload must be JSON serializable/);
          assert.doesNotMatch(error.message, /postgres|password|secret|token|abc123|descriptor|trap/i);
          return true;
        },
      );
    }
    assert.equal(client.calls, 0);
  });

  it("preserves literal __proto__ payload fields as data while snapshotting before enqueue", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const payload = { visible: true } as Record<string, unknown>;
    Object.defineProperty(payload, "__proto__", {
      value: { literal: "data" },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const queue = new DatabaseJobQueue({ table: "job_queue", client, generateJobId: () => "job_0001" });

    const enqueued = await queue.enqueue("graph-synthesis", payload);

    assert.equal((enqueued.payload as Record<string, unknown>).visible, true);
    assert.equal(Object.prototype.hasOwnProperty.call(enqueued.payload, "__proto__"), true);
    assert.deepEqual((enqueued.payload as Record<string, unknown>).__proto__, { literal: "data" });
    assert.equal(client.inserts[0]?.payloadJson, '{"visible":true,"__proto__":{"literal":"data"}}');
  });

  it("treats duplicate generated job ids as sanitized enqueue conflicts", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue({ table: "job_queue", client, generateJobId: () => "job_0001" });

    await queue.enqueue("graph-synthesis", { ok: true });
    await assert.rejects(
      () => queue.enqueue("graph-synthesis", { ok: true }),
      (error: unknown) => {
        assert.ok(error instanceof DatabaseJobQueueDependencyError);
        assert.match(error.message, /DatabaseJobQueue enqueue failed/);
        assert.doesNotMatch(error.message, /job_queue|duplicate|constraint/i);
        return true;
      },
    );
  });

  it("treats malformed client write results as sanitized dependency failures", async () => {
    const malformedInsertResults = [{}, { inserted: "true" }, null, undefined];
    const malformedDeleteResults = [{}, { deleted: 1 }, null, undefined];

    for (const malformedInsertResult of malformedInsertResults) {
      const malformedInsertClient: DatabaseJobQueueClient = {
        async insertJob() {
          return malformedInsertResult as unknown as { inserted: true };
        },
        async leaseNextJob() {
          throw new Error("should not be called");
        },
        async deleteJob() {
          throw new Error("should not be called");
        },
        async selectJob() {
          throw new Error("should not be called");
        },
      };
      const enqueueQueue = new DatabaseJobQueue({ table: "job_queue", client: malformedInsertClient, generateJobId: () => "job_0001" });

      await assert.rejects(
        () => enqueueQueue.enqueue("graph-synthesis", { ok: true }),
        (error: unknown) => {
          assert.ok(error instanceof DatabaseJobQueueDependencyError);
          assert.match(error.message, /DatabaseJobQueue enqueue failed/);
          assert.doesNotMatch(error.message, /job_queue|inserted|malformed/i);
          return true;
        },
      );
    }

    for (const malformedDeleteResult of malformedDeleteResults) {
      const malformedDeleteClient = new RecordingDatabaseJobQueueClient();
      const completeQueue = new DatabaseJobQueue({ table: "job_queue", client: malformedDeleteClient, generateJobId: () => "job_0001" });
      await completeQueue.enqueue("graph-synthesis", { ok: true });
      malformedDeleteClient.hasDeleteResult = true;
      malformedDeleteClient.deleteResult = malformedDeleteResult;

      await assert.rejects(
        () => completeQueue.complete("job_0001"),
        (error: unknown) => {
          assert.ok(error instanceof DatabaseJobQueueDependencyError);
          assert.match(error.message, /DatabaseJobQueue complete failed/);
          assert.doesNotMatch(error.message, /job_queue|deleted|malformed/i);
          return true;
        },
      );
    }
  });

  it("treats malformed stored rows as sanitized dependency failures", async () => {
    const malformedClients: DatabaseJobQueueClient[] = [
      new StaticRowClient({ id: "job_0001", queue: "other-queue", payloadJson: "{}", status: "leased", attempts: 1 }),
      new StaticRowClient({ id: "job_0001", queue: "graph-synthesis", payloadJson: "not-json", status: "leased", attempts: 1 }),
      new StaticRowClient({ id: "job_0001", queue: "graph-synthesis", payloadJson: "{}", status: "running" as "leased", attempts: 1 }),
      new StaticRowClient({ id: "job_0001", queue: "graph-synthesis", payloadJson: "{}", status: "leased", attempts: 0 }),
    ];

    for (const client of malformedClients) {
      const queue = new DatabaseJobQueue({ table: "job_queue", client });
      await assert.rejects(
        () => queue.dequeue("graph-synthesis"),
        (error: unknown) => {
          assert.ok(error instanceof DatabaseJobQueueDependencyError);
          assert.match(error.message, /DatabaseJobQueue dequeue failed/);
          assert.doesNotMatch(error.message, /not-json|other-queue|running|job_queue/i);
          return true;
        },
      );
    }
  });

  it("emits sanitized operation events and wraps backend failures without leaking database details", async () => {
    const events: DatabaseJobQueueEvent[] = [];
    const failingClient: DatabaseJobQueueClient = {
      async insertJob() {
        throw new Error("postgres://queue.internal/atliera?password=secret");
      },
      async leaseNextJob() {
        throw new Error("should not be called");
      },
      async deleteJob() {
        throw new Error("should not be called");
      },
      async selectJob() {
        throw new Error("token=abc123 job_queue_private");
      },
    };
    const queue = new DatabaseJobQueue({
      table: "job_queue",
      client: failingClient,
      generateJobId: () => "job_0001",
      onEvent: (event) => events.push(event),
    });

    await assert.rejects(
      () => queue.enqueue("graph-synthesis", { ok: true }),
      (error: unknown) => {
        assert.ok(error instanceof DatabaseJobQueueDependencyError);
        assert.match(error.message, /DatabaseJobQueue enqueue failed/);
        assert.doesNotMatch(error.message, /postgres|password|secret|queue\.internal/i);
        return true;
      },
    );
    await assert.rejects(
      () => queue.get("job_0001"),
      (error: unknown) => {
        assert.ok(error instanceof DatabaseJobQueueDependencyError);
        assert.match(error.message, /DatabaseJobQueue get failed/);
        assert.doesNotMatch(error.message, /abc123|token|job_queue_private/i);
        return true;
      },
    );

    assert.deepEqual(events.map((event) => [event.operation, event.status, event.queue]), [
      ["enqueue", "start", "graph-synthesis"],
      ["enqueue", "failure", "graph-synthesis"],
      ["get", "start", undefined],
      ["get", "failure", undefined],
    ]);
    assert.doesNotMatch(JSON.stringify(events), /postgres|password|secret|abc123|token|job_queue_private/i);
  });

  it("keeps observer failures from changing queue outcomes", async () => {
    const client = new RecordingDatabaseJobQueueClient();
    const queue = new DatabaseJobQueue({
      table: "job_queue",
      client,
      generateJobId: () => "job_0001",
      onEvent: () => {
        throw new Error("observer should not fail queue operations");
      },
    });

    assert.equal((await queue.enqueue("graph-synthesis", { ok: true })).id, "job_0001");
    assert.equal((await queue.dequeue("graph-synthesis"))?.id, "job_0001");
  });

  it("does not read process.env while constructing or operating", async () => {
    const originalEnv = process.env;
    process.env = new Proxy(originalEnv, {
      get() {
        throw new Error("process.env must not be read by DatabaseJobQueue");
      },
    });

    try {
      const queue = new DatabaseJobQueue({
        table: "job_queue",
        client: new RecordingDatabaseJobQueueClient(),
        generateJobId: () => "job_0001",
      });
      await queue.enqueue("graph-synthesis", { ok: true });
      await queue.dequeue("graph-synthesis");
      await queue.get("job_0001");
      await queue.complete("job_0001");
    } finally {
      process.env = originalEnv;
    }
  });
});

class RecordingDatabaseJobQueueClient implements DatabaseJobQueueClient {
  rows = new Map<string, DatabaseJobRow>();
  inserts: Array<{ table: string; id: string; queue: string; payloadJson: string }> = [];
  leases: Array<{ table: string; queue: string }> = [];
  completes: Array<{ table: string; id: string }> = [];
  selects: Array<{ table: string; id: string }> = [];
  hasDeleteResult = false;
  deleteResult?: unknown;

  get calls(): number {
    return this.inserts.length + this.leases.length + this.completes.length + this.selects.length;
  }

  async insertJob(input: { table: string; id: string; queue: string; payloadJson: string }): Promise<{ inserted: true } | { inserted: false }> {
    this.inserts.push(input);
    if (this.rows.has(input.id)) {
      return { inserted: false };
    }
    this.rows.set(input.id, {
      id: input.id,
      queue: input.queue,
      payloadJson: input.payloadJson,
      status: "queued",
      attempts: 0,
    });
    return { inserted: true };
  }

  async leaseNextJob(input: { table: string; queue: string }): Promise<DatabaseJobRow | undefined> {
    this.leases.push(input);
    for (const row of Array.from(this.rows.values())) {
      if (row.queue === input.queue && row.status === "queued") {
        row.status = "leased";
        row.attempts += 1;
        return { ...row };
      }
    }
    return undefined;
  }

  async deleteJob(input: { table: string; id: string }): Promise<{ deleted: true } | { deleted: false }> {
    this.completes.push(input);
    if (this.hasDeleteResult) {
      return this.deleteResult as { deleted: true } | { deleted: false };
    }
    return this.rows.delete(input.id) ? { deleted: true } : { deleted: false };
  }

  async selectJob(input: { table: string; id: string }): Promise<DatabaseJobRow | undefined> {
    this.selects.push(input);
    const row = this.rows.get(input.id);
    return row === undefined ? undefined : { ...row };
  }
}

class StaticRowClient implements DatabaseJobQueueClient {
  constructor(private readonly row: DatabaseJobRow) {}

  async insertJob(): Promise<{ inserted: true } | { inserted: false }> {
    throw new Error("should not be called");
  }

  async leaseNextJob(): Promise<DatabaseJobRow | undefined> {
    return this.row;
  }

  async deleteJob(): Promise<{ deleted: true } | { deleted: false }> {
    throw new Error("should not be called");
  }

  async selectJob(): Promise<DatabaseJobRow | undefined> {
    return this.row;
  }
}
