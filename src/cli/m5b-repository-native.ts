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

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
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
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "apply") {
    const allowed = ["--prepared", "--ratification", "--graph-store", "--output"];
    assertOnly(args, allowed);
    const result = await applyM5bRepositoryNative({
      preparedDir: requireArg(args, "--prepared"),
      ratificationPath: requireArg(args, "--ratification"),
      graphStoreRoot: requireArg(args, "--graph-store"),
      outputDir: requireArg(args, "--output"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  throw new Error("usage: m5b-repository-native <prepare|apply> with explicit arguments");
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : "Error";
  const code = typeof error === "object" && error !== null && "code" in error &&
    typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "invalid_request";
  process.stderr.write(`${JSON.stringify({ ok: false, name, code })}\n`);
  process.exitCode = 1;
});
