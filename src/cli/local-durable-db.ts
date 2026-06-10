import {
  backupLocalDurableDb,
  initializeLocalDurableDb,
  inspectLocalDurableDb,
  restoreLocalDurableDbBackup,
} from "../db/local-durable-db.ts";

type Command = "init" | "inspect" | "backup" | "restore";

interface ParsedArgs {
  readonly command: Command;
  readonly root?: string;
  readonly now?: string;
  readonly backupFile?: string;
  readonly targetRoot?: string;
  readonly allowOverwrite?: boolean;
}

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/local-durable-db.ts init --root <dir> [--now <iso>]",
    "  tsx src/cli/local-durable-db.ts inspect --root <dir>",
    "  tsx src/cli/local-durable-db.ts backup --root <dir> --out <backup.json> [--now <iso>]",
    "  tsx src/cli/local-durable-db.ts restore --backup <backup.json> --target-root <dir> [--allow-overwrite]",
    "",
    "This local-only helper initializes, inspects, backs up, or restores the portable durable DB contract.",
    "It does not call providers, ingest graph data, deploy, or claim production readiness.",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  if (command !== "init" && command !== "inspect" && command !== "backup" && command !== "restore") {
    throw new Error("unknown command");
  }

  let root: string | undefined;
  let now: string | undefined;
  let backupFile: string | undefined;
  let targetRoot: string | undefined;
  let allowOverwrite = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--root" && (command === "init" || command === "inspect" || command === "backup")) {
      root = requireValue(rest, index, "--root");
      index += 1;
      continue;
    }
    if (arg === "--now" && (command === "init" || command === "backup")) {
      now = requireValue(rest, index, "--now");
      index += 1;
      continue;
    }
    if (arg === "--out" && command === "backup") {
      backupFile = requireValue(rest, index, "--out");
      index += 1;
      continue;
    }
    if (arg === "--backup" && command === "restore") {
      backupFile = requireValue(rest, index, "--backup");
      index += 1;
      continue;
    }
    if (arg === "--target-root" && command === "restore") {
      targetRoot = requireValue(rest, index, "--target-root");
      index += 1;
      continue;
    }
    if (arg === "--allow-overwrite" && command === "restore") {
      allowOverwrite = true;
      continue;
    }
    throw new Error(`unknown flag: ${arg}`);
  }

  if ((command === "init" || command === "inspect" || command === "backup") && (root === undefined || root.trim() === "")) {
    throw new Error("missing --root");
  }
  if (command === "backup" && (backupFile === undefined || backupFile.trim() === "")) {
    throw new Error("missing --out");
  }
  if (command === "restore" && (backupFile === undefined || backupFile.trim() === "")) {
    throw new Error("missing --backup");
  }
  if (command === "restore" && (targetRoot === undefined || targetRoot.trim() === "")) {
    throw new Error("missing --target-root");
  }

  return { command, root, now, backupFile, targetRoot, allowOverwrite };
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
    ? await initializeLocalDurableDb({ rootDir: parsed.root!, now: parsed.now })
    : parsed.command === "inspect"
      ? await inspectLocalDurableDb({ rootDir: parsed.root! })
      : parsed.command === "backup"
        ? await backupLocalDurableDb({ rootDir: parsed.root!, backupFile: parsed.backupFile!, now: parsed.now })
        : await restoreLocalDurableDbBackup({
          backupFile: parsed.backupFile!,
          targetRootDir: parsed.targetRoot!,
          allowOverwrite: parsed.allowOverwrite,
        });

  console.log(JSON.stringify({ command: parsed.command, ...report }, null, 2));
  if (!report.ok) {
    process.exitCode = parsed.command === "inspect" && "databaseStatus" in report && report.databaseStatus === "absent" ? 1 : 3;
  }
}

await main();
