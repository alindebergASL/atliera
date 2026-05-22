import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { makeValidBundle, clone } from "../fixtures/valid-graph.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import type { GraphBundle } from "../../src/graph/types.ts";

function makeEmptyBundle(): GraphBundle {
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

describe("buildWorkshopViewModel", () => {
  test("renders the baseline fixture as a Signals item from the shared graph", () => {
    const vm = buildWorkshopViewModel(makeValidBundle());

    assert.equal(vm.product_name, "Atliera");
    assert.equal(vm.surface, "Workshop");
    assert.equal(vm.generated_from, "graph_bundle");
    assert.equal(vm.empty_state, false);
    assert.equal(vm.lenses.signals.length, 1);
    assert.equal(vm.lenses.maps.length, 0);
    assert.equal(vm.lenses.plays.length, 0);

    const item = vm.lenses.signals[0]!;
    assert.equal(item.id, "obj_acme_signal_launch");
    assert.equal(item.lens, "signals");
    assert.equal(item.trust.label, "Verified");
    assert.equal(item.trust.evidence.accepted_excerpt_count, 1);
    assert.deepEqual(item.claim_ids, ["clm_acme_launch"]);
    assert.deepEqual(item.excerpt_ids, ["exc_acme_launch_001"]);
    assert.deepEqual(item.source_ids, ["src_acme_press_001"]);
  });

  test("routes account-object kinds into Signals, Maps, and Plays without separate data paths", () => {
    const bundle = clone(makeValidBundle());
    const base = bundle.account_objects[0]!;

    bundle.account_objects.push(
      { ...base, id: "obj_acme_stakeholder", object_type: "stakeholder", title: "VP Operations" },
      { ...base, id: "obj_acme_play", object_type: "play", title: "Lead with integration proof" },
    );
    bundle.account_object_claims.push(
      { id: "oclm_map", account_object_id: "obj_acme_stakeholder", claim_id: "clm_acme_launch", relationship: "primary" },
      { id: "oclm_play", account_object_id: "obj_acme_play", claim_id: "clm_acme_launch", relationship: "primary" },
    );

    const vm = buildWorkshopViewModel(bundle);

    assert.deepEqual(vm.lenses.signals.map((item) => item.id), ["obj_acme_signal_launch"]);
    assert.deepEqual(vm.lenses.maps.map((item) => item.id), ["obj_acme_stakeholder"]);
    assert.deepEqual(vm.lenses.plays.map((item) => item.id), ["obj_acme_play"]);
    for (const lens of ["signals", "maps", "plays"] as const) {
      assert.equal(vm.lenses[lens][0]!.trust.evidence.accepted_excerpt_count, 1);
    }
  });

  test("renders an explicit empty state for an empty graph bundle", () => {
    const vm = buildWorkshopViewModel(makeEmptyBundle());

    assert.equal(vm.empty_state, true);
    assert.equal(vm.account_id, null);
    assert.deepEqual(vm.lenses, { signals: [], maps: [], plays: [] });
    assert.deepEqual(vm.totals, {
      sources: 0,
      excerpts: 0,
      accepted_excerpts: 0,
      claims: 0,
      account_objects: 0,
      verified_objects: 0,
    });
  });

  test("labels unsupported and source-document-only material visibly", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unsupported";
    let vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Unsupported");

    bundle.account_objects[0]!.provenance_status = "source_document_only";
    vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Source-backed");
  });

  test("does not count contextual or contradicting excerpts as accepted supporting evidence", () => {
    const bundle = clone(makeValidBundle());
    bundle.claim_evidence[0]!.relationship = "context";
    let vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 0);

    bundle.claim_evidence[0]!.relationship = "contradicts";
    vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 0);
  });
});
