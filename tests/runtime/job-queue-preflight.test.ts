import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { InMemoryJobQueue, type JobQueue, type QueuedJob } from "../../src/jobs/queue.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import { defineJobQueuePreflightCheck } from "../../src/runtime/job-queue-preflight.ts";
import { runResourcePreflight } from "../../src/runtime/resource-preflight.ts";

class RecordingJobQueue<Payload = unknown> extends InMemoryJobQueue<Payload> {
  readonly enqueues: Array<{ queue: string; payload: Payload }> = [];
  readonly dequeues: string[] = [];
  readonly completes: string[] = [];
  readonly gets: string[] = [];

  override async enqueue(queue: string, payload: Payload): Promise<QueuedJob<Payload>> {
    this.enqueues.push({ queue, payload });
    return super.enqueue(queue, payload);
  }

  override async dequeue(queue: string): Promise<QueuedJob<Payload> | undefined> {
    this.dequeues.push(queue);
    return super.dequeue(queue);
  }

  override async complete(id: string): Promise<void> {
    this.completes.push(id);
    await super.complete(id);
  }

  override async get(id: string): Promise<QueuedJob<Payload> | undefined> {
    this.gets.push(id);
    return super.get(id);
  }
}

class FailingJobQueue implements JobQueue {
  constructor(private readonly mode: "enqueue" | "dequeue" | "complete" | "get") {}

  async enqueue(queue: string, payload: unknown): Promise<QueuedJob> {
    if (this.mode === "enqueue") {
      throw new Error("redis://queue.internal/0 token=abc123");
    }
    return { id: "job_probe", queue, payload, status: "queued", attempts: 0 };
  }

  async dequeue(queue: string): Promise<QueuedJob | undefined> {
    if (this.mode === "dequeue") {
      throw new Error("postgres://queue.internal/jobs?password=secret");
    }
    return { id: "job_probe", queue, payload: { purpose: "resource-preflight" }, status: "leased", attempts: 1 };
  }

  async complete(): Promise<void> {
    if (this.mode === "complete") {
      throw new Error("https://queue.example.invalid/private-path");
    }
  }

  async get(): Promise<QueuedJob | undefined> {
    if (this.mode === "get") {
      throw new Error("https://queue.example.invalid/private-get-path?token=abc123");
    }
    return undefined;
  }
}

