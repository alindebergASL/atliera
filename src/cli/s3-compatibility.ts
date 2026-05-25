// Local S3-compatible validation CLI.
//
// Usage:
//   tsx src/cli/s3-compatibility.ts check-aws-cli
//   tsx src/cli/s3-compatibility.ts validate-filesystem --root-dir <dir> --bucket <bucket> --probe-id <id> [--prefix <prefix>]
//   tsx src/cli/s3-compatibility.ts validate-aws-cli --bucket <bucket> --prefix <prefix> --probe-id <id> --approval-ref <ref> (--region <region> | --endpoint-url <url>) [--aws-timeout-ms <ms>] [--out-root <dir> --out-file <relative.json> [--allow-overwrite]]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { exit } from "node:process";

import { AwsCliS3CompatibilityClient, checkAwsCliS3CompatibilityTooling } from "../artifacts/aws-cli-s3-client.ts";
import { guardOutputPath, PathGuardError } from "../io/path-guard.ts";
import { FilesystemS3CompatibilityClient } from "../artifacts/filesystem-s3-client.ts";
import { validateS3ArtifactStoreCompatibility } from "../artifacts/s3-compatibility.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/s3-compatibility.ts check-aws-cli [--out-root <dir> --out-file <relative.json> [--allow-overwrite]]",
    "  tsx src/cli/s3-compatibility.ts validate-filesystem --root-dir <dir> --bucket <bucket> --probe-id <id> [--prefix <prefix>]",
    "  tsx src/cli/s3-compatibility.ts validate-aws-cli --bucket <bucket> --prefix <prefix> --probe-id <id> --approval-ref <ref> (--region <region> | --endpoint-url <url>) [--aws-timeout-ms <ms>] [--out-root <dir> --out-file <relative.json> [--allow-overwrite]]",
  ].join("\n");
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function parseCheckAwsCliArgs(args: string[]): {
  outRoot?: string;
  outFile?: string;
  allowOverwrite: boolean;
} | null {
  const outRoot = parseFlagValue(args, "--out-root") ?? undefined;
  const outFile = parseFlagValue(args, "--out-file") ?? undefined;
  const allowOverwrite = args.includes("--allow-overwrite");
  const allowedFlags = new Set(["--out-root", "--out-file", "--allow-overwrite"]);

  if ((outRoot && !outFile) || (!outRoot && outFile)) return null;

  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    if (value === "--allow-overwrite") continue;
    i += 1;
    if (!args[i] || args[i]!.startsWith("--")) return null;
  }

  return { outRoot, outFile, allowOverwrite };
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
  timeoutMs?: number;
  timeoutConfigured: boolean;
  outRoot?: string;
  outFile?: string;
  allowOverwrite: boolean;
} | null {
  const bucket = parseFlagValue(args, "--bucket");
  const prefix = parseFlagValue(args, "--prefix");
  const probeId = parseFlagValue(args, "--probe-id");
  const approvalRef = parseFlagValue(args, "--approval-ref");
  const region = parseFlagValue(args, "--region") ?? undefined;
  const endpointUrl = parseFlagValue(args, "--endpoint-url") ?? undefined;
  const timeoutValue = parseFlagValue(args, "--aws-timeout-ms") ?? undefined;
  const timeoutMs = timeoutValue === undefined ? undefined : Number(timeoutValue);
  const outRoot = parseFlagValue(args, "--out-root") ?? undefined;
  const outFile = parseFlagValue(args, "--out-file") ?? undefined;
  const allowOverwrite = args.includes("--allow-overwrite");
  const allowedFlags = new Set(["--bucket", "--prefix", "--probe-id", "--approval-ref", "--region", "--endpoint-url", "--aws-timeout-ms", "--out-root", "--out-file", "--allow-overwrite"]);

  if (!bucket || !prefix || !probeId || !approvalRef || (!region && !endpointUrl)) return null;
  if (timeoutValue !== undefined && !isValidAwsTimeoutMs(timeoutMs)) return null;
  if ((outRoot && !outFile) || (!outRoot && outFile)) return null;

  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const value = args[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    if (value === "--allow-overwrite") continue;
    i += 1;
    if (!args[i] || args[i]!.startsWith("--")) return null;
  }

  return { bucket, prefix, probeId, approvalRef, region, endpointUrl, timeoutMs, timeoutConfigured: timeoutValue !== undefined, outRoot, outFile, allowOverwrite };
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function isValidAwsTimeoutMs(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 250 && value <= 300_000;
}

async function resolveEvidencePath(outputRoot: string, outputFile: string, allowOverwrite: boolean): Promise<string> {
  if (isAbsolute(outputFile)) {
    throw new PathGuardError("--out-file must be a relative .json path under --out-root");
  }
  if (!outputFile.endsWith(".json")) {
    throw new PathGuardError("--out-file must end in .json");
  }
  const guarded = await guardOutputPath({
    outputRoot,
    targetPath: resolve(outputRoot, outputFile),
    allowOverwrite,
    rejectRepoPaths: false,
    repoRoot: null,
  });
  return guarded.targetPath;
}

async function writeEvidenceJson(value: unknown, targetPath: string, allowOverwrite: boolean): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: allowOverwrite ? "w" : "wx" });
}

