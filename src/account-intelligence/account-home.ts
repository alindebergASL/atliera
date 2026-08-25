import { createHash } from "node:crypto";
import type {
  AdmittedAccountSource,
  IntelligenceStatement,
  ValidatedAccountIntelligence,
} from "./contracts.ts";
import { C2_ACCOUNT_HOME_CSS, C2_ACCOUNT_HOME_SCRIPT } from "./account-home-style.ts";

export const C2_ACCOUNT_HOME_RENDER_BOUNDARY = Object.freeze({
  mode: "local_review_only" as const,
  readOnly: true as const,
  providerCalls: 0 as const,
  networkCalls: 0 as const,
  clientNetworkCalls: 0 as const,
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  graphReads: 0 as const,
  graphWrites: 0 as const,
  persistenceWrites: 0 as const,
  customerRoutes: 0 as const,
  deployments: 0 as const,
  publications: 0 as const,
  outboundActions: 0 as const,
  workshopBehavior: 0 as const,
});

export interface C2AccountHomeViewModel {
  readonly accountName: string;
  readonly thesis: IntelligenceStatement;
  readonly established: IntelligenceStatement;
  readonly changed: IntelligenceStatement;
  readonly whyItMayMatter: IntelligenceStatement;
  readonly stillOpen: IntelligenceStatement;
  readonly nextMove: IntelligenceStatement;
  readonly freshnessCue: string;
  readonly reviewCue: "Proposed · Not reviewed" | "Needs review";
  readonly evidenceSourceCount: number;
  readonly coverageGapCount: number;
}

export interface C2AccountHomeArtifact {
  readonly kind: "c2-governed-account-intelligence-home";
  readonly schemaVersion: "1";
  readonly viewModel: Readonly<C2AccountHomeViewModel>;
  readonly html: string;
  readonly boundary: typeof C2_ACCOUNT_HOME_RENDER_BOUNDARY;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}
function cspSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64");
}
function humanDate(value: string | null): string {
  if (value === null) return "Not established";
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T00:00:00.000Z` : value;
  try {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(date));
  } catch { return "Not established"; }
}
function humanTaxonomy(value: string): string {
  return value.replace(/_/gu, " ").replace(/^\w/u, (letter) => letter.toUpperCase());
}
function evidenceLookup(data: Readonly<ValidatedAccountIntelligence>): Map<string, {
  source: AdmittedAccountSource;
  excerpt: AdmittedAccountSource["excerpts"][number];
}> {
  const map = new Map<string, { source: AdmittedAccountSource; excerpt: AdmittedAccountSource["excerpts"][number] }>();
  for (const source of data.admittedSources) {
    for (const excerpt of source.excerpts) map.set(excerpt.evidenceId, { source, excerpt });
  }
  return map;
}
function stateLabel(statement: IntelligenceStatement): string {
  if (statement.state === "source-backed fact") return "Exact source wording";
  if (statement.state === "evidence-linked proposed claim") return "Evidence-linked · Proposed";
  if (statement.state === "evidence-informed interpretation") return "Evidence-informed interpretation";
  if (statement.state === "unresolved question") return "Unresolved question";
  return "Recommended action · proposed";
}
function supportBoundary(statement: IntelligenceStatement): { supports: string; doesNot: string } {
  if (statement.state === "source-backed fact") return {
    supports: "This statement preserves one admitted exact excerpt or deterministic source attribution.",
    doesNot: "It does not establish available budget, approved spend, active procurement, buying intent, urgency, or vendor preference unless the exact wording states those facts.",
  };
  if (statement.state === "evidence-linked proposed claim") return {
    supports: "The cited admitted excerpts are linked context for this proposed claim.",
    doesNot: "Deterministic validation does not prove that the model paraphrase is semantically entailed; it remains proposed until reviewed.",
  };
  if (statement.state === "evidence-informed interpretation") return {
    supports: "The admitted evidence provides context for this analysis; the interpretation remains proposed and unreviewed.",
    doesNot: "The sources do not directly establish this interpretation or any commercial conclusion.",
  };
  if (statement.state === "unresolved question") return {
    supports: "The research boundary shows why this question remains open.",
    doesNot: "Atliera has not filled the gap with an assumption or converted the question into an account fact.",
  };
  return {
    supports: "The admitted evidence provides context for considering this one safe next move.",
    doesNot: "The sources do not request, approve, authorize, schedule, send, or commit this action.",
  };
}

function dialogFor(
  statement: IntelligenceStatement,
  dialogId: string,
  title: string,
  lookup: Map<string, { source: AdmittedAccountSource; excerpt: AdmittedAccountSource["excerpts"][number] }>,
): string {
  const support = statement.evidenceIds.map((evidenceId, index) => {
    const item = lookup.get(evidenceId);
    if (item === undefined) return "";
    const source = item.source;
    return `<article class="evidence-source">
      <p class="source-kicker">Exact support ${String(index + 1)}</p>
      <h3>${escapeHtml(source.title)}</h3>
      <blockquote>${escapeHtml(item.excerpt.exactExcerpt)}</blockquote>
      <dl class="source-meta">
        <div><dt>Publisher</dt><dd>${escapeHtml(source.publisher)}</dd></div>
        <div><dt>Entity</dt><dd>${escapeHtml(source.entity.name)}</dd></div>
        <div><dt>Publication date</dt><dd>${escapeHtml(humanDate(source.publicationDate))}</dd></div>
        <div><dt>Effective or event date</dt><dd>${escapeHtml(humanDate(source.eventDate))}</dd></div>
        <div><dt>Retrieved</dt><dd>${escapeHtml(humanDate(source.retrievedAt))}</dd></div>
        <div><dt>Evidence current through</dt><dd>${escapeHtml(humanDate(source.evidenceCurrentThrough))}</dd></div>
        <div><dt>Source class</dt><dd>${source.sourceClass === "official_primary" ? "Official primary source" : "Secondary context"}</dd></div>
        <div><dt>Review state</dt><dd>Admitted support · not human reviewed</dd></div>
      </dl>
      <p class="source-url">${escapeHtml(source.canonicalUrl)}</p>
    </article>`;
  }).join("");
  const boundary = supportBoundary(statement);
  return `<dialog class="evidence-dialog" id="${dialogId}" aria-labelledby="${dialogId}-title">
    <div class="dialog-frame">
      <header class="dialog-header">
        <div><p class="eyebrow">Evidence on demand</p><h2 id="${dialogId}-title">${escapeHtml(title)}</h2></div>
        <button class="icon-button" type="button" data-close-dialog aria-label="Close evidence">Close</button>
      </header>
      <div class="dialog-scroll">
        <section class="related-statement"><p class="section-label">Related statement · ${escapeHtml(stateLabel(statement))}</p><p>${escapeHtml(statement.text)}</p></section>
        ${support === "" ? '<p class="boundary-footer">No admitted excerpt resolves this question.</p>' : support}
        <section class="evidence-boundary" aria-label="Evidence boundary">
          <div><h3>What this supports</h3><p>${escapeHtml(boundary.supports)}</p></div>
          <div><h3>What remains outside it</h3><p>${escapeHtml(boundary.doesNot)}</p></div>
        </section>
      </div>
    </div>
  </dialog>`;
}
function evidenceButton(dialogId: string, label = "Evidence"): string {
  return `<button class="evidence-trigger" type="button" data-dialog="${dialogId}">${escapeHtml(label)}</button>`;
}

function buildViewModel(data: Readonly<ValidatedAccountIntelligence>): Readonly<C2AccountHomeViewModel> {
  const p = data.proposal;
  const currentThroughDates = data.admittedSources.map((source) => source.evidenceCurrentThrough)
    .filter((value): value is string => value !== null).sort();
  const latestRetrieval = data.admittedSources.map((source) => source.retrievedAt).sort().at(-1) ?? null;
  const hasMissingCurrentThrough = currentThroughDates.length !== data.admittedSources.length;
  const earliestCurrentThrough = currentThroughDates.at(0) ?? null;
  const latestCurrentThrough = currentThroughDates.at(-1) ?? null;
  const freshnessCue = latestCurrentThrough === null
    ? `Retrieved ${humanDate(latestRetrieval)} · freshness not established`
    : hasMissingCurrentThrough
      ? `Evidence freshness mixed · through ${humanDate(latestCurrentThrough)} where established · recheck`
      : earliestCurrentThrough === latestCurrentThrough
        ? `Evidence current through ${humanDate(latestCurrentThrough)}`
        : `Evidence current-through span ${humanDate(earliestCurrentThrough)}–${humanDate(latestCurrentThrough)} · recheck older support`;
  return Object.freeze({
    accountName: data.request.accountName,
    thesis: p.accountThesis,
    established: p.establishedContext[0]!,
    changed: p.meaningfullyChanged[0]!,
    whyItMayMatter: p.whyChangeMayMatter[0]!,
    stillOpen: p.stillOpenQuestions[0]!,
    nextMove: p.recommendedNextMove,
    freshnessCue,
    reviewCue: p.reviewStatus === "needs_review" ? "Needs review" : "Proposed · Not reviewed",
    evidenceSourceCount: data.admittedSources.length,
    coverageGapCount: p.researchCoverage.filter((item) => item.status !== "covered").length,
  });
}

export function renderC2AccountHome(data: Readonly<ValidatedAccountIntelligence>): Readonly<C2AccountHomeArtifact> {
  const view = buildViewModel(data);
  const lookup = evidenceLookup(data);
  const statements = [view.thesis, view.established, view.changed, view.whyItMayMatter, view.stillOpen, view.nextMove];
  const ids = ["thesis", "established", "changed", "meaning", "open", "next"];
  const dialogs = statements.map((statement, index) =>
    dialogFor(statement, `evidence-${ids[index]!}`, index === 0 ? "Account thesis" : stateLabel(statement), lookup)).join("");
  const coverage = data.proposal.researchCoverage.map((item) => `<li>
    <span>${escapeHtml(humanTaxonomy(item.taxonomy))}</span>
    <span class="coverage-state">${escapeHtml(item.status)}${item.gap === null ? "" : ` · ${escapeHtml(item.gap)}`}</span>
  </li>`).join("");
  const boundaries = data.proposal.sourceAndEntityBoundaries.map((item) => {
    const name = data.admittedSources.find((source) => source.entity.entityId === item.entityId)?.entity.name ?? "Related entity";
    return `<li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(item.boundary)}</li>`;
  }).join("");
  const gaps = data.proposal.materialGaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("");
  const csp = `default-src 'none'; style-src 'sha256-${cspSha256(C2_ACCOUNT_HOME_CSS)}'; script-src 'sha256-${cspSha256(C2_ACCOUNT_HOME_SCRIPT)}'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}"><title>Atliera account intelligence — ${escapeHtml(view.accountName)}</title><style>${C2_ACCOUNT_HOME_CSS}</style></head>
