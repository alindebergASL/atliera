import { lstat, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";

export const CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION = 1;
export const LOCAL_DURABLE_DB_MANIFEST = "atliera-local-db.json";

const LOCAL_DURABLE_DB_KIND = "atliera-local-durable-db";
const LOCAL_DURABLE_DB_BACKUP_KIND = "atliera-local-durable-db-backup";
const CURRENT_LOCAL_DURABLE_DB_BACKUP_VERSION = 1;
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

export type LocalDurableDbBackupFailureCode =
  | "local_durable_db_backup_source_not_initialized"
  | "local_durable_db_backup_invalid"
  | "local_durable_db_backup_checksum_mismatch"
  | "local_durable_db_restore_target_not_empty";

export type LocalDurableDbBackupStatus = "created" | "source_not_initialized";
export type LocalDurableDbRestoreStatus = "restored" | "backup_invalid" | "refused";

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

export interface LocalDurableDbBackupReport {
  readonly ok: boolean;
  readonly kind: "local-durable-db-backup-report";
  readonly backupStatus: LocalDurableDbBackupStatus;
  readonly sourceSchemaVersion: number | null;
  readonly failureCodes: readonly LocalDurableDbBackupFailureCode[];
  readonly providerCallsMade: 0;
  readonly providerSpend: false;
  readonly graphIngestionExecuted: false;
  readonly productionWrites: false;
  readonly platformLockIn: false;
}

export interface LocalDurableDbRestoreReport {
  readonly ok: boolean;
  readonly kind: "local-durable-db-restore-report";
  readonly restoreStatus: LocalDurableDbRestoreStatus;
  readonly restoredSchemaVersion: number | null;
  readonly failureCodes: readonly LocalDurableDbBackupFailureCode[];
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

interface LocalDurableDbBackupArtifact {
  readonly kind: typeof LOCAL_DURABLE_DB_BACKUP_KIND;
  readonly backupVersion: typeof CURRENT_LOCAL_DURABLE_DB_BACKUP_VERSION;
  readonly createdAt: string;
  readonly sourceSchemaVersion: number;
  readonly sourceManifest: LocalDurableDbManifest;
  readonly tables: readonly LocalDurableDbBackupTable[];
  readonly boundary: {
    readonly providerCallsMade: 0;
    readonly providerSpend: false;
    readonly graphIngestionExecuted: false;
    readonly productionWrites: false;
    readonly platformLockIn: false;
  };
}

interface LocalDurableDbBackupTable {
  readonly name: string;
  readonly contents: string;
  readonly sha256: string;
}

export interface LocalDurableDbOptions {
  readonly rootDir: string;
  readonly now?: string;
}

export interface LocalDurableDbBackupOptions {
  readonly rootDir: string;
  readonly backupFile: string;
  readonly now?: string;
}

export interface LocalDurableDbRestoreOptions {
  readonly backupFile: string;
  readonly targetRootDir: string;
  readonly allowOverwrite?: boolean;
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

export async function backupLocalDurableDb(options: LocalDurableDbBackupOptions): Promise<LocalDurableDbBackupReport> {
  const inspected = await inspectLocalDurableDb({ rootDir: options.rootDir });
  if (!inspected.ok || inspected.schemaVersion === null) {
    return backupReport({
      backupStatus: "source_not_initialized",
      sourceSchemaVersion: inspected.schemaVersion,
      failureCodes: ["local_durable_db_backup_source_not_initialized"],
    });
  }

  const manifest = await readManifest(options.rootDir);
  if (manifest.status !== "valid") {
    return backupReport({
      backupStatus: "source_not_initialized",
      sourceSchemaVersion: inspected.schemaVersion,
      failureCodes: ["local_durable_db_backup_source_not_initialized"],
    });
  }

  const tables: LocalDurableDbBackupTable[] = [];
  for (const table of TABLES) {
    const contents = await readFile(join(options.rootDir, "tables", `${table}.jsonl`), "utf8");
    tables.push({ name: table, contents, sha256: sha256(contents) });
  }

  const artifact: LocalDurableDbBackupArtifact = {
    kind: LOCAL_DURABLE_DB_BACKUP_KIND,
    backupVersion: CURRENT_LOCAL_DURABLE_DB_BACKUP_VERSION,
    createdAt: normalizeNow(options.now),
    sourceSchemaVersion: inspected.schemaVersion,
    sourceManifest: manifest.value,
    tables,
    boundary: {
      providerCallsMade: 0,
      providerSpend: false,
      graphIngestionExecuted: false,
      productionWrites: false,
      platformLockIn: false,
    },
  };

  await writeJsonExclusive(options.backupFile, artifact);
  return backupReport({ backupStatus: "created", sourceSchemaVersion: inspected.schemaVersion, failureCodes: [] });
}

export async function restoreLocalDurableDbBackup(options: LocalDurableDbRestoreOptions): Promise<LocalDurableDbRestoreReport> {
  const artifact = await readBackupArtifact(options.backupFile);
  if (artifact.status === "invalid") {
    return restoreReport({ restoreStatus: "backup_invalid", restoredSchemaVersion: null, failureCodes: [artifact.failureCode] });
  }

  const targetSymlink = await isPathSymlink(options.targetRootDir);
  if (targetSymlink) {
    return restoreReport({
      restoreStatus: "refused",
      restoredSchemaVersion: null,
      failureCodes: ["local_durable_db_restore_target_not_empty"],
    });
  }

  const targetNonEmpty = await isDirectoryNonEmpty(options.targetRootDir);
  if (targetNonEmpty) {
    const target = await inspectLocalDurableDb({ rootDir: options.targetRootDir });
    if (options.allowOverwrite !== true || !target.ok) {
      return restoreReport({
        restoreStatus: "refused",
        restoredSchemaVersion: null,
        failureCodes: ["local_durable_db_restore_target_not_empty"],
      });
    }
  }
  if (options.allowOverwrite === true) {
    await rm(options.targetRootDir, { recursive: true, force: true });
  }

  await mkdir(join(options.targetRootDir, "tables"), { recursive: true });
  for (const table of artifact.value.tables) {
    await writeFile(join(options.targetRootDir, "tables", `${table.name}.jsonl`), table.contents);
  }
  await writeManifestReplace(options.targetRootDir, artifact.value.sourceManifest);

  return restoreReport({
    restoreStatus: "restored",
    restoredSchemaVersion: artifact.value.sourceSchemaVersion,
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

async function isDirectoryNonEmpty(rootDir: string): Promise<boolean> {
  try {
    return (await readdir(rootDir)).length > 0;
  } catch (error) {
    if (isNotFound(error)) return false;
    return true;
  }
}

async function isPathSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch (error) {
    if (isNotFound(error)) return false;
    return true;
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

async function writeManifestReplace(rootDir: string, manifest: LocalDurableDbManifest): Promise<void> {
  await writeJsonReplace(join(rootDir, LOCAL_DURABLE_DB_MANIFEST), manifest);
}

async function writeJsonExclusive(path: string, value: unknown): Promise<void> {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function writeJsonReplace(path: string, value: unknown): Promise<void> {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function readBackupArtifact(path: string): Promise<
  | { readonly status: "valid"; readonly value: LocalDurableDbBackupArtifact }
  | { readonly status: "invalid"; readonly failureCode: LocalDurableDbBackupFailureCode }
> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { status: "invalid", failureCode: "local_durable_db_backup_invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", failureCode: "local_durable_db_backup_invalid" };
  }

  if (!isBackupArtifact(parsed)) {
    return { status: "invalid", failureCode: "local_durable_db_backup_invalid" };
  }
  if (!parsed.tables.every((table) => table.sha256 === sha256(table.contents))) {
    return { status: "invalid", failureCode: "local_durable_db_backup_checksum_mismatch" };
  }
  return { status: "valid", value: parsed };
}

function isBackupArtifact(value: unknown): value is LocalDurableDbBackupArtifact {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const tables = record.tables;
  const boundary = record.boundary;
  return (
    record.kind === LOCAL_DURABLE_DB_BACKUP_KIND &&
    record.backupVersion === CURRENT_LOCAL_DURABLE_DB_BACKUP_VERSION &&
    typeof record.createdAt === "string" &&
    Number.isInteger(record.sourceSchemaVersion) &&
    isManifest(record.sourceManifest) &&
    Array.isArray(tables) &&
    tables.length === TABLES.length &&
    TABLES.every((table, index) => {
      const entry = tables[index];
      return (
        typeof entry === "object" &&
        entry !== null &&
        !Array.isArray(entry) &&
        (entry as Record<string, unknown>).name === table &&
        typeof (entry as Record<string, unknown>).contents === "string" &&
        typeof (entry as Record<string, unknown>).sha256 === "string"
      );
    }) &&
    typeof boundary === "object" &&
    boundary !== null &&
    !Array.isArray(boundary) &&
    (boundary as Record<string, unknown>).providerCallsMade === 0 &&
    (boundary as Record<string, unknown>).providerSpend === false &&
    (boundary as Record<string, unknown>).graphIngestionExecuted === false &&
    (boundary as Record<string, unknown>).productionWrites === false &&
    (boundary as Record<string, unknown>).platformLockIn === false
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function backupReport(input: {
  readonly backupStatus: LocalDurableDbBackupStatus;
  readonly sourceSchemaVersion: number | null;
  readonly failureCodes: readonly LocalDurableDbBackupFailureCode[];
}): LocalDurableDbBackupReport {
  return {
    ok: input.backupStatus === "created" && input.failureCodes.length === 0,
    kind: "local-durable-db-backup-report",
    backupStatus: input.backupStatus,
    sourceSchemaVersion: input.sourceSchemaVersion,
    failureCodes: input.failureCodes,
    providerCallsMade: 0,
    providerSpend: false,
    graphIngestionExecuted: false,
    productionWrites: false,
    platformLockIn: false,
  };
}

function restoreReport(input: {
  readonly restoreStatus: LocalDurableDbRestoreStatus;
  readonly restoredSchemaVersion: number | null;
  readonly failureCodes: readonly LocalDurableDbBackupFailureCode[];
}): LocalDurableDbRestoreReport {
  return {
    ok: input.restoreStatus === "restored" && input.failureCodes.length === 0,
    kind: "local-durable-db-restore-report",
    restoreStatus: input.restoreStatus,
    restoredSchemaVersion: input.restoredSchemaVersion,
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
