import { initializeLocalDurableDb, inspectLocalDurableDb } from "../db/local-durable-db.ts";

interface ParsedArgs {
  readonly command: "init" | "inspect";
  readonly root: string;
  readonly now?: string;
}

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/local-durable-db.ts init --root <dir> [--now <iso>]",
    "  tsx src/cli/local-durable-db.ts inspect --root <dir>",
    "",
    "This local-only helper initializes or inspects the portable durable DB boot contract.",
    "It does not call providers, ingest graph data, deploy, or claim production readiness.",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (command !== "init" && command !== "inspect") {
    throw new Error("unknown command");
  }

  let root: string | undefined;
  let now: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--root") {
      root = requireValue(rest, index, "--root");
      index += 1;
      continue;
    }
    if (arg === "--now" && command === "init") {
      now = requireValue(rest, index, "--now");
      index += 1;
      continue;
    }
    throw new Error(`unknown flag: ${arg}`);
  }

  if (root === undefined || root.trim() === "") {
    throw new Error("missing --root");
  }

  return command === "init" ? { command, root, now } : { command, root };
}

function requireValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : "invalid arguments"}\n${usage()}`);
    process.exitCode = 2;
    return;
  }

  const report = parsed.command === "init"
    ? await initializeLocalDurableDb({ rootDir: parsed.root, now: parsed.now })
    : await inspectLocalDurableDb({ rootDir: parsed.root });

  console.log(JSON.stringify({ command: parsed.command, ...report }, null, 2));
  if (!report.ok) {
    process.exitCode = parsed.command === "inspect" && report.databaseStatus === "absent" ? 1 : 3;
  }
}

await main();
