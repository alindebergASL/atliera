import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { assertProductionWriteAllowed } from "../modes/index.ts";
import { parseGraphBundle } from "./schema.ts";
import type { GraphBundle } from "./types.ts";
import { validateGraphBundleRaw } from "./validate.ts";
import {
  assertSafeGraphId,
  GraphStoreConflictError,
  GraphStoreValidationError,
  type GraphRevision,
  type VersionedGraphCommitOptions,
  type VersionedGraphSnapshot,
  type VersionedGraphStore,
} from "./versioned-store.ts";

interface StoredVersionedGraphSnapshot {
  readonly kind: "atliera-local-versioned-graph";
  readonly schemaVersion: "1";
  readonly graphId: string;
  readonly revision: GraphRevision;
  readonly bundle: GraphBundle;
}

const REVISION = /^rev_([1-9][0-9]*)$/;

function graphFileName(graphId: string): string {
  return `${createHash("sha256").update(graphId, "utf8").digest("hex")}.json`;
}

function cloneBundle(bundle: GraphBundle): GraphBundle {
  return structuredClone(bundle) as GraphBundle;
}

function cloneSnapshot(snapshot: VersionedGraphSnapshot): VersionedGraphSnapshot {
  return { graphId: snapshot.graphId, revision: snapshot.revision, bundle: cloneBundle(snapshot.bundle) };
}

function nextRevision(current: GraphRevision | null): GraphRevision {
  if (current === null) return "rev_1";
  const match = REVISION.exec(current);
  if (!match) throw new Error("local graph revision token is invalid");
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new Error("local graph revision token is invalid");
  }
  return `rev_${value + 1}` as GraphRevision;
}

function parseStoredSnapshot(text: string, expectedGraphId: string): VersionedGraphSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("local versioned graph store contains invalid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("local versioned graph store contains an invalid envelope");
  }
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["bundle", "graphId", "kind", "revision", "schemaVersion"].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("local versioned graph store contains an invalid envelope");
  }
  if (record.kind !== "atliera-local-versioned-graph" || record.schemaVersion !== "1" ||
      record.graphId !== expectedGraphId || typeof record.revision !== "string" || !REVISION.test(record.revision)) {
    throw new Error("local versioned graph store identity mismatch");
  }
  const parsed = parseGraphBundle(record.bundle);
  if (!parsed.ok || !validateGraphBundleRaw(parsed.value, { mode: "fixture" }).ok) {
    throw new GraphStoreValidationError(expectedGraphId);
  }
  return { graphId: expectedGraphId, revision: record.revision as GraphRevision, bundle: cloneBundle(parsed.value) };
}

/**
 * Portable local implementation of VersionedGraphStore.
 *
 * The caller supplies the root. Each graph is a hash-addressed JSON file under
 * that root; no repository, home-directory, control-plane, or gateway path is
 * consulted. A graph-scoped exclusive lock serializes one atomic temp+rename
 * commit. Lock acquisition and all other operations are single-attempt only.
 */
export class LocalFileVersionedGraphStore implements VersionedGraphStore {
  private readonly root: string;
  private readonly graphsRoot: string;

  constructor(root: string) {
    if (typeof root !== "string" || root.trim() === "") {
      throw new Error("local versioned graph store requires an explicit root");
    }
    this.root = resolve(root);
    this.graphsRoot = join(this.root, "graphs");
  }

  private graphPath(graphId: string): string {
    assertSafeGraphId(graphId);
    return join(this.graphsRoot, graphFileName(graphId));
  }

  async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    const path = this.graphPath(graphId);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    return cloneSnapshot(parseStoredSnapshot(text, graphId));
  }

  async commit(graphId: string, bundle: GraphBundle,
    options: VersionedGraphCommitOptions): Promise<VersionedGraphSnapshot> {
    assertProductionWriteAllowed(options.mode);
    assertSafeGraphId(graphId);
    const report = validateGraphBundleRaw(bundle, { mode: "fixture" });
    if (!report.ok) throw new GraphStoreValidationError(graphId);

    await mkdir(this.graphsRoot, { recursive: true, mode: 0o700 });
    const path = this.graphPath(graphId);
    const lockPath = `${path}.lock`;
    let lock: Awaited<ReturnType<typeof open>>;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("local versioned graph store commit is busy; zero retries performed");
      }
      throw error;
    }

    const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const current = await this.load(graphId);
      const actualRevision = current?.revision ?? null;
      if (actualRevision !== options.expectedRevision) {
        throw new GraphStoreConflictError(graphId, options.expectedRevision, actualRevision);
      }
      const revision = nextRevision(actualRevision);
      const stored: StoredVersionedGraphSnapshot = {
        kind: "atliera-local-versioned-graph",
        schemaVersion: "1",
        graphId,
        revision,
        bundle: cloneBundle(bundle),
      };
      await writeFile(tempPath, `${JSON.stringify(stored, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(tempPath, path);
      return cloneSnapshot({ graphId, revision, bundle });
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined);
      await lock.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
    }
  }
}
