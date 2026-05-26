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

export interface DatabaseGraphRow {
  readonly graphId: string;
  readonly revision: number;
  readonly bundleJson: string;
}

export type DatabaseGraphInsertResult = { inserted: true } | { inserted: false; currentRevision: number };
export type DatabaseGraphUpdateResult = { updated: true } | { updated: false; currentRevision: number | null };

export interface DatabaseGraphStoreClient {
  selectGraph(input: { table: string; graphId: string }): Promise<DatabaseGraphRow | undefined>;
  insertGraph(input: {
    table: string;
    graphId: string;
    revision: number;
    bundleJson: string;
  }): Promise<DatabaseGraphInsertResult>;
  updateGraph(input: {
    table: string;
    graphId: string;
    expectedRevision: number;
    revision: number;
    bundleJson: string;
  }): Promise<DatabaseGraphUpdateResult>;
}

export interface DatabaseGraphStoreEvent {
  readonly operation: "load" | "commit";
  readonly status: "start" | "success" | "failure";
  readonly graphId: string;
  readonly durationMs: number;
  readonly failureCategory?: "dependency_unavailable";
}

export type DatabaseGraphStoreObserver = (event: DatabaseGraphStoreEvent) => void;

export interface DatabaseVersionedGraphStoreOptions {
  readonly table: string;
  readonly client: DatabaseGraphStoreClient;
  readonly observe?: DatabaseGraphStoreObserver;
}

const SAFE_TABLE_NAME = /^[A-Za-z][A-Za-z0-9_]{2,127}$/;

export class DatabaseVersionedGraphStore implements VersionedGraphStore {
  private readonly table: string;
  private readonly client: DatabaseGraphStoreClient;
  private readonly observe: DatabaseGraphStoreObserver | undefined;

  constructor(options: DatabaseVersionedGraphStoreOptions) {
    assertSafeTableName(options.table);
    this.table = options.table;
    this.client = options.client;
    this.observe = options.observe;
  }

  async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    assertSafeGraphId(graphId);
    const startedAt = Date.now();
    this.emit({ operation: "load", status: "start", graphId, durationMs: 0 });

    let row: DatabaseGraphRow | undefined;
    try {
      row = await this.client.selectGraph({ table: this.table, graphId });
    } catch {
      this.emit({
        operation: "load",
        status: "failure",
        graphId,
        durationMs: Date.now() - startedAt,
        failureCategory: "dependency_unavailable",
      });
      throw wrapBackendError("load");
    }

    let snapshot: VersionedGraphSnapshot | undefined;
    try {
      snapshot = row === undefined ? undefined : snapshotFromRow(row, graphId);
    } catch {
      this.emit({
        operation: "load",
        status: "failure",
        graphId,
        durationMs: Date.now() - startedAt,
        failureCategory: "dependency_unavailable",
      });
      throw wrapBackendError("load");
    }

    this.emit({ operation: "load", status: "success", graphId, durationMs: Date.now() - startedAt });
    return snapshot;
  }

  async commit(
    graphId: string,
    bundle: GraphBundle,
    options: VersionedGraphCommitOptions,
  ): Promise<VersionedGraphSnapshot> {
    assertProductionWriteAllowed(options.mode);
    assertSafeGraphId(graphId);
    assertValidBundle(graphId, bundle);

    const nextRevision = nextRevisionNumber(options.expectedRevision);
    const bundleJson = JSON.stringify(bundle);
    const startedAt = Date.now();
    this.emit({ operation: "commit", status: "start", graphId, durationMs: 0 });

    let snapshot: VersionedGraphSnapshot;
    try {
      if (options.expectedRevision === null) {
        const result = await this.client.insertGraph({
          table: this.table,
          graphId,
          revision: nextRevision,
          bundleJson,
        });
        assertDatabaseGraphInsertResult(result);
        if (result.inserted === false) {
          throw new GraphStoreConflictError(graphId, null, revisionToken(result.currentRevision));
        }
      } else {
        const expectedRevision = revisionNumber(options.expectedRevision);
        const result = await this.client.updateGraph({
          table: this.table,
          graphId,
          expectedRevision,
          revision: nextRevision,
          bundleJson,
        });
        assertDatabaseGraphUpdateResult(result, expectedRevision);
        if (result.updated === false) {
          throw new GraphStoreConflictError(
            graphId,
            options.expectedRevision,
            result.currentRevision === null ? null : revisionToken(result.currentRevision),
          );
        }
      }
      snapshot = { graphId, revision: revisionToken(nextRevision), bundle: cloneBundle(bundle) };
    } catch (error) {
      this.emit({
        operation: "commit",
        status: "failure",
        graphId,
        durationMs: Date.now() - startedAt,
        failureCategory: error instanceof GraphStoreConflictError ? undefined : "dependency_unavailable",
      });
      if (error instanceof GraphStoreConflictError) {
        throw error;
      }
      throw wrapBackendError("commit");
    }

    this.emit({ operation: "commit", status: "success", graphId, durationMs: Date.now() - startedAt });
    return cloneSnapshot(snapshot);
  }

  private emit(event: DatabaseGraphStoreEvent): void {
    try {
      this.observe?.({ ...event });
    } catch {
      // Observability is best-effort and must not change graph-store outcomes.
    }
  }
}

