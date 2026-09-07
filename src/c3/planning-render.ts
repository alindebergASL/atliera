import { isCuratedContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";
import type { PlanningBrief, SectionNotes } from "./planning.ts";

const esc = (value: string): string => value.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Presentation labels only; the admitted gap strings remain available verbatim. */
export function businessGapLabel(raw: string): string {
  const labels: Record<string, string> = {
    identity_structure: "Account identity and structure",
    strategic_direction: "Strategic direction",
    financial_context: "Financial position",
    digital_modernization: "Modernization priorities",
    leadership_governance: "Leadership and decision authority",
    procurement: "Buying process",
    partnerships_technology: "Technology and partners",
    constraints: "Constraints",
    recent_changes: "Recent developments",
    gaps_contradictions: "Evidence gaps and conflicts",
  };
  const category = /^No controller-authorized excerpt-level support for taxonomy:([a-z_]+)\.$/u.exec(raw)?.[1];
  return category && labels[category] ? `${labels[category]} not established in supplied evidence.` : raw;
}

export function accountGaps(frozen: FrozenC3AccountContext): string {
  const { materialGaps: gaps, declaredContradictions: conflicts } = frozen.context;
  if (!gaps.length && !conflicts.length) return "";
  return `<section class="checks" aria-label="Account context gaps and conflicts"><h2>Still to establish</h2>${conflicts.map((text) => `<p class="warning"><strong>Conflicting context.</strong> ${esc(text)}</p>`).join("")}<ul>${gaps.slice(0, 3).map((text) => `<li>${esc(businessGapLabel(text))}</li>`).join("")}</ul>${gaps.length > 3 ? `<details><summary>All ${gaps.length} account gaps</summary><ul>${gaps.map((text) => `<li>${esc(businessGapLabel(text))}</li>`).join("")}</ul></details>` : ""}<details class="technical-detail"><summary>Raw gap and conflict details</summary>${[...conflicts, ...gaps].map((text) => `<p>${esc(text)}</p>`).join("")}</details></section>`;
}

function statement(frozen: FrozenC3AccountContext, item: FrozenC3AccountContext["context"]["proposal"]["accountThesis"], label: string): string {
  const evidence = frozen.context.admittedSources.flatMap((source) => source.excerpts);
  const links = item.evidenceIds.map((id) => {
    const index = evidence.findIndex((excerpt) => excerpt.evidenceId === id);
    return index < 0 ? "" : `<a id="cite-intel-${esc(label.replace(/[^a-z0-9]+/gu, "-"))}-${index + 1}" data-evidence-link data-context="${esc(label)}" href="#evidence-${index + 1}">Evidence ${index + 1}</a>`;
  }).join(" ");
  return `<p>${esc(item.text)}</p><p class="support"><span>Proposed · ${esc(item.state)}</span>${links || " · No evidence asserted"}</p>`;
}

export function accountOverview(frozen: FrozenC3AccountContext): string {
  const { account, proposal } = frozen.context;
  const admitted = account.admittedContext;
  return `<section class="draft-section account-overview"><h2>Overall account context</h2><p>${esc(admitted.sector ?? "Sector not established")} · ${esc(admitted.geography ?? "Geography not established")}</p>${proposal.establishedContext[0] ? statement(frozen, proposal.establishedContext[0], "account overview") : '<p>No source-backed account facts are established in the supplied proposal.</p>'}<p class="meta">Context requested ${esc(account.requestedAt.slice(0, 10))}. This is a request date, not evidence of freshness. No new research has run.</p></section>`;
}

function planningContext(frozen: FrozenC3AccountContext, brief: PlanningBrief): string {
  const { account, proposal, materialGaps, declaredContradictions, admittedSources } = frozen.context;
  const startingPoint = brief.kind === "strategy" ? proposal.meaningfullyChanged[0] ?? proposal.establishedContext[0] : proposal.recommendedNextMove;
  return `<aside class="work-context" aria-label="Account context for this brief"><h2>${esc(account.accountName)} · starting context</h2>${statement(frozen, proposal.accountThesis, "planning orientation")}${brief.kind === "next-steps" && proposal.establishedContext[0] ? statement(frozen, proposal.establishedContext[0], "planning account fact") : ""}${startingPoint ? `<h3>${brief.kind === "strategy" ? (proposal.meaningfullyChanged[0] ? "Development to evaluate" : "Account fact to consider") : "Next move to consider"}</h3>${statement(frozen, startingPoint, "planning starting point")}` : ""}${!admittedSources.length ? '<p>No admitted sources. Establish priorities before drawing conclusions.</p>' : ""}${declaredContradictions.map((text) => `<p class="warning"><strong>Conflicting context.</strong> ${esc(text)}</p>`).join("")}${materialGaps[0] ? `<p><strong>Open gap:</strong> ${esc(businessGapLabel(materialGaps[0]))}</p>` : ""}<p class="meta">Interpretations are hypotheses; recommendations are proposed. Source dates do not establish current status or change from a prior review.</p><a href="#account-details">Full account context and gaps</a></aside>`;
}

export function workshopKinds(current: string): string {
  return `<nav class="journey-nav brief-kinds" aria-label="Workshop brief kind">${[["meeting", "Meeting", "/?prepare=1"], ["strategy", "Strategy", "/?kind=strategy"], ["next-steps", "Next steps", "/?kind=next-steps"]].map(([kind, label, url]) => `<a href="${url}"${current === kind ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
}

/** Account context is read-only. Planning prose never feeds back into this projection. */
export function accountIntelSections(frozen: FrozenC3AccountContext, includeGaps = true): string {
  const context = frozen.context;
  const admitted = context.account.admittedContext;
  const evidence = context.admittedSources.flatMap((source) => source.excerpts.map((excerpt) => ({ source, excerpt })));
  const refs = (ids: readonly string[], label: string) => ids.map((id) => {
    const index = evidence.findIndex((item) => item.excerpt.evidenceId === id);
    return index < 0 ? "" : `<a id="cite-intel-${esc(label.replace(/[^a-z0-9]+/gu, "-"))}-${index + 1}" data-evidence-link data-context="${esc(label)}" href="#evidence-${index + 1}">Evidence ${index + 1}</a>`;
  }).join(" · ");
  const statements = (items: typeof context.proposal.establishedContext, label: string) => items.length === 0 ? '<p class="meta">Not established in the supplied context.</p>' : items.map((item, index) => `<article><p>${esc(item.text)}</p><p class="support"><span>Proposed · ${esc(item.state)}</span>${refs(item.evidenceIds, `${label}-${index}`)}</p></article>`).join("");
  const related = context.entities.filter((item) => item.entityId !== context.account.accountId);
  return `<details id="account-details" class="account-details"><summary>Full account context and gaps</summary><section class="draft-section"><h2>Supplied account context</h2><p>${esc(admitted.sector ?? "Sector not established")} · ${esc(admitted.geography ?? "Geography not established")}</p>${admitted.notes.map((note) => `<p>${esc(note)}</p>`).join("")}<p class="meta">Context requested ${esc(context.account.requestedAt.slice(0, 10))}. Request date does not establish freshness. No new research has run.</p>${statements(context.proposal.establishedContext, "context")}</section><section class="draft-section"><h2>Developments and priorities to validate</h2><p class="meta">Proposed orientation, not approved account truth. No prior revision is available to establish change.</p>${statements(context.proposal.meaningfullyChanged, "development")}${statements(context.proposal.whyChangeMayMatter, "priority")}</section><section class="draft-section"><h2>Stakeholders and relationships</h2>${related.length ? `<ul>${related.map((item) => `<li><strong>${esc(item.name)}</strong> · ${esc(item.kind)}<br>${esc(context.relationships.find((relationship) => relationship.entityId === item.entityId)?.relationshipToAccount ?? item.relationshipToAccount)}</li>`).join("")}</ul><p class="meta">${isCuratedContext(frozen) ? "Proposed" : "Admitted"} entity relationships do not establish personal decision authority.</p>` : '<p>No stakeholder or related-entity relationships are established in this context. Confirm participants and decision authority.</p>'}</section>${includeGaps ? accountGaps(frozen) : ""}</details><section class="evidence-list"><h2>Account evidence</h2><p class="meta">Exact retained excerpts. Context for a proposal is not proof of its interpretation. Source dates do not establish current status.</p>${evidence.length === 0 ? '<p>No admitted sources. Use the open questions as a discovery plan; no evidence-backed conclusion is available.</p>' : evidence.map(({ source, excerpt }, index) => `<details id="evidence-${index + 1}"><summary>Evidence ${index + 1} · ${esc(source.title)}</summary>${source.untrustedInstructionsDetected ? '<p class="warning">Untrusted instructions detected. Inspection only; excluded from draft evidence.</p>' : ""}<a data-evidence-return hidden href="#main">Return to context</a><blockquote>${esc(excerpt.exactExcerpt)}</blockquote><p class="meta">${esc(source.publisher)} · Published ${esc(source.publicationDate ?? "Undated")} · Event ${esc(source.eventDate ?? "Undated")} · Current through ${esc(source.evidenceCurrentThrough ?? "Not established")}</p>${context.rendererAnnotations.filter((item) => item.sourceId === source.sourceId).map((item) => `<p class="warning">${esc(item.text)}</p>`).join("")}<details><summary>Full retained source context</summary><p class="meta">Supplied bounded clean text; not original document completeness.</p><pre class="source-text" tabindex="0">${esc(source.fullBoundedCleanText)}</pre></details></details>`).join("")}</section>`;
}

export function sectionNoteEditor(title: string, recordId: string, notes: SectionNotes, pending: boolean): string {
  const text = notes[title] ?? "";
  const key = title.toLowerCase().replace(/[^a-z]+/gu, "-");
  return `<div class="section-note"><p data-saved-copy class="user-copy">${text ? `User note · ${esc(text)}` : "No user note for this section."}</p><details><summary>Note or correction for ${esc(title)}</summary><p class="meta">User-authored session note. The recorded model text above stays unchanged. Only the exact recorded correction in Draft review can replay a revision.</p><form data-local-edit data-edit-key="meeting-${key}" data-endpoint="/api/section-note" data-record-id="${esc(recordId)}" data-section="${esc(title)}"><label for="note-${key}">Your note for ${esc(title)}</label><textarea id="note-${key}" name="text" maxlength="1000"${pending ? " disabled" : ""}>
${esc(text)}</textarea><p data-local-status role="status"></p><div class="hero-actions"><button type="submit"${pending ? " disabled" : ""}>Keep section note</button><button type="button" class="secondary" data-local-cancel${pending ? " disabled" : ""}>Cancel edit</button></div></form></details></div>`;
}

export function planningPage(context: FrozenC3AccountContext, brief: PlanningBrief): string {
  if (context.context.ownerCorrections.some((item) => item.text.includes("not enabled"))) {
    return `<main id="main" tabindex="-1"><p class="eyebrow">Workshop</p><h1>Preparation held</h1><p class="warning">This account is held pending its recorded C2 revision. Session planning edits are unavailable.</p><a class="button" href="/">Return to Account Intel</a></main>`;
  }
  const title = brief.kind === "strategy" ? "Strategy brief" : "Account next steps brief";
  const field = (name: string, label: string, value: string, max: number, required = false) => `<div class="field"><label for="plan-${name}">${label}</label><textarea id="plan-${name}" name="${name}" maxlength="${max}"${required ? " required" : ""}>
${esc(value)}</textarea></div>`;
  return `<main id="main" tabindex="-1"><p class="eyebrow">Workshop</p><h1>${title}</h1><p class="lede">${brief.kind === "strategy" ? "Frame a direction, compare options, and decide what to validate." : "Turn open questions into proposed actions, owners, and a useful follow-up."}</p>${workshopKinds(brief.kind)}<p class="proposed-cue">Editable planning template · not AI-generated</p><p class="meta">User/template-authored, session-only. Use the proposed account context to shape your plan; edits never change Account Intel.</p><section class="draft-section" data-planning-version="${brief.version}"><h2>Audience and intended outcome</h2><p data-setup-summary>${brief.audience ? `${esc(brief.audience)} · ${esc(brief.intendedOutcome)}` : "Set who this is for and the result you want."}</p><details><summary>Edit brief setup</summary><form data-local-edit data-edit-key="${brief.kind}-setup" data-endpoint="/api/planning/${brief.kind}" data-version="${brief.version}">${field("audience", "Audience", brief.audience, 160, true)}${field("intendedOutcome", "Intended outcome", brief.intendedOutcome, 500, true)}${field("detail", brief.kind === "strategy" ? "Planning horizon or constraints (optional)" : "Timing or dependencies (optional)", brief.detail, 500)}<p data-local-status role="status"></p><div class="hero-actions"><button type="submit">Keep brief setup</button><button type="button" class="secondary" data-local-cancel>Cancel edit</button></div></form></details><p class="meta" data-detail-summary>${esc(brief.detail)}</p></section><div class="planning-work">${planningContext(context, brief)}<div class="planning-sections">${brief.sections.map((section) => `<section class="draft-section"><h2>${esc(section.title)}</h2><p data-saved-copy class="user-copy">${esc(section.text || "Section cleared. No conclusion asserted.")}</p><p data-authorship class="meta">${section.authorship === "template" ? "Template-authored planning prompt" : "User-authored session edit"}</p><details><summary>Edit ${esc(section.title)}</summary><form data-local-edit data-edit-key="${brief.kind}-${section.id}" data-endpoint="/api/planning/${brief.kind}" data-version="${brief.version}" data-section="${section.id}">${field("text", `Your ${section.title.toLowerCase()}`, section.text, 4000).replaceAll("plan-text", `plan-${section.id}`)}<p data-local-status role="status"></p><div class="hero-actions"><button type="submit">Keep section edit</button><button type="button" class="secondary" data-local-cancel>Cancel edit</button></div></form></details></section>`).join("")}</div></div>${accountIntelSections(context)}</main>`;
}
