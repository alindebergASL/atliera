import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION,
  initializeLocalDurableDb,
  inspectLocalDurableDb,
} from "../../src/db/local-durable-db.ts";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-local-db-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("local durable DB boot initializes an empty root with schema metadata and adapter tables", async () => {
  await withTempDir(async (rootDir) => {
    const before = await inspectLocalDurableDb({ rootDir });
    assert.equal(before.ok, false);
    assert.equal(before.databaseStatus, "absent");
    assert.equal(before.providerCallsMade, 0);
    assert.equal(before.productionWrites, false);
    assert.equal(before.platformLockIn, false);

    const boot = await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });

    assert.equal(boot.ok, true);
    assert.equal(boot.databaseStatus, "initialized");
    assert.equal(boot.schemaVersion, CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION);
    assert.deepEqual(boot.migrationsApplied, ["001_local_durable_boot"]);
    assert.equal(boot.providerCallsMade, 0);
    assert.equal(boot.productionWrites, false);
    assert.equal(boot.graphIngestionExecuted, false);
    assert.equal(boot.platformLockIn, false);

    const manifest = JSON.parse(await readFile(join(rootDir, "atliera-local-db.json"), "utf8"));
    assert.equal(manifest.kind, "atliera-local-durable-db");
    assert.equal(manifest.schemaVersion, CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION);
    assert.deepEqual(manifest.tables, ["graph_snapshots", "job_queue", "schema_migrations"]);

    const after = await inspectLocalDurableDb({ rootDir });
    assert.equal(after.ok, true);
    assert.equal(after.databaseStatus, "initialized");
    assert.equal(after.schemaVersion, CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION);
  });
});

test("local durable DB boot is idempotent on an already-current root", async () => {
  await withTempDir(async (rootDir) => {
    await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });
    const second = await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:01:00.000Z" });

    assert.equal(second.ok, true);
    assert.equal(second.databaseStatus, "initialized");
    assert.deepEqual(second.migrationsApplied, []);
    assert.equal(second.schemaVersion, CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION);
  });
});

test("local durable DB inspection distinguishes older schema from migration failure", async () => {
  await withTempDir(async (rootDir) => {
    await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });
    const manifestPath = join(rootDir, "atliera-local-db.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, schemaVersion: 0 }, null, 2)}\n`);
    const older = await inspectLocalDurableDb({ rootDir });
    assert.equal(older.ok, false);
    assert.equal(older.databaseStatus, "migration_required");
    assert.deepEqual(older.failureCodes, ["local_durable_db_schema_version_outdated"]);

    await writeFile(manifestPath, "{ not valid json");
    const broken = await inspectLocalDurableDb({ rootDir });
    assert.equal(broken.ok, false);
    assert.equal(broken.databaseStatus, "migration_failed");
    assert.deepEqual(broken.failureCodes, ["local_durable_db_manifest_invalid"]);
  });
});

test("local durable DB init fails closed without clobbering partial roots", async () => {
  await withTempDir(async (rootDir) => {
    await mkdir(join(rootDir, "tables"), { recursive: true });
    await writeFile(join(rootDir, "tables", "graph_snapshots.jsonl"), "sentinel\n");

    const inspect = await inspectLocalDurableDb({ rootDir });
    assert.equal(inspect.ok, false);
    assert.equal(inspect.databaseStatus, "migration_failed");
    assert.deepEqual(inspect.failureCodes, ["local_durable_db_manifest_missing_with_existing_state"]);

    const init = await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });
    assert.equal(init.ok, false);
    assert.equal(init.databaseStatus, "migration_failed");
    assert.deepEqual(init.failureCodes, ["local_durable_db_manifest_missing_with_existing_state"]);
    assert.equal(await readFile(join(rootDir, "tables", "graph_snapshots.jsonl"), "utf8"), "sentinel\n");
  });
});

test("local durable DB inspection refuses forward schema versions non-destructively", async () => {
  await withTempDir(async (rootDir) => {
    await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });
    const manifestPath = join(rootDir, "atliera-local-db.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, schemaVersion: 999 }, null, 2)}\n`);

    const report = await inspectLocalDurableDb({ rootDir });
    assert.equal(report.ok, false);
    assert.equal(report.databaseStatus, "migration_failed");
    assert.deepEqual(report.failureCodes, ["local_durable_db_schema_version_unsupported"]);
  });
});
