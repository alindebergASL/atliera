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

import { types as nodeUtilTypes } from "node:util";

import {
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  type WorkshopProposalHumanReviewDecisionArtifact,
} from "./proposal-review-decision.ts";
import type { WorkshopProposalDurableSnapshotsReaderResult } from "./durable-graph-snapshots-reader.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_STATE_RENDER_NAME =
  "workshop-public-proposal-durable-state-render" as const;

// Sentinel thrown by the composer when a durable record would render under
// a trust tier the M3 contract forbids. This is a fail-closed guard for
// forged or post-read-mutated reader results that bypass the reader's
// own verified-refusal + deep-freeze; the render layer must never emit a
// Verified-tier durable card.
export class DurableStateRenderRefusal extends Error {
  constructor(public readonly reason: string) {
    super(`durable-state render refused: ${reason}`);
    this.name = "DurableStateRenderRefusal";
  }
}

// snapshotPlainOwnData: the same descriptor-snapshot + util.types.isProxy
// discipline the reader and the 3a executor use, applied here to the
// human-review decision artifact — an external/untrusted input that the
// render layer would otherwise read field-by-field with no validation.
// This is the THIRD call site for the discipline (executor, reader, and
// now the render-side decision validator); the consolidated H3 primitive
// will absorb all three when the H-track freeze lifts.
function snapshotPlainOwnData(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (nodeUtilTypes.isProxy(value)) {
    throw new DurableStateRenderRefusal(`${label} is Proxy-backed`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DurableStateRenderRefusal(`${label} must be a plain own-data object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new DurableStateRenderRefusal(`${label} must not carry symbol keys`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new DurableStateRenderRefusal(`${label} contains unsafe key ${key}`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new DurableStateRenderRefusal(`${label}.${key} must be a plain own-data value (no accessors)`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

// snapshotPlainArray: descriptor-snapshot an array so accessor-backed
// indices (a non-Proxy array with a getter installed on "0", "1", etc.)
// are refused without firing. Array.isArray + isProxy is not enough —
// a plain array literal can still have getter-backed indices.
function snapshotPlainArray(value: unknown, label: string): readonly unknown[] {
  if (nodeUtilTypes.isProxy(value)) {
    throw new DurableStateRenderRefusal(`${label} is Proxy-backed`);
  }
  if (!Array.isArray(value)) {
    throw new DurableStateRenderRefusal(`${label} must be an array`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new DurableStateRenderRefusal(`${label} must not carry symbol keys`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor !== undefined && "value" in lengthDescriptor
    ? (lengthDescriptor.value as unknown)
    : undefined;
  if (typeof length !== "number" || !Number.isInteger(length) || length < 0) {
    throw new DurableStateRenderRefusal(`${label}.length must be a non-negative integer`);
  }
  const out: unknown[] = new Array(length);
  for (let i = 0; i < length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, i);
    if (descriptor === undefined) {
      throw new DurableStateRenderRefusal(`${label}[${i}] is missing`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new DurableStateRenderRefusal(`${label}[${i}] must be a plain own-data value (no accessors)`);
    }
    out[i] = descriptor.value;
  }
  return Object.freeze(out);
}

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
  // Human-review decision artifact inputs that the render-side validator
  // refused (Proxy/accessor-backed, broadened boundary markers, malformed
  // reject-record invariants). Refused inputs render NO rejection card.
  readonly review_decision_refusals: readonly string[];
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

function durableCardsFromSnapshottedRow(rowIndex: number, rawRow: unknown): DurableGraphRecordCardView[] {
  // Descriptor-snapshot the row at the compose boundary so a getter
  // installed on any control-flow or attribution field cannot fire when
  // we read it. The reader's deep-freeze on the legitimate path makes
  // this redundant, but a FORGED reader result can carry getter-backed
  // fields the reader never saw; the render layer must not trust the
  // shape it received.
  const row = snapshotPlainOwnData(rawRow, `readerResult.rows[${rowIndex}]`);
  const durableRecordId = row.durable_record_id as string;
  const accountId = row.account_id as string;
  const candidateItemId = row.candidate_item_id as string;
  const operatorIdentity = row.operator_identity as string;
  const writtenAt = row.written_at as string;

  const bundle = snapshotPlainOwnData(row.bundle, `readerResult.rows[${rowIndex}].bundle`);
  const accountObjects = snapshotPlainArray(bundle.account_objects, `readerResult.rows[${rowIndex}].bundle.account_objects`);

  const cards: DurableGraphRecordCardView[] = [];
  for (let i = 0; i < accountObjects.length; i += 1) {
    const obj = snapshotPlainOwnData(accountObjects[i], `readerResult.rows[${rowIndex}].bundle.account_objects[${i}]`);
    const provenance = obj.provenance_status;
    if (typeof provenance !== "string") {
      throw new DurableStateRenderRefusal(
        `readerResult.rows[${rowIndex}].bundle.account_objects[${i}].provenance_status must be a string`,
      );
    }
    // Fail-closed re-assertion of the trust-tier invariant at the render
    // boundary. The reader already refuses verified per-record provenance
    // and deep-freezes the bundle, but a forged reader result (one that
    // never went through the reader) could still carry a verified record.
    // The render layer must never emit a Verified-tier durable card.
    if (provenance === "verified") {
      throw new DurableStateRenderRefusal(
        `durable record ${String(obj.id)} carries per-record provenance_status "verified" under the M3 admission trust label`,
      );
    }
    const provenanceLabel = PROVENANCE_LABEL[provenance] ?? provenance;
    cards.push({
      durable_record_id: durableRecordId,
      account_id: accountId,
      candidate_item_id: candidateItemId,
      operator_identity: operatorIdentity,
      mediation_gate_level: "L0" as const,
      written_at: writtenAt,
      trust_label_decoration: TRUST_LABEL_DECORATION,
      object_id: String(obj.id ?? ""),
      object_type: String(obj.object_type ?? ""),
      title: String(obj.title ?? ""),
      summary: String(obj.summary ?? ""),
      provenance_status: provenance,
      provenance_label: provenanceLabel,
    });
  }
  return cards;
}

function requireNonEmptyString(record: Readonly<Record<string, unknown>>, key: string, label: string): string {
  const v = record[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new DurableStateRenderRefusal(`${label}.${key} must be a non-empty string`);
  }
  return v;
}

function requireClosedFalse(record: Readonly<Record<string, unknown>>, key: string, label: string): void {
  if (record[key] !== false) {
    throw new DurableStateRenderRefusal(`${label}.${key} must be closed (false)`);
  }
}

// validateDecisionArtifactForRender: snapshot + revalidate the decision
// artifact at the render trust boundary before any field is rendered.
// Returns the rejection cards that passed validation plus a list of
// refusal reasons for inputs that did not. The artifact is external/
// untrusted; the render layer must not read it field-by-field without
// first proving it is plain own-data and carries closed boundary markers.
function validateDecisionArtifactForRender(
  artifact: WorkshopProposalHumanReviewDecisionArtifact | null,
): { rejections: ReviewDecisionRejectionCardView[]; refusals: string[]; accountId: string | null } {
  if (artifact === null) {
    return { rejections: [], refusals: [], accountId: null };
  }

  const refusals: string[] = [];
  let snap: Readonly<Record<string, unknown>>;
  try {
    snap = snapshotPlainOwnData(artifact, "decision_artifact");
  } catch (e) {
    return {
      rejections: [],
      refusals: [e instanceof DurableStateRenderRefusal ? e.reason : String(e)],
      accountId: null,
    };
  }

  // Artifact-level validation. A failure here refuses the WHOLE artifact:
  // a broadened or wrong-kind artifact renders zero rejections.
  try {
    if (snap.kind !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME) {
      throw new DurableStateRenderRefusal("decision_artifact.kind is not the human-review decision kind");
    }
    if (snap.schema_version !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION) {
      throw new DurableStateRenderRefusal("decision_artifact.schema_version is unexpected");
    }
    if (snap.current_effective_authorization !== "none") {
      throw new DurableStateRenderRefusal("decision_artifact.current_effective_authorization must be none");
    }
    // Top-level closed boundary markers — a review decision authorizes
    // nothing and performs nothing; any broadening refuses the artifact.
    for (const key of [
      "private_evidence_read",
      "graph_ingestion_performed",
      "durable_writes_performed",
      "production_writes",
      "readiness_claim",
    ]) {
      requireClosedFalse(snap, key, "decision_artifact");
    }
    if (snap.provider_calls_made !== 0) {
      throw new DurableStateRenderRefusal("decision_artifact.provider_calls_made must be 0");
    }
    // Boundaries object closed markers.
    const boundaries = snapshotPlainOwnData(snap.boundaries, "decision_artifact.boundaries");
    if (boundaries.current_effective_authorization !== "none") {
      throw new DurableStateRenderRefusal("decision_artifact.boundaries.current_effective_authorization must be none");
    }
    for (const key of [
      "authorizes_provider_call",
      "authorizes_private_evidence_read",
      "authorizes_graph_ingestion",
      "graph_ingestion_performed",
      "private_evidence_read",
      "durable_writes_performed",
      "production_writes",
      "readiness_claim",
      "authorizes_reviewed_candidate_durable_write",
      "reviewed_candidate_durable_write_performed",
      "ratification_performed",
    ]) {
      requireClosedFalse(boundaries, key, "decision_artifact.boundaries");
    }
    if (boundaries.provider_calls_executed !== 0) {
      throw new DurableStateRenderRefusal("decision_artifact.boundaries.provider_calls_executed must be 0");
    }
  } catch (e) {
    return {
      rejections: [],
      refusals: [e instanceof DurableStateRenderRefusal ? e.reason : String(e)],
      accountId: null,
    };
  }

  const accountId = typeof snap.account_id === "string" && snap.account_id.length > 0 ? snap.account_id : null;

  // Decisions array. Snapshot the array itself so an accessor-backed
  // index (a non-Proxy array with a getter installed on "0") cannot fire
  // when we index it.
  let decisions: readonly unknown[];
  try {
    decisions = snapshotPlainArray(snap.decisions, "decision_artifact.decisions");
  } catch (e) {
    return {
      rejections: [],
      refusals: [e instanceof DurableStateRenderRefusal ? e.reason : String(e)],
      accountId,
    };
  }

  const rejections: ReviewDecisionRejectionCardView[] = [];
  for (let i = 0; i < decisions.length; i += 1) {
    let decision: Readonly<Record<string, unknown>>;
    try {
      decision = snapshotPlainOwnData(decisions[i], `decision_artifact.decisions[${i}]`);
    } catch (e) {
      refusals.push(e instanceof DurableStateRenderRefusal ? e.reason : String(e));
      continue;
    }

    // Only reject decisions render a card. Non-reject decisions are not
    // rendered at all and need no further validation.
    if (decision.decision !== "reject") continue;

    try {
      // Reject-record invariants: a rejection must NOT carry graph
      // candidate state and must not be promoted. Its source trust must
      // be the pending/unverified tier — a rejection that claimed a
      // graph candidate or a verified source would be a contradiction.
      if (decision.graph_candidate_ref !== null) {
        throw new DurableStateRenderRefusal(`decision_artifact.decisions[${i}] is a reject but carries a non-null graph_candidate_ref`);
      }
      if (decision.promotion_performed !== false) {
        throw new DurableStateRenderRefusal(`decision_artifact.decisions[${i}] is a reject but promotion_performed is not false`);
      }
      const sourceTrust = snapshotPlainOwnData(decision.source_trust, `decision_artifact.decisions[${i}].source_trust`);
      if (sourceTrust.provenance_status === "verified") {
        throw new DurableStateRenderRefusal(`decision_artifact.decisions[${i}].source_trust is verified, which a rejection may not claim`);
      }
      const itemId = requireNonEmptyString(decision, "item_id", `decision_artifact.decisions[${i}]`);
      const lens = requireNonEmptyString(decision, "lens", `decision_artifact.decisions[${i}]`);
      const rationale = requireNonEmptyString(decision, "rationale", `decision_artifact.decisions[${i}]`);
      const reviewerId = requireNonEmptyString(decision, "reviewer_id", `decision_artifact.decisions[${i}]`);
      const reviewedAt = requireNonEmptyString(decision, "reviewed_at", `decision_artifact.decisions[${i}]`);
      rejections.push({
        item_id: itemId,
        lens,
        rationale,
        reviewer_id: reviewerId,
        reviewed_at: reviewedAt,
        is_not_durable_graph_state: true,
      });
    } catch (e) {
      refusals.push(e instanceof DurableStateRenderRefusal ? e.reason : String(e));
    }
  }

  return { rejections, refusals, accountId };
}

export function composeDurableStateView(
  inputs: ComposeDurableStateViewInputs,
): DurableStateRenderView {
  const { readerResult, decisionArtifact } = inputs;

  // Snapshot the root readerResult object first. The reader returns a
  // frozen plain-own-data result on the legitimate path; a FORGED reader
  // result could install a getter on `rows`, `checked_at`, `source_path`,
  // or `refusals` and fire it on first read. The render boundary reads
  // every field from the snapshot, never from the input.
  const readerSnap = snapshotPlainOwnData(readerResult, "readerResult");

  // Snapshot the rows array (refuse a Proxy-backed or accessor-backed
  // rows array) before iterating, then descriptor-snapshot each row +
  // its bundle + its account_objects inside the per-row helper.
  const rows = snapshotPlainArray(readerSnap.rows, "readerResult.rows");
  const refusals = snapshotPlainArray(readerSnap.refusals, "readerResult.refusals");
  const checkedAt = typeof readerSnap.checked_at === "string" ? readerSnap.checked_at : "";
  const sourcePath = typeof readerSnap.source_path === "string" ? readerSnap.source_path : "";

  const durableCards: DurableGraphRecordCardView[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    durableCards.push(...durableCardsFromSnapshottedRow(i, rows[i]));
  }

  const decisionValidation = validateDecisionArtifactForRender(decisionArtifact);
  const rejectionCards = decisionValidation.rejections;

  const firstRowAccountId =
    rows.length > 0 && rows[0] !== null && typeof rows[0] === "object"
      ? (rows[0] as { account_id?: unknown }).account_id
      : undefined;
  const accountId =
    (typeof firstRowAccountId === "string" && firstRowAccountId.length > 0 ? firstRowAccountId : null)
    ?? decisionValidation.accountId
    ?? null;

  return Object.freeze({
    account_id: accountId,
    checked_at: checkedAt,
    source_path: sourcePath,
    durable_graph_records: Object.freeze(durableCards) as readonly DurableGraphRecordCardView[],
    review_decision_rejections: Object.freeze(rejectionCards) as readonly ReviewDecisionRejectionCardView[],
    refusal_count: refusals.length,
    review_decision_refusals: Object.freeze(decisionValidation.refusals) as readonly string[],
    totals: Object.freeze({
      durable_rows: rows.length,
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

  const refusalNotice = view.review_decision_refusals.length > 0
    ? `<p class="decision-refusal-notice">${view.review_decision_refusals.length} review-decision input${view.review_decision_refusals.length === 1 ? " was" : "s were"} refused by the render-side validator and not displayed.</p>`
    : "";

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
    .decision-refusal-notice { color: #fca5a5; font-style: italic; margin: 0 0 12px; }
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
      ${refusalNotice}${rejectionSection}
    </section>
  </main>
</body>
</html>`;
}
