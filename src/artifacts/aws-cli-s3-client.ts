import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { S3ArtifactStoreClient, S3GetObjectInput, S3GetObjectOutput, S3PutObjectInput } from "./s3-store.ts";

const execFileAsync = promisify(execFile);
const ONE_MEGABYTE = 1024 * 1024;
const AWS_CLI_TOOLING_PREFLIGHT_TIMEOUT_MS = 1_000;

export interface AwsCliS3CompatibilityClientOptions {
  region?: string;
  endpointUrl?: string;
}

export interface AwsCliToolingPreflightCheck {
  readonly name: "aws_cli_available";
  readonly status: "pass" | "fail";
  readonly code: "aws_cli_available" | "aws_cli_unavailable";
  readonly message: string;
}

export interface AwsCliToolingPreflightReport {
  readonly ok: boolean;
  readonly checks: readonly AwsCliToolingPreflightCheck[];
}

export async function checkAwsCliS3CompatibilityTooling(): Promise<AwsCliToolingPreflightReport> {
  try {
    await execFileAsync("aws", ["--version"], {
      env: awsCliToolingPreflightEnv(),
      maxBuffer: ONE_MEGABYTE,
      timeout: AWS_CLI_TOOLING_PREFLIGHT_TIMEOUT_MS,
    });
    return toolingReport({
      name: "aws_cli_available",
      status: "pass",
      code: "aws_cli_available",
      message: "AWS CLI executable responded to --version; credentials and bucket access were not checked",
    });
  } catch {
    return toolingReport({
      name: "aws_cli_available",
      status: "fail",
      code: "aws_cli_unavailable",
      message: "AWS CLI executable was unavailable or did not respond; details were sanitized",
    });
  }
}

export class AwsCliS3CompatibilityClient implements S3ArtifactStoreClient {
  private readonly region: string | undefined;
  private readonly endpointUrl: string | undefined;

  constructor(options: AwsCliS3CompatibilityClientOptions) {
    if (!isOptionalSafeCliValue(options.region)) {
      throw new Error("AwsCliS3CompatibilityClient region must be a non-empty safe CLI value when provided");
    }
    if (!isOptionalSafeCliValue(options.endpointUrl)) {
      throw new Error("AwsCliS3CompatibilityClient endpointUrl must be a non-empty safe CLI value when provided");
    }
    if (!options.region && !options.endpointUrl) {
      throw new Error("AwsCliS3CompatibilityClient requires an explicit region or endpoint URL");
    }
    this.region = options.region;
    this.endpointUrl = options.endpointUrl;
  }

  async putObject(input: S3PutObjectInput): Promise<void> {
    const tempDir = await mkdtemp(join(tmpdir(), "atliera-aws-cli-s3-put-"));
    const bodyPath = join(tempDir, "body.txt");
    try {
      await writeFile(bodyPath, input.body, "utf8");
      await this.runAws([
        "s3api",
        "put-object",
        "--bucket",
        input.bucket,
        "--key",
        input.key,
        "--body",
        bodyPath,
        "--content-type",
        input.contentType,
        "--metadata",
        formatMetadata(input.metadata),
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async getObject(input: S3GetObjectInput): Promise<S3GetObjectOutput | undefined> {
    const tempDir = await mkdtemp(join(tmpdir(), "atliera-aws-cli-s3-get-"));
    const outputPath = join(tempDir, "body.txt");
    try {
      const result = await this.runAwsAllowNotFound([
        "s3api",
        "get-object",
        "--bucket",
        input.bucket,
        "--key",
        input.key,
        outputPath,
      ]);
      if (!result) return undefined;
      const metadata = parseGetObjectMetadata(result.stdout);
      const body = await readFile(outputPath, "utf8");
      return {
        body,
        contentType: metadata.contentType,
        metadata: metadata.metadata,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private awsArgs(args: string[]): string[] {
    const globals: string[] = [];
    if (this.region) globals.push("--region", this.region);
    if (this.endpointUrl) globals.push("--endpoint-url", this.endpointUrl);
    return [...globals, ...args];
  }

  private async runAws(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execFileAsync("aws", this.awsArgs(args), { maxBuffer: ONE_MEGABYTE });
    } catch {
      throw new Error("AwsCliS3CompatibilityClient dependency failed");
    }
  }

  private async runAwsAllowNotFound(args: string[]): Promise<{ stdout: string; stderr: string } | undefined> {
    try {
      return await execFileAsync("aws", this.awsArgs(args), { maxBuffer: ONE_MEGABYTE });
    } catch (e) {
      if (isNotFoundError(e)) return undefined;
      throw new Error("AwsCliS3CompatibilityClient dependency failed");
    }
  }
}

function toolingReport(check: AwsCliToolingPreflightCheck): AwsCliToolingPreflightReport {
  return Object.freeze({
    ok: check.status === "pass",
    checks: Object.freeze([Object.freeze({ ...check })]),
  });
}

function awsCliToolingPreflightEnv(): NodeJS.ProcessEnv {
  return Object.freeze({
    PATH: process.env.PATH ?? "",
  });
}

function formatMetadata(metadata: Readonly<Record<string, string>>): string {
  return Object.entries(metadata)
    .map(([key, value]) => {
      if (!isSafeMetadataToken(key) || !isSafeMetadataToken(value)) {
        throw new Error("AwsCliS3CompatibilityClient metadata must use safe AWS CLI shorthand values");
      }
      return `${key}=${value}`;
    })
    .join(",");
}

function isSafeMetadataToken(value: string): boolean {
  return value.trim() === value && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f,=]/.test(value);
}

function parseGetObjectMetadata(stdout: string): { contentType: string; metadata: Readonly<Record<string, string>> } {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid");
    const record = parsed as { ContentType?: unknown; Metadata?: unknown };
    if (typeof record.ContentType !== "string" || !record.Metadata || typeof record.Metadata !== "object" || Array.isArray(record.Metadata)) {
      throw new Error("invalid");
    }
    const metadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(record.Metadata as Record<string, unknown>)) {
      if (typeof value !== "string") throw new Error("invalid");
      metadata[key] = value;
    }
    return { contentType: record.ContentType, metadata: Object.freeze(metadata) };
  } catch {
    throw new Error("AwsCliS3CompatibilityClient returned invalid object metadata");
  }
}

function isNotFoundError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const stderr = "stderr" in e && typeof e.stderr === "string" ? e.stderr : "";
  return /NoSuchKey|NotFound|Not Found|404/i.test(stderr);
}

function isOptionalSafeCliValue(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value.trim() === value && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
}
