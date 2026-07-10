import { open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const GRAPH_SNAPSHOT_WRITE_LOCK_SUFFIX = ".write.lock" as const;

export interface GraphSnapshotWriteLock {
  readonly path: string;
}

export type GraphSnapshotWriteLockAcquisition =
  | { readonly ok: true; readonly lock: GraphSnapshotWriteLock }
  | { readonly ok: false; readonly reason: "busy" | "create_failed" | "close_failed" };

export async function canonicalGraphSnapshotDbRootPath(graphSnapshotsPath: string): Promise<string> {
  const dbRootDir = dirname(dirname(graphSnapshotsPath));
  try {
    return await realpath(dbRootDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // Restore may target a not-yet-created DB root. Its parent is created
    // before this helper is called, so canonicalizing the existing parent
    // still collapses aliases without requiring the leaf to exist.
    const canonicalParent = await realpath(dirname(dbRootDir));
    return join(canonicalParent, basename(dbRootDir));
  }
}

export async function graphSnapshotWriteLockPath(graphSnapshotsPath: string): Promise<string> {
  // Keep the sentinel beside the DB root, not inside it. Overwrite-restore
  // removes/recreates the root while holding this lock; an in-root sentinel
  // would disappear mid-transaction and let another writer enter. realpath
  // canonicalization makes aliases to one physical DB share one sentinel.
  const dbRootDir = await canonicalGraphSnapshotDbRootPath(graphSnapshotsPath);
  return `${dbRootDir}${GRAPH_SNAPSHOT_WRITE_LOCK_SUFFIX}`;
}

async function unlinkBestEffort(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Cleanup cannot make a completed durable commit incomplete.
  }
}

/**
 * Attempts the shared graph-snapshot writer lock exactly once. The lock is a
 * sibling sentinel created with exclusive-create semantics; there is no wait
 * or retry path. A close failure removes the sentinel best-effort and fails
 * closed before the caller can enter its transaction.
 */
export async function acquireGraphSnapshotWriteLock(
  graphSnapshotsPath: string,
): Promise<GraphSnapshotWriteLockAcquisition> {
  let path: string;
  try {
    path = await graphSnapshotWriteLockPath(graphSnapshotsPath);
  } catch {
    return { ok: false, reason: "create_failed" };
  }
  let handle;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    return {
      ok: false,
      reason: (error as NodeJS.ErrnoException).code === "EEXIST" ? "busy" : "create_failed",
    };
  }
  try {
    await handle.close();
  } catch {
    await unlinkBestEffort(path);
    return { ok: false, reason: "close_failed" };
  }
  return { ok: true, lock: Object.freeze({ path }) };
}

export async function releaseGraphSnapshotWriteLockBestEffort(
  lock: GraphSnapshotWriteLock,
): Promise<void> {
  await unlinkBestEffort(lock.path);
}
