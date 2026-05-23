import { assertProductionWriteAllowed, type RuntimeMode } from "../modes/index.ts";
import { validateGraphBundleRaw } from "./validate.ts";
import type { GraphBundle } from "./types.ts";

export type GraphRevision = `rev_${number}`;

export interface VersionedGraphSnapshot {
  readonly graphId: string;
  readonly revision: GraphRevision;
  readonly bundle: GraphBundle;
}

export interface VersionedGraphCommitOptions {
  readonly mode: RuntimeMode;
  readonly expectedRevision: GraphRevision | null;
}

export interface VersionedGraphStore {
  load(graphId: string): Promise<VersionedGraphSnapshot | undefined>;
  commit(
    graphId: string,
    bundle: GraphBundle,
    options: VersionedGraphCommitOptions,
  ): Promise<VersionedGraphSnapshot>;
}

export class GraphStoreConflictError extends Error {
  constructor(
    public readonly graphId: string,
    public readonly expectedRevision: GraphRevision | null,
    public readonly actualRevision: GraphRevision | null,
  ) {
    super("graph revision conflict");
    this.name = "GraphStoreConflictError";
  }
}

export class GraphStoreValidationError extends Error {
  constructor(public readonly graphId: string) {
    super("graph bundle failed validation");
    this.name = "GraphStoreValidationError";
  }
}

export function assertSafeGraphId(graphId: string): void {
  if (typeof graphId !== "string") {
    throw new Error("graph id must be a string");
  }
  if (graphId.length < 3 || graphId.length > 240) {
    throw new Error("graph id must be a logical identifier between 3 and 240 characters");
  }
  if (graphId !== graphId.trim()) {
    throw new Error("graph id must not contain leading or trailing whitespace");
  }
  if (
    graphId.startsWith("/") ||
    graphId.includes("\\") ||
    graphId.includes("://") ||
    graphId.includes("//")
  ) {
    throw new Error("graph id must be a logical slash-delimited identifier, not a path or URL");
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}(?:\/|$)/.test(graphId) || graphId.includes("::")) {
    throw new Error("graph id must not contain infrastructure addresses");
  }

  const segments = graphId.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("graph id must not contain empty, dot, or traversal segments");
  }
  if (!segments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(segment))) {
    throw new Error("graph id must contain only safe logical identifier segments");
  }
  if (segments.some((segment) => segment.toLowerCase() === "localhost")) {
    throw new Error("graph id must not contain infrastructure addresses");
  }
}

export class InMemoryVersionedGraphStore implements VersionedGraphStore {
  private readonly graphs = new Map<string, VersionedGraphSnapshot>();

  async load(graphId: string): Promise<VersionedGraphSnapshot | undefined> {
    assertSafeGraphId(graphId);
    const current = this.graphs.get(graphId);
    return current === undefined ? undefined : cloneSnapshot(current);
  }

  async commit(
    graphId: string,
    bundle: GraphBundle,
    options: VersionedGraphCommitOptions,
  ): Promise<VersionedGraphSnapshot> {
    assertProductionWriteAllowed(options.mode);
    assertSafeGraphId(graphId);

    const current = this.graphs.get(graphId);
    const actualRevision = current?.revision ?? null;
    if (actualRevision !== options.expectedRevision) {
      throw new GraphStoreConflictError(graphId, options.expectedRevision, actualRevision);
    }

    const report = validateGraphBundleRaw(bundle, { mode: "fixture" });
    if (!report.ok) {
      throw new GraphStoreValidationError(graphId);
    }

    const nextRevision = nextGraphRevision(actualRevision);
    const next: VersionedGraphSnapshot = {
      graphId,
      revision: nextRevision,
      bundle: cloneBundle(bundle),
    };
    this.graphs.set(graphId, next);
    return cloneSnapshot(next);
  }
}

function nextGraphRevision(current: GraphRevision | null): GraphRevision {
  if (current === null) {
    return "rev_1";
  }
  const value = Number(current.slice("rev_".length));
  return `rev_${value + 1}` as GraphRevision;
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
