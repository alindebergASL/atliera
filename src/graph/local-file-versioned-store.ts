import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
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

interface StoredVersionedGraphSnapshotContent {
  readonly kind: "atliera-local-versioned-graph";
  readonly schemaVersion: "2";
  readonly graphId: string;
  readonly revision: GraphRevision;
  readonly bundle: GraphBundle;
}

interface StoredVersionedGraphSnapshot extends StoredVersionedGraphSnapshotContent {
  readonly integritySha256: string;
}

const HASH = /^[a-f0-9]{64}$/;
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("local versioned graph store canonical JSON contains a non-JSON value");
}

function integritySha256(content: StoredVersionedGraphSnapshotContent): string {
  return createHash("sha256").update(canonicalJson(content), "utf8").digest("hex");
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
  const expectedKeys = ["bundle", "graphId", "integritySha256", "kind", "revision", "schemaVersion"].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("local versioned graph store contains an invalid envelope");
  }
  if (record.kind !== "atliera-local-versioned-graph" || record.schemaVersion !== "2" ||
      record.graphId !== expectedGraphId || typeof record.revision !== "string" || !REVISION.test(record.revision) ||
      typeof record.integritySha256 !== "string" || !HASH.test(record.integritySha256)) {
    throw new Error("local versioned graph store identity mismatch");
  }
  const parsed = parseGraphBundle(record.bundle);
  if (!parsed.ok || !validateGraphBundleRaw(parsed.value, { mode: "fixture" }).ok) {
    throw new GraphStoreValidationError(expectedGraphId);
  }
  const content: StoredVersionedGraphSnapshotContent = {
    kind: "atliera-local-versioned-graph",
    schemaVersion: "2",
    graphId: expectedGraphId,
    revision: record.revision as GraphRevision,
    bundle: parsed.value,
  };
  if (integritySha256(content) !== record.integritySha256) {
    throw new Error("local versioned graph store integrity digest mismatch");
  }
  return { graphId: expectedGraphId, revision: content.revision, bundle: cloneBundle(parsed.value) };
}

/**
 * Portable local implementation of VersionedGraphStore.
 *
 * The caller supplies the root. Each graph is a hash-addressed JSON file under
 * that root; no repository, home-directory, control-plane, or gateway path is
 * consulted. A graph-scoped exclusive lock serializes one atomic temp+rename
 * commit. Lock acquisition and all other operations are single-attempt only.
 *
 * The stored canonical digest detects corruption or drift. It is not a
 * signature and supplies no writer identity or write authority.
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

  protected async replaceGraphFile(tempPath: string, path: string): Promise<void> {
    await rename(tempPath, path);
  }

  private async syncGraphsDirectory(): Promise<void> {
    const directory = await open(this.graphsRoot, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
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
    assertProductionWriteAllowed(options.mode, "local-file-versioned-graph-store");
    assertSafeGraphId(graphId);
    const parsed = parseGraphBundle(bundle);
    if (!parsed.ok || !validateGraphBundleRaw(parsed.value, { mode: "fixture" }).ok) {
      throw new GraphStoreValidationError(graphId);
    }
    const validatedBundle = cloneBundle(parsed.value);

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
    let temp: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const current = await this.load(graphId);
      const actualRevision = current?.revision ?? null;
      if (actualRevision !== options.expectedRevision) {
        throw new GraphStoreConflictError(graphId, options.expectedRevision, actualRevision);
      }
      const revision = nextRevision(actualRevision);
      const content: StoredVersionedGraphSnapshotContent = {
        kind: "atliera-local-versioned-graph",
        schemaVersion: "2",
        graphId,
        revision,
        bundle: validatedBundle,
      };
      const stored: StoredVersionedGraphSnapshot = {
        ...content,
        integritySha256: integritySha256(content),
      };
      temp = await open(tempPath, "wx", 0o600);
      await temp.writeFile(`${JSON.stringify(stored, null, 2)}\n`, "utf8");
      await temp.sync();
      await temp.close();
      temp = undefined;
      await this.replaceGraphFile(tempPath, path);
      await this.syncGraphsDirectory();
      return cloneSnapshot({ graphId, revision, bundle: validatedBundle });
    } finally {
      await temp?.close().catch(() => undefined);
      await rm(tempPath, { force: true }).catch(() => undefined);
      await lock.close().catch(() => undefined);
      await rm(lockPath, { force: true }).catch(() => undefined);
    }
  }
}
