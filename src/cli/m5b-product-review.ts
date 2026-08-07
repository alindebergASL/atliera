import { pathToFileURL } from "node:url";

import { prepareM5bProductReview } from "../workshop/m5b-product-review-prepare.ts";

interface ParsedArgs {
  readonly values: ReadonlyMap<string, string>;
  readonly sources: readonly string[];
}

function parseArgs(values: readonly string[]): ParsedArgs {
  if (values.length % 2 !== 0) throw new Error("arguments must be explicit --name value pairs");
  const parsed = new Map<string, string>();
  const sources: string[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error("arguments must be explicit --name value pairs");
    }
    if (key === "--source") {
      sources.push(value);
    } else {
      if (parsed.has(key)) throw new Error(`duplicate argument ${key}`);
      parsed.set(key, value);
    }
  }
  return { values: parsed, sources: Object.freeze(sources) };
}

function requireArg(args: ReadonlyMap<string, string>, name: string): string {
  const value = args.get(name);
  if (!value) throw new Error(`missing required argument ${name}`);
  return value;
}

function parseSource(value: string): { sourceId: string; path: string } {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("--source must have the exact source-id=/absolute/path shape");
  }
  return { sourceId: value.slice(0, separator), path: value.slice(separator + 1) };
}

async function execute(values: readonly string[]): Promise<string> {
  const [command, ...rest] = values;
  if (command !== "prepare") {
    throw new Error("usage: m5b-product-review prepare with explicit pinned request and source arguments");
  }
  const args = parseArgs(rest);
  const allowed = new Set(["--request", "--expected-request-sha256", "--expected-request-size", "--output"]);
  for (const key of args.values.keys()) {
    if (!allowed.has(key)) throw new Error(`unknown argument ${key}`);
  }
  const sizeText = requireArg(args.values, "--expected-request-size");
  if (!/^[1-9][0-9]*$/.test(sizeText) || !Number.isSafeInteger(Number(sizeText))) {
    throw new Error("--expected-request-size must be a positive safe integer");
  }
  const result = await prepareM5bProductReview({
    requestPath: requireArg(args.values, "--request"),
    expectedRequestSha256: requireArg(args.values, "--expected-request-sha256"),
    expectedRequestByteSize: Number(sizeText),
    sourceFiles: args.sources.map(parseSource),
    outputDir: requireArg(args.values, "--output"),
  });
  return `${JSON.stringify(result, null, 2)}\n`;
}

export interface M5bProductReviewCliResult {
  readonly exitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
}

export async function invokeM5bProductReviewCli(
  values: readonly string[],
): Promise<M5bProductReviewCliResult> {
  try {
    return Object.freeze({ exitCode: 0, stdout: await execute(values), stderr: "" });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const code = typeof error === "object" && error !== null && "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "invalid_request";
    return Object.freeze({
      exitCode: 1,
      stdout: "",
      stderr: `${JSON.stringify({ ok: false, name, code })}\n`,
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  invokeM5bProductReviewCli(process.argv.slice(2)).then((result) => {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
}
