import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export const CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION = 1;
export const LOCAL_DURABLE_DB_MANIFEST = "atliera-local-db.json";

const LOCAL_DURABLE_DB_KIND = "atliera-local-durable-db";
const INITIAL_MIGRATION_ID = "001_local_durable_boot";
const TABLES = ["graph_snapshots", "job_queue", "schema_migrations"] as const;

export type LocalDurableDbStatus = "absent" | "initialized" | "migration_required" | "migration_failed";

export type LocalDurableDbFailureCode =
  | "local_durable_db_absent"
  | "local_durable_db_manifest_invalid"
  | "local_durable_db_manifest_missing_with_existing_state"
  | "local_durable_db_schema_version_outdated"
  | "local_durable_db_schema_version_unsupported"
  | "local_durable_db_tables_missing";

export interface LocalDurableDbReport {
  readonly ok: boolean;
  readonly kind: "local-durable-db-boot-report";
  readonly databaseStatus: LocalDurableDbStatus;
  readonly schemaVersion: number | null;
  readonly migrationsApplied: readonly string[];
  readonly failureCodes: readonly LocalDurableDbFailureCode[];
  readonly providerCallsMade: 0;
  readonly providerSpend: false;
  readonly graphIngestionExecuted: false;
  readonly productionWrites: false;
  readonly platformLockIn: false;
}

interface LocalDurableDbManifest {
  readonly kind: typeof LOCAL_DURABLE_DB_KIND;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly migrations: readonly string[];
  readonly tables: readonly string[];
  readonly portability: {
    readonly localOnly: true;
    readonly platformAgnosticContract: true;
    readonly providerCallsMade: 0;
    readonly productionWrites: false;
  };
}

export interface LocalDurableDbOptions {
  readonly rootDir: string;
  readonly now?: string;
}

export async function inspectLocalDurableDb(options: LocalDurableDbOptions): Promise<LocalDurableDbReport> {
  const manifest = await readManifest(options.rootDir);
  if (manifest.status === "absent") {
    const hasState = await hasAnyLocalDurableDbState(options.rootDir);
    if (hasState) {
      return report({
        databaseStatus: "migration_failed",
        schemaVersion: null,
        failureCodes: ["local_durable_db_manifest_missing_with_existing_state"],
      });
    }
    return report({ databaseStatus: "absent", schemaVersion: null, failureCodes: ["local_durable_db_absent"] });
  }
  if (manifest.status === "invalid") {
    return report({ databaseStatus: "migration_failed", schemaVersion: null, failureCodes: ["local_durable_db_manifest_invalid"] });
  }

  if (manifest.value.schemaVersion < CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION) {
    return report({
      databaseStatus: "migration_required",
      schemaVersion: manifest.value.schemaVersion,
      failureCodes: ["local_durable_db_schema_version_outdated"],
    });
  }

  if (manifest.value.schemaVersion > CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION) {
    return report({
      databaseStatus: "migration_failed",
      schemaVersion: manifest.value.schemaVersion,
      failureCodes: ["local_durable_db_schema_version_unsupported"],
    });
  }

  const tablesOk = await allTablesExist(options.rootDir);
  if (!tablesOk) {
    return report({
      databaseStatus: "migration_failed",
      schemaVersion: manifest.value.schemaVersion,
      failureCodes: ["local_durable_db_tables_missing"],
    });
  }

  return report({ databaseStatus: "initialized", schemaVersion: manifest.value.schemaVersion, failureCodes: [] });
}

export async function initializeLocalDurableDb(options: LocalDurableDbOptions): Promise<LocalDurableDbReport> {
  const inspected = await inspectLocalDurableDb(options);
  if (inspected.databaseStatus === "initialized") {
    return inspected;
  }
  if (inspected.databaseStatus !== "absent") {
    return inspected;
  }

  const now = normalizeNow(options.now);
  await mkdir(join(options.rootDir, "tables"), { recursive: true });
  for (const table of TABLES) {
    await writeFile(join(options.rootDir, "tables", `${table}.jsonl`), "", { flag: "wx" });
  }

  const manifest: LocalDurableDbManifest = {
    kind: LOCAL_DURABLE_DB_KIND,
    schemaVersion: CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    migrations: [INITIAL_MIGRATION_ID],
    tables: [...TABLES],
    portability: {
      localOnly: true,
      platformAgnosticContract: true,
      providerCallsMade: 0,
      productionWrites: false,
    },
  };
  await writeManifestExclusive(options.rootDir, manifest);

  return report({
    databaseStatus: "initialized",
    schemaVersion: CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION,
    migrationsApplied: [INITIAL_MIGRATION_ID],
    failureCodes: [],
  });
}

function normalizeNow(now: string | undefined): string {
  if (now === undefined) {
    return new Date().toISOString();
  }
  const parsed = new Date(now);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== now) {
    throw new Error("local durable DB timestamp must be an exact ISO instant");
  }
  return now;
}

async function readManifest(rootDir: string): Promise<
  | { readonly status: "absent" }
  | { readonly status: "invalid" }
  | { readonly status: "valid"; readonly value: LocalDurableDbManifest }
> {
  let raw: string;
  try {
    raw = await readFile(join(rootDir, LOCAL_DURABLE_DB_MANIFEST), "utf8");
  } catch (error) {
    if (isNotFound(error)) return { status: "absent" };
    return { status: "invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }

  if (!isManifest(parsed)) {
    return { status: "invalid" };
  }
  return { status: "valid", value: parsed };
}

function isManifest(value: unknown): value is LocalDurableDbManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const migrations = record.migrations;
  const tables = record.tables;
  return (
    record.kind === LOCAL_DURABLE_DB_KIND &&
    Number.isInteger(record.schemaVersion) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(migrations) &&
    migrations.every((entry) => typeof entry === "string") &&
    Array.isArray(tables) &&
    TABLES.every((table) => tables.includes(table)) &&
    typeof record.portability === "object" &&
    record.portability !== null &&
    !Array.isArray(record.portability)
  );
}

async function allTablesExist(rootDir: string): Promise<boolean> {
  for (const table of TABLES) {
    try {
      const tableStat = await stat(join(rootDir, "tables", `${table}.jsonl`));
      if (!tableStat.isFile()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function hasAnyLocalDurableDbState(rootDir: string): Promise<boolean> {
  try {
    await stat(join(rootDir, "tables"));
    return true;
  } catch {
    return false;
  }
}

async function writeManifestExclusive(rootDir: string, manifest: LocalDurableDbManifest): Promise<void> {
  const finalPath = join(rootDir, LOCAL_DURABLE_DB_MANIFEST);
  const tempPath = join(rootDir, `.atliera-local-db-${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await rename(tempPath, finalPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function report(input: {
  readonly databaseStatus: LocalDurableDbStatus;
  readonly schemaVersion: number | null;
  readonly migrationsApplied?: readonly string[];
  readonly failureCodes: readonly LocalDurableDbFailureCode[];
}): LocalDurableDbReport {
  return {
    ok: input.databaseStatus === "initialized" && input.failureCodes.length === 0,
    kind: "local-durable-db-boot-report",
    databaseStatus: input.databaseStatus,
    schemaVersion: input.schemaVersion,
    migrationsApplied: input.migrationsApplied ?? [],
    failureCodes: input.failureCodes,
    providerCallsMade: 0,
    providerSpend: false,
    graphIngestionExecuted: false,
    productionWrites: false,
    platformLockIn: false,
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
