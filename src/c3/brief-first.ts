/** Brief-first reading surface and one canonical clean export formatter.
 *  Authored copy renders with explicit user-authored attribution; unchanged records render as an
 *  honest backward-compatible reading projection. No DOM scraping: the same canonical value drives
 *  Copy, Markdown and text downloads, recomputed whenever the surface re-renders. */

import type { FrozenC3ViewContext } from './view-context.ts';
import type { C3GenerationRecord, C3SupportedText } from './generation-contract.ts';
import type { AuthoredMeetingCopy } from './authored-copy.ts';

export interface BriefReadingFact {
  readonly text: string;
  readonly evidenceIds: readonly string[];
}
export interface BriefReadingQuestion {
  readonly question: string;
  readonly probe?: string;
}
/** Canonical export value: everything Copy/download produces, from the exact displayed content. */
export interface BriefReading {
  readonly mode: 'user-authored' | 'generated-record';
  readonly title: string;
  readonly subtitle: string;
  readonly purpose: string;
  readonly purposeLabel: string;
  readonly facts: readonly BriefReadingFact[];
  readonly factsLabel: string;
  readonly openingLabel: string;
  readonly closeLabel: string;
  readonly materialLimitations: readonly string[];
  readonly sourceDates: readonly string[];
  readonly factsNote?: string;
  readonly interpretation: string;
  readonly interpretationLabel: string;
  readonly opening: string;
  readonly questions: readonly BriefReadingQuestion[];
  readonly close: string;
  readonly uncertainty: string;
  readonly evidenceCount: number;
  readonly sourceCount: number;
  readonly sourceTitles: readonly string[];
  readonly sourceUrls: readonly string[];
  readonly provenanceLine: string;
  readonly pendingNote?: string;
}

const safeSourceUrl = (value: string): string | null => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash ? url.href : null; } catch { return null; }
};
const uniqueSources = (refs: readonly string[], context: FrozenC3ViewContext) => {
  const map = byEvidence(context);
  return [...new Map(refs.flatMap(id => { const item = map.get(id); return item ? [[item.source.canonicalUrl, item.source] as const] : []; })).values()];
};
const dates = (source: FrozenC3ViewContext['context']['admittedSources'][number]) =>
  `Published: ${source.publicationDate ?? 'unknown'}; event: ${source.eventDate ?? 'unknown'}; current through: ${source.evidenceCurrentThrough ?? 'unknown'}. Retrieval is not a publication date.`;
const supportLabel = (item: C3SupportedText): string => ({ direct_support: 'source-supported statement', cautious_inference: 'hypothesis, not established fact', unknown: 'unknown', recommendation: 'suggestion', open_question: 'open question' })[item.supportCategory];

const byEvidence = (context: FrozenC3ViewContext) => new Map(context.context.admittedSources
  .flatMap(source => source.excerpts.map(excerpt => [excerpt.evidenceId, { source, excerpt }] as const)));

/** Reading projection of an UNCHANGED generated record. Old drafts keep whatever passages they
 *  actually selected — unknown stays unknown; distinct risks are never trimmed or manufactured. */
export function generatedReading(record: C3GenerationRecord, context: FrozenC3ViewContext, origin: 'live' | 'historical-replay' | 'synthetic' | 'unknown' = 'unknown'): BriefReading {
  const draft = record.draft!;
  const map = byEvidence(context);
  const refs = draft.selectedEvidenceRefs;
  const sources = uniqueSources(refs, context);
  const facts = refs.flatMap(id => { const item = map.get(id); return item ? [{ text: item.excerpt.exactExcerpt, evidenceIds: [id] }] : []; });
  return {
    mode: 'generated-record',
    title: record.meetingRequest.intendedOutcome.slice(0, 160),
    subtitle: `${record.meetingRequest.audience} · ${String(record.meetingRequest.durationMinutes)} minutes`,
    purpose: draft.objective.text,
    purposeLabel: `Purpose · ${supportLabel(draft.objective)}`,
    facts,
    factsLabel: 'Selected source passages',
    ...(refs.length === 0 ? { factsNote: 'No evidence selected. This content does not establish account facts.' } : {}),
    openingLabel: `Suggested opening · ${supportLabel(draft.opening)}`,
    closeLabel: `Suggested close · ${supportLabel(draft.closeCriterion)}`,
    materialLimitations: [...new Set([...draft.risksUnknowns.slice(1).map(item => item.text), ...draft.warnings.map(item => item.message)])],
    sourceDates: sources.map(source => [...new Set(context.context.admittedSources.filter(item => item.canonicalUrl === source.canonicalUrl && item.excerpts.some(excerpt => refs.includes(excerpt.evidenceId))).map(dates))].join(' / ')),
    interpretation: draft.audienceThesis.text,
    interpretationLabel: `Interpretation · ${supportLabel(draft.audienceThesis)}`,
    opening: draft.opening.text,
    questions: draft.questions.map(item => ({ question: item.question })),
    close: draft.closeCriterion.text,
    uncertainty: draft.risksUnknowns.length ? draft.risksUnknowns[0]!.text : 'No risks or unknowns were recorded for this draft.',
    evidenceCount: refs.length,
    sourceCount: sources.length,
    sourceTitles: sources.map(source => source.title),
    sourceUrls: sources.map(source => source.canonicalUrl),
    provenanceLine: `${{ live: 'Live generated', 'historical-replay': 'Historical replay', synthetic: 'Synthetic example', unknown: 'Origin not established' }[origin]} · original record unchanged · user review pending`,
  };
}

