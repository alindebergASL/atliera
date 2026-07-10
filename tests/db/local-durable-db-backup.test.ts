import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  backupLocalDurableDb,
  initializeLocalDurableDb,
  inspectLocalDurableDb,
  restoreLocalDurableDbBackup,
} from "../../src/db/local-durable-db.ts";
import { graphSnapshotWriteLockPath } from "../../src/db/graph-snapshot-write-lock.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-local-db-backup-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("local durable DB backup writes a versioned schema-stamped artifact without provider or production side effects", async () => {
  await withTempDir(async (dir) => {
    const rootDir = join(dir, "db");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir, now: "2026-06-09T00:00:00.000Z" });
    await writeFile(join(rootDir, "tables", "graph_snapshots.jsonl"), '{"graph_id":"g1","revision":"r1"}\n');

    const report = await backupLocalDurableDb({ rootDir, backupFile, now: "2026-06-09T00:02:00.000Z" });

    assert.equal(report.ok, true);
    assert.equal(report.kind, "local-durable-db-backup-report");
    assert.equal(report.backupStatus, "created");
    assert.equal(report.providerCallsMade, 0);
    assert.equal(report.providerSpend, false);
    assert.equal(report.graphIngestionExecuted, false);
    assert.equal(report.productionWrites, false);
    assert.equal(report.platformLockIn, false);
    assert.deepEqual(report.failureCodes, []);

    const artifact = JSON.parse(await readFile(backupFile, "utf8"));
    assert.equal(artifact.kind, "atliera-local-durable-db-backup");
    assert.equal(artifact.backupVersion, 1);
    assert.equal(artifact.createdAt, "2026-06-09T00:02:00.000Z");
    assert.equal(artifact.sourceSchemaVersion, 1);
    assert.equal(artifact.boundary.providerCallsMade, 0);
    assert.equal(artifact.boundary.productionWrites, false);
    assert.deepEqual(
      artifact.tables.map((table: { name: string }) => table.name),
      ["graph_snapshots", "job_queue", "schema_migrations"],
    );
    assert.match(artifact.tables[0].sha256, /^[a-f0-9]{64}$/);
  });
});

test("local durable DB restore round-trips an initialized database into an empty target", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source-db");
    const restoredRoot = join(dir, "restored-db");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir: sourceRoot, now: "2026-06-09T00:00:00.000Z" });
    await writeFile(join(sourceRoot, "tables", "graph_snapshots.jsonl"), '{"graph_id":"g1","revision":"r1"}\n');
    await writeFile(join(sourceRoot, "tables", "job_queue.jsonl"), '{"job_id":"j1","status":"queued"}\n');
    await backupLocalDurableDb({ rootDir: sourceRoot, backupFile, now: "2026-06-09T00:02:00.000Z" });

    const restore = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: restoredRoot });

    assert.equal(restore.ok, true);
    assert.equal(restore.kind, "local-durable-db-restore-report");
    assert.equal(restore.restoreStatus, "restored");
    assert.equal(restore.providerCallsMade, 0);
    assert.equal(restore.productionWrites, false);

    const restoredInspect = await inspectLocalDurableDb({ rootDir: restoredRoot });
    assert.equal(restoredInspect.ok, true);
    assert.equal(restoredInspect.databaseStatus, "initialized");
    assert.equal(
      await readFile(join(restoredRoot, "tables", "graph_snapshots.jsonl"), "utf8"),
      await readFile(join(sourceRoot, "tables", "graph_snapshots.jsonl"), "utf8"),
    );
    assert.equal(
      await readFile(join(restoredRoot, "tables", "job_queue.jsonl"), "utf8"),
      await readFile(join(sourceRoot, "tables", "job_queue.jsonl"), "utf8"),
    );
  });
});

test("local durable DB restore refuses non-empty targets unless overwrite is explicit", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source-db");
    const targetRoot = join(dir, "target-db");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir: sourceRoot, now: "2026-06-09T00:00:00.000Z" });
    await writeFile(join(sourceRoot, "tables", "graph_snapshots.jsonl"), "new\n");
    await backupLocalDurableDb({ rootDir: sourceRoot, backupFile, now: "2026-06-09T00:02:00.000Z" });

    await initializeLocalDurableDb({ rootDir: targetRoot, now: "2026-06-09T00:03:00.000Z" });
    await writeFile(join(targetRoot, "tables", "graph_snapshots.jsonl"), "existing\n");

    const refused = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: targetRoot });
    assert.equal(refused.ok, false);
    assert.equal(refused.restoreStatus, "refused");
    assert.deepEqual(refused.failureCodes, ["local_durable_db_restore_target_not_empty"]);
    assert.equal(await readFile(join(targetRoot, "tables", "graph_snapshots.jsonl"), "utf8"), "existing\n");

    const overwritten = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: targetRoot, allowOverwrite: true });
    assert.equal(overwritten.ok, true);
    assert.equal(overwritten.restoreStatus, "restored");
    assert.equal(await readFile(join(targetRoot, "tables", "graph_snapshots.jsonl"), "utf8"), "new\n");
  });
});

