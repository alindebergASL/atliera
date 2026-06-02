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
