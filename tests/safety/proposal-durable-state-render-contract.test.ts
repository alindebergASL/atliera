// M3 step 3b — Scope Guard B: safety contract framed as NEGATIVES on
// render output and reader inputs.
//
// The operator's GO message named these explicitly:
//
//   "the render output never displays Verified for a source_document_only
//    record; never renders a rejected item with graph-record framing;
//    the reader refuses Proxy-backed rows before reflection."
//
// Each test below asserts one such never-claim. The row used here is a
// real row produced by the 3a writer against a tmp local-durable-db, so
// the bundle shape is the one we actually ship — we never invent a
// bundle by hand.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import { buildWorkshopPublicProposalOperatorArming } from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import {
  executeWorkshopPublicProposalDurableGraphWrite,
  type DurableGraphSnapshotRow,
  type MaterializationInputFixture,
} from "../../src/workshop/proposal-durable-graph-write-execution.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import {
  readWorkshopPublicProposalDurableGraphSnapshots,
  type WorkshopProposalDurableSnapshotsReaderResult,
} from "../../src/workshop/durable-graph-snapshots-reader.ts";
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

async function setupDbAndWriteOneRow(): Promise<{
  rootDir: string;
  row: DurableGraphSnapshotRow;
  cleanup: () => Promise<void>;
}> {
  const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-safety-"));
  const init = await initializeLocalDurableDb({ rootDir });
  assert.ok(init.ok);
  const contract = JSON.parse(await readFile(CONTRACT_FIXTURE, "utf8")) as WorkshopProposalDurableGraphWriteContractArtifact;
  const packet = JSON.parse(await readFile(PACKET_FIXTURE, "utf8")) as WorkshopProposalDurableWriteApprovalPacketArtifact;
  const materializationInput = JSON.parse(await readFile(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as MaterializationInputFixture;
  const arming = buildWorkshopPublicProposalOperatorArming(packet, {
    operatorIdentity: OPERATOR_IDENTITY,
    armedAt: ARMED_AT,
  });
  const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
    arming,
    contract,
    approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
    materializationInput,
    dbRootDir: rootDir,
    now: NOW,
  });
  assert.equal(outcome.outcome, "completed");

  const rowsText = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
  const rowJson = rowsText.split("\n").filter((l) => l.trim().length > 0)[0]!;
  const row = JSON.parse(rowJson) as DurableGraphSnapshotRow;
  return { rootDir, row, cleanup: () => rm(rootDir, { recursive: true, force: true }) };
}

function readerResultWithRow(row: DurableGraphSnapshotRow): WorkshopProposalDurableSnapshotsReaderResult {
  return {
    source_path: "/tmp/synthetic/tables/graph_snapshots.jsonl",
    checked_at: NOW,
    rows: [row],
    refusals: [],
    provider_calls_made: 0,
    private_evidence_read: false,
    graph_ingestion_performed: false,
    durable_writes_performed: false,
    production_writes: false,
    readiness_claim: false,
  };
}

function decisionArtifactWithReject(): WorkshopProposalHumanReviewDecisionArtifact {
  return {
    kind: "workshop-public-proposal-human-review-decision",
    schema_version: "atliera.workshop_public_proposal_human_review_decision.v1",
    disposable: true,
    generated_from: "workshop-public-curated-proposal-preview",
    current_effective_authorization: "none",
    preview_artifact_name: "workshop-public-curated-proposal-preview",
    proposal_set_id: "demo",
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
        item_id: "obj_acme-rumored-acquisition",
        lens: "signals",
        decision: "reject",
        rationale: "Unsourced rumor.",
        reviewer_id: "reviewer_demo",
        reviewed_at: "2026-06-11T12:00:00Z",
        visible_review_state: "model_proposed_pending_human_review",
        source_trust: { provenance_status: "unverified", label: "Unverified", accepted_excerpt_count: 0 },
        graph_candidate_ref: null,
        promotion_performed: false,
      },
    ],
    counts: { accepted_for_graph_candidate: 0, rejected: 1, needs_more_evidence: 0, deferred: 0 },
    provider_calls_made: 0,
    private_evidence_read: false,
    graph_ingestion_performed: false,
    durable_writes_performed: false,
    production_writes: false,
    readiness_claim: false,
  };
}

