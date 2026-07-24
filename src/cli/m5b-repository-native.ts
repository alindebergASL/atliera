import { pathToFileURL } from "node:url";

import {
  applyM5bRepositoryNative,
  prepareM5bRepositoryNative,
  type M5bRepositoryNativeSourceKind,
} from "../workshop/m5b-repository-native.ts";

function parseArgs(values: readonly string[]): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--") || out.has(key)) {
      throw new Error("arguments must be unique explicit --name value pairs");
    }
    out.set(key, value);
  }
  return out;
}

function requireArg(args: ReadonlyMap<string, string>, name: string): string {
  const value = args.get(name);
  if (!value) throw new Error(`missing required argument ${name}`);
  return value;
}

function assertOnly(args: ReadonlyMap<string, string>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  for (const key of args.keys()) {
    if (!set.has(key)) throw new Error(`unknown argument ${key}`);
  }
}

async function execute(values: readonly string[]): Promise<string> {
  const [command, ...rest] = values;
  const args = parseArgs(rest);
  if (command === "prepare") {
    const allowed = ["--source", "--output", "--source-kind", "--expected-source-sha256",
      "--expected-source-size", "--owner-authorization-id", "--execution-commit", "--execution-tree"];
    assertOnly(args, allowed);
    const sourceKind = requireArg(args, "--source-kind") as M5bRepositoryNativeSourceKind;
    const sizeText = requireArg(args, "--expected-source-size");
    if (!/^[1-9][0-9]*$/.test(sizeText)) throw new Error("--expected-source-size must be a positive integer");
    const result = await prepareM5bRepositoryNative({
      sourcePath: requireArg(args, "--source"),
      outputDir: requireArg(args, "--output"),
      expectedSource: {
        kind: sourceKind,
        sha256: requireArg(args, "--expected-source-sha256"),
        size: Number(sizeText),
      },
      ownerAuthorizationId: requireArg(args, "--owner-authorization-id"),
      executionCommit: requireArg(args, "--execution-commit"),
      executionTree: requireArg(args, "--execution-tree"),
    });
    return `${JSON.stringify(result, null, 2)}\n`;
  }
  if (command === "apply") {
    const allowed = ["--prepared", "--ratification", "--graph-store", "--output",
      "--expected-ratification-sha256", "--expected-owner-authorization-id",
      "--expected-execution-commit", "--expected-execution-tree"];
    assertOnly(args, allowed);
    const result = await applyM5bRepositoryNative({
      preparedDir: requireArg(args, "--prepared"),
      ratificationPath: requireArg(args, "--ratification"),
      graphStoreRoot: requireArg(args, "--graph-store"),
      outputDir: requireArg(args, "--output"),
      expectedRatificationSha256: requireArg(args, "--expected-ratification-sha256"),
      expectedOwnerAuthorizationId: requireArg(args, "--expected-owner-authorization-id"),
      expectedExecutionCommit: requireArg(args, "--expected-execution-commit"),
      expectedExecutionTree: requireArg(args, "--expected-execution-tree"),
    });
    return `${JSON.stringify(result, null, 2)}\n`;
  }
  throw new Error("usage: m5b-repository-native <prepare|apply> with explicit arguments");
}

export interface M5bRepositoryNativeCliResult {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
}

export async function invokeM5bRepositoryNativeCli(
  values: readonly string[],
): Promise<M5bRepositoryNativeCliResult> {
  try {
    return Object.freeze({ exitCode: 0, stdout: await execute(values), stderr: "" });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const code = typeof error === "object" && error !== null && "code" in error &&
      typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "invalid_request";
    return Object.freeze({
      exitCode: 1,
      stdout: "",
      stderr: `${JSON.stringify({ ok: false, name, code })}\n`,
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  invokeM5bRepositoryNativeCli(process.argv.slice(2)).then((result) => {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
}
