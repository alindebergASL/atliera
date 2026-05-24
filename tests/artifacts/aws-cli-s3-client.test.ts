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

  test("rejects missing region or endpoint at construction time", () => {
    assert.throws(
      () => new AwsCliS3CompatibilityClient({}),
      /requires an explicit region or endpoint URL/,
    );
  });
});
