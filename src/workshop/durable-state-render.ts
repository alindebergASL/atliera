// Workshop public proposal — durable-state render composition (read-only).
//
// M3 step 3b. Composes the durable-graph-snapshots reader output with the
// human-review decision artifact into a static HTML page that renders, in
// two visibly distinct sections:
//
//   1. `durable-graph-records` — ratified records read from the durable
//      store. Each card carries the row's `trust_label` decoration and a
//      per-record `provenance_status` pill that reflects the actual
//      evidence backing (source_document_only for M3 admission).
//
//   2. `review-decisions` — review decisions that did NOT enter the
//      graph: explicit rejections from the human-review decision
//      artifact. These items carry no trust pill, no graph-record
//      framing, and are labeled "Not in graph". A reader inspecting the
//      rendered HTML should never conclude these decisions live in the
//      durable store.
//
// Scope guards (operator GO message, 2026-06-15):
//   A. The two sections must be VISIBLY DISTINCT in markup. Different
//      class names, different headers, no shared `trust-pill` / graph-
//      record framing on the rejection side.
//   B. Safety contract tests assert the negative invariants over the
//      rendered HTML: never displays Verified for a source_document_only
//      record; never renders a rejection with graph-record framing; the
//      reader refuses Proxy-backed rows before reflection.
//
// This module performs no I/O. The reader has already read the durable
// store; the renderer is a pure function over the typed reader result
// and the decision artifact.

import type { GraphBundle } from "../graph/types.ts";
import type { WorkshopProposalHumanReviewDecisionArtifact } from "./proposal-review-decision.ts";
import type { WorkshopProposalDurableSnapshotsReaderResult } from "./durable-graph-snapshots-reader.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_STATE_RENDER_NAME =
  "workshop-public-proposal-durable-state-render" as const;

// Visible decoration text for the row-level admission path. This is the
// trust_label decoration, not the per-record provenance pill.
const TRUST_LABEL_DECORATION =
  "Model-proposed · human-ratified · evidence pending" as const;

// Per-record provenance pill text. M3 records carry `source_document_only`.
// Any per-record `verified` would be refused at the reader boundary, so it
// never reaches the renderer; we still drive the label off the record value
// rather than hard-coding it.
const PROVENANCE_LABEL: Record<string, string> = {
  source_document_only: "Source-backed",
  unverified: "Unverified",
  stale: "Stale",
  unsupported: "Unsupported",
  // `verified` deliberately absent — never expected here under M3 trust tier.
};

export interface DurableGraphRecordCardView {
  readonly durable_record_id: string;
  readonly account_id: string;
  readonly candidate_item_id: string;
  readonly operator_identity: string;
  readonly mediation_gate_level: "L0";
  readonly written_at: string;
  readonly trust_label_decoration: string;
  readonly object_id: string;
  readonly object_type: string;
  readonly title: string;
  readonly summary: string;
  readonly provenance_status: string;
  readonly provenance_label: string;
}

export interface ReviewDecisionRejectionCardView {
  readonly item_id: string;
  readonly lens: string;
  readonly rationale: string;
  readonly reviewer_id: string;
  readonly reviewed_at: string;
  readonly is_not_durable_graph_state: true;
}

export interface DurableStateRenderView {
  readonly account_id: string | null;
  readonly checked_at: string;
  readonly source_path: string;
  readonly durable_graph_records: readonly DurableGraphRecordCardView[];
  readonly review_decision_rejections: readonly ReviewDecisionRejectionCardView[];
  readonly refusal_count: number;
  readonly totals: {
    readonly durable_rows: number;
    readonly durable_records: number;
    readonly rejected_decisions: number;
  };
}

export interface ComposeDurableStateViewInputs {
  readonly readerResult: WorkshopProposalDurableSnapshotsReaderResult;
  readonly decisionArtifact: WorkshopProposalHumanReviewDecisionArtifact | null;
}

function objectCardsFromBundle(
  bundle: GraphBundle,
  row: {
    readonly durable_record_id: string;
    readonly account_id: string;
    readonly candidate_item_id: string;
    readonly operator_identity: string;
    readonly written_at: string;
  },
): DurableGraphRecordCardView[] {
  return bundle.account_objects.map((obj) => {
    const provenance = obj.provenance_status;
    const provenanceLabel = PROVENANCE_LABEL[provenance] ?? provenance;
    return {
      durable_record_id: row.durable_record_id,
      account_id: row.account_id,
      candidate_item_id: row.candidate_item_id,
      operator_identity: row.operator_identity,
      mediation_gate_level: "L0" as const,
      written_at: row.written_at,
      trust_label_decoration: TRUST_LABEL_DECORATION,
      object_id: obj.id,
      object_type: obj.object_type,
      title: obj.title,
      summary: obj.summary,
      provenance_status: provenance,
      provenance_label: provenanceLabel,
    };
  });
}

