import { createHash } from "node:crypto";

import {
  admitM5bProductReviewPackageArtifactsAgainstTrustedPrepareResult,
  type M5bProductReviewPrepareResult,
} from "./m5b-product-review-prepare.ts";
import type {
  M5bProductReviewPackageArtifactSet,
  M5bProductReviewTrustedAdmittedPackageArtifacts,
} from "./m5b-product-review-package-admission.ts";
import type {
  M5bProductReviewEvidenceBinding,
  M5bProductReviewPacketProposal,
  M5bProductReviewSanitizedSource,
} from "./m5b-product-review-package.ts";
import {
  M5bProductReviewRefusal,
  type M5bProductReviewMeetingPlan,
} from "./m5b-product-review-contract.ts";
import { CALM_ACCOUNT_HOME_CSS, CALM_ACCOUNT_HOME_SCRIPT } from "./calm-account-home-style.ts";

const FORBIDDEN_SOURCE_HOST = /(?:^|\.)invalid$/iu;

export const C1_CALM_ACCOUNT_HOME_BOUNDARY = Object.freeze({
  mode: "local_test_only" as const,
  readOnly: true as const,
  providerCalls: 0 as const,
  networkCalls: 0 as const,
  clientNetworkCalls: 0 as const,
  externalNavigation: false as const,
  sourceAcquisitions: 0 as const,
  privateReads: 0 as const,
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  graphReads: 0 as const,
  graphWrites: 0 as const,
  persistenceWrites: 0 as const,
  customerRoutes: 0 as const,
  deployments: 0 as const,
  outboundActions: 0 as const,
});

export type CalmContentKind = "source_fact" | "draft_interpretation" | "draft_recommendation";

export interface CalmEvidenceSourceView {
  readonly quote: string;
  readonly title: string;
  readonly publisher: string;
  readonly sourceDate: "Not separately established";
  readonly retrievalContext: string;
  readonly canonicalUrl: string | null;
  readonly originSupportState: "Source-backed" | "Attributed synthetic source";
}

export interface CalmEvidenceView {
  readonly key: "change" | "implication" | "next";
  readonly heading: string;
  readonly relatedStatement: string;
  readonly contentKind: CalmContentKind;
  readonly reviewDisposition: "Not reviewed";
  readonly sources: readonly CalmEvidenceSourceView[];
  readonly supports: string;
  readonly doesNotEstablish: string;
}

export interface CalmSecondaryItemView {
  readonly rank: number;
  readonly label: "Established" | "Open";
  readonly text: string;
  readonly origin: "Attributed source fact" | "Prepared context";
}

export interface CalmAccountHomeViewModel {
  readonly accountName: string;
  readonly pagePurpose: "Account home · read-only draft";
  readonly thesis: string;
  readonly change: string;
  readonly implication: string;
  readonly nextMove: string;
  readonly trustLine: string;
  readonly orientation: readonly [
    { readonly label: "Established"; readonly text: string },
    { readonly label: "Open"; readonly text: string },
    { readonly label: "Next"; readonly text: string },
  ];
  readonly primaryAction: {
    readonly kind: "view_evidence" | "view_existing_meeting_plan";
    readonly label: "View evidence" | "View existing meeting plan";
    readonly target: "evidence-change" | "existing-meeting-plan";
  };
  readonly meetingPlan: M5bProductReviewMeetingPlan | null;
  readonly secondaryItems: readonly CalmSecondaryItemView[];
  readonly evidence: readonly [CalmEvidenceView, CalmEvidenceView, CalmEvidenceView];
  readonly trustProofs: {
    readonly sourceCustodyAuthenticated: boolean;
    readonly exactSupportAccepted: true;
    readonly humanReviewRecorded: false;
    readonly sourceBackedLabelAllowed: boolean;
    readonly reviewedLabelAllowed: false;
  };
}

export interface CalmAccountHomeArtifact {
  readonly kind: "c1-calm-read-only-account-home";
  readonly schemaVersion: "1";
  readonly viewModel: Readonly<CalmAccountHomeViewModel>;
  readonly html: string;
  readonly boundary: typeof C1_CALM_ACCOUNT_HOME_BOUNDARY;
}

