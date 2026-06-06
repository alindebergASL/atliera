import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { reviewRouteEvidenceRecency } from "../../src/model/route-evidence-recency.js";
import type { ValidatedModelRouteInput } from "../../src/model/validated-route-catalog.js";

const route = (overrides: Partial<ValidatedModelRouteInput> = {}): ValidatedModelRouteInput => ({
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
  ...overrides,
});

const baseInput = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  routes: [route()],
  candidateLabelExamples: ["opus-4.8"],
  now: "2026-06-03T00:00:00.000Z",
  nearingExpiryDays: 7,
  ...overrides,
});

describe("route evidence recency review", () => {
  test("classifies fresh, nearing-expiry, expired, and candidate-label-only entries", () => {
    const report = reviewRouteEvidenceRecency({
      routes: [
        route(),
        route({ routeRef: "near-expiry", validatedAt: "2026-05-10T00:00:00.000Z", evidenceExpiresAt: "2026-06-05T00:00:00.000Z" }),
        route({ routeRef: "expired", validatedAt: "2026-04-01T00:00:00.000Z", evidenceExpiresAt: "2026-06-01T00:00:00.000Z" }),
      ],
      candidateLabelExamples: ["opus-4.8", "gpt-5.6"],
      now: "2026-06-03T00:00:00.000Z",
      nearingExpiryDays: 7,
    });

    assert.deepEqual(report.entries.map((entry) => [entry.ref, entry.status]), [
      ["gpt-5.5-openai-codex-20260602a", "fresh"],
      ["near-expiry", "nearing-expiry"],
      ["expired", "expired-needs-revalidation"],
      ["opus-4.8", "candidate-label-only-not-validated"],
      ["gpt-5.6", "candidate-label-only-not-validated"],
    ]);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
  });
});

describe("route evidence recency revalidation contract", () => {
  test("only stale/expired routes and label-only candidates require fresh approval before use", () => {
    const report = reviewRouteEvidenceRecency({
      routes: [
        route(),
        route({ routeRef: "near-expiry", validatedAt: "2026-05-10T00:00:00.000Z", evidenceExpiresAt: "2026-06-05T00:00:00.000Z" }),
        route({ routeRef: "expired", validatedAt: "2026-04-01T00:00:00.000Z", evidenceExpiresAt: "2026-06-01T00:00:00.000Z" }),
      ],
      candidateLabelExamples: ["opus-4.8"],
      now: "2026-06-03T00:00:00.000Z",
      nearingExpiryDays: 7,
    });

    assert.deepEqual(
      report.entries.map((entry) => [entry.status, entry.requires_fresh_approval_before_use, entry.usable_without_revalidation]),
      [
        ["fresh", false, true],
        ["nearing-expiry", false, true],
        ["expired-needs-revalidation", true, false],
        ["candidate-label-only-not-validated", true, false],
      ],
    );
  });

  test("report carries no-spend, no-authorization, and revalidation-required markers", () => {
    const report = reviewRouteEvidenceRecency(baseInput() as never);

    assert.equal(report.schema_version, "atliera.route_evidence_recency.v1");
    assert.equal(report.nearing_expiry_days, 7);
    assert.equal(report.provider_calls_executed, 0);
    assert.equal(report.provider_spend, false);
    assert.equal(report.authorizes_provider_call, false);
    assert.equal(report.authorizes_runtime_use, false);
    assert.equal(report.authorizes_retry, false);
    assert.equal(report.authorizes_revalidation_run, false);
    assert.equal(report.authorizes_provider_comparison, false);
    assert.equal(report.authorizes_product_preview_expansion, false);
    assert.equal(report.authorizes_corpus_expansion, false);
    assert.equal(report.authorizes_default_model_selection, false);
    assert.equal(report.authorizes_tools, false);
    assert.equal(report.authorizes_web_search, false);
    assert.equal(report.authorizes_plugins, false);
    assert.equal(report.authorizes_retrieval, false);
    assert.equal(report.authorizes_mcp, false);
    assert.equal(report.authorizes_graph_ingestion, false);
    assert.equal(report.authorizes_production_use, false);
    assert.equal(report.runtime_model_mode_integration, false);
    assert.equal(report.default_model_selection_claim, false);
    assert.equal(report.provider_lock_in, false);
    assert.equal(report.product_readiness_claim, false);
    assert.equal(report.production_readiness_claim, false);
    assert.equal(report.launch_readiness_claim, false);
    assert.equal(report.stale_or_candidate_requires_fresh_approval, true);
    assert.equal(report.revalidation_requires_new_approval, true);
  });
});

