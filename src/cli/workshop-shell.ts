// Local static Workshop shell CLI.
//
// Usage:
//   tsx src/cli/workshop-shell.ts write <bundle.json> --out-root <dir> --out-file <relative.html> [--allow-overwrite] [--preview-mode <fake|validation>]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { argv, exit } from "node:process";

import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile } from "../graph/file-store.ts";
import { guardOutputPath, PathGuardError } from "../io/path-guard.ts";
import { renderWorkshopHtml, type WorkshopPreviewMode } from "../workshop/render-html.ts";
import { buildWorkshopViewModel } from "../workshop/view-model.ts";

const PREVIEW_MODES: readonly WorkshopPreviewMode[] = ["fake", "validation"];

function isPreviewMode(value: string): value is WorkshopPreviewMode {
  return (PREVIEW_MODES as readonly string[]).includes(value);
}

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/workshop-shell.ts write <bundle.json> --out-root <dir> --out-file <relative.html> [--allow-overwrite] [--preview-mode <fake|validation>]",
  ].join("\n");
}

function parseWriteArgs(args: string[]): {
  inputPath: string;
  outputRoot: string;
  outputFile: string;
  allowOverwrite: boolean;
  previewMode: WorkshopPreviewMode;
} {
  const [inputPath, ...flags] = args;
  if (!inputPath) throw new CliUsageError("missing bundle.json path");

  const allowedFlags = new Set(["--out-root", "--out-file", "--allow-overwrite", "--preview-mode"]);
  const seen = new Set<string>();
  let outputRoot: string | null = null;
  let outputFile: string | null = null;
  let allowOverwrite = false;
  let previewMode: WorkshopPreviewMode = "fake";

  for (let i = 0; i < flags.length; i += 1) {
    const flag = flags[i]!;
    if (!flag.startsWith("--")) throw new CliUsageError(`unexpected positional argument: ${flag}`);
    if (!allowedFlags.has(flag)) throw new CliUsageError(`unknown flag: ${flag}`);
    if (seen.has(flag)) throw new CliUsageError(`duplicate flag: ${flag}`);
    seen.add(flag);

    if (flag === "--allow-overwrite") {
      allowOverwrite = true;
      continue;
    }

    const value = flags[i + 1];
    if (!value || value.startsWith("--")) throw new CliUsageError(`missing value for ${flag}`);
    i += 1;

    if (flag === "--out-root") outputRoot = value;
    if (flag === "--out-file") outputFile = value;
    if (flag === "--preview-mode") {
      if (!isPreviewMode(value)) {
        throw new CliUsageError(`invalid --preview-mode value: ${value} (expected fake or validation)`);
      }
      previewMode = value;
    }
  }

  if (!outputRoot) throw new CliUsageError("missing --out-root");
  if (!outputFile) throw new CliUsageError("missing --out-file");
  return { inputPath, outputRoot, outputFile, allowOverwrite, previewMode };
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function printError(e: unknown): void {
  if (e instanceof CliUsageError) {
    process.stderr.write(`${e.message}\n${usage()}\n`);
    return;
  }
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

async function writeWorkshopShell(args: string[]): Promise<number> {
  const { inputPath, outputRoot, outputFile, allowOverwrite, previewMode } = parseWriteArgs(args);

  if (isAbsolute(outputFile)) {
    throw new PathGuardError("--out-file must be a relative .html path under --out-root");
  }
  if (extname(outputFile).toLowerCase() !== ".html") {
    throw new CliUsageError("--out-file must end in .html");
  }

  const targetPath = resolve(outputRoot, outputFile);
  const guarded = await guardOutputPath({
    outputRoot,
    targetPath,
    allowOverwrite,
    rejectRepoPaths: false,
    repoRoot: null,
  });

  const bundle = await loadGraphBundleFile(inputPath);
  const viewModel = buildWorkshopViewModel(bundle);
  const html = renderWorkshopHtml(viewModel, { previewMode });

  await mkdir(dirname(guarded.targetPath), { recursive: true });
  await writeFile(guarded.targetPath, html, { encoding: "utf8", flag: allowOverwrite ? "w" : "wx" });

  printJson({
    ok: true,
    command: "write",
    output_path: guarded.targetPath,
    account_id: viewModel.account_id,
    preview_mode: previewMode,
  });
  return 0;
}

async function run(): Promise<number> {
  const [command, ...args] = argv.slice(2);
  if (command === "write") return writeWorkshopShell(args);
  process.stderr.write(`${usage()}\n`);
  return 2;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof GraphFileParseError) exit(2);
    if (e instanceof GraphFileSchemaError) exit(1);
    if (e instanceof CliUsageError) exit(2);
    if (e instanceof PathGuardError) exit(2);
    exit(2);
  });
