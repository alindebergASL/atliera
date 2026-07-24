// Minimal in-memory graph store with mode-gated writes.
//
// Phase 1 doesn't need a real database — validation runs over a
// GraphBundle in memory. The store exists so we can express the
// "production writes during validation mode" invariant in code: every
// write path goes through `commit`, and `commit` refuses to run in any
// safe mode. The actual DB layer lands in a later phase.

import {
  assertProductionWriteAllowed,
  type RuntimeMode,
} from "../modes/index.ts";
import type { GraphBundle } from "./types.ts";

export interface GraphStore {
  readonly snapshot: GraphBundle;
  commit(bundle: GraphBundle, mode: RuntimeMode): void;
}

export class InMemoryGraphStore implements GraphStore {
  private committed: GraphBundle = empty();

  get snapshot(): GraphBundle {
    // Return a shallow-cloned snapshot so callers can't mutate state.
    return {
      sources: [...this.committed.sources],
      excerpts: [...this.committed.excerpts],
      claims: [...this.committed.claims],
      claim_evidence: [...this.committed.claim_evidence],
      account_objects: [...this.committed.account_objects],
      account_object_claims: [...this.committed.account_object_claims],
      research_runs: [...this.committed.research_runs],
      run_artifacts: [...this.committed.run_artifacts],
      audit_events: [...this.committed.audit_events],
    };
  }

  // Write path used by the production code path. Refuses to run in
  // validation / fixture / fake mode.
  commit(bundle: GraphBundle, mode: RuntimeMode): void {
    assertProductionWriteAllowed(mode, "in-memory-graph-store");
    this.committed = bundle;
  }
}

function empty(): GraphBundle {
  return {
    sources: [],
    excerpts: [],
    claims: [],
    claim_evidence: [],
    account_objects: [],
    account_object_claims: [],
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
}
