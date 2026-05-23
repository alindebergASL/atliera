import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { InMemoryArtifactStore, type ArtifactPutTextOptions } from "../../src/artifacts/store.ts";
import { defineArtifactStorePreflightCheck } from "../../src/runtime/artifact-store-preflight.ts";
import { runResourcePreflight } from "../../src/runtime/resource-preflight.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";

class RecordingArtifactStore extends InMemoryArtifactStore {
  readonly puts: Array<{ key: string; content: string; options: ArtifactPutTextOptions }> = [];
  readonly gets: string[] = [];

  override async putText(key: string, content: string, options: ArtifactPutTextOptions): Promise<void> {
    this.puts.push({ key, content, options });
    await super.putText(key, content, options);
  }

  override async getText(key: string) {
    this.gets.push(key);
    return super.getText(key);
  }
}

class FailingArtifactStore extends InMemoryArtifactStore {
  constructor(private readonly mode: "put" | "get") {
    super();
  }

  override async putText(key: string, content: string, options: ArtifactPutTextOptions): Promise<void> {
    if (this.mode === "put") {
      throw new Error("s3://private-bucket/probe failed with opaque-value abc123");
    }
    await super.putText(key, content, options);
  }

  override async getText(key: string) {
    if (this.mode === "get") {
      throw new Error("https://storage.example.invalid/private-path");
    }
    return super.getText(key);
  }
}

describe("artifact store resource preflight", () => {
  it("defines an artifact_store check that writes and reads a caller-scoped probe artifact", async () => {
    const store = new RecordingArtifactStore();
    const check = defineArtifactStorePreflightCheck({
      store,
      probeKey: "preflight/run-123/artifact-store.txt",
    });

    assert.equal(check.target, "artifact_store");
    assert.equal(check.name, "artifact store read write probe");

    const result = await check.run();

    assert.deepEqual(result, {
      status: "pass",
      code: "artifact_store_reachable",
      message: "artifact store read write probe passed",
      metadata: { adapter: "artifact_store", probe: "read_write" },
    });
    assert.equal(store.puts.length, 1);
    assert.equal(store.gets.length, 1);
    assert.equal(store.puts[0]?.key, "preflight/run-123/artifact-store.txt");
    assert.equal(store.gets[0], "preflight/run-123/artifact-store.txt");
    assert.equal(store.puts[0]?.options.contentType, "text/plain");
    assert.deepEqual(store.puts[0]?.options.metadata, { purpose: "resource-preflight" });
  });

  it("integrates with production-like resource preflight without constructing clients itself", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      { target: "database", name: "database ping", run: () => ({ status: "pass", code: "reachable", message: "ok" }) },
      defineArtifactStorePreflightCheck({
        store: new InMemoryArtifactStore(),
        probeKey: "preflight/staging-123/artifact-store.txt",
      }),
      { target: "queue_backend", name: "queue enqueue probe", run: () => ({ status: "pass", code: "enqueueable", message: "ok" }) },
      { target: "model_provider", name: "model credential probe", run: () => ({ status: "pass", code: "credentials_present", message: "ok" }) },
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
    assert.deepEqual(
      report.checks.map((check) => [check.target, check.code, check.status]),
      [
        ["database", "reachable", "pass"],
        ["artifact_store", "artifact_store_reachable", "pass"],
        ["queue_backend", "enqueueable", "pass"],
        ["model_provider", "credentials_present", "pass"],
      ],
    );
  });

  it("rejects unsafe probe keys before touching the artifact store", async () => {
    const store = new RecordingArtifactStore();

    assert.throws(
      () => defineArtifactStorePreflightCheck({ store, probeKey: "../private.txt" }),
      /artifact key/,
    );
    assert.equal(store.puts.length, 0);
    assert.equal(store.gets.length, 0);
  });

  it("returns sanitized failures when the artifact store write or read fails", async () => {
    for (const mode of ["put", "get"] as const) {
      const check = defineArtifactStorePreflightCheck({
        store: new FailingArtifactStore(mode),
        probeKey: `preflight/${mode}/artifact-store.txt`,
      });

      const result = await check.run();

      assert.equal(result.status, "fail");
      assert.equal(result.code, "artifact_store_unreachable");
      assert.equal(result.message, "artifact store read write probe failed");
      assert.deepEqual(result.metadata, { adapter: "artifact_store", probe: "read_write" });
      assert.doesNotMatch(JSON.stringify(result), /opaque-value|private-bucket|private-path|s3:\/\/|https:\/\//i);
    }
  });

  it("fails when the read-back content does not match the probe payload", async () => {
    class MismatchedArtifactStore extends InMemoryArtifactStore {
      override async getText(key: string) {
        const artifact = await super.getText(key);
        if (artifact === undefined) {
          return undefined;
        }
        return { ...artifact, content: "different" };
      }
    }

    const check = defineArtifactStorePreflightCheck({
      store: new MismatchedArtifactStore(),
      probeKey: "preflight/mismatch/artifact-store.txt",
    });

    const result = await check.run();

    assert.deepEqual(result, {
      status: "fail",
      code: "artifact_store_mismatch",
      message: "artifact store read write probe returned mismatched content",
      metadata: { adapter: "artifact_store", probe: "read_write" },
    });
  });
});
