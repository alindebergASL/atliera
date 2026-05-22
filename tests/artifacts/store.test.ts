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
});
