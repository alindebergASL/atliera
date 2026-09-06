import { createHash } from "node:crypto";
import {
  assertExactKeys,
  deepFreezeOwnData,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
} from "../authority/strict-json.ts";
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

export const C2_ACCOUNT_HOME_ANNOTATION_KINDS = Object.freeze([
  "source_context_caveat",
  "freshness_recheck",
] as const);

export type C2AccountHomeAnnotationKind = typeof C2_ACCOUNT_HOME_ANNOTATION_KINDS[number];

/** Renderer-only source/review context. It never mutates or becomes admitted evidence. */
export interface C2AccountHomeAnnotation {
  readonly annotationId: string;
  readonly kind: C2AccountHomeAnnotationKind;
  readonly sourceId: string;
  readonly evidenceIds: readonly string[];
  readonly text: string;
}

const ANNOTATION_LIMITS = Object.freeze({
  max_array_length: 20,
  max_depth: 3,
  max_expanded_json_value_occurrences: 200,
  max_nodes: 50,
  max_object_fields: 5,
  max_string_utf8_bytes: 2_000,
  max_total_string_utf8_bytes: 20_000,
});
const SAFE_ANNOTATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const UNSAFE_ANNOTATION_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

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
function displayedStatements(view: Readonly<C2AccountHomeViewModel>): readonly IntelligenceStatement[] {
  return [view.thesis, view.established, view.changed, view.whyItMayMatter, view.stillOpen, view.nextMove];
}
export function snapshotC2AccountHomeAnnotations(
  input: unknown,
  data: Readonly<ValidatedAccountIntelligence>,
): readonly Readonly<C2AccountHomeAnnotation>[] {
  const snapshot = snapshotStrictJson(input, "rendererAnnotations", ANNOTATION_LIMITS);
  const rows = strictJsonArray(snapshot, "rendererAnnotations", 20);
  const sources = new Map(data.admittedSources.map((source) => [source.sourceId, source]));
  const displayedEvidenceIds = new Set(displayedStatements(buildViewModel(data)).flatMap((statement) => statement.evidenceIds));
  const annotationIds = new Set<string>();
  const annotations = rows.map((row, index): C2AccountHomeAnnotation => {
    const path = `rendererAnnotations[${String(index)}]`;
    const item = strictJsonObject(row, path);
    assertExactKeys(item, ["annotationId", "kind", "sourceId", "evidenceIds", "text"], path);
    if (typeof item.annotationId !== "string" || !SAFE_ANNOTATION_ID.test(item.annotationId)) {
      throw new Error(`${path}.annotationId must be a safe id`);
    }
    if (annotationIds.has(item.annotationId)) throw new Error("renderer annotation ids must be unique");
    annotationIds.add(item.annotationId);
    if (typeof item.kind !== "string" || !C2_ACCOUNT_HOME_ANNOTATION_KINDS.includes(item.kind as C2AccountHomeAnnotationKind)) {
      throw new Error(`${path}.kind refused`);
    }
    if (typeof item.sourceId !== "string" || !SAFE_ANNOTATION_ID.test(item.sourceId)) {
      throw new Error(`${path}.sourceId must be a safe id`);
    }
    const source = sources.get(item.sourceId);
    if (source === undefined) throw new Error(`${path} cites an unavailable admitted source`);
    const evidenceIds = strictJsonArray(item.evidenceIds, `${path}.evidenceIds`, 20, true).map((value, evidenceIndex) => {
      if (typeof value !== "string" || !SAFE_ANNOTATION_ID.test(value)) {
        throw new Error(`${path}.evidenceIds[${String(evidenceIndex)}] must be a safe id`);
      }
      return value;
    });
    if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error(`${path}.evidenceIds must be unique`);
    const sourceEvidenceIds = new Set(source.excerpts.map((excerpt) => excerpt.evidenceId));
    if (evidenceIds.some((evidenceId) => !sourceEvidenceIds.has(evidenceId))) {
      throw new Error(`${path} evidence binding does not belong to its admitted source`);
    }
    if (evidenceIds.some((evidenceId) => !displayedEvidenceIds.has(evidenceId))) {
      throw new Error(`${path} evidence binding is not visible in this Account Home`);
    }
    if (typeof item.text !== "string" || item.text.trim() !== item.text || item.text.length === 0 ||
        item.text.length > 1_000 || UNSAFE_ANNOTATION_TEXT.test(item.text)) {
      throw new Error(`${path}.text must be bounded safe text`);
    }
    return {
      annotationId: item.annotationId,
      kind: item.kind as C2AccountHomeAnnotationKind,
      sourceId: item.sourceId,
      evidenceIds,
      text: item.text,
    };
  });
  return deepFreezeOwnData(annotations);
}
function stateLabel(statement: IntelligenceStatement): string {
  if (statement.state === "source-backed fact") return "Exact source wording";
  if (statement.state === "evidence-linked proposed claim") return "Evidence-linked · Proposed";
  if (statement.state === "evidence-informed interpretation") return "Evidence-informed interpretation";
  if (statement.state === "unresolved question") return "Unresolved question";
  return "Recommended action · proposed";
}
function evidenceCardLabel(statement: IntelligenceStatement): "Exact support" | "Related evidence context" {
  return statement.state === "source-backed fact" ? "Exact support" : "Related evidence context";
}
function evidenceAccessibleLabel(statement: IntelligenceStatement): "Exact source support" | "Related evidence context" {
  return statement.state === "source-backed fact" ? "Exact source support" : "Related evidence context";
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
  annotations: readonly Readonly<C2AccountHomeAnnotation>[],
): string {
  const support = statement.evidenceIds.map((evidenceId, index) => {
    const item = lookup.get(evidenceId);
    if (item === undefined) return "";
    const source = item.source;
    const evidenceAnnotations = annotations.filter((annotation) =>
      annotation.sourceId === source.sourceId && annotation.evidenceIds.includes(evidenceId));
    const renderedAnnotations = evidenceAnnotations.map((annotation) => {
      const label = annotation.kind === "source_context_caveat" ? "Source context" : "Freshness recheck";
      return `<aside class="evidence-annotation" data-annotation-kind="${annotation.kind}"><p><strong>${label} — not source wording:</strong> ${escapeHtml(annotation.text)}</p></aside>`;
    }).join("");
    return `<article class="evidence-source">
      <p class="source-kicker">${evidenceCardLabel(statement)} ${String(index + 1)}</p>
      <h3>${escapeHtml(source.title)}</h3>
      <blockquote>${escapeHtml(item.excerpt.exactExcerpt)}</blockquote>
      ${renderedAnnotations}
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
        <section class="related-statement"><p class="section-label">Related statement · ${escapeHtml(stateLabel(statement))}</p>${inlineExactSource(statement, lookup, annotations)}</section>
        ${support === "" ? '<p class="boundary-footer">No admitted excerpt resolves this question.</p>' : support}
        <section class="evidence-boundary" aria-label="Evidence boundary">
          <div><h3>What this supports</h3><p>${escapeHtml(boundary.supports)}</p></div>
          <div><h3>What remains outside it</h3><p>${escapeHtml(boundary.doesNot)}</p></div>
        </section>
      </div>
    </div>
  </dialog>`;
}
function evidenceButton(dialogId: string, accessibleName: string, label = "Evidence", className = "evidence-trigger"): string {
  return `<button class="${className}" type="button" data-dialog="${dialogId}" aria-label="${escapeHtml(accessibleName)}">${escapeHtml(label)}</button>`;
}
function inlineExactSource(
  statement: IntelligenceStatement,
  lookup: Map<string, { source: AdmittedAccountSource; excerpt: AdmittedAccountSource["excerpts"][number] }>,
  annotations: readonly Readonly<C2AccountHomeAnnotation>[],
  classes = { prose: "stage-copy", quotation: "stage-source-quote" },
): string {
  if (statement.state !== "source-backed fact") return `<p class="${classes.prose}">${escapeHtml(statement.text)}</p>`;
  const item = statement.evidenceIds.map((evidenceId) => lookup.get(evidenceId)).find((entry) => entry !== undefined);
  if (item === undefined) return `<p class="${classes.prose}">${escapeHtml(statement.text)}</p>`;
  const evidenceAnnotations = annotations.filter((annotation) =>
    annotation.sourceId === item.source.sourceId && annotation.evidenceIds.includes(item.excerpt.evidenceId));
  const renderedAnnotations = evidenceAnnotations.map((annotation) => {
    const label = annotation.kind === "source_context_caveat" ? "Source context" : "Freshness recheck";
    return `<p class="inline-source-note"><strong>${label} — not source wording:</strong> ${escapeHtml(annotation.text)}</p>`;
  }).join("");
  return `<figure class="${classes.quotation}"><blockquote>${escapeHtml(item.excerpt.exactExcerpt)}</blockquote><figcaption>Quoted exactly · ${escapeHtml(item.source.publisher)}</figcaption>${renderedAnnotations}</figure>`;
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
    coverageGapCount: p.researchCoverage.filter((item) => item.status === "gap").length,
  });
}

