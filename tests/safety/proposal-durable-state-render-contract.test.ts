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
  DurableStateRenderRefusal,
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

  test("a compose-time Proxy-backed row is refused before its fields are read", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      // A forged reader result whose row is a Proxy. The compose boundary
      // must refuse it before reading any field — the traps must not fire
      // on a field access.
      const trapsObserved: string[] = [];
      const proxyRow = new Proxy(row as unknown as Record<string, unknown>, {
        get(target, p, recv) {
          trapsObserved.push(`get:${String(p)}`);
          return Reflect.get(target, p, recv);
        },
      });
      const forged = {
        ...readerResultWithRow(row),
        rows: [proxyRow as unknown as DurableGraphSnapshotRow],
      };
      assert.throws(
        () => composeDurableStateView({ readerResult: forged, decisionArtifact: null }),
        DurableStateRenderRefusal,
      );
      // The Proxy guard fires on isProxy, not on a field read.
      assert.ok(!trapsObserved.includes("get:bundle"), "row.bundle must not be read before the Proxy refusal");
    } finally {
      await cleanup();
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

describe("M3 step 3b safety — deep-freeze seals the validated bundle against post-read mutation", () => {
  test("a per-record provenance_status flip after the read cannot succeed and cannot render as upgraded trust", async () => {
    const { rootDir, cleanup } = await (async () => {
      const r = await setupDbAndWriteOneRow();
      return r;
    })();
    try {
      const reader = await readWorkshopPublicProposalDurableGraphSnapshots({ dbRootDir: rootDir, now: NOW });
      const row = reader.rows[0]!;
      // Every level of the validated bundle is frozen.
      assert.ok(Object.isFrozen(row.bundle));
      assert.ok(Object.isFrozen(row.bundle.account_objects));
      assert.ok(Object.isFrozen(row.bundle.account_objects[0]));
      const before = row.bundle.account_objects[0]!.provenance_status;
      // Attempt the post-read flip the reviewer demonstrated.
      try {
        (row.bundle.account_objects[0] as { provenance_status: string }).provenance_status = "verified";
      } catch {
        /* strict-mode throw is acceptable; non-strict silent no-op is also fine */
      }
      assert.equal(row.bundle.account_objects[0]!.provenance_status, before, "deep-freeze must prevent the flip");
      const html = renderDurableStateHtml(composeDurableStateView({ readerResult: reader, decisionArtifact: null }));
      assert.ok(!html.includes("trust-verified"), "render must not emit trust-verified after an attempted post-read flip");
    } finally {
      await cleanup();
    }
  });

  test("a FORGED reader result carrying a verified durable record is refused at compose, not rendered", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      // A forged result that never went through the reader's deep-freeze:
      // a plain, mutable row with a verified account object.
      const forgedRow = {
        ...row,
        bundle: {
          ...row.bundle,
          account_objects: row.bundle.account_objects.map((o) => ({ ...o, provenance_status: "verified" as const })),
        },
      } as unknown as DurableGraphSnapshotRow;
      const forged = { ...readerResultWithRow(row), rows: [forgedRow] };
      assert.throws(
        () => composeDurableStateView({ readerResult: forged, decisionArtifact: null }),
        DurableStateRenderRefusal,
        "compose must refuse a durable record marked verified",
      );
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3b safety — render-side decision-artifact validator refuses hostile/broadened input", () => {
  function emptyReader(): WorkshopProposalDurableSnapshotsReaderResult {
    return {
      source_path: "/tmp/x", checked_at: NOW, rows: [], refusals: [],
      provider_calls_made: 0, private_evidence_read: false, graph_ingestion_performed: false,
      durable_writes_performed: false, production_writes: false, readiness_claim: false,
    };
  }

  test("a getter/Proxy-backed decision record is refused BEFORE its fields are read; no rejection is rendered", () => {
    let getterFired = false;
    const hostile = {
      kind: "workshop-public-proposal-human-review-decision",
      schema_version: "atliera.workshop_public_proposal_human_review_decision.v1",
      decisions: [
        new Proxy({}, {
          get(_t, p) {
            getterFired = true;
            if (p === "decision") return "reject";
            return "obj_injected";
          },
        }),
      ],
      account_id: "acc_x",
    } as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: hostile });
    // The artifact-level validation refuses before the decisions array is
    // even reached (broadened/missing boundary markers), so the getter
    // never fires and nothing is rendered.
    const html = renderDurableStateHtml(view);
    assert.equal(getterFired, false, "decision-record getter must not fire");
    assert.equal(view.totals.rejected_decisions, 0);
    assert.ok(view.review_decision_refusals.length >= 1);
    assert.ok(!html.includes("obj_injected"));
  });

  test("a Proxy-backed decision ARTIFACT is refused before any field is read", () => {
    let getterFired = false;
    const proxyArtifact = new Proxy({}, {
      get() { getterFired = true; return undefined; },
    }) as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: proxyArtifact });
    assert.equal(getterFired, false);
    assert.equal(view.totals.rejected_decisions, 0);
    assert.ok(view.review_decision_refusals.length >= 1);
  });

  test("a Proxy-backed decisions ARRAY is refused", () => {
    const base = decisionArtifactWithReject();
    let arrayTrapFired = false;
    const proxyDecisions = new Proxy(base.decisions, {
      get(target, p, recv) {
        if (p === "length" || typeof p === "symbol" || !Number.isNaN(Number(p))) arrayTrapFired = true;
        return Reflect.get(target, p, recv);
      },
    });
    const hostile = { ...base, decisions: proxyDecisions } as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: hostile });
    assert.equal(view.totals.rejected_decisions, 0);
    assert.ok(view.review_decision_refusals.some((r) => r.includes("decisions is Proxy-backed")));
    assert.equal(arrayTrapFired, false, "decisions array elements must not be indexed after the Proxy refusal");
  });

  test("a broadened decision artifact (a closed boundary marker flipped true) renders ZERO rejections", () => {
    const base = decisionArtifactWithReject();
    const broadened = {
      ...base,
      boundaries: { ...base.boundaries, graph_ingestion_performed: true },
    } as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: broadened });
    assert.equal(view.totals.rejected_decisions, 0);
    assert.ok(view.review_decision_refusals.length >= 1);
  });

  test("a wrong-kind / wrong-schema decision artifact renders ZERO rejections", () => {
    const base = decisionArtifactWithReject();
    for (const mutated of [
      { ...base, kind: "not-the-decision-kind" },
      { ...base, schema_version: "atliera.some_other.v9" },
    ] as unknown as WorkshopProposalHumanReviewDecisionArtifact[]) {
      const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: mutated });
      assert.equal(view.totals.rejected_decisions, 0);
      assert.ok(view.review_decision_refusals.length >= 1);
    }
  });

  test("a reject decision that carries a non-null graph_candidate_ref or promotion_performed:true is omitted", () => {
    const base = decisionArtifactWithReject();
    const contradictory = {
      ...base,
      decisions: base.decisions.map((d) => ({
        ...d,
        graph_candidate_ref: {
          account_object_id: "obj_x",
          claim_ids: [],
          excerpt_ids: [],
          source_ids: [],
          candidate_only: true,
          graph_ingestion_performed: false,
          durable_graph_write_performed: false,
        },
      })),
    } as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: contradictory });
    assert.equal(view.totals.rejected_decisions, 0, "a rejection claiming a graph candidate is a contradiction and must be omitted");
    assert.ok(view.review_decision_refusals.some((r) => r.includes("graph_candidate_ref")));
  });

  test("a well-formed reject decision still renders normally after the validator", () => {
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: decisionArtifactWithReject() });
    assert.equal(view.totals.rejected_decisions, 1);
    assert.equal(view.review_decision_refusals.length, 0);
    const html = renderDurableStateHtml(view);
    assert.ok(html.includes("Not in graph"));
  });

  test("an accessor-backed INDEX on the decisions array (Array.isArray=true, not Proxy) is refused without firing the getter", () => {
    // This is the residual gap from the second review pass: a plain
    // (non-Proxy) array with an accessor-backed index "0" would have
    // passed the previous Array.isArray + isProxy gate and fired its
    // getter at `decisionsRaw[i]`. The descriptor-snapshot of the array
    // must refuse it without indexing.
    const validReject = decisionArtifactWithReject().decisions[0]!;
    let indexGetterFired = false;
    const arr: unknown[] = [null];
    Object.defineProperty(arr, "0", {
      enumerable: true,
      configurable: true,
      get() {
        indexGetterFired = true;
        return validReject;
      },
    });
    const hostile = {
      ...decisionArtifactWithReject(),
      decisions: arr,
    } as unknown as WorkshopProposalHumanReviewDecisionArtifact;
    const view = composeDurableStateView({ readerResult: emptyReader(), decisionArtifact: hostile });
    assert.equal(indexGetterFired, false, "decisions[0] getter must not fire");
    assert.equal(view.totals.rejected_decisions, 0, "no rejection may render from an accessor-backed index");
    assert.ok(
      view.review_decision_refusals.some((r) => r.includes("decisions[0]") && r.includes("accessors")),
      "the refusal must name the accessor-backed index",
    );
  });
});

