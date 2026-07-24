import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import {
  buildTargetedBriefPair,
  renderTargetedBriefHtml,
  type TargetedBrief,
} from "../../src/workshop/targeted-brief.ts";

const THREE_LANE = "fixtures/graph/valid/workshop-three-lane.json";
const MIXED_TRUST = "fixtures/graph/render/mixed-trust.json";
const CISO_SNAPSHOT = "fixtures/workshop/targeted-ciso-meeting-brief-v1.html";
const PROPOSAL_SNAPSHOT = "fixtures/workshop/targeted-proposal-rfx-brief-v1.html";

function reverseBundle(bundle: GraphBundle): GraphBundle {
  return {
    sources: [...bundle.sources].reverse(),
    excerpts: [...bundle.excerpts].reverse(),
    claims: [...bundle.claims].reverse(),
    claim_evidence: [...bundle.claim_evidence].reverse(),
    account_objects: [...bundle.account_objects].reverse(),
    account_object_claims: [...bundle.account_object_claims].reverse(),
    research_runs: [...bundle.research_runs].reverse(),
    run_artifacts: [...bundle.run_artifacts].reverse(),
    audit_events: [...bundle.audit_events].reverse(),
  };
}

function assertEveryAssertionIsEvidenceBound(brief: TargetedBrief): void {
  assert.ok(brief.assertions.length > 0, "brief should contain at least one supported assertion");
  for (const assertion of brief.assertions) {
    assert.ok(assertion.evidence.length > 0, `${assertion.id} is missing evidence`);
    for (const evidence of assertion.evidence) {
      assert.equal(evidence.relationship, "supports");
      assert.equal(evidence.excerpt.validation_status, "accepted");
      assert.equal(evidence.excerpt.kind, "literal");
      assert.ok(evidence.claim.id.length > 0);
      assert.ok(evidence.excerpt.id.length > 0);
      assert.ok(evidence.source.id.length > 0);
      assert.equal(evidence.evidence_current_through, null);
    }
    assert.equal(
      assertion.statement,
      [...new Set(assertion.evidence.map((evidence) => evidence.claim.text))]
        .sort((left, right) => left.localeCompare(right))
        .join(" "),
      `${assertion.id} must render only the evidence-bound claim text`,
    );
  }
}

