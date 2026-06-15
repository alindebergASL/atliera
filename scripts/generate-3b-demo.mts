// Regenerate the M3 step 3b demo HTML fixture from a REAL 3a write.
//
// Provenance discipline (operator GO 2026-06-15): the committed
// rendered HTML at fixtures/workshop/workshop-public-proposal-durable-
// state-render-demo.html must come from an actual 3a write through a
// real local-durable-db — not a hand-authored snippet. This script
// exists so any reviewer can regenerate the fixture and confirm the
// provenance: tmp DB → 3a writes → 3b reader reads → render composes
// → static HTML committed. The output is deterministic for a fixed
// `now` and operator identity.
//
// Run: `npx tsx scripts/generate-3b-demo.mts`

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeLocalDurableDb } from "../src/db/local-durable-db.ts";
import { buildWorkshopPublicProposalOperatorArming } from "../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import { executeWorkshopPublicProposalDurableGraphWrite } from "../src/workshop/proposal-durable-graph-write-execution.ts";
import { readWorkshopPublicProposalDurableGraphSnapshots } from "../src/workshop/durable-graph-snapshots-reader.ts";
import {
  composeDurableStateView,
  renderDurableStateHtml,
} from "../src/workshop/durable-state-render.ts";

const repo = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const NOW = "2026-06-15T18:00:00Z";
const ARMED_AT = "2026-06-13T01:00:00Z";
const OPERATOR_IDENTITY = "reviewer_demo";

const rootDir = await mkdtemp(join(tmpdir(), "atliera-3b-demo-"));
try {
  await initializeLocalDurableDb({ rootDir });
  const contract = JSON.parse(
    await readFile(`${repo}/fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json`, "utf8"),
  );
  const packet = JSON.parse(
    await readFile(`${repo}/fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json`, "utf8"),
  );
  const materializationInput = JSON.parse(
    await readFile(`${repo}/fixtures/validation/proposal-materialization-public-curated-20260611a-input.json`, "utf8"),
  );
  const arming = buildWorkshopPublicProposalOperatorArming(packet, {
    operatorIdentity: OPERATOR_IDENTITY,
    armedAt: ARMED_AT,
  });
  const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
    arming,
    contract,
    approvalPacket: {
      approval_id: packet.approval_id,
      contract_artifact_id: packet.contract_artifact_id,
    },
    materializationInput,
    dbRootDir: rootDir,
    now: NOW,
  });
  if (outcome.outcome !== "completed") {
    throw new Error("3a write failed: " + JSON.stringify(outcome));
  }

  const reader = await readWorkshopPublicProposalDurableGraphSnapshots({
    dbRootDir: rootDir,
    now: NOW,
  });

  // Reject case is synthetic-but-shaped-like-real: a market rumor item
  // the reviewer chose not to promote. Its purpose in 3b is to prove
  // the loop's discrimination, not to invent durable graph state.
  const decision = {
    kind: "workshop-public-proposal-human-review-decision" as const,
    schema_version: "atliera.workshop_public_proposal_human_review_decision.v1" as const,
    disposable: true as const,
    generated_from: "workshop-public-curated-proposal-preview" as const,
    current_effective_authorization: "none" as const,
    preview_artifact_name: "workshop-public-curated-proposal-preview" as const,
    proposal_set_id: "public-curated-20260611a",
    account_id: "acc_acme_robotics",
    reviewed_at: "2026-06-11T12:00:00Z",
    boundaries: {
      current_effective_authorization: "none" as const,
      authorizes_provider_call: false as const,
      authorizes_private_evidence_read: false as const,
      authorizes_graph_ingestion: false as const,
      graph_ingestion_performed: false as const,
      provider_calls_executed: 0 as const,
      private_evidence_read: false as const,
      durable_writes_performed: false as const,
      production_writes: false as const,
      readiness_claim: false as const,
      authorizes_reviewed_candidate_durable_write: false as const,
      reviewed_candidate_durable_write_performed: false as const,
      ratification_performed: false as const,
    },
    decisions: [
      {
        item_id: "obj_acme-hub-signal",
        lens: "signals" as const,
        decision: "accept_for_graph_candidate" as const,
        rationale: "Visible preview is understandable and the cited public excerpts support this candidate.",
        reviewer_id: "reviewer_demo",
        reviewed_at: "2026-06-11T12:00:00Z",
        visible_review_state: "model_proposed_pending_human_review" as const,
        source_trust: { provenance_status: "unverified" as const, label: "Unverified" as const, accepted_excerpt_count: 0 as const },
        graph_candidate_ref: {
          account_object_id: "obj_acme-hub-signal",
          claim_ids: ["clm_acme-hub-expansion"],
          excerpt_ids: ["exc_acme-hub-delivery"],
          source_ids: ["src_acme_press_public_001"],
          candidate_only: true as const,
          graph_ingestion_performed: false as const,
          durable_graph_write_performed: false as const,
        },
        promotion_performed: false as const,
      },
      {
        item_id: "obj_acme-rumored-acquisition",
        lens: "signals" as const,
        decision: "reject" as const,
        rationale: "Unsourced market rumor without supporting public excerpt. Not promotable to graph candidate.",
        reviewer_id: "reviewer_demo",
        reviewed_at: "2026-06-11T12:00:00Z",
        visible_review_state: "model_proposed_pending_human_review" as const,
        source_trust: { provenance_status: "unverified" as const, label: "Unverified" as const, accepted_excerpt_count: 0 as const },
        graph_candidate_ref: null,
        promotion_performed: false as const,
      },
    ],
    counts: { accepted_for_graph_candidate: 1, rejected: 1, needs_more_evidence: 0, deferred: 0 },
    provider_calls_made: 0 as const,
    private_evidence_read: false as const,
    graph_ingestion_performed: false as const,
    durable_writes_performed: false as const,
    production_writes: false as const,
    readiness_claim: false as const,
  };

  const view = composeDurableStateView({ readerResult: reader, decisionArtifact: decision });
  const html = renderDurableStateHtml(view);
  await writeFile(
    `${repo}/fixtures/workshop/workshop-public-proposal-durable-state-render-demo.html`,
    html,
  );
  console.log(
    `regenerated demo: rows=${reader.rows.length} records=${view.totals.durable_records} rejections=${view.totals.rejected_decisions}`,
  );
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