export interface CalmAccountHomeBlockedProof {
  readonly kind: "c1-calm-account-home-blocked-proof";
  readonly schemaVersion: "1";
  readonly status: "blocked";
  readonly reason: "input_not_admitted_or_insufficient";
  readonly message: string;
  readonly html: string;
  readonly boundary: typeof C1_CALM_ACCOUNT_HOME_BOUNDARY;
}

export type CalmAccountHomeBuildAttempt =
  | { readonly status: "ready"; readonly artifact: Readonly<CalmAccountHomeArtifact> }
  | { readonly status: "blocked"; readonly proof: Readonly<CalmAccountHomeBlockedProof> };

class CalmAccountHomeProjectionRefusal extends Error {
  constructor() {
    super("Admitted input cannot support the complete C1 Account Home story");
    this.name = "CalmAccountHomeProjectionRefusal";
  }
}

export interface CalmTrustLabelProofs {
  readonly sourceCustodyAuthenticated: boolean;
  readonly exactSupportAccepted: boolean;
  readonly humanReviewRecorded: boolean;
}

export interface CalmTrustLabels {
  readonly sourceSupport: "Source-backed" | "Attributed";
  readonly review: "Reviewed" | "Not reviewed";
}

/**
 * Pure label derivation only. Callers must derive these booleans from an admitted proof boundary;
 * this helper is not admission, authentication, review, or authority by itself.
 */
export function deriveCalmTrustLabels(proofs: CalmTrustLabelProofs): CalmTrustLabels {
  return Object.freeze({
    sourceSupport: proofs.sourceCustodyAuthenticated && proofs.exactSupportAccepted
      ? "Source-backed"
      : "Attributed",
    review: proofs.humanReviewRecorded ? "Reviewed" : "Not reviewed",
  });
}

function freezeDeep<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function cspSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

function safeExternalHttps(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
        FORBIDDEN_SOURCE_HOST.test(url.hostname)) return null;
    return value;
  } catch {
    return null;
  }
}

function humanDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);
  if (match === null) return "Date not established";
  const rendered = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`));
  return rendered;
}

function questionAnswer(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
  question: string,
): string {
  const answer = admitted.reviewPacket.customerQuestions.find((item) => item.question === question)?.answer;
  if (answer === undefined || answer.trim() === "") {
    throw new CalmAccountHomeProjectionRefusal();
  }
  return answer;
}

function sourceForBinding(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
  binding: M5bProductReviewEvidenceBinding,
): M5bProductReviewSanitizedSource {
  const source = admitted.sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId);
  if (source === undefined) throw new CalmAccountHomeProjectionRefusal();
  return source;
}

function sourceView(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
  binding: M5bProductReviewEvidenceBinding,
): CalmEvidenceSourceView {
  const source = sourceForBinding(admitted, binding);
  const sourceBacked = source.provenance.classification === "validated_exact_public_acquisition_custody";
  return {
    quote: binding.exactQuote,
    title: source.title,
    publisher: source.publisher,
    sourceDate: "Not separately established",
    retrievalContext: source.provenance.classification === "explicit_synthetic_fixture"
      ? `Recorded in repository fixture ${humanDate(source.acquiredAt)}`
      : `Custody recorded ${humanDate(source.acquiredAt)}`,
    canonicalUrl: safeExternalHttps(source.canonicalUrl),
    originSupportState: sourceBacked ? "Source-backed" : "Attributed synthetic source",
  };
}

function evidenceFor(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
  input: {
    readonly key: CalmEvidenceView["key"];
    readonly heading: string;
    readonly relatedStatement: string;
    readonly contentKind: CalmContentKind;
    readonly bindings: readonly M5bProductReviewEvidenceBinding[];
    readonly supports: string;
    readonly doesNotEstablish: string;
  },
): CalmEvidenceView {
  if (input.bindings.length === 0) throw new CalmAccountHomeProjectionRefusal();
  return {
    key: input.key,
    heading: input.heading,
    relatedStatement: input.relatedStatement,
    contentKind: input.contentKind,
    reviewDisposition: "Not reviewed",
    sources: input.bindings.map((binding) => sourceView(admitted, binding)),
    supports: input.supports,
    doesNotEstablish: input.doesNotEstablish,
  };
}

function secondaryItems(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
  featuredSignal: M5bProductReviewPacketProposal,
): readonly CalmSecondaryItemView[] {
  const sourceFacts = admitted.reviewPacket.proposals
    .filter((proposal) => proposal.classification === "source_fact" && proposal.proposalId !== featuredSignal.proposalId)
    .slice(0, 2)
    .map((proposal, index): CalmSecondaryItemView => ({
      rank: index + 1,
      label: "Established",
      text: proposal.title,
      origin: "Attributed source fact",
    }));
  const attention = questionAnswer(admitted, "What needs attention?");
  return [
    ...sourceFacts,
    {
      rank: sourceFacts.length + 1,
      label: "Open" as const,
      text: attention,
      origin: "Prepared context" as const,
    },
  ].slice(0, 3);
}

function projectAdmittedCalmAccountHome(
  admitted: Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts>,
): Readonly<CalmAccountHomeViewModel> {
  if (admitted.admissionAssurance !== "trusted_prepare_result_capability_authenticated") {
    throw new Error("C1 Account Home requires trusted prepare-result admission");
  }
  const { signal, map, play } = admitted.featuredMaterialChangeChain;
  const changeBinding = signal.evidenceBindings.find((binding) => binding.evidenceRole === "material_change");
  if (changeBinding === undefined) throw new Error("C1 Account Home requires admitted material-change evidence");

  const thesis = questionAnswer(admitted, "Who is this account?");
  const change = changeBinding.exactQuote;
  const implication = map.title;
  const nextMove = play.title;
  if ([admitted.reviewPacket.subject.accountName, thesis, change, implication, nextMove]
      .some((value) => value.trim() === "")) {
    throw new CalmAccountHomeProjectionRefusal();
  }
  const allEvidenceSources = admitted.sourcePack.sources;
  const sourceCustodyAuthenticated = allEvidenceSources.length > 0 &&
    allEvidenceSources.every((source) => source.provenance.classification === "validated_exact_public_acquisition_custody");
  const trustLabels = deriveCalmTrustLabels({
    sourceCustodyAuthenticated,
    exactSupportAccepted: true,
    humanReviewRecorded: false,
  });
  const trustLine = [
    "Draft",
    sourceCustodyAuthenticated
      ? "Source-backed"
      : "Attributed synthetic sources",
    trustLabels.review,
    "Freshness not established",
  ].join(" · ");

  const changeEvidence = evidenceFor(admitted, {
    key: "change",
    heading: "Evidence for the meaningful change",
    relatedStatement: change,
    contentKind: "source_fact",
    bindings: [changeBinding],
    supports: "The admitted exact excerpt supports the attributed product-introduction statement.",
    doesNotEstablish: "It does not establish adoption, customer demand, buying intent, budget, or the account's current operating state.",
  });
  const implicationEvidence = evidenceFor(admitted, {
    key: "implication",
    heading: "Evidence and boundary for the implication",
    relatedStatement: implication,
    contentKind: "draft_interpretation",
    bindings: map.evidenceBindings,
    supports: "The admitted exact excerpts support the cited launch, pilot, and operating-context facts used by this draft interpretation.",
    doesNotEstablish: "The sources do not directly establish this interpretation, customer priorities, buying intent, or commercial urgency.",
  });
  const nextEvidence = evidenceFor(admitted, {
    key: "next",
    heading: "Evidence and boundary for the draft next move",
    relatedStatement: nextMove,
    contentKind: "draft_recommendation",
    bindings: play.evidenceBindings,
    supports: "The admitted facts provide context for considering this draft next move.",
    doesNotEstablish: "The sources do not establish that the account wants this action, a meeting, a vendor, or any external commitment.",
  });

  const meetingPlan = admitted.reviewPacket.meetingPlan ?? null;
  const viewModel: CalmAccountHomeViewModel = {
    accountName: admitted.reviewPacket.subject.accountName,
    pagePurpose: "Account home · read-only draft",
    thesis,
    change,
    implication,
    nextMove,
    trustLine,
    orientation: [
      { label: "Established", text: "An exact attributed excerpt records the product introduction." },
      { label: "Open", text: "The implication, currentness, and commercial meaning remain draft or not established." },
      { label: "Next", text: "One bounded next move is presented as a recommendation, not a commitment." },
    ],
    primaryAction: meetingPlan === null
      ? { kind: "view_evidence", label: "View evidence", target: "evidence-change" }
      : { kind: "view_existing_meeting_plan", label: "View existing meeting plan", target: "existing-meeting-plan" },
    meetingPlan,
    secondaryItems: secondaryItems(admitted, signal),
    evidence: [changeEvidence, implicationEvidence, nextEvidence],
    trustProofs: {
      sourceCustodyAuthenticated,
      exactSupportAccepted: true,
      humanReviewRecorded: false,
      sourceBackedLabelAllowed: sourceCustodyAuthenticated,
      reviewedLabelAllowed: false,
    },
  };
  return freezeDeep(viewModel);
}

function kindLabel(kind: CalmContentKind): string {
  if (kind === "source_fact") return "Attributed source fact";
  if (kind === "draft_interpretation") return "Draft interpretation";
  return "Draft recommendation";
}

function evidenceDialog(evidence: CalmEvidenceView): string {
  const sources = evidence.sources.map((source, index) => {
    const link = source.canonicalUrl === null
      ? '<span class="source-link-unavailable">Source link not available in this fixture</span>'
      : `<p class="source-reference"><span>Canonical HTTPS reference</span><code>${escapeHtml(source.canonicalUrl)}</code></p>`;
    return `<article class="evidence-source" aria-labelledby="${evidence.key}-source-${String(index + 1)}">
      <p class="source-kicker">Exact support ${String(index + 1)}</p>
      <h3 id="${evidence.key}-source-${String(index + 1)}">${escapeHtml(source.title)}</h3>
      <blockquote>${escapeHtml(source.quote)}</blockquote>
      <dl class="source-meta">
        <div><dt>Publisher</dt><dd>${escapeHtml(source.publisher)}</dd></div>
        <div><dt>Source date</dt><dd>${escapeHtml(source.sourceDate)}</dd></div>
        <div><dt>Retrieval context</dt><dd>${escapeHtml(source.retrievalContext)}</dd></div>
        <div><dt>Origin and support</dt><dd>${escapeHtml(source.originSupportState)}</dd></div>
      </dl>
      <p>${link}</p>
    </article>`;
  }).join("");
  return `<dialog class="evidence-dialog" id="evidence-${evidence.key}" aria-labelledby="evidence-${evidence.key}-title">
    <div class="dialog-frame">
      <header class="dialog-header">
        <div><p class="eyebrow">Evidence on demand</p><h2 id="evidence-${evidence.key}-title">${escapeHtml(evidence.heading)}</h2></div>
        <form method="dialog"><button class="icon-button" type="submit" data-close-dialog aria-label="Close evidence">Close</button></form>
      </header>
      <div class="dialog-scroll">
        <section class="related-statement" aria-labelledby="${evidence.key}-statement-title">
          <p class="section-label" id="${evidence.key}-statement-title">Related statement</p>
          <p class="statement-copy">${escapeHtml(evidence.relatedStatement)}</p>
          <p class="compact-state"><span>${escapeHtml(kindLabel(evidence.contentKind))}</span><span>${escapeHtml(evidence.reviewDisposition)}</span></p>
        </section>
        ${sources}
        <section class="boundary-grid" aria-label="Evidence boundary">
          <div class="supports"><h3>What this supports</h3><p>${escapeHtml(evidence.supports)}</p></div>
          <div class="does-not"><h3>What this does not establish</h3><p>${escapeHtml(evidence.doesNotEstablish)}</p></div>
        </section>
      </div>
    </div>
  </dialog>`;
}

function meetingPlanDialog(plan: M5bProductReviewMeetingPlan): string {
  const questions = plan.orderedQuestions.map((item, index) => `<li>
    <p class="question-number">Question ${String(index + 1)}</p>
    <h3>${escapeHtml(item.question)}</h3>
    <dl class="question-detail">
      <div><dt>Why ask</dt><dd>${escapeHtml(item.whyAsked)}</dd></div>
      <div><dt>Desired learning</dt><dd>${escapeHtml(item.desiredLearning)}</dd></div>
      <div><dt>Follow-up signal</dt><dd>${escapeHtml(item.followUpSignal)}</dd></div>
    </dl>
  </li>`).join("");
  return `<dialog class="evidence-dialog" id="existing-meeting-plan" aria-labelledby="meeting-plan-title">
    <div class="dialog-frame">
      <header class="dialog-header">
        <div><p class="eyebrow">Existing admitted content</p><h2 id="meeting-plan-title">Meeting plan</h2></div>
        <form method="dialog"><button class="icon-button" type="submit" data-close-dialog aria-label="Close meeting plan">Close</button></form>
      </header>
      <div class="dialog-scroll">
        <dl class="plan-summary">
          <div><dt>Audience</dt><dd>${escapeHtml(plan.primaryAudience)}</dd></div>
          <div><dt>Objective</dt><dd>${escapeHtml(plan.meetingObjective)}</dd></div>
        </dl>
        <ol class="plan-questions">${questions}</ol>
        <section class="close-criterion"><p class="section-label">Overall close criterion</p><p>${escapeHtml(plan.overallCloseCriterion)}</p></section>
        <p class="plan-boundary">This plan already existed in the admitted input. Viewing it performs no generation, saving, approval, or delivery.</p>
      </div>
    </div>
  </dialog>`;
}

function renderCalmAccountHome(view: Readonly<CalmAccountHomeViewModel>): string {
  const csp = `default-src 'none'; style-src 'sha256-${cspSha256(CALM_ACCOUNT_HOME_CSS)}'; script-src 'sha256-${cspSha256(CALM_ACCOUNT_HOME_SCRIPT)}'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  const orientation = view.orientation.map((item, index) => `<li class="horizon-step horizon-${String(index + 1)}">
    <span class="horizon-node" aria-hidden="true"></span>
    <p class="horizon-label">${escapeHtml(item.label)}</p>
  </li>`).join("");
  const secondary = view.secondaryItems.map((item) => `<li>
    <span class="secondary-rank">${String(item.rank).padStart(2, "0")}</span>
    <div><p class="section-label">${escapeHtml(item.label)} · ${escapeHtml(item.origin)}</p><p>${escapeHtml(item.text)}</p></div>
  </li>`).join("");
  const evidenceDialogs = view.evidence.map(evidenceDialog).join("");
  const meetingPlan = view.meetingPlan === null ? "" : meetingPlanDialog(view.meetingPlan);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>Atliera account home — ${escapeHtml(view.accountName)}</title>
  <style>${CALM_ACCOUNT_HOME_CSS}</style>