describe("M3 step 3b safety — durable rows are descriptor-snapshotted at compose entry; nested getters never fire", () => {
  test("a forged reader result with a getter-backed nested account_object provenance_status is refused without invoking the getter", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      // Reconstruct an account_object without the provenance_status field
      // and reinstall it as an accessor; the field is the one the render
      // layer reads to decide trust, so its getter is the canary.
      let provenanceGetterFired = false;
      const badObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row.bundle.account_objects[0]!)) {
        if (k !== "provenance_status") badObj[k] = v;
      }
      Object.defineProperty(badObj, "provenance_status", {
        enumerable: true,
        configurable: true,
        get() {
          provenanceGetterFired = true;
          return "verified";
        },
      });
      const forged = {
        ...readerResultWithRow(row),
        rows: [
          {
            ...row,
            bundle: {
              ...row.bundle,
              account_objects: [badObj] as never,
            },
          } as DurableGraphSnapshotRow,
        ],
      };
      assert.throws(
        () => composeDurableStateView({ readerResult: forged, decisionArtifact: null }),
        DurableStateRenderRefusal,
        "compose must refuse a getter-backed account_object before its provenance is read",
      );
      assert.equal(
        provenanceGetterFired,
        false,
        "the hostile provenance_status getter must not have fired",
      );
    } finally {
      await cleanup();
    }
  });

  test("a forged reader result with a getter-backed inner ROW field (operator_identity) is refused without firing", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      let opGetterFired = false;
      const badRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k !== "operator_identity") badRow[k] = v;
      }
      Object.defineProperty(badRow, "operator_identity", {
        enumerable: true,
        configurable: true,
        get() {
          opGetterFired = true;
          return "attacker";
        },
      });
      const forged = {
        ...readerResultWithRow(row),
        rows: [badRow as unknown as DurableGraphSnapshotRow],
      };
      assert.throws(
        () => composeDurableStateView({ readerResult: forged, decisionArtifact: null }),
        DurableStateRenderRefusal,
      );
      assert.equal(opGetterFired, false);
    } finally {
      await cleanup();
    }
  });

  test("a forged reader result with an accessor-backed INDEX on bundle.account_objects is refused without firing", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const real = row.bundle.account_objects[0]!;
      let arrayIndexGetterFired = false;
      const accountObjects: unknown[] = [null];
      Object.defineProperty(accountObjects, "0", {
        enumerable: true,
        configurable: true,
        get() {
          arrayIndexGetterFired = true;
          return real;
        },
      });
      const forged = {
        ...readerResultWithRow(row),
        rows: [
          {
            ...row,
            bundle: {
              ...row.bundle,
              account_objects: accountObjects as never,
            },
          } as DurableGraphSnapshotRow,
        ],
      };
      assert.throws(
        () => composeDurableStateView({ readerResult: forged, decisionArtifact: null }),
        DurableStateRenderRefusal,
      );
      assert.equal(arrayIndexGetterFired, false);
    } finally {
      await cleanup();
    }
  });

  test("the legitimate reader path still composes a row cleanly after the new snapshot pass", async () => {
    const { row, cleanup } = await setupDbAndWriteOneRow();
    try {
      const reader = readerResultWithRow(row);
      const view = composeDurableStateView({ readerResult: reader, decisionArtifact: null });
      assert.equal(view.totals.durable_rows, 1);
      assert.ok(view.totals.durable_records >= 1);
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
