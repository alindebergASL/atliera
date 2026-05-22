// File-backed GraphBundle store.
//
// Phase 1.4 intentionally stops short of a database. This adapter gives
// future phases a small persistence seam while preserving the current
// safety invariants: JSON files only, deterministic validation before
// save by default, atomic write via temp-file + rename, and explicit
// mode-gated writes.

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { assertProductionWriteAllowed, type RuntimeMode } from "../modes/index.ts";
import { parseGraphBundle } from "./schema.ts";
import type { ValidationReport } from "./report.ts";
import type { GraphBundle } from "./types.ts";
import { validateGraphBundleRaw } from "./validate.ts";

export class GraphFileParseError extends Error {
  constructor(path: string, message: string) {
    super(`failed to parse GraphBundle JSON at ${path}: ${message}`);
    this.name = "GraphFileParseError";
  }
}

export class GraphFileSchemaError extends Error {
  constructor(path: string, public readonly report: ValidationReport) {
    super(`GraphBundle at ${path} failed schema/validation checks`);
    this.name = "GraphFileSchemaError";
  }
}

export type LoadGraphBundleFileOptions = {
  validate?: boolean;
};

export type SaveGraphBundleFileOptions = {
  mode: RuntimeMode;
  validate?: boolean;
};

export type SaveGraphBundleFileResult = {
  path: string;
  report: ValidationReport | null;
};

export async function loadGraphBundleFile(
  path: string,
  options: LoadGraphBundleFileOptions = {},
): Promise<GraphBundle> {
  const resolved = resolve(path);
  const text = await readFile(resolved, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new GraphFileParseError(resolved, (e as Error).message);
  }

  if (options.validate === false) {
    const parsed = parseGraphBundle(raw);
    if (parsed.ok) {
      return parsed.value;
    }
    throw new GraphFileSchemaError(resolved, {
      ok: false,
      hard_failures: parsed.errors.map((err) => ({
        code: err.kind === "unknown_field" ? "unknown_field" : "schema_parse_failure",
        message: err.message,
        path: err.path,
      })),
      metrics: {
        total_sources: 0,
        total_excerpts: 0,
        accepted_excerpts: 0,
        rejected_excerpts: 0,
        proposed_excerpts: 0,
        total_claims: 0,
        verified_claims: 0,
        total_account_objects: 0,
        verified_account_objects: 0,
      },
    });
  }

  const report = validateGraphBundleRaw(raw, { mode: "fixture" });
  if (!report.ok) {
    throw new GraphFileSchemaError(resolved, report);
  }

  const parsed = parseGraphBundle(raw);
  if (!parsed.ok) {
    // Defensive: validateGraphBundleRaw should already have caught this.
    throw new GraphFileSchemaError(resolved, report);
  }
  return parsed.value;
}

export async function saveGraphBundleFile(
  path: string,
  bundle: GraphBundle,
  options: SaveGraphBundleFileOptions,
): Promise<SaveGraphBundleFileResult> {
  assertProductionWriteAllowed(options.mode);

  const report = options.validate === false
    ? null
    : validateGraphBundleRaw(bundle, { mode: "fixture" });
  if (report && !report.ok) {
    throw new GraphFileSchemaError(resolve(path), report);
  }

  const resolved = resolve(path);
  const directory = dirname(resolved);
  await mkdir(directory, { recursive: true });

  const tempPath = `${resolved}.${process.pid}.${randomUUID()}.tmp`;
  const contents = JSON.stringify(bundle, null, 2) + "\n";
  try {
    await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, resolved);
  } catch (e) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw e;
  }

  return { path: resolved, report };
}

export class FileGraphStore {
  constructor(private readonly path: string) {}

  load(options?: LoadGraphBundleFileOptions): Promise<GraphBundle> {
    return loadGraphBundleFile(this.path, options);
  }

  save(
    bundle: GraphBundle,
    options: SaveGraphBundleFileOptions,
  ): Promise<SaveGraphBundleFileResult> {
    return saveGraphBundleFile(this.path, bundle, options);
  }
}
