import { types as nodeUtilTypes } from "node:util";

import {
  canonicalJson,
  deepFreezeOwnData,
  sha256CanonicalJson,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  hydrateCandidateDelta,
  hydrateCandidateTransition,
  type CandidateTransition,
} from "../graph/candidate-delta.ts";
import {
  DisposableSqliteSubjectGraphRevisionTransaction,
  type DisposableSqliteSubjectGraphRevisionTransactionOptions,
} from "../graph/disposable-sqlite-subject-graph-revision-transaction.ts";
import {
  hydrateSubjectGraphRevisionIntent,
  type SubjectGraphRevisionIntent,
} from "../graph/subject-graph-revision-intent.ts";
import {
  createDisposableSqliteSubjectGraphRevisionLabPermit,
  type SubjectGraphRevisionReadResult,
  type SubjectGraphRevisionSuccessReceipt,
  type SubjectGraphRevisionTransactionResult,
  type TransactionGraphIdentity,
} from "../graph/subject-graph-revision-transaction.ts";
import { hydrateProposalEnvelope } from "../validation/proposal-envelope.ts";
import {
  buildWorkshopViewModel,
  type WorkshopLensItemViewModel,
  type WorkshopViewModel,
} from "./view-model.ts";

export type SyntheticTransactionWorkshopState =
  | "committed"
  | "already committed"
  | "conflicted"
  | "refused";

export interface SyntheticTransactionWorkshopProjection {
  readonly transaction_state: SyntheticTransactionWorkshopState;
  readonly current_state_source: "verified_fresh_disposable_sqlite_readback";
  readonly view_model: WorkshopViewModel;
  readonly html: string;
}

export interface SyntheticTransactionWorkshopProof {
  readonly kind: "synthetic-transaction-workshop-proof";
  readonly transaction: SubjectGraphRevisionTransactionResult;
  readonly readback: SubjectGraphRevisionReadResult;
  readonly workshop: SyntheticTransactionWorkshopProjection | null;
  readonly provider_calls_performed: 0;
  readonly network_operations_performed: 0;
  readonly production_effects_performed: 0;
}

export interface ExecuteSyntheticTransactionWorkshopProofInput {
  readonly envelope: unknown;
  readonly delta: unknown;
  readonly transition: unknown;
  readonly application_options: unknown;
  readonly intent: unknown;
  readonly database: DisposableSqliteSubjectGraphRevisionTransactionOptions;
}

interface ProjectionAttemptContext {
  readonly transition: CandidateTransition;
  readonly intent: SubjectGraphRevisionIntent;
}

const PROOF_INPUT_KEYS = [
  "envelope",
  "delta",
  "transition",
  "application_options",
  "intent",
  "database",
] as const;
const PROOF_DATABASE_REQUIRED_KEYS = [
  "database_path",
  "isolated_temporary_directory",
] as const;
const PROOF_DATABASE_OPTIONAL_KEY = "test_only_fault_plan" as const;

function invalidProofInput(): never {
  throw new TypeError("Invalid synthetic transaction Workshop proof input");
}

