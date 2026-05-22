// Fixture-only quality gate CLI.
//
// Usage:
//   tsx src/cli/gate.ts <bundle.json> [bundle2.json ...]
//   cat bundle.json | tsx src/cli/gate.ts -
//
// Runs deterministic graph validation plus Phase 1.2 launch-quality
// thresholds. Exits 0 for pass and 1 for borderline/fail.

import { readFile } from "node:fs/promises";
import { argv, exit, stdin } from "node:process";

import { runQualityGate, summarizeGateRun } from "../gate/quality-gate.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readInput(arg: string): Promise<{ input: string; raw: unknown }> {
  const text = arg === "-" || arg === "--stdin"
    ? await readStdin()
    : await readFile(arg, "utf8");
  try {
    return { input: arg === "--stdin" ? "-" : arg, raw: JSON.parse(text) };
  } catch (e) {
    throw new Error(`failed to parse JSON for ${arg}: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  const inputs = argv.slice(2);
  if (inputs.length === 0) {
    process.stderr.write("usage: tsx src/cli/gate.ts <bundle.json | -|--stdin> [more-bundles.json ...]\n");
    exit(2);
  }

  const reports = [];
  for (const arg of inputs) {
    const { input, raw } = await readInput(arg);
    reports.push({ input, ...runQualityGate(raw) });
  }

  const runReport = summarizeGateRun(reports);
  process.stdout.write(JSON.stringify(runReport, null, 2) + "\n");
  exit(runReport.ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`quality gate error: ${(e as Error).stack ?? e}\n`);
  exit(2);
});
