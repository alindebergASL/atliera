// Deterministic full-pipeline validation packaging CLI.
//
// Usage:
//   tsx src/cli/full-pipeline-validation.ts package <bundle.json> \
//     --provider-report <provider-report.json> --out-root <dir> --run-slug <slug> --now <iso>
//
// This command only packages already-sanitized local evidence. It does not
// read credentials, call model providers, access the network, deploy, or touch
// Hermes Agent runtime/configuration state.

import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";

import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile } from "../graph/file-store.ts";
import { PathGuardError } from "../io/path-guard.ts";
import type { ModelProviderValidationReport } from "../model/provider-validation.ts";
import { ProductionWriteForbiddenError } from "../modes/index.ts";
import { runFullPipelineValidationPackage } from "../validation/full-pipeline.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/full-pipeline-validation.ts package <bundle.json> --provider-report <provider-report.json> --out-root <dir> --run-slug <slug> --now <iso-timestamp> [--allow-overwrite]",
  ].join("\n");
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function parsePackageArgs(args: string[]): {
  inputPath: string;
  providerReportPath: string;
  outputRoot: string;
  runSlug: string;
  now: string;
  allowOverwrite: boolean;
} | null {
  const [inputPath, ...flags] = args;
  const providerReportPath = parseFlagValue(flags, "--provider-report");
  const outputRoot = parseFlagValue(flags, "--out-root");
  const runSlug = parseFlagValue(flags, "--run-slug");
  const now = parseFlagValue(flags, "--now");
  const allowOverwrite = flags.includes("--allow-overwrite");
  const allowedFlags = new Set(["--provider-report", "--out-root", "--run-slug", "--now", "--allow-overwrite"]);

  if (!inputPath || !providerReportPath || !outputRoot || !runSlug || !now) return null;

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

  return { inputPath, providerReportPath, outputRoot, runSlug, now, allowOverwrite };
}

async function loadJsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("provider report must be valid JSON");
    }
    throw e;
  }
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

  if (command === "package") {
    const parsedArgs = parsePackageArgs(args);
    if (!parsedArgs) {
      process.stderr.write(`${usage()}\n`);
      return 2;
    }

    const { inputPath, providerReportPath, outputRoot, runSlug, now, allowOverwrite } = parsedArgs;
    const bundle = await loadGraphBundleFile(inputPath);
    const providerReport = await loadJsonFile(providerReportPath) as ModelProviderValidationReport;
    const result = await runFullPipelineValidationPackage({
      bundle,
      modelProviderValidationReport: providerReport,
      outputRoot,
      runSlug,
      inputPath,
      now,
      allowOverwrite,
    });

    printJson({
      ok: result.summary.ok,
      command: "package",
      manifest_path: result.summary.artifacts.manifest_path,
      graph_bundle_path: result.summary.artifacts.graph_bundle_path,
      quality_gate_report_path: result.summary.artifacts.quality_gate_report_path,
      model_provider_validation_report_path: result.summary.artifacts.model_provider_validation_report_path,
      agent_run_record_path: result.summary.artifacts.agent_run_record_path,
      summary: result.summary,
    });
    return result.summary.ok ? 0 : 1;
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
    if (e instanceof Error && /run slug|provider report|full pipeline|agent run|ISO timestamp|relative reference/.test(e.message)) exit(2);
    exit(2);
  });
