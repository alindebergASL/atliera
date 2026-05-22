import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { makeValidBundle, clone } from "../fixtures/valid-graph.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";

describe("renderWorkshopHtml", () => {
  test("renders Atliera Workshop with Signals, Maps, Plays, and provenance language", () => {
    const html = renderWorkshopHtml(buildWorkshopViewModel(makeValidBundle()));

    assert.match(html, /<title>Atliera Workshop<\/title>/);
    assert.match(html, /Atliera Workshop/);
    assert.match(html, /Signals/);
    assert.match(html, /Maps/);
    assert.match(html, /Plays/);
    assert.match(html, /New logistics platform launch/);
    assert.match(html, /Verified/);
    assert.match(html, /1 accepted excerpt/);
    assert.match(html, /Evidence/);
  });

  test("renders an empty graph state without pretending intelligence exists", () => {
    const html = renderWorkshopHtml({
      product_name: "Atliera",
      surface: "Workshop",
      account_id: null,
      generated_from: "graph_bundle",
      lenses: { signals: [], maps: [], plays: [] },
      totals: { sources: 0, excerpts: 0, accepted_excerpts: 0, claims: 0, account_objects: 0, verified_objects: 0 },
      empty_state: true,
    });

    assert.match(html, /No graph-backed intelligence yet/);
    assert.match(html, /Add sources and validated graph records before treating account intelligence as verified/);
    assert.doesNotMatch(html, /legacy/i);
    assert.doesNotMatch(html, /legacy report shape/i);
  });

  test("escapes graph text before rendering HTML", () => {
    const bundle = makeValidBundle();
    bundle.account_objects[0]!.title = "<script>alert('x')</script>";
    const html = renderWorkshopHtml(buildWorkshopViewModel(bundle));

    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;alert/);
  });

  test("renders unsupported material as visibly unsupported, not verified", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unsupported";
    const html = renderWorkshopHtml(buildWorkshopViewModel(bundle));

    assert.match(html, /Unsupported/);
    assert.doesNotMatch(html, /trust-pill trust-verified">Verified/);
  });
});
