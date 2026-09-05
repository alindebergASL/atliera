import { createHash } from "node:crypto";

import type { FrozenC3AccountContext } from "./context.ts";
import type { C3GenerationRecord, C3MeetingFormState, C3SupportedText } from "./draft.ts";

type C3PendingState = { readonly revisionPending: true; readonly pendingRevisionToken: string } |
  { readonly revisionPending?: false; readonly pendingRevisionToken?: never };

export type C3PageState = (
  | { readonly page: "home"; readonly hasDraft?: boolean }
  | { readonly page: "prepare"; readonly request: C3MeetingFormState; readonly error?: string; readonly hasDraft?: boolean;
      readonly correctionNote?: string }
  | { readonly page: "draft"; readonly record: C3GenerationRecord; readonly correctionNote: string }) & C3PendingState;

export interface C3RenderOptions {
  readonly correctionNote: string;
  readonly initialRequest: C3MeetingFormState;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function humanDate(value: string | null): string {
  if (value === null) return "Date not established";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

const SCRIPT = `
(() => {
  const csrf = document.querySelector('meta[name="c3-csrf"]')?.getAttribute('content') || '';
  const account = document.querySelector('meta[name="c3-account"]')?.getAttribute('content') || '';
  const recordedReplay = document.querySelector('meta[name="c3-recorded-replay"]')?.getAttribute('content') === 'true';
  const cachePrefix = 'atliera.c3.unsent-form.v1:';
  const cacheKey = csrf && account ? cachePrefix + account + ':' + csrf : '';
  let formCache = null;
  let cacheMayContainStale = false;
  let confirmDirtyNavigation = () => true;
  const storageAccess = () => {
    try { return typeof window !== 'undefined' && window.sessionStorage && cacheKey ? window.sessionStorage : null; }
    catch { return null; }
  };
  const invalidateFormCache = () => {
    const cache = formCache || storageAccess();
    if (!cache) return false;
    try { cache.removeItem(cacheKey); formCache = cache; cacheMayContainStale = false; return true; }
    catch {
      try { cache.setItem(cacheKey, JSON.stringify({ invalidated: true })); formCache = cache; cacheMayContainStale = false; return true; }
      catch { formCache = null; return false; }
    }
  };
  try {
    const storage = storageAccess();
    if (storage) {
      cacheMayContainStale = storage.getItem(cacheKey) !== null;
      const probe = cacheKey + ':probe';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      formCache = storage;
      for (let index = formCache.length - 1; index >= 0; index -= 1) {
        const key = formCache.key(index);
        if (key && key.startsWith(cachePrefix) && key !== cacheKey) formCache.removeItem(key);
      }
    }
  } catch { formCache = null; }
  // History entries own their route, while fragments remain native same-document evidence navigation.
  // Replace the handler because document.open() may clear Window listeners before the replacement script runs.
  if (typeof window !== 'undefined') {
    const routePath = () => (window.location?.pathname || '') + (window.location?.search || '');
    const previous = window.__atlieraC3RouteOwnerV1;
    if (previous?.handler && typeof window.removeEventListener === 'function') window.removeEventListener('popstate', previous.handler);
    const owner = { path: routePath(), handler: null };
    owner.handler = () => {
      if (routePath() === owner.path) return;
      if (!confirmDirtyNavigation()) { history.pushState(null, '', owner.path); return; }
      window.location.reload();
    };
    window.__atlieraC3RouteOwnerV1 = owner;
    window.addEventListener('popstate', owner.handler);
  }
  const replacePage = (payload) => {
    const allowed = ['/', '/?prepare=1', '/?draft=1'];
    if (allowed.includes(payload.location) && (payload.history === 'push' || payload.history === 'replace')) {
      history[payload.history === 'push' ? 'pushState' : 'replaceState'](null, '', payload.location);
    }
    document.open(); document.write(payload.html); document.close();
  };
  const requestJson = async (url, body, signal) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-c3-csrf': csrf }, body: JSON.stringify(body), signal });
    const payload = await response.json().catch(() => ({ error: 'Invalid local service response' }));
    if (!response.ok && typeof payload.html !== 'string') throw new Error(payload.error || 'Request failed');
    return payload;
  };
  const form = document.querySelector('[data-generate]');
  let controller = null;
  let requestToken = 0;
  let cancelPending = null;
  if (form) {
    const formRequest = () => { const data = new FormData(form); return { audience: data.get('audience'), intendedOutcome: data.get('intendedOutcome'), durationMinutes: Number(data.get('durationMinutes')), meetingDate: data.get('meetingDate') }; };
    const button = form.querySelector('button[type="submit"]');
    const status = document.querySelector('[data-status]');
    const recovery = document.querySelector('[data-form-recovery]');
    const recordedReset = document.querySelector('[data-use-recorded-request]');
    const unavailable = () => { formCache = null; if (recovery) recovery.textContent = 'Unsubmitted edits cannot be kept through reload in this browser. Keep this page open or copy them before reloading.'; };
    const available = () => { if (recovery) recovery.textContent = 'Unsubmitted edits are kept only in this tab for this live server session. They are not durably saved, shared, or carried into a new server session.'; };
    const validCachedForm = (value) => value && typeof value === 'object' &&
      typeof value.audience === 'string' && value.audience.length <= 160 &&
      typeof value.intendedOutcome === 'string' && value.intendedOutcome.length <= 500 &&
      [15, 30, 45, 60].includes(value.durationMinutes) &&
      typeof value.meetingDate === 'string' && value.meetingDate.length <= 10;
    const restoreCachedForm = () => {
      if (!formCache) { unavailable(); return; }
      try {
        const raw = formCache.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          const fields = form.elements;
          if (!validCachedForm(cached) || !fields || typeof fields.namedItem !== 'function') throw new Error('invalid cached form');
          fields.namedItem('audience').value = cached.audience;
          fields.namedItem('intendedOutcome').value = cached.intendedOutcome;
          fields.namedItem('durationMinutes').value = String(cached.durationMinutes);
          fields.namedItem('meetingDate').value = cached.meetingDate;
          cacheMayContainStale = true;
        }
        available();
      } catch {
        try { formCache.removeItem(cacheKey); } catch {}
        unavailable();
      }
    };
    const cacheCurrentForm = () => {
      const cache = formCache || storageAccess();
      if (!cache) { unavailable(); return; }
      try { cache.setItem(cacheKey, JSON.stringify(formRequest())); formCache = cache; cacheMayContainStale = true; available(); }
      catch { invalidateFormCache(); unavailable(); }
    };
    const updateRecordedReset = () => {
      if (!recordedReset) return;
      const exact = { audience: recordedReset.getAttribute('data-audience') || '', intendedOutcome: recordedReset.getAttribute('data-outcome') || '',
        durationMinutes: Number(recordedReset.getAttribute('data-duration')), meetingDate: recordedReset.getAttribute('data-meeting-date') || '' };
      recordedReset.hidden = JSON.stringify(formRequest()) === JSON.stringify(exact);
    };
    const clearCachedForm = () => { const cleared = invalidateFormCache(); if (!cleared) unavailable(); return cleared; };
    const ready = (message) => { if (button) button.disabled = false; if (status) status.textContent = message; };
    const cancellation = () => {
      if (cancelPending) return cancelPending;
      const pending = requestJson('/api/cancel', formRequest()).finally(() => {
        if (cancelPending === pending) cancelPending = null;
      });
      cancelPending = pending;
      return pending;
    };
    restoreCachedForm();
    updateRecordedReset();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = ++requestToken;
      cacheCurrentForm();
      if (cancelPending) await cancelPending.catch(() => undefined);
      if (token !== requestToken) return;
      controller = new AbortController();
      if (button) button.disabled = true;
      if (status) status.textContent = recordedReplay ? 'Replaying the exact recorded response locally…' : 'Preparing a proposed draft…';
      try {
        const payload = await requestJson('/api/generate', formRequest(), controller.signal);
        if (token === requestToken && typeof payload.html === 'string') {
          if (payload.location === '/?draft=1' && !clearCachedForm() && cacheMayContainStale) {
            ready('Draft prepared, but superseded reload recovery could not be cleared. Do not reload this form; open the session draft from Account Home after browser storage is available.');
            return;
          }
          replacePage(payload);
        }
      } catch (error) {
        if (token === requestToken && error?.name !== 'AbortError') ready(error instanceof Error ? error.message : 'Generation failed');
      } finally {
        if (token === requestToken) { controller = null; if (button) button.disabled = false; }
      }
    });
    form.addEventListener('input', () => {
      cacheCurrentForm();
      updateRecordedReset();
      if (controller) {
        const token = ++requestToken;
        controller.abort();
        controller = null;
        ready('Stopping the previous local draft and keeping these edits…');
        const pending = cancellation();
        pending.then((payload) => {
          if (token === requestToken) ready(payload.status || 'Ready with edited inputs.');
        }).catch((error) => {
          if (token === requestToken) ready(error instanceof Error ? error.message : 'Could not confirm cancellation');
        });
      }
    });
    recordedReset?.addEventListener('click', () => {
      const fields = form.elements;
      fields.namedItem('audience').value = recordedReset.getAttribute('data-audience') || '';
      fields.namedItem('intendedOutcome').value = recordedReset.getAttribute('data-outcome') || '';
      fields.namedItem('durationMinutes').value = recordedReset.getAttribute('data-duration') || '';
      fields.namedItem('meetingDate').value = recordedReset.getAttribute('data-meeting-date') || '';
      cacheCurrentForm(); updateRecordedReset();
      if (status) status.textContent = 'Recorded request restored. Submit deliberately to replay its exact recorded response.';
    });
    document.querySelector('[data-cancel]')?.addEventListener('click', async () => {
      const token = ++requestToken;
      cacheCurrentForm();
      if (controller) controller.abort();
      controller = null;
      ready('Stopping the local draft and keeping current form text…');
      try {
        const payload = await cancellation();
        if (token === requestToken) ready(payload.status || 'Local generation stopped. Inputs were kept.');
      } catch (error) {
        if (token === requestToken) ready(error instanceof Error ? error.message : 'Could not confirm cancellation');
      }
    });
  }
  let reviewToken = 0;
  const reviewForm = document.querySelector('[data-note-form]');
  const correctionNote = document.querySelector('[data-correction-note]');
  let savedNote = correctionNote?.value || '';
  let reviewNavigationApproved = false;
  const noteIsDirty = () => Boolean(correctionNote && correctionNote.value !== savedNote);
  confirmDirtyNavigation = () => {
    if (reviewNavigationApproved || !noteIsDirty()) return true;
    if (typeof window.confirm !== 'function') return false;
    const approved = window.confirm('Discard the unsaved correction note and leave this draft?');
    if (approved) reviewNavigationApproved = true;
    return approved;
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', (event) => {
    if (!reviewNavigationApproved && noteIsDirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener?.('click', (event) => {
    const link = event.target?.closest?.('a[href]');
    if (!link || !noteIsDirty()) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') ||
        (link.getAttribute('target') || '_self').toLowerCase() !== '_self') return;
    if (!confirmDirtyNavigation()) event.preventDefault();
  });
  correctionNote?.addEventListener?.('input', () => { reviewNavigationApproved = false; });
  reviewForm?.addEventListener('submit', async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const status = document.querySelector('[data-review-status]');
    const token = ++reviewToken; const recordId = event.currentTarget.getAttribute('data-record-id') || '';
    try { const payload = await requestJson('/api/note', { note: data.get('note'), recordId }); if (token === reviewToken && typeof payload.html === 'string') { savedNote = String(data.get('note') || ''); reviewNavigationApproved = true; replacePage(payload); const savedStatus = document.querySelector('[data-review-status]'); if (savedStatus) savedStatus.textContent = 'Note kept for this session. It is not approval or durable storage.'; } }
    catch (error) { if (token === reviewToken && status) status.textContent = error instanceof Error ? error.message : 'Could not keep correction note'; }
  });
  document.querySelector('[data-revise]')?.addEventListener('click', async () => {
    const note = document.querySelector('[data-correction-note]'); const status = document.querySelector('[data-review-status]');
    const token = ++reviewToken; const recordId = reviewForm?.getAttribute('data-record-id') || '';
    try { const payload = await requestJson('/api/revise', { note: note?.value || '', recordId }); if (token === reviewToken && typeof payload.html === 'string') { if (!invalidateFormCache() && cacheMayContainStale) { if (status) status.textContent = 'Revision accepted, but superseded reload recovery could not be cleared. Do not reload this draft; return to Prepare after browser storage is available.'; return; } savedNote = note?.value || ''; reviewNavigationApproved = true; replacePage(payload); } }
    catch (error) { if (token === reviewToken && status) status.textContent = error instanceof Error ? error.message : 'Could not request revision'; }
  });
  document.querySelector('[data-use-recorded-note]')?.addEventListener('click', () => {
    const note = document.querySelector('[data-correction-note]');
    const exact = document.querySelector('[data-recorded-note]');
    const status = document.querySelector('[data-review-status]');
    if (note && exact) {
      note.value = exact.textContent || '';
      if (status) status.textContent = 'Exact recorded correction copied into the textarea. Review it, then deliberately request the recorded revision.';
      if (typeof note.focus === 'function') note.focus();
    }
  });
  document.querySelector('[data-discard-revision]')?.addEventListener('click', async () => {
    const status = document.querySelector('[data-review-status]');
    const recordId = reviewForm?.getAttribute('data-record-id') || '';
    const pendingRevisionToken = document.querySelector('[data-discard-revision]')?.getAttribute('data-pending-revision-token') || '';
    const token = ++reviewToken;
    try { const payload = await requestJson('/api/discard-revision', { recordId, pendingRevisionToken }); if (token === reviewToken && typeof payload.html === 'string') { reviewNavigationApproved = true; replacePage(payload); } }
    catch (error) { if (token === reviewToken && status) status.textContent = error instanceof Error ? error.message : 'Could not discard pending revision'; }
  });
})();`;

/** Exact inert browser program, exported only for deterministic handler regression execution. */
export const C3_CLIENT_SCRIPT = SCRIPT;

export const C3_SCRIPT_SHA256 = createHash("sha256").update(SCRIPT, "utf8").digest("base64");

const CSS = `
button:disabled,textarea:disabled{cursor:not-allowed;opacity:.62}.question-kind{display:block;margin-bottom:5px;color:var(--plum);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.optional-probe,.technical-detail{margin-top:10px}.optional-probe summary,.technical-detail summary{cursor:pointer;color:var(--blue);font-size:13px;font-weight:750}.optional-probe p{margin:8px 0;color:var(--muted);font-size:14px}
:root{--paper:#f7f2e8;--ink:#24201d;--muted:#6c645d;--blue:#1647b9;--plum:#4b263e;--line:#cfc5b8;--wash:#ebe7dc;--warn:#8b3f2f;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--paper)}*{box-sizing:border-box}body{margin:0;border-top:4px solid var(--ink);line-height:1.45}header,main,footer,.recorded-mode{width:min(1100px,calc(100% - 40px));margin:auto}header{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}header a{color:inherit;text-decoration:none;font-family:Georgia,serif;font-weight:700}.state{font-size:12px;color:var(--muted)}.recorded-mode{margin-top:14px;padding:12px 14px;border:1px solid var(--warn);background:#f0e4d7}.recorded-mode strong{display:block}.recorded-mode span{font-size:13px}.recorded-note{margin:16px 0;padding:12px;border:1px solid #b99cad;background:#fff;color:var(--ink)}.recorded-note summary{cursor:pointer;font-weight:800}.recorded-note pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 ui-monospace,monospace}.recorded-note button{background:var(--plum);color:#fff;border-color:var(--plum)}main{padding:38px 0 70px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);font-weight:800}h1,h2{font-family:Georgia,serif;font-weight:500;letter-spacing:-.025em}h1{font-size:clamp(42px,7vw,78px);line-height:.98;margin:8px 0 18px}h2{font-size:32px;margin:0 0 10px}.lede{max-width:760px;font:20px/1.35 Georgia,serif}.proposed-cue{display:inline-block;margin:0 0 8px;padding:5px 8px;background:var(--wash);font-size:12px;font-weight:800}.orientation{max-width:780px;margin-top:24px;display:grid;gap:14px}.orientation p{margin:3px 0}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border:1px solid var(--ink);background:var(--ink);color:#fff;text-decoration:none;font-weight:750;cursor:pointer}.button.secondary,button.secondary{background:transparent;color:var(--ink)}.hero-actions{margin-top:26px;display:flex;gap:12px;flex-wrap:wrap}.home-evidence{max-width:780px;margin-top:22px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.home-evidence summary,.evidence-list summary{display:flex;align-items:center;min-height:46px;cursor:pointer;color:var(--blue);font-weight:750}.context-strip{display:grid;grid-template-columns:repeat(3,1fr);margin-top:32px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.context-strip div{padding:18px 16px}.context-strip div+div{border-left:1px solid var(--line)}.context-strip strong{display:block;font-size:13px}.context-strip span{font-size:12px;color:var(--muted)}form.prepare{max-width:720px}.field{margin:20px 0}.field label{display:block;font-weight:750;margin-bottom:7px}.field input,.field textarea,.field select{width:100%;min-height:48px;padding:10px 12px;border:1px solid #8b827a;background:#fffaf0;color:var(--ink);font:inherit}.field textarea{min-height:92px}.options{margin:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.options summary{min-height:46px;padding:12px 0;font-weight:750;cursor:pointer}.option-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:18px}.status-line{min-height:24px;margin:14px 0;color:var(--muted)}.draft-head{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:start}.badge{padding:7px 10px;background:var(--wash);font-size:12px;font-weight:800}.draft-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,.65fr);gap:42px;margin-top:34px}.draft-section{padding:22px 0;border-top:1px solid var(--line)}.draft-section p{margin:6px 0}.support{font-size:12px;color:var(--muted)}.support a,.warning a{display:inline-flex;align-items:center;min-height:44px;max-width:100%;overflow-wrap:anywhere}.direct-source,.evidence-list blockquote,.home-evidence blockquote{margin:12px 0;padding:12px;border-left:3px solid var(--blue);background:#fffaf0;font-family:Georgia,serif;overflow-wrap:anywhere}.source-attribution{font-size:12px;color:var(--muted);overflow-wrap:anywhere}.questions{counter-reset:q;list-style:none;padding:0}.questions li{counter-increment:q;padding:18px 0 18px 52px;border-top:1px solid var(--line);position:relative}.questions li:before{content:counter(q,decimal-leading-zero);position:absolute;left:0;color:var(--plum);font-weight:800}.learning{color:var(--muted);font-size:14px}.warning{border-left:3px solid var(--warn);padding:8px 12px;margin:10px 0;background:#f0e4d7;font-size:13px}.evidence-list details{border-top:1px solid var(--line);padding:5px 0}.meta{font-size:12px;color:var(--muted)}.review{margin-top:34px;padding:22px;background:var(--plum);color:#fff}.review .warning{color:var(--ink)}.review-label{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#fffaf0;font-weight:800}.review [data-review-status]{color:#fffaf0}.review label{display:block;font-weight:750;margin-bottom:7px}.review textarea{width:100%;min-height:80px}.review button{background:#fff;color:var(--plum);border-color:#fff;margin-top:10px}.review button.secondary{margin-left:8px;background:transparent;color:#fff}.boundary{margin-top:32px;font-size:12px;color:var(--muted)}.form-recovery{margin:8px 0}footer{padding:18px 0 35px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}@media(max-width:700px){header,main,footer,.recorded-mode{width:min(100% - 24px,1100px)}main{padding-top:24px}.context-strip,.draft-grid{grid-template-columns:1fr}.context-strip div+div{border-left:0;border-top:1px solid var(--line)}.option-grid{grid-template-columns:1fr}.draft-head{grid-template-columns:1fr}h1{font-size:42px}.review button.secondary{margin-left:0}.review button{width:100%}}`;

function shell(title: string, body: string, csrf: string, accountId: string, recorded: boolean): string {
  const replay = recorded ? '<div class="recorded-mode" role="status"><strong>Private candidate preview · Recorded responses · No live generation</strong><span>Unmerged and proposed. Session-only; no approval or durable save. Any brief wait replays local recorded bytes—it is not live provider timing.</span></div>' : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="c3-csrf" content="${esc(csrf)}"><meta name="c3-account" content="${esc(accountId)}">${recorded ? '<meta name="c3-recorded-replay" content="true">' : ""}<title>${esc(title)} · Atliera</title><style>${CSS}</style></head><body><header><a href="/">Atliera</a><span class="state">Local working journey · session memory</span></header>${replay}${body}<footer>Session-only prototype. Submitted form state and drafts survive reload only while this server session lives; a server restart loses it. Prepare reports separately whether this tab can recover unsubmitted edits. Nothing is shared, sent, approved, or durably saved.</footer><script>${SCRIPT}</script></body></html>`;
}

function home(context: FrozenC3AccountContext, hasDraft: boolean, recorded: boolean, revisionPending: boolean): string {
  const proposal = context.context.proposal;
  const eligible = !context.context.ownerCorrections.some((item) => item.text.includes("not enabled"));
  const byEvidence = new Map(context.context.admittedSources.flatMap((source) => source.excerpts.map((excerpt) => [excerpt.evidenceId, { source, excerpt }] as const)));
  const thesisEvidence = proposal.accountThesis.evidenceIds.flatMap((id) => byEvidence.get(id) ?? []);
  const supportMeaning = proposal.accountThesis.state === "source-backed fact" ? "Direct source support" : "Related evidence context for this proposed thesis";
  const implication = proposal.whyChangeMayMatter[0]?.text ?? "The retained context can orient a focused discovery conversation, while material gaps remain open.";
  const nextAction = proposal.recommendedNextMove.text;
  const evidence = thesisEvidence.length === 0 ? `<p class="meta">No direct thesis evidence is asserted; treat the thesis as proposed orientation.</p>` : thesisEvidence.map((item) =>
    `<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote><p class="meta">${esc(item.source.title)} · ${esc(item.source.publisher)} · Event ${esc(humanDate(item.source.eventDate))}</p>`).join("");
  const action = recorded ? "Open exact recorded replay" : "Prepare for…";
  const pendingBanner = revisionPending ? '<div class="warning"><strong>Revision pending.</strong> The previous valid draft remains available read-only until the revision succeeds or you explicitly discard it.</div>' : "";
  return `<main><p class="eyebrow">Account Home</p><h1>${esc(context.context.account.accountName)}</h1><span class="proposed-cue">Proposed account orientation · not reviewed</span>${pendingBanner}<p class="lede">${esc(proposal.accountThesis.text)}</p><div class="hero-actions">${eligible ? `<a class="button" href="/?prepare=1">${action}</a>` : '<span class="badge">Preparation held pending C2 revision</span>'}${hasDraft ? '<a class="button secondary" href="/?draft=1">Reopen session draft</a>' : ""}</div><div class="orientation"><div><strong>Why this is worth checking</strong><p>${esc(implication)}</p></div><div><strong>Focused next action</strong><p>${esc(nextAction)}</p></div></div><details class="home-evidence"><summary>${esc(supportMeaning)}</summary>${evidence}</details><section class="context-strip"><div><strong>Admitted public context</strong><span>${String(context.context.admittedSources.length)} sources with bounded clean-text custody</span></div><div><strong>${String(context.context.materialGaps.length)} material gap${context.context.materialGaps.length === 1 ? "" : "s"}</strong><span>Kept open, never filled by assumption</span></div><div><strong>No prior revision</strong><span>Initial dated events are not called changes against a prior revision</span></div></section><p class="boundary">This orientation reuses admitted C2 evidence. It does not claim that the legacy “meaningfully changed” bucket proves temporal change, and the C2 disposition does not approve generated C3 content.</p></main>`;
}

function sameMeetingRequest(left: C3MeetingFormState, right: C3MeetingFormState): boolean {
  return left.audience === right.audience && left.intendedOutcome === right.intendedOutcome &&
    left.durationMinutes === right.durationMinutes && left.meetingDate === right.meetingDate;
}

function prepare(context: FrozenC3AccountContext, request: C3MeetingFormState, error: string | undefined, hasDraft: boolean,
  recorded: boolean, recordedRequest?: C3MeetingFormState, correctionNote?: string, revisionPending = false): string {
  const status = error ?? (recorded ? "Only the exact recorded request will replay. Edited inputs are refused; no live provider will be called." : "A model provider must be configured by the local server operator.");
  const pending = revisionPending && correctionNote !== undefined && correctionNote.length > 0 ? `<details class="recorded-note" open><summary>Revision pending — previous draft preserved</summary><p>This exact owner-entered note remains session-only. It is not approval or account truth. Cancel stops generation but does not discard the pending revision.</p><pre>${esc(correctionNote)}</pre></details>` : "";
  const reset = recordedRequest === undefined ? "" : `<button class="secondary" type="button" data-use-recorded-request data-audience="${esc(recordedRequest.audience)}" data-outcome="${esc(recordedRequest.intendedOutcome)}" data-duration="${String(recordedRequest.durationMinutes)}" data-meeting-date="${esc(recordedRequest.meetingDate)}"${sameMeetingRequest(request, recordedRequest) ? " hidden" : ""}>Use recorded request</button>`;
  return `<main><p class="eyebrow">Prepare for…</p><h1>${esc(context.context.account.accountName)}</h1><p class="lede">Tell Atliera who you’re meeting and what you want to learn or accomplish.</p>${hasDraft ? '<p><a class="button secondary" href="/?draft=1">Reopen session draft</a></p>' : ""}${pending}<form class="prepare" data-generate><div class="field"><label for="audience">Audience</label><input id="audience" name="audience" required maxlength="160" value="${esc(request.audience)}" placeholder="CISO"></div><div class="field"><label for="outcome">Intended outcome</label><textarea id="outcome" name="intendedOutcome" required maxlength="500" placeholder="Understand priorities and agree a useful next step">${esc(request.intendedOutcome)}</textarea></div><details class="options"><summary>More options</summary><div class="option-grid"><div class="field"><label for="duration">Duration</label><select id="duration" name="durationMinutes">${[15,30,45,60].map((value) => `<option value="${String(value)}"${request.durationMinutes === value ? " selected" : ""}>${String(value)} minutes</option>`).join("")}</select></div><div class="field"><label for="meeting-date">Meeting date</label><input id="meeting-date" name="meetingDate" type="date" required value="${esc(request.meetingDate)}"></div></div></details><p class="status-line" data-status role="status" aria-live="polite">${esc(status)}</p><p class="boundary form-recovery" data-form-recovery aria-live="polite">Unsubmitted edits are not durably saved. This tab is checking whether it can keep them through reload.</p><div class="hero-actions"><button type="submit">${recorded ? "Replay exact recorded response" : "Prepare draft"}</button>${reset}<button class="secondary" type="button" data-cancel>Cancel</button></div></form><p class="boundary">${recorded ? "Replay waiting is local request matching and validation, not live model timing. No arbitrary edit can manufacture a result." : "The model receives the complete versioned account context—not the compact Account Home projection. It may select evidence and write prose; it cannot assign approval, governance, or durable-save fields."}</p></main>`;
}

function supportLabel(item: C3SupportedText): string {
  return item.supportCategory === "direct_support" ? "Direct support" : item.supportCategory === "cautious_inference" ? "Cautious inference · related evidence context" :
    item.supportCategory === "recommendation" ? "Recommendation · proposed action" : item.supportCategory === "unknown" ? "Unknown · not established" : "Open question";
}

type EvidenceDisplay = { readonly source: FrozenC3AccountContext["context"]["admittedSources"][number];
  readonly excerpt: FrozenC3AccountContext["context"]["admittedSources"][number]["excerpts"][number] };

function evidenceLinks(refs: readonly string[], numberById: ReadonlyMap<string, number>,
  sourceByEvidence: ReadonlyMap<string, EvidenceDisplay>, contextName: string): string {
  if (refs.length === 0) return "No evidence asserted";
  return refs.map((id) => { const number = numberById.get(id) ?? 0; const source = sourceByEvidence.get(id);
    const undated = source !== undefined && source.source.publicationDate === null && source.source.eventDate === null &&
      source.source.evidenceCurrentThrough === null ? ' <span class="undated">Undated source — recheck before meeting</span>' : "";
    return `<a href="#evidence-${String(number)}" aria-label="${esc(`${contextName} evidence ${String(number)}: ${source?.source.title ?? "source"}`)}">Evidence ${String(number)}</a>${undated}`; }).join(" · ");
}

function draftPage(context: FrozenC3AccountContext, record: C3GenerationRecord, note: string, recordedCorrection: string | undefined,
  revisionPending: boolean, pendingRevisionToken?: string): string {
  const draft = record.draft!;
  const sourceByEvidence = new Map(context.context.admittedSources.flatMap((source) => source.excerpts.map((excerpt) => [excerpt.evidenceId, { source, excerpt }] as const)));
  const numberById = new Map(draft.selectedEvidenceRefs.map((id, index) => [id, index + 1]));
  const body = (item: C3SupportedText): string => {
    if (item.supportCategory !== "direct_support") return `<p>${esc(item.text)}</p>`;
    const exact = item.evidenceRefs.map((id) => sourceByEvidence.get(id)).find((entry) => entry?.excerpt.exactExcerpt === item.text)!;
    return `<blockquote class="direct-source">${esc(item.text)}</blockquote><p class="source-attribution">${esc(exact.source.title)} · ${esc(exact.source.publisher)}</p>`;
  };
  const supported = (title: string, item: C3SupportedText) => `<section class="draft-section"><p class="eyebrow">${esc(title)}</p>${body(item)}<p class="support">${esc(supportLabel(item))} · ${evidenceLinks(item.evidenceRefs, numberById, sourceByEvidence, title)}</p></section>`;
  const initialWarning = recordedCorrection !== undefined && record.revision === null && !revisionPending ? '<div class="warning"><strong>Recorded initial — before correction.</strong> Historical input to the correction workflow; not recommended meeting copy.</div>' : "";
  const recordedHelp = revisionPending ? `<div class="warning"><strong>Revision pending.</strong> This is the preserved previous draft, shown read-only. Cancel only stops generation; it does not discard this revision.<p><button type="button" data-discard-revision data-pending-revision-token="${esc(pendingRevisionToken!)}">Discard pending revision and return to previous draft</button></p></div>` : recordedCorrection === undefined ? "" : record.revision === null ? `<details class="recorded-note"><summary>Exact correction available for the recorded revision</summary><p>The replay has one recorded revision only. The text below is operator-recorded—not owner approval or account truth. You can copy it, or use the deliberate action to place the exact bytes in the textarea. Existing text is never replaced unless you press the button.</p><pre data-recorded-note>${esc(recordedCorrection)}</pre><button type="button" data-use-recorded-note>Use exact recorded correction</button></details>` : '<p class="recorded-note"><strong>Recorded revision.</strong> Exact validated correction replay; record identities are unchanged. No further recorded response exists.</p>';
  const learning = (text: string): string => { const marker = "Optional probe:"; const at = text.indexOf(marker);
    if (at < 0) return `<p class="learning">Learn: ${esc(text)}</p>`;
    const prefix = text.slice(0, at);
    return `${prefix.length === 0 ? "" : `<p class="learning">Learn: ${esc(prefix)}</p>`}<details class="optional-probe"><summary>Optional probe — only if relevant</summary><p>${esc(text.slice(at))}</p></details>`;
  };
  const disabled = revisionPending ? " disabled" : "";
  return `<main><div class="draft-head"><div><p class="eyebrow">Meeting draft</p><h1>${esc(context.context.account.accountName)}</h1><p class="lede">${esc(draft.objective.text)}</p><details class="technical-detail"><summary>Evidence basis</summary><p class="support">${esc(supportLabel(draft.objective))} · ${evidenceLinks(draft.objective.evidenceRefs, numberById, sourceByEvidence, "Meeting objective")}</p></details><div class="hero-actions"><a class="button secondary" href="/">Account Home</a><a class="button secondary" href="/?prepare=1">${recordedCorrection === undefined ? "Prepare another draft" : "Return to recorded request"}</a></div></div><span class="badge">Proposed · Not reviewed · Not durably saved</span></div>${initialWarning}<div class="draft-grid"><div>${supported("Audience thesis", draft.audienceThesis)}${supported("Opening", draft.opening)}<section class="draft-section"><p class="eyebrow">Questions in order</p><ol class="questions">${draft.questions.map((question, index) => `<li><span class="question-kind">Must ask</span><strong>${esc(question.question)}</strong>${learning(question.intendedLearning)}<details class="technical-detail"><summary>Evidence basis</summary><p class="support">Open question${question.evidenceRefs.length === 0 ? " · No evidence asserted" : ` · Related evidence context: ${evidenceLinks(question.evidenceRefs, numberById, sourceByEvidence, `Question ${String(index + 1)}`)}`}</p></details></li>`).join("")}</ol></section>${supported("Close criterion", draft.closeCriterion)}</div><aside><section class="draft-section"><p class="eyebrow">Risks & unknowns</p>${draft.risksUnknowns.map((item, index) => `${body(item)}<p class="support">${esc(supportLabel(item))} · ${evidenceLinks(item.evidenceRefs, numberById, sourceByEvidence, `Risk or unknown ${String(index + 1)}`)}</p>`).join("")}${draft.warnings.map((warning) => `<div class="warning">${esc(warning.message)}${warning.evidenceRefs.length === 0 ? "" : `<br>${evidenceLinks(warning.evidenceRefs, numberById, sourceByEvidence, "Draft warning")}`}</div>`).join("")}</section><section class="evidence-list"><p class="eyebrow">Selected evidence</p>${draft.selectedEvidenceRefs.map((id, index) => { const item=sourceByEvidence.get(id)!; return `<details id="evidence-${String(index+1)}"><summary>Evidence ${String(index+1)} · ${esc(item.source.title)}</summary><blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote><p class="meta">${esc(item.source.publisher)} · Published ${esc(humanDate(item.source.publicationDate))} · Event ${esc(humanDate(item.source.eventDate))} · Current through ${esc(humanDate(item.source.evidenceCurrentThrough))}</p><p class="meta"><a href="${esc(item.source.canonicalUrl)}" rel="noreferrer">Open source</a></p></details>`; }).join("")}</section></aside></div><section class="review"><p class="review-label">Draft review</p><h2>Suggest a correction</h2><p>This draft is proposed and has not been reviewed. Your note stays only in this server session and is not durably saved. Keeping a note or requesting a revised draft does not approve, share, or send anything.</p>${recordedHelp}<form data-note-form data-record-id="${esc(record.recordId)}"><label for="correction-note">What should change?</label><textarea id="correction-note" data-correction-note name="note" maxlength="1000" placeholder="Describe what should change"${disabled}>${esc(note)}</textarea><p class="status-line" data-review-status role="status" aria-live="polite"></p><button type="submit"${disabled}>Keep note for this session</button><button class="secondary" type="button" data-revise${disabled}>Request revised draft</button></form></section><details class="technical-detail"><summary>Record and timing details</summary><p class="boundary">Temporal outcome: ${esc(draft.temporalOutcome.replace(/_/gu," "))}. The generated draft is kept for reproducible review in this live session; that does not approve, share, send, or durably save it.</p></details></main>`;
}

function addAdmittedSourceSectionContext(context: FrozenC3AccountContext, record: C3GenerationRecord, page: string): string {
  const selectedId = "evidence_2e20762caf4b11701059";
  const headingId = "evidence_c0bc6cf74d035bc8e08a";
  const selectedIndex = record.draft?.selectedEvidenceRefs.indexOf(selectedId) ?? -1;
  if (selectedIndex < 0) return page;
  const source = context.context.admittedSources.find((candidate) => candidate.excerpts.some((item) => item.evidenceId === selectedId));
  const selected = source?.excerpts.find((item) => item.evidenceId === selectedId);
  const heading = source?.excerpts.find((item) => item.evidenceId === headingId);
  if (source === undefined || selected === undefined || heading === undefined || heading.exactExcerpt !== "“RESPONSIBLE AI" ||
      heading.sourceId !== source.sourceId || selected.sourceId !== source.sourceId || heading.sourceCharStart >= selected.sourceCharStart) return page;
  const marker = `<details id="evidence-${String(selectedIndex + 1)}"><summary>Evidence ${String(selectedIndex + 1)} · ${esc(source.title)}</summary>`;
  const sourceSection = `<p class="source-section" data-evidence-id="${headingId}"><strong>Source section:</strong> Responsible AI <span class="meta">Heading evidence ${headingId}</span></p>`;
  return page.replace(marker, `${marker}${sourceSection}`);
}

export function renderC3Page(context: FrozenC3AccountContext, state: C3PageState, csrf: string, options?: C3RenderOptions): string {
  const accountId = context.context.account.accountId;
  const recorded = options !== undefined;
  if (state.page === "home") return shell(context.context.account.accountName, home(context, state.hasDraft ?? false, recorded,
    state.revisionPending ?? false), csrf, accountId, recorded);
  if (state.page === "prepare") return shell(`Prepare for ${context.context.account.accountName}`, prepare(context, state.request, state.error,
    state.hasDraft ?? false, recorded, options?.initialRequest, state.correctionNote, state.revisionPending), csrf, accountId, recorded);
  const draft = draftPage(context, state.record, state.correctionNote, options?.correctionNote, state.revisionPending ?? false,
    state.pendingRevisionToken);
  return shell(`Draft for ${context.context.account.accountName}`, addAdmittedSourceSectionContext(context, state.record, draft),
    csrf, accountId, recorded);
}
