import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  S3ArtifactStore,
  type S3ArtifactStoreClient,
  type S3GetObjectInput,
  type S3PutObjectInput,
} from "../../src/artifacts/s3-store.ts";
import type { ArtifactStore } from "../../src/artifacts/store.ts";

class RecordingS3Client implements S3ArtifactStoreClient {
  readonly puts: S3PutObjectInput[] = [];
  readonly gets: S3GetObjectInput[] = [];
  readonly objects = new Map<
    string,
    { body: string; contentType: string; metadata: Record<string, string> }
  >();

  async putObject(input: S3PutObjectInput): Promise<void> {
    this.puts.push({ ...input, metadata: { ...input.metadata } });
    this.objects.set(`${input.bucket}/${input.key}`, {
      body: input.body,
      contentType: input.contentType,
      metadata: { ...input.metadata },
    });
  }

  async getObject(input: S3GetObjectInput) {
    this.gets.push({ ...input });
    const object = this.objects.get(`${input.bucket}/${input.key}`);
    if (object === undefined) {
      return undefined;
    }

    return {
      body: object.body,
      contentType: object.contentType,
      metadata: { ...object.metadata },
    };
  }
}

describe("S3ArtifactStore", () => {
  it("stores and retrieves text artifacts through the ArtifactStore interface using logical keys", async () => {
    const client = new RecordingS3Client();
    const store: ArtifactStore = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      prefix: "tenant-a/",
      client,
    });

    await store.putText("runs/run-1/manifest.json", "{\"ok\":true}\n", {
      contentType: "application/json",
      metadata: { run_slug: "run-1" },
    });

    assert.deepEqual(client.puts, [
      {
        bucket: "atliera-artifacts-test",
        key: "tenant-a/runs/run-1/manifest.json",
        body: "{\"ok\":true}\n",
        contentType: "application/json",
        metadata: { run_slug: "run-1" },
      },
    ]);

    const artifact = await store.getText("runs/run-1/manifest.json");

    assert.deepEqual(client.gets, [
      { bucket: "atliera-artifacts-test", key: "tenant-a/runs/run-1/manifest.json" },
    ]);
    assert.deepEqual(artifact, {
      key: "runs/run-1/manifest.json",
      content: "{\"ok\":true}\n",
      contentType: "application/json",
      metadata: { run_slug: "run-1" },
    });
  });

  it("returns undefined when the object backend reports not found", async () => {
    const store = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      client: new RecordingS3Client(),
    });

    assert.equal(await store.getText("runs/missing/manifest.json"), undefined);
  });

  it("rejects unsafe logical keys before touching the S3 client", async () => {
    const client = new RecordingS3Client();
    const store = new S3ArtifactStore({ bucket: "atliera-artifacts-test", client });

    await assert.rejects(
      () => store.putText("runs/../manifest.json", "{}", { contentType: "application/json" }),
      /artifact key must/,
    );
    await assert.rejects(() => store.getText("https://bucket.example.invalid/key"), /artifact key must/);

    assert.equal(client.puts.length, 0);
    assert.equal(client.gets.length, 0);
  });

  it("rejects unsafe bucket and prefix config without reading environment defaults", () => {
    for (const bucket of ["", "AtlieraArtifacts", "atliera_artifacts", "192.168.0.1"]) {
      assert.throws(
        () => new S3ArtifactStore({ bucket, client: new RecordingS3Client() }),
        /S3ArtifactStore bucket must be a non-empty logical bucket name/,
      );
    }

    assert.throws(
      () =>
        new S3ArtifactStore({
          bucket: "atliera-artifacts-test",
          prefix: "../prod/",
          client: new RecordingS3Client(),
        }),
      /S3ArtifactStore prefix must be a relative prefix/,
    );
  });

  it("enforces explicit max payload bytes before writing", async () => {
    const client = new RecordingS3Client();
    const store = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      maxPayloadBytes: 4,
      client,
    });

    await assert.rejects(
      () => store.putText("runs/run-1/large.txt", "12345", { contentType: "text/plain" }),
      /artifact payload exceeds configured maxPayloadBytes/,
    );
    assert.equal(client.puts.length, 0);
  });

  it("emits sanitized operation lifecycle events without exposing payloads or backend paths", async () => {
    const client = new RecordingS3Client();
    const events: Array<{ operation: string; status: string; key: string; objectKey?: string; durationMs: number }> = [];
    const store = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      prefix: "tenant-a",
      client,
      observe: (event) => events.push(event),
    });

    await store.putText("runs/run-1/manifest.json", "secret payload body", {
      contentType: "application/json",
      metadata: { run_slug: "run-1" },
    });
    await store.getText("runs/run-1/manifest.json");

    assert.deepEqual(
      events.map((event) => ({ operation: event.operation, status: event.status, key: event.key })),
      [
        { operation: "putText", status: "start", key: "runs/run-1/manifest.json" },
        { operation: "putText", status: "success", key: "runs/run-1/manifest.json" },
        { operation: "getText", status: "start", key: "runs/run-1/manifest.json" },
        { operation: "getText", status: "success", key: "runs/run-1/manifest.json" },
      ],
    );
    for (const event of events) {
      assert.equal(event.objectKey, undefined);
      assert.equal(typeof event.durationMs, "number");
      assert.ok(event.durationMs >= 0);
      assert.doesNotMatch(JSON.stringify(event), /secret payload body|tenant-a/);
    }
  });

  it("keeps observer failures from changing storage outcomes", async () => {
    const client = new RecordingS3Client();
    const store = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      client,
      observe: () => {
        throw new Error("observer failed");
      },
    });

    await store.putText("runs/run-1/manifest.json", "{}", { contentType: "application/json" });
    assert.deepEqual(await store.getText("runs/run-1/manifest.json"), {
      key: "runs/run-1/manifest.json",
      content: "{}",
      contentType: "application/json",
      metadata: {},
    });
  });

  it("wraps backend errors with sanitized stable operation context", async () => {
    const secretBearingClient: S3ArtifactStoreClient = {
      async putObject() {
        throw new Error("AWS_SECRET_ACCESS_KEY=should-not-leak bucket=prod-private");
      },
      async getObject() {
        throw new Error("signedUrl=https://example.invalid/signed?token=should-not-leak");
      },
    };
    const store = new S3ArtifactStore({
      bucket: "atliera-artifacts-test",
      prefix: "safe-prefix",
      client: secretBearingClient,
    });

    await assert.rejects(
      () => store.putText("runs/run-1/manifest.json", "{}", { contentType: "application/json" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /S3ArtifactStore putText failed/);
        assert.match(error.message, /dependency_unavailable/);
        assert.doesNotMatch(error.message, /should-not-leak|AWS_SECRET_ACCESS_KEY|signedUrl|prod-private/);
        return true;
      },
    );

    await assert.rejects(
      () => store.getText("runs/run-1/manifest.json"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /S3ArtifactStore getText failed/);
        assert.match(error.message, /dependency_unavailable/);
        assert.doesNotMatch(error.message, /should-not-leak|AWS_SECRET_ACCESS_KEY|signedUrl|prod-private/);
        return true;
      },
    );
  });
});
