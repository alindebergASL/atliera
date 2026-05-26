import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  InMemoryArtifactStore,
  assertSafeArtifactKey,
  type ArtifactStore,
} from "../../src/artifacts/store.ts";

describe("ArtifactStore seam", () => {
  it("stores and retrieves artifacts through an implementation-neutral interface", async () => {
    const store: ArtifactStore = new InMemoryArtifactStore();

    await store.putText("runs/run-1/manifest.json", "{\"ok\":true}\n", {
      contentType: "application/json",
      metadata: { run_slug: "run-1" },
    });

    const artifact = await store.getText("runs/run-1/manifest.json");

    assert.deepEqual(artifact, {
      key: "runs/run-1/manifest.json",
      content: "{\"ok\":true}\n",
      contentType: "application/json",
      metadata: { run_slug: "run-1" },
    });
  });

  it("returns undefined for missing artifacts rather than inventing storage defaults", async () => {
    const store = new InMemoryArtifactStore();

    assert.equal(await store.getText("runs/missing/manifest.json"), undefined);
  });

  it("rejects traversal, absolute paths, blank keys, and URL-like keys", () => {
    for (const key of [
      "",
      "/runs/run-1/manifest.json",
      "runs/../manifest.json",
      "runs//manifest.json",
      "runs/run-1/./manifest.json",
      "https://artifacts.example.invalid/runs/run-1/manifest.json",
    ]) {
      assert.throws(() => assertSafeArtifactKey(key), /artifact key must/);
    }
  });

  it("rejects unsafe keys before writing", async () => {
    const store = new InMemoryArtifactStore();

    await assert.rejects(
      () => store.putText("runs/../manifest.json", "{}", { contentType: "application/json" }),
      /artifact key must/,
    );

    await assert.rejects(
      () => store.getText("runs/../manifest.json"),
      /artifact key must/,
    );
  });

  it("rejects accessor-backed metadata before persisting artifacts", async () => {
    const store = new InMemoryArtifactStore();
    const metadata = Object.defineProperty({}, "run_slug", {
      enumerable: true,
      get() {
        throw new Error("metadata getter leaked secret");
      },
    }) as Record<string, string>;

    await assert.rejects(
      () => store.putText("runs/run-1/manifest.json", "{}", { contentType: "application/json", metadata }),
      /artifact metadata must be a plain string record/,
    );
    assert.equal(await store.getText("runs/run-1/manifest.json"), undefined);
  });

  it("preserves enumerable metadata only while treating __proto__ as data", async () => {
    const store = new InMemoryArtifactStore();
    const metadata = Object.defineProperty({ run_slug: "run-1" }, "hidden", {
      enumerable: false,
      value: "do-not-copy",
    }) as Record<string, string>;
    Object.defineProperty(metadata, "__proto__", {
      enumerable: true,
      value: "literal-proto-value",
    });

    await store.putText("runs/run-1/manifest.json", "{}", { contentType: "application/json", metadata });
    const artifact = await store.getText("runs/run-1/manifest.json");

    assert.deepEqual(Object.keys(artifact?.metadata ?? {}).sort(), ["__proto__", "run_slug"]);
    assert.equal(artifact?.metadata.__proto__, "literal-proto-value");
    assert.equal((artifact?.metadata as Record<string, string>).hidden, undefined);
  });

  it("rejects proxy-backed metadata with a stable error", async () => {
    const store = new InMemoryArtifactStore();
    const metadata = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("proxy trap leaked secret");
        },
      },
    ) as Record<string, string>;

    await assert.rejects(
      () => store.putText("runs/run-1/proxy.json", "{}", { contentType: "application/json", metadata }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /artifact metadata must be a plain string record/);
        assert.doesNotMatch(error.message, /proxy trap leaked secret/);
        return true;
      },
    );
  });
});
