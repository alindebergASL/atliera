import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { FakeModelAdapter, type ModelAdapter } from "../../src/agent/model-adapter.ts";
import {
  InMemoryArtifactStore,
  type ArtifactStore,
} from "../../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import { InMemoryGraphStore, type GraphStore } from "../../src/graph/store.ts";
import { InMemoryJobQueue, type JobQueue } from "../../src/jobs/queue.ts";
import {
  createAtlieraRuntime,
  type AtlieraRuntime,
} from "../../src/runtime/composition.ts";
import { prepareWorkerRuntimeLaunch } from "../../src/runtime/worker-launch.ts";

function createTestRuntime() {
  return createAtlieraRuntime({
    config: parseAtlieraRuntimeConfig({
      ATL_ENV: "test",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    }),
    graphStore: new InMemoryGraphStore(),
    artifactStore: new InMemoryArtifactStore(),
    jobQueue: new InMemoryJobQueue(),
    modelAdapter: new FakeModelAdapter(),
  });
}

function createPoisonRuntime(): AtlieraRuntime {
  const fail = (operation: string): never => {
    throw new Error(`prepareWorkerRuntimeLaunch must not touch ${operation}`);
  };

  const graphStore: GraphStore = {
    get snapshot() {
      return fail("graphStore.snapshot");
    },
    commit() {
      fail("graphStore.commit");
    },
  };

  const artifactStore: ArtifactStore = {
    async putText() {
      return fail("artifactStore.putText");
    },
    async getText() {
      return fail("artifactStore.getText");
    },
  };

  const jobQueue: JobQueue = {
    async enqueue() {
      return fail("jobQueue.enqueue");
    },
    async dequeue() {
      return fail("jobQueue.dequeue");
    },
    async complete() {
      return fail("jobQueue.complete");
    },
    async get() {
      return fail("jobQueue.get");
    },
  };

  const modelAdapter: ModelAdapter = {
    name: "poison-model-adapter",
    async propose() {
      return fail("modelAdapter.propose");
    },
  };

  return createAtlieraRuntime({
    config: parseAtlieraRuntimeConfig({
      ATL_ENV: "test",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    }),
    graphStore,
    artifactStore,
    jobQueue,
    modelAdapter,
  });
}

describe("worker launch boundary", () => {
  it("returns a worker launch report for a composed runtime without polling or executing jobs", () => {
    const runtime = createTestRuntime();

    const report = prepareWorkerRuntimeLaunch(runtime, {
      queues: ["research-runs", "artifact-maintenance"],
      maxConcurrentJobs: 2,
    });

    assert.equal(report.ok, true);
    assert.equal(report.kind, "worker");
    assert.equal(report.environment, "test");
    assert.equal(report.runtime, runtime);
    assert.equal(report.preflight.ok, true);
    assert.deepEqual(report.preflight.failures, []);
    assert.deepEqual(report.queues, ["research-runs", "artifact-maintenance"]);
    assert.equal(report.maxConcurrentJobs, 2);
    assert.deepEqual(report.plannedServices, [
      "worker-loop",
      "job-queue",
      "graph-store",
      "artifact-store",
      "model-adapter",
    ]);
    assert.equal(report.pollingStarted, false);
    assert.equal(report.jobsDequeued, false);
    assert.equal(report.jobsExecuted, false);
    assert.equal(report.clientsConstructed, false);
  });

  it("fails closed when runtime config preflight fails", () => {
    const runtime = createAtlieraRuntime({
      config: parseAtlieraRuntimeConfig({ ATL_ENV: "production" }),
      graphStore: new InMemoryGraphStore(),
      artifactStore: new InMemoryArtifactStore(),
      jobQueue: new InMemoryJobQueue(),
      modelAdapter: new FakeModelAdapter(),
    });

    const report = prepareWorkerRuntimeLaunch(runtime, { queues: ["research-runs"] });

    assert.equal(report.ok, false);
    assert.equal(report.kind, "worker");
    assert.equal(report.environment, "production");
    assert.deepEqual(
      report.preflight.failures.map((failure) => failure.code),
      [
        "missing_public_base_url",
        "missing_database_url",
        "missing_artifact_store",
        "missing_queue_backend",
        "missing_model_provider",
      ],
    );
    assert.equal(report.pollingStarted, false);
    assert.equal(report.jobsDequeued, false);
    assert.equal(report.jobsExecuted, false);
    assert.equal(report.clientsConstructed, false);
  });

  it("rejects unsafe queue names before any worker loop can start", () => {
    assert.throws(
      () => prepareWorkerRuntimeLaunch(createTestRuntime(), { queues: ["redis://queue"] }),
      /queue name must be a logical/,
    );
  });

  it("does not touch runtime dependencies before worker execution exists", () => {
    const runtime = createPoisonRuntime();

    const report = prepareWorkerRuntimeLaunch(runtime, { queues: ["research-runs"] });

    assert.equal(report.ok, true);
    assert.equal(report.runtime, runtime);
    assert.deepEqual(report.queues, ["research-runs"]);
    assert.equal(report.pollingStarted, false);
    assert.equal(report.jobsDequeued, false);
    assert.equal(report.jobsExecuted, false);
    assert.equal(report.clientsConstructed, false);
  });

  it("rejects invalid concurrency before any worker loop can start", () => {
    assert.throws(
      () =>
        prepareWorkerRuntimeLaunch(createTestRuntime(), {
          queues: ["research-runs"],
          maxConcurrentJobs: 0,
        }),
      /maxConcurrentJobs must be a positive integer/,
    );
  });

  it("uses only supplied runtime config rather than process.env", () => {
    const previous = process.env.ATL_ENV;
    process.env.ATL_ENV = "production";
    try {
      const report = prepareWorkerRuntimeLaunch(createTestRuntime(), {
        queues: ["research-runs"],
      });

      assert.equal(report.ok, true);
      assert.equal(report.environment, "test");
    } finally {
      if (previous === undefined) {
        delete process.env.ATL_ENV;
      } else {
        process.env.ATL_ENV = previous;
      }
    }
  });
});