/** Authored copy becomes the same canonical shape with mandatory user-authored attribution. */
export function authoredReading(copy: AuthoredMeetingCopy, context: FrozenC3ViewContext, record?: C3GenerationRecord): BriefReading {
  const sources = uniqueSources(copy.selectedEvidenceRefs, context);
  return {
    mode: 'user-authored',
    title: copy.title,
    subtitle: `Proposed discovery brief · ${copy.audience} · ${copy.duration}`,
    purpose: copy.purpose,
    purposeLabel: 'Purpose',
    factsLabel: copy.selectedEvidenceRefs.length === 0 ? 'User-authored statements' : copy.facts.length === 3 ? 'Three relevant facts from the selected material' : 'Selected material (user-authored)',
    ...(copy.selectedEvidenceRefs.length === 0 ? { factsNote: 'No evidence selected. Authored statements are not established account facts.' } : {}),
    openingLabel: 'Suggested opening',
    closeLabel: 'Suggested close',
    materialLimitations: [...new Set([...(record?.draft?.risksUnknowns.map(item => item.text) ?? []), ...(record?.draft?.warnings.map(item => item.message) ?? []), ...context.context.declaredContradictions.map(item => 'Unresolved context conflict: ' + item)])].filter(item => item !== copy.uncertainty),
    sourceDates: sources.map(source => [...new Set(context.context.admittedSources.filter(item => item.canonicalUrl === source.canonicalUrl && item.excerpts.some(excerpt => copy.selectedEvidenceRefs.includes(excerpt.evidenceId))).map(dates))].join(' / ')),
    facts: copy.facts.map(text => ({ text, evidenceIds: [] })),
    interpretation: copy.interpretation,
    interpretationLabel: 'Interpretation to explore · hypothesis, not evidence',
    opening: copy.opening,
    questions: copy.questions.map(item => ({ question: item.question, ...(item.probe !== undefined ? { probe: item.probe } : {}) })),
    close: copy.close,
    uncertainty: copy.uncertainty,
    evidenceCount: copy.selectedEvidenceRefs.length,
    sourceCount: sources.length,
    sourceTitles: sources.map(source => source.title),
    sourceUrls: sources.map(source => source.canonicalUrl),
    provenanceLine: 'User-authored meeting copy · not a model-generated record',
  };
}

