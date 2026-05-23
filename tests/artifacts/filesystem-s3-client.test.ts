import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { validateS3ArtifactStoreCompatibility } from "../../src/artifacts/s3-compatibility.ts";
import { FilesystemS3CompatibilityClient } from "../../src/artifacts/filesystem-s3-client.ts";

describe("FilesystemS3CompatibilityClient", () => {
  it("validates the S3-compatible ArtifactStore path against a persistent filesystem-backed client", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-s3-validation-"));
    try {
      const client = new FilesystemS3CompatibilityClient({ rootDir });

      const report = await validateS3ArtifactStoreCompatibility({
        client,
        bucket: "atliera-validation-test",
        prefix: "lab-prefix",
        probeId: "filesystem-probe-1",
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
        ],
      );
      assert.doesNotMatch(JSON.stringify(report), /atliera-validation-test|lab-prefix|tmp|secret|token/i);

      const persistedObject = JSON.parse(
        await readFile(
          join(
            rootDir,
            "buckets",
            "atliera-validation-test",
            "objects",
            `${encodedObjectKey("lab-prefix/s3-compatibility/filesystem-probe-1/round-trip.txt")}.json`,
          ),
          "utf8",
        ),
      ) as { body: string };
      assert.equal(persistedObject.body, "atliera s3 compatibility validation");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists object body, content type, and metadata across client instances", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-s3-validation-"));
    try {
      const firstClient = new FilesystemS3CompatibilityClient({ rootDir });
      await firstClient.putObject({
        bucket: "atliera-validation-test",
        key: "probe/object.txt",
        body: "first",
        contentType: "text/plain",
        metadata: { stage: "first" },
      });
      await firstClient.putObject({
        bucket: "atliera-validation-test",
        key: "probe/object.txt",
        body: "second",
        contentType: "text/markdown",
        metadata: { stage: "second", validation: "filesystem" },
      });

      const secondClient = new FilesystemS3CompatibilityClient({ rootDir });
      const object = await secondClient.getObject({ bucket: "atliera-validation-test", key: "probe/object.txt" });

      assert.deepEqual(object, {
        body: "second",
        contentType: "text/markdown",
        metadata: { stage: "second", validation: "filesystem" },
      });
      assert.equal(await secondClient.getObject({ bucket: "atliera-validation-test", key: "probe/missing.txt" }), undefined);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves distinct S3 keys even when one key name looks like the other key's storage internals", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-s3-validation-"));
    try {
      const client = new FilesystemS3CompatibilityClient({ rootDir });
      await client.putObject({
        bucket: "atliera-validation-test",
        key: "probe/object.txt",
        body: "parent-object",
        contentType: "text/plain",
        metadata: { object: "parent" },
      });
      await client.putObject({
        bucket: "atliera-validation-test",
        key: "probe/object.txt/body.txt",
        body: "child-object",
        contentType: "text/plain",
        metadata: { object: "child" },
      });

      assert.deepEqual(await client.getObject({ bucket: "atliera-validation-test", key: "probe/object.txt" }), {
        body: "parent-object",
        contentType: "text/plain",
        metadata: { object: "parent" },
      });
      assert.deepEqual(await client.getObject({ bucket: "atliera-validation-test", key: "probe/object.txt/body.txt" }), {
        body: "child-object",
        contentType: "text/plain",
        metadata: { object: "child" },
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects unsafe bucket and key inputs before writing outside the object root", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-s3-validation-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "atliera-s3-outside-"));
    try {
      const client = new FilesystemS3CompatibilityClient({ rootDir });

      await assert.rejects(
        () =>
          client.putObject({
            bucket: "127.0.0.1",
            key: "probe/object.txt",
            body: "body",
            contentType: "text/plain",
            metadata: {},
          }),
        /bucket must be a safe logical bucket name/,
      );

      await assert.rejects(
        () =>
          client.putObject({
            bucket: "atliera-validation-test",
            key: "../outside.txt",
            body: "body",
            contentType: "text/plain",
            metadata: {},
          }),
        /object key must be a safe relative key/,
      );

      await client.putObject({
        bucket: "atliera-validation-test",
        key: "safe/object.txt",
        body: "body",
        contentType: "text/plain",
        metadata: {},
      });
      await symlink(
        outsideDir,
        join(rootDir, "buckets", "atliera-validation-test", "objects", `${encodedObjectKey("safe/linked/escape.txt")}.json`),
      );

      await assert.rejects(
        () =>
          client.putObject({
            bucket: "atliera-validation-test",
            key: "safe/linked/escape.txt",
            body: "escape",
            contentType: "text/plain",
            metadata: {},
          }),
        /resolved object path escaped the filesystem S3 root/,
      );

      await writeFile(join(outsideDir, "read-escape.json"), JSON.stringify({ body: "outside", contentType: "text/plain", metadata: { escaped: "true" } }), "utf8");
      await symlink(
        join(outsideDir, "read-escape.json"),
        join(rootDir, "buckets", "atliera-validation-test", "objects", `${encodedObjectKey("safe/linked/read-escape.txt")}.json`),
      );
      await assert.rejects(
        () => client.getObject({ bucket: "atliera-validation-test", key: "safe/linked/read-escape.txt" }),
        /resolved object path escaped the filesystem S3 root/,
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("does not read process.env while constructing or using the client", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-s3-validation-"));
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });

    try {
      const client = new FilesystemS3CompatibilityClient({ rootDir });
      await client.putObject({
        bucket: "atliera-validation-test",
        key: "probe/object.txt",
        body: "body",
        contentType: "text/plain",
        metadata: { validation: "filesystem" },
      });
      const object = await client.getObject({ bucket: "atliera-validation-test", key: "probe/object.txt" });
      assert.equal(object?.body, "body");
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

function encodedObjectKey(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}