function assertSafeTableName(table: string): void {
  if (
    typeof table !== "string" ||
    table.trim() !== table ||
    !SAFE_TABLE_NAME.test(table) ||
    table.includes("__")
  ) {
    throw new Error("DatabaseVersionedGraphStore table must be a logical database table identifier");
  }
}

function assertValidBundle(graphId: string, bundle: GraphBundle): void {
  const report = validateGraphBundleRaw(bundle, { mode: "fixture" });
  if (!report.ok) {
    throw new GraphStoreValidationError(graphId);
  }
}

function assertDatabaseGraphInsertResult(result: unknown): asserts result is DatabaseGraphInsertResult {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error("database graph insert result is invalid");
  }

  const inserted = (result as { inserted?: unknown }).inserted;
  if (inserted === true) {
    return;
  }

  if (inserted === false && isValidBackendRevision((result as { currentRevision?: unknown }).currentRevision)) {
    return;
  }

  throw new Error("database graph insert result is invalid");
}

function assertDatabaseGraphUpdateResult(result: unknown, expectedRevision: number): asserts result is DatabaseGraphUpdateResult {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error("database graph update result is invalid");
  }

  const updated = (result as { updated?: unknown }).updated;
  if (updated === true) {
    return;
  }

  const currentRevision = (result as { currentRevision?: unknown }).currentRevision;
  if (
    updated === false &&
    (currentRevision === null || (isValidBackendRevision(currentRevision) && currentRevision !== expectedRevision))
  ) {
    return;
  }

  throw new Error("database graph update result is invalid");
}

function isValidBackendRevision(revision: unknown): revision is number {
  return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 1;
}

function snapshotFromRow(row: DatabaseGraphRow, requestedGraphId: string): VersionedGraphSnapshot {
  if (row.graphId !== requestedGraphId) {
    throw new Error("database graph row identity mismatch");
  }
  assertSafeGraphId(row.graphId);

  let raw: unknown;
  try {
    raw = JSON.parse(row.bundleJson);
  } catch {
    throw new Error("DatabaseVersionedGraphStore load failed: dependency_unavailable; backend error details were sanitized");
  }

  const parsed = parseGraphBundle(raw);
  if (!parsed.ok) {
    throw new Error("DatabaseVersionedGraphStore load failed: dependency_unavailable; backend error details were sanitized");
  }

  return {
    graphId: row.graphId,
    revision: revisionToken(row.revision),
    bundle: cloneBundle(parsed.value),
  };
}

function nextRevisionNumber(current: GraphRevision | null): number {
  return current === null ? 1 : revisionNumber(current) + 1;
}

function revisionNumber(revision: GraphRevision): number {
  const value = Number(revision.slice("rev_".length));
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("graph revision token is invalid");
  }
  return value;
}

function revisionToken(revision: number): GraphRevision {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("database graph revision is invalid");
  }
  return `rev_${revision}` as GraphRevision;
}

function cloneSnapshot(snapshot: VersionedGraphSnapshot): VersionedGraphSnapshot {
  return {
    graphId: snapshot.graphId,
    revision: snapshot.revision,
    bundle: cloneBundle(snapshot.bundle),
  };
}

function cloneBundle(bundle: GraphBundle): GraphBundle {
  return structuredClone(bundle) as GraphBundle;
}

function wrapBackendError(operation: "load" | "commit"): Error {
  return new Error(
    `DatabaseVersionedGraphStore ${operation} failed: dependency_unavailable; backend error details were sanitized`,
  );
}
