// Local run artifact manifest CLI.
//
// Usage:
//   tsx src/cli/run-manifest.ts write <bundle.json> --mode model --out-root <dir> --run-slug <slug>

import { argv, exit } from "node:process";

import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile } from "../graph/file-store.ts";
import { PathGuardError } from "../io/path-guard.ts";
import { ProductionWriteForbiddenError, type RuntimeMode } from "../modes/index.ts";
import { writeRunArtifactManifest } from "../run/manifest.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/run-manifest.ts write <bundle.json> --mode model --out-root <dir> --run-slug <slug> [--allow-overwrite]",
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

function parseWriteArgs(args: string[]): {
  inputPath: string;
  mode: RuntimeMode;
  outputRoot: string;
  runSlug: string;
  allowOverwrite: boolean;
} | null {
  const [inputPath, ...flags] = args;
  const mode = parseMode(flags);
  const outputRoot = parseFlagValue(flags, "--out-root");
  const runSlug = parseFlagValue(flags, "--run-slug");
  const allowOverwrite = flags.includes("--allow-overwrite");
  const allowedFlags = new Set(["--mode", "--out-root", "--run-slug", "--allow-overwrite"]);

  if (!inputPath || !mode || !outputRoot || !runSlug) return null;

  const seen = new Set<string>();

  for (let i = 0; i < flags.length; i += 1) {
    const value = flags[i]!;
    if (!value.startsWith("--")) return null;
    if (!allowedFlags.has(value)) return null;
    if (seen.has(value)) return null;
    seen.add(value);
    if (value === "--allow-overwrite") continue;
    i += 1;
    if (!flags[i] || flags[i]!.startsWith("--")) return null;
  }

  return { inputPath, mode, outputRoot, runSlug, allowOverwrite };
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

  if (command === "write") {
    const parsedArgs = parseWriteArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const { inputPath, mode, outputRoot, runSlug, allowOverwrite } = parsedArgs;
    const bundle = await loadGraphBundleFile(inputPath);
    const result = await writeRunArtifactManifest({
      bundle,
      outputRoot,
      runSlug,
      mode,
      inputPath,
      allowOverwrite,
    });

    printJson({
      ok: true,
      command: "write",
      manifest_path: result.manifest_path,
      graph_bundle_path: result.graph_bundle_path,
      quality_gate_report_path: result.quality_gate_report_path,
      manifest: result.manifest,
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
    if (e instanceof Error && /run slug/.test(e.message)) exit(2);
    exit(2);
  });
