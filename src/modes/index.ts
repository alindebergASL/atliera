// Runtime mode definitions.
//
// `fixture` and `fake` are the only modes safe to run by default. Both
// are deterministic, no-spend, no-network. `model` is reserved for an
// explicit, budgeted future provider mode and must fail closed until
// activated by a separate phase. `validation` is a read-only mode used
// by validators and CI.

export type RuntimeMode = "validation" | "fixture" | "fake" | "model";

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
  constructor(mode: RuntimeMode) {
    super(`production writes are forbidden in mode '${mode}'`);
    this.name = "ProductionWriteForbiddenError";
  }
}

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

export function assertProductionWriteAllowed(mode: RuntimeMode): void {
  if (SAFE_MODES.has(mode)) {
    throw new ProductionWriteForbiddenError(mode);
  }
}
