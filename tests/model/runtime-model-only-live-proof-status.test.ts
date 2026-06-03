import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createRuntimeModelOnlyLiveProofStatus,
  renderRuntimeModelOnlyLiveProofStatusMarkdown,
} from "../../src/model/runtime-model-only-live-proof-status.js";

const baseInput = () => ({
  routeRef: "gpt-5.5-openai-codex-20260602a",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  status: "blocked" as const,
  reasonCode: "model_only_live_transport_unavailable",
  providerCallsExecuted: 0,
  observedCostUsd: 0,
  approvedMaxCostUsd: 1,
  acceptedOutputReceived: false,
  stableErrorCode: null,
});

describe("runtime model-only live proof sanitized status writer", () => {
  test("creates a sanitized blocked status without raw/private evidence", () => {
    const status = createRuntimeModelOnlyLiveProofStatus(baseInput());

    assert.equal(status.status, "blocked");
    assert.equal(status.provider_calls_executed, 0);
    assert.equal(status.provider_spend, false);
    assert.equal(status.observed_cost_usd, 0);
    assert.equal(status.approved_max_cost_usd, 1);
    assert.equal(status.accepted_output_received, false);
    assert.equal(status.raw_request_committed, false);
    assert.equal(status.raw_response_committed, false);
    assert.equal(status.model_output_committed, false);
    assert.equal(status.private_evidence_committed, false);
    assert.equal(status.credential_value_observed, false);
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

  test("renders a markdown status without raw prompts, raw responses, private paths, or readiness claims", () => {
    const markdown = renderRuntimeModelOnlyLiveProofStatusMarkdown(createRuntimeModelOnlyLiveProofStatus({
      ...baseInput(),
      status: "exception",
      reasonCode: "provider_request_shape_rejected",
      providerCallsExecuted: 1,
      stableErrorCode: "BadRequestError",
      observedCostUsd: 0,
    }));

    assert.match(markdown, /Status: exception/);
    assert.match(markdown, /provider_calls_executed: 1/);
    assert.match(markdown, /retry_requires_new_approval: true/);
    assert.match(markdown, /raw_request_committed: false/);
    assert.doesNotMatch(markdown, /raw prompt|raw response|private evidence path|production ready|default production model/i);
  });

  test("rejects forged markdown status objects before rendering", () => {
    assert.throws(
      () => renderRuntimeModelOnlyLiveProofStatusMarkdown({
        ...createRuntimeModelOnlyLiveProofStatus(baseInput()),
        route_ref: "safe\n- raw prompt: SECRET",
      } as never),
      /runtime model-only live proof status render input rejected/,
    );
    assert.throws(
      () => renderRuntimeModelOnlyLiveProofStatusMarkdown({
        ...createRuntimeModelOnlyLiveProofStatus(baseInput()),
        accepted_output_received: "false\n- raw prompt: SECRET",
      } as never),
      /runtime model-only live proof status render input rejected/,
    );
  });

  test("rejects raw/private field smuggling and unsafe prototype-backed input", () => {
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus({ ...baseInput(), rawRequest: "SECRET" } as never),
      /runtime model-only live proof status input rejected/,
    );
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus({ ...baseInput(), privateEvidencePath: "/tmp/private.json" } as never),
      /runtime model-only live proof status input rejected/,
    );

    const protoBacked = Object.create({ authorizationHeader: "Bearer SECRET" }) as ReturnType<typeof baseInput>;
    Object.assign(protoBacked, baseInput());
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus(protoBacked),
      /runtime model-only live proof status input rejected/,
    );
  });

  test("snapshots descriptor values instead of rereading hostile proxy properties", () => {
    let getCount = 0;
    const hostile = new Proxy(baseInput(), {
      get(target, property, receiver) {
        getCount += 1;
        if (property === "routeRef") return "safe\n- raw_request: SECRET";
        return Reflect.get(target, property, receiver);
      },
    });

    const status = createRuntimeModelOnlyLiveProofStatus(hostile);

    assert.equal(getCount, 0);
    assert.equal(status.route_ref, "gpt-5.5-openai-codex-20260602a");
  });

  test("rejects contradictory forged status objects before rendering", () => {
    const completed = createRuntimeModelOnlyLiveProofStatus({
      ...baseInput(),
      status: "completed",
      reasonCode: "completed",
      providerCallsExecuted: 1,
      acceptedOutputReceived: true,
    });

    assert.throws(
      () => renderRuntimeModelOnlyLiveProofStatusMarkdown({
        ...completed,
        provider_calls_executed: 0,
        accepted_output_received: false,
      } as never),
      /runtime model-only live proof status render input rejected/,
    );
    assert.throws(
      () => renderRuntimeModelOnlyLiveProofStatusMarkdown({
        ...completed,
        status: "blocked",
        provider_calls_executed: 1,
      } as never),
      /runtime model-only live proof status render input rejected/,
    );
    assert.throws(
      () => renderRuntimeModelOnlyLiveProofStatusMarkdown({
        ...completed,
        status: "exception",
        accepted_output_received: true,
      } as never),
      /runtime model-only live proof status render input rejected/,
    );
  });

  test("rejects unsafe accounting and automatic retry semantics", () => {
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus({ ...baseInput(), providerCallsExecuted: 2 }),
      /runtime model-only live proof status accounting rejected/,
    );
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus({ ...baseInput(), observedCostUsd: 2 }),
      /runtime model-only live proof status accounting rejected/,
    );
    assert.throws(
      () => createRuntimeModelOnlyLiveProofStatus({ ...baseInput(), status: "completed", providerCallsExecuted: 0, acceptedOutputReceived: true }),
      /runtime model-only live proof status accounting rejected/,
    );
  });
});
