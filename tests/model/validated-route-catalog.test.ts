import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  selectRouteFromCatalog,
  snapshotValidatedModelRoute,
  validateRouteCatalog,
  type ValidatedModelRouteInput,
} from "../../src/model/validated-route-catalog.js";

const baseRoute = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
  routeRef: "gpt-5.5-openai-codex-20260602a",
  providerRef: "openai-codex",
  modelLabel: "gpt-5.5",
  routeKind: "candidate",
  validationRefs: [
    "docs/runbooks/hermes-gpt55-provider-validation-status.md",
    "docs/runbooks/live-product-preview-gpt55-comparison-status.md",
  ],
  validatedAt: "2026-06-02T00:00:00.000Z",
  evidenceExpiresAt: "2026-07-02T00:00:00.000Z",
  defaultModelSelectionClaim: false,
  providerLockIn: false,
  productionReadinessClaim: false,
  ...overrides,
});

describe("validated model route catalog", () => {
  test("snapshots safe validated model routes including future model labels", () => {
    for (const modelLabel of ["gpt-5.5", "owl-alpha", "opus-4.8", "gpt-5.6"]) {
      const route = snapshotValidatedModelRoute(baseRoute({
        routeRef: `${modelLabel.replaceAll(".", "-")}-candidate-route`,
        modelLabel,
        providerRef: modelLabel.startsWith("opus") ? "anthropic-direct" : "provider-candidate",
        routeKind: modelLabel === "owl-alpha" ? "validation" : "candidate",
      }));

      assert.equal(route.modelLabel, modelLabel);
      assert.equal(route.defaultModelSelectionClaim, false);
      assert.equal(route.providerLockIn, false);
      assert.equal(route.productionReadinessClaim, false);
      assert.deepEqual(Object.keys(route).sort(), [
        "defaultModelSelectionClaim",
        "evidenceExpiresAt",
        "modelLabel",
        "productionReadinessClaim",
        "providerLockIn",
        "providerRef",
        "routeKind",
        "routeRef",
        "validatedAt",
        "validationRefs",
      ].sort());
    }
  });

  test("validates a catalog with GPT-5.5 candidate and owl-alpha validation route", () => {
    const catalog = validateRouteCatalog([
      baseRoute(),
      baseRoute({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
      }),
    ]);

    assert.equal(catalog.routes.length, 2);
    assert.equal(catalog.routes[0]?.routeRef, "gpt-5.5-openai-codex-20260602a");
    assert.equal(catalog.routes[1]?.routeKind, "validation");
    assert.equal(catalog.providerCallsExecuted, 0);
    assert.equal(catalog.providerSpend, false);
    assert.equal(catalog.runtimeModelModeIntegration, false);
    assert.equal(catalog.defaultModelSelectionClaim, false);
    assert.equal(catalog.providerLockIn, false);
  });

  test("rejects private/provider/transport-shaped fields before snapshotting", () => {
    for (const field of [
      "rawPrompt",
      "rawOutput",
      "rawProviderRequest",
      "rawProviderResponse",
      "privateEvidencePath",
      "sourceText",
      "accountRef",
      "apiKey",
      "credential",
      "providerSdk",
      "client",
      "transportCommand",
      "wrapperPath",
    ]) {
      assert.throws(
        () => snapshotValidatedModelRoute({ ...baseRoute(), [field]: "unsafe" } as unknown as ValidatedModelRouteInput),
        /unexpected route field/i,
        field,
      );
    }
  });

  test("rejects accessors, symbols, non-enumerable fields, and duplicate refs", () => {
    const accessorRoute = { ...baseRoute() } as Record<string, unknown>;
    Object.defineProperty(accessorRoute, "modelLabel", {
      enumerable: true,
      get() {
        throw new Error("leak model getter");
      },
    });
    assert.throws(() => snapshotValidatedModelRoute(accessorRoute as unknown as ValidatedModelRouteInput), /accessor field rejected/i);

    const symbolRoute = { ...baseRoute(), [Symbol("secret")]: "hidden" };
    assert.throws(() => snapshotValidatedModelRoute(symbolRoute as unknown as ValidatedModelRouteInput), /symbol fields rejected/i);

    const nonEnumerable = { ...baseRoute() };
    Object.defineProperty(nonEnumerable, "privateEvidencePath", { enumerable: false, value: "/tmp/private" });
    assert.throws(() => snapshotValidatedModelRoute(nonEnumerable as unknown as ValidatedModelRouteInput), /non-enumerable fields rejected/i);

    assert.throws(() => validateRouteCatalog([baseRoute(), baseRoute()]), /duplicate routeRef/i);
  });

  test("rejects stale routes when a max validation age is required", () => {
    assert.throws(
      () => validateRouteCatalog([baseRoute({ validatedAt: "2026-01-01T00:00:00.000Z" })], {
        now: "2026-06-02T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /validation evidence is stale/i,
    );
  });

  test("selects a route by explicit ref with approval and recency context", () => {
    const catalog = validateRouteCatalog([
      baseRoute(),
      baseRoute({
        routeRef: "owl-alpha-openrouter-validation-20260601a",
        providerRef: "openrouter",
        modelLabel: "owl-alpha",
        routeKind: "validation",
        validationRefs: ["docs/runbooks/live-product-preview-six-slot-status.md"],
      }),
    ]);

    const selected = selectRouteFromCatalog(catalog, {
      routeRef: "gpt-5.5-openai-codex-20260602a",
      environment: "staging",
      approvalRef: "approvals/provider-neutral-runtime-integration-pr156",
      now: "2026-06-03T00:00:00.000Z",
      maxValidationAgeDays: 30,
    });

    assert.equal(selected.route.routeRef, "gpt-5.5-openai-codex-20260602a");
    assert.equal(selected.selectionReason, "explicit-route-ref");
    assert.equal(selected.defaultModelSelectionClaim, false);
    assert.equal(selected.providerLockIn, false);
    assert.equal(selected.providerCallsExecuted, 0);
    assert.equal(selected.runtimeModelModeIntegration, false);
  });

  test("requires explicit production-like route selection context", () => {
    const catalog = validateRouteCatalog([baseRoute()]);

    assert.throws(
      () => selectRouteFromCatalog(catalog, {
        routeRef: "gpt-5.5-openai-codex-20260602a",
        environment: "production",
        now: "2026-06-03T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /approvalRef is required/i,
    );
  });

  test("does not select by model label or provider default", () => {
    const catalog = validateRouteCatalog([baseRoute()]);

    assert.throws(
      () => selectRouteFromCatalog(catalog, {
        modelLabel: "gpt-5.5",
        environment: "staging",
        approvalRef: "approvals/provider-neutral-runtime-integration-pr156",
        now: "2026-06-03T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /routeRef is required/i,
    );
  });

  test("fails closed for stale, unknown, or fake production-like route selection", () => {
    assert.throws(
      () => selectRouteFromCatalog(validateRouteCatalog([baseRoute()]), {
        routeRef: "missing-route",
        environment: "staging",
        approvalRef: "approvals/provider-neutral-runtime-integration-pr156",
        now: "2026-06-03T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /routeRef not found/i,
    );

    assert.throws(
      () => selectRouteFromCatalog(validateRouteCatalog([baseRoute({ validatedAt: "2026-01-01T00:00:00.000Z" })]), {
        routeRef: "gpt-5.5-openai-codex-20260602a",
        environment: "staging",
        approvalRef: "approvals/provider-neutral-runtime-integration-pr156",
        now: "2026-06-03T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /route validation evidence is stale/i,
    );

    assert.throws(
      () => selectRouteFromCatalog(validateRouteCatalog([baseRoute({ routeKind: "fake" })]), {
        routeRef: "gpt-5.5-openai-codex-20260602a",
        environment: "production",
        approvalRef: "approvals/provider-neutral-runtime-integration-pr156",
        now: "2026-06-03T00:00:00.000Z",
        maxValidationAgeDays: 30,
      }),
      /fake routes are not allowed/i,
    );
  });
});
