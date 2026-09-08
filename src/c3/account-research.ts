import { ACCOUNT_RESEARCH_CATALOG } from "./account-research-catalog.ts";

export type AccountResearchSource = typeof ACCOUNT_RESEARCH_CATALOG.sources[number];
export type AccountResearchCandidate = typeof ACCOUNT_RESEARCH_CATALOG.candidates[number];
export interface AccountResearchInspection {
  readonly candidate: AccountResearchCandidate;
  readonly source: AccountResearchSource;
}
export type AccountResearchTopic = "people" | "technology";

/** Exact canonical identity only. This module is consumed exclusively by the Account renderer. */
export function projectAccountResearch(accountId: string): readonly AccountResearchInspection[] {
  return Object.freeze(ACCOUNT_RESEARCH_CATALOG.candidates.filter(candidate => candidate.accountId === accountId).flatMap(candidate => {
    const source = ACCOUNT_RESEARCH_CATALOG.sources.find(source => source.id === candidate.sourceId && source.accountId === accountId);
    return source ? [Object.freeze({ candidate, source })] : [];
  }));
}

function esc(value: string): string {
  return value.replace(/[&<>"']/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function sourceLink(source: AccountResearchSource): string {
  try {
    const url = new URL(source.url);
    if (url.protocol === "https:" && !url.username && !url.password && !/[\s\u0000-\u001f\u007f]/u.test(source.url)) {
      return `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.url)} <span class="meta">(new tab)</span></a>`;
    }
  } catch { /* Unavailable source navigation never prevents exact local inspection. */ }
  return '<span class="meta">Source link unavailable; the retained excerpt remains inspectable.</span>';
}

function forTopic(items: readonly AccountResearchInspection[], topic: AccountResearchTopic): readonly AccountResearchInspection[] {
  return items.filter(({ candidate }) => topic === "people" ? candidate.topic === "people" : candidate.topic === "technology" || candidate.topic === "organization");
}

/** Links from existing topic sections to the separate inspection layer; no new summary facts there. */
export function accountResearchTopicLink(items: readonly AccountResearchInspection[], topic: AccountResearchTopic): string {
  const count = forTopic(items, topic).length;
  return count ? `<p class="research-topic-entry"><a class="quiet-link" href="#account-research-${topic}">Unreviewed research · ${topic === "people" ? "public roles &amp; functions" : "IT services &amp; scope"} (${count}) <span aria-hidden="true">↗</span></a></p>` : "";
}

export function renderAccountResearch(items: readonly AccountResearchInspection[], selectedTopic?: AccountResearchTopic, inspector = false): string {
  if (!items.length) return "";
  const visibleItems = selectedTopic ? forTopic(items, selectedTopic) : items;
  if (!visibleItems.length) return "";
  const groups = (["people", "technology"] as const).filter(topic => !selectedTopic || topic === selectedTopic).map(topic => {
    const entries = forTopic(items, topic);
    if (!entries.length) return "";
    return `<div id="account-research-${topic}" class="research-group" tabindex="-1"><h3>${topic === "people" ? "Public roles &amp; functions" : "IT services &amp; scope"}</h3>${entries.map(({ candidate, source }) => `<details id="research-excerpt-${esc(candidate.id)}" class="research-inspection" data-research-excerpt="${esc(candidate.id)}"><summary><span class="research-summary">${esc(candidate.sourceAttributedSummary)}</span><span class="reading-expand">Inspect exact excerpt &amp; source</span></summary><div class="research-inspection-body"><p class="meta">Exact public excerpt · unreviewed research</p><blockquote>${esc(candidate.exactExcerpt)}</blockquote><p class="reading-limit">${esc(candidate.limitation)}</p><p class="meta">${esc(candidate.support)}.</p><p><strong>${esc(source.label)}</strong><br>${sourceLink(source)}</p><details><summary>Source details</summary><p class="meta">Acquired <time datetime="${esc(source.acquiredAt)}">${esc(source.acquiredAt)}</time>. Acquisition is not publication or currentness.</p><p class="meta">Publication date: ${esc(source.publicationDate ?? "Unknown")} · Current through: ${esc(source.evidenceCurrentThrough ?? "Unknown")}</p><p class="meta">${source.sourceUpdatedLabel === null ? "Page update label: Not supplied." : `${esc(source.sourceUpdatedLabel)}. Page label only; not an appointment date or current-through date.`}</p><p class="meta">Research excerpt reference: ${esc(candidate.id)} · Research source reference: ${esc(source.id)}. These are separate from selected evidence IDs.</p></details></div></details>`).join("")}</div>`;
  }).join("");
  const rendered = `<section id="account-unreviewed-research" class="unreviewed-research" tabindex="-1" aria-labelledby="heading-unreviewed-research"><p class="eyebrow">Separate Account inspection</p><h2 id="heading-unreviewed-research">Unreviewed research</h2><p class="section-intro">${new Set(visibleItems.map(item => item.source.id)).size} public sources · ${visibleItems.length} excerpts acquired September 8, 2026. No human approval or independent corroboration. Excluded from approved facts, preparation, Brief and model inputs.</p><p class="section-intro">Source-reported roles and service scope only; no buying-owner or reporting-line inference. Current status remains unknown. Opening this section makes no live lookup; original source links open only when you choose them.</p>${groups}</section><!-- end account unreviewed research -->`;
  if (!inspector) return rendered;
  // Public research remains a separate inspection identity; never selected draft evidence.
  return rendered.replace(/<details id="research-excerpt-([^"<>]+)"([^>]+)><summary>([\s\S]*?)<\/summary>/gu,
    (_match, id: string, attributes: string, summary: string) => `<article class="research-inspection-entry"><p>${summary}</p><a class="quiet-link" data-research-link data-context="Unreviewed public research" data-support="Inspection only · excluded from preparation and model inputs" href="#research-excerpt-${id}">Inspect source</a></article><details id="research-excerpt-${id}"${attributes}><summary>Exact excerpt and source details</summary>`);
}
