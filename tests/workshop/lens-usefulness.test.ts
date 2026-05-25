import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import {
  evaluateWorkshopLensUsefulness,
  summarizeWorkshopLensUsefulnessReviews,
} from "../../src/workshop/lens-usefulness.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

describe("Workshop lens-usefulness review", () => {
  test("passes when at least two graph-backed lenses are materially useful", async () => {
    const bundle = await loadGraphBundleFile("fixtures/graph/valid/workshop-three-lane.json");
    const review = evaluateWorkshopLensUsefulness(buildWorkshopViewModel(bundle));

    assert.equal(review.ok, true);
    assert.equal(review.status, "pass");
    assert.equal(review.thresholds.min_useful_lenses, 2);
    assert.deepEqual(review.metrics.lens_item_counts, { signals: 1, maps: 1, plays: 1 });
    assert.deepEqual(review.metrics.useful_lens_item_counts, { signals: 1, maps: 1, plays: 1 });
    assert.deepEqual(review.metrics.useful_lenses, ["signals", "maps", "plays"]);
    assert.equal(review.metrics.useful_lens_count, 3);
    assert.deepEqual(review.reasons, []);
    assert.equal(review.launch_readiness_claim, false);
  });

  test("fails without claiming launch readiness when fewer than two lenses are useful", () => {
    const review = evaluateWorkshopLensUsefulness(buildWorkshopViewModel(makeValidBundle()));

    assert.equal(review.ok, false);
    assert.equal(review.status, "fail");
    assert.equal(review.metrics.useful_lens_count, 1);
    assert.deepEqual(review.metrics.useful_lenses, ["signals"]);
    assert.deepEqual(
      review.reasons.map((reason) => reason.code),
      ["insufficient_useful_lenses"],
    );
    assert.equal(review.reasons[0]?.observed, 1);
    assert.equal(review.reasons[0]?.threshold, 2);
    assert.equal(review.launch_readiness_claim, false);
  });

  test("does not count unsupported or evidence-free items as materially useful", () => {
    const bundle = clone(makeValidBundle());
    const base = bundle.account_objects[0]!;
    bundle.account_objects.push(
      { ...base, id: "obj_unsupported_map", object_type: "stakeholder", provenance_status: "unsupported" },
      { ...base, id: "obj_unbacked_play", object_type: "play" },
    );
    bundle.account_object_claims.push(
      { id: "oclm_unsupported_map", account_object_id: "obj_unsupported_map", claim_id: "clm_acme_launch", relationship: "primary" },
      { id: "oclm_unbacked_play", account_object_id: "obj_unbacked_play", claim_id: "clm_acme_launch", relationship: "primary" },
    );
    bundle.claim_evidence[0]!.relationship = "context";

    const review = evaluateWorkshopLensUsefulness(buildWorkshopViewModel(bundle));

    assert.equal(review.ok, false);
    assert.deepEqual(review.metrics.lens_item_counts, { signals: 1, maps: 1, plays: 1 });
    assert.deepEqual(review.metrics.useful_lens_item_counts, { signals: 0, maps: 0, plays: 0 });
    assert.deepEqual(review.metrics.useful_lenses, []);
  });

  test("summarizes corpus lens usefulness without hiding per-account failures", async () => {
    const useful = evaluateWorkshopLensUsefulness(
      buildWorkshopViewModel(await loadGraphBundleFile("fixtures/graph/valid/workshop-three-lane.json")),
    );
    const sparse = evaluateWorkshopLensUsefulness(buildWorkshopViewModel(makeValidBundle()));

    const summary = summarizeWorkshopLensUsefulnessReviews([
      { input: "workshop-three-lane.json", ...useful },
      { input: "minimal-pass.json", ...sparse },
    ]);

    assert.equal(summary.ok, false);
    assert.equal(summary.status, "fail");
    assert.equal(summary.launch_readiness_claim, false);
    assert.deepEqual(summary.metrics, {
      total_accounts: 2,
      passing_accounts: 1,
      failing_accounts: 1,
      useful_account_rate: 0.5,
      accounts_with_signals: 2,
      accounts_with_maps: 1,
      accounts_with_plays: 1,
    });
    assert.deepEqual(
      summary.reasons.map((reason) => reason.code),
      ["lens_usefulness_failures_present"],
    );
  });
});
