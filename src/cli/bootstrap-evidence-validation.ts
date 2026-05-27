// Bootstrap validation evidence verifier CLI.
//
// Usage:
//   tsx src/cli/bootstrap-evidence-validation.ts verify \
//     --summary <full-pipeline-summary.json> \
//     --rerun-summary <full-pipeline-summary-rerun.json> \
//     --manifest <manifest.json> \
//     --checkout-commit <sha> \
//     --expected-hash <sha256> \
//     --npm-ci passed \
//     --npm-run-ci passed
//
// This command only verifies local, already-sanitized evidence. It does not
// SSH, call providers, access the network, read credentials, deploy, or touch
// Hermes Agent runtime/configuration state.

import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";

import { verifyBootstrapValidationEvidence } from "../validation/bootstrap-evidence.ts";

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/bootstrap-evidence-validation.ts verify --summary <summary.json> --rerun-summary <summary-rerun.json> --manifest <manifest.json> --checkout-commit <sha> --expected-hash <sha256> --npm-ci passed --npm-run-ci passed",
  ].join("\n");
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function parseVerifyArgs(args: string[]): {
  summaryPath: string;
  rerunSummaryPath: string;
  manifestPath: string;
  checkoutCommit: string;
  expectedHash: string;
  npmCi: string;
  npmRunCi: string;
} | null {
  const summaryPath = parseFlagValue(args, "--summary");
  const rerunSummaryPath = parseFlagValue(args, "--rerun-summary");
  const manifestPath = parseFlagValue(args, "--manifest");
  const checkoutCommit = parseFlagValue(args, "--checkout-commit");
  const expectedHash = parseFlagValue(args, "--expected-hash");
  const npmCi = parseFlagValue(args, "--npm-ci");
  const npmRunCi = parseFlagValue(args, "--npm-run-ci");
  const allowedFlags = new Set([
    "--summary",
    "--rerun-summary",
    "--manifest",
    "--checkout-commit",
    "--expected-hash",
    "--npm-ci",
    "--npm-run-ci",
  ]);

  if (!summaryPath || !rerunSummaryPath || !manifestPath || !checkoutCommit || !expectedHash || !npmCi || !npmRunCi) {
    return null;
  }

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

  return { summaryPath, rerunSummaryPath, manifestPath, checkoutCommit, expectedHash, npmCi, npmRunCi };
}

async function readJson(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`${label} must be valid JSON`);
    }
    throw e;
  }
}

function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function printError(e: unknown): void {
  if (e instanceof Error) {
    process.stderr.write(`${e.message}\n`);
    return;
  }
  process.stderr.write(`${String(e)}\n`);
}

async function run(): Promise<number> {
  const [command, ...args] = argv.slice(2);
  if (command !== "verify") {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  const parsedArgs = parseVerifyArgs(args);
  if (!parsedArgs) {
    process.stderr.write(`${usage()}\n`);
    return 2;
  }

  const [summary, rerunSummary, manifestText] = await Promise.all([
    readJson(parsedArgs.summaryPath, "summary"),
    readJson(parsedArgs.rerunSummaryPath, "rerun summary"),
    readFile(parsedArgs.manifestPath, "utf8"),
  ]);

  const evidence = verifyBootstrapValidationEvidence({
    summary,
    rerunSummary,
    manifestText,
    checkoutCommit: parsedArgs.checkoutCommit,
    expectedManifestHash: parsedArgs.expectedHash,
    npmCi: parsedArgs.npmCi,
    npmRunCi: parsedArgs.npmRunCi,
  });

  printJson({
    ok: evidence.ok,
    command: "verify",
    evidence,
  });
  return 0;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    exit(2);
  });