function printError(e: unknown): void {
  if (e instanceof PathGuardError) {
    process.stderr.write("evidence output path rejected\n");
    return;
  }
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
    const parsedArgs = parseCheckAwsCliArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const evidencePath = parsedArgs.outRoot && parsedArgs.outFile
      ? await resolveEvidencePath(parsedArgs.outRoot, parsedArgs.outFile, parsedArgs.allowOverwrite)
      : undefined;

    const report = await checkAwsCliS3CompatibilityTooling();
    const payload = {
      ok: report.ok,
      command: "check-aws-cli",
      backend: {
        adapter: "s3_compatible",
        client: "aws_cli_s3api",
        contract: "s3_compatible_object_api",
        provider_binding: "not_bound_tooling_preflight",
        validation_scope: "tooling_preflight_no_bucket_access",
      },
      ...(evidencePath ? { evidence: { artifact_written: true } } : {}),
      report,
    };
    if (evidencePath) {
      await writeEvidenceJson(payload, evidencePath, parsedArgs.allowOverwrite);
    }
    printJson(payload);
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
        contract: "s3_compatible_object_api",
        provider_binding: "none",
        object_lifecycle: "local_root_operator_managed",
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

    const evidencePath = parsedArgs.outRoot && parsedArgs.outFile
      ? await resolveEvidencePath(parsedArgs.outRoot, parsedArgs.outFile, parsedArgs.allowOverwrite)
      : undefined;

    const client = new AwsCliS3CompatibilityClient({ region: parsedArgs.region, endpointUrl: parsedArgs.endpointUrl, timeoutMs: parsedArgs.timeoutMs });
    const report = await validateS3ArtifactStoreCompatibility({
      client,
      bucket: parsedArgs.bucket,
      prefix: parsedArgs.prefix,
      probeId: parsedArgs.probeId,
    });

    const payload = {
      ok: report.ok,
      command: "validate-aws-cli",
      backend: {
        adapter: "s3_compatible",
        client: "aws_cli_s3api",
        contract: "s3_compatible_object_api",
        provider_binding: "operator_supplied_endpoint_or_region",
        validation_scope: "lab_only_real_backend",
        object_lifecycle: "operator_cleanup_required",
        approval: "operator_approval_ref_present",
        ...(parsedArgs.timeoutConfigured ? { timeout: "operator_configured_timeout_present" } : {}),
      },
      ...(evidencePath ? { evidence: { artifact_written: true } } : {}),
      report,
    };
    if (evidencePath) {
      await writeEvidenceJson(payload, evidencePath, parsedArgs.allowOverwrite);
    }
    printJson(payload);
    return report.ok ? 0 : 1;
  }

  process.stderr.write(`${usage()}\n`);
  return 2;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof PathGuardError) exit(2);
    if (e instanceof Error && isValidationConfigError(e)) exit(2);
    exit(1);
  });