function esc(value: string): string {
  return value.replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

/** THE canonical clean export formatter: one implementation shared by Copy, text and Markdown. */
export function formatBriefExport(reading: BriefReading): string {
  const lines: string[] = [
    `# ${reading.title}`,
    `*${reading.subtitle}*`,
    '',
    `## ${reading.purposeLabel}`,
    reading.purpose,
    '',
    `## ${reading.factsLabel}`,
    ...reading.facts.map((fact, index) => `${String(index + 1)}. ${fact.text}`),
  ];
  if (reading.factsNote) lines.push('', `*${reading.factsNote}*`);
  lines.push('',
    `**Evidence foundation:** ${String(reading.evidenceCount)} selected passage${reading.evidenceCount === 1 ? '' : 's'} from ${String(reading.sourceCount)} source${reading.sourceCount === 1 ? '' : 's'}${reading.sourceTitles.length ? ` (${reading.sourceTitles.map(title => `"${title}"`).join(', ')})` : ''}.`,
    '',
    `## ${reading.interpretationLabel}`,
    reading.interpretation,
    '',
    `## ${reading.openingLabel}`,
    reading.opening,
    '',
    `## ${reading.questions.length === 3 ? 'Three questions' : 'Questions'}`,
    ...reading.questions.map((item, index) => {
      const probe = item.probe !== undefined && item.probe.length > 0 ? `\n   *Optional probe: ${item.probe.replace(/^optional probe:\s*/iu, '')}*` : '';
      return `${String(index + 1)}. ${item.question}${probe}`;
    }),
    '',
    `## ${reading.closeLabel}`,
    reading.close,
    '',
    `## Current status needs confirmation`,
    reading.uncertainty,
    '',
    ...(reading.materialLimitations.length ? ['## Material limitations', ...reading.materialLimitations.map(item => '- ' + item), ''] : []),
    `---`,
    reading.provenanceLine,
    ...(reading.pendingNote ? [reading.pendingNote] : []),
    ...reading.sourceTitles.map((title, index) => `${title} · ${safeSourceUrl(reading.sourceUrls[index]!) ?? 'Source link unavailable'}\n${reading.sourceDates[index]}`),
    '');
  return lines.join('\n');
}

/** Generic escaped renderer for the /?brief=1 page. No hardcoded account content. */
export function renderBriefReading(reading: BriefReading, record: C3GenerationRecord, context: FrozenC3ViewContext,
  options: { readonly accountPrefix?: string; readonly savedState?: string; readonly hasAuthoredEditor: boolean }): string {
  const provenanceClass = reading.mode === 'user-authored' ? 'brief-authored' : 'brief-generated';
  const factList = reading.facts.map(fact => `<li>${esc(fact.text)}</li>`).join('');
  const questions = reading.questions.map((item, index) => `<li>${esc(item.question)}${item.probe !== undefined && item.probe.length > 0 ?
    `<details class="optional-probe"><summary>Optional probe — only if relevant</summary><p>${esc(item.probe)}</p></details>` : ''}</li>`).join('');
  return `<section class="brief-reading ${provenanceClass}" data-brief-reading data-brief-mode="${esc(reading.mode)}" data-record-id="${esc(record.recordId)}">
<header><h2>${esc(reading.title)}</h2><p class="brief-subtitle">${esc(reading.subtitle)}</p>
<p class="provenance-badge">${esc(reading.provenanceLine)}</p>${reading.pendingNote ? `<p class="meta">${esc(reading.pendingNote)}</p>` : ''}${options.savedState ? `<p class="meta" data-brief-saved-state>${esc(options.savedState)}</p>` : ''}</header>
<div class="brief-purpose"><h3>${esc(reading.purposeLabel)}</h3><p>${esc(reading.purpose)}</p></div>
<div class="brief-facts"><h3>${esc(reading.factsLabel)}</h3><ol>${factList}</ol>${reading.factsNote ? `<p class="meta">${esc(reading.factsNote)}</p>` : ''}<p class="meta">Evidence foundation: ${String(reading.evidenceCount)} selected passage${reading.evidenceCount === 1 ? '' : 's'} from ${String(reading.sourceCount)} source${reading.sourceCount === 1 ? '' : 's'}.</p></div>
<div class="brief-interpretation"><h3>${esc(reading.interpretationLabel)}</h3><p>${esc(reading.interpretation)}</p></div>
<div class="brief-opening"><h3>${esc(reading.openingLabel)}</h3><p>${esc(reading.opening)}</p></div>
<div class="brief-questions"><h3>${reading.questions.length === 3 ? 'Three questions' : 'Questions'}</h3><ol>${questions}</ol></div>
<div class="brief-close"><h3>${esc(reading.closeLabel)}</h3><p>${esc(reading.close)}</p></div>
<div class="brief-uncertainty"><h3>Current status needs confirmation</h3><p>${esc(reading.uncertainty)}</p></div>
${reading.materialLimitations.length ? `<section class="brief-material-limits"><h3>Material limitations</h3><ul>${reading.materialLimitations.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>` : ''}
<p class="brief-evidence-return"><a class="quiet-link" href="${esc((options.accountPrefix ?? '') + '/?draft=1')}">Deep evidence, original draft and history →</a></p>
<details class="brief-source-list"><summary>Selected sources</summary><ul>${reading.sourceTitles.map((title, index) => `<li>${esc(title)}${safeSourceUrl(reading.sourceUrls[index]!) ? ` · <a href="${esc(safeSourceUrl(reading.sourceUrls[index]!)!)}" target="_blank" rel="noreferrer">Open source</a>` : ''}<p class="meta">${esc(reading.sourceDates[index]!)}</p></li>`).join('')}</ul></details>
</section>`;
}
