// File-backed GraphBundle store CLI.
//
// Usage:
//   tsx src/cli/graph-store.ts load <bundle.json>
//   tsx src/cli/graph-store.ts save-copy <input.json> <output.json> --mode model --out-root <dir>
//
// The CLI is intentionally narrow: it is a local JSON file utility for the
// Phase 1.4 file store seam, not a DB/runtime persistence interface.

import { argv, exit } from "node:process";

import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile, saveGraphBundleFile } from "../graph/file-store.ts";
import { PathGuardError } from "../io/path-guard.ts";
import { ProductionWriteForbiddenError, type RuntimeMode } from "../modes/index.ts";
import type { GraphBundle } from "../graph/types.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/graph-store.ts load <bundle.json>",
    "  tsx src/cli/graph-store.ts save-copy <input.json> <output.json> --mode model --out-root <dir> [--allow-overwrite]",
  ].join("\n");
}

function isRuntimeMode(value: string): value is RuntimeMode {
  return value === "validation" || value === "fixture" || value === "fake" || value === "model";
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function parseMode(args: string[]): RuntimeMode | null {
  const raw = parseFlagValue(args, "--mode");
  if (!raw || !isRuntimeMode(raw)) return null;
  return raw;
}

function parseSaveCopyArgs(args: string[]): {
  inputPath: string;
  outputPath: string;
  mode: RuntimeMode;
  outputRoot: string;
  allowOverwrite: boolean;
} | null {
  const [inputPath, outputPath, ...flags] = args;
  const mode = parseMode(flags);
  const outputRoot = parseFlagValue(flags, "--out-root");
  const allowOverwrite = flags.includes("--allow-overwrite");
  const allowedFlags = new Set(["--mode", "--out-root", "--allow-overwrite"]);

  if (!inputPath || !outputPath || !mode || !outputRoot) return null;

  for (let i = 0; i < flags.length; i += 1) {
    const value = flags[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (value === "--allow-overwrite") continue;
    i += 1;
    if (!flags[i] || flags[i]!.startsWith("--")) return null;
  }

  return { inputPath, outputPath, mode, outputRoot, allowOverwrite };
}

function counts(bundle: GraphBundle): Record<string, number> {
  return {
    sources: bundle.sources.length,
    excerpts: bundle.excerpts.length,
    claims: bundle.claims.length,
    claim_evidence: bundle.claim_evidence.length,
    account_objects: bundle.account_objects.length,
    account_object_claims: bundle.account_object_claims.length,
    research_runs: bundle.research_runs.length,
    run_artifacts: bundle.run_artifacts.length,
    audit_events: bundle.audit_events.length,
    graph_records:
      bundle.sources.length +
      bundle.excerpts.length +
      bundle.claims.length +
      bundle.claim_evidence.length +
      bundle.account_objects.length +
      bundle.account_object_claims.length +
      bundle.research_runs.length +
      bundle.run_artifacts.length +
      bundle.audit_events.length,
  };
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function printError(e: unknown): void {
  if (e instanceof GraphFileSchemaError) {
    process.stderr.write(`${e.message}\n${JSON.stringify(e.report, null, 2)}\n`);
    return;
  }
  if (e instanceof Error) {
    process.stderr.write(`${e.message}\n`);
    return;
  }
  process.stderr.write(`${String(e)}\n`);
}

async function run(): Promise<number> {
  const [command, ...args] = argv.slice(2);

  if (command === "load") {
    const [path] = args;
    if (!path || args.length !== 1) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }
    const bundle = await loadGraphBundleFile(path);
    printJson({ ok: true, command: "load", path, counts: counts(bundle) });
    return 0;
  }

  if (command === "save-copy") {
    const parsedArgs = parseSaveCopyArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const { inputPath, outputPath, mode, outputRoot, allowOverwrite } = parsedArgs;
    const bundle = await loadGraphBundleFile(inputPath);
    const result = await saveGraphBundleFile(outputPath, bundle, {
      mode,
      outputRoot,
      allowOverwrite,
    });
    printJson({
      ok: true,
      command: "save-copy",
      input_path: inputPath,
      output_path: result.path,
      output_root: outputRoot,
      mode,
      counts: counts(bundle),
      validation_ok: result.report?.ok ?? null,
    });
    return 0;
  }

  process.stderr.write(`${usage()}\n`);
  return 2;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof GraphFileParseError) exit(2);
    if (e instanceof GraphFileSchemaError) exit(1);
    if (e instanceof ProductionWriteForbiddenError) exit(1);
    if (e instanceof PathGuardError) exit(2);
    exit(2);
  });