<body><div class="site-frame">
<header class="product-header"><p class="brand">Atliera</p><p class="mode-line" aria-label="Account view; Workshop compatibility retained but not implemented"><span class="mode-active">Account</span><span aria-hidden="true">│</span><span class="mode-future">Workshop</span></p></header>
<main id="main-content">
  <div class="intro-line"><p class="eyebrow">Governed account intelligence refresh</p><p class="freshness"><span class="${view.reviewCue === "Needs review" ? "review-cue" : ""}">${escapeHtml(view.reviewCue)}</span> · ${escapeHtml(view.freshnessCue)}</p></div>
  <section class="account-hero" aria-labelledby="account-title"><div><h1 id="account-title">${escapeHtml(view.accountName)}</h1><p class="account-thesis">${escapeHtml(view.thesis.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.thesis))}</span>${evidenceButton("evidence-thesis")}</div></div><aside class="hero-aside"><p>Answers first. Evidence on demand. Machinery by invitation.</p></aside></section>
  <section class="grammar" aria-label="Editorial Evidence Synthesis">
    <div class="context-plane">
      <article class="stage established"><span class="stage-num" aria-hidden="true">01</span><p class="stage-kicker">Established</p><h2>Established</h2><p class="stage-copy">${escapeHtml(view.established.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.established))}</span>${evidenceButton("evidence-established")}</div></article>
      <article class="stage changed"><span class="stage-num" aria-hidden="true">02</span><p class="stage-kicker">Meaningfully changed</p><h2>Meaningfully changed</h2><p class="stage-copy">${escapeHtml(view.changed.text)}</p><p class="analysis-line"><strong>Why it may matter:</strong> ${escapeHtml(view.whyItMayMatter.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.changed))}</span>${evidenceButton("evidence-changed")}${evidenceButton("evidence-meaning", "Analysis boundary")}</div></article>
    </div>
    <div class="decision-plane">
      <article class="stage open"><span class="stage-num" aria-hidden="true">03</span><p class="stage-kicker">Still open</p><h2>Still open</h2><p class="stage-copy">${escapeHtml(view.stillOpen.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.stillOpen))}</span>${evidenceButton("evidence-open", "Why this is open")}</div></article>
      <article class="stage next"><span class="stage-num" aria-hidden="true">04</span><p class="stage-kicker">Recommended next move</p><h2>Recommended next move</h2><p class="stage-copy">${escapeHtml(view.nextMove.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.nextMove))}</span></div><button class="primary-action" type="button" data-dialog="evidence-next">Review the support</button></article>
    </div>
  </section>
  <details class="research-disclosure"><summary>Research coverage and boundaries</summary><div class="research-grid"><section><h3>Coverage</h3><ul class="coverage-list">${coverage}</ul></section><section><h3>Entity boundaries</h3><ul>${boundaries}</ul><h3>Material gaps</h3><ul>${gaps}</ul><p class="boundary-footer">Model proposal: ${escapeHtml(data.effectReceipt.provider)} / ${escapeHtml(data.effectReceipt.model)} · ${String(data.effectReceipt.providerCallsExecuted)} bounded call · ${String(data.effectReceipt.searchQueriesExecuted)} searches · ${String(data.effectReceipt.retrievalsExecuted)} public retrievals. No Graph, database, publication, customer, or deployment effects.</p></section></div></details>
  <p class="boundary-footer">Proposed account intelligence for local review only. Nothing here is approved, saved to durable account truth, sent, shared, deployed, or used to prepare a meeting.</p>
</main>${dialogs}<script>${C2_ACCOUNT_HOME_SCRIPT}</script></div></body></html>`;
  return Object.freeze({ kind: "c2-governed-account-intelligence-home", schemaVersion: "1", viewModel: view,
    html, boundary: C2_ACCOUNT_HOME_RENDER_BOUNDARY });
}
