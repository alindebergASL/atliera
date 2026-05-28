import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { InMemoryArtifactStore } from "../../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import type { GraphStore } from "../../src/graph/store.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import { InMemoryJobQueue } from "../../src/jobs/queue.ts";
import type { RuntimeMode } from "../../src/modes/index.ts";
import { createAtlieraRuntime } from "../../src/runtime/composition.ts";
import { prepareRuntimeWorkshopPreview } from "../../src/runtime/workshop-preview.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

class StaticGraphStore implements GraphStore {
  commitCalls = 0;

  constructor(private readonly bundle: GraphBundle) {}

  get snapshot(): GraphBundle {
    return this.bundle;
  }

  commit(): void {
    this.commitCalls += 1;
    throw new Error("workshop preview must not write graph state");
  }
}

function createPreviewRuntime(graphStore: GraphStore) {
  return createAtlieraRuntime({
    config: parseAtlieraRuntimeConfig({
      ATL_ENV: "test",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    }),
    graphStore,
    artifactStore: new InMemoryArtifactStore(),
    jobQueue: new InMemoryJobQueue(),
    modelAdapter: {
      name: "throw-if-called",
      async propose(_input: { prompt: string; mode: RuntimeMode }) {
        throw new Error("workshop preview must not call model adapters");
      },
    },
  });
}

describe("runtime Workshop preview", () => {
  it("builds a product-facing Workshop view model from the runtime graph snapshot without side effects", () => {
    const graphStore = new StaticGraphStore(makeValidBundle());
    const runtime = createPreviewRuntime(graphStore);

    const report = prepareRuntimeWorkshopPreview(runtime);

    assert.equal(report.ok, true);
    assert.equal(report.kind, "workshop-preview");
    assert.equal(report.environment, "test");
    assert.equal(report.preflight.ok, true);
    assert.equal(Object.hasOwn(report, "runtime"), false);
    assert.ok(report.viewModel);
    const viewModel = report.viewModel;
    assert.equal(viewModel.product_name, "Atliera");
    assert.equal(viewModel.surface, "Workshop");
    assert.equal(viewModel.generated_from, "graph_bundle");
    assert.equal(viewModel.totals.account_objects, 1);
    assert.equal(report.graphSnapshotRead, true);
    assert.equal(report.serverStarted, false);
    assert.equal(report.clientsConstructed, false);
    assert.equal(report.providerCallsMade, 0);
    assert.equal(report.productionWrites, false);
    assert.equal(graphStore.commitCalls, 0);
  });

  it("fails closed before reading graph state when runtime preflight fails", () => {
    const graphStore: GraphStore = {
      get snapshot(): GraphBundle {
        throw new Error("graph snapshot must not be read after failed preflight");
      },
      commit(): void {
        throw new Error("workshop preview must not write graph state");
      },
    };
    const runtime = createAtlieraRuntime({
      config: parseAtlieraRuntimeConfig({ ATL_ENV: "production" }),
      graphStore,
      artifactStore: new InMemoryArtifactStore(),
      jobQueue: new InMemoryJobQueue(),
      modelAdapter: {
        name: "throw-if-called",
        async propose(_input: { prompt: string; mode: RuntimeMode }) {
          throw new Error("workshop preview must not call model adapters");
        },
      },
    });

    const report = prepareRuntimeWorkshopPreview(runtime);

    assert.equal(report.ok, false);
    assert.equal(report.kind, "workshop-preview");
    assert.equal(report.environment, "production");
    assert.equal(Object.hasOwn(report, "runtime"), false);
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
    assert.equal(report.viewModel, undefined);
    assert.equal(report.graphSnapshotRead, false);
    assert.equal(report.serverStarted, false);
    assert.equal(report.clientsConstructed, false);
    assert.equal(report.providerCallsMade, 0);
    assert.equal(report.productionWrites, false);
  });

  it("fails closed before reading graph state when model provider config is not fake", () => {
    const graphStore: GraphStore = {
      get snapshot(): GraphBundle {
        throw new Error("graph snapshot must not be read for non-fake preview mode");
      },
      commit(): void {
        throw new Error("workshop preview must not write graph state");
      },
    };
    const runtime = createAtlieraRuntime({
      config: parseAtlieraRuntimeConfig({
        ATL_ENV: "test",
        ARTIFACT_STORE: "memory",
        QUEUE_BACKEND: "memory",
        MODEL_PROVIDER: "real-provider",
      }),
      graphStore,
      artifactStore: new InMemoryArtifactStore(),
      jobQueue: new InMemoryJobQueue(),
      modelAdapter: {
        name: "throw-if-called",
        async propose(_input: { prompt: string; mode: RuntimeMode }) {
          throw new Error("workshop preview must not call model adapters");
        },
      },
    });

    const report = prepareRuntimeWorkshopPreview(runtime);

    assert.equal(report.ok, false);
    assert.equal(report.viewModel, undefined);
    assert.equal(report.graphSnapshotRead, false);
    assert.equal(report.providerCallsMade, 0);
    assert.equal(report.productionWrites, false);
    assert.deepEqual(report.previewFailures, [
      {
        code: "workshop_preview_requires_fake_model_provider",
        message: "workshop preview requires MODEL_PROVIDER=fake",
      },
    ]);
  });

  it("uses only the supplied runtime config rather than process.env", () => {
    const previous = process.env.ATL_ENV;
    process.env.ATL_ENV = "production";
    try {
      const report = prepareRuntimeWorkshopPreview(
        createPreviewRuntime(new StaticGraphStore(makeValidBundle())),
      );

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
