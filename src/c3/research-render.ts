import { researchPassage, type RetainedResearchSource, type ResearchPassage } from './research-source.ts';
import type { ResearchDisplay } from './research-service.ts';
import type { ResearchSnapshot } from './research-run.ts';
const esc = (value: string): string => value.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Deterministic lexical navigation only. Exact retained offsets, no finding or eligibility claim. */
export function questionPassages(source: RetainedResearchSource, question: string): readonly ResearchPassage[] {
  const stop = new Set(['what', 'which', 'where', 'when', 'with', 'from', 'current', 'about', 'their', 'this', 'that', 'have', 'does', 'availability']);
  const terms = [...new Set(question.toLowerCase().match(/[a-z]{4,}/gu) ?? [])].filter(term => !stop.has(term)).slice(0, 32);
  const text = source.cleanText;
  const candidates: { start: number; end: number; score: number }[] = [];
  // Menus often repeat across desktop/mobile markup. Repetition and prose density
  // are structural hints only; the retained projection and offsets never change.
  const words = [...text.matchAll(/\b[\p{L}][\p{L}'’-]*\b/gu)];
  const shingles = new Map<string, number>();
  for (let i = 0; i + 5 <= words.length; i++) {
    const key = words.slice(i, i + 5).map(w => w[0].toLowerCase()).join(' ');
    shingles.set(key, (shingles.get(key) ?? 0) + 1);
  }
  const rank = (start: number, end: number): void => {
    while (start < end && /\s/u.test(text[start]!)) start++;
    while (end > start && /\s/u.test(text[end - 1]!)) end--;
    // Repeated editorial sentences need a little exact adjacent context to be
    // uniquely inspectable; never rewrite the quote or invent an occurrence ID.
    while (end - start < 750 && text.indexOf(text.slice(start, end), start + 1) !== -1 && end < text.length) {
      const nextEnd = /[.!?](?:\s|$)/u.exec(text.slice(end));
      end = nextEnd ? end + nextEnd.index + 1 : Math.min(text.length, end + 60);
      while (end < text.length && !/\s/u.test(text[end]!)) end++;
    }
    const segment = text.slice(start, end);
    const lower = segment.toLowerCase();
    const matches = terms.filter(term => lower.includes(term)).length;
    const tokens = segment.match(/\b[\p{L}][\p{L}'’-]*\b/gu) ?? [];
    const prose = (lower.match(/\b(?:is|are|was|were|will|can|may|must|should|includes?|invites?|requires?|offers?|accepts?|through|that|which|when|once|provide|provides)\b/gu) ?? []).length;
    const navigation = (lower.match(/\b(?:navigation|breadcrumb|menu|skip to|log in|sign in|quick links)\b/gu) ?? []).length;
    let repeated = 0;
    for (let i = 0; i + 5 <= tokens.length; i++) if ((shingles.get(tokens.slice(i, i + 5).join(' ').toLowerCase()) ?? 0) > 1) repeated++;
    const repeatRatio = repeated / Math.max(1, tokens.length - 4);
    const titleRatio = tokens.filter(token => /^[A-Z]/u.test(token)).length / Math.max(1, tokens.length);
    if (matches && tokens.length >= 5 && prose > 0) candidates.push({ start, end,
      score: matches + Math.min(prose, 4) + (/\b(?:invit\w*|requir\w*|eligib\w*)\b/u.test(lower) ? 6 : 0) - (/^[a-z]/u.test(segment) ? 2 : 0) - 8 * repeatRatio * titleRatio - 5 * titleRatio - 4 * navigation });
  };
  for (const match of text.matchAll(/[^.!?]+[.!?]?/gu)) {
    const offset = match.index!;
    // A menu can share a punctuation-free block with the first prose sentence.
    // Add suffixes at sentence-like capital/lowercase transitions, still exact.
    for (const transition of match[0].matchAll(/\b[A-Z][\p{L}'’-]* (?:[a-z][\p{L}'’-]*[,;:]? ){2}/gu)) {
      if (transition.index! > 80 && match[0].length - transition.index! <= 850) rank(offset + transition.index!, offset + match[0].length);
    }
    if (match[0].length <= 850) rank(offset, offset + match[0].length);
    else {
      // Keep word boundaries in long punctuation-free blocks, including menus.
      // Scan the whole bounded text so repeated early menus cannot exhaust a quota.
      for (const word of match[0].matchAll(/\S+/gu)) {
        if (!terms.some(term => word[0].toLowerCase().includes(term))) continue;
        let left = Math.max(0, word.index! - 180);
        let right = Math.min(match[0].length, word.index! + word[0].length + 380);
        while (left > 0 && !/\s/u.test(match[0][left - 1]!)) left++;
        while (right < match[0].length && !/\s/u.test(match[0][right]!)) right++;
        rank(offset + left, offset + right);
      }
    }
  }
  const passages: ResearchPassage[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.start - b.start)) {
    if (passages.some(passage => Math.max(candidate.start, passage.start) < Math.min(candidate.end, passage.end))) continue;
    const candidateWords = text.slice(candidate.start, candidate.end).toLowerCase().match(/\b[\p{L}]+\b/gu) ?? [];
    const candidatePhrases = candidateWords.slice(4).map((_, i) => candidateWords.slice(i, i + 5).join(' '));
    if (passages.some(passage => {
      const existing = (passage.text.toLowerCase().match(/\b[\p{L}]+\b/gu) ?? []).join(' ');
      return candidatePhrases.length > 0 && candidatePhrases.filter(phrase => existing.includes(phrase)).length / candidatePhrases.length > 0.65;
    })) continue;
    try { passages.push(researchPassage(text, candidate.start, candidate.end)); } catch { /* No invented ambiguous excerpt. */ }
    if (passages.length === 5) break;
  }
  return passages;
}
function passageView(source: RetainedResearchSource, snapshotId: string, passage: ResearchPassage, select: boolean): string {
  return `<blockquote>${esc(passage.text)}</blockquote><p class="meta research-identity">Clean-text positions [${passage.start}, ${passage.end}) · SHA-256 ${esc(passage.sha256)}</p>${select ? `<button type="button" data-research-select data-snapshot="${esc(snapshotId)}" data-source="${esc(source.sourceId)}" data-passage="${esc(passage.sha256)}">Select exact passage for brief planning</button>` : ''}`;
}
export function renderResearchSource(source: RetainedResearchSource, snapshotId: string, question: string): string {
  const passages = questionPassages(source, question);
  return `<article class="research-source"><h3>${esc(source.publisher)}</h3><p class="research-identity">${esc(source.finalUrl)}</p><p>Source-reported text · untrusted content, never instructions or owner approval.</p><dl><dt>Entity relationship</dt><dd>${esc(source.entityId)} · ${esc(source.relationshipToAccount)}</dd><dt>Retrieved at</dt><dd>${esc(source.retrievedAt)}</dd><dt>Publication / event / current-through dates</dt><dd>Unknown / unknown / unknown</dd><dt>Capture</dt><dd>${source.rawByteLength} raw bytes · ${esc(source.mediaType)} · complete HTTP body; rendered-page completeness unknown${source.extraction.truncated ? '; clean text truncated' : ''}</dd></dl><h4>Exact passages matching question terms</h4><p class="meta">Lexical matches help locate source statements. They are not classified findings or a verified answer.</p>${passages.map(p => passageView(source, snapshotId, p, true)).join('') || '<p>No useful exact question-term passage was located. Inspect the full context; relevance is not assessed.</p>'}<details><summary>Full retained clean-text context and custody</summary><p class="research-identity">Source ${esc(source.sourceId)}<br>Snapshot ${esc(snapshotId)}<br>Raw SHA-256 ${esc(source.rawSha256)}<br>Clean-text SHA-256 ${esc(source.cleanTextSha256)}</p><pre class="research-clean-text">${esc(source.cleanText)}</pre></details></article>`;
}
export function renderResearchSnapshot(snapshot: ResearchSnapshot): string {
  return `<section><h3>Retained snapshot · ${esc(snapshot.state)}</h3><p>${esc(snapshot.updatedAt)}${snapshot.error ? ' · ' + esc(snapshot.error) : ''}</p><p>${esc(snapshot.question)}</p><p>${snapshot.coverage.retained} of ${snapshot.coverage.requested} sources captured · ${snapshot.coverage.transportInvocations} transport invocations (may fail before HTTPS)</p><ul>${snapshot.unknowns.map(s => `<li>${esc(s)}</li>`).join('')}</ul>${snapshot.coverage.unavailableUrls.length ? `<p>Unavailable captures: ${snapshot.coverage.unavailableUrls.map(esc).join(', ')}</p>` : ''}${snapshot.sources.map(source => renderResearchSource(source, snapshot.snapshotId, snapshot.question)).join('')}</section>`;
}
export function renderResearchPanel(display: ResearchDisplay): string {
  const active = display.run && !['completed', 'failed', 'cancelled', 'interrupted'].includes(display.run.state);
  const latest = display.snapshots.at(-1);
  return `<section class="account-section bounded-research" data-research-panel data-research-active="${active ? 'true' : 'false'}"><h2>Bounded source research</h2>${display.question ? `<p class="lede">${esc(display.question)}</p>` : ''}<p>${esc(display.reason)}</p>${display.configured ? `<p>${display.requested} exact pages in scope · ${display.remainingRuns} runs remaining (initial plus at most one refresh).</p><div class="research-actions"><button type="button" data-research-start ${!display.available || active || latest ? 'disabled' : ''}>Start research</button><button type="button" data-research-refresh data-snapshot="${esc(latest?.snapshotId ?? '')}" ${!display.available || active || !latest ? 'disabled' : ''}>Refresh once</button>${active ? `<button type="button" data-research-cancel data-run="${esc(display.run!.runId)}">Cancel research</button>` : ''}<button type="button" data-research-status>Check status</button>${latest?.state === 'interrupted' ? '<button type="button" data-research-recover>Record interrupted recovery</button>' : ''}</div>` : ''}<p role="status" aria-live="polite" data-research-message>${display.run ? `${esc(display.run.state)} · ${display.run.captured}/${display.requested} sources captured · ${display.run.attempts} reserved attempts · ${esc(display.run.updatedAt)}${display.run.error ? ' · ' + esc(display.run.error) : ''}` : 'No research run in this browser session.'}</p>${display.run?.error ? '<p>Captured sources and consumed reservations are kept. Cancellation or failure does not restore the allowance. Recovery records interruption only; another acquisition requires an explicit refresh within the remaining cap.</p>' : ''}${display.comparison.length ? `<h3>Refresh observations</h3><p>Changes in captured raw bodies, not inferred real-world service changes. Unavailable means acquisition failed, not that a service was removed.</p><ul>${display.comparison.map(item => `<li>${esc(item.change)} · ${esc(item.url)}${item.cleanTextChanged === null ? '' : ` · clean text ${item.cleanTextChanged ? 'changed' : 'unchanged'}`}</li>`).join('')}</ul>` : ''}${latest ? `<p>Latest snapshot: ${esc(latest.state)} · ${esc(latest.updatedAt)}${latest.error ? ' · ' + esc(latest.error) : ''}</p><h3>Source-reported material</h3><p>Inference, declared conflict classification and generation eligibility: not assessed. Current access and service readiness are not established by retrieval.</p><p>${latest.coverage.retained}/${latest.coverage.requested} requested sources captured.</p>${latest.sources.map(source => `<article><h4>${esc(source.publisher)}</h4>${questionPassages(source, latest.question).slice(0, 1).map(p => passageView(source, latest.snapshotId, p, false)).join('') || '<p>No question-term passage located. Inspect context to assess relevance.</p>'}<button type="button" data-research-source data-snapshot="${esc(latest.snapshotId)}" data-source="${esc(source.sourceId)}">Inspect source and full context</button></article>`).join('')}<details><summary>Historical source snapshots (${display.snapshots.length})</summary>${display.snapshots.map(snapshot => `<p class="research-identity">${esc(snapshot.state)} · ${esc(snapshot.updatedAt)}${snapshot.error ? ' · ' + esc(snapshot.error) : ''} · ${esc(snapshot.snapshotId)} <button type="button" data-research-snapshot data-snapshot="${esc(snapshot.snapshotId)}">Inspect snapshot</button></p>`).join('')}</details>` : ''}<div data-research-inspection></div><p class="meta">Captured sources do not automatically enter a brief. Selection carries exact snapshot/source/passage identity; validated admission is still required. Existing briefs keep their original evidence.</p></section>`;
}
export const RESEARCH_CLIENT_SCRIPT = `
  const researchRoot = document.querySelector('[data-bounded-research]');
  let researchBusy = false;
  let researchTimer;
  const researchSchedule = () => {
    if (!researchRoot) return;
    clearTimeout(researchTimer);
    if (researchRoot?.querySelector('[data-research-active="true"]')) researchTimer = setTimeout(() => researchAction(() => requestJson('/api/research/status', {})), 900);
  };
  const researchAction = async (request) => {
    if (!researchRoot || researchBusy) return;
    researchBusy = true;
    try {
      const result = await request();
      if (result.panelHtml) researchRoot.innerHTML = result.panelHtml;
      const inspection = researchRoot.querySelector('[data-research-inspection]');
      if (inspection && result.inspectionHtml) { inspection.innerHTML = result.inspectionHtml; inspection.setAttribute('tabindex', '-1'); inspection.focus(); }
      if (result.location) { window.location.assign(result.location); return; }
      if (result.selection) {
        const message = researchRoot.querySelector('[data-research-message]');
        if (message) message.textContent = result.selection.reason + ' Snapshot ' + result.selection.snapshotId + '; source ' + result.selection.sourceId + '; passage ' + result.selection.passage.sha256;
        if (inspection) {
          const action = document.createElement('button');
          action.type = 'button'; action.textContent = 'Validate passage and set up targeted brief';
          action.addEventListener('click', () => researchAction(() => requestJson('/api/research/prepare', {
            snapshotId: result.selection.snapshotId, sourceId: result.selection.sourceId, passageSha256: result.selection.passage.sha256
          })));
          inspection.append(action);
        }
      }
    } catch (error) {
      const message = researchRoot.querySelector('[data-research-message]');
      if (message) message.textContent = error.message + ' Check status or repeat the same action; its persistent reservation is reused.';
    } finally { researchBusy = false; researchSchedule(); }
  };
  researchRoot?.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled || researchBusy) return;
    if (button.hasAttribute('data-research-start')) researchAction(() => requestJson('/api/research/start', {}));
    if (button.hasAttribute('data-research-refresh')) researchAction(() => requestJson('/api/research/refresh', { snapshotId: button.dataset.snapshot }));
    if (button.hasAttribute('data-research-cancel')) researchAction(() => requestJson('/api/research/cancel', { runId: button.dataset.run }));
    if (button.hasAttribute('data-research-status')) researchAction(() => requestJson('/api/research/status', {}));
    if (button.hasAttribute('data-research-recover')) researchAction(() => requestJson('/api/research/recover', {}));
    if (button.hasAttribute('data-research-snapshot')) researchAction(() => requestJson('/api/research/snapshot', { snapshotId: button.dataset.snapshot }));
    if (button.hasAttribute('data-research-source')) researchAction(() => requestJson('/api/research/source', { snapshotId: button.dataset.snapshot, sourceId: button.dataset.source }));
    if (button.hasAttribute('data-research-select')) researchAction(() => requestJson('/api/research/select', { snapshotId: button.dataset.snapshot, sourceId: button.dataset.source, passageSha256: button.dataset.passage }));
  });
  researchSchedule();
`;