export function composeDurableStateView(
  inputs: ComposeDurableStateViewInputs,
): DurableStateRenderView {
  const { readerResult, decisionArtifact } = inputs;

  const durableCards: DurableGraphRecordCardView[] = [];
  for (const row of readerResult.rows) {
    durableCards.push(...objectCardsFromBundle(row.bundle, row));
  }

  const rejectionCards: ReviewDecisionRejectionCardView[] = [];
  if (decisionArtifact !== null) {
    for (const decision of decisionArtifact.decisions) {
      if (decision.decision !== "reject") continue;
      rejectionCards.push({
        item_id: decision.item_id,
        lens: decision.lens,
        rationale: decision.rationale,
        reviewer_id: decision.reviewer_id,
        reviewed_at: decision.reviewed_at,
        is_not_durable_graph_state: true,
      });
    }
  }

  const accountId =
    readerResult.rows[0]?.account_id ?? decisionArtifact?.account_id ?? null;

  return Object.freeze({
    account_id: accountId,
    checked_at: readerResult.checked_at,
    source_path: readerResult.source_path,
    durable_graph_records: Object.freeze(durableCards) as readonly DurableGraphRecordCardView[],
    review_decision_rejections: Object.freeze(rejectionCards) as readonly ReviewDecisionRejectionCardView[],
    refusal_count: readerResult.refusals.length,
    totals: Object.freeze({
      durable_rows: readerResult.rows.length,
      durable_records: durableCards.length,
      rejected_decisions: rejectionCards.length,
    }),
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDurableRecordCard(card: DurableGraphRecordCardView): string {
  return `<article class="durable-graph-record-card" data-durable-record-id="${escapeHtml(card.durable_record_id)}" data-object-id="${escapeHtml(card.object_id)}">
        <div class="card-kicker">${escapeHtml(card.object_type)} · durable record</div>
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.summary)}</p>
        <div class="trust-row">
          <span class="trust-pill trust-${escapeHtml(card.provenance_status)}">${escapeHtml(card.provenance_label)}</span>
          <span class="trust-label-decoration">${escapeHtml(card.trust_label_decoration)}</span>
        </div>
        <dl class="durable-record-attribution">
          <dt>Durable record</dt><dd>${escapeHtml(card.durable_record_id)}</dd>
          <dt>Account</dt><dd>${escapeHtml(card.account_id)}</dd>
          <dt>Candidate</dt><dd>${escapeHtml(card.candidate_item_id)}</dd>
          <dt>Ratifier</dt><dd>${escapeHtml(card.operator_identity)}</dd>
          <dt>Mediation gate</dt><dd>${escapeHtml(card.mediation_gate_level)}</dd>
          <dt>Written at</dt><dd>${escapeHtml(card.written_at)}</dd>
        </dl>
      </article>`;
}

function renderRejectionCard(card: ReviewDecisionRejectionCardView): string {
  // No `trust-pill` class. No `durable-record-id`. No graph-record framing.
  // The card is explicitly labeled as a review decision that did NOT enter
  // the durable graph.
  return `<article class="review-decision-rejection-card" data-review-decision-item-id="${escapeHtml(card.item_id)}" data-not-in-durable-graph="true">
        <div class="rejection-kicker">Review decision · ${escapeHtml(card.lens)} lens</div>
        <h3>Rejected: ${escapeHtml(card.item_id)}</h3>
        <p class="rejection-rationale">${escapeHtml(card.rationale)}</p>
        <p class="not-in-graph-notice">Not in graph. This decision was recorded by the reviewer and the candidate was not promoted to the durable graph of record.</p>
        <dl class="review-decision-attribution">
          <dt>Reviewer</dt><dd>${escapeHtml(card.reviewer_id)}</dd>
          <dt>Reviewed at</dt><dd>${escapeHtml(card.reviewed_at)}</dd>
        </dl>
      </article>`;
}

export function renderDurableStateHtml(view: DurableStateRenderView): string {
  const accountLabel = view.account_id
    ? `Account ${escapeHtml(view.account_id)}`
    : "Account not set";

  const durableSection = view.durable_graph_records.length > 0
    ? view.durable_graph_records.map(renderDurableRecordCard).join("\n      ")
    : `<p class="empty-durable">No ratified records in the durable graph yet.</p>`;

  const rejectionSection = view.review_decision_rejections.length > 0
    ? view.review_decision_rejections.map(renderRejectionCard).join("\n      ")
    : `<p class="empty-rejections">No recorded rejections in the latest review.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atliera Workshop · Durable State</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #090b12; color: #edf2ff; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 40px 24px; }
    .hero { border: 1px solid #283044; border-radius: 24px; padding: 28px; background: linear-gradient(135deg, #121827, #0c1020); }
    .eyebrow { color: #99a7c7; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; }
    h1 { margin: 8px 0; font-size: 42px; }
    .boundary-row, .totals, .trust-row { display: flex; gap: 12px; flex-wrap: wrap; color: #aab6d3; }
    .boundary-row { margin-top: 14px; }
    .boundary-row span { border: 1px solid #39476a; border-radius: 999px; padding: 5px 10px; background: #111a2d; }
    .durable-graph-records, .review-decisions { border-radius: 20px; padding: 22px; margin-top: 22px; }
    .durable-graph-records { border: 1px solid #2c4d3c; background: #0e1a14; }
    .durable-graph-records > header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #1f3a2b; margin-bottom: 14px; }
    .review-decisions { border: 1px dashed #5c3a3a; background: #1a0e0e; }
    .review-decisions > header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed #5c3a3a; margin-bottom: 14px; }
    .durable-graph-record-card { border: 1px solid #2f4d3c; border-radius: 16px; padding: 14px; background: #102018; margin-bottom: 12px; }
    .review-decision-rejection-card { border: 1px dashed #6e4040; border-radius: 0; padding: 14px; background: #1a0e0e; margin-bottom: 12px; }
    .card-kicker { color: #93c8a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .rejection-kicker { color: #f4a4a4; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .trust-pill { border-radius: 999px; padding: 3px 9px; background: #26324e; color: #dbe7ff; }
    .trust-source_document_only { background: #1e3a5f; color: #dbeafe; }
    .trust-unverified { background: #4a3415; color: #fde68a; }
    .trust-stale { background: #43335f; color: #e9d5ff; }
    .trust-unsupported { background: #5c1d1d; color: #fee2e2; }
    .trust-label-decoration { color: #d4e9c1; font-size: 12px; border: 1px solid #2c4d3c; padding: 3px 9px; border-radius: 999px; background: #122418; }
    .not-in-graph-notice { color: #fda4af; font-weight: 600; border-left: 3px solid #fda4af; padding-left: 10px; margin: 10px 0; }
    .rejection-rationale { color: #fed7aa; }
    dl { margin: 8px 0 0; }
    dt { color: #93a4c8; font-size: 12px; }
    dd { margin: 0 0 6px; word-break: break-word; color: #edf2ff; }
    .empty-durable, .empty-rejections { color: #93a4c8; }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">Atliera · Workshop · Durable state</div>
      <h1>Atliera Workshop · Durable State</h1>
      <p>Read from the durable graph of record. M3 admission tier: model-proposed, human-ratified, evidence pending. Verification (per-record provenance flip) is reserved for M4 / M5b.</p>
      <div class="totals">
        <span>${view.totals.durable_rows} durable row${view.totals.durable_rows === 1 ? "" : "s"}</span>
        <span>${view.totals.durable_records} graph record${view.totals.durable_records === 1 ? "" : "s"}</span>
        <span>${view.totals.rejected_decisions} rejection${view.totals.rejected_decisions === 1 ? "" : "s"}</span>
      </div>
      <div class="boundary-row" aria-label="Render boundaries">
        <span>Static HTML render</span>
        <span>${escapeHtml(accountLabel)}</span>
        <span>No provider calls</span>
        <span>No production writes</span>
        <span>Read-only from durable store</span>
      </div>
    </section>

    <section class="durable-graph-records" aria-label="Ratified records in the durable graph">
      <header>
        <h2>Durable graph records</h2>
        <span>Ratified · in graph of record</span>
      </header>
      ${durableSection}
    </section>

    <section class="review-decisions" aria-label="Review decisions that did not enter the durable graph">
      <header>
        <h2>Review decisions · not in graph</h2>
        <span>Rejected at review · not promoted</span>
      </header>
      ${rejectionSection}
    </section>
  </main>
</body>
</html>`;
}
