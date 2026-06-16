// M3 step 3b — end-to-end round trip + Scope Guard A (visible distinction).
//
// The decisive proof for 3b is round-trip: a real 3a write into a real
// tmp local-durable-db, read back by the 3b reader, composed with a
// decision artifact that includes a reject case, rendered to static HTML
// — and the rendered HTML shows the ratified record under its honest
// trust-tier decoration, alongside the rejected decision clearly marked
// as not-in-graph.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import {
  buildWorkshopPublicProposalOperatorArming,
} from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import {
  executeWorkshopPublicProposalDurableGraphWrite,
  type MaterializationInputFixture,
} from "../../src/workshop/proposal-durable-graph-write-execution.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import { readWorkshopPublicProposalDurableGraphSnapshots } from "../../src/workshop/durable-graph-snapshots-reader.ts";
import {
  composeDurableStateView,
  renderDurableStateHtml,
} from "../../src/workshop/durable-state-render.ts";
import type { WorkshopProposalHumanReviewDecisionArtifact } from "../../src/workshop/proposal-review-decision.ts";

const repoRoot = join(import.meta.dirname, "..", "..");
const CONTRACT_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json");
const PACKET_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json");
const MATERIALIZATION_INPUT_FIXTURE = join(repoRoot, "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json");

const OPERATOR_IDENTITY = "reviewer_demo";
const ARMED_AT = "2026-06-13T01:00:00Z";
const NOW = "2026-06-14T17:00:00Z";

async function setupDb() {
  const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-"));
  const report = await initializeLocalDurableDb({ rootDir });
  assert.ok(report.ok, `db init failed`);
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

async function writeOneRatifiedRowToFreshDb(rootDir: string): Promise<void> {
  const contract = await loadContract();
  const packet = await loadPacket();
  const arming = buildWorkshopPublicProposalOperatorArming(packet, {
    operatorIdentity: OPERATOR_IDENTITY,
    armedAt: ARMED_AT,
  });
  const materializationInput = await loadMaterializationInput();
  const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
    arming,
    contract,
    approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
    materializationInput,
    dbRootDir: rootDir,
    now: NOW,
  });
  assert.equal(outcome.outcome, "completed", `3a write failed: ${JSON.stringify(outcome, null, 2)}`);
}

function decisionArtifactWithRejection(): WorkshopProposalHumanReviewDecisionArtifact {
  // Demo artifact for 3b: the same accept that 3a ratified, plus a
  // synthetic reject case to prove the loop's discrimination.
  return {
    kind: "workshop-public-proposal-human-review-decision",
    schema_version: "atliera.workshop_public_proposal_human_review_decision.v1",
    disposable: true,
    generated_from: "workshop-public-curated-proposal-preview",
    current_effective_authorization: "none",
    preview_artifact_name: "workshop-public-curated-proposal-preview",
    proposal_set_id: "public-curated-20260611a",
    account_id: "acc_acme_robotics",
    reviewed_at: "2026-06-11T12:00:00Z",
    boundaries: {
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
    },
    decisions: [
      {
        item_id: "obj_acme-hub-signal",
        lens: "signals",
        decision: "accept_for_graph_candidate",
        rationale: "Visible preview is understandable and the cited public excerpts support this candidate.",
        reviewer_id: "reviewer_demo",
        reviewed_at: "2026-06-11T12:00:00Z",
        visible_review_state: "model_proposed_pending_human_review",
        source_trust: { provenance_status: "unverified", label: "Unverified", accepted_excerpt_count: 0 },
        graph_candidate_ref: {
          account_object_id: "obj_acme-hub-signal",
          claim_ids: ["clm_acme-hub-expansion"],
          excerpt_ids: ["exc_acme-hub-delivery"],
          source_ids: ["src_acme_press_public_001"],
          candidate_only: true,
          graph_ingestion_performed: false,
          durable_graph_write_performed: false,
        },
        promotion_performed: false,
      },
      {
        item_id: "obj_acme-rumored-acquisition",
        lens: "signals",
        decision: "reject",
        rationale: "Unsourced market rumor without supporting public excerpt. Not promotable to graph candidate.",
        reviewer_id: "reviewer_demo",
        reviewed_at: "2026-06-11T12:00:00Z",
        visible_review_state: "model_proposed_pending_human_review",
        source_trust: { provenance_status: "unverified", label: "Unverified", accepted_excerpt_count: 0 },
        graph_candidate_ref: null,
        promotion_performed: false,
      },
    ],
    counts: {
      accepted_for_graph_candidate: 1,
      rejected: 1,
      needs_more_evidence: 0,
      deferred: 0,
    },
    provider_calls_made: 0,
    private_evidence_read: false,
    graph_ingestion_performed: false,
    durable_writes_performed: false,
    production_writes: false,
    readiness_claim: false,
  };
}

describe("M3 step 3b — round trip: real 3a write → reader → render", () => {
  test("the loop closes end-to-end on a real local-durable-db", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      await writeOneRatifiedRowToFreshDb(rootDir);

      const readerResult = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });

      // Reader must yield exactly one row, no refusals.
      assert.equal(readerResult.rows.length, 1, `expected 1 row, got ${readerResult.rows.length}; refusals: ${JSON.stringify(readerResult.refusals)}`);
      assert.equal(readerResult.refusals.length, 0);
      assert.equal(readerResult.provider_calls_made, 0);
      assert.equal(readerResult.durable_writes_performed, false);
      assert.equal(readerResult.production_writes, false);

      const row = readerResult.rows[0]!;
      assert.equal(row.trust_label, "model-proposed-human-ratified-evidence-pending");
      assert.equal(row.mediation_gate_level, "L0");
      assert.equal(row.operator_identity, OPERATOR_IDENTITY);

      // Trust-tier discipline: no per-record `verified` survived the read.
      assert.ok(row.bundle.account_objects.every((o) => o.provenance_status !== "verified"));
      assert.ok(row.bundle.claims.every((c) => c.provenance_status !== "verified"));

      // Compose + render.
      const decisionArtifact = decisionArtifactWithRejection();
      const view = composeDurableStateView({ readerResult, decisionArtifact });

      assert.equal(view.totals.durable_rows, 1);
      assert.ok(view.totals.durable_records >= 1);
      assert.equal(view.totals.rejected_decisions, 1);
      assert.equal(view.account_id, "acc_acme_robotics");

      const html = renderDurableStateHtml(view);

      // Scope Guard A — visible markup distinction.
      assert.ok(
        html.includes('class="durable-graph-records"'),
        "render must include a visibly distinct durable-graph-records section",
      );
      assert.ok(
        html.includes('class="review-decisions"'),
        "render must include a visibly distinct review-decisions section",
      );
      // The two sections must be different classes — not a shared lens grid.
      assert.ok(!html.includes('class="lens-grid"'));
      assert.ok(!html.includes('class="lens-panel"'));
      // Rejection-side framing exists.
      assert.ok(html.includes("Not in graph"));
      assert.ok(html.includes("review-decision-rejection-card"));
      // The ratified record's per-record provenance label shows under the
      // M3 admission decoration, not Verified.
      assert.ok(html.includes("Model-proposed · human-ratified · evidence pending"));
      assert.ok(html.includes("durable-graph-record-card"));
    } finally {
      await cleanup();
    }
  });

  test("reader on an uninitialized DB refuses with durable_db_unreachable and yields zero rows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-empty-"));
    try {
      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.rows.length, 0);
      assert.equal(result.refusals.length, 1);
      assert.equal(result.refusals[0]!.refusal_code, "durable_db_unreachable");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
