import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { proveModelOnlyCodexAuthLiveTransport } from "../../src/model/model-only-codex-auth-live-transport-proof.ts";
import type {
  ModelOnlyCodexAuthLiveTransportBoundary,
  ModelOnlyCodexAuthLiveTransportProofInput,
} from "../../src/model/model-only-codex-auth-live-transport-proof.ts";

const ROUTE_REF = "gpt-5.5-openai-codex-20260602a";
const PROVIDER_REF = "openai-codex";
const MODEL_LABEL = "gpt-5.5";
const TRANSPORT_KIND = "model-only-codex-auth";

const BOUNDARY_KEYS = [
  "acceptsModelProviderRequestOnly",
  "returnsModelProviderResponseOnly",
  "requestShapeExact",
  "responseShapeExact",
  "syntheticScopeOnly",
  "credentialNeutral",
  "privateEvidenceOutsideRepo",
  "noTools",
  "noShell",
  "noFileAccess",
  "noWebSearch",
  "noPlugins",
  "noMcp",
  "noRetrieval",
  "noSessionCarryover",
] as const;

function safeBoundary(): ModelOnlyCodexAuthLiveTransportBoundary {
  return {
    acceptsModelProviderRequestOnly: true,
    returnsModelProviderResponseOnly: true,
    requestShapeExact: true,
    responseShapeExact: true,
    syntheticScopeOnly: true,
    credentialNeutral: true,
    privateEvidenceOutsideRepo: true,
    noTools: true,
    noShell: true,
    noFileAccess: true,
    noWebSearch: true,
    noPlugins: true,
    noMcp: true,
    noRetrieval: true,
    noSessionCarryover: true,
  };
}

function baseInput(): ModelOnlyCodexAuthLiveTransportProofInput {
  return {
    routeRef: ROUTE_REF,
    providerRef: PROVIDER_REF,
    modelLabel: MODEL_LABEL,
    transportKind: TRANSPORT_KIND,
    approvedMaxCostUsd: 1,
    boundary: safeBoundary(),
    accounting: {
      transportInvoked: false,
      providerCallsExecuted: 0,
      observedCostUsd: 0,
      rawEvidenceCommitted: false,
    },
  };
}

