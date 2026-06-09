import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createRuntimeModelExecutionReport } from "../../src/model/runtime-model-observability.js";
import type { RuntimeModelExecutionPreflightDecision } from "../../src/model/runtime-model-execution-preflight.js";
import type { SelectedModelRoute } from "../../src/model/validated-route-catalog.js";

const selectedRoute = (): SelectedModelRoute => ({
  route: {
    routeRef: "gpt-5.5-openai-codex-20260602a",
    providerRef: "openai-codex",
    modelLabel: "gpt-5.5",
    routeKind: "candidate",
    validationRefs: ["docs/runbooks/live-product-preview-gpt55-comparison-status.md"],
    validatedAt: "2026-06-02T00:00:00.000Z",
    evidenceExpiresAt: "2026-07-02T00:00:00.000Z",
    defaultModelSelectionClaim: false,
    providerLockIn: false,
    productionReadinessClaim: false,
  },
  selectionReason: "explicit-route-ref",
  approvalRef: "approvals/provider-neutral-runtime-integration-pr159",
  environment: "staging",
  validationAgeDays: 1,
  routeEvidenceStatus: "fresh",
  routeEvidenceExpiresAt: "2026-07-02T00:00:00.000Z",
  routeRequiresFreshApprovalBeforeUse: false,
  routeUsableWithoutRevalidation: true,
  providerCallsExecuted: 0,
  providerSpend: false,
  runtimeModelModeIntegration: false,
  defaultModelSelectionClaim: false,
  providerLockIn: false,
});

const preflight = (): RuntimeModelExecutionPreflightDecision => ({
  ok: true,
  routeRef: "gpt-5.5-openai-codex-20260602a",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  refusalReasons: [],
  activationMissingGates: [],
  activationRefusalReasons: [],
  credentialReady: true,
  routeEvidenceStatus: "fresh",
  routeEvidenceExpiresAt: "2026-07-02T00:00:00.000Z",
  routeRequiresFreshApprovalBeforeUse: false,
  routeUsableWithoutRevalidation: true,
  providerCallsExecuted: 0,
  providerSpend: false,
  authorizesProviderCall: false,
  runtimeModelModeIntegration: false,
  defaultModelSelectionClaim: false,
  providerLockIn: false,
});

