// Fixture-mode validator CLI.
//
// Usage:
//   tsx src/cli/validate.ts <path-to-bundle.json>
//
// Reads a GraphBundle from disk (or stdin via `-`), runs the validator
// in `fixture` mode, prints the report as JSON, and exits non-zero if
// any hard invariant is violated. This is the no-spend, no-network
// entry point used in CI and by humans inspecting fixture failures.

import { readFile } from "node:fs/promises";
import { argv, exit, stdin } from "node:process";

import { validateGraphBundleRaw } from "../graph/validate.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const arg = argv[2];
  if (!arg) {
    process.stderr.write(
      "usage: tsx src/cli/validate.ts <bundle.json | -|--stdin>\n",
    );
    exit(2);
  }
  const text = arg === "-" || arg === "--stdin"
    ? await readStdin()
    : await readFile(arg, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    process.stderr.write(`failed to parse JSON: ${(e as Error).message}\n`);
    exit(2);
  }
  const report = validateGraphBundleRaw(parsed, { mode: "fixture" });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`unexpected error: ${(e as Error).stack ?? e}\n`);
  exit(2);
});
