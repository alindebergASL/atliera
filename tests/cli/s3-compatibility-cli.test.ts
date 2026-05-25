import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-s3-compatibility-cli-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[], options: { env?: NodeJS.ProcessEnv } = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/s3-compatibility.ts", ...args], {
      cwd: process.cwd(),
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function withFakeAws<T>(fn: (env: NodeJS.ProcessEnv, rootDir: string) => Promise<T>): Promise<T> {
  return withFakeAwsScript(fakeAwsScript, fn);
}

async function withFakeAwsScript<T>(
  scriptFactory: (rootDir: string) => string,
  fn: (env: NodeJS.ProcessEnv, rootDir: string) => Promise<T>,
): Promise<T> {
  return withTempDir(async (dir) => {
    const actualBinDir = join(dir, "bin");
    const rootDir = join(dir, "objects");
    await mkdir(actualBinDir);
    const awsPath = join(actualBinDir, "aws");
    await writeFile(awsPath, scriptFactory(rootDir), "utf8");
    await chmod(awsPath, 0o755);
    return fn({ ...process.env, PATH: `${actualBinDir}${delimiter}${process.env.PATH ?? ""}`, FAKE_AWS_S3_ROOT: rootDir }, rootDir);
  });
}

function fakeAwsScript(rootDir: string): string {
  return `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = ${JSON.stringify(rootDir)};
function value(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}
function objectPath(bucket, key) {
  const encodedKey = Buffer.from(key).toString('base64url');
  return path.join(root, bucket, encodedKey + '.json');
}
let args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write('aws-cli/2.0.0 fake\\n');
  process.exit(0);
}
while (args[0] === '--region' || args[0] === '--endpoint-url') {
  args = args.slice(2);
}
if (args[0] !== 's3api') {
  process.stderr.write('unsupported fake aws command\\n');
  process.exit(2);
}
const op = args[1];
const bucket = value('--bucket');
const key = value('--key');
if (!bucket || !key) process.exit(2);
const file = objectPath(bucket, key);
if (op === 'put-object') {
  const bodyPath = value('--body');
  const contentType = value('--content-type') || 'application/octet-stream';
  const metadataValue = value('--metadata') || '';
  const metadata = {};
  for (const pair of metadataValue.split(',')) {
    if (!pair) continue;
    const [k, ...rest] = pair.split('=');
    metadata[k] = rest.join('=');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ body: fs.readFileSync(bodyPath, 'utf8'), contentType, metadata }));
  process.stdout.write(JSON.stringify({ ETag: 'fake' }));
  process.exit(0);
}
if (op === 'get-object') {
  const outputPath = args[args.length - 1];
  if (!fs.existsSync(file)) {
    process.stderr.write('An error occurred (NoSuchKey) when calling the GetObject operation: Not Found\\n');
    process.exit(254);
  }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(outputPath, record.body, 'utf8');
  process.stdout.write(JSON.stringify({ ContentType: record.contentType, Metadata: record.metadata }));
  process.exit(0);
}
process.stderr.write('unsupported fake aws s3api operation\\n');
process.exit(2);
`;
}

function hangingAwsScript(): string {
  return `#!/usr/bin/env node
setTimeout(() => {}, 60000);
`;
}

function hangingS3OperationAwsScript(): string {
  return `#!/usr/bin/env node
if (process.argv[2] === '--version') {
  process.stdout.write('aws-cli/2.0.0 fake\\n');
  process.exit(0);
}
const fs = require('node:fs');
if (process.env.ATL_FAKE_AWS_HANG_ONCE) {
  if (!fs.existsSync(process.env.ATL_FAKE_AWS_HANG_ONCE)) {
    fs.writeFileSync(process.env.ATL_FAKE_AWS_HANG_ONCE, 'hung');
    setTimeout(() => {}, 60000);
  }
  process.exit(1);
}
setTimeout(() => {}, 60000);
`;
}

