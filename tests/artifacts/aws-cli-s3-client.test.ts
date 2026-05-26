import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, test } from "node:test";

import { AwsCliS3CompatibilityClient } from "../../src/artifacts/aws-cli-s3-client.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-aws-cli-s3-client-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withFakeAwsScript<T>(script: string, fn: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  return withTempDir(async (dir) => {
    const binDir = join(dir, "bin");
    await mkdir(binDir);
    const awsPath = join(binDir, "aws");
    await writeFile(awsPath, script, "utf8");
    await chmod(awsPath, 0o755);
    return fn({ ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}` });
  });
}

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

  test("omits AWS CLI metadata flag for empty metadata maps", async () => {
    await withTempDir(async (dir) => {
      const callsPath = join(dir, "calls.jsonl");
      const fakeAws = `#!/usr/bin/env node
const fs = require('node:fs');
const callsPath = ${JSON.stringify(callsPath)};
const args = process.argv.slice(2);
fs.appendFileSync(callsPath, JSON.stringify(args) + '\\n');
const metadataIndex = args.indexOf('--metadata');
if (metadataIndex !== -1 && (args[metadataIndex + 1] === undefined || args[metadataIndex + 1] === '')) {
  process.stderr.write('empty metadata shorthand rejected by real aws cli\\n');
  process.exit(42);
}
process.stdout.write(JSON.stringify({ ETag: 'fake' }));
`;
      const originalEnv = process.env;
      await withFakeAwsScript(fakeAws, async (env) => {
        process.env = env;
        try {
          const client = new AwsCliS3CompatibilityClient({ region: "us-test-1" });
          await client.putObject({
            bucket: "atliera-lab-validation",
            key: "s3-compatibility/probe/empty-metadata.txt",
            body: "hello",
            contentType: "text/plain",
            metadata: {},
          });
        } finally {
          process.env = originalEnv;
        }
      });

      const calls = (await readFile(callsPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as string[]);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.includes("--metadata"), false);
    });
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