</head>
<body>
<div class="site-frame">
  <header class="masthead">
    <div><p class="brand">Atliera</p><p class="purpose">${escapeHtml(view.pagePurpose)}</p></div>
    <p class="read-only">Local test projection</p>
  </header>
  <main id="main-content">
    <section class="hero" aria-labelledby="account-title">
      <div>
        <p class="eyebrow">Account intelligence</p>
        <h1 class="account-name" id="account-title">${escapeHtml(view.accountName)}</h1>
        <p class="hero-thesis">${escapeHtml(view.thesis)}</p>
      </div>
      <aside class="hero-aside" aria-label="Page purpose"><p>One account story. Exact support stays close to the consequential statement. Nothing on this page is saved, approved, or sent.</p></aside>
    </section>

    <section class="story" aria-labelledby="story-title">
      <div class="story-rail" id="story-title">Evidence horizon</div>
      <div class="story-body">
        <article class="story-section">
          <p class="eyebrow">Meaningful change</p>
          <h2>What changed</h2>
          <p class="story-copy">${escapeHtml(view.change)}</p>
          <p class="origin-line"><span>Attributed exact excerpt</span></p>
          <button class="evidence-trigger" type="button" data-dialog="evidence-change">Evidence for this statement</button>
        </article>
        <article class="story-section open">
          <p class="eyebrow">Open interpretation</p>
          <h2>Why it may matter</h2>
          <p class="story-copy">${escapeHtml(view.implication)}</p>
          <p class="origin-line"><span>Draft interpretation</span><span>Not reviewed</span></p>
          <button class="evidence-trigger" type="button" data-dialog="evidence-implication">Evidence and assumptions</button>
        </article>
        <article class="story-section next next-plane">
          <p class="eyebrow">Next</p>
          <h2>Recommended next move</h2>
          <p class="story-copy">${escapeHtml(view.nextMove)}</p>
          <p class="origin-line"><span>Draft recommendation</span><span>No external action</span></p>
          <p class="trust-line">${escapeHtml(view.trustLine)}</p>
          <button class="primary-action" type="button" data-dialog="${escapeHtml(view.primaryAction.target)}">${escapeHtml(view.primaryAction.label)}</button>
          <button class="evidence-trigger" type="button" data-dialog="evidence-next">Evidence and assumptions</button>
        </article>
      </div>
    </section>

    <section class="horizon" aria-labelledby="horizon-title">
      <p class="eyebrow">Decision orientation</p>
      <h2 id="horizon-title">Established → Open → Next</h2>
      <ol>${orientation}</ol>
    </section>

    <details class="explore">
      <summary>Explore account <span>${String(view.secondaryItems.length)} ranked items</span></summary>
      <ol class="secondary-list">${secondary}</ol>
    </details>
    <p class="boundary-footer">Read-only local/test artifact · Prepared context is not AI-generated · Human review is not recorded · No account data is persisted.</p>
  </main>