function snapshotExactOwnDataObject<K extends string>(
  raw: unknown,
  exactKeys: readonly K[],
): Readonly<Record<K, unknown>> {
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    nodeUtilTypes.isProxy(raw)
  ) {
    return invalidProofInput();
  }
  const prototype = Object.getPrototypeOf(raw);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) {
    return invalidProofInput();
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const actualKeys = Object.keys(descriptors).sort();
  const expectedKeys = [...exactKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return invalidProofInput();
  }
  const snapshot = Object.create(null) as Record<K, unknown>;
  for (const key of exactKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      return invalidProofInput();
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotProofInput(
  raw: unknown,
): Readonly<Record<(typeof PROOF_INPUT_KEYS)[number], unknown>> {
  return snapshotExactOwnDataObject(raw, PROOF_INPUT_KEYS);
}

function snapshotProofDatabase(
  raw: unknown,
): DisposableSqliteSubjectGraphRevisionTransactionOptions {
  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw) ||
    nodeUtilTypes.isProxy(raw)
  ) {
    return invalidProofInput();
  }
  const prototype = Object.getPrototypeOf(raw);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.getOwnPropertySymbols(raw).length !== 0
  ) {
    return invalidProofInput();
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  const exactKeys = [
    ...PROOF_DATABASE_REQUIRED_KEYS,
    ...(Object.hasOwn(descriptors, PROOF_DATABASE_OPTIONAL_KEY)
      ? [PROOF_DATABASE_OPTIONAL_KEY]
      : []),
  ] as const;
  const actualKeys = Object.keys(descriptors).sort();
  const expectedKeys = [...exactKeys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return invalidProofInput();
  }
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of exactKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      return invalidProofInput();
    }
    snapshot[key] = descriptor.value;
  }
  Object.freeze(snapshot);
  if (
    typeof snapshot.database_path !== "string" ||
    typeof snapshot.isolated_temporary_directory !== "string"
  ) {
    return invalidProofInput();
  }
  return Object.freeze({
    database_path: snapshot.database_path,
    isolated_temporary_directory: snapshot.isolated_temporary_directory,
    ...(Object.hasOwn(snapshot, PROOF_DATABASE_OPTIONAL_KEY)
      ? {
          test_only_fault_plan: snapshot.test_only_fault_plan as
            DisposableSqliteSubjectGraphRevisionTransactionOptions["test_only_fault_plan"],
        }
      : {}),
  });
}

function sameGraphIdentity(
  left: TransactionGraphIdentity,
  right: TransactionGraphIdentity,
): boolean {
  return left.team_id === right.team_id &&
    left.account_id === right.account_id &&
    left.subject_id === right.subject_id &&
    left.purpose === right.purpose;
}

function expectedCommittedRevision(intent: SubjectGraphRevisionIntent): string {
  const prior = intent.predecessor_basis.expected_prior_revision;
  if (prior === null) return "rev_1";
  const priorNumber = Number(prior.slice("rev_".length));
  if (
    !Number.isSafeInteger(priorNumber) ||
    priorNumber >= Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("synthetic Workshop attempt context is invalid");
  }
  return `rev_${priorNumber + 1}`;
}

function receiptDigestMatches(
  receipt: SubjectGraphRevisionSuccessReceipt,
): boolean {
  const { receipt_sha256: _receiptSha256, ...core } = receipt;
  return sha256CanonicalJson(core as unknown as StrictJsonValue) ===
    receipt.receipt_sha256;
}

function attemptBindsToReceipt(
  result: Extract<
    SubjectGraphRevisionTransactionResult,
    { outcome: "committed" | "already_committed" }
  >,
  context: ProjectionAttemptContext,
): boolean {
  const { intent, transition } = context;
  const { receipt } = result;
  const transitionIntentLinked =
    intent.transition_sha256 === transition.transition_sha256 &&
    intent.delta_sha256 === transition.delta.delta_sha256 &&
    intent.proposed_snapshot_sha256 === transition.candidate_sha256 &&
    intent.replay_key_to_record === transition.replay_key_to_record &&
    intent.quality_gate_report_sha256 ===
      transition.delta.quality_gate_report_sha256 &&
    canonicalJson(intent.quality_gate_policy as unknown as StrictJsonValue) ===
      canonicalJson(
        transition.delta.quality_gate_policy as unknown as StrictJsonValue,
      ) &&
    sameGraphIdentity(intent.graph_identity, transition.scope);
  const receiptLinked =
    receipt.intent_sha256 === intent.intent_sha256 &&
    receipt.proposed_snapshot_sha256 === intent.proposed_snapshot_sha256 &&
    receipt.committed_revision === expectedCommittedRevision(intent) &&
    receipt.review_handoff_sha256 === intent.review_handoff_sha256 &&
    receipt.replay_key === intent.replay_key_to_record &&
    sameGraphIdentity(receipt.graph_identity, intent.graph_identity) &&
    canonicalJson(receipt.predecessor_basis as unknown as StrictJsonValue) ===
      canonicalJson(intent.predecessor_basis as unknown as StrictJsonValue) &&
    receiptDigestMatches(receipt);
  if (result.outcome === "already_committed") {
    return transitionIntentLinked && receiptLinked;
  }
  return transitionIntentLinked &&
    receiptLinked &&
    sameGraphIdentity(result.state.graph_identity, receipt.graph_identity) &&
    result.state.revision === receipt.committed_revision &&
    result.state.snapshot_sha256 === receipt.proposed_snapshot_sha256 &&
    result.state.intent_sha256 === receipt.intent_sha256 &&
    result.state.last_receipt_sha256 === receipt.receipt_sha256 &&
    result.state.operational_committed_at === receipt.operational_committed_at;
}

