import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";

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

interface MaterialPathIdentity {
  readonly device: number;
  readonly inode: number;
}

interface MaterialDirectory extends MaterialPathIdentity {
  readonly canonicalPath: string;
}

interface MaterialStorePaths {
  readonly root: MaterialDirectory;
  readonly graphs: MaterialDirectory;
}

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

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

function unsafeMaterialPath(reason: "symbolic link" | "canonical path escape" | "non-directory" | "non-file"): never {
  throw new Error(`local versioned graph store refuses a ${reason} in its material paths`);
}

function assertCanonicalContainment(root: string, path: string): void {
  const relation = relative(root, path);
  if (relation === "" || (!isAbsolute(relation) && relation !== ".." && !relation.startsWith(`..${sep}`))) {
    return;
  }
  unsafeMaterialPath("canonical path escape");
}

function sameIdentity(left: MaterialPathIdentity, right: MaterialPathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

async function ensureDirectoryTreeWithoutSymlinks(path: string, create: boolean): Promise<boolean> {
  const root = parse(path).root;
  const segments = path.slice(root.length).split(sep).filter((segment) => segment.length > 0);
  let cursor = root;
  for (const segment of segments) {
    const next = join(cursor, segment);
    let metadata;
    try {
      metadata = await lstat(next);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      if (!create) return false;
      try {
        await mkdir(next, { mode: 0o700 });
      } catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError;
      }
      metadata = await lstat(next);
    }
    if (metadata.isSymbolicLink()) unsafeMaterialPath("symbolic link");
    if (!metadata.isDirectory()) unsafeMaterialPath("non-directory");
    cursor = next;
  }
  return true;
}

async function inspectDirectory(path: string, expectedCanonicalPath: string): Promise<MaterialDirectory> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) unsafeMaterialPath("symbolic link");
  if (!metadata.isDirectory()) unsafeMaterialPath("non-directory");
  const canonicalPath = await realpath(path);
  if (canonicalPath !== expectedCanonicalPath) unsafeMaterialPath("canonical path escape");

  const directory = await open(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const opened = await directory.stat();
    if (!opened.isDirectory()) unsafeMaterialPath("non-directory");
    if (opened.dev !== metadata.dev || opened.ino !== metadata.ino) {
      unsafeMaterialPath("canonical path escape");
    }
  } finally {
    await directory.close();
  }
  return { canonicalPath, device: metadata.dev, inode: metadata.ino };
}

async function inspectFile(
  path: string,
  graphsRoot: string,
): Promise<MaterialPathIdentity | undefined> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
  if (metadata.isSymbolicLink()) unsafeMaterialPath("symbolic link");
  if (!metadata.isFile()) unsafeMaterialPath("non-file");
  const canonicalPath = await realpath(path);
  assertCanonicalContainment(graphsRoot, canonicalPath);
  if (canonicalPath !== path) unsafeMaterialPath("canonical path escape");
  return { device: metadata.dev, inode: metadata.ino };
}

