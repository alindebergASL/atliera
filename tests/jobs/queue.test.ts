import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  InMemoryJobQueue,
  assertSafeQueueName,
  type JobQueue,
} from "../../src/jobs/queue.ts";

describe("JobQueue seam", () => {
  it("enqueues and dequeues jobs through an implementation-neutral interface", async () => {
    const queue: JobQueue<{ graph_key: string }> = new InMemoryJobQueue();

    const enqueued = await queue.enqueue("graph-synthesis", {
      graph_key: "runs/run-1/graph-bundle.json",
    });

    assert.equal(enqueued.queue, "graph-synthesis");
    assert.equal(enqueued.status, "queued");
    assert.match(enqueued.id, /^job_[a-zA-Z0-9_-]+$/);

    const dequeued = await queue.dequeue("graph-synthesis");

    assert.deepEqual(dequeued, {
      id: enqueued.id,
      queue: "graph-synthesis",
      payload: { graph_key: "runs/run-1/graph-bundle.json" },
      status: "leased",
      attempts: 1,
    });
  });

  it("returns undefined when a queue has no available jobs", async () => {
    const queue = new InMemoryJobQueue();

    assert.equal(await queue.dequeue("graph-synthesis"), undefined);
  });

  it("keeps queue names logical rather than infrastructure addresses", () => {
    for (const name of [
      "",
      " graph-synthesis",
      "graph/synthesis",
      "https://queue.example.invalid/graph-synthesis",
      "redis://queue/0",
      "127.0.0.1",
      "10.0.0.5",
      "::1",
      "127.0.0.1:6379",
      "graph..synthesis",
    ]) {
      assert.throws(() => assertSafeQueueName(name), /queue name must/);
    }
  });

  it("requires explicit completion for leased jobs", async () => {
    const queue = new InMemoryJobQueue<{ step: string }>();
    const first = await queue.enqueue("graph-synthesis", { step: "one" });

    const leased = await queue.dequeue("graph-synthesis");
    assert.equal(leased?.id, first.id);
    assert.equal(await queue.dequeue("graph-synthesis"), undefined);

    await queue.complete(first.id);
    assert.equal(await queue.get(first.id), undefined);
  });

  it("rejects completion for unknown jobs", async () => {
    const queue = new InMemoryJobQueue();

    await assert.rejects(() => queue.complete("job_missing"), /unknown job/);
  });
});