function currentBindsToReceipt(
  readback: Extract<SubjectGraphRevisionReadResult, { outcome: "found" }>,
  receipt: SubjectGraphRevisionSuccessReceipt,
): boolean {
  return sameGraphIdentity(
    readback.state.graph_identity,
    receipt.graph_identity,
  ) &&
    readback.state.revision === receipt.committed_revision &&
    readback.state.snapshot_sha256 === receipt.proposed_snapshot_sha256 &&
    readback.state.intent_sha256 === receipt.intent_sha256 &&
    readback.state.last_receipt_sha256 === receipt.receipt_sha256 &&
    readback.state.operational_committed_at === receipt.operational_committed_at &&
    readback.receipt.receipt_sha256 === receipt.receipt_sha256 &&
    canonicalJson(readback.receipt as unknown as StrictJsonValue) ===
      canonicalJson(receipt as unknown as StrictJsonValue);
}

function revisionNumber(revision: string): number {
  const value = Number(revision.slice("rev_".length));
  return Number.isSafeInteger(value) ? value : -1;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function transactionState(
  result: SubjectGraphRevisionTransactionResult,
): SyntheticTransactionWorkshopState | null {
  switch (result.outcome) {
    case "committed":
      return "committed";
    case "already_committed":
      return "already committed";
    case "conflicted":
      return "conflicted";
    case "refused":
      return "refused";
    default:
      return null;
  }
}

function guidance(state: SyntheticTransactionWorkshopState): string {
  switch (state) {
    case "committed":
      return "Review the verified read-back before preparing another synthetic fixture update.";
    case "already committed":
      return "Keep the original receipt; do not submit or apply this exact fixture again.";
    case "conflicted":
      return "Reload the current durable state, rebuild from that state, and submit a new intent.";
    case "refused":
      return "Correct and revalidate the fixture input; do not treat the refused attempt as durable.";
  }
}

function statusExplanation(
  state: SyntheticTransactionWorkshopState,
  laterRevisionIsCurrent: boolean,
): string {
  if (laterRevisionIsCurrent) {
    return state === "already committed"
      ? "This exact synthetic change was already committed. This retry changed nothing, and a later verified revision is current."
      : "The synthetic change committed, but a later verified revision is current. Only that verified current state is shown.";
  }
  switch (state) {
    case "committed":
      return "The synthetic change committed once and was verified through a fresh SQLite read boundary.";
    case "already committed":
      return "This exact synthetic change was already committed. No second write or application occurred.";
    case "conflicted":
      return "The stale synthetic attempt was not applied. The verified current durable state is shown below.";
    case "refused":
      return "The synthetic attempt was refused and was not persisted. The verified current durable state is shown below.";
  }
}

function renderItems(
  items: readonly WorkshopLensItemViewModel[],
  emptyMessage: string,
): string {
  if (items.length === 0) return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  return `<ul>${items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary)}</span><small>Trust: ${escapeHtml(item.trust.label)} · ${escapeHtml(item.trust.confidence)} confidence</small></li>`,
    )
    .join("")}</ul>`;
}

function renderEvidence(
  items: readonly WorkshopLensItemViewModel[],
  explanation: string,
): string {
  const packets = items.flatMap((item) => item.evidence_packets).slice(0, 3);
  const packetHtml = packets.length === 0
    ? '<p class="empty">No current evidence packet is available.</p>'
    : `<ul>${packets
        .map(
          (packet) =>
            `<li><strong>${escapeHtml(packet.claim.text)}</strong><span>${escapeHtml(packet.excerpt.text)}</span><small>${escapeHtml(packet.source.title)} · ${escapeHtml(packet.excerpt.validation_status)}</small></li>`,
        )
        .join("")}</ul>`;
  return `<p>${escapeHtml(explanation)}</p>${packetHtml}`;
}

function receiptFor(
  result: SubjectGraphRevisionTransactionResult,
): { readonly receipt_sha256: string; readonly persisted: boolean } | null {
  if (
    result.outcome === "committed" ||
    result.outcome === "already_committed"
  ) {
    return { receipt_sha256: result.receipt.receipt_sha256, persisted: true };
  }
  if (result.outcome === "conflicted" || result.outcome === "refused") {
    return {
      receipt_sha256: result.receipt.receipt_sha256,
      persisted: result.receipt.persisted,
    };
  }
  return null;
}

function renderTechnicalDetails(
  result: SubjectGraphRevisionTransactionResult,
  readback: Extract<SubjectGraphRevisionReadResult, { outcome: "found" }>,
  context: ProjectionAttemptContext | undefined,
): string {
  const transactionReceipt = receiptFor(result);
  const policy = context?.transition.delta.quality_gate_policy;
  const outcomeDetail = result.outcome === "conflicted"
    ? result.conflict_kind
    : result.outcome === "refused"
      ? result.reason
      : "none";
  return `<details class="technical-details">
    <summary>Technical identities and audit detail</summary>
    <dl>
      <dt>Transaction outcome</dt><dd>${escapeHtml(result.outcome)}</dd>
      <dt>Conflict/refusal detail</dt><dd>${escapeHtml(outcomeDetail)}</dd>
      <dt>Current revision</dt><dd>${escapeHtml(readback.state.revision)}</dd>
      <dt>Current snapshot SHA-256</dt><dd>${escapeHtml(readback.state.snapshot_sha256)}</dd>
      <dt>Current intent SHA-256</dt><dd>${escapeHtml(readback.state.intent_sha256)}</dd>
      <dt>Current persisted receipt SHA-256</dt><dd>${escapeHtml(readback.receipt.receipt_sha256)}</dd>
      <dt>Attempt receipt SHA-256</dt><dd>${escapeHtml(transactionReceipt?.receipt_sha256 ?? "not available")}</dd>
      <dt>Attempt receipt persisted</dt><dd>${transactionReceipt?.persisted === true ? "yes" : "no"}</dd>
      <dt>Candidate policy</dt><dd>${escapeHtml(policy ? `${policy.name} v${policy.version}` : "not applicable to this non-current attempt")}</dd>
      <dt>Candidate policy SHA-256</dt><dd>${escapeHtml(policy?.policy_sha256 ?? "not shown for this non-current attempt")}</dd>
      <dt>Operational commit time</dt><dd>${escapeHtml(readback.state.operational_committed_at)} (operational metadata only)</dd>
    </dl>
  </details>`;
}

/**
 * Presentation-only seam for tests and the bounded composition below. The
 * candidate is always rebuilt from a successful fresh read. Conflict/refusal
 * attempt content is deliberately unavailable to the visible projection.
 */
function buildSyntheticTransactionWorkshopProjection(
  result: SubjectGraphRevisionTransactionResult,
  readback: SubjectGraphRevisionReadResult,
  context?: ProjectionAttemptContext,
): SyntheticTransactionWorkshopProjection | null {
  const state = transactionState(result);
  if (state === null || readback.outcome !== "found") return null;

  const successfulAttempt =
    result.outcome === "committed" || result.outcome === "already_committed";
  if (successfulAttempt && context === undefined) {
    throw new Error("synthetic Workshop attempt context is invalid");
  }
  let attemptIsCurrent = false;
  let laterRevisionIsCurrent = false;
  if (successfulAttempt && context !== undefined) {
    if (!attemptBindsToReceipt(result, context)) {
      throw new Error("synthetic Workshop attempt context is invalid");
    }
    attemptIsCurrent = currentBindsToReceipt(readback, result.receipt);
    if (!attemptIsCurrent) {
      const sameReceiptClaim =
        readback.receipt.receipt_sha256 === result.receipt.receipt_sha256 ||
        readback.state.last_receipt_sha256 === result.receipt.receipt_sha256;
      laterRevisionIsCurrent =
        sameGraphIdentity(
          readback.state.graph_identity,
          result.receipt.graph_identity,
        ) &&
        revisionNumber(readback.state.revision) >
          revisionNumber(result.receipt.committed_revision);
      if (sameReceiptClaim || !laterRevisionIsCurrent) {
        throw new Error("synthetic Workshop current commit identity is invalid");
      }
    }
  }

  const viewModel = buildWorkshopViewModel(readback.state.snapshot);
  deepFreezeOwnData(viewModel);
  const changedIds = attemptIsCurrent && context !== undefined
    ? new Set(context.transition.delta.records.account_objects.map((item) => item.id))
    : new Set<string>();
  const changedSignals = attemptIsCurrent
    ? viewModel.lenses.signals.filter((item) => changedIds.has(item.id))
    : [];
  const currentEvidenceItems = attemptIsCurrent
    ? changedSignals
    : viewModel.lenses.signals;
  const signalsBody = attemptIsCurrent
    ? renderItems(changedSignals, "No signal object changed in this commit.")
    : `<p class="no-change">${escapeHtml(
        laterRevisionIsCurrent && result.outcome === "committed"
          ? "This commit occurred, but its changed items are not attributed to the later verified current revision."
          : "No durable signal changed in this attempt.",
      )}</p>${renderItems(
        viewModel.lenses.signals,
        "No current durable signals.",
      )}`;
  const signalsIntroduction = laterRevisionIsCurrent &&
      result.outcome === "already_committed"
    ? "This exact retry changed nothing. A later verified revision is current; only its durable signals are shown."
    : laterRevisionIsCurrent && result.outcome === "committed"
      ? "This commit occurred, but a later verified revision is current; only that revision's durable signals are shown."
      : result.outcome === "already_committed"
    ? "This exact retry changed nothing. The displayed signals belong to the original verified commit; no new write, application, or acceptance occurred."
    : result.outcome === "committed"
      ? "What changed durably in this transaction."
      : "This attempt changed nothing. Current durable signals are shown below.";
  const evidenceIntroduction = laterRevisionIsCurrent &&
      result.outcome === "already_committed"
    ? "No current Signals or Evidence are attributed to this historical retry. Evidence from the later verified current revision is shown."
    : laterRevisionIsCurrent && result.outcome === "committed"
      ? "No current Signals or Evidence are attributed to this earlier commit. Evidence from the later verified current revision is shown."
      : result.outcome === "already_committed"
    ? "The displayed evidence belongs to the original verified commit."
    : result.outcome === "committed"
      ? "Why the change was accepted."
      : "This attempt was not accepted. Current durable evidence is shown below.";
  const evidenceExplanation = laterRevisionIsCurrent
    ? "Only the independently verified current durable state's evidence is rendered here; it is not acceptance evidence for this earlier attempt."
    : result.outcome === "already_committed"
    ? "The original verified commit passed deterministic candidate validation. This exact retry received no new acceptance."
    : attemptIsCurrent
      ? "Accepted for this synthetic commit because the deterministic candidate quality gate passed. This is candidate validation, not authenticated human approval."
      : "This attempt was not accepted. Evidence shown here belongs only to the verified current durable state.";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atliera Workshop — synthetic transaction proof</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #090b12; color: #edf2ff; }
    body { margin: 0; } main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
    .boundary, section, details { border: 1px solid #2d3853; border-radius: 16px; background: #101728; padding: 18px; margin: 14px 0; }
    .boundary { border-color: #a16207; background: #2b1d08; } .state { font-size: 1.15rem; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; } h1, h2 { margin-top: 0; }
    ul { margin: 8px 0; padding-left: 22px; } li { margin: 10px 0; } li span, li small { display: block; color: #b8c3dc; margin-top: 3px; }
    .next-action { border-color: #15803d; } .no-change { color: #fcd34d; } .empty { color: #aeb9d2; }
    dt { color: #9eabc8; } dd { margin: 0 0 8px; overflow-wrap: anywhere; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body><main>
  <div class="boundary"><strong>Synthetic fixture · disposable lab SQLite · non-production</strong><br />No provider calls, network operations, real accounts, or production authority.</div>
  <header><h1>Atliera Workshop</h1><p class="state">Transaction state: ${escapeHtml(state)}</p><p>${escapeHtml(statusExplanation(state, laterRevisionIsCurrent))}</p></header>
  <div class="grid">
    <section data-workshop-lens="maps"><h2>Maps</h2><p>What was known and remains in verified durable state.</p>${renderItems(viewModel.lenses.maps, "No current durable map items.")}</section>
    <section data-workshop-lens="signals"><h2>Signals</h2><p>${escapeHtml(signalsIntroduction)}</p>${signalsBody}</section>
  </div>
  <section data-workshop-lens="evidence"><h2>Evidence</h2><p>${escapeHtml(evidenceIntroduction)}</p>${renderEvidence(currentEvidenceItems, evidenceExplanation)}</section>
  <section class="next-action" data-workshop-lens="plays"><h2>Plays</h2><p><strong>One next safe action:</strong> ${escapeHtml(guidance(state))}</p></section>
  ${renderTechnicalDetails(result, readback, attemptIsCurrent ? context : undefined)}
</main></body></html>`;

  return Object.freeze({
    transaction_state: state,
    current_state_source: "verified_fresh_disposable_sqlite_readback",
    view_model: viewModel,
    html,
  });
}

