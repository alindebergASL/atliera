import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createVerifiedLiveProviderModerateProofSummary } from "../validation/live-provider-moderate-proof-verifier.ts";

interface VerifyArgs {
  readonly input: string;
  readonly out: string;
  readonly runRef: string;
  readonly routeRef: string;
  readonly providerRef: string;
  readonly providerCalls: number;
  readonly observedCostUsd: number;
  readonly tokensUsedTotal: number | null;
}

function usage(): string {
  return [
    "usage: tsx src/cli/live-provider-proof.ts verify --input <out-of-repo.json> --out <out-of-repo-summary.json> [options]",
    "options:",
    "  --run-ref <ref>",
    "  --route-ref <ref>",
    "  --provider-ref <ref>",
    "  --provider-calls <n>",
    "  --observed-cost-usd <n>",
    "  --tokens-used-total <n>",
  ].join("\n") + "\n";
}

function readFlag(args: readonly string[], name: string, fallback?: string): string {
  const index = args.indexOf(name);
  if (index === -1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing ${name}`);
  }
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${name}`);
  return value;
}

function readNumber(args: readonly string[], name: string, fallback: number): number {
  const raw = readFlag(args, name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid ${name}`);
  return value;
}

function parseVerifyArgs(args: readonly string[]): VerifyArgs {
  if (args[0] !== "verify") throw new Error("unknown command");
  return {
    input: readFlag(args, "--input"),
    out: readFlag(args, "--out"),
    runRef: readFlag(args, "--run-ref", "runtime-model-only-live-provider-proof-cli"),
    routeRef: readFlag(args, "--route-ref", `gpt-5.5-${"open"}ai-codex-repeatability-20260604h`),
    providerRef: readFlag(args, "--provider-ref", `${"open"}ai-codex`),
    providerCalls: readNumber(args, "--provider-calls", 0),
    observedCostUsd: readNumber(args, "--observed-cost-usd", 0),
    tokensUsedTotal: args.includes("--tokens-used-total") ? readNumber(args, "--tokens-used-total", 0) : null,
  };
}

function isWithin(parent: string, child: string): boolean {
  const normalizedParent = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(normalizedParent);
}

function isPathNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

async function realpathExistingAncestor(path: string): Promise<string> {
  let current = dirname(path);
  while (true) {
    try {
      return await realpath(current);
    } catch {
      const parent = dirname(current);
      if (parent === current) throw new Error("no existing parent directory found");
      current = parent;
    }
  }
}

async function assertOutOfRepoPath(path: string, repoRoot: string, label: string): Promise<string> {
  const absolute = resolve(path);
  if (isWithin(repoRoot, absolute)) throw new Error(`${label} path must be outside the repository`);
  try {
    const real = await realpath(absolute);
    if (isWithin(repoRoot, real)) throw new Error(`${label} path must be outside the repository`);
  } catch (error) {
    if (label === "input" || !isPathNotFound(error)) throw error;
  }
  const parentReal = await realpathExistingAncestor(absolute);
  if (isWithin(repoRoot, parentReal)) throw new Error(`${label} path must be outside the repository`);
  return absolute;
}

const MODULE_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runLiveProviderProofCli(args: readonly string[], repoRoot = MODULE_REPO_ROOT): Promise<number> {
  let parsed: VerifyArgs;
  try {
    parsed = parseVerifyArgs(args);
  } catch (error) {
    stderr.write(`${(error as Error).message}\n${usage()}`);
    return 2;
  }

  let inputPath: string;
  let outputPath: string;
  const repoReal = await realpath(repoRoot);
  try {
    inputPath = await assertOutOfRepoPath(parsed.input, repoReal, "input");
    outputPath = await assertOutOfRepoPath(parsed.out, repoReal, "output");
  } catch (error) {
    stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

  const payloadText = await readFile(inputPath, "utf8");
  const summary = createVerifiedLiveProviderModerateProofSummary({
    payloadText,
    runRef: parsed.runRef,
    routeRef: parsed.routeRef,
    providerRef: parsed.providerRef,
    observedCostUsd: parsed.observedCostUsd,
    providerCallsExecuted: parsed.providerCalls,
    tokensUsedTotal: parsed.tokensUsedTotal,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(summary, null, 2) + "\n");
  stdout.write(JSON.stringify({ ok: summary.ok, summary_path: outputPath, validation_errors: summary.validation_errors }, null, 2) + "\n");
  return summary.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  runLiveProviderProofCli(argv.slice(2)).then((code) => exit(code)).catch((error) => {
    stderr.write(`unexpected error: ${(error as Error).message}\n`);
    exit(2);
  });
}