function credentialSniffingAwsScript(): string {
  return `#!/usr/bin/env node
const forbidden = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_PROFILE',
  'AWS_CONFIG_FILE',
  'AWS_SHARED_CREDENTIALS_FILE',
  'HOME',
];
const leaked = forbidden.filter((key) => process.env[key]);
if (leaked.length > 0) {
  process.stderr.write('credential environment leaked: ' + leaked.join(',') + '\\n');
  process.exit(42);
}
if (process.argv[2] !== '--version') process.exit(2);
process.stdout.write('aws-cli/2.0.0 fake\\n');
`;
}

describe("s3-compatibility CLI", () => {
  test("checks AWS CLI tooling availability without requiring bucket or probe inputs", async () => {
    await withFakeAws(async (env, rootDir) => {
      const result = await runCli(["check-aws-cli"], { env });

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "check-aws-cli");
      assert.equal(payload.backend.adapter, "s3_compatible");
      assert.equal(payload.backend.client, "aws_cli_s3api");
      assert.equal(payload.backend.contract, "s3_compatible_object_api");
      assert.equal(payload.backend.provider_binding, "not_bound_tooling_preflight");
      assert.equal(payload.backend.validation_scope, "tooling_preflight_no_bucket_access");
      assert.equal(payload.report.ok, true);
      assert.deepEqual(payload.report.checks, [
        {
          name: "aws_cli_available",
          status: "pass",
          code: "aws_cli_available",
          message: "AWS CLI executable responded to --version; credentials and bucket access were not checked",
        },
      ]);
      assert.doesNotMatch(result.stdout, /aws-cli\/2\.0\.0|atliera-lab-validation|secret|token|signed/i);
      assert.doesNotMatch(result.stdout, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal(result.stderr, "");
    });
  });

  test("does not expose credential-bearing environment to the AWS CLI tooling preflight", async () => {
    await withFakeAwsScript(credentialSniffingAwsScript, async (env) => {
      const result = await runCli(["check-aws-cli"], {
        env: {
          ...env,
          AWS_ACCESS_KEY_ID: "test-access-key",
          AWS_SECRET_ACCESS_KEY: "test-secret-key",
          AWS_SESSION_TOKEN: "test-session-token",
          AWS_PROFILE: "test-profile",
          AWS_CONFIG_FILE: "/tmp/test-aws-config",
          AWS_SHARED_CREDENTIALS_FILE: "/tmp/test-aws-credentials",
          HOME: "/tmp/test-home-with-credentials",
        },
      });

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.report.checks[0].code, "aws_cli_available");
      assert.doesNotMatch(result.stdout, /test-access-key|test-secret-key|test-session-token|test-profile|credential environment leaked/i);
      assert.equal(result.stderr, "");
    });
  });

  test("fails the AWS CLI tooling preflight with sanitized output when tooling is unavailable", async () => {
    await withTempDir(async (pathOnlyDir) => {
      const result = await runCli(["check-aws-cli"], { env: { ...process.env, PATH: pathOnlyDir } });

      assert.equal(result.code, 1);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.command, "check-aws-cli");
      assert.equal(payload.report.ok, false);
      assert.deepEqual(payload.report.checks, [
        {
          name: "aws_cli_available",
          status: "fail",
          code: "aws_cli_unavailable",
          message: "AWS CLI executable was unavailable or did not respond; details were sanitized",
        },
      ]);
      assert.doesNotMatch(result.stdout, /ENOENT|spawn|PATH|secret|token|signed/i);
      assert.equal(result.stderr, "");
    });
  });

  test("writes sanitized AWS CLI tooling preflight evidence without bucket access", async () => {
    await withTempDir(async (pathOnlyDir) => {
      const outRoot = join(pathOnlyDir, "evidence");
      await mkdir(outRoot);
      const result = await runCli([
        "check-aws-cli",
        "--out-root",
        outRoot,
        "--out-file",
        "tooling/aws-cli.json",
      ], { env: { ...process.env, PATH: pathOnlyDir } });

      assert.equal(result.code, 1);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.command, "check-aws-cli");
      assert.equal(payload.evidence.artifact_written, true);
      assert.equal(payload.backend.validation_scope, "tooling_preflight_no_bucket_access");
      assert.equal(payload.report.checks[0].code, "aws_cli_unavailable");

      const artifact = JSON.parse(await readFile(join(outRoot, "tooling", "aws-cli.json"), "utf8"));
      assert.deepEqual(artifact, payload);
      assert.doesNotMatch(result.stdout, new RegExp(outRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(JSON.stringify(artifact), /ENOENT|spawn|PATH|secret|token|signed/i);
      assert.equal(result.stderr, "");
    });
  });

  test("rejects preflight allow-overwrite without an evidence output target before invoking AWS tooling", async () => {
    await withFakeAws(async (env, rootDir) => {
      const result = await runCli(["check-aws-cli", "--allow-overwrite"], { env });

      assert.equal(result.code, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^usage:/);
      await assert.rejects(stat(rootDir), { code: "ENOENT" });
    });
  });

  test("times out the AWS CLI tooling preflight with sanitized output when tooling hangs", async () => {
    await withFakeAwsScript(hangingAwsScript, async (env) => {
      const startedAt = Date.now();
      const result = await runCli(["check-aws-cli"], { env });
      const durationMs = Date.now() - startedAt;

      assert.equal(result.code, 1);
      assert.equal(durationMs < 5000, true, `expected timeout before hanging fake aws completed, got ${durationMs}ms`);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.report.checks[0].code, "aws_cli_unavailable");
      assert.doesNotMatch(result.stdout, /SIGTERM|timeout|10000|secret|token|signed/i);
      assert.equal(result.stderr, "");
    });
  });

  test("validates a lab AWS CLI S3-compatible backend and emits sanitized real-backend evidence", async () => {
    await withFakeAws(async (env, rootDir) => {
      const result = await runCli([
        "validate-aws-cli",
        "--bucket",
        "atliera-lab-validation",
        "--prefix",
        "s3-compatibility-validation",
        "--probe-id",
        "lab-probe-1",
        "--approval-ref",
        "lab-approval-1",
        "--region",
        "us-test-1",
      ], { env });

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "validate-aws-cli");
      assert.equal(payload.backend.adapter, "s3_compatible");
      assert.equal(payload.backend.client, "aws_cli_s3api");
      assert.equal(payload.backend.contract, "s3_compatible_object_api");
      assert.equal(payload.backend.provider_binding, "operator_supplied_endpoint_or_region");
      assert.equal(payload.backend.validation_scope, "lab_only_real_backend");
      assert.equal(payload.backend.object_lifecycle, "operator_cleanup_required");
      assert.equal(payload.backend.approval, "operator_approval_ref_present");
      assert.equal(payload.backend.emulator_limit, undefined);
      assert.equal(payload.report.ok, true);
      assert.deepEqual(
        payload.report.checks.map((check: { name: string; status: string }) => [check.name, check.status]),
        [
          ["round_trip_text", "pass"],
          ["missing_object_returns_undefined", "pass"],
          ["overwrite_last_write_wins", "pass"],
          ["prefix_isolation", "pass"],
          ["max_payload_guard", "pass"],
        ],
      );
      assert.doesNotMatch(result.stdout, /atliera-lab-validation|s3-compatibility-validation|lab-approval-1|us-test-1|secret|token|signed/i);
      assert.doesNotMatch(result.stdout, new RegExp(rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  });

  test("writes sanitized lab AWS CLI validation evidence under an explicit output root", async () => {
    await withFakeAws(async (env) => {
      await withTempDir(async (outputRoot) => {
        const result = await runCli([
          "validate-aws-cli",
          "--bucket",
          "atliera-lab-validation",
          "--prefix",
          "s3-compatibility-validation",
          "--probe-id",
          "lab-probe-evidence",
          "--approval-ref",
          "lab-approval-evidence",
          "--region",
          "us-test-1",
          "--out-root",
          outputRoot,
          "--out-file",
          "evidence/atliera-lab-validation/us-test-1/lab-approval-evidence.json",
        ], { env });

        assert.equal(result.code, 0, result.stderr);
        const stdoutPayload = JSON.parse(result.stdout);
        assert.equal(stdoutPayload.ok, true);
        assert.deepEqual(stdoutPayload.evidence, { artifact_written: true });
        assert.equal(stdoutPayload.evidence_path, undefined);
        const evidencePath = join(outputRoot, "evidence", "atliera-lab-validation", "us-test-1", "lab-approval-evidence.json");
        const filePayload = JSON.parse(await readFile(evidencePath, "utf8"));
        assert.deepEqual(filePayload, stdoutPayload);
        assert.equal(filePayload.backend.approval, "operator_approval_ref_present");
        assert.doesNotMatch(result.stdout, /atliera-lab-validation|s3-compatibility-validation|lab-approval-evidence|us-test-1|secret|token|signed/i);
      });
    });
  });

  test("refuses unsafe lab AWS CLI evidence paths before invoking AWS tooling", async () => {
    await withFakeAwsScript(() => `#!/usr/bin/env node\nprocess.stderr.write('aws should not be invoked for unsafe evidence output\\n');\nprocess.exit(42);\n`, async (env) => {
      await withTempDir(async (outputRoot) => {
        const baseArgs = [
          "validate-aws-cli",
          "--bucket",
          "atliera-lab-validation",
          "--prefix",
          "s3-compatibility-validation",
          "--probe-id",
          "lab-probe-unsafe-output",
          "--approval-ref",
          "lab-approval-unsafe-output",
          "--region",
          "us-test-1",
          "--out-root",
          outputRoot,
        ];
        const traversal = await runCli([...baseArgs, "--out-file", "../escape.json"], { env });

        assert.equal(traversal.code, 2);
        assert.match(traversal.stderr, /evidence output path rejected/i);
        assert.doesNotMatch(traversal.stderr, /aws should not be invoked|atliera-lab-validation|lab-approval-unsafe-output|us-test-1|escape|tmp/i);

        const nonJson = await runCli([...baseArgs, "--out-file", "evidence/report.txt"], { env });
        assert.equal(nonJson.code, 2);
        assert.match(nonJson.stderr, /evidence output path rejected/i);
        assert.doesNotMatch(nonJson.stderr, /aws should not be invoked|atliera-lab-validation|lab-approval-unsafe-output|us-test-1|report\.txt/i);

        const existingFile = "evidence/atliera-lab-validation/us-test-1/lab-approval-unsafe-output.json";
        await mkdir(join(outputRoot, "evidence", "atliera-lab-validation", "us-test-1"), { recursive: true });
        await writeFile(join(outputRoot, existingFile), "{}", "utf8");
        const overwrite = await runCli([...baseArgs, "--out-file", existingFile], { env });
        assert.equal(overwrite.code, 2);
        assert.match(overwrite.stderr, /evidence output path rejected/i);
        assert.doesNotMatch(overwrite.stderr, /aws should not be invoked|atliera-lab-validation|lab-approval-unsafe-output|us-test-1|tmp/i);
      });
    });
  });

  test("times out hung lab AWS CLI S3 operations with sanitized output", async () => {
    await withFakeAwsScript(hangingS3OperationAwsScript, async (env) => {
      await withTempDir(async (markerRoot) => {
        const startedAt = Date.now();
        const result = await runCli([
          "validate-aws-cli",
          "--bucket",
          "atliera-lab-validation",
          "--prefix",
          "s3-compatibility-validation",
          "--probe-id",
          "lab-probe-hung-operation",
          "--approval-ref",
          "lab-approval-hung-operation",
          "--region",
          "us-test-1",
          "--aws-timeout-ms",
          "250",
        ], { env: { ...env, ATL_FAKE_AWS_HANG_ONCE: join(markerRoot, "hung-once") } });
        const durationMs = Date.now() - startedAt;

        assert.equal(result.code, 1);
        assert.equal(durationMs < 5000, true, `expected hung AWS operation to time out, got ${durationMs}ms`);
        assert.equal(result.stderr, "");
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.ok, false);
        assert.equal(payload.command, "validate-aws-cli");
        assert.equal(payload.backend.client, "aws_cli_s3api");
        assert.equal(payload.backend.timeout, "operator_configured_timeout_present");
        assert.equal(payload.report.ok, false);
        assert.match(result.stdout, /s3_compatibility_dependency_failure/);
        assert.doesNotMatch(result.stdout, /atliera-lab-validation|s3-compatibility-validation|lab-approval-hung-operation|us-test-1|250|SIGTERM|secret|token|signed/i);
      });
    });
  });

  test("rejects unsafe lab AWS CLI timeout values before invoking AWS tooling", async () => {
    await withFakeAwsScript(() => `#!/usr/bin/env node\nprocess.stderr.write('aws should not be invoked for unsafe timeout\\n');\nprocess.exit(42);\n`, async (env) => {
      const result = await runCli([
        "validate-aws-cli",
        "--bucket",
        "atliera-lab-validation",
        "--prefix",
        "s3-compatibility-validation",
        "--probe-id",
        "lab-probe-timeout-rejected",
        "--approval-ref",
        "lab-approval-timeout-rejected",
        "--region",
        "us-test-1",
        "--aws-timeout-ms",
        "249",
      ], { env });

      assert.equal(result.code, 2);
      assert.match(result.stderr, /usage:/);
      assert.doesNotMatch(result.stderr, /aws should not be invoked|atliera-lab-validation|lab-approval-timeout-rejected|us-test-1|249/i);
    });
  });

  test("rejects lab AWS CLI allow-overwrite without an evidence output target before invoking AWS tooling", async () => {
    await withFakeAws(async (env, rootDir) => {
      const result = await runCli([
        "validate-aws-cli",
        "--bucket",
        "atliera-lab-validation",
        "--prefix",
        "s3-compatibility-validation",
        "--probe-id",
        "lab-probe-overwrite-rejected",
        "--approval-ref",
        "lab-approval-overwrite-rejected",
        "--region",
        "us-test-1",
        "--allow-overwrite",
      ], { env });

      assert.equal(result.code, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^usage:/);
      await assert.rejects(stat(rootDir), { code: "ENOENT" });
    });
  });

  test("requires explicit bucket, prefix, probe id, approval ref, and region or endpoint for AWS CLI validation", async () => {
    const result = await runCli([
      "validate-aws-cli",
      "--bucket",
      "atliera-lab-validation",
      "--prefix",
      "s3-compatibility-validation",
      "--probe-id",
      "lab-probe-2",
      "--region",
      "us-test-1",
    ]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/);
    assert.doesNotMatch(result.stderr, /atliera-lab-validation|lab-probe-2|us-test-1/);
  });

  test("fails closed with sanitized output when AWS CLI tooling is unavailable", async () => {
    await withTempDir(async (pathOnlyDir) => {
      const result = await runCli([
        "validate-aws-cli",
        "--bucket",
        "atliera-lab-validation",
        "--prefix",
        "s3-compatibility-validation",
        "--probe-id",
        "lab-probe-3",
        "--approval-ref",
        "lab-approval-3",
        "--region",
        "us-test-1",
      ], { env: { ...process.env, PATH: pathOnlyDir } });

      assert.equal(result.code, 1);
      assert.equal(result.stderr, "");
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.command, "validate-aws-cli");
      assert.equal(payload.backend.client, "aws_cli_s3api");
      assert.equal(payload.report.ok, false);
      assert.match(result.stdout, /s3_compatibility_dependency_failure/);
      assert.doesNotMatch(result.stdout, /atliera-lab-validation|s3-compatibility-validation|us-test-1|ENOENT|spawn|PATH/i);
      assert.doesNotMatch(result.stderr, /atliera-lab-validation|s3-compatibility-validation|us-test-1|ENOENT|spawn|PATH/i);
    });
  });

  test("validates the filesystem-backed S3 compatibility client and emits a sanitized report", async () => {
    await withTempDir(async (rootDir) => {
      const result = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--prefix",
        "validation-prefix",
        "--probe-id",
        "cli-probe-1",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "validate-filesystem");
      assert.equal(payload.backend.adapter, "s3_compatible");
      assert.equal(payload.backend.client, "filesystem_s3_compatibility");
      assert.equal(payload.backend.contract, "s3_compatible_object_api");
      assert.equal(payload.backend.provider_binding, "none");
      assert.equal(payload.backend.object_lifecycle, "local_root_operator_managed");
      assert.equal(payload.backend.emulator_limit, "filesystem-backed local emulator; not proof of provider-specific S3 behavior");
      assert.equal(payload.report.ok, true);
      assert.deepEqual(
        payload.report.checks.map((check: { name: string; status: string }) => [check.name, check.status]),
        [
          ["round_trip_text", "pass"],
          ["missing_object_returns_undefined", "pass"],
          ["overwrite_last_write_wins", "pass"],
          ["prefix_isolation", "pass"],
          ["max_payload_guard", "pass"],
        ],
      );
      assert.doesNotMatch(result.stdout, /atliera-validation-test|validation-prefix|secret|token|signed/i);
      await stat(join(rootDir, "buckets"));
    });
  });

  test("requires explicit root, bucket, and probe arguments", async () => {
    const result = await runCli(["validate-filesystem", "--bucket", "atliera-validation-test"]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/);
  });

  test("rejects duplicate flags and unsafe probe identifiers before writing objects", async () => {
    await withTempDir(async (rootDir) => {
      const duplicate = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--probe-id",
        "cli-probe-2",
      ]);
      assert.equal(duplicate.code, 2);
      assert.match(duplicate.stderr, /usage:/);

      const unsafeProbe = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--probe-id",
        "../prod",
      ]);
      assert.equal(unsafeProbe.code, 2);
      assert.match(unsafeProbe.stderr, /validation configuration rejected/);
      assert.doesNotMatch(unsafeProbe.stderr, /prod/);

      await assert.rejects(() => stat(join(rootDir, "buckets")), /ENOENT/);
    });
  });

  test("rejects unsafe bucket and prefix values without leaking them or writing objects", async () => {
    await withTempDir(async (rootDir) => {
      const invalidBucket = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "../secret-bucket",
        "--probe-id",
        "cli-probe-3",
      ]);
      assert.equal(invalidBucket.code, 2);
      assert.match(invalidBucket.stderr, /validation configuration rejected/);
      assert.doesNotMatch(invalidBucket.stderr, /secret-bucket/);

      const invalidPrefix = await runCli([
        "validate-filesystem",
        "--root-dir",
        rootDir,
        "--bucket",
        "atliera-validation-test",
        "--prefix",
        "../secret-prefix",
        "--probe-id",
        "cli-probe-4",
      ]);
      assert.equal(invalidPrefix.code, 2);
      assert.match(invalidPrefix.stderr, /validation configuration rejected/);
      assert.doesNotMatch(invalidPrefix.stderr, /secret-prefix/);

      await assert.rejects(() => stat(join(rootDir, "buckets")), /ENOENT/);
    });
  });
});