export function renderC2AccountHome(
  data: Readonly<ValidatedAccountIntelligence>,
  annotationInput: readonly C2AccountHomeAnnotation[] = [],
): Readonly<C2AccountHomeArtifact> {
  const view = buildViewModel(data);
  const lookup = evidenceLookup(data);
  const statements = displayedStatements(view);
  const annotations = snapshotC2AccountHomeAnnotations(annotationInput, data);
  const ids = ["thesis", "established", "changed", "meaning", "open", "next"];
  const dialogs = statements.map((statement, index) =>
    dialogFor(statement, `evidence-${ids[index]!}`, index === 0 ? "Account thesis" : stateLabel(statement), lookup, annotations)).join("");
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
  <section class="account-hero" aria-labelledby="account-title"><div><h1 id="account-title">${escapeHtml(view.accountName)}</h1>${inlineExactSource(view.thesis, lookup, annotations, { prose: "account-thesis", quotation: "account-thesis account-thesis-source" })}<div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.thesis))}</span>${evidenceButton("evidence-thesis", `Evidence context for ${view.accountName} account thesis`)}</div></div><aside class="hero-aside"><p>Answers first. Evidence on demand. Machinery by invitation.</p></aside></section>
  <section class="grammar" aria-label="Editorial Evidence Synthesis">
    <div class="context-plane">
      <article class="stage established"><span class="stage-num" aria-hidden="true">01</span><p class="stage-kicker">Established</p><h2>Established</h2>${inlineExactSource(view.established, lookup, annotations)}<div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.established))}</span>${evidenceButton("evidence-established", `${evidenceAccessibleLabel(view.established)} for ${view.accountName} established statement`)}</div></article>
      <article class="stage changed"><span class="stage-num" aria-hidden="true">02</span><p class="stage-kicker">Meaningfully changed</p><h2>Meaningfully changed</h2>${inlineExactSource(view.changed, lookup, annotations)}<p class="analysis-line"><strong>Why it may matter:</strong> ${escapeHtml(view.whyItMayMatter.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.changed))}</span>${evidenceButton("evidence-changed", `${evidenceAccessibleLabel(view.changed)} for ${view.accountName} meaningfully changed statement`)}${evidenceButton("evidence-meaning", `Related evidence context for ${view.accountName} why-it-may-matter interpretation`, "Analysis boundary")}</div></article>
    </div>
    <div class="decision-plane">
      <article class="stage open"><span class="stage-num" aria-hidden="true">03</span><p class="stage-kicker">Still open</p><h2>Still open</h2><p class="stage-copy">${escapeHtml(view.stillOpen.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.stillOpen))}</span>${evidenceButton("evidence-open", `Related evidence context for why ${view.accountName} question remains open`, "Why this is open")}</div></article>
      <article class="stage next"><span class="stage-num" aria-hidden="true">04</span><p class="stage-kicker">Recommended next move</p><h2>Recommended next move</h2><p class="stage-copy">${escapeHtml(view.nextMove.text)}</p><div class="statement-tools"><span class="statement-state">${escapeHtml(stateLabel(view.nextMove))}</span></div>${evidenceButton("evidence-next", `Related evidence context for ${view.accountName} recommended next move`, "Review the support", "primary-action")}</article>
    </div>
  </section>
  <details class="research-disclosure"><summary>Research coverage and boundaries</summary><div class="research-grid"><section><h3>Coverage</h3><ul class="coverage-list">${coverage}</ul></section><section><h3>Entity boundaries</h3><ul>${boundaries}</ul><h3>Material gaps</h3><ul>${gaps}</ul><p class="boundary-footer">Model proposal: ${escapeHtml(data.effectReceipt.provider)} / ${escapeHtml(data.effectReceipt.model)} · ${String(data.effectReceipt.providerCallsAttempted)} call attempted · ${String(data.effectReceipt.providerCallsSucceeded)} response admitted. Retained records: ${String(data.effectReceipt.recordedDiscoveryRecords)} discoveries · ${String(data.effectReceipt.retainedSourceCandidates)} source candidates · ${String(data.effectReceipt.admittedSources)} admitted · ${String(data.effectReceipt.excludedSourceCandidates)} excluded. These records do not prove external searches or retrievals executed. Provider storage, tools, and network effects remain unestablished. No Graph, database, publication, customer, or deployment effects were created by this local path.</p></section></div></details>
  <p class="boundary-footer">Proposed account intelligence for local review only. Nothing here is approved, saved to durable account truth, sent, shared, deployed, or used to prepare a meeting.</p>
</main>${dialogs}<script>${C2_ACCOUNT_HOME_SCRIPT}</script></div></body></html>`;
  return Object.freeze({ kind: "c2-governed-account-intelligence-home", schemaVersion: "1", viewModel: view,
    html, boundary: C2_ACCOUNT_HOME_RENDER_BOUNDARY });
}
