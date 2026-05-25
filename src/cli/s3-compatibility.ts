// Local S3-compatible validation CLI.
//
// Usage:
//   tsx src/cli/s3-compatibility.ts check-aws-cli
//   tsx src/cli/s3-compatibility.ts validate-filesystem --root-dir <dir> --bucket <bucket> --probe-id <id> [--prefix <prefix>]
//   tsx src/cli/s3-compatibility.ts validate-aws-cli --bucket <bucket> --prefix <prefix> --probe-id <id> --approval-ref <ref> (--region <region> | --endpoint-url <url>)

import { exit } from "node:process";

import { AwsCliS3CompatibilityClient, checkAwsCliS3CompatibilityTooling } from "../artifacts/aws-cli-s3-client.ts";
import { FilesystemS3CompatibilityClient } from "../artifacts/filesystem-s3-client.ts";
import { validateS3ArtifactStoreCompatibility } from "../artifacts/s3-compatibility.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/s3-compatibility.ts check-aws-cli",
    "  tsx src/cli/s3-compatibility.ts validate-filesystem --root-dir <dir> --bucket <bucket> --probe-id <id> [--prefix <prefix>]",
    "  tsx src/cli/s3-compatibility.ts validate-aws-cli --bucket <bucket> --prefix <prefix> --probe-id <id> --approval-ref <ref> (--region <region> | --endpoint-url <url>)",
  ].join("\n");
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function parseValidateFilesystemArgs(args: string[]): {
  rootDir: string;
  bucket: string;
  prefix?: string;
  probeId: string;
} | null {
  const rootDir = parseFlagValue(args, "--root-dir");
  const bucket = parseFlagValue(args, "--bucket");
  const prefix = parseFlagValue(args, "--prefix") ?? undefined;
  const probeId = parseFlagValue(args, "--probe-id");
  const allowedFlags = new Set(["--root-dir", "--bucket", "--prefix", "--probe-id"]);

  if (!rootDir || !bucket || !probeId) return null;

  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    i += 1;
    if (!args[i] || args[i]!.startsWith("--")) return null;
  }

  return { rootDir, bucket, prefix, probeId };
}

function parseValidateAwsCliArgs(args: string[]): {
  bucket: string;
  prefix: string;
  probeId: string;
  approvalRef: string;
  region?: string;
  endpointUrl?: string;
} | null {
  const bucket = parseFlagValue(args, "--bucket");
  const prefix = parseFlagValue(args, "--prefix");
  const probeId = parseFlagValue(args, "--probe-id");
  const approvalRef = parseFlagValue(args, "--approval-ref");
  const region = parseFlagValue(args, "--region") ?? undefined;
  const endpointUrl = parseFlagValue(args, "--endpoint-url") ?? undefined;
  const allowedFlags = new Set(["--bucket", "--prefix", "--probe-id", "--approval-ref", "--region", "--endpoint-url"]);

  if (!bucket || !prefix || !probeId || !approvalRef || (!region && !endpointUrl)) return null;

  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    i += 1;
    if (!args[i] || args[i]!.startsWith("--")) return null;
  }

  return { bucket, prefix, probeId, approvalRef, region, endpointUrl };
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function printError(e: unknown): void {
  if (e instanceof Error && isValidationConfigError(e)) {
    process.stderr.write("validation configuration rejected\n");
    return;
  }
  process.stderr.write("s3 compatibility validation failed\n");
}

function isValidationConfigError(e: Error): boolean {
  return /probeId|rootDir|bucket|prefix|object key|contentType|metadata/.test(e.message);
}

async function run(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "check-aws-cli") {
    if (args.length !== 0) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const report = await checkAwsCliS3CompatibilityTooling();
    printJson({
      ok: report.ok,
      command: "check-aws-cli",
      backend: {
        adapter: "s3_compatible",
        client: "aws_cli_s3api",
        validation_scope: "tooling_preflight_no_bucket_access",
      },
      report,
    });
    return report.ok ? 0 : 1;
  }

  if (command === "validate-filesystem") {
    const parsedArgs = parseValidateFilesystemArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const client = new FilesystemS3CompatibilityClient({ rootDir: parsedArgs.rootDir });
    const report = await validateS3ArtifactStoreCompatibility({
      client,
      bucket: parsedArgs.bucket,
      prefix: parsedArgs.prefix,
      probeId: parsedArgs.probeId,
    });

    printJson({
      ok: report.ok,
      command: "validate-filesystem",
      backend: {
        adapter: "s3_compatible",
        client: "filesystem_s3_compatibility",
        emulator_limit: "filesystem-backed local emulator; not proof of provider-specific S3 behavior",
      },
      report,
    });
    return report.ok ? 0 : 1;
  }

  if (command === "validate-aws-cli") {
    const parsedArgs = parseValidateAwsCliArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const client = new AwsCliS3CompatibilityClient({ region: parsedArgs.region, endpointUrl: parsedArgs.endpointUrl });
    const report = await validateS3ArtifactStoreCompatibility({
      client,
      bucket: parsedArgs.bucket,
      prefix: parsedArgs.prefix,
      probeId: parsedArgs.probeId,
    });

    printJson({
      ok: report.ok,
      command: "validate-aws-cli",
      backend: {
        adapter: "s3_compatible",
        client: "aws_cli_s3api",
        validation_scope: "lab_only_real_backend",
        approval: "operator_approval_ref_present",
      },
      report,
    });
    return report.ok ? 0 : 1;
  }

  process.stderr.write(`${usage()}\n`);
  return 2;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof Error && isValidationConfigError(e)) exit(2);
    exit(1);
  });