describe("runtime model observability", () => {
  test("creates a sanitized route/preflight/cost report without raw evidence", () => {
    const report = createRuntimeModelExecutionReport({
      selectedRoute: selectedRoute(),
      preflight: preflight(),
      ledgerRef: "ledgers/runtime-model-observability-pr159",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      cost: { currency: "USD", amount: 0.01 },
      status: "preflight-pass-no-call",
      observedAt: "2026-06-03T00:00:00.000Z",
    });

    assert.deepEqual(report, {
      schema_version: "atliera.runtime_model_observability.v1",
      status: "preflight-pass-no-call",
      observed_at: "2026-06-03T00:00:00.000Z",
      route: {
        route_ref: "gpt-5.5-openai-codex-20260602a",
        provider_ref: "openai-codex",
        model_label: "gpt-5.5",
        route_kind: "candidate",
        validation_refs: ["docs/runbooks/live-product-preview-gpt55-comparison-status.md"],
        validation_age_days: 1,
        evidence_expires_at: "2026-07-02T00:00:00.000Z",
        evidence_status: "fresh",
        requires_fresh_approval_before_use: false,
        usable_without_revalidation: true,
        approval_ref: "approvals/provider-neutral-runtime-integration-pr159",
      },
      preflight: {
        ok: true,
        credential_ready: true,
        refusal_reasons: [],
      },
      ledger_ref: "ledgers/runtime-model-observability-pr159",
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      cost: { currency: "USD", amount: 0.01 },
      provider_calls_executed: 0,
      provider_spend: false,
      authorizes_provider_call: false,
      runtime_model_mode_integration: false,
      default_model_selection_claim: false,
      provider_lock_in: false,
    });

    const serialized = JSON.stringify(report);
    for (const forbidden of ["rawPrompt", "rawOutput", "rawProviderRequest", "rawProviderResponse", "apiKey", "credentialValue", "secret", "privateEvidencePath", "sourceText", "accountRef", "wrapperLog"]) {
      assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
    }
  });

  test("rejects private/raw/provider-shaped extra fields and hostile getters", () => {
    assert.throws(
      () => createRuntimeModelExecutionReport({
        selectedRoute: selectedRoute(),
        preflight: preflight(),
        ledgerRef: "ledgers/runtime-model-observability-pr159",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-blocked",
        observedAt: "2026-06-03T00:00:00.000Z",
        rawPrompt: "unsafe",
      } as never),
      /unexpected observability field/i,
    );

    const hostile = {
      selectedRoute: selectedRoute(),
      preflight: preflight(),
      ledgerRef: "ledgers/runtime-model-observability-pr159",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-blocked",
      observedAt: "2026-06-03T00:00:00.000Z",
    } as Record<string, unknown>;
    Object.defineProperty(hostile, "ledgerRef", {
      enumerable: true,
      get() {
        throw new Error("leak ledger getter");
      },
    });
    assert.throws(() => createRuntimeModelExecutionReport(hostile as never), /accessor field rejected/i);
  });

  test("rejects inconsistent selected-route and preflight identity before reporting", () => {
    assert.throws(
      () => createRuntimeModelExecutionReport({
        selectedRoute: selectedRoute(),
        preflight: { ...preflight(), routeRef: "some-other-route" },
        ledgerRef: "ledgers/runtime-model-observability-pr159",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-pass-no-call",
        observedAt: "2026-06-03T00:00:00.000Z",
      }),
      /preflight route identity must match selected route/i,
    );

    assert.throws(
      () => createRuntimeModelExecutionReport({
        selectedRoute: selectedRoute(),
        preflight: { ...preflight(), routeEvidenceExpiresAt: "2026-08-02T00:00:00.000Z" },
        ledgerRef: "ledgers/runtime-model-observability-pr159",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-pass-no-call",
        observedAt: "2026-06-03T00:00:00.000Z",
      }),
      /preflight route evidence expiry must match selected route/i,
    );
  });

  test("rejects status and preflight outcome inconsistencies", () => {
    assert.throws(
      () => createRuntimeModelExecutionReport({
        selectedRoute: selectedRoute(),
        preflight: { ...preflight(), ok: false, refusalReasons: ["credential readiness is required before runtime model execution"] },
        ledgerRef: "ledgers/runtime-model-observability-pr159",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-pass-no-call",
        observedAt: "2026-06-03T00:00:00.000Z",
      }),
      /preflight-pass-no-call requires passing preflight/i,
    );

    assert.throws(
      () => createRuntimeModelExecutionReport({
        selectedRoute: selectedRoute(),
        preflight: preflight(),
        ledgerRef: "ledgers/runtime-model-observability-pr159",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { currency: "USD", amount: 0 },
        status: "preflight-blocked",
        observedAt: "2026-06-03T00:00:00.000Z",
      }),
      /preflight-blocked requires blocked preflight/i,
    );
  });

  test("reports preflight-recomputed route recency instead of stale selected-route snapshot", () => {
    const staleAtPreflightRoute: SelectedModelRoute = {
      ...selectedRoute(),
      routeEvidenceStatus: "fresh",
      routeEvidenceExpiresAt: "2026-06-04T00:00:00.000Z",
      routeRequiresFreshApprovalBeforeUse: false,
      routeUsableWithoutRevalidation: true,
      route: { ...selectedRoute().route, evidenceExpiresAt: "2026-06-04T00:00:00.000Z" },
    };
    const blockedPreflight: RuntimeModelExecutionPreflightDecision = {
      ...preflight(),
      ok: false,
      refusalReasons: ["route evidence expired requires revalidation before runtime model execution"],
      routeEvidenceStatus: "expired-needs-revalidation",
      routeEvidenceExpiresAt: "2026-06-04T00:00:00.000Z",
      routeRequiresFreshApprovalBeforeUse: true,
      routeUsableWithoutRevalidation: false,
      authorizesProviderCall: false,
    };

    const report = createRuntimeModelExecutionReport({
      selectedRoute: staleAtPreflightRoute,
      preflight: blockedPreflight,
      ledgerRef: "ledgers/runtime-model-observability-pr159",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-blocked",
      observedAt: "2026-06-05T00:00:00.000Z",
    });

    assert.equal(report.route.validation_age_days, 3);
    assert.equal(report.route.evidence_status, "expired-needs-revalidation");
    assert.equal(report.route.requires_fresh_approval_before_use, true);
    assert.equal(report.route.usable_without_revalidation, false);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.authorizes_provider_call, false);
    assert.deepEqual(report.preflight.refusal_reasons, ["route_evidence_expired_requires_revalidation"]);
  });

  test("redacts unsafe preflight refusal reason details", () => {
    const report = createRuntimeModelExecutionReport({
      selectedRoute: selectedRoute(),
      preflight: {
        ...preflight(),
        ok: false,
        refusalReasons: ["metadata accessor rejected", "rawPrompt=SECRET sourceText=ACME accountRef=acct_123", "acct_123"],
      },
      ledgerRef: "ledgers/runtime-model-observability-pr159",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { currency: "USD", amount: 0 },
      status: "preflight-blocked",
      observedAt: "2026-06-03T00:00:00.000Z",
    });

    assert.deepEqual(report.preflight.refusal_reasons, ["metadata_accessor_rejected", "unsafe_refusal_reason_redacted", "unsafe_refusal_reason_redacted"]);
    assert.doesNotMatch(JSON.stringify(report), /SECRET|ACME|acct_123|rawPrompt|sourceText|accountRef/);
  });
});
