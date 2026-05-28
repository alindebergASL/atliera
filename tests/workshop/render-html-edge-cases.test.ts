import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import type { GraphBundle } from "../../src/graph/types.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

function makeSparseEdgeBundle(): GraphBundle {
  const bundle = clone(makeValidBundle());
  bundle.sources[0] = {
    ...bundle.sources[0]!,
    account_id: "acc_edge_<unsafe>&co",
    title: "Edge Account <launch>",
    publisher: null,
    url: "javascript:alert('xss')",
    canonical_url: "javascript:alert('xss')",
  };
  bundle.account_objects[0] = {
    ...bundle.account_objects[0]!,
    account_id: "acc_edge_<unsafe>&co",
    object_type: "risk",
    title: "Unverified risk <script>alert('x')</script>",
    summary: "Sparse summary with & and <unsafe> content.",
    provenance_status: "unverified",
    confidence: "medium",
  };
  bundle.claims[0] = {
    ...bundle.claims[0]!,
    account_id: "acc_edge_<unsafe>&co",
    text: "Claim text with <tag> and & characters.",
    provenance_status: "unverified",
  };
  bundle.excerpts[0] = {
    ...bundle.excerpts[0]!,
    text: "Accepted excerpt with <angle> & ampersand.",
  };
  bundle.account_objects.push(
    {
      id: "obj_edge_stale_map",
      team_id: "team_atliera_lab",
      account_id: "acc_edge_<unsafe>&co",
      object_type: "stakeholder",
      title: "Stale stakeholder map",
      summary: "Known contact exists, but the supporting evidence is stale.",
      payload_json: {},
      confidence: "low",
      provenance_status: "stale",
      status: "active",
      created_by: "model",
      created_at: "2026-03-02T12:00:04Z",
      updated_at: "2026-03-02T12:00:04Z",
    },
    {
      id: "obj_edge_unsupported_play",
      team_id: "team_atliera_lab",
      account_id: "acc_edge_<unsafe>&co",
      object_type: "play",
      title: "Unsupported play should be visibly bounded",
      summary: "The preview should show this as unsupported without fabricating evidence.",
      payload_json: {},
      confidence: "low",
      provenance_status: "unsupported",
      status: "active",
      created_by: "model",
      created_at: "2026-03-02T12:00:04Z",
      updated_at: "2026-03-02T12:00:04Z",
    },
  );
  return bundle;
}

describe("Workshop HTML edge-case rendering", () => {
  it("renders sparse and low-trust graph objects with explicit bounded preview context", () => {
    const html = renderWorkshopHtml(buildWorkshopViewModel(makeSparseEdgeBundle()));

    assert.match(html, /Fake-mode preview/i);
    assert.match(html, /No provider calls/i);
    assert.match(html, /No production writes/i);
    assert.match(html, /Account/);
    assert.match(html, /acc_edge_&lt;unsafe&gt;&amp;co/);
    assert.match(html, /Unverified/);
    assert.match(html, /Stale/);
    assert.match(html, /Unsupported/);
    assert.match(html, /class="trust-pill trust-unverified"/);
    assert.match(html, /class="trust-pill trust-stale"/);
    assert.match(html, /class="trust-pill trust-unsupported"/);
    assert.match(html, /No accepted supporting evidence packets for this unsupported object/i);
  });

  it("escapes edge text and omits unsafe source links without hiding source context", () => {
    const html = renderWorkshopHtml(buildWorkshopViewModel(makeSparseEdgeBundle()));

    assert.doesNotMatch(html, /<script>alert\('x'\)<\/script>/);
    assert.match(html, /Unverified risk &lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.match(html, /Unsafe source URL omitted/);
    assert.match(html, /unknown publisher/);
    assert.match(html, /Claim text with &lt;tag&gt; and &amp; characters\./);
    assert.match(html, /Accepted excerpt with &lt;angle&gt; &amp; ampersand\./);
  });
});