describe("Workshop targeted brief V1", () => {
  test("builds separate CISO and proposal/RFI/RFP briefs with evidence-bound factual assertions", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    const pair = buildTargetedBriefPair(bundle, {
      input_class: "committed_fixture",
      input_ref: THREE_LANE,
    });

    assert.equal(pair.ciso_meeting.kind, "ciso_meeting");
    assert.equal(pair.ciso_meeting.title, "Targeted CISO meeting brief");
    assert.equal(pair.proposal_rfx.kind, "proposal_rfx");
    assert.equal(pair.proposal_rfx.title, "Proposal / RFI / RFP targeted brief");
    assert.equal(pair.ciso_meeting.account_id, "acc_acme_robotics");
    assert.equal(pair.proposal_rfx.account_id, "acc_acme_robotics");
    assertEveryAssertionIsEvidenceBound(pair.ciso_meeting);
    assertEveryAssertionIsEvidenceBound(pair.proposal_rfx);

    assert.deepEqual(
      pair.ciso_meeting.sections.map((section) => section.title),
      ["What changed", "Operating context", "Suggested conversation"],
    );
    assert.deepEqual(
      pair.proposal_rfx.sections.map((section) => section.title),
      ["Why now", "Account context", "Response themes"],
    );
    assert.equal(pair.ciso_meeting.boundary.provider_calls, false);
    assert.equal(pair.ciso_meeting.boundary.network_acquisition, false);
    assert.equal(pair.ciso_meeting.boundary.production_writes, false);
    assert.equal(pair.ciso_meeting.boundary.external_actions, false);
  });

  test("rejects unsupported, unverified, stale, rejected, and evidence-free assertions without leaking their claim text", async () => {
    const bundle = await loadGraphBundleFile(MIXED_TRUST);
    const pair = buildTargetedBriefPair(bundle, {
      input_class: "committed_fixture",
      input_ref: MIXED_TRUST,
    });
    const html = renderTargetedBriefHtml(pair.proposal_rfx);

    assert.deepEqual(
      pair.proposal_rfx.assertions.map((assertion) => assertion.id),
      ["obj_vertex_signal_erp", "obj_vertex_stakeholder_cio"],
    );
    assert.ok(pair.proposal_rfx.evidence_gaps.some((gap) => gap.reason === "unsupported_claim_rejected"));
    assert.ok(pair.proposal_rfx.evidence_gaps.some((gap) => gap.reason === "trust_not_ready"));
    assert.ok(pair.proposal_rfx.evidence_gaps.some((gap) => gap.reason === "missing_accepted_evidence"));

    assert.doesNotMatch(html, /Speculative displacement play/);
    assert.doesNotMatch(html, /Model-proposed displacement angle/);
    assert.doesNotMatch(html, /Possible competitor evaluation/);
    assert.doesNotMatch(html, /may be evaluating a competing vendor/);
    assert.doesNotMatch(html, /Unverified recommendation derived/);
    assert.match(html, /Evidence gap/);
    assert.match(html, /Unsupported material was omitted rather than presented as fact/);
  });

  test("renders byte-stably when GraphBundle collection order changes", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    const options = { input_class: "committed_fixture" as const, input_ref: THREE_LANE };
    const original = buildTargetedBriefPair(bundle, options);
    const reordered = buildTargetedBriefPair(reverseBundle(bundle), options);

    assert.equal(
      renderTargetedBriefHtml(original.ciso_meeting),
      renderTargetedBriefHtml(reordered.ciso_meeting),
    );
    assert.equal(
      renderTargetedBriefHtml(original.proposal_rfx),
      renderTargetedBriefHtml(reordered.proposal_rfx),
    );
  });

  test("keeps evidence visible within one disclosure and labels source time honestly", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    const pair = buildTargetedBriefPair(bundle, {
      input_class: "committed_fixture",
      input_ref: THREE_LANE,
    });
    const html = renderTargetedBriefHtml(pair.ciso_meeting);

    assert.equal(html.split("<summary>View evidence</summary>").length - 1, pair.ciso_meeting.assertions.length);
    assert.match(html, /Accepted excerpt/);
    assert.match(html, /Source record timestamp/);
    assert.match(html, /Evidence current through/);
    assert.match(html, /Not supplied by source/);
    assert.match(html, /Acme Robotics launches logistics platform/);
    assert.match(html, /Acme Robotics announced a new logistics platform/);
    assert.match(html, /Read-only · no automatic action/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<form\b/i);
    assert.doesNotMatch(html, /<button\b/i);
  });

  test("escapes brief text and refuses unsafe evidence links", async () => {
    const bundle = JSON.parse(JSON.stringify(await loadGraphBundleFile(THREE_LANE))) as GraphBundle;
    bundle.account_objects[0]!.title = '<img src=x onerror="alert(1)">';
    bundle.sources[0]!.url = "javascript:alert(1)";
    bundle.sources[0]!.canonical_url = "javascript:alert(1)";

    const pair = buildTargetedBriefPair(bundle, {
      input_class: "committed_fixture",
      input_ref: THREE_LANE,
    });
    const html = renderTargetedBriefHtml(pair.ciso_meeting);

    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.doesNotMatch(html, /<img\b/i);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.match(html, /Source URL omitted/);
  });

  test("renders the committed customer-visible brief snapshots exactly", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    const pair = buildTargetedBriefPair(bundle, {
      input_class: "committed_fixture",
      input_ref: THREE_LANE,
    });

    assert.equal(renderTargetedBriefHtml(pair.ciso_meeting), await readFile(CISO_SNAPSHOT, "utf8"));
    assert.equal(renderTargetedBriefHtml(pair.proposal_rfx), await readFile(PROPOSAL_SNAPSHOT, "utf8"));
  });
});
