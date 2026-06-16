// M3 step 3b — read durable graph state and render it through Workshop.
//
// This test intentionally performs the 3a write first, then exercises the new
// 3b read path over the actual local-durable-db graph_snapshots.jsonl table.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import {
  buildWorkshopPublicProposalOperatorArming,
  type WorkshopProposalOperatorArmingArtifact,
} from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import {
  executeWorkshopPublicProposalDurableGraphWrite,
  type MaterializationInputFixture,
} from "../../src/workshop/proposal-durable-graph-write-execution.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import { readDurableGraphSnapshotRows } from "../../src/workshop/durable-graph-snapshots-reader.ts";
import { buildWorkshopViewModelFromDurableState } from "../../src/workshop/durable-state-view-model.ts";
import { WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT, renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import type { WorkshopProposalHumanReviewDecisionArtifact } from "../../src/workshop/proposal-review-decision.ts";

const repoRoot = join(import.meta.dirname, "..", "..");
const CONTRACT_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json");
const PACKET_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json");
const MATERIALIZATION_INPUT_FIXTURE = join(repoRoot, "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json");
const DECISION_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json");

const OPERATOR_IDENTITY = "reviewer_demo";
const ARMED_AT = "2026-06-13T01:00:00Z";
const NOW = "2026-06-14T17:00:00Z";

async function setupDb(): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-"));
  const report = await initializeLocalDurableDb({ rootDir });
  assert.ok(report.ok, `db init failed: ${JSON.stringify(report)}`);
  return { rootDir, cleanup: () => rm(rootDir, { recursive: true, force: true }) };
}

async function loadContract(): Promise<WorkshopProposalDurableGraphWriteContractArtifact> {
  return JSON.parse(await readFile(CONTRACT_FIXTURE, "utf8")) as WorkshopProposalDurableGraphWriteContractArtifact;
}

async function loadPacket(): Promise<WorkshopProposalDurableWriteApprovalPacketArtifact> {
  return JSON.parse(await readFile(PACKET_FIXTURE, "utf8")) as WorkshopProposalDurableWriteApprovalPacketArtifact;
}

async function loadMaterializationInput(): Promise<MaterializationInputFixture> {
  return JSON.parse(await readFile(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as MaterializationInputFixture;
}

async function freshArming(): Promise<WorkshopProposalOperatorArmingArtifact> {
  return buildWorkshopPublicProposalOperatorArming(await loadPacket(), {
    operatorIdentity: OPERATOR_IDENTITY,
    armedAt: ARMED_AT,
  });
}

async function writeOne3aRow(rootDir: string): Promise<void> {
  const contract = await loadContract();
  const packet = await loadPacket();
  const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
    arming: await freshArming(),
    contract,
    approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
    materializationInput: await loadMaterializationInput(),
    dbRootDir: rootDir,
    now: NOW,
  });
  assert.equal(outcome.outcome, "completed", `3a write must complete before 3b reads: ${JSON.stringify(outcome)}`);
}

async function decisionArtifactWithRejectedReason(): Promise<WorkshopProposalHumanReviewDecisionArtifact> {
  const artifact = JSON.parse(await readFile(DECISION_FIXTURE, "utf8")) as WorkshopProposalHumanReviewDecisionArtifact;
  const accepted = artifact.decisions[0]!;
  return {
    ...artifact,
    decisions: [
      {
        ...accepted,
        item_id: "obj_acme-rejected-play",
        lens: "plays",
        decision: "reject",
        rationale: "Rejected because the visible proposal did not have enough public-source support for a durable graph write.",
        graph_candidate_ref: null,
        promotion_performed: false,
      },
    ],
    counts: {
      accepted_for_graph_candidate: 0,
      rejected: 1,
      needs_more_evidence: 0,
      deferred: 0,
    },
  };
}

describe("M3 step 3b durable state Workshop view", () => {
  test("3a writes a row; 3b reads it; renderer shows Unverified + pending review, with rejected reason visible as non-graph audit context", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      await writeOne3aRow(rootDir);

      const rows = await readDurableGraphSnapshotRows({ dbRootDir: rootDir });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]!.bundle.account_objects[0]!.provenance_status, "source_document_only");
      assert.equal(rows[0]!.bundle.claims.every((claim) => claim.provenance_status === "source_document_only"), true);

      const vm = buildWorkshopViewModelFromDurableState(rows, {
        reviewDecisionArtifact: await decisionArtifactWithRejectedReason(),
      });
      const allItems = [...vm.lenses.signals, ...vm.lenses.maps, ...vm.lenses.plays];
      assert.equal(allItems.length, 1);
      assert.equal(allItems[0]!.trust.label, "Unverified");
      assert.equal(allItems[0]!.trust.provenance_status, "unverified");
      assert.equal(allItems[0]!.review_state, "model_proposed_pending_human_review");
      assert.equal(vm.totals.verified_objects, 0);
      assert.equal(vm.rejected_proposals?.[0]?.graph_state, "not_written_to_durable_graph");

      const html = renderWorkshopHtml(vm, { previewMode: "validation" });
      assert.match(html, />Unverified<\/span>/);
      assert.match(html, new RegExp(WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT));
      assert.doesNotMatch(html, />Verified<\/span>/, "source_document_only durable state must not render as Verified");
      assert.match(html, /Rejected proposal — not written to durable graph/);
      assert.match(html, /not_written_to_durable_graph/);
      assert.match(html, /did not have enough public-source support/);
      assert.match(html, /No provider calls/);
      assert.match(html, /No production writes/);
    } finally {
      await cleanup();
    }
  });
});