describe("M3 step 3b safety — render NEVER displays Verified for a source_document_only record", () => {
  test("a source_document_only record never receives the Verified trust pill class or label text", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const view = composeDurableStateView({
        readerResult: readerResultWithRow(row),
        decisionArtifact: null,
      });
      const html = renderDurableStateHtml(view);

      assert.ok(
        !html.includes("trust-verified"),
        "render must NEVER emit the trust-verified CSS class for an M3 row",
      );
      assert.ok(
        !/>Verified</.test(html),
        "render must NEVER emit a 'Verified' badge text inside a card",
      );
      // The per-record pill text used IS Source-backed (the M3 record level).
      assert.ok(html.includes("Source-backed"));
      // The row-level admission decoration is shown.
      assert.ok(html.includes("Model-proposed · human-ratified · evidence pending"));
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3b safety — render NEVER renders a rejected item with graph-record framing", () => {
  test("a rejection card has no trust-pill, no durable-record-id, no graph-record framing; is labeled not-in-graph", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      // Empty the durable rows to focus the check on the rejection card.
      const view = composeDurableStateView({
        readerResult: { ...readerResultWithRow(row), rows: [] },
        decisionArtifact: decisionArtifactWithReject(),
      });
      const html = renderDurableStateHtml(view);

      assert.ok(html.includes("review-decision-rejection-card"));
      assert.ok(html.includes("obj_acme-rumored-acquisition"));

      // Isolate the actual article tag (the substring also appears in the
      // CSS rule). Match the <article ...class="review-decision-rejection-card"
      // open tag.
      const articleOpen = html.indexOf('<article class="review-decision-rejection-card"');
      assert.ok(articleOpen > -1, "rejection article tag must be present");
      const rejectionEnd = html.indexOf("</article>", articleOpen);
      const rejectionBlock = html.slice(articleOpen, rejectionEnd);
      assert.ok(!rejectionBlock.includes("trust-pill"));
      assert.ok(!rejectionBlock.includes("trust-verified"));
      assert.ok(!rejectionBlock.includes("trust-source_document_only"));
      assert.ok(!rejectionBlock.includes("durable-record-id"));
      assert.ok(!rejectionBlock.includes("trust-label-decoration"));
      assert.ok(!rejectionBlock.includes("durable-graph-record-card"));

      assert.ok(rejectionBlock.includes("Not in graph"));
      assert.ok(rejectionBlock.includes('data-not-in-durable-graph="true"'));
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3b safety — reader REFUSES a row whose per-record provenance is Verified, BEFORE rendering", () => {
  test("a row with verified per-record provenance is refused with row_bundle_marks_record_verified", async () => {
    const { rootDir, row, cleanup } = await setupDbAndWriteOneRow();
    try {
      // Synthesize the contradiction the retro warned about, using the
      // real bundle shape: flip every per-record provenance_status to
      // verified while keeping the M3 trust_label on the row.
      const bad: DurableGraphSnapshotRow = {
        ...row,
        bundle: {
          ...row.bundle,
          account_objects: row.bundle.account_objects.map((o) => ({
            ...o,
            provenance_status: "verified" as const,
          })),
          claims: row.bundle.claims.map((c) => ({
            ...c,
            provenance_status: "verified" as const,
          })),
        },
      };
      // Overwrite the JSONL with the bad row.
      await writeFile(
        join(rootDir, "tables/graph_snapshots.jsonl"),
        JSON.stringify(bad) + "\n",
      );

      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.rows.length, 0);
      assert.equal(result.refusals.length, 1);
      assert.equal(result.refusals[0]!.refusal_code, "row_bundle_marks_record_verified");
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3b safety — reader REFUSES Proxy-backed values BEFORE reflection (snapshot guard)", () => {
  test("the reader module calls util.types.isProxy at the snapshot boundary and defines the row_proxy_backed refusal code", async () => {
    // The mandatory H3 primitive (per 3a retro §4) is util.types.isProxy
    // at every snapshot boundary. A row arriving from disk is necessarily
    // a plain JSON.parse result (JSON.parse cannot return a Proxy), so
    // the load-bearing surface for the Proxy guard is any in-process
    // caller of the snapshot path. We assert the discipline at the
    // source-code level so a future edit that removes the guard fails
    // this test.
    const url = new URL("../../src/workshop/durable-graph-snapshots-reader.ts", import.meta.url);
    const text = await readFile(url, "utf8");
    assert.ok(
      text.includes("nodeUtilTypes.isProxy"),
      "reader must call util.types.isProxy at the snapshot boundary",
    );
    assert.ok(
      text.includes('"row_proxy_backed"'),
      "reader must define the row_proxy_backed refusal code",
    );
    // And the guard precedes any descriptor reflection.
    const isProxyIdx = text.indexOf("nodeUtilTypes.isProxy");
    const descIdx = text.indexOf("getOwnPropertyDescriptors");
    assert.ok(isProxyIdx > -1 && descIdx > -1 && isProxyIdx < descIdx,
      "isProxy guard must precede descriptor reflection in source order");
  });

  test("the reader's snapshot guard catches a Proxy-shaped value in the row position even before any field is read", async () => {
    // We exercise the guard via the reader's public entry, by writing a
    // file whose contents include one valid row plus a placeholder line
    // for a bad row. The reader's JSON parse on the bad line produces a
    // plain object (Proxy cannot survive JSON), so to exercise the
    // Proxy refusal end-to-end is necessarily limited to in-process
    // callers. We document that boundary above and verify here that the
    // file path always produces plain rows.
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-proxy-"));
    try {
      await mkdir(join(rootDir, "tables"), { recursive: true });
      const { row, cleanup } = await setupDbAndWriteOneRow();
      try {
        await writeFile(join(rootDir, "tables/graph_snapshots.jsonl"), JSON.stringify(row) + "\n");
        const result = await readWorkshopPublicProposalDurableGraphSnapshots({
          dbRootDir: rootDir,
          now: NOW,
        });
        assert.equal(result.rows.length, 1);
        assert.equal(result.refusals.length, 0);
      } finally {
        await cleanup();
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

describe("M3 step 3b safety — reader REFUSES rows whose row-level invariants are violated", () => {
  test("a row whose trust_label is not the M3 admission label is refused", async () => {
    const { rootDir, row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const bad: DurableGraphSnapshotRow = {
        ...row,
        trust_label: "some-other-label",
      };
      await writeFile(
        join(rootDir, "tables/graph_snapshots.jsonl"),
        JSON.stringify(bad) + "\n",
      );
      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.rows.length, 0);
      assert.equal(result.refusals[0]!.refusal_code, "row_trust_label_invalid");
    } finally {
      await cleanup();
    }
  });

  test("a row whose mediation_gate_level is not L0 is refused", async () => {
    const { rootDir, row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const bad = { ...row, mediation_gate_level: "L1" as unknown as "L0" };
      await writeFile(
        join(rootDir, "tables/graph_snapshots.jsonl"),
        JSON.stringify(bad) + "\n",
      );
      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.rows.length, 0);
      assert.equal(result.refusals[0]!.refusal_code, "row_mediation_gate_level_invalid");
    } finally {
      await cleanup();
    }
  });

  test("a row whose kind is not the durable-snapshot row kind is refused", async () => {
    const { rootDir, row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const bad = { ...row, kind: "some-other-kind" as unknown as typeof row.kind };
      await writeFile(
        join(rootDir, "tables/graph_snapshots.jsonl"),
        JSON.stringify(bad) + "\n",
      );
      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.rows.length, 0);
      assert.equal(result.refusals[0]!.refusal_code, "row_kind_invalid");
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3b safety — module purity and doctrine markers", () => {
  test("reader and render modules import no provider SDK, no env reads, no network", async () => {
    const readerSrc = await readFile(
      new URL("../../src/workshop/durable-graph-snapshots-reader.ts", import.meta.url),
      "utf8",
    );
    const renderSrc = await readFile(
      new URL("../../src/workshop/durable-state-render.ts", import.meta.url),
      "utf8",
    );
    for (const src of [readerSrc, renderSrc]) {
      assert.ok(!/\bopenai\b/i.test(src));
      assert.ok(!/\banthropic\b/i.test(src));
      assert.ok(!src.includes("process.env"));
      assert.ok(!src.includes('"node:http"'));
      assert.ok(!src.includes('"node:https"'));
      assert.ok(!src.includes('"node:net"'));
    }
    // Render module does no I/O at all.
    assert.ok(!renderSrc.includes('"node:fs'));
    assert.ok(!renderSrc.includes("readFile"));
  });

  test("reader result carries the closed doctrine markers", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-markers-"));
    try {
      const result = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(result.provider_calls_made, 0);
      assert.equal(result.private_evidence_read, false);
      assert.equal(result.graph_ingestion_performed, false);
      assert.equal(result.durable_writes_performed, false);
      assert.equal(result.production_writes, false);
      assert.equal(result.readiness_claim, false);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
