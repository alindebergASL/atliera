import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import type { Claim, GraphBundle } from "../../src/graph/types.ts";
import {
  assertTargetedBriefSingleAccountIsolation,
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
const ATLIERA_TEAM = "team_atliera_lab";

const CISO_REQUEST: TargetedCisoMeetingRequest = {
  kind: "ciso_meeting",
  authority: { team_id: ATLIERA_TEAM },
  account_id: ACME_ACCOUNT,
  meeting: {
    audience: "Chief Information Security Officer and security architecture team",
    objective: "Prepare a focused security conversation around the selected account developments.",
    fact_contexts: [
      {
        account_object_id: "obj_acme_signal_launch",
        claim_ids: ["clm_acme_launch"],
        why_it_matters:
          "The team wants to understand whether the new platform changes the security review surface.",
        question_to_ask:
          "What identity, data-handling, and resilience reviews are required for the new platform?",
        desired_outcome:
          "Agree which security review owners and follow-ups are needed.",
      },
      {
        account_object_id: "obj_acme_map_modernization",
        claim_ids: ["clm_acme_modernization"],
        why_it_matters:
          "The team wants to connect the modernization priority to the CISO's review calendar.",
        question_to_ask:
          "Which modernization milestones need security architecture involvement?",
      },
    ],
  },
  selection: {
    governance: "human_selected",
    account_object_ids: ["obj_acme_signal_launch", "obj_acme_map_modernization"],
  },
};

const PROPOSAL_REQUEST: TargetedProposalRfxRequest = {
  kind: "proposal_rfx",
  authority: { team_id: ATLIERA_TEAM },
  account_id: ACME_ACCOUNT,
  response: {
    type: "RFP",
    requirement_context: "Integration delivery and measurable deployment-outcome requirements supplied by the response team.",
    objective: "Ground the selected response theme in accepted evidence for human drafting.",
    requirement_mappings: [
      {
        requirement_ref: "RFP-INT-04",
        requirement_text:
          "Describe the approach to shortening enterprise integration cycles and demonstrating deployment outcomes.",
        supported_response_point:
          "The selected account evidence supports discussing integration-cycle speed and demonstrable deployment outcomes as priorities.",
        available_evidence:
          "An active accepted excerpt supports the selected partner-priority statement.",
        gap_or_limitation:
          "The evidence shows a related priority; it does not establish requirement compliance, delivery method, timing, or measured results.",
        account_object_ids: ["obj_acme_play_integration_expansion"],
        claim_ids: ["clm_acme_integration_play"],
      },
    ],
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

function narrowedCisoRequest(
  accountObjectId: string,
  claimId: string,
): TargetedCisoMeetingRequest {
  return {
    ...CISO_REQUEST,
    meeting: {
      ...CISO_REQUEST.meeting,
      fact_contexts: CISO_REQUEST.meeting.fact_contexts?.filter(
        (context) =>
          context.account_object_id === accountObjectId &&
          context.claim_ids.includes(claimId),
      ),
    },
    selection: {
      governance: "human_selected",
      account_object_ids: [accountObjectId],
    },
  };
}

function addLaunchContradiction(
  bundle: GraphBundle,
  status: GraphBundle["sources"][number]["status"] = "active",
): void {
  const contraryText =
    "Acme Robotics stated that the logistics platform did not launch on March 1, 2026.";
  bundle.sources.push({
    id: "src_acme_launch_correction",
    team_id: ATLIERA_TEAM,
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
    status,
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
    authority: { team_id: ATLIERA_TEAM },
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

    assert.equal(pair.ciso_meeting.target.kind, "ciso_meeting");
    assert.deepEqual(pair.ciso_meeting.target.authority, { team_id: ATLIERA_TEAM });
    assert.deepEqual(pair.ciso_meeting.target.selection, {
      governance: "human_selected",
      account_object_ids: ["obj_acme_map_modernization", "obj_acme_signal_launch"],
    });
    assert.deepEqual(pair.proposal_rfx.target, PROPOSAL_REQUEST);
    assert.equal(pair.ciso_meeting.account_id, ACME_ACCOUNT);
    assert.equal(pair.proposal_rfx.account_id, ACME_ACCOUNT);
    assert.deepEqual(pair.ciso_meeting.target_relevance, {
      status: "caller_workflow_context_only",
      evidence_gap: null,
    });
    assert.deepEqual(pair.proposal_rfx.target_relevance, {
      status: "caller_workflow_context_only",
      evidence_gap: null,
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

    assert.equal(pair.ciso_meeting.input.class, "validated_local_fixture");
    assert.equal(pair.ciso_meeting.input.ref, THREE_LANE);
    assert.equal(
      pair.ciso_meeting.input.sha256,
      createHash("sha256").update(fixtureBytes).digest("hex"),
    );
    assert.equal(pair.ciso_meeting.input.byte_length, fixtureBytes.byteLength);
    assert.equal(pair.ciso_meeting.input.validation, "passed");
    assert.equal(pair.ciso_meeting.input.tracked_blob_proof, "unavailable");

    const cisoHtml = renderTargetedBriefHtml(pair.ciso_meeting);
    const proposalHtml = renderTargetedBriefHtml(pair.proposal_rfx);
    const cisoInitialView = cisoHtml.split('<details class="evidence-provenance">')[0]!;
    const proposalInitialView = proposalHtml.split('<details class="evidence-provenance">')[0]!;
    assert.match(cisoHtml, /Purpose · team-provided, not an account fact/);
    assert.match(cisoHtml, /Chief Information Security Officer and security architecture team/);
    assert.match(cisoHtml, /Team-provided meeting context · not a discovered account fact/);
    assert.match(cisoHtml, /Question to ask/);
    assert.match(cisoHtml, /Desired meeting outcome/);
    assert.match(cisoHtml, /The team has not supplied a desired outcome/);
    assert.match(proposalHtml, /Team-provided mapping · not a discovered account fact/);
    assert.match(proposalHtml, /Integration delivery and measurable deployment-outcome requirements/);
    assert.match(proposalHtml, /RFP-INT-04/);
    assert.match(proposalHtml, /does not establish requirement compliance/);
    assert.match(cisoHtml, new RegExp(pair.ciso_meeting.input.sha256));
    assert.match(cisoHtml, /fixtures\/graph\/valid\/workshop-three-lane\.json/);
    assert.doesNotMatch(cisoInitialView, /fixtures\/graph\/valid\/workshop-three-lane\.json/);
    assert.doesNotMatch(cisoInitialView, new RegExp(pair.ciso_meeting.input.sha256));
    assert.doesNotMatch(cisoInitialView, /obj_acme_/);
    assert.doesNotMatch(cisoHtml, /prioritize partners that shorten enterprise integration cycles/i);
    assert.doesNotMatch(proposalHtml, /launched a logistics platform on March 1, 2026/i);
    assert.doesNotMatch(proposalInitialView, /obj_acme_/);
    assert.notEqual(pair.ciso_meeting.next_safe_action, "Review the evidence behind the most important point.");
    assert.match(pair.ciso_meeting.next_safe_action, /desired meeting outcome/i);
    assert.match(pair.proposal_rfx.next_safe_action, /RFP-INT-04/);

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
      /team\/account ownership isolation failed/,
    );

    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const html = renderTargetedBriefHtml(buildTargetedBrief(loaded, CISO_REQUEST));
    assert.doesNotMatch(html, /Account reference not supplied/);
  });

  test("requires nonempty team/workspace authority and resolves every ownership-bearing collection", async () => {
    const base = await loadGraphBundleFile(THREE_LANE);
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(
          cloneBundle(base),
          { ...CISO_REQUEST, authority: undefined } as unknown as TargetedCisoMeetingRequest,
        ),
      /requires explicit team\/workspace generation authority/,
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(cloneBundle(base), {
          ...CISO_REQUEST,
          authority: { team_id: "" },
        }),
      /team_id must be non-empty/,
    );
    assert.throws(
      () => assertTargetedBriefSingleAccountIsolation(cloneBundle(base), ACME_ACCOUNT, "   "),
      /requires explicit team\/workspace authority/,
    );

    const directCollections = [
      "sources",
      "claims",
      "account_objects",
      "research_runs",
    ] as const;
    for (const collection of directCollections) {
      const crossTeam = cloneBundle(base);
      crossTeam[collection][0]!.team_id = "team_hostile_other";
      assert.throws(
        () =>
          assertTargetedBriefSingleAccountIsolation(
            crossTeam,
            ACME_ACCOUNT,
            ATLIERA_TEAM,
          ),
        /team\/account ownership isolation failed/,
        `${collection} must reject same-account cross-team content`,
      );

      const crossAccount = cloneBundle(base);
      crossAccount[collection][0]!.account_id = "acc_hostile_other";
      assert.throws(
        () =>
          assertTargetedBriefSingleAccountIsolation(
            crossAccount,
            ACME_ACCOUNT,
            ATLIERA_TEAM,
          ),
        /team\/account ownership isolation failed/,
        `${collection} must reject cross-account content`,
      );
    }
  });

  test("fails closed on ambiguous IDs, hostile relationship endpoints, inherited records, and receipts", async () => {
    const base = await loadGraphBundleFile(THREE_LANE);
    const isolate = (bundle: GraphBundle): void =>
      assertTargetedBriefSingleAccountIsolation(bundle, ACME_ACCOUNT, ATLIERA_TEAM);

    const duplicateEntityId = cloneBundle(base);
    duplicateEntityId.claims[0]!.id = duplicateEntityId.sources[0]!.id;
    assert.throws(() => isolate(duplicateEntityId), /ambiguous ownership/);

    const crossTeamClaimEndpoint = cloneBundle(base);
    crossTeamClaimEndpoint.claims[0]!.team_id = "team_hostile_other";
    assert.throws(
      () => isolate(crossTeamClaimEndpoint),
      /claim-evidence .* crosses team\/account ownership/,
    );

    const crossAccountObjectEndpoint = cloneBundle(base);
    crossAccountObjectEndpoint.account_objects[0]!.account_id = "acc_hostile_other";
    assert.throws(
      () => isolate(crossAccountObjectEndpoint),
      /account-object claim .* crosses team\/account ownership/,
    );

    const unresolvedExcerpt = cloneBundle(base);
    unresolvedExcerpt.excerpts[0]!.source_document_id = "src_missing_owner";
    assert.throws(() => isolate(unresolvedExcerpt), /excerpt .* unresolved source reference/);

    const unresolvedClaimEvidence = cloneBundle(base);
    unresolvedClaimEvidence.claim_evidence[0]!.evidence_excerpt_id = "exc_missing_owner";
    assert.throws(
      () => isolate(unresolvedClaimEvidence),
      /claim-evidence .* unresolved excerpt endpoint/,
    );

    const unresolvedObjectClaim = cloneBundle(base);
    unresolvedObjectClaim.account_object_claims[0]!.claim_id = "clm_missing_owner";
    assert.throws(
      () => isolate(unresolvedObjectClaim),
      /account-object claim .* unresolved claim endpoint/,
    );

    const unresolvedArtifact = cloneBundle(base);
    unresolvedArtifact.run_artifacts[0]!.research_run_id = "run_missing_owner";
    assert.throws(
      () => isolate(unresolvedArtifact),
      /run artifact .* unresolved research-run reference/,
    );

    const hostileAuditTeam = cloneBundle(base);
    hostileAuditTeam.audit_events[0]!.team_id = "team_hostile_other";
    assert.throws(
      () => isolate(hostileAuditTeam),
      /audit receipt .* declares team .* target resolves to team/,
    );

    const unresolvedAudit = cloneBundle(base);
    unresolvedAudit.audit_events[0]!.target_id = "run_missing_owner";
    assert.throws(() => isolate(unresolvedAudit), /audit targets do not resolve locally/);
  });

  test("requires CISO context references to stay selected and explicitly governed", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...CISO_REQUEST,
          selection: {
            governance: "human_selected",
            account_object_ids: ["obj_acme_signal_launch"],
          },
        }),
      /meeting fact context references account object .* outside the human selection/,
    );

    const nonGoverned = cloneBundle(bundle);
    nonGoverned.account_object_claims.find(
      (relationship) =>
        relationship.account_object_id === "obj_acme_signal_launch" &&
        relationship.claim_id === "clm_acme_launch",
    )!.relationship = "context";
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(
          nonGoverned,
          narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
        ),
      /without an explicit supporting assertion relationship/,
    );

    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
          meeting: {
            ...CISO_REQUEST.meeting,
            fact_contexts: [
              {
                account_object_id: "obj_acme_signal_launch",
                claim_ids: ["clm_acme_modernization"],
                why_it_matters: "Hostile unrelated context.",
              },
            ],
          },
        }),
      /without an explicit supporting assertion relationship/,
    );
  });

  test("turns missing CISO context and fields into concise preparation gaps and a specific action", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const withoutContext = buildTargetedBrief(loaded, {
      ...narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
      meeting: {
        audience: CISO_REQUEST.meeting.audience,
        objective: CISO_REQUEST.meeting.objective,
      },
    });
    const withoutContextHtml = renderTargetedBriefHtml(withoutContext);
    assert.deepEqual(withoutContext.preparation_gaps, [
      "Team-provided meeting context is missing for: Acme Robotics launched a logistics platform on March 1, 2026.",
    ]);
    assert.match(withoutContext.next_safe_action, /Add why the selected fact matters/);
    assert.notEqual(
      withoutContext.next_safe_action,
      "Review the evidence behind the most important point.",
    );
    assert.doesNotMatch(withoutContextHtml, /Meeting questions and outcomes/);

    const missingFields = buildTargetedBrief(loaded, {
      ...narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
      meeting: {
        ...CISO_REQUEST.meeting,
        fact_contexts: [
          {
            account_object_id: "obj_acme_signal_launch",
            claim_ids: ["clm_acme_launch"],
          },
        ],
      },
    });
    assert.equal(missingFields.preparation_gaps.length, 3);
    assert.match(missingFields.next_safe_action, /Add why the selected fact matters/);
    assert.doesNotMatch(renderTargetedBriefHtml(missingFields), /<dl>\s*<\/dl>/);
  });

  test("never promotes AccountObject.title to evidence-backed factual prose", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    bundle.account_objects[0]!.title =
      "FABRICATED OBJECT TITLE: Acme suffered a critical unrelated breach";
    const selection = evaluateTargetedBriefSelection(
      bundle,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );

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
    addLaunchContradiction(bundle);

    const selection = evaluateTargetedBriefSelection(
      bundle,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );
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
    assert.ok(
      selection.evidence_gaps.some(
        (gap) =>
          gap.reason === "accepted_contradiction" &&
          gap.message.includes("remains contested"),
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

    const selection = evaluateTargetedBriefSelection(
      bundle,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );
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

  test("validates deterministic governed RFx mappings and rejects ambiguous or unrelated references", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    const requiredTextFields = [
      "requirement_ref",
      "requirement_text",
      "supported_response_point",
      "available_evidence",
    ] as const;
    for (const field of requiredTextFields) {
      const mapping = { ...PROPOSAL_REQUEST.response.requirement_mappings![0]!, [field]: "" };
      assert.throws(
        () =>
          evaluateTargetedBriefSelection(bundle, {
            ...PROPOSAL_REQUEST,
            response: {
              ...PROPOSAL_REQUEST.response,
              requirement_mappings: [mapping],
            },
          }),
        /must be non-empty, bounded, and single-line/,
        `${field} must be nonempty`,
      );
    }

    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [
              PROPOSAL_REQUEST.response.requirement_mappings![0]!,
              PROPOSAL_REQUEST.response.requirement_mappings![0]!,
            ],
          },
        }),
      /requirement_ref .* is ambiguous/,
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          selection: {
            governance: "human_selected",
            account_object_ids: ["obj_acme_signal_launch"],
          },
        }),
      /outside the human selection/,
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [
              {
                ...PROPOSAL_REQUEST.response.requirement_mappings![0]!,
                claim_ids: ["clm_acme_launch"],
              },
            ],
          },
        }),
      /object obj_acme_play_integration_expansion has no governed primary\/supporting pair|claim clm_acme_launch has no governed primary\/supporting pair/,
    );

    const baseMapping = PROPOSAL_REQUEST.response.requirement_mappings![0]!;
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          selection: {
            governance: "human_selected",
            account_object_ids: [
              "obj_acme_play_integration_expansion",
              "obj_acme_signal_launch",
            ],
          },
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [{
              ...baseMapping,
              account_object_ids: [
                "obj_acme_play_integration_expansion",
                "obj_acme_signal_launch",
              ],
            }],
          },
        }),
      /object obj_acme_signal_launch has no governed primary\/supporting pair/,
      "an extra selected but unrelated object must fail closed",
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [{
              ...baseMapping,
              claim_ids: ["clm_acme_integration_play", "clm_acme_launch"],
            }],
          },
        }),
      /claim clm_acme_launch has no governed primary\/supporting pair/,
      "an extra unrelated claim must fail closed",
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          selection: {
            governance: "human_selected",
            account_object_ids: [
              "obj_acme_play_integration_expansion",
              "obj_acme_signal_launch",
            ],
          },
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [{
              ...baseMapping,
              account_object_ids: [
                "obj_acme_play_integration_expansion",
                "obj_acme_signal_launch",
              ],
              claim_ids: ["clm_acme_integration_play", "clm_acme_modernization"],
            }],
          },
        }),
      /object obj_acme_signal_launch has no governed primary\/supporting pair|claim clm_acme_modernization has no governed primary\/supporting pair/,
      "a mixed mapping with only partial governed pairing must fail closed",
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          selection: {
            governance: "human_selected",
            account_object_ids: ["obj_acme_missing"],
          },
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [{
              ...baseMapping,
              account_object_ids: ["obj_acme_missing"],
            }],
          },
        }),
      /object obj_acme_missing does not resolve exactly once/,
      "an unresolved object reference must fail closed",
    );
    assert.throws(
      () =>
        evaluateTargetedBriefSelection(bundle, {
          ...PROPOSAL_REQUEST,
          response: {
            ...PROPOSAL_REQUEST.response,
            requirement_mappings: [{
              ...baseMapping,
              claim_ids: ["clm_acme_missing"],
            }],
          },
        }),
      /claim clm_acme_missing does not resolve exactly once/,
      "an unresolved claim reference must fail closed",
    );
    for (const duplicateField of ["account_object_ids", "claim_ids"] as const) {
      const duplicated = baseMapping[duplicateField][0]!;
      assert.throws(
        () =>
          evaluateTargetedBriefSelection(bundle, {
            ...PROPOSAL_REQUEST,
            response: {
              ...PROPOSAL_REQUEST.response,
              requirement_mappings: [{
                ...baseMapping,
                [duplicateField]: [duplicated, duplicated],
              }],
            },
          }),
        /references must not contain duplicates/,
        `ambiguous ${duplicateField} references must fail closed`,
      );
    }

    const reversedMappingRequest: TargetedProposalRfxRequest = {
      ...PROPOSAL_REQUEST,
      response: {
        ...PROPOSAL_REQUEST.response,
        requirement_mappings: [
          {
            ...PROPOSAL_REQUEST.response.requirement_mappings![0]!,
            account_object_ids: [
              "obj_acme_play_integration_expansion",
            ],
            claim_ids: ["clm_acme_integration_play"],
          },
        ].reverse(),
      },
    };
    assert.deepEqual(
      evaluateTargetedBriefSelection(bundle, reversedMappingRequest),
      evaluateTargetedBriefSelection(reverseBundle(bundle), PROPOSAL_REQUEST),
    );
  });

  test("makes missing RFx mappings actionable and never upgrades a related capability to compliance", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const missingMapping = buildTargetedBrief(loaded, {
      ...PROPOSAL_REQUEST,
      response: {
        type: PROPOSAL_REQUEST.response.type,
        requirement_context: PROPOSAL_REQUEST.response.requirement_context,
        objective: PROPOSAL_REQUEST.response.objective,
      },
    });
    const missingHtml = renderTargetedBriefHtml(missingMapping);
    assert.deepEqual(missingMapping.preparation_gaps, [
      "The response team has not supplied a governed requirement mapping.",
    ]);
    assert.match(missingMapping.next_safe_action, /Add the first requirement mapping/);
    assert.doesNotMatch(missingHtml, /<h2>Requirement mappings<\/h2>/);

    const proposalBrief = buildTargetedBrief(loaded, PROPOSAL_REQUEST);
    const proposalHtml = renderTargetedBriefHtml(proposalBrief);
    assert.equal(proposalBrief.rfx_mappings[0]!.evidence_state, "supported");
    assert.deepEqual(proposalBrief.rfx_mappings[0]!.governed_pairs, [{
      account_object_id: "obj_acme_play_integration_expansion",
      claim_id: "clm_acme_integration_play",
    }]);
    assert.match(
      proposalHtml,
      /RFP-INT-04 governed pairs: <code>obj_acme_play_integration_expansion<\/code> → <code>clm_acme_integration_play<\/code>/,
    );
    assert.doesNotMatch(proposalHtml, /RFP-INT-04: objects .* · claims /);
    assert.match(proposalHtml, /A related capability is not a compliance claim/);
    assert.match(proposalHtml, /does not establish requirement compliance/);
    assert.doesNotMatch(proposalHtml, /requirement (?:is )?compliant|satisfies the requirement/i);
  });

  test("renders unsupported RFx mapping text only as team-proposed and unvalidated", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(MIXED_TRUST);
    const brief = buildTargetedBrief(loaded, {
      kind: "proposal_rfx",
      authority: { team_id: ATLIERA_TEAM },
      account_id: VERTEX_ACCOUNT,
      response: {
        type: "RFP",
        requirement_context: "Team-supplied competitor-risk response context.",
        objective: "Identify whether the proposed response point has usable proof.",
        requirement_mappings: [{
          requirement_ref: "RFP-RISK-09",
          requirement_text: "Describe competitive displacement evidence.",
          supported_response_point: "Vertex is actively evaluating a competing vendor.",
          available_evidence: "A forum post speculates about vendor strategy.",
          gap_or_limitation: "No active accepted literal evidence supports this proposed point.",
          account_object_ids: ["obj_vertex_risk_competitor"],
          claim_ids: ["clm_vertex_competitor_risk"],
        }],
      },
      selection: {
        governance: "human_selected",
        account_object_ids: ["obj_vertex_risk_competitor"],
      },
    });
    const html = renderTargetedBriefHtml(brief);

    assert.equal(brief.rfx_mappings[0]!.evidence_state, "needs_evidence");
    assert.match(html, /Needs evidence · do not use as supported/);
    assert.match(html, /Team-proposed, unvalidated response point/);
    assert.match(html, /Team-provided evidence note · not validated proof/);
    assert.doesNotMatch(html, /<dt>Supported response point<\/dt>/);
    assert.doesNotMatch(html, /<dt>Available evidence \/ proof<\/dt>/);

  });

  test("renders contested RFx mapping text only as team-proposed and unvalidated", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    addLaunchContradiction(bundle);
    const fixtureDirectory = await mkdtemp("fixtures/targeted-brief-contested-");
    const fixturePath = `${fixtureDirectory}/graph.json`;
    try {
      await writeFile(fixturePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
      const brief = buildTargetedBrief(
        await loadCommittedTargetedBriefFixture(fixturePath),
        {
          kind: "proposal_rfx",
          authority: { team_id: ATLIERA_TEAM },
          account_id: ACME_ACCOUNT,
          response: {
            type: "RFI",
            requirement_context: "Team-supplied launch response context.",
            objective: "Identify whether the proposed launch response point is uncontested.",
            requirement_mappings: [{
              requirement_ref: "RFI-LAUNCH-02",
              requirement_text: "Describe evidence of the platform launch.",
              supported_response_point: "Acme launched the logistics platform on March 1, 2026.",
              available_evidence: "The launch announcement is accompanied by a conflicting correction.",
              gap_or_limitation: "The accepted correction contests the launch assertion.",
              account_object_ids: ["obj_acme_signal_launch"],
              claim_ids: ["clm_acme_launch"],
            }],
          },
          selection: {
            governance: "human_selected",
            account_object_ids: ["obj_acme_signal_launch"],
          },
        },
      );
      const html = renderTargetedBriefHtml(brief);

      assert.equal(brief.rfx_mappings[0]!.evidence_state, "contested");
      assert.match(html, /Contested · do not use as supported/);
      assert.match(html, /Team-proposed, unvalidated response point/);
      assert.match(html, /Team-provided evidence note · contested, not validated proof/);
      assert.doesNotMatch(html, /<dt>Supported response point<\/dt>/);
      assert.doesNotMatch(html, /<dt>Available evidence \/ proof<\/dt>/);
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  test("does not render empty brief sections", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(MIXED_TRUST);
    const html = renderTargetedBriefHtml(
      buildTargetedBrief(
        loaded,
        proposalRequest(VERTEX_ACCOUNT, ["obj_vertex_snapshot"]),
      ),
    );
    assert.doesNotMatch(html, /empty-section|<section[^>]*>\s*<\/section>/);
    assert.doesNotMatch(html, /<h2>(?:Why now|Account context|Response themes)<\/h2>/);
  });

  test("treats inactive evidence only as provenance and never as current support or contradiction", async () => {
    const base = await loadGraphBundleFile(THREE_LANE);
    const inactiveContradiction = cloneBundle(base);
    addLaunchContradiction(inactiveContradiction, "stale");
    const retained = evaluateTargetedBriefSelection(
      inactiveContradiction,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );
    assert.equal(retained.assertions[0]!.state, "supported");
    assert.equal(retained.assertions[0]!.provenance_status, "verified");
    assert.equal(retained.assertions[0]!.evidence.length, 1);
    assert.ok(
      retained.assertions[0]!.inactive_evidence.some(
        (evidence) =>
          evidence.relationship === "contradicts" &&
          evidence.activity === "inactive_provenance",
      ),
    );
    assert.equal(
      retained.evidence_gaps.some((gap) => gap.reason === "accepted_contradiction"),
      false,
    );

    const inactiveSupport = cloneBundle(base);
    inactiveSupport.sources.find((source) => source.id === "src_acme_press_001")!.status =
      "stale";
    const unsupported = evaluateTargetedBriefSelection(
      inactiveSupport,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );
    assert.equal(unsupported.assertions.length, 0);
    assert.ok(
      unsupported.evidence_gaps.some(
        (gap) =>
          gap.reason === "missing_accepted_evidence" &&
          gap.retained_evidence.some(
            (evidence) => evidence.activity === "inactive_provenance",
          ),
      ),
    );
  });

  test("promotes claim text only through primary or supporting object relationships", async () => {
    const bundle = cloneBundle(await loadGraphBundleFile(THREE_LANE));
    const hostileText = "Acme Robotics is fully compliant with every security requirement.";
    bundle.claims.push({
      id: "clm_acme_context_only_hostile",
      team_id: ATLIERA_TEAM,
      account_id: ACME_ACCOUNT,
      claim_type: "context_only",
      text: hostileText,
      normalized_subject: "acme:context-only-hostile",
      confidence: "low",
      provenance_status: "source_document_only",
      status: "active",
      created_by: "user",
      created_at: "2026-03-05T14:00:00Z",
    });
    bundle.claim_evidence.push({
      id: "cev_acme_context_only_hostile",
      claim_id: "clm_acme_context_only_hostile",
      evidence_excerpt_id: "exc_acme_launch_001",
      relationship: "supports",
      rationale: "Hostile relationship-shape regression.",
      confidence: "low",
      created_at: "2026-03-05T14:00:01Z",
    });
    bundle.account_object_claims.push({
      id: "oclm_acme_context_only_hostile",
      account_object_id: "obj_acme_signal_launch",
      claim_id: "clm_acme_context_only_hostile",
      relationship: "context",
    });

    const selection = evaluateTargetedBriefSelection(
      bundle,
      narrowedCisoRequest("obj_acme_signal_launch", "clm_acme_launch"),
    );
    assert.equal(
      selection.assertions[0]!.statement,
      "Acme Robotics launched a logistics platform on March 1, 2026.",
    );
    assert.doesNotMatch(JSON.stringify(selection.assertions), /fully compliant/i);
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
    } as unknown as LoadedTargetedBriefFixture;

    assert.throws(
      () => buildTargetedBriefPair(forged, PAIR_REQUESTS),
      /must come from loadCommittedTargetedBriefFixture/,
    );
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const legitimate = buildTargetedBrief(loaded, CISO_REQUEST);
    const copiedLoaded = {
      input: {
        ...loaded.input,
        ref: "fixtures/caller-forged-label.json",
        sha256: "f".repeat(64),
      },
    } as LoadedTargetedBriefFixture;
    assert.throws(
      () => buildTargetedBrief(copiedLoaded, CISO_REQUEST),
      /must come from loadCommittedTargetedBriefFixture/,
    );
    assert.throws(
      () =>
        renderTargetedBriefHtml({
          ...legitimate,
          input: {
            ...legitimate.input,
            ref: "fixtures/caller-forged-label.json",
            sha256: "f".repeat(64),
          },
        }),
      /only a brief built from a validated local fixture may be rendered/,
    );
    const legitimateHtml = renderTargetedBriefHtml(legitimate);
    assert.match(legitimateHtml, /Validated local fixture bytes only/);
    assert.doesNotMatch(legitimateHtml, /committed fixture/i);
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

  test("escapes caller text and keeps assertion-specific evidence within two disclosures", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const brief = buildTargetedBrief(loaded, {
      ...CISO_REQUEST,
      meeting: {
        audience: '<img src=x onerror="alert(1)">',
        objective: "<script>alert(2)</script>",
        fact_contexts: CISO_REQUEST.meeting.fact_contexts?.map((context, index) => ({
          ...context,
          why_it_matters:
            index === 0 ? "<form>unsafe context</form>" : context.why_it_matters,
          question_to_ask:
            index === 1 ? "<button>unsafe question</button>" : context.question_to_ask,
        })),
      },
    });
    const html = renderTargetedBriefHtml(brief);
    const evidenceArea = html.indexOf('<details class="evidence-provenance">');

    assert.ok(evidenceArea > 0);
    assert.equal(html.slice(0, evidenceArea).includes("Accepted excerpt"), false);
    assert.equal(html.split('<details class="assertion-evidence">').length - 1, brief.assertions.length);
    assert.equal(
      html.split('<summary aria-label="Evidence for assertion: ').length - 1,
      brief.assertions.length,
    );
    for (const assertion of brief.assertions) {
      const accessibleSummary =
        `<summary aria-label="Evidence for assertion: ${assertion.statement}">Evidence for: ${assertion.statement}</summary>`;
      assert.ok(
        html.indexOf(accessibleSummary) > evidenceArea,
        `${assertion.id} needs an assertion-specific nested evidence summary`,
      );
    }
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
    assert.match(html, /&lt;form&gt;unsafe context&lt;\/form&gt;/);
    assert.match(html, /&lt;button&gt;unsafe question&lt;\/button&gt;/);
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

  test("keeps the initial view useful while isolating provenance controls and supports screen, mobile, and print access", async () => {
    const pair = buildTargetedBriefPair(
      await loadCommittedTargetedBriefFixture(THREE_LANE),
      PAIR_REQUESTS,
    );
    for (const brief of [pair.ciso_meeting, pair.proposal_rfx]) {
      const html = renderTargetedBriefHtml(brief);
      const initialView = html.split('<details class="evidence-provenance">')[0]!;
      assert.match(initialView, /Purpose · team-provided, not an account fact/);
      assert.match(initialView, /Next safe action:/);
      assert.match(initialView, /Selected evidence-backed fact/);
      if (brief.preparation_gaps.length + brief.evidence_gaps.length > 0) {
        assert.match(initialView, /What still needs attention/);
      }
      if (brief.kind === "ciso_meeting") {
        assert.match(initialView, /Meeting questions and outcomes/);
      } else {
        assert.match(initialView, /Requirement mappings/);
      }
      assert.doesNotMatch(
        initialView,
        /fixtures\/|SHA-256|byte length|team_atliera_lab|acc_acme_|obj_acme_|clm_acme_|human_selected|tracked-blob|Read-only generation|provider call/i,
      );
      assert.match(html, /summary aria-label="Evidence and provenance for selected assertions:/);
      assert.match(html, /summary aria-label="Evidence for assertion:/);
      assert.match(html, /summary:focus-visible, a:focus-visible/);
      assert.match(html, /@media \(max-width: 760px\)/);
      assert.match(html, /\.assertion-heading \{ flex-direction: column; \}/);
      assert.match(html, /@media print/);
      assert.match(html, /details:not\(\[open\]\) > \* \{ display: block !important; \}/);
      assert.match(html, /details::details-content \{ content-visibility: visible !important; \}/);
      assert.match(html, /\.assertion-evidence > summary \{ break-inside: avoid-page; break-after: avoid-page; \}/);
      assert.match(html, /\.evidence-intro \{ break-inside: avoid; \}/);
      assert.match(html, /h1, h2, h3, h4, summary \{ break-after: avoid; \}/);
      assert.match(html, /break-inside: avoid/);
      assert.match(html, /a\[href\]::after \{ content: " \(" attr\(href\) "\)"/);
    }
  });

  test("renders the corrected committed customer-visible brief snapshots exactly", async () => {
    const loaded = await loadCommittedTargetedBriefFixture(THREE_LANE);
    const pair = buildTargetedBriefPair(loaded, PAIR_REQUESTS);

    assert.equal(renderTargetedBriefHtml(pair.ciso_meeting), await readFile(CISO_SNAPSHOT, "utf8"));
    assert.equal(renderTargetedBriefHtml(pair.proposal_rfx), await readFile(PROPOSAL_SNAPSHOT, "utf8"));
  });
});
