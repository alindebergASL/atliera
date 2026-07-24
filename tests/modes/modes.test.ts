// Mode-gate tests.
//
// Phase 1 promises: any attempt to do a "production write" in
// validation/fixture/fake mode throws, and any attempt to call the
// provider/model adapter outside `model` mode throws. Phase 1 has no
// provider integration at all, so even `model` mode throws — the
// activation gate is intentionally closed.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ModelModeNotActivatedError,
  ProductionWriteForbiddenError,
  assertProductionWriteAllowed,
  assertProviderAllowed,
  isSafeMode,
} from "../../src/modes/index.ts";
import { InMemoryGraphStore } from "../../src/graph/store.ts";
import { FakeModelAdapter } from "../../src/agent/model-adapter.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";
import {
  failProductionWriteInValidationMode,
  failProviderCallOutsideModelMode,
} from "../../src/graph/validate.ts";

describe("runtime modes", () => {
  it("identifies safe modes", () => {
    assert.equal(isSafeMode("validation"), true);
    assert.equal(isSafeMode("fixture"), true);
    assert.equal(isSafeMode("fake"), true);
    assert.equal(isSafeMode("model"), false);
    assert.equal(isSafeMode("local-product"), false);
  });

  it("refuses production writes from a safe mode", () => {
    const store = new InMemoryGraphStore();
    assert.throws(
      () => store.commit(makeValidBundle(), "fixture"),
      ProductionWriteForbiddenError,
    );
    assert.throws(
      () => store.commit(makeValidBundle(), "fake"),
      ProductionWriteForbiddenError,
    );
    assert.throws(
      () => store.commit(makeValidBundle(), "validation"),
      ProductionWriteForbiddenError,
    );
  });

  it("refuses provider calls in any non-model mode (and refuses model in Phase 1 too)", () => {
    assert.throws(
      () => assertProviderAllowed("fixture"),
      ModelModeNotActivatedError,
    );
    assert.throws(
      () => assertProviderAllowed("fake"),
      ModelModeNotActivatedError,
    );
    assert.throws(
      () => assertProviderAllowed("model"),
      ModelModeNotActivatedError,
    );
  });

  it("FakeModelAdapter returns empty deterministic proposals in safe modes", async () => {
    const fake = new FakeModelAdapter();
    const r = await fake.propose({ prompt: "anything", mode: "fixture" });
    assert.deepEqual(r, { excerpts: [], claims: [], account_objects: [] });
  });

  it("FakeModelAdapter refuses 'model' mode (Phase 1 has no real provider)", async () => {
    const fake = new FakeModelAdapter();
    await assert.rejects(
      () => fake.propose({ prompt: "anything", mode: "model" }),
      ModelModeNotActivatedError,
    );
  });

  it("guard helpers surface hard failures for unsafe attempts", () => {
    assert.equal(
      failProductionWriteInValidationMode("fixture")?.code,
      "production_write_in_validation_mode",
    );
    assert.equal(failProductionWriteInValidationMode("model"), null);
    assert.equal(
      failProviderCallOutsideModelMode("fixture")?.code,
      "provider_call_outside_model_mode",
    );
    assert.equal(failProviderCallOutsideModelMode("model"), null);
  });

  it("assertProductionWriteAllowed permits non-safe modes (forward-compat)", () => {
    assert.doesNotThrow(() => assertProductionWriteAllowed("model", "in-memory-graph-store"));
  });

  it("local-product and unknown modes cannot enable the general in-memory writer", () => {
    const store = new InMemoryGraphStore();
    assert.throws(
      () => store.commit(makeValidBundle(), "local-product"),
      ProductionWriteForbiddenError,
    );
    assert.throws(
      () => store.commit(makeValidBundle(), "unknown-runtime-mode" as never),
      ProductionWriteForbiddenError,
    );
  });
});
