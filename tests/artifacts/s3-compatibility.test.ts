import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  validateS3ArtifactStoreCompatibility,
  type S3CompatibilityValidationCheckName,
} from "../../src/artifacts/s3-compatibility.ts";
import type { S3ArtifactStoreClient, S3GetObjectInput, S3PutObjectInput } from "../../src/artifacts/s3-store.ts";

class CompatibilityS3Client implements S3ArtifactStoreClient {
  readonly puts: S3PutObjectInput[] = [];
  readonly gets: S3GetObjectInput[] = [];
  readonly objects = new Map<string, { body: string; contentType: string; metadata: Record<string, string> }>();

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
    if (object === undefined) return undefined;
    return {
      body: object.body,
      contentType: object.contentType,
      metadata: { ...object.metadata },
    };
  }
}

class CorruptingReadClient extends CompatibilityS3Client {
  override async getObject(input: S3GetObjectInput) {
    const object = await super.getObject(input);
    if (object === undefined) return undefined;
    return { ...object, body: `${object.body}-corrupted` };
  }
}

describe("S3-compatible ArtifactStore validation harness", () => {
  it("validates roundtrip, not-found, overwrite, prefix isolation, and payload-limit behavior through an injected client", async () => {
    const client = new CompatibilityS3Client();

    const report = await validateS3ArtifactStoreCompatibility({
      client,
      bucket: "atliera-validation-test",
      prefix: "validation-prefix",
      probeId: "probe-run-1",
      maxPayloadBytes: 64,
    });

    assert.equal(report.ok, true);
    assert.deepEqual(
      report.checks.map((check) => [check.name, check.status]),
      [
        ["round_trip_text", "pass"],
        ["missing_object_returns_undefined", "pass"],
        ["overwrite_last_write_wins", "pass"],
        ["prefix_isolation", "pass"],
        ["max_payload_guard", "pass"],
      ] satisfies Array<[S3CompatibilityValidationCheckName, "pass"]>,
    );
    assert.deepEqual(report.backend, {
      adapter: "s3_compatible",
      client: "injected",
      contract: "s3_compatible_object_api",
      provider_binding: "none",
    });
    assert.match(report.probeNamespace, /^s3-compatibility\/probe-run-1\//);

    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /atliera-validation-test|validation-prefix|secret|token|signed/i);
    assert.equal(client.puts.some((put) => put.key.startsWith("validation-prefix/s3-compatibility/probe-run-1/")), true);
  });

  it("fails closed with sanitized mismatch details when backend behavior violates the adapter contract", async () => {
    const report = await validateS3ArtifactStoreCompatibility({
      client: new CorruptingReadClient(),
      bucket: "atliera-validation-test",
      prefix: "validation-prefix",
      probeId: "probe-run-2",
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks[0]?.name, "round_trip_text");
    assert.equal(report.checks[0]?.status, "fail");
    assert.equal(report.checks[0]?.code, "s3_compatibility_roundtrip_mismatch");
    assert.doesNotMatch(JSON.stringify(report), /atliera-validation-test|validation-prefix|corrupted/);
  });

  it("rejects unsafe validation config before touching the injected client", async () => {
    const client = new CompatibilityS3Client();

    await assert.rejects(
      () =>
        validateS3ArtifactStoreCompatibility({
          client,
          bucket: "atliera-validation-test",
          prefix: "validation-prefix",
          probeId: "../prod",
        }),
      /probeId must be a safe logical identifier/,
    );

    assert.equal(client.puts.length, 0);
    assert.equal(client.gets.length, 0);
  });

  it("does not read process.env while defining or running compatibility checks", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });

    try {
      const report = await validateS3ArtifactStoreCompatibility({
        client: new CompatibilityS3Client(),
        bucket: "atliera-validation-test",
        probeId: "probe-run-3",
      });
      assert.equal(report.ok, true);
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
