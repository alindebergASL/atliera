// Runtime mode definitions.
//
// `fixture` and `fake` are the only modes safe to run by default. Both
// are deterministic, no-spend, no-network. `model` is reserved for an
// explicit, budgeted future provider mode and must fail closed until
// activated by a separate phase. `validation` is a read-only mode used
// by validators and CI. `local-product` is an explicit local durable-write
// mode: it is not default-safe, does not activate providers, and is confined
// to the repository-native local versioned graph store. Every write surface
// has a positive mode allowlist so adding a runtime mode cannot silently
// authorize unrelated writers.

export type RuntimeMode = "validation" | "fixture" | "fake" | "model" | "local-product";

export const SAFE_MODES: ReadonlySet<RuntimeMode> = new Set([
  "validation",
  "fixture",
  "fake",
]);

export function isSafeMode(mode: RuntimeMode): boolean {
  return SAFE_MODES.has(mode);
}

export class ModelModeNotActivatedError extends Error {
  constructor(mode: RuntimeMode) {
    super(
      `model mode is not activated in Phase 1; refusing call from mode '${mode}'`,
    );
    this.name = "ModelModeNotActivatedError";
  }
}

export class ProductionWriteForbiddenError extends Error {
  constructor(mode: RuntimeMode, surface?: ProductionWriteSurface) {
    super(`production writes are forbidden in mode '${mode}'${surface ? ` for '${surface}'` : ""}`);
    this.name = "ProductionWriteForbiddenError";
  }
}

export type ProductionWriteSurface =
  | "database-versioned-graph-store"
  | "graph-bundle-file"
  | "in-memory-graph-store"
  | "in-memory-versioned-graph-store"
  | "local-file-versioned-graph-store"
  | "run-artifact-manifest";

const PRODUCTION_WRITE_MODE_ALLOWLISTS: Readonly<Record<
  ProductionWriteSurface,
  ReadonlySet<RuntimeMode>
>> = Object.freeze({
  "database-versioned-graph-store": new Set<RuntimeMode>(["model"]),
  "graph-bundle-file": new Set<RuntimeMode>(["model"]),
  "in-memory-graph-store": new Set<RuntimeMode>(["model"]),
  "in-memory-versioned-graph-store": new Set<RuntimeMode>(["model"]),
  "local-file-versioned-graph-store": new Set<RuntimeMode>(["model", "local-product"]),
  "run-artifact-manifest": new Set<RuntimeMode>(["model"]),
});

// Central guard that any candidate provider invocation must call before
// doing real work. In Phase 1 this always throws — there is no real
// model integration yet, so any caller that reaches the guard is by
// definition mis-wired.
export function assertProviderAllowed(mode: RuntimeMode): void {
  if (mode !== "model") {
    throw new ModelModeNotActivatedError(mode);
  }
  // Even in `model` mode, Phase 1 has no provider wiring; refuse.
  throw new ModelModeNotActivatedError(mode);
}

export function assertProductionWriteAllowed(
  mode: RuntimeMode,
  surface: ProductionWriteSurface,
): void {
  if (!PRODUCTION_WRITE_MODE_ALLOWLISTS[surface].has(mode)) {
    throw new ProductionWriteForbiddenError(mode, surface);
  }
}
