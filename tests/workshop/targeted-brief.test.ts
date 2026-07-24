import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import type { Claim, GraphBundle } from "../../src/graph/types.ts";
import {
  buildTargetedBrief,
  buildTargetedBriefPair,
  evaluateTargetedBriefSelection,
  loadCommittedTargetedBriefFixture,
  renderTargetedBriefHtml,
  safeTargetedBriefSourceUrl,
  type LoadedTargetedBriefFixture,
  type TargetedBrief,
  type TargetedBriefPairRequest,
  type TargetedCisoMeetingRequest,
  type TargetedProposalRfxRequest,
} from "../../src/workshop/targeted-brief.ts";

const THREE_LANE = "fixtures/graph/valid/workshop-three-lane.json";
const MIXED_TRUST = "fixtures/graph/render/mixed-trust.json";
const CISO_SNAPSHOT = "fixtures/workshop/targeted-ciso-meeting-brief-v1.html";
const PROPOSAL_SNAPSHOT = "fixtures/workshop/targeted-proposal-rfx-brief-v1.html";
const ACME_ACCOUNT = "acc_acme_robotics";
const VERTEX_ACCOUNT = "acc_vertex_manufacturing";

const CISO_REQUEST: TargetedCisoMeetingRequest = {
  kind: "ciso_meeting",
  account_id: ACME_ACCOUNT,
  meeting: {
    audience: "Chief Information Security Officer and security architecture team",
    objective: "Review selected evidence and identify security questions that require human follow-up.",
  },
  selection: {
    governance: "human_selected",
    account_object_ids: ["obj_acme_signal_launch", "obj_acme_map_modernization"],
  },
};

const PROPOSAL_REQUEST: TargetedProposalRfxRequest = {
  kind: "proposal_rfx",
  account_id: ACME_ACCOUNT,
  response: {
    type: "RFP",
    requirement_context: "Integration delivery and measurable deployment-outcome requirements supplied by the response team.",
    objective: "Ground the selected response theme in accepted evidence for human drafting.",
  },
  selection: {
    governance: "human_selected",
    account_object_ids: ["obj_acme_play_integration_expansion"],
  },
};

const PAIR_REQUESTS: TargetedBriefPairRequest = {
  ciso_meeting: CISO_REQUEST,
  proposal_rfx: PROPOSAL_REQUEST,
};

function cloneBundle(bundle: GraphBundle): GraphBundle {
  return JSON.parse(JSON.stringify(bundle)) as GraphBundle;
}

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

function proposalRequest(
  accountId: string,
  selectedIds: readonly string[],
): TargetedProposalRfxRequest {
  return {
    kind: "proposal_rfx",
    account_id: accountId,
    response: {
      type: "proposal",
      requirement_context: "Caller-supplied test requirement context.",
      objective: "Review only the explicitly selected workspace objects.",
    },
    selection: {
      governance: "human_selected",
      account_object_ids: selectedIds,
    },
  };
}

