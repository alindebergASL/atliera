import type { RuntimeMode } from "../modes/index.ts";
import type { GraphBundle } from "../graph/types.ts";
import {
  assertSafeGraphId,
  GraphStoreConflictError,
  type VersionedGraphStore,
} from "../graph/versioned-store.ts";
import {
  defineResourcePreflightCheck,
  type ResourcePreflightCheckDefinition,
  type ResourcePreflightCheckResult,
} from "./resource-preflight.ts";

export interface GraphStorePreflightCheckOptions {
  readonly store: VersionedGraphStore;
  readonly graphId: string;
  readonly bundle: GraphBundle;
  readonly mode: RuntimeMode;
}

const GRAPH_STORE_PROBE_METADATA = {
  adapter: "graph_store",
  probe: "commit_load",
} as const;

export function defineGraphStorePreflightCheck(
  options: GraphStorePreflightCheckOptions,
): ResourcePreflightCheckDefinition {
  assertSafeGraphId(options.graphId);

  return defineResourcePreflightCheck({
    target: "database",
    name: "graph store commit load probe",
    run: async () => runGraphStoreProbe(options),
  });
}

async function runGraphStoreProbe(
  options: GraphStorePreflightCheckOptions,
): Promise<ResourcePreflightCheckResult> {
  try {
    const committed = await options.store.commit(options.graphId, options.bundle, {
      expectedRevision: null,
      mode: options.mode,
    });
    const readBack = await options.store.load(options.graphId);

    const expectedBundle = canonicalJson(options.bundle);
    if (
      canonicalJson(committed.bundle) !== expectedBundle ||
      readBack === undefined ||
      readBack.revision !== committed.revision ||
      canonicalJson(readBack.bundle) !== expectedBundle
    ) {
      return graphStoreMismatchResult();
    }

    return {
      status: "pass",
      code: "graph_store_reachable",
      message: "graph store commit load probe passed",
      metadata: { ...GRAPH_STORE_PROBE_METADATA },
    };
  } catch (error) {
    if (error instanceof GraphStoreConflictError) {
      return {
        status: "fail",
        code: "graph_store_conflict",
        message: "graph store commit load probe graph already exists",
        metadata: { ...GRAPH_STORE_PROBE_METADATA },
      };
    }

    return {
      status: "fail",
      code: "graph_store_unreachable",
      message: "graph store commit load probe failed",
      metadata: { ...GRAPH_STORE_PROBE_METADATA },
    };
  }
}

function graphStoreMismatchResult(): ResourcePreflightCheckResult {
  return {
    status: "fail",
    code: "graph_store_mismatch",
    message: "graph store commit load probe returned mismatched graph state",
    metadata: { ...GRAPH_STORE_PROBE_METADATA },
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}