describe("route evidence recency input hardening", () => {
  test("rejects a non-ISO now", () => {
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ now: "2026-06-03" }) as never), /now must be an ISO instant/);
  });

  test("rejects an impossible calendar instant instead of Date.parse normalization", () => {
    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ now: "2026-02-31T00:00:00.000Z" }) as never),
      /now must be an ISO instant/,
    );
  });

  test("rejects impossible route evidence timestamps before classification", () => {
    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({
        routes: [route({ evidenceExpiresAt: "2026-02-31T00:00:00.000Z" })],
      }) as never),
      /route.evidenceExpiresAt must be an ISO instant/,
    );
  });

  test("rejects validationRefs arrays with attacker-controlled own map functions", () => {
    let customMapCalled = false;
    const validationRefs = ["docs/runbooks/live-product-preview-gpt55-comparison-status.md"];
    Object.defineProperty(validationRefs, "map", {
      enumerable: true,
      value() {
        customMapCalled = true;
        return ["docs/runbooks/unsafe.md"];
      },
    });

    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ routes: [route({ validationRefs })] }) as never),
      /unexpected array field|validationRefs/,
    );
    assert.equal(customMapCalled, false);
  });

  test("rejects validationRefs arrays with custom iterators or prototypes", () => {
    const validationRefs = ["docs/runbooks/live-product-preview-gpt55-comparison-status.md"];
    Object.setPrototypeOf(validationRefs, {
      [Symbol.iterator]: function* () {
        yield "docs/runbooks/unsafe.md";
      },
    });

    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ routes: [route({ validationRefs })] }) as never),
      /array prototype|validationRefs/,
    );
  });

  test("rejects route arrays with custom iterators before route snapshotting", () => {
    const routes = [route()];
    Object.setPrototypeOf(routes, {
      [Symbol.iterator]: function* () {
        yield route({ routeRef: "iterator-injected-route" });
      },
    });
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ routes }) as never), /array prototype/);
  });

  test("rejects route arrays with missing own index descriptors", () => {
    const routes = [route()];
    delete routes[0];
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ routes }) as never), /descriptor invalid/);
  });

  test("rejects non-integer or negative nearingExpiryDays", () => {
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ nearingExpiryDays: 1.5 }) as never), /nearingExpiryDays/);
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ nearingExpiryDays: -1 }) as never), /nearingExpiryDays/);
  });

  test("rejects an unexpected root field", () => {
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ extra: true }) as never), /unexpected field/);
  });

  test("rejects a non-Object-prototype root input", () => {
    assert.throws(() => reviewRouteEvidenceRecency(Object.assign(Object.create(null), baseInput()) as never), /Object prototype/);
  });

  test("rejects a root accessor field", () => {
    const input = baseInput();
    Object.defineProperty(input, "now", { enumerable: true, get: () => "2026-06-03T00:00:00.000Z" });
    assert.throws(() => reviewRouteEvidenceRecency(input as never), /accessor field rejected/);
  });

  test("rejects a root symbol field", () => {
    const input = baseInput();
    (input as Record<symbol, unknown>)[Symbol("x")] = true;
    assert.throws(() => reviewRouteEvidenceRecency(input as never), /symbol fields rejected/);
  });

  test("rejects candidateLabelExamples that is not an array", () => {
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ candidateLabelExamples: "opus-4.8" }) as never), /must be an array/);
  });

  test("rejects candidateLabelExamples with an accessor element", () => {
    const labels: string[] = [];
    Object.defineProperty(labels, "0", { enumerable: true, get: () => "opus-4.8" });
    labels.length = 1;
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ candidateLabelExamples: labels }) as never), /accessor field rejected/);
  });

  test("rejects an unsafe candidate label", () => {
    assert.throws(() => reviewRouteEvidenceRecency(baseInput({ candidateLabelExamples: ["../etc/passwd"] }) as never), /candidate label must be safe/);
  });

  test("rejects duplicate route refs", () => {
    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ routes: [route(), route()] }) as never),
      /duplicate route ref/,
    );
  });

  test("rejects duplicate candidate labels", () => {
    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ candidateLabelExamples: ["opus-4.8", "opus-4.8"] }) as never),
      /duplicate candidate label/,
    );
  });

  test("rejects a candidate label that collides with a validated route's model label", () => {
    assert.throws(
      () => reviewRouteEvidenceRecency(baseInput({ candidateLabelExamples: ["gpt-5.5"] }) as never),
      /candidate label conflicts with validated route/,
    );
  });
});