test("local durable DB overwrite restore observes the shared graph-snapshot writer lock", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source-db");
    const targetRoot = join(dir, "target-db");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir: sourceRoot, now: "2026-06-09T00:00:00.000Z" });
    await writeFile(join(sourceRoot, "tables", "graph_snapshots.jsonl"), "new\n");
    await backupLocalDurableDb({ rootDir: sourceRoot, backupFile, now: "2026-06-09T00:02:00.000Z" });
    await initializeLocalDurableDb({ rootDir: targetRoot, now: "2026-06-09T00:03:00.000Z" });
    const targetGraphPath = join(targetRoot, "tables", "graph_snapshots.jsonl");
    await writeFile(targetGraphPath, "existing\n");
    await writeFile(await graphSnapshotWriteLockPath(targetGraphPath), "busy");

    const refused = await restoreLocalDurableDbBackup({
      backupFile,
      targetRootDir: targetRoot,
      allowOverwrite: true,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.restoreStatus, "refused");
    assert.deepEqual(refused.failureCodes, ["local_durable_db_restore_write_lock_unavailable"]);
    assert.equal(await readFile(targetGraphPath, "utf8"), "existing\n");
  });
});

test("local durable DB restore refuses any non-empty target directory unless overwrite is explicit", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source-db");
    const targetRoot = join(dir, "target-db");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir: sourceRoot, now: "2026-06-09T00:00:00.000Z" });
    await backupLocalDurableDb({ rootDir: sourceRoot, backupFile, now: "2026-06-09T00:02:00.000Z" });
    await mkdir(targetRoot, { recursive: true });
    await writeFile(join(targetRoot, "sentinel.txt"), "do-not-clobber\n");

    const refused = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: targetRoot });
    assert.equal(refused.ok, false);
    assert.equal(refused.restoreStatus, "refused");
    assert.deepEqual(refused.failureCodes, ["local_durable_db_restore_target_not_empty"]);
    assert.equal(await readFile(join(targetRoot, "sentinel.txt"), "utf8"), "do-not-clobber\n");

    const overwritten = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: targetRoot, allowOverwrite: true });
    assert.equal(overwritten.ok, false);
    assert.equal(overwritten.restoreStatus, "refused");
    assert.equal(await readFile(join(targetRoot, "sentinel.txt"), "utf8"), "do-not-clobber\n");
  });
});

test("local durable DB restore refuses explicit overwrite for non-DB and symlink targets", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source-db");
    const nonDbTarget = join(dir, "not-a-db");
    const realTarget = join(dir, "real-target");
    const symlinkTarget = join(dir, "symlink-target");
    const backupFile = join(dir, "backup.json");
    await initializeLocalDurableDb({ rootDir: sourceRoot, now: "2026-06-09T00:00:00.000Z" });
    await backupLocalDurableDb({ rootDir: sourceRoot, backupFile, now: "2026-06-09T00:02:00.000Z" });
    await mkdir(nonDbTarget, { recursive: true });
    await writeFile(join(nonDbTarget, "sentinel.txt"), "do-not-delete\n");
    await mkdir(realTarget, { recursive: true });
    await symlink(realTarget, symlinkTarget, "dir");

    const nonDb = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: nonDbTarget, allowOverwrite: true });
    assert.equal(nonDb.ok, false);
    assert.equal(nonDb.restoreStatus, "refused");
    assert.deepEqual(nonDb.failureCodes, ["local_durable_db_restore_target_not_empty"]);
    assert.equal(await readFile(join(nonDbTarget, "sentinel.txt"), "utf8"), "do-not-delete\n");

    const symlinked = await restoreLocalDurableDbBackup({ backupFile, targetRootDir: symlinkTarget, allowOverwrite: true });
    assert.equal(symlinked.ok, false);
    assert.equal(symlinked.restoreStatus, "refused");
    assert.deepEqual(symlinked.failureCodes, ["local_durable_db_restore_target_not_empty"]);
  });
});

test("local durable DB backup and restore fail closed on invalid source and backup artifacts", async () => {
  await withTempDir(async (dir) => {
    const missingSource = await backupLocalDurableDb({
      rootDir: join(dir, "missing-db"),
      backupFile: join(dir, "missing-backup.json"),
      now: "2026-06-09T00:02:00.000Z",
    });
    assert.equal(missingSource.ok, false);
    assert.equal(missingSource.backupStatus, "source_not_initialized");
    assert.deepEqual(missingSource.failureCodes, ["local_durable_db_backup_source_not_initialized"]);

    const invalidBackup = join(dir, "invalid-backup.json");
    await writeFile(invalidBackup, "{ not valid json");
    const restore = await restoreLocalDurableDbBackup({ backupFile: invalidBackup, targetRootDir: join(dir, "target") });
    assert.equal(restore.ok, false);
    assert.equal(restore.restoreStatus, "backup_invalid");
    assert.deepEqual(restore.failureCodes, ["local_durable_db_backup_invalid"]);
  });
});
