import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { decideRuntimeModelOnlyLiveProofExecution } from "../../src/model/runtime-model-only-live-proof-execution.ts";
import type { RuntimeModelOnlyLiveProofExecutionContext } from "../../src/model/runtime-model-only-live-proof-execution.ts";

const ROUTE_REF = "gpt-5.5-openai-codex-20260602a";
const PROVIDER_REF = "openai-codex";
const MODEL_LABEL = "gpt-5.5";

function baseContext(): RuntimeModelOnlyLiveProofExecutionContext {
  return {
    routeRef: ROUTE_REF,
    providerRef: PROVIDER_REF,
    modelLabel: MODEL_LABEL,
    approvedMaxCostUsd: 1,
    transportAvailability: {
      provenModelOnlyLiveTransport: false,
      modelOnlyCredentialResolvable: false,
    },
    blockedReasonCode: "model_only_live_transport_unavailable",
  };
}

describe("runtime model-only live proof execution gate (fail-closed)", () => {
  test("records a sanitized blocked status when no proven model-only transport is available", () => {
    const status = decideRuntimeModelOnlyLiveProofExecution(baseContext());

    assert.equal(status.status, "blocked");
    assert.equal(status.reason_code, "model_only_live_transport_unavailable");
    assert.equal(status.route_ref, ROUTE_REF);
    assert.equal(status.provider_ref, PROVIDER_REF);
    assert.equal(status.model_label, MODEL_LABEL);
    assert.equal(status.provider_calls_executed, 0);
    assert.equal(status.provider_spend, false);
    assert.equal(status.observed_cost_usd, 0);
    assert.equal(status.approved_max_cost_usd, 1);
    assert.equal(status.accepted_output_received, false);
    assert.equal(status.stable_error_code, null);
    // No raw / private / credential evidence may be committed.
    assert.equal(status.raw_request_committed, false);
    assert.equal(status.raw_response_committed, false);
    assert.equal(status.model_output_committed, false);
    assert.equal(status.private_evidence_committed, false);
    assert.equal(status.credential_value_observed, false);
    // Non-authorizing markers.
    assert.equal(status.authorizes_provider_call, false);
    assert.equal(status.authorizes_candidate_calls, false);
    assert.equal(status.authorizes_comparison_run, false);
    assert.equal(status.default_model_selection_claim, false);
    assert.equal(status.provider_lock_in, false);
    assert.equal(status.production_readiness_claim, false);
    assert.equal(status.product_readiness_claim, false);
    assert.equal(status.launch_readiness_claim, false);
    assert.equal(status.retry_requires_new_approval, true);
  });

  test("accepts the model_only_credential_unavailable reason code", () => {
    const status = decideRuntimeModelOnlyLiveProofExecution({
      ...baseContext(),
      blockedReasonCode: "model_only_credential_unavailable",
    });
    assert.equal(status.status, "blocked");
    assert.equal(status.reason_code, "model_only_credential_unavailable");
  });

  test("refuses to record a status when availability is claimed (cannot fabricate accepted output)", () => {
    assert.throws(
      () =>
        decideRuntimeModelOnlyLiveProofExecution({
          ...baseContext(),
          transportAvailability: { provenModelOnlyLiveTransport: true, modelOnlyCredentialResolvable: false },
        }),
      /execution gate refused/,
    );
    assert.throws(
      () =>
        decideRuntimeModelOnlyLiveProofExecution({
          ...baseContext(),
          transportAvailability: { provenModelOnlyLiveTransport: false, modelOnlyCredentialResolvable: true },
        }),
      /execution gate refused/,
    );
  });

  test("rejects any context outside the single approved route boundary", () => {
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), routeRef: "some-other-route-20260602a" }),
      /execution gate rejected/,
    );
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), providerRef: "anthropic" }),
      /execution gate rejected/,
    );
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), modelLabel: "gpt-other" }),
      /execution gate rejected/,
    );
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), approvedMaxCostUsd: 2 }),
      /execution gate rejected/,
    );
  });

  test("rejects an unknown or unsafe blocked reason code", () => {
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), blockedReasonCode: "default_model_selected" }),
      /execution gate rejected/,
    );
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution({ ...baseContext(), blockedReasonCode: "safe\n- raw_prompt: SECRET" }),
      /execution gate rejected/,
    );
  });

  test("rejects extra keys, prototype-backed contexts, accessors, and symbols", () => {
    assert.throws(
      () =>
        decideRuntimeModelOnlyLiveProofExecution({
          ...baseContext(),
          bonus: "extra",
        } as unknown as RuntimeModelOnlyLiveProofExecutionContext),
      /execution gate rejected/,
    );
    const protoBacked = Object.create({ authorizationHeader: "Bearer SECRET" });
    Object.assign(protoBacked, baseContext());
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution(protoBacked),
      /execution gate rejected/,
    );
    const withAccessor = { ...baseContext() } as Record<string, unknown>;
    Object.defineProperty(withAccessor, "routeRef", { get: () => ROUTE_REF, enumerable: true, configurable: true });
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution(withAccessor as unknown as RuntimeModelOnlyLiveProofExecutionContext),
      /execution gate rejected/,
    );
    const withSymbol = { ...baseContext() } as Record<string | symbol, unknown>;
    withSymbol[Symbol("smuggle")] = "x";
    assert.throws(
      () => decideRuntimeModelOnlyLiveProofExecution(withSymbol as unknown as RuntimeModelOnlyLiveProofExecutionContext),
      /execution gate rejected/,
    );
  });

  test("rejects a nested availability object with extra keys or non-boolean facts", () => {
    assert.throws(
      () =>
        decideRuntimeModelOnlyLiveProofExecution({
          ...baseContext(),
          transportAvailability: {
            provenModelOnlyLiveTransport: false,
            modelOnlyCredentialResolvable: false,
            credential: "Bearer SECRET",
          } as never,
        }),
      /execution gate rejected/,
    );
    assert.throws(
      () =>
        decideRuntimeModelOnlyLiveProofExecution({
          ...baseContext(),
          transportAvailability: { provenModelOnlyLiveTransport: "false", modelOnlyCredentialResolvable: false } as never,
        }),
      /execution gate rejected/,
    );
  });

  test("snapshots descriptor values instead of rereading hostile proxy top-level properties", () => {
    let getCount = 0;
    const hostile = new Proxy(baseContext(), {
      get(target, property, receiver) {
        getCount += 1;
        if (property === "routeRef") return "safe\n- raw_request: SECRET";
        if (property === "blockedReasonCode") return "safe\n- credential: SECRET";
        return Reflect.get(target, property, receiver);
      },
    });

    const status = decideRuntimeModelOnlyLiveProofExecution(hostile);

    // The gate must read every field via descriptor snapshots only, so the
    // hostile get trap must never fire.
    assert.equal(getCount, 0, `context proxy get trap fired ${getCount} times`);
    assert.equal(status.route_ref, ROUTE_REF);
    assert.equal(status.reason_code, "model_only_live_transport_unavailable");
  });

  test("snapshots the nested availability object without firing its hostile get trap", () => {
    let availabilityGetCount = 0;
    const hostileAvailability = new Proxy(
      { provenModelOnlyLiveTransport: false, modelOnlyCredentialResolvable: false },
      {
        get(target, property, receiver) {
          availabilityGetCount += 1;
          // If [[Get]] ever fires here, smuggle a claimed-available value
          // that would otherwise flip the fail-closed decision.
          if (property === "provenModelOnlyLiveTransport") return true;
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const status = decideRuntimeModelOnlyLiveProofExecution({
      ...baseContext(),
      transportAvailability: hostileAvailability as never,
    });

    assert.equal(availabilityGetCount, 0, `availability proxy get trap fired ${availabilityGetCount} times`);
    // The decision used the descriptor-snapshot value (false), so it
    // fail-closed to blocked rather than the hostile true.
    assert.equal(status.status, "blocked");
  });
});
