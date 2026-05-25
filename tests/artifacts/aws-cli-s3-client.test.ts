import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AwsCliS3CompatibilityClient } from "../../src/artifacts/aws-cli-s3-client.ts";

describe("AwsCliS3CompatibilityClient", () => {
  test("rejects AWS CLI shorthand-ambiguous metadata before invoking tooling", async () => {
    const client = new AwsCliS3CompatibilityClient({ region: "us-test-1" });

    await assert.rejects(
      () => client.putObject({
        bucket: "atliera-lab-validation",
        key: "s3-compatibility/probe/artifact.txt",
        body: "hello",
        contentType: "text/plain",
        metadata: { validation: "s3-compatibility,ambiguous" },
      }),
      /metadata must use safe AWS CLI shorthand values/,
    );
  });

  test("uses a bounded default operation timeout", () => {
    const client = new AwsCliS3CompatibilityClient({ region: "us-test-1" });
    assert.equal((client as unknown as { timeoutMs: number }).timeoutMs, 10_000);
  });

  test("rejects missing region or endpoint at construction time", () => {
    assert.throws(
      () => new AwsCliS3CompatibilityClient({}),
      /requires an explicit region or endpoint URL/,
    );
  });

  test("rejects unsafe operation timeout values at construction time", () => {
    assert.throws(
      () => new AwsCliS3CompatibilityClient({ region: "us-test-1", timeoutMs: 249 }),
      /timeoutMs must be an integer between 250 and 300000/,
    );
    assert.throws(
      () => new AwsCliS3CompatibilityClient({ region: "us-test-1", timeoutMs: 300_001 }),
      /timeoutMs must be an integer between 250 and 300000/,
    );
    assert.throws(
      () => new AwsCliS3CompatibilityClient({ region: "us-test-1", timeoutMs: 1.5 }),
      /timeoutMs must be an integer between 250 and 300000/,
    );
  });
});
