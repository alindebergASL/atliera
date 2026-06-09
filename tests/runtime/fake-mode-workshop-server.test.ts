import { createServer, type Server, type ServerResponse } from "node:http";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InMemoryArtifactStore } from "../../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import type { GraphStore } from "../../src/graph/store.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import { InMemoryJobQueue } from "../../src/jobs/queue.ts";
import type { RuntimeMode } from "../../src/modes/index.ts";
import { createAtlieraRuntime } from "../../src/runtime/composition.ts";
import {
  handleFakeModeWorkshopRequest,
  type FakeModeWorkshopServeResponse,
} from "../../src/runtime/fake-mode-workshop-server.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

const EMPTY_BUNDLE: GraphBundle = {
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

class CountingGraphStore implements GraphStore {
  snapshotReads = 0;
  commitCalls = 0;

  constructor(private readonly bundle: GraphBundle) {}

  get snapshot(): GraphBundle {
    this.snapshotReads += 1;
    return this.bundle;
  }

  commit(): void {
    this.commitCalls += 1;
    throw new Error("fake-mode Workshop server must not write graph state");
  }
}

function makeRuntime(graphStore: GraphStore, overrides: Record<string, string | undefined> = {}) {
  return createAtlieraRuntime({
    config: parseAtlieraRuntimeConfig({
      ATL_ENV: "test",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
      ...overrides,
    }),
    graphStore,
    artifactStore: new InMemoryArtifactStore(),
    jobQueue: new InMemoryJobQueue(),
    modelAdapter: {
      name: "throw-if-called-by-fake-mode-workshop-server",
      async propose(_input: { prompt: string; mode: RuntimeMode }) {
        throw new Error("fake-mode Workshop server must not call model adapters");
      },
    },
  });
}

function parseJsonResponse(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

function writeNodeResponse(target: ServerResponse, response: FakeModeWorkshopServeResponse): void {
  target.writeHead(response.statusCode, response.headers);
  target.end(response.body);
}

function createMountedFakeModeWorkshopHttpServer(runtime: ReturnType<typeof makeRuntime>): Server {
  return createServer((request, response) => {
    handleFakeModeWorkshopRequest(runtime, { method: request.method, path: request.url })
      .then((handled) => writeNodeResponse(response, handled))
      .catch(() =>
        writeNodeResponse(response, {
          statusCode: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            ok: false,
            kind: "fake-mode-workshop-test-internal-error",
            providerCallsMade: 0,
            productionWrites: false,
          }),
        }),
      );
  });
}

describe("fake-mode Workshop HTTP serve slice", () => {
  test("serves a healthcheck from an empty fake/local runtime without graph reads or side effects", async () => {
    const graphStore = new CountingGraphStore(EMPTY_BUNDLE);
    const response = await handleFakeModeWorkshopRequest(makeRuntime(graphStore), {
      method: "GET",
      path: "/healthz",
    });
    const body = parseJsonResponse(response);

    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /application\/json/);
    assert.equal(body.ok, true);
    assert.equal(body.kind, "fake-mode-workshop-healthcheck");
    assert.equal(body.environment, "test");
    assert.equal(body.graphSnapshotRead, false);
    assert.equal(body.providerCallsMade, 0);
    assert.equal(body.productionWrites, false);
    assert.equal(body.clientsConstructed, false);
    assert.equal(body.modelProviderClientConstructed, false);
    assert.equal(graphStore.snapshotReads, 0);
    assert.equal(graphStore.commitCalls, 0);
  });

  test("serves Workshop HTML with Signals, Maps, Plays, and evidence from the shared graph bundle", async () => {
    const graphStore = new CountingGraphStore(makeValidBundle());
    const response = await handleFakeModeWorkshopRequest(makeRuntime(graphStore), {
      method: "GET",
      path: "/workshop",
    });

    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["content-type"]), /text\/html/);
    assert.match(response.body, /Atliera Workshop/);
    assert.match(response.body, /Signals/);
    assert.match(response.body, /Maps/);
    assert.match(response.body, /Plays/);
    assert.match(response.body, /Fake-mode preview/i);
    assert.match(response.body, /Evidence packet/i);
    assert.equal(graphStore.snapshotReads, 1);
    assert.equal(graphStore.commitCalls, 0);
  });

  test("fails closed before graph reads outside fake/local mode", async () => {
    const graphStore = new CountingGraphStore(makeValidBundle());
    const response = await handleFakeModeWorkshopRequest(
      makeRuntime(graphStore, {
        ATL_ENV: "production",
        ARTIFACT_STORE: "memory",
        QUEUE_BACKEND: "memory",
        MODEL_PROVIDER: "fake",
      }),
      { method: "GET", path: "/workshop" },
    );
    const body = parseJsonResponse(response);

    assert.equal(response.statusCode, 503);
    assert.equal(body.ok, false);
    assert.deepEqual(body.failureCodes, [
      "fake_mode_workshop_server_requires_non_production_environment",
      "runtime_preflight_failed",
    ]);
    assert.equal(body.graphSnapshotRead, false);
    assert.equal(body.providerCallsMade, 0);
    assert.equal(body.productionWrites, false);
    assert.equal(graphStore.snapshotReads, 0);
    assert.equal(graphStore.commitCalls, 0);
  });

  test("fails closed before graph reads when MODEL_PROVIDER is not fake", async () => {
    const graphStore = new CountingGraphStore(makeValidBundle());
    const response = await handleFakeModeWorkshopRequest(
      makeRuntime(graphStore, { MODEL_PROVIDER: "real-provider" }),
      { method: "GET", path: "/workshop" },
    );
    const body = parseJsonResponse(response);

    assert.equal(response.statusCode, 503);
    assert.equal(body.ok, false);
    assert.deepEqual(body.failureCodes, ["fake_mode_workshop_server_requires_fake_model_provider"]);
    assert.equal(graphStore.snapshotReads, 0);
    assert.equal(graphStore.commitCalls, 0);
  });

  test("can be mounted as a real Node HTTP server without constructing provider clients", async () => {
    const graphStore = new CountingGraphStore(makeValidBundle());
    const server = createMountedFakeModeWorkshopHttpServer(makeRuntime(graphStore));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        throw new Error("expected TCP server address");
      }
      const url = `http://127.0.0.1:${address.port}/healthz`;
      const response = await fetch(url);
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.providerCallsMade, 0);
      assert.equal(body.productionWrites, false);
      assert.equal(body.clientsConstructed, false);
      assert.equal(body.modelProviderClientConstructed, false);
      assert.equal(graphStore.snapshotReads, 0);
      assert.equal(graphStore.commitCalls, 0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