describe("job queue resource preflight", () => {
  it("defines a queue_backend check that enqueues, dequeues, completes, and verifies a caller-scoped probe job", async () => {
    const queue = new RecordingJobQueue();
    const check = defineJobQueuePreflightCheck({ queue, queueName: "preflight-run-123" });

    assert.equal(check.target, "queue_backend");
    assert.equal(check.name, "job queue enqueue dequeue probe");

    const result = await check.run();

    assert.deepEqual(result, {
      status: "pass",
      code: "queue_backend_reachable",
      message: "job queue enqueue dequeue probe passed",
      metadata: { adapter: "job_queue", probe: "enqueue_dequeue_complete" },
    });
    assert.equal(queue.enqueues.length, 1);
    assert.equal(queue.dequeues.length, 1);
    assert.equal(queue.completes.length, 1);
    assert.equal(queue.gets.length, 1);
    assert.equal(queue.enqueues[0]?.queue, "preflight-run-123");
    assert.deepEqual(queue.enqueues[0]?.payload, { purpose: "resource-preflight" });
    assert.equal(queue.dequeues[0], "preflight-run-123");
    assert.equal(queue.gets[0], queue.completes[0]);
  });

  it("integrates with production-like resource preflight without constructing clients itself", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "database",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      { target: "database", name: "database ping", run: () => ({ status: "pass", code: "reachable", message: "ok" }) },
      { target: "artifact_store", name: "artifact store probe", run: () => ({ status: "pass", code: "artifact_store_reachable", message: "ok" }) },
      defineJobQueuePreflightCheck({ queue: new InMemoryJobQueue(), queueName: "preflight-staging-123" }),
      { target: "model_provider", name: "model credential probe", run: () => ({ status: "pass", code: "credentials_present", message: "ok" }) },
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
    assert.deepEqual(
      report.checks.map((check) => [check.target, check.code, check.status]),
      [
        ["database", "reachable", "pass"],
        ["artifact_store", "artifact_store_reachable", "pass"],
        ["queue_backend", "queue_backend_reachable", "pass"],
        ["model_provider", "credentials_present", "pass"],
      ],
    );
  });

  it("rejects unsafe probe queue names before touching the queue", async () => {
    const queue = new RecordingJobQueue();

    for (const queueName of ["../private", "redis://queue/0", "127.0.0.1", "queue:6379"] as const) {
      assert.throws(
        () => defineJobQueuePreflightCheck({ queue, queueName }),
        /queue name/,
      );
    }
    assert.equal(queue.enqueues.length, 0);
    assert.equal(queue.dequeues.length, 0);
    assert.equal(queue.completes.length, 0);
    assert.equal(queue.gets.length, 0);
  });

  it("returns sanitized failures when enqueue, dequeue, complete, or get fails", async () => {
    for (const mode of ["enqueue", "dequeue", "complete", "get"] as const) {
      const check = defineJobQueuePreflightCheck({
        queue: new FailingJobQueue(mode),
        queueName: `preflight-${mode}`,
      });

      const result = await check.run();

      assert.equal(result.status, "fail");
      assert.equal(result.code, "queue_backend_unreachable");
      assert.equal(result.message, "job queue enqueue dequeue probe failed");
      assert.deepEqual(result.metadata, { adapter: "job_queue", probe: "enqueue_dequeue_complete" });
      assert.doesNotMatch(JSON.stringify(result), /redis|postgres|password|secret|token|abc123|queue\.internal|https:\/\//i);
    }
  });

  it("fails when dequeue returns no job or mismatched job data", async () => {
    class MismatchedJobQueue extends InMemoryJobQueue {
      constructor(private readonly mismatch: "missing" | "queue" | "payload" | "status" | "attempts" | "not-deleted") {
        super();
      }

      override async dequeue(queue: string) {
        const job = await super.dequeue(queue);
        if (this.mismatch === "missing") {
          return undefined;
        }
        if (job === undefined) {
          return undefined;
        }
        if (this.mismatch === "queue") {
          return { ...job, queue: "other-queue" };
        }
        if (this.mismatch === "payload") {
          return { ...job, payload: { purpose: "different" } };
        }
        if (this.mismatch === "status") {
          return { ...job, status: "queued" as const };
        }
        if (this.mismatch === "attempts") {
          return { ...job, attempts: 0 };
        }
        return job;
      }

      override async get(id: string) {
        if (this.mismatch === "not-deleted") {
          return { id, queue: "preflight-not-deleted", payload: { purpose: "resource-preflight" }, status: "leased" as const, attempts: 1 };
        }
        return super.get(id);
      }
    }

    for (const mismatch of ["missing", "queue", "payload", "status", "attempts", "not-deleted"] as const) {
      const check = defineJobQueuePreflightCheck({
        queue: new MismatchedJobQueue(mismatch),
        queueName: `preflight-${mismatch}`,
      });

      const result = await check.run();

      assert.deepEqual(result, {
        status: "fail",
        code: "queue_backend_mismatch",
        message: "job queue enqueue dequeue probe returned mismatched job state",
        metadata: { adapter: "job_queue", probe: "enqueue_dequeue_complete" },
      });
    }
  });

  it("does not read process.env while defining or running the probe", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read by job queue preflight");
      },
    });

    try {
      const check = defineJobQueuePreflightCheck({ queue: new InMemoryJobQueue(), queueName: "preflight-env" });
      assert.equal((await check.run()).status, "pass");
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(process, "env", originalDescriptor);
      }
    }
  });
});
