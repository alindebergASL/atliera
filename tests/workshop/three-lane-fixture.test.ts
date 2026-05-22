import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";

describe("Workshop three-lane fixture", () => {
  test("renders realistic Signals, Maps, and Plays lanes from one GraphBundle fixture", async () => {
    const bundle = await loadGraphBundleFile("fixtures/graph/valid/workshop-three-lane.json");
    const vm = buildWorkshopViewModel(bundle);

    assert.equal(vm.account_id, "acc_acme_robotics");
    assert.equal(vm.totals.sources, 3);
    assert.equal(vm.totals.claims, 3);
    assert.equal(vm.totals.account_objects, 3);
    assert.equal(vm.totals.verified_objects, 3);

    assert.deepEqual(
      [vm.lenses.signals.length, vm.lenses.maps.length, vm.lenses.plays.length],
      [1, 1, 1],
    );

    assert.equal(vm.lenses.signals[0]?.title, "New logistics platform launch");
    assert.equal(vm.lenses.maps[0]?.title, "Warehouse modernization initiative");
    assert.equal(vm.lenses.plays[0]?.title, "Prioritize integration-led expansion play");

    for (const lens of ["signals", "maps", "plays"] as const) {
      const item = vm.lenses[lens][0];
      assert.ok(item, `${lens} item missing`);
      assert.equal(item.trust.label, "Verified");
      assert.equal(item.trust.evidence.accepted_excerpt_count, 1);
      assert.equal(item.trust.evidence.source_document_count, 1);
    }

    const html = renderWorkshopHtml(vm);
    assert.match(html, /Signals/);
    assert.match(html, /Maps/);
    assert.match(html, /Plays/);
    assert.match(html, /New logistics platform launch/);
    assert.match(html, /Warehouse modernization initiative/);
    assert.match(html, /Prioritize integration-led expansion play/);
    assert.match(html, /3 sources/);
    assert.match(html, /3 claims/);
    assert.match(html, /3 graph objects/);
    assert.doesNotMatch(html, /No graph-backed Maps yet/);
    assert.doesNotMatch(html, /No graph-backed Plays yet/);
  });
});
