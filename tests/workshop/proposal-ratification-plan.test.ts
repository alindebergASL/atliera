import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME,
  buildWorkshopPublicProposalRatificationPlanArtifact,
  type WorkshopProposalRatificationPlanArtifact,
} from "../../src/workshop/proposal-ratification-plan.ts";
import type { WorkshopProposalHumanReviewDecisionArtifact } from "../../src/workshop/proposal-review-decision.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const DECISION_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json",
);
const PLAN_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-reviewed-candidate-ratification-plan.json",
);
const PLANNED_AT = "2026-06-11T12:05:00Z";

function loadDecisionFixture(): WorkshopProposalHumanReviewDecisionArtifact {
  return JSON.parse(readFileSync(DECISION_FIXTURE, "utf8")) as WorkshopProposalHumanReviewDecisionArtifact;
}

function loadPlanFixture(): WorkshopProposalRatificationPlanArtifact {
  return JSON.parse(readFileSync(PLAN_FIXTURE, "utf8")) as WorkshopProposalRatificationPlanArtifact;
}

describe("public proposal reviewed-candidate ratification plan artifact", () => {
  test("builds a no-call plan over accepted candidate refs without graph ingestion", () => {
    const plan = buildWorkshopPublicProposalRatificationPlanArtifact(loadDecisionFixture(), PLANNED_AT);

    assert.equal(plan.kind, WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME);
    assert.equal(plan.generated_from, "workshop-public-proposal-human-review-decision");
    assert.equal(plan.current_effective_authorization, "none");
    assert.equal(plan.next_required_contract, "reviewed-candidate-durable-graph-write");
    assert.deepEqual(plan.boundaries, {
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
      plan_only: true,
      requires_separate_ratification_approval: true,
    });
    assert.equal(plan.candidates.length, 1);
    const candidate = plan.candidates[0];
    assert.ok(candidate);
    assert.equal(candidate.item_id, "obj_acme-hub-signal");
    assert.equal(candidate.ratification_status, "awaiting_separate_ratification");
    assert.equal(candidate.planned_write_operation, "none");
    assert.equal(candidate.candidate_only, true);
    assert.equal(candidate.requires_separate_ratification_approval, true);
    assert.equal(candidate.authorizes_graph_ingestion, false);
    assert.equal(candidate.graph_ingestion_performed, false);
    assert.equal(candidate.authorizes_durable_write, false);
    assert.equal(candidate.durable_write_performed, false);
    assert.deepEqual(plan.counts, {
      accepted_candidate_count: 1,
      planned_candidate_count: 1,
      ratified_candidate_count: 0,
      durable_write_count: 0,
    });
    assert.equal(plan.provider_calls_made, 0);
    assert.equal(plan.private_evidence_read, false);
    assert.equal(plan.graph_ingestion_performed, false);
    assert.equal(plan.durable_writes_performed, false);
    assert.equal(plan.production_writes, false);
    assert.equal(plan.readiness_claim, false);
  });

  test("committed ratification plan fixture regenerates exactly from the human-review decision fixture", () => {
    const regenerated = buildWorkshopPublicProposalRatificationPlanArtifact(
      loadDecisionFixture(),
      PLANNED_AT,
    );
    assert.deepEqual(regenerated, loadPlanFixture());
  });

  test("requires at least one accepted candidate ref and matching accepted counts", () => {
    const artifact = loadDecisionFixture();
    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            counts: {
              ...artifact.counts,
              accepted_for_graph_candidate: 0,
            },
            decisions: artifact.decisions.map((decision) => ({
              ...decision,
              decision: "defer" as const,
              graph_candidate_ref: null,
            })),
          },
          PLANNED_AT,
        ),
      /requires at least one accepted graph candidate ref/,
    );

    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            counts: {
              ...artifact.counts,
              accepted_for_graph_candidate: 2,
            },
          },
          PLANNED_AT,
        ),
      /accepted count must match accepted candidate refs/,
    );
  });

  test("refuses accepted decisions whose candidate refs are missing, written, or mismatched", () => {
    const artifact = loadDecisionFixture();
    const decision = artifact.decisions[0]!;
    assert.ok(decision.graph_candidate_ref);

    for (const graph_candidate_ref of [
      null,
      {
        ...decision.graph_candidate_ref,
        candidate_only: false,
      },
      {
        ...decision.graph_candidate_ref,
        graph_ingestion_performed: true,
      },
      {
        ...decision.graph_candidate_ref,
        durable_graph_write_performed: true,
      },
      {
        ...decision.graph_candidate_ref,
        account_object_id: "obj_other",
      },
    ]) {
      assert.throws(
        () =>
          buildWorkshopPublicProposalRatificationPlanArtifact(
            {
              ...artifact,
              decisions: [
                {
                  ...decision,
                  graph_candidate_ref,
                },
              ],
            } as unknown as WorkshopProposalHumanReviewDecisionArtifact,
            PLANNED_AT,
          ),
        /candidate ref|candidate-only and unwritten/,
      );
    }
  });

  test("refuses non-accept decisions with candidate refs and broadened source boundaries", () => {
    const artifact = loadDecisionFixture();
    const decision = artifact.decisions[0]!;
    assert.ok(decision.graph_candidate_ref);

    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            counts: {
              ...artifact.counts,
              accepted_for_graph_candidate: 0,
              rejected: 1,
            },
            decisions: [
              {
                ...decision,
                decision: "reject" as const,
              },
            ],
          } as unknown as WorkshopProposalHumanReviewDecisionArtifact,
          PLANNED_AT,
        ),
      /non-accept decisions with candidate refs/,
    );

    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            boundaries: {
              ...artifact.boundaries,
              authorizes_graph_ingestion: true,
            },
          } as unknown as WorkshopProposalHumanReviewDecisionArtifact,
          PLANNED_AT,
        ),
      /closed, non-authorizing human-review artifact/,
    );
  });

  test("rejects hostile accessor decision records and impossible or stale planned timestamps", () => {
    const artifact = loadDecisionFixture();
    const hostile = {};
    Object.defineProperty(hostile, "item_id", {
      enumerable: true,
      get() {
        throw new Error("getter must not execute");
      },
    });

    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            decisions: [hostile],
          } as unknown as WorkshopProposalHumanReviewDecisionArtifact,
          PLANNED_AT,
        ),
      /plain own-data objects/,
    );

    assert.throws(
      () => buildWorkshopPublicProposalRatificationPlanArtifact(artifact, "2026-13-45T25:61:61Z"),
      /requires a deterministic ISO planned_at timestamp/,
    );

    assert.throws(
      () => buildWorkshopPublicProposalRatificationPlanArtifact(artifact, "2026-06-11T11:59:59Z"),
      /planned_at must not precede the source reviewed_at timestamp/,
    );
  });

  test("requires accepted decision timestamps to match the source artifact reviewed_at", () => {
    const artifact = loadDecisionFixture();
    const decision = artifact.decisions[0]!;

    assert.throws(
      () =>
        buildWorkshopPublicProposalRatificationPlanArtifact(
          {
            ...artifact,
            decisions: [
              {
                ...decision,
                reviewed_at: "2026-06-11T12:00:01Z",
              },
            ],
          } as unknown as WorkshopProposalHumanReviewDecisionArtifact,
          PLANNED_AT,
        ),
      /accepted decisions must match the source reviewed_at timestamp/,
    );
  });

  test("deep freezes the plan so authorization markers cannot be flipped after validation", () => {
    const plan = buildWorkshopPublicProposalRatificationPlanArtifact(loadDecisionFixture(), PLANNED_AT);
    assert.ok(Object.isFrozen(plan));
    assert.ok(Object.isFrozen(plan.boundaries));
    assert.ok(Object.isFrozen(plan.candidates));
    assert.ok(Object.isFrozen(plan.candidates[0]));
    assert.throws(() => {
      (plan as unknown as { graph_ingestion_performed: boolean }).graph_ingestion_performed = true;
    }, TypeError);
    assert.throws(() => {
      (plan.boundaries as unknown as { ratification_performed: boolean }).ratification_performed = true;
    }, TypeError);
    assert.throws(() => {
      (plan.candidates[0] as unknown as { durable_write_performed: boolean }).durable_write_performed =
        true;
    }, TypeError);
  });
});
