import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import type { MaterializeProposalForValidationInput } from "../../src/validation/proposal-materialization.ts";
import { buildWorkshopPublicCuratedProposalPreview } from "../../src/workshop/proposal-preview.ts";
import {
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
  buildWorkshopPublicProposalHumanReviewDecisionArtifact,
  type WorkshopProposalHumanReviewDecisionArtifact,
} from "../../src/workshop/proposal-review-decision.ts";

const INPUT_FIXTURE = "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json";
const DECISION_FIXTURE = "fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json";
const REVIEWED_AT = "2026-06-11T12:00:00Z";
const VISIBLE_ITEM_ID = "obj_acme-hub-signal";

function loadFixtureInput(): MaterializeProposalForValidationInput {
  return JSON.parse(readFileSync(INPUT_FIXTURE, "utf8")) as MaterializeProposalForValidationInput;
}

function buildPreview() {
  return buildWorkshopPublicCuratedProposalPreview(loadFixtureInput());
}

function acceptDecision() {
  return [
    {
      item_id: VISIBLE_ITEM_ID,
      decision: "accept_for_graph_candidate",
      rationale: "Visible preview is understandable and the cited public excerpts support this candidate for later ratification review.",
      reviewer_id: "reviewer_demo",
    },
  ];
}

describe("public proposal human review decision artifact", () => {
  test("builds a disposable accept-for-graph-candidate decision without graph ingestion", () => {
    const artifact = buildWorkshopPublicProposalHumanReviewDecisionArtifact(
      buildPreview(),
      acceptDecision(),
      REVIEWED_AT,
    );

    assert.equal(artifact.kind, WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME);
    assert.equal(artifact.disposable, true);
    assert.equal(artifact.current_effective_authorization, "none");
    assert.deepEqual(artifact.counts, {
      accepted_for_graph_candidate: 1,
      rejected: 0,
      needs_more_evidence: 0,
      deferred: 0,
    });
    assert.equal(artifact.provider_calls_made, 0);
    assert.equal(artifact.private_evidence_read, false);
    assert.equal(artifact.graph_ingestion_performed, false);
    assert.equal(artifact.durable_writes_performed, false);
    assert.equal(artifact.production_writes, false);
    assert.equal(artifact.readiness_claim, false);

    assert.deepEqual(artifact.boundaries, {
      current_effective_authorization: "none",
      authorizes_provider_call: false,
      authorizes_private_evidence_read: false,
      authorizes_graph_ingestion: false,
      graph_ingestion_performed: false,
      provider_calls_executed: 0,
      private_evidence_read: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
      authorizes_reviewed_candidate_durable_write: false,
      reviewed_candidate_durable_write_performed: false,
      ratification_performed: false,
    });

    const decision = artifact.decisions[0];
    assert.ok(decision);
    assert.equal(decision.item_id, VISIBLE_ITEM_ID);
    assert.equal(decision.lens, "signals");
    assert.equal(decision.visible_review_state, "model_proposed_pending_human_review");
    assert.deepEqual(decision.source_trust, {
      provenance_status: "unverified",
      label: "Unverified",
      accepted_excerpt_count: 0,
    });
    assert.equal(decision.promotion_performed, false);
    assert.deepEqual(decision.graph_candidate_ref, {
      account_object_id: VISIBLE_ITEM_ID,
      claim_ids: ["clm_acme-hub-expansion", "clm_acme-hub-logistics"],
      excerpt_ids: ["exc_acme-hub-delivery", "exc_acme-hub-open"],
      source_ids: ["src_acme_press_public_001"],
      candidate_only: true,
      graph_ingestion_performed: false,
      durable_graph_write_performed: false,
    });
  });

  test("committed disposable decision artifact regenerates exactly from the public preview", () => {
    const artifact = buildWorkshopPublicProposalHumanReviewDecisionArtifact(
      buildPreview(),
      acceptDecision(),
      REVIEWED_AT,
    );
    const committed = readFileSync(DECISION_FIXTURE, "utf8");

    assert.equal(committed, `${JSON.stringify(artifact, null, 2)}\n`);
  });

  test("refuses to accept items absent from the preview", () => {
    assert.throws(
      () =>
        buildWorkshopPublicProposalHumanReviewDecisionArtifact(
          buildPreview(),
          [
            {
              ...acceptDecision()[0],
              item_id: "acct_obj_absent_from_preview",
            },
          ],
          REVIEWED_AT,
        ),
      /absent from the preview/,
    );
  });

  test("refuses accept-for-graph-candidate when the visible item trust has been incorrectly upgraded", () => {
    const preview = buildPreview();
    const item = preview.view_model.lenses.signals[0];
    assert.ok(item);
    const tamperedPreview = {
      ...preview,
      view_model: {
        ...preview.view_model,
        totals: { ...preview.view_model.totals, verified_objects: 0 },
        lenses: {
          ...preview.view_model.lenses,
          signals: [
            {
              ...item,
              trust: {
                ...item.trust,
                provenance_status: "verified" as const,
                label: "Verified" as const,
              },
            },
          ],
        },
      },
    };

    assert.throws(
      () =>
        buildWorkshopPublicProposalHumanReviewDecisionArtifact(
          tamperedPreview,
          acceptDecision(),
          REVIEWED_AT,
        ),
      /can only accept visible unverified model-proposed items/,
    );
  });

  test("reject, needs-more-evidence, and defer decisions never create graph candidate refs", () => {
    for (const decision of ["reject", "needs_more_evidence", "defer"] as const) {
      const artifact = buildWorkshopPublicProposalHumanReviewDecisionArtifact(
        buildPreview(),
        [
          {
            ...acceptDecision()[0],
            decision,
            rationale: `Reviewer chose ${decision}; this must not silently promote the proposal.`,
          },
        ],
        REVIEWED_AT,
      );
      assert.equal(artifact.counts.accepted_for_graph_candidate, 0);
      assert.equal(artifact.decisions[0]?.graph_candidate_ref, null);
      assert.equal(artifact.decisions[0]?.promotion_performed, false);
      assert.equal(artifact.boundaries.graph_ingestion_performed, false);
      assert.equal(artifact.boundaries.reviewed_candidate_durable_write_performed, false);
    }
  });

  test("refuses every decision kind when the visible item is not the pending-review public proposal state", () => {
    const preview = buildPreview();
    const item = preview.view_model.lenses.signals[0];
    assert.ok(item);
    const tamperedPreview = {
      ...preview,
      view_model: {
        ...preview.view_model,
        lenses: {
          ...preview.view_model.lenses,
          signals: [
            {
              ...item,
              review_state: null,
            },
          ],
        },
      },
    };

    for (const decision of ["reject", "needs_more_evidence", "defer"] as const) {
      assert.throws(
        () =>
          buildWorkshopPublicProposalHumanReviewDecisionArtifact(
            tamperedPreview,
            [
              {
                ...acceptDecision()[0],
                decision,
              },
            ],
            REVIEWED_AT,
          ),
        /can only accept visible unverified model-proposed items/,
      );
    }
  });

  test("rejects impossible or non-canonical review timestamps", () => {
    for (const reviewedAt of ["2026-13-45T25:61:61Z", "2026-06-11T12:00:00.0000Z"]) {
      assert.throws(
        () =>
          buildWorkshopPublicProposalHumanReviewDecisionArtifact(
            buildPreview(),
            acceptDecision(),
            reviewedAt,
          ),
        /requires a deterministic ISO reviewed_at timestamp/,
      );
    }
  });

  test("rejects duplicate item decisions and hostile accessor records before reading unsafe values", () => {
    assert.throws(
      () =>
        buildWorkshopPublicProposalHumanReviewDecisionArtifact(
          buildPreview(),
          [acceptDecision()[0], acceptDecision()[0]],
          REVIEWED_AT,
        ),
      /duplicate item decisions/,
    );

    const hostile = Object.defineProperty({}, "item_id", {
      enumerable: true,
      get() {
        throw new Error("unsafe getter should not run");
      },
    });
    assert.throws(
      () => buildWorkshopPublicProposalHumanReviewDecisionArtifact(buildPreview(), [hostile], REVIEWED_AT),
      /plain own-data objects/,
    );
  });

  test("deep freezes the artifact so decision boundaries cannot be flipped after validation", () => {
    const artifact = buildWorkshopPublicProposalHumanReviewDecisionArtifact(
      buildPreview(),
      acceptDecision(),
      REVIEWED_AT,
    );
    assert.ok(Object.isFrozen(artifact));
    assert.ok(Object.isFrozen(artifact.boundaries));
    assert.ok(Object.isFrozen(artifact.decisions[0]));
    assert.throws(() => {
      (artifact as unknown as { graph_ingestion_performed: boolean }).graph_ingestion_performed = true;
    }, TypeError);
    assert.throws(() => {
      (artifact.boundaries as unknown as { authorizes_graph_ingestion: boolean }).authorizes_graph_ingestion = true;
    }, TypeError);
  });
});