describe("model-only codex-auth live transport proof (no-call prerequisite)", () => {
  test("emits a sanitized no-call boundary proof when every boundary flag is safe", () => {
    const proof = proveModelOnlyCodexAuthLiveTransport(baseInput());

    assert.equal(proof.status, "no-call-model-only-codex-auth-transport-proven");
    assert.equal(proof.route_ref, ROUTE_REF);
    assert.equal(proof.provider_ref, PROVIDER_REF);
    assert.equal(proof.model_label, MODEL_LABEL);
    assert.equal(proof.transport_kind, TRANSPORT_KIND);
    assert.equal(proof.approved_max_cost_usd, 1);
    // Boundary-contract proof only — never a live-call proof.
    assert.equal(proof.model_only_transport_proven, true);
    assert.equal(proof.model_only_live_transport_implemented, false);
    assert.equal(proof.transport_invoked, false);
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.provider_spend, false);
    assert.equal(proof.observed_cost_usd, 0);
    assert.equal(proof.raw_evidence_committed, false);
    assert.equal(proof.credential_value_observed, false);
    // Forbidden surfaces are all proven absent.
    assert.equal(proof.no_tools, true);
    assert.equal(proof.no_shell, true);
    assert.equal(proof.no_file_access, true);
    assert.equal(proof.no_web_search, true);
    assert.equal(proof.no_plugins, true);
    assert.equal(proof.no_mcp, true);
    assert.equal(proof.no_retrieval, true);
    assert.equal(proof.no_session_carryover, true);
    // Non-authorizing markers.
    assert.equal(proof.authorizes_provider_call, false);
    assert.equal(proof.authorizes_candidate_calls, false);
    assert.equal(proof.authorizes_comparison_run, false);
    assert.equal(proof.default_model_selection_claim, false);
    assert.equal(proof.provider_lock_in, false);
    assert.equal(proof.production_readiness_claim, false);
    assert.equal(proof.product_readiness_claim, false);
    assert.equal(proof.launch_readiness_claim, false);
    assert.equal(proof.retry_requires_new_approval, true);
    assert.equal(proof.requires_fresh_approval_before_live_proof, true);
    // The proof object is frozen.
    assert.ok(Object.isFrozen(proof));
  });

  test("rejects any descriptor outside the single approved route boundary", () => {
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), routeRef: "some-other-route-20260602a" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), providerRef: "anthropic" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), modelLabel: "gpt-other" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), transportKind: "autonomous-agent" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), approvedMaxCostUsd: 2 }), /transport proof rejected/);
  });

  test("fails closed when any single boundary safety flag is broadened, false, or missing", () => {
    for (const key of BOUNDARY_KEYS) {
      const flipped = { ...safeBoundary(), [key]: false };
      assert.throws(
        () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), boundary: flipped }),
        /transport proof rejected/,
        `boundary flag ${key} flipped to false must fail closed`,
      );
      // A truthy non-boolean must also be rejected (exact === true only).
      const truthy = { ...safeBoundary(), [key]: "true" as unknown as boolean };
      assert.throws(
        () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), boundary: truthy }),
        /transport proof rejected/,
        `boundary flag ${key} as truthy non-boolean must fail closed`,
      );
      // A missing flag must also be rejected (exact key set required).
      const missing = { ...safeBoundary() } as Record<string, unknown>;
      delete missing[key];
      assert.throws(
        () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), boundary: missing as never }),
        /transport proof rejected/,
        `missing boundary flag ${key} must fail closed`,
      );
    }
  });

  test("fails closed on nonzero or contradictory accounting", () => {
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), accounting: { transportInvoked: true, providerCallsExecuted: 0, observedCostUsd: 0, rawEvidenceCommitted: false } }),
      /transport proof rejected/,
    );
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), accounting: { transportInvoked: false, providerCallsExecuted: 1, observedCostUsd: 0, rawEvidenceCommitted: false } }),
      /transport proof rejected/,
    );
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), accounting: { transportInvoked: false, providerCallsExecuted: 0, observedCostUsd: 0.5, rawEvidenceCommitted: false } }),
      /transport proof rejected/,
    );
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), accounting: { transportInvoked: false, providerCallsExecuted: 0, observedCostUsd: 0, rawEvidenceCommitted: true } }),
      /transport proof rejected/,
    );
  });

  test("rejects extra keys, prototype-backed inputs, accessors, and symbols at the root", () => {
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), bonus: "extra" } as unknown as ModelOnlyCodexAuthLiveTransportProofInput),
      /transport proof rejected/,
    );
    const protoBacked = Object.create({ authorizationHeader: "Bearer SECRET" });
    Object.assign(protoBacked, baseInput());
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport(protoBacked), /transport proof rejected/);
    const withAccessor = { ...baseInput() } as Record<string, unknown>;
    Object.defineProperty(withAccessor, "routeRef", { get: () => ROUTE_REF, enumerable: true, configurable: true });
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport(withAccessor as unknown as ModelOnlyCodexAuthLiveTransportProofInput),
      /transport proof rejected/,
    );
    const withSymbol = { ...baseInput() } as Record<string | symbol, unknown>;
    withSymbol[Symbol("smuggle")] = "x";
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport(withSymbol as unknown as ModelOnlyCodexAuthLiveTransportProofInput),
      /transport proof rejected/,
    );
  });

  test("rejects nested boundary / accounting objects with extra keys, accessors, or symbols", () => {
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), boundary: { ...safeBoundary(), credential: "Bearer SECRET" } as never }),
      /transport proof rejected/,
    );
    const accessorBoundary = { ...safeBoundary() } as Record<string, unknown>;
    Object.defineProperty(accessorBoundary, "noTools", { get: () => true, enumerable: true, configurable: true });
    assert.throws(
      () => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), boundary: accessorBoundary as never }),
      /transport proof rejected/,
    );
    assert.throws(
      () =>
        proveModelOnlyCodexAuthLiveTransport({
          ...baseInput(),
          accounting: { transportInvoked: false, providerCallsExecuted: 0, observedCostUsd: 0, rawEvidenceCommitted: false, leak: "x" } as never,
        }),
      /transport proof rejected/,
    );
  });

  test("snapshots root descriptor values instead of rereading hostile proxy top-level properties", () => {
    let getCount = 0;
    const hostile = new Proxy(baseInput(), {
      get(target, property, receiver) {
        getCount += 1;
        if (property === "routeRef") return "safe\n- raw_request: SECRET";
        if (property === "transportKind") return "autonomous-agent";
        return Reflect.get(target, property, receiver);
      },
    });

    const proof = proveModelOnlyCodexAuthLiveTransport(hostile);

    // The proof must read every field via descriptor snapshots only, so the
    // hostile get trap must never fire.
    assert.equal(getCount, 0, `root proxy get trap fired ${getCount} times`);
    assert.equal(proof.route_ref, ROUTE_REF);
    assert.equal(proof.transport_kind, TRANSPORT_KIND);
  });

  test("snapshots nested boundary object without firing its hostile get trap", () => {
    let boundaryGetCount = 0;
    const hostileBoundary = new Proxy(safeBoundary(), {
      get(target, property, receiver) {
        boundaryGetCount += 1;
        // If [[Get]] ever fires here, smuggle a broadened surface that would
        // otherwise need to be caught by the fail-closed flag checks.
        if (property === "noTools") return false;
        return Reflect.get(target, property, receiver);
      },
    });

    const proof = proveModelOnlyCodexAuthLiveTransport({
      ...baseInput(),
      boundary: hostileBoundary as never,
    });

    assert.equal(boundaryGetCount, 0, `boundary proxy get trap fired ${boundaryGetCount} times`);
    assert.equal(proof.no_tools, true);
    assert.equal(proof.model_only_transport_proven, true);
  });

  test("snapshots nested accounting object without firing its hostile get trap", () => {
    let accountingGetCount = 0;
    const hostileAccounting = new Proxy(
      { transportInvoked: false, providerCallsExecuted: 0, observedCostUsd: 0, rawEvidenceCommitted: false },
      {
        get(target, property, receiver) {
          accountingGetCount += 1;
          // Would smuggle a nonzero spend / call past the zero-accounting gate.
          if (property === "providerCallsExecuted") return 1;
          if (property === "observedCostUsd") return 0.99;
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const proof = proveModelOnlyCodexAuthLiveTransport({
      ...baseInput(),
      accounting: hostileAccounting as never,
    });

    assert.equal(accountingGetCount, 0, `accounting proxy get trap fired ${accountingGetCount} times`);
    assert.equal(proof.provider_calls_executed, 0);
    assert.equal(proof.observed_cost_usd, 0);
    assert.equal(proof.provider_spend, false);
  });

  test("rejects unsafe route/provider/transport logical IDs", () => {
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), routeRef: "../etc/passwd" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), providerRef: "https://evil" }), /transport proof rejected/);
    assert.throws(() => proveModelOnlyCodexAuthLiveTransport({ ...baseInput(), transportKind: "model-only\\codex" }), /transport proof rejected/);
  });
});