/**
 * Exact lab-only composition. The intent remains a commit description; the
 * existing fixture/test permit is the only effect admission.
 */
export function executeSyntheticTransactionWorkshopProof(
  input: ExecuteSyntheticTransactionWorkshopProofInput,
): SyntheticTransactionWorkshopProof {
  const inputSnapshot = snapshotProofInput(input);
  const database = snapshotProofDatabase(inputSnapshot.database);
  const envelope = hydrateProposalEnvelope(inputSnapshot.envelope);
  if (envelope.producer.kind !== "fixture" || envelope.fixture_binding === null) {
    throw new Error("synthetic transaction Workshop proof requires an exact fixture-bound proposal envelope");
  }
  const delta = hydrateCandidateDelta(inputSnapshot.delta);
  const transition = hydrateCandidateTransition(
    envelope,
    inputSnapshot.transition,
    inputSnapshot.application_options,
  );
  if (
    delta.delta_sha256 !== transition.delta.delta_sha256 ||
    canonicalJson(delta as unknown as StrictJsonValue) !==
      canonicalJson(transition.delta as unknown as StrictJsonValue)
  ) {
    throw new Error("synthetic transaction Workshop proof delta is not the transition delta");
  }
  const intent = hydrateSubjectGraphRevisionIntent(
    envelope,
    transition,
    inputSnapshot.application_options,
    inputSnapshot.intent,
  );
  const permit = createDisposableSqliteSubjectGraphRevisionLabPermit();
  const transactionAdapter =
    new DisposableSqliteSubjectGraphRevisionTransaction(database);
  const transaction = transactionAdapter.consume(intent, permit);

  // A new adapter instance and read-only connection are the restart boundary.
  // The fault plan is intentionally not propagated to the reader.
  const freshReadAdapter = new DisposableSqliteSubjectGraphRevisionTransaction({
    database_path: database.database_path,
    isolated_temporary_directory: database.isolated_temporary_directory,
  });
  const readback = freshReadAdapter.readCurrent(intent.graph_identity, permit);
  const workshop = buildSyntheticTransactionWorkshopProjection(
    transaction,
    readback,
    transaction.outcome === "committed" ||
      transaction.outcome === "already_committed"
      ? { transition, intent }
      : undefined,
  );

  return Object.freeze({
    kind: "synthetic-transaction-workshop-proof",
    transaction,
    readback,
    workshop,
    provider_calls_performed: 0,
    network_operations_performed: 0,
    production_effects_performed: 0,
  });
}