function evidenceSet(brief: TargetedBrief): string[] {
  return [
    ...new Set(
      brief.assertions.flatMap((assertion) =>
        assertion.evidence.map(
          (evidence) =>
            `${evidence.relationship}:${evidence.claim.id}:${evidence.excerpt.id}:${evidence.source.id}`,
        ),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function assertEveryAssertionIsEvidenceBound(brief: TargetedBrief): void {
  assert.ok(brief.assertions.length > 0, "brief should contain at least one selected supported assertion");
  for (const assertion of brief.assertions) {
    assert.ok(assertion.evidence.length > 0, `${assertion.id} is missing evidence`);
    for (const claimId of assertion.claim_ids) {
      assert.ok(
        assertion.evidence.some(
          (evidence) => evidence.claim.id === claimId && evidence.relationship === "supports",
        ),
        `${claimId} is missing accepted supporting evidence`,
      );
    }
    for (const evidence of assertion.evidence) {
      assert.ok(evidence.relationship === "supports" || evidence.relationship === "contradicts");
      assert.equal(evidence.excerpt.validation_status, "accepted");
      assert.equal(evidence.excerpt.kind, "literal");
      assert.ok(evidence.claim.id.length > 0);
      assert.ok(evidence.excerpt.id.length > 0);
      assert.ok(evidence.source.id.length > 0);
      assert.equal(evidence.evidence_current_through, null);
    }
    assert.equal(
      assertion.statement,
      [
        ...new Set(
          assertion.evidence
            .filter((evidence) => evidence.relationship === "supports")
            .map((evidence) => evidence.claim.text),
        ),
      ]
        .sort((left, right) => left.localeCompare(right))
        .join(" "),
      `${assertion.id} must render only accepted evidence-bound claim text`,
    );
  }
}

describe("Workshop targeted brief V1", () => {
  test("builds genuinely distinct explicit targets from byte-bound committed fixture input", async () => {
    const fixtureBytes = await readFile(THREE_LANE);
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const pair = buildTargetedBriefPair(loaded, PAIR_REQUESTS);

    assert.deepEqual(pair.ciso_meeting.target, {
      ...CISO_REQUEST,
      selection: {
        governance: "human_selected",
        account_object_ids: ["obj_acme_map_modernization", "obj_acme_signal_launch"],
      },
    });
    assert.deepEqual(pair.proposal_rfx.target, PROPOSAL_REQUEST);
    assert.equal(pair.ciso_meeting.account_id, ACME_ACCOUNT);
    assert.equal(pair.proposal_rfx.account_id, ACME_ACCOUNT);
    assert.deepEqual(pair.ciso_meeting.target_relevance, {
      status: "caller_workflow_context_only",
      evidence_gap:
        "Evidence gap: the graph supports the selected account facts but does not establish that they are CISO-specific. CISO relevance is caller-provided human workflow context and requires review.",
    });
    assert.deepEqual(pair.proposal_rfx.target_relevance, {
      status: "caller_workflow_context_only",
      evidence_gap:
        "Evidence gap: the graph supports the selected account facts but does not establish that they satisfy this RFx requirement context. RFx relevance is caller-provided human workflow context and requires review.",
    });
    assert.deepEqual(
      pair.ciso_meeting.assertions.map((assertion) => assertion.id),
      ["obj_acme_signal_launch", "obj_acme_map_modernization"],
    );
    assert.deepEqual(
      pair.proposal_rfx.assertions.map((assertion) => assertion.id),
      ["obj_acme_play_integration_expansion"],
    );
    assert.notDeepEqual(
      pair.ciso_meeting.assertions.map((assertion) => assertion.id),
      pair.proposal_rfx.assertions.map((assertion) => assertion.id),
    );
    assert.notDeepEqual(evidenceSet(pair.ciso_meeting), evidenceSet(pair.proposal_rfx));
    assertEveryAssertionIsEvidenceBound(pair.ciso_meeting);
    assertEveryAssertionIsEvidenceBound(pair.proposal_rfx);

    assert.equal(pair.ciso_meeting.input.class, "committed_fixture");
    assert.equal(pair.ciso_meeting.input.ref, THREE_LANE);
    assert.equal(
      pair.ciso_meeting.input.sha256,
      createHash("sha256").update(fixtureBytes).digest("hex"),
    );
    assert.equal(pair.ciso_meeting.input.byte_length, fixtureBytes.byteLength);
    assert.equal(pair.ciso_meeting.input.validation, "passed");

    const cisoHtml = renderTargetedBriefHtml(pair.ciso_meeting);
    const proposalHtml = renderTargetedBriefHtml(pair.proposal_rfx);
    assert.match(cisoHtml, /Caller \/ human workflow context · not account facts/);
    assert.match(cisoHtml, /Chief Information Security Officer and security architecture team/);
    assert.match(cisoHtml, /Human-governed workspace selection · not account facts/);
    assert.match(cisoHtml, /Target-relevance evidence gap/);
    assert.match(cisoHtml, /does not establish that they are CISO-specific/);
    assert.match(proposalHtml, /Requirement context · caller-provided, not an account fact/);
    assert.match(proposalHtml, /Integration delivery and measurable deployment-outcome requirements/);
    assert.match(proposalHtml, /does not establish that they satisfy this RFx requirement context/);
    assert.match(cisoHtml, new RegExp(pair.ciso_meeting.input.sha256));
    assert.match(cisoHtml, /fixtures\/graph\/valid\/workshop-three-lane\.json/);
    assert.doesNotMatch(cisoHtml, /prioritize partners that shorten enterprise integration cycles/i);
    assert.doesNotMatch(proposalHtml, /launched a logistics platform on March 1, 2026/i);

    assert.equal(pair.ciso_meeting.boundary.provider_calls, false);
    assert.equal(pair.ciso_meeting.boundary.network_acquisition, false);
    assert.equal(pair.ciso_meeting.boundary.production_writes, false);
    assert.equal(pair.ciso_meeting.boundary.external_actions, false);
  });

  test("does not substitute generic account research when the explicit target lacks support", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(MIXED_TRUST);
    const brief = buildTargetedBrief(
      loaded,
      proposalRequest(VERTEX_ACCOUNT, ["obj_vertex_snapshot"]),
    );
    const html = renderTargetedBriefHtml(brief);

    assert.deepEqual(brief.assertions, []);
    assert.ok(
      brief.evidence_gaps.some(
        (gap) =>
          gap.reason === "selected_target_not_supported" &&
          gap.omitted_item_ids.includes("obj_vertex_snapshot"),
      ),
    );
    assert.ok(brief.evidence_gaps.some((gap) => gap.reason === "missing_accepted_evidence"));
    assert.doesNotMatch(html, /migrated its ERP to a cloud platform/);
    assert.doesNotMatch(html, /Dana Okafor/);
    assert.match(html, /no generic account material was substituted/);
  });

  test("omits unsupported, unverified, stale, rejected, and evidence-free selected material", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(MIXED_TRUST);
    const brief = buildTargetedBrief(
      loaded,
      proposalRequest(VERTEX_ACCOUNT, [
        "obj_vertex_signal_erp",
        "obj_vertex_risk_competitor",
        "obj_vertex_question_budget",
        "obj_vertex_stakeholder_cio",
        "obj_vertex_snapshot",
        "obj_vertex_play_speculative",
        "obj_vertex_reco_expand",
      ]),
    );
    const html = renderTargetedBriefHtml(brief);

    assert.deepEqual(
      brief.assertions.map((assertion) => assertion.id),
      ["obj_vertex_signal_erp", "obj_vertex_stakeholder_cio"],
    );
    assert.ok(brief.evidence_gaps.some((gap) => gap.reason === "unsupported_claim_rejected"));
    assert.ok(brief.evidence_gaps.some((gap) => gap.reason === "trust_not_ready"));
    assert.ok(brief.evidence_gaps.some((gap) => gap.reason === "missing_accepted_evidence"));
    assert.ok(brief.evidence_gaps.some((gap) => gap.reason === "record_not_active"));

    assert.doesNotMatch(html, /Speculative displacement play/);
    assert.doesNotMatch(html, /Model-proposed displacement angle/);
    assert.doesNotMatch(html, /Possible competitor evaluation/);
    assert.doesNotMatch(html, /may be evaluating a competing vendor/);
    assert.doesNotMatch(html, /Unverified recommendation derived/);
    assert.match(html, /Unsupported selected material was omitted rather than presented as fact/);
  });

  test("fails closed on hostile mixed-account records and relationships", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    bundle.sources[0]!.account_id = "acc_hostile_other";

    assert.throws(
      () => evaluateTargetedBriefSelection(bundle, CISO_REQUEST),
      /single-account isolation failed/,
    );

    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const html = renderTargetedBriefHtml(buildTargetedBrief(loaded, CISO_REQUEST));
    assert.doesNotMatch(html, /Account reference not supplied/);
  });

  test("never promotes AccountObject.title to evidence-backed factual prose", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    bundle.account_objects[0]!.title =
      "FABRICATED OBJECT TITLE: Acme suffered a critical unrelated breach";
    const selection = evaluateTargetedBriefSelection(bundle, {
      ...CISO_REQUEST,
      selection: {
        governance: "human_selected",
        account_object_ids: ["obj_acme_signal_launch"],
      },
    });

    assert.doesNotMatch(JSON.stringify(selection.assertions), /FABRICATED OBJECT TITLE/);
    assert.equal(
      selection.assertions[0]!.statement,
      "Acme Robotics launched a logistics platform on March 1, 2026.",
    );

    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const pair = buildTargetedBriefPair(loaded, PAIR_REQUESTS);
    const cisoHtml = renderTargetedBriefHtml(pair.ciso_meeting);
    const proposalHtml = renderTargetedBriefHtml(pair.proposal_rfx);
    assert.doesNotMatch(cisoHtml, /New logistics platform launch/);
    assert.doesNotMatch(cisoHtml, /Warehouse modernization initiative/);
    assert.doesNotMatch(proposalHtml, /Prioritize integration-led expansion play/);
  });

  test("uses conservative combined trust when any rendered claim is source-document-only", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(MIXED_TRUST));
    bundle.account_object_claims.push({
      id: "oclm_vertex_erp_cio",
      account_object_id: "obj_vertex_signal_erp",
      claim_id: "clm_vertex_cio",
      relationship: "supporting",
    });

    const selection = evaluateTargetedBriefSelection(
      bundle,
      proposalRequest(VERTEX_ACCOUNT, ["obj_vertex_signal_erp"]),
    );
    assert.equal(selection.assertions.length, 1);
    assert.equal(selection.assertions[0]!.provenance_status, "source_document_only");
    assert.equal(
      selection.assertions[0]!.trust_label,
      "Source-backed · not independently checked",
    );
    assert.ok(selection.assertions[0]!.claim_ids.includes("clm_vertex_cio"));
    assert.ok(
      selection.assertions[0]!.evidence.some(
        (evidence) => evidence.claim.provenance_status === "source_document_only",
      ),
    );
  });

  test("renders accepted supporting and contradicting evidence as a contested assertion", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    const contraryText =
      "Acme Robotics stated that the logistics platform did not launch on March 1, 2026.";
    bundle.sources.push({
      id: "src_acme_launch_correction",
      team_id: "team_atliera_lab",
      account_id: ACME_ACCOUNT,
      url: "https://example.invalid/acme/press/correction",
      canonical_url: "https://example.invalid/acme/press/correction",
      title: "Acme Robotics launch correction source record",
      publisher: "Acme Robotics",
      source_type: "press_release",
      fetched_at: "2026-03-05T12:00:00Z",
      accessed_at: "2026-03-05T12:00:00Z",
      content_hash: "sha256:hostile-contradiction-fixture",
      raw_text: contraryText,
      reliability: "high",
      status: "active",
    });
    bundle.excerpts.push({
      id: "exc_acme_launch_correction",
      source_document_id: "src_acme_launch_correction",
      text: contraryText,
      kind: "literal",
      char_start: 0,
      char_end: contraryText.length,
      captured_at: "2026-03-05T12:00:01Z",
      validation_status: "accepted",
      rejection_reason: null,
    });
    bundle.claim_evidence.push({
      id: "cev_acme_launch_contradiction",
      claim_id: "clm_acme_launch",
      evidence_excerpt_id: "exc_acme_launch_correction",
      relationship: "contradicts",
      rationale: "Accepted correction is retained alongside the supporting launch source.",
      confidence: "high",
      created_at: "2026-03-05T12:00:02Z",
    });

    const selection = evaluateTargetedBriefSelection(bundle, {
      ...CISO_REQUEST,
      selection: {
        governance: "human_selected",
        account_object_ids: ["obj_acme_signal_launch"],
      },
    });
    const assertion = selection.assertions[0]!;
    assert.equal(assertion.state, "contested");
    assert.equal(assertion.provenance_status, "contested");
    assert.equal(assertion.trust_label, "Contested · supporting and contradicting evidence");
    assert.deepEqual(
      [...new Set(assertion.evidence.map((evidence) => evidence.relationship))].sort(),
      ["contradicts", "supports"],
    );
    assert.ok(
      assertion.evidence.some(
        (evidence) =>
          evidence.relationship === "contradicts" &&
          evidence.excerpt.id === "exc_acme_launch_correction",
      ),
    );
  });

  test("gaps bad claims attached to an otherwise supported selected object", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    const baseClaim: Omit<Claim, "id" | "text" | "normalized_subject" | "provenance_status" | "status"> = {
      team_id: "team_atliera_lab",
      account_id: ACME_ACCOUNT,
      claim_type: "hostile_partial",
      confidence: "low",
      created_by: "model",
      created_at: "2026-03-05T13:00:00Z",
    };
    bundle.claims.push(
      {
        ...baseClaim,
        id: "clm_acme_partial_unsupported",
        text: "Unsupported hostile claim must not leak.",
        normalized_subject: "acme:partial_unsupported",
        provenance_status: "unsupported",
        status: "active",
      },
      {
        ...baseClaim,
        id: "clm_acme_partial_inactive",
        text: "Inactive hostile claim must not leak.",
        normalized_subject: "acme:partial_inactive",
        provenance_status: "source_document_only",
        status: "rejected",
      },
      {
        ...baseClaim,
        id: "clm_acme_partial_evidence_free",
        text: "Evidence-free hostile claim must not leak.",
        normalized_subject: "acme:partial_evidence_free",
        provenance_status: "source_document_only",
        status: "active",
      },
    );
    bundle.account_object_claims.push(
      {
        id: "oclm_acme_partial_unsupported",
        account_object_id: "obj_acme_signal_launch",
        claim_id: "clm_acme_partial_unsupported",
        relationship: "supporting",
      },
      {
        id: "oclm_acme_partial_inactive",
        account_object_id: "obj_acme_signal_launch",
        claim_id: "clm_acme_partial_inactive",
        relationship: "supporting",
      },
      {
        id: "oclm_acme_partial_evidence_free",
        account_object_id: "obj_acme_signal_launch",
        claim_id: "clm_acme_partial_evidence_free",
        relationship: "supporting",
      },
    );

    const selection = evaluateTargetedBriefSelection(bundle, {
      ...CISO_REQUEST,
      selection: {
        governance: "human_selected",
        account_object_ids: ["obj_acme_signal_launch"],
      },
    });
    assert.equal(selection.assertions.length, 1);
    assert.deepEqual(selection.assertions[0]!.claim_ids, ["clm_acme_launch"]);
    assert.doesNotMatch(selection.assertions[0]!.statement, /hostile claim/i);
    assert.ok(
      selection.evidence_gaps.some(
        (gap) =>
          gap.reason === "unsupported_claim_rejected" &&
          gap.omitted_item_ids.includes("clm_acme_partial_unsupported"),
      ),
    );
    assert.ok(
      selection.evidence_gaps.some(
        (gap) =>
          gap.reason === "record_not_active" &&
          gap.omitted_item_ids.includes("clm_acme_partial_inactive"),
      ),
    );
    assert.ok(
      selection.evidence_gaps.some(
        (gap) =>
          gap.reason === "missing_accepted_evidence" &&
          gap.omitted_item_ids.includes("clm_acme_partial_evidence_free"),
      ),
    );
  });

  test("caller strings cannot forge committed-fixture validation or mismatched byte identity", async () => {
    const arbitraryBytes = await readFile(MIXED_TRUST);
    const forged = {
      input: {
        class: "committed_fixture",
        ref: THREE_LANE,
        sha256: createHash("sha256").update(arbitraryBytes).digest("hex"),
        byte_length: arbitraryBytes.byteLength,
        validation: "passed",
      },
    } as LoadedTargetedBriefFixture;

    assert.throws(
      () => buildTargetedBriefPair(forged, PAIR_REQUESTS),
      /must come from loadCommittedTargetedBriefFixture/,
    );
    await assert.rejects(
      () => loadCommittedTargetedBriefFixture("../fixtures/graph/valid/workshop-three-lane.json"),
      /exact repository-relative fixtures\/ path/,
    );
  });

  test("keeps deterministic selection and rendering when collection or load order changes", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    assert.deepEqual(
      evaluateTargetedBriefSelection(bundle, CISO_REQUEST),
      evaluateTargetedBriefSelection(reverseBundle(bundle), CISO_REQUEST),
    );

    const first = buildTargetedBriefPair(
      await loadCommittedTargetedBriefFixture(THREE_LANE),
      PAIR_REQUESTS,
    );
    const second = buildTargetedBriefPair(
      await loadCommittedTargetedBriefFixture(THREE_LANE),
      PAIR_REQUESTS,
    );
    assert.equal(
      renderTargetedBriefHtml(first.ciso_meeting),
      renderTargetedBriefHtml(second.ciso_meeting),
    );
    assert.equal(
      renderTargetedBriefHtml(first.proposal_rfx),
      renderTargetedBriefHtml(second.proposal_rfx),
    );
  });

  test("escapes caller text, refuses unsafe source links, and keeps evidence one disclosure away", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const brief = buildTargetedBrief(loaded, {
      ...CISO_REQUEST,
      meeting: {
        audience: '<img src=x onerror="alert(1)">',
        objective: "Review selected evidence safely.",
      },
    });
    const html = renderTargetedBriefHtml(brief);

    assert.equal(
      html.split("<summary>View supporting evidence</summary>").length - 1,
      brief.assertions.length,
    );
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.doesNotMatch(html, /<img\b/i);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<form\b/i);
    assert.doesNotMatch(html, /<button\b/i);
    assert.match(html, /Accepted excerpt/);
    assert.match(html, /Source record timestamp/);
    assert.match(html, /Evidence current through/);
    assert.match(html, /Not supplied by source/);
    assert.equal(safeTargetedBriefSourceUrl("javascript:alert(1)"), null);
    assert.equal(safeTargetedBriefSourceUrl("https://user:secret@example.invalid/source"), null);
    assert.equal(
      safeTargetedBriefSourceUrl("https://example.invalid/source"),
      "https://example.invalid/source",
    );
  });

  test("renders the corrected committed customer-visible brief snapshots exactly", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const pair = buildTargetedBriefPair(loaded, PAIR_REQUESTS);

    assert.equal(renderTargetedBriefHtml(pair.ciso_meeting), await readFile(CISO_SNAPSHOT, "utf8"));
    assert.equal(renderTargetedBriefHtml(pair.proposal_rfx), await readFile(PROPOSAL_SNAPSHOT, "utf8"));
  });
});