${evidenceDialogs}${meetingPlan}
</div>
<script>${CALM_ACCOUNT_HOME_SCRIPT}</script>
</body>
</html>
`;
}

function renderCalmAccountHomeBlockedProof(): string {
  const csp = `default-src 'none'; style-src 'sha256-${cspSha256(CALM_ACCOUNT_HOME_CSS)}'; script-src 'none'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>Atliera account home unavailable</title>
  <style>${CALM_ACCOUNT_HOME_CSS}</style>
</head>
<body>
<div class="site-frame">
  <header class="masthead"><div><p class="brand">Atliera</p><p class="purpose">Account home</p></div><p class="read-only">Local test projection</p></header>
  <main id="main-content">
    <section class="hero" aria-labelledby="blocked-title">
      <div>
        <p class="eyebrow">Safe failure</p>
        <h1 class="account-name" id="blocked-title">Account Home unavailable</h1>
        <p class="hero-thesis">The supplied local input did not pass the admission boundary or could not support a complete C1 account story.</p>
        <p class="trust-line">Blocked · No account content rendered · No account data persisted</p>
      </div>
    </section>
    <p class="boundary-footer">Use an admitted and validated repository-safe local input. No unsupported content was invented.</p>
  </main>
</div>
</body>
</html>
`;
}

export function buildCalmAccountHomeFromTrustedM5bPackage(
  artifacts: M5bProductReviewPackageArtifactSet,
  trustedPrepareResult: Readonly<M5bProductReviewPrepareResult>,
): Readonly<CalmAccountHomeArtifact> {
  const admitted = admitM5bProductReviewPackageArtifactsAgainstTrustedPrepareResult(
    artifacts,
    trustedPrepareResult,
  );
  const viewModel = projectAdmittedCalmAccountHome(admitted);
  const artifact: CalmAccountHomeArtifact = {
    kind: "c1-calm-read-only-account-home",
    schemaVersion: "1",
    viewModel,
    html: renderCalmAccountHome(viewModel),
    boundary: C1_CALM_ACCOUNT_HOME_BOUNDARY,
  };
  return freezeDeep(artifact);
}

export function attemptCalmAccountHomeFromTrustedM5bPackage(
  artifacts: M5bProductReviewPackageArtifactSet,
  trustedPrepareResult: Readonly<M5bProductReviewPrepareResult>,
): Readonly<CalmAccountHomeBuildAttempt> {
  try {
    return Object.freeze({
      status: "ready" as const,
      artifact: buildCalmAccountHomeFromTrustedM5bPackage(artifacts, trustedPrepareResult),
    });
  } catch (error) {
    if (!(error instanceof M5bProductReviewRefusal) &&
        !(error instanceof CalmAccountHomeProjectionRefusal)) throw error;
    const proof: CalmAccountHomeBlockedProof = {
      kind: "c1-calm-account-home-blocked-proof",
      schemaVersion: "1",
      status: "blocked",
      reason: "input_not_admitted_or_insufficient",
      message: "Account Home was not rendered because the local input was not admitted or could not support the complete C1 story.",
      html: renderCalmAccountHomeBlockedProof(),
      boundary: C1_CALM_ACCOUNT_HOME_BOUNDARY,
    };
    return Object.freeze({ status: "blocked" as const, proof: freezeDeep(proof) });
  }
}
