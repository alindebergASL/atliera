import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { FakeModelAdapter } from "../../src/agent/model-adapter.ts";
import { InMemoryArtifactStore } from "../../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import { InMemoryGraphStore, type GraphStore } from "../../src/graph/store.ts";
import { InMemoryJobQueue } from "../../src/jobs/queue.ts";
import {
  createAtlieraRuntime,
  createInMemoryAtlieraRuntime,
} from "../../src/runtime/composition.ts";

describe("runtime composition seam", () => {
  it("assembles runtime services from explicit config and dependency inputs", () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "test",
      APP_BASE_URL: "https://app.example.invalid",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    });
    const graphStore = new InMemoryGraphStore();
    const artifactStore = new InMemoryArtifactStore();
    const jobQueue = new InMemoryJobQueue();
    const modelAdapter = new FakeModelAdapter();

    const runtime = createAtlieraRuntime({
      config,
      graphStore,
      artifactStore,
      jobQueue,
      modelAdapter,
    });

    assert.equal(runtime.config, config);
    assert.equal(runtime.graphStore, graphStore);
    assert.equal(runtime.artifactStore, artifactStore);
    assert.equal(runtime.jobQueue, jobQueue);
    assert.equal(runtime.modelAdapter, modelAdapter);
  });

  it("provides a named in-memory runtime for deterministic tests without production infrastructure defaults", () => {
    const runtime = createInMemoryAtlieraRuntime({ ATL_ENV: "test" });

    assert.equal(runtime.config.environment, "test");
    assert.equal(runtime.config.publicBaseUrl, undefined);
    assert.equal(runtime.config.databaseUrl, undefined);
    assert.equal(runtime.config.artifactStore, undefined);
    assert.equal(runtime.config.queueBackend, undefined);
    assert.equal(runtime.config.modelProvider, undefined);
    assert.ok(runtime.graphStore instanceof InMemoryGraphStore);
    assert.ok(runtime.artifactStore instanceof InMemoryArtifactStore);
    assert.ok(runtime.jobQueue instanceof InMemoryJobQueue);
    assert.ok(runtime.modelAdapter instanceof FakeModelAdapter);
  });

  it("uses explicit env input rather than process.env", () => {
    const previous = process.env.ATL_ENV;
    process.env.ATL_ENV = "production";
    try {
      const runtime = createInMemoryAtlieraRuntime({ ATL_ENV: "test" });

      assert.equal(runtime.config.environment, "test");
    } finally {
      if (previous === undefined) {
        delete process.env.ATL_ENV;
      } else {
        process.env.ATL_ENV = previous;
      }
    }
  });

  it("accepts graph stores through an interface rather than an in-memory concrete type", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "test" });
    const graphStore: GraphStore = {
      get snapshot() {
        return {
          sources: [],
          excerpts: [],
          claims: [],
          claim_evidence: [],
          account_objects: [],
          account_object_claims: [],
          research_runs: [],
          run_artifacts: [],
          audit_events: [],
        };
      },
      commit() {
        return undefined;
      },
    };
    const artifactStore = new InMemoryArtifactStore();
    const jobQueue = new InMemoryJobQueue();
    const modelAdapter = new FakeModelAdapter();

    const runtime = createAtlieraRuntime({
      config,
      graphStore,
      artifactStore,
      jobQueue,
      modelAdapter,
    });

    assert.equal(runtime.graphStore, graphStore);
  });

  it("refuses in-memory runtime composition for production-like environments", () => {
    assert.throws(
      () => createInMemoryAtlieraRuntime({ ATL_ENV: "production" }),
      /in-memory runtime is only allowed/,
    );
    assert.throws(
      () => createInMemoryAtlieraRuntime({ ATL_ENV: "staging" }),
      /in-memory runtime is only allowed/,
    );
  });
});