async function assertLockPathAbsent(path: string, graphsRoot: string): Promise<void> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isNotFoundError(error)) return;
    throw error;
  }
  if (metadata.isSymbolicLink()) unsafeMaterialPath("symbolic link");
  const canonicalPath = await realpath(path);
  assertCanonicalContainment(graphsRoot, canonicalPath);
  if (canonicalPath !== path) unsafeMaterialPath("canonical path escape");
  throw new Error("local versioned graph store commit is busy; zero retries performed");
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

  private async inspectStorePaths(create: boolean): Promise<MaterialStorePaths | undefined> {
    if (!await ensureDirectoryTreeWithoutSymlinks(this.root, create)) return undefined;
    const root = await inspectDirectory(this.root, this.root);

    let graphsExists = true;
    try {
      await lstat(this.graphsRoot);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      graphsExists = false;
    }
    if (!graphsExists) {
      if (!create) return undefined;
      try {
        await mkdir(this.graphsRoot, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }

    const graphs = await inspectDirectory(this.graphsRoot, join(root.canonicalPath, "graphs"));
    assertCanonicalContainment(root.canonicalPath, graphs.canonicalPath);
    return { root, graphs };
  }

  private async assertStorePathsUnchanged(expected: MaterialStorePaths): Promise<MaterialStorePaths> {
    const current = await this.inspectStorePaths(false);
    if (!current || current.root.canonicalPath !== expected.root.canonicalPath ||
        current.graphs.canonicalPath !== expected.graphs.canonicalPath ||
        !sameIdentity(current.root, expected.root) || !sameIdentity(current.graphs, expected.graphs)) {
      unsafeMaterialPath("canonical path escape");
    }
    return current;
  }

  private async assertOpenedFile(
    path: string,
    expected: MaterialPathIdentity,
    handle: Awaited<ReturnType<typeof open>>,
    graphsRoot: string,
  ): Promise<void> {
    const opened = await handle.stat();
    if (!opened.isFile()) unsafeMaterialPath("non-file");
    if (!sameIdentity(expected, { device: opened.dev, inode: opened.ino })) {
      unsafeMaterialPath("canonical path escape");
    }
    const current = await inspectFile(path, graphsRoot);
    if (!current || !sameIdentity(current, expected)) unsafeMaterialPath("canonical path escape");
  }

  private async removeOwnedFile(
    path: string,
    identity: MaterialPathIdentity | undefined,
    storePaths: MaterialStorePaths,
  ): Promise<void> {
    if (!identity) return;
    const currentStore = await this.assertStorePathsUnchanged(storePaths);
    const current = await inspectFile(path, currentStore.graphs.canonicalPath);
    if (!current || !sameIdentity(current, identity)) return;
    await rm(path, { force: true });
  }

  private async syncGraphsDirectory(storePaths: MaterialStorePaths): Promise<void> {
    const current = await this.assertStorePathsUnchanged(storePaths);
    const directory = await open(
      this.graphsRoot,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      const opened = await directory.stat();
      if (!opened.isDirectory() ||
          !sameIdentity(current.graphs, { device: opened.dev, inode: opened.ino })) {
        unsafeMaterialPath("canonical path escape");
      }
      await directory.sync();
    } finally {
      await directory.close();
    }
  }

  async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    const path = this.graphPath(graphId);
    const storePaths = await this.inspectStorePaths(false);
    if (!storePaths) return undefined;
    const identity = await inspectFile(path, storePaths.graphs.canonicalPath);
    if (!identity) return undefined;

    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      try {
        file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      } catch (error) {
        if (isNotFoundError(error)) return undefined;
        throw error;
      }
      await this.assertOpenedFile(path, identity, file, storePaths.graphs.canonicalPath);
      const text = await file.readFile("utf8");
      return cloneSnapshot(parseStoredSnapshot(text, graphId));
    } finally {
      await file?.close();
    }
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

    const storePaths = (await this.inspectStorePaths(true))!;
    const path = this.graphPath(graphId);
    const lockPath = `${path}.lock`;
    const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    let lockIdentity: MaterialPathIdentity | undefined;
    let temp: Awaited<ReturnType<typeof open>> | undefined;
    let tempIdentity: MaterialPathIdentity | undefined;
    try {
      await assertLockPathAbsent(lockPath, storePaths.graphs.canonicalPath);
      try {
        lock = await open(
          lockPath,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          await assertLockPathAbsent(lockPath, storePaths.graphs.canonicalPath);
          throw new Error("local versioned graph store commit is busy; zero retries performed");
        }
        throw error;
      }
      const lockMetadata = await lock.stat();
      lockIdentity = { device: lockMetadata.dev, inode: lockMetadata.ino };
      await this.assertOpenedFile(lockPath, lockIdentity, lock, storePaths.graphs.canonicalPath);

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
      await this.assertStorePathsUnchanged(storePaths);
      try {
        temp = await open(
          tempPath,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          await inspectFile(tempPath, storePaths.graphs.canonicalPath);
        }
        throw error;
      }
      const tempMetadata = await temp.stat();
      tempIdentity = { device: tempMetadata.dev, inode: tempMetadata.ino };
      await this.assertOpenedFile(tempPath, tempIdentity, temp, storePaths.graphs.canonicalPath);
      await temp.writeFile(`${JSON.stringify(stored, null, 2)}\n`, "utf8");
      await temp.sync();
      await temp.close();
      temp = undefined;
      await this.assertStorePathsUnchanged(storePaths);
      const currentTemp = await inspectFile(tempPath, storePaths.graphs.canonicalPath);
      if (!currentTemp || !sameIdentity(currentTemp, tempIdentity)) {
        unsafeMaterialPath("canonical path escape");
      }
      await inspectFile(path, storePaths.graphs.canonicalPath);
      await this.replaceGraphFile(tempPath, path);
      tempIdentity = undefined;
      await this.syncGraphsDirectory(storePaths);
      return cloneSnapshot({ graphId, revision, bundle: validatedBundle });
    } finally {
      await temp?.close().catch(() => undefined);
      await this.removeOwnedFile(tempPath, tempIdentity, storePaths).catch(() => undefined);
      await lock?.close().catch(() => undefined);
      await this.removeOwnedFile(lockPath, lockIdentity, storePaths).catch(() => undefined);
    }
  }
}
