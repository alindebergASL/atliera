import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { FakeModelAdapter } from "../../src/agent/model-adapter.ts";
import { InMemoryArtifactStore } from "../../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import { InMemoryGraphStore } from "../../src/graph/store.ts";
import { InMemoryJobQueue } from "../../src/jobs/queue.ts";
import { createAtlieraRuntime } from "../../src/runtime/composition.ts";
import { prepareRuntimeLaunch } from "../../src/runtime/launch.ts";

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

describe("app launch boundary", () => {
  it("returns a launch-ready report for a composed runtime without starting an app server", () => {
    const runtime = createTestRuntime();

    const report = prepareRuntimeLaunch(runtime);

    assert.equal(report.ok, true);
    assert.equal(report.kind, "app");
    assert.equal(report.environment, "test");
    assert.equal(report.runtime, runtime);
    assert.equal(report.preflight.ok, true);
    assert.deepEqual(report.preflight.failures, []);
    assert.deepEqual(report.plannedServices, [
      "app-server",
      "graph-store",
      "artifact-store",
      "job-queue",
      "model-adapter",
    ]);
    assert.equal(report.serverStarted, false);
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

    const report = prepareRuntimeLaunch(runtime);

    assert.equal(report.ok, false);
    assert.equal(report.kind, "app");
    assert.equal(report.environment, "production");
    assert.equal(report.runtime, runtime);
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
    assert.equal(report.serverStarted, false);
    assert.equal(report.clientsConstructed, false);
  });

  it("uses only the supplied runtime config rather than process.env", () => {
    const previous = process.env.ATL_ENV;
    process.env.ATL_ENV = "production";
    try {
      const report = prepareRuntimeLaunch(createTestRuntime());

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
