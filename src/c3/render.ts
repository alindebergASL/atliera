import { createHash } from "node:crypto";

import { PLANNING_CLIENT_SCRIPT } from "./planning-client.ts";
import { accountGaps, businessGapLabel, briefContext, accountIntelSections, planningPage, sectionNoteEditor, workshopKinds } from "./planning-render.ts";
import type { PlanningBrief, SectionNotes } from "./planning.ts";
import { isCuratedContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";
import type { C3GenerationRecord, C3MeetingFormState, C3SupportedText } from "./draft.ts";

type C3PendingState = { readonly revisionPending: true; readonly pendingRevisionToken: string } |
  { readonly revisionPending?: false; readonly pendingRevisionToken?: never };

export type C3PageState = (
  | { readonly page: "planning"; readonly brief: PlanningBrief; readonly strategySuggestion?: PlanningBrief["sections"][number]; readonly hasDraft?: boolean }
  | { readonly page: "home"; readonly hasDraft?: boolean }
  | { readonly page: "prepare"; readonly request: C3MeetingFormState; readonly error?: string; readonly hasDraft?: boolean;
      readonly correctionNote?: string; readonly displayedRecordId?: string | null }
  | { readonly page: "draft"; readonly record: C3GenerationRecord; readonly correctionNote: string; readonly notice?: string; readonly sectionNotes?: SectionNotes }) & C3PendingState;

export interface C3RenderOptions {
  readonly correctionNote: string;
  readonly syntheticPreview?: boolean;
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
  let confirmLocalEditDeparture = () => true;
  let resetLocalEditDeparture = () => {};
  let rebindSectionNotes = () => {};
  let setSectionRevisionPending = () => {};
  let canStartRevision = () => true;
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
  // Keep native route ownership separate from same-document evidence navigation.
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
    if (!confirmDirtyNavigation()) return;
    if (payload.outcome === 'succeeded' && payload.location === '/?draft=1') window.location.assign('/?draft=1');
  };
  const requestJson = async (url, body, signal) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-c3-csrf': csrf }, body: JSON.stringify(body), signal });
    const payload = await response.json().catch(() => ({ error: 'Invalid local service response' }));
    if (!response.ok && typeof payload.html !== 'string') throw new Error(payload.error || 'Request failed');
    return payload;
  };
  const revealEvidence = () => {
    const hash = typeof window !== 'undefined' ? window.location?.hash || '' : '';
    if (!/^#evidence-[0-9]+$/.test(hash)) return;
    const target = document.querySelector(hash);
    if (!target) return;
    target.open = true;
    let ancestor = target.parentElement;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
    target.querySelector('summary')?.focus();
  };
  const evidenceDialog = document.querySelector('[data-evidence-dialog]');
  let evidenceOrigin = null;
  let evidenceScroll = [0, 0];
  let priorBodyOverflow = '';
  evidenceDialog?.querySelector('[data-evidence-close]')?.addEventListener('click', () => evidenceDialog.close());
  evidenceDialog?.addEventListener('close', () => {
    if (document.body?.style) document.body.style.overflow = priorBodyOverflow;
    evidenceOrigin?.focus({ preventScroll: true });
    window.scrollTo?.(...evidenceScroll);
    evidenceOrigin = null;
  });
  document.addEventListener?.('click', (event) => {
    const link = event.target?.closest?.('a[data-evidence-link]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    const content = target.querySelector('[data-evidence-content]');
    if (content && typeof evidenceDialog?.showModal === 'function') {
      const panel = evidenceDialog.querySelector('[data-evidence-panel-body]');
      panel.replaceChildren(content.cloneNode(true));
      evidenceDialog.querySelector('#evidence-panel-title').textContent = link.getAttribute('data-context') + ' · ' + target.querySelector('summary').textContent;
      evidenceDialog.querySelector('[data-evidence-support]').textContent = link.getAttribute('data-support') || 'Related evidence context';
      evidenceOrigin = link;
      evidenceScroll = [window.scrollX || 0, window.scrollY || 0];
      priorBodyOverflow = document.body?.style?.overflow || '';
      evidenceDialog.showModal();
      if (document.body?.style) document.body.style.overflow = 'hidden';
      evidenceDialog.scrollTop = 0;
      event.preventDefault();
      return;
    }
    target.open = true;
    let ancestor = target.parentElement;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
    const back = target.querySelector('[data-evidence-return]');
    if (back) { back.setAttribute('href', '#' + link.id); back.textContent = 'Return to ' + link.getAttribute('data-context'); back.hidden = false; }
    target.querySelector('summary')?.focus();
  });
  if (typeof window !== 'undefined') window.addEventListener('hashchange', revealEvidence);
  revealEvidence();
  const briefContext = document.querySelector('.brief-context');
  if (briefContext && typeof window.matchMedia === 'function') briefContext.open = window.matchMedia('(min-width: 701px)').matches;
  const form = document.querySelector('[data-generate]');
  let controller = null;
  let requestToken = 0;
  let cancelPending = null;
  let operationId = null;
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
    const updateOptionsSummary = () => {
      const summary = document.querySelector('[data-options-summary]');
      if (!summary) return;
      const current = formRequest();
      summary.textContent = (current.meetingDate || 'Date not set') + ' · ' + current.durationMinutes + ' minutes';
    };
    // Invalid does not bubble: reveal optional controls before native focus.
    form.addEventListener('invalid', (event) => {
      const disclosure = event.target?.closest?.('details');
      if (disclosure) disclosure.open = true;
    }, true);
    form.addEventListener('change', updateOptionsSummary);
    const updateRecordedReset = () => {
      updateOptionsSummary();
      if (!recordedReset) return;
      const exact = { audience: recordedReset.getAttribute('data-audience') || '', intendedOutcome: recordedReset.getAttribute('data-outcome') || '',
        durationMinutes: Number(recordedReset.getAttribute('data-duration')), meetingDate: recordedReset.getAttribute('data-meeting-date') || '' };
      recordedReset.hidden = JSON.stringify(formRequest()) === JSON.stringify(exact);
    };
    const clearCachedForm = () => { const cleared = invalidateFormCache(); if (!cleared) unavailable(); return cleared; };
    const ready = (message) => { if (button) button.disabled = false; if (status) status.textContent = message; };
    const operationRequest = () => ({ request: formRequest(), operationId, recordId: form.getAttribute('data-record-id') || null, pendingRevisionToken: form.getAttribute('data-pending-revision-token') || null });
    const cancellation = () => {
      if (!operationId) return Promise.resolve({ status: 'No generation started in this page. Current inputs are kept.' });
      if (cancelPending) return cancelPending;
      const pending = requestJson('/api/cancel', operationRequest()).finally(() => {
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
      operationId = window.crypto.randomUUID().replaceAll('-', '');
      controller = new AbortController();
      if (button) button.disabled = true;
      if (status) status.textContent = recordedReplay ? 'Replaying the exact recorded response locally…' : 'Preparing a proposed draft…';
      try {
        const payload = await requestJson('/api/generate', operationRequest(), controller.signal);
        if (token === requestToken && payload.outcome === 'succeeded') {
          if (payload.location === '/?draft=1' && !clearCachedForm() && cacheMayContainStale) {
            ready('Draft prepared, but superseded reload recovery could not be cleared. Do not reload this form; open the session draft from Account Home after browser storage is available.');
            return;
          }
          replacePage(payload);
        } else if (token === requestToken) ready(payload.error || 'Generation did not complete. Inputs kept.');
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
  let reviewBusy = false;
  const reviewForm = document.querySelector('[data-note-form]');
  const correctionNote = document.querySelector('[data-correction-note]');
  let savedNote = correctionNote?.value || '';
  let reviewNavigationApproved = false;
  const noteIsDirty = () => Boolean(correctionNote && correctionNote.value !== savedNote);
  confirmDirtyNavigation = () => {
    if (reviewBusy || !confirmLocalEditDeparture()) return false;
    if (reviewNavigationApproved || !noteIsDirty()) return true;
    if (typeof window.confirm !== 'function') { resetLocalEditDeparture(); return false; }
    const approved = window.confirm('Discard the unsaved correction note and leave this draft?');
    if (approved) reviewNavigationApproved = true;
    else resetLocalEditDeparture();
    return approved;
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', (event) => {
    if (!reviewNavigationApproved && noteIsDirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener?.('click', (event) => {
    const entry = event.target?.closest?.('[data-refine-section]');
    if (entry?.getAttribute('data-refine-section') && reviewStatus) {
      reviewStatus.textContent = 'Correction for ' + entry.getAttribute('data-refine-section') + ': describe the change below. Existing typing is kept.';
      if (correctionNote && !correctionNote.value) correctionNote.value = entry.getAttribute('data-refine-section') + ': ';
      correctionNote?.focus(); document.querySelector('#review')?.scrollIntoView?.({ block: 'nearest' }); return;
    }
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') ||
        (link.getAttribute('target') || '_self').toLowerCase() !== '_self') return;
    if (!confirmDirtyNavigation()) event.preventDefault();
  });
  correctionNote?.addEventListener?.('input', () => { reviewNavigationApproved = false; });
  reviewForm?.addEventListener('submit', async (event) => {
    event.preventDefault(); if (reviewBusy || pendingRevisionToken) return; reviewBusy = true; controls(); const data = new FormData(event.currentTarget); const status = document.querySelector('[data-review-status]');
    const token = ++reviewToken; const recordId = event.currentTarget.getAttribute('data-record-id') || '';
    const submittedNote = String(data.get('note') || '');
    try {
      const payload = await requestJson('/api/note', { note: submittedNote, recordId, priorNote: savedNote });
      if (token === reviewToken) {
        if (payload.savedNote !== submittedNote || typeof payload.noChange !== 'boolean') throw new Error('Note save was not confirmed');
        savedNote = payload.savedNote;
        reviewNavigationApproved = false;
        if (status) status.textContent = (payload.status || 'Note kept for this session. It is not approval or durable storage.') +
          (noteIsDirty() ? ' Newer edits in the textarea are still unsaved.' : '');
      }
    }
    catch (error) { if (token === reviewToken && status) status.textContent = error instanceof Error ? error.message : 'Could not keep correction note'; }
    finally { reviewBusy = false; controls(); }
  });
  let pendingRevisionToken = reviewForm?.getAttribute('data-pending-revision-token') || null;
  let revisionRequest = reviewForm?.getAttribute('data-meeting-request');
  revisionRequest = revisionRequest ? JSON.parse(revisionRequest) : null;
  let stopRequested = false;
  let revisionOperation = null;
  let cancelSettlement = null;
  const reviewStatus = document.querySelector('[data-review-status]');
  const controls = () => {
    reviewForm?.querySelectorAll?.('button').forEach((button) => { button.disabled = reviewBusy || Boolean(pendingRevisionToken); });
    const revise = document.querySelector('[data-revise]');
    if (revise) revise.disabled = reviewBusy || Boolean(pendingRevisionToken) || (recordedReplay && reviewForm?.getAttribute('data-revised') === 'true');
    const stop = document.querySelector('[data-stop-revision]'); if (stop) stop.disabled = !reviewBusy || !revisionOperation && !stopRequested && !pendingRevisionToken && !revisionStaging;
    const retry = document.querySelector('[data-retry-revision]'); if (retry) { retry.hidden = !pendingRevisionToken; retry.disabled = reviewBusy; }
    const discard = document.querySelector('[data-discard-revision]'); if (discard) { discard.hidden = !pendingRevisionToken; discard.disabled = reviewBusy; }
    setSectionRevisionPending(reviewBusy || Boolean(pendingRevisionToken));
  };
  let revisionStaging = false;
  const sameOperation = (a, b) => a && b && a.operationId === b.operationId && a.recordId === b.recordId && a.pendingRevisionToken === b.pendingRevisionToken && JSON.stringify(a.request) === JSON.stringify(b.request);
  const applyRevision = (payload, stagedNote) => {
    const noteSections = ['Situation for this audience', 'Opening', 'Questions', 'Useful close'];
    const changedLabels = ['Proposed objective', 'Situation for this audience', 'Opening', 'Questions', 'Useful close', 'Risks and unknowns', 'Warnings', 'Evidence', 'Temporal outcome'];
    if (typeof payload.recordId !== 'string' || payload.recordId.length !== 27 || !/^c3_[a-f0-9]{24}$/.test(payload.recordId) ||
        typeof payload.savedNote !== 'string' || payload.savedNote !== stagedNote ||
        !payload.sectionNotes || typeof payload.sectionNotes !== 'object' || Array.isArray(payload.sectionNotes) ||
        !Object.entries(payload.sectionNotes).every(([section, text]) => noteSections.includes(section) && typeof text === 'string' && text.length <= 1000) ||
        !Array.isArray(payload.changedSections) || !payload.changedSections.every((section) => typeof section === 'string' && changedLabels.includes(section)) ||
        typeof payload.html !== 'string' || !payload.html.trim()) throw new Error('Revision acknowledgement incomplete. Reopen the session brief before retrying.');
    const parsed = new DOMParser().parseFromString(payload.html, 'text/html');
    if (parsed.querySelector('[data-note-form]')?.getAttribute('data-record-id') !== payload.recordId ||
        Array.from(parsed.querySelectorAll('[data-local-edit][data-section]')).some((form) => form.getAttribute('data-record-id') !== payload.recordId)) {
      throw new Error('Revised display identity inconsistent. Reopen the session brief before retrying.');
    }
    const current = Array.from(document.querySelectorAll('[data-generated-region]'));
    const replacements = current.map((region) => parsed.querySelector('[data-generated-region="' + region.getAttribute('data-generated-region') + '"]'));
    if (!current.length || replacements.some((region) => !region)) throw new Error('Revised display incomplete. Reopen the session brief.');
    rebindSectionNotes(payload.recordId, payload.sectionNotes);
    current.forEach((region, index) => region.replaceChildren(...Array.from(replacements[index].childNodes)));
    reviewForm.setAttribute('data-record-id', payload.recordId);
    reviewForm.setAttribute('data-revised', 'true');
    savedNote = payload.savedNote; pendingRevisionToken = null;
    document.querySelector('[data-revision-differences]').textContent = payload.changedSections.length ? 'Changed sections: ' + payload.changedSections.join(', ') + '.' : 'No section content changed.';
    const help = document.querySelector('[data-recorded-help]'); if (help && recordedReplay) help.textContent = 'Recorded revision replayed locally. No further recorded response exists.';
  };
  const generateRevision = async () => {
    revisionOperation = { request: revisionRequest, recordId: reviewForm.getAttribute('data-record-id'), pendingRevisionToken, operationId: window.crypto.randomUUID().replaceAll('-', '') };
    const owned = revisionOperation;
    const stagedNote = savedNote;
    reviewStatus.textContent = recordedReplay ? 'Replaying the exact recorded revision locally… Previous brief remains available.' : 'Revising the brief… Previous brief remains available.';
    try {
      const payload = await requestJson('/api/generate', owned);
      if (!sameOperation(payload.operation, owned)) throw new Error('Revision operation was not confirmed. Previous brief and typing kept.');
      if (payload.outcome === 'succeeded') { applyRevision(payload, stagedNote); reviewStatus.textContent = 'Revised brief ready. Saved notes and newer typing kept.'; }
      else throw new Error(payload.error || 'Revision did not complete. Previous brief kept.');
    } finally { if (cancelSettlement) await cancelSettlement; revisionOperation = null; }
  };
  document.querySelector('[data-revise]')?.addEventListener('click', async () => {
    if (reviewBusy || pendingRevisionToken || !canStartRevision()) return;
    reviewBusy = true; revisionStaging = true; stopRequested = false; controls();
    const recordId = reviewForm.getAttribute('data-record-id'); const submittedNote = correctionNote.value;
    reviewStatus.textContent = 'Staging this correction. Previous brief remains available.';
    try {
      const payload = await requestJson('/api/revise', { note: submittedNote, recordId, priorNote: savedNote });
      if (payload.noChange === true) { reviewStatus.textContent = payload.status; return; }
      if (payload.revisionReady !== true || payload.recordId !== recordId || payload.savedNote !== submittedNote || !/^[A-Za-z0-9_-]{32}$/.test(payload.pendingRevisionToken) || JSON.stringify(payload.request) !== JSON.stringify(revisionRequest)) throw new Error(payload.error || 'Revision staging was not confirmed. Reopen the session brief before retrying.');
      pendingRevisionToken = payload.pendingRevisionToken; savedNote = payload.savedNote; invalidateFormCache();
      if (stopRequested) { reviewStatus.textContent = 'Stopped before generation. Correction remains pending; retry or discard it. Newer typing kept.'; return; }
      revisionStaging = false; await generateRevision();
    } catch (error) { reviewStatus.textContent = error.message + ' Previous brief and typing kept.'; }
    finally { reviewBusy = false; revisionStaging = false; controls(); }
  });
  document.querySelector('[data-stop-revision]')?.addEventListener('click', () => {
    if (!reviewBusy) return; stopRequested = true;
    reviewStatus.textContent = 'Stopping revision; waiting for local work to settle. Previous brief kept.';
    if (revisionOperation && !cancelSettlement) cancelSettlement = requestJson('/api/cancel', revisionOperation).catch((error) => { reviewStatus.textContent = error.message; }).finally(() => { cancelSettlement = null; });
  });
  document.querySelector('[data-retry-revision]')?.addEventListener('click', async () => {
    if (reviewBusy || !pendingRevisionToken) return; reviewBusy = true; stopRequested = false; controls();
    try { await generateRevision(); } catch (error) { reviewStatus.textContent = error.message + ' Retry or discard the pending correction. Newer typing is kept and is not part of this retry.'; }
    finally { reviewBusy = false; controls(); }
  });
  document.querySelector('[data-use-recorded-note]')?.addEventListener('click', () => {
    const note = document.querySelector('[data-correction-note]');
    const exact = document.querySelector('[data-recorded-note]');
    const status = document.querySelector('[data-review-status]');
    if (note && exact && !reviewBusy) {
      note.value = exact.textContent || '';
      if (status) status.textContent = 'Exact recorded correction copied into the textarea. Review it, then deliberately request the recorded revision.';
      if (typeof note.focus === 'function') note.focus();
    }
  });
  document.querySelector('[data-discard-revision]')?.addEventListener('click', async () => {
    if (reviewBusy || !pendingRevisionToken) return;
    reviewBusy = true; controls(); const stagedNote = savedNote;
    const recordId = reviewForm.getAttribute('data-record-id');
    try {
      const payload = await requestJson('/api/discard-revision', { recordId, pendingRevisionToken });
      if (payload.discarded !== true || payload.recordId !== recordId || typeof payload.savedNote !== 'string') throw new Error('Discard was not confirmed');
      savedNote = payload.savedNote; pendingRevisionToken = null;
      if (correctionNote.value === stagedNote) correctionNote.value = savedNote;
      reviewStatus.textContent = payload.status + (noteIsDirty() ? ' Newer typing kept.' : '');
    } catch (error) { reviewStatus.textContent = error.message; }
    finally { reviewBusy = false; controls(); }
  });
${PLANNING_CLIENT_SCRIPT}
  controls();
})();`;

/** Exact inert browser program, exported only for deterministic handler regression execution. */
export const C3_CLIENT_SCRIPT = SCRIPT;

export const C3_SCRIPT_SHA256 = createHash("sha256").update(SCRIPT, "utf8").digest("base64");

const CSS = `
:root{--paper:#f8f5ee;--ink:#292724;--muted:#625e57;--blue:#214da0;--plum:#4b263e;--line:#d5cec2;--wash:#efebe2;--warn:#843e2c;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--paper)}
*{box-sizing:border-box}body{margin:0;line-height:1.55}header,main,footer,.recorded-mode{width:min(1060px,calc(100% - 48px));margin:auto}a{color:var(--blue);text-underline-offset:3px;overflow-wrap:anywhere}a,button,summary,input,select,textarea{touch-action:manipulation}a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--blue);outline-offset:4px}button,[hidden]{box-sizing:border-box}[hidden]{display:none!important}p,li,dd,pre{overflow-wrap:anywhere}h1,h2,h3{line-height:1.2}h1{font:500 clamp(28px,4vw,40px)/1.15 Georgia,serif;margin:8px 0 16px}h2{font:500 25px/1.25 Georgia,serif;margin:0 0 14px}h3{font-size:17px;margin:0 0 8px}
header{padding:18px 0 0;border-bottom:1px solid var(--line)}.identity{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.brand{font:700 23px Georgia,serif;text-decoration:none;color:var(--ink);display:inline-flex;align-items:center;min-height:44px}.account-identity{font-size:15px;font-weight:650}.journey-nav{display:flex;gap:20px;margin-top:8px;flex-wrap:wrap}.journey-nav a,.journey-nav span{display:inline-flex;align-items:center;min-height:44px;font-size:14px}.journey-nav a[aria-current]{color:var(--ink);font-weight:750;border-bottom:2px solid var(--ink);text-decoration:none}.journey-nav span{color:var(--muted)}.skip-link{position:absolute;top:-80px;left:16px;background:var(--paper);padding:12px;z-index:2}.skip-link:focus{top:8px}
.proposal-section{max-width:760px}.proposal-section .field textarea{min-height:80px}.proposal-owner-date .field textarea{min-height:48px}.proposal-owner-date{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.proposal-owner-date .field{min-width:0}.proposal-section>p.meta{margin-top:0}.proposal-editor>summary{font-size:16px}.kept-proposal dl{margin:8px 0}.kept-proposal dd{margin:0 0 12px}.user-copy{white-space:pre-wrap}.planning-work{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:32px;align-items:start}.planning-work>*{min-width:0}.work-context{padding:22px 16px;background:var(--wash);border-top:1px solid var(--line)}.work-context h2{font-size:22px}.work-context h3{margin-top:20px}.work-context>a{display:inline-flex;align-items:center;min-height:44px}.account-details{margin-top:24px;border-top:1px solid var(--line)}.section-note{border-top:1px solid var(--line);margin-top:16px;padding-top:12px}.section-note textarea{width:100%}.brief-kinds{margin-bottom:20px}.draft-section article+article{border-top:1px solid var(--line)}
.recorded-mode{margin-top:8px;font-size:13px}.recorded-mode>summary{font-size:13px;color:var(--muted)}.recorded-mode p{max-width:760px;margin:0 0 8px}main{padding:28px 0 48px}.eyebrow,.review-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:750;margin:0 0 8px}.lede{max-width:760px;font-size:18px;line-height:1.6}.proposed-cue,.badge{font-size:13px;color:var(--muted)}.hero-actions{margin:20px 0;display:flex;gap:10px;flex-wrap:wrap}.button,button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;padding:10px 16px;border:1px solid var(--ink);border-radius:5px;background:var(--ink);color:#fff;text-decoration:none;font-family:inherit;font-size:14px;font-weight:650;line-height:1.4;cursor:pointer;white-space:normal}.button.secondary,button.secondary{background:transparent;color:var(--ink)}button:disabled,textarea:disabled{cursor:not-allowed;opacity:.62}.orientation{max-width:760px;display:grid;gap:18px;margin:24px 0}.orientation p{margin:4px 0}.home-evidence{max-width:760px;border-block:1px solid var(--line);margin:24px 0}summary{min-height:44px;padding:10px 0;cursor:pointer;color:var(--blue);font-size:14px;font-weight:650}details[open]>summary{margin-bottom:8px}.context-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid var(--line);margin-top:24px}.context-strip div{padding:16px}.context-strip div+div{border-left:1px solid var(--line)}.context-strip strong{display:block;font-size:14px}.context-strip span,.meta,.boundary{font-size:13px;color:var(--muted)}.boundary{margin-top:18px}.form-recovery{margin:8px 0}
form.prepare{max-width:720px}.field{margin:18px 0}.field label,.review label,.section-note label{display:block;font-weight:650;font-size:15px;margin-bottom:6px}.field input,.field textarea,.field select,.review textarea,.section-note textarea{width:100%;min-width:0;min-height:48px;padding:12px;border:1px solid #8b827a;border-radius:4px;background:#fffdf8;color:var(--ink);font:inherit}.field textarea,.review textarea,.section-note textarea{min-height:96px;resize:vertical}.option-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.status-line{min-height:24px;margin:12px 0;font-size:14px;color:var(--muted)}.meeting-context{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px 24px;padding:18px 0;margin:0 0 20px;border-block:1px solid var(--line)}.meeting-context div{min-width:0}.meeting-context .outcome{grid-column:1/-1}.meeting-context dt{font-size:12px;color:var(--muted);margin-bottom:3px}.meeting-context dd{margin:0;font-size:16px}.meeting-context .outcome dd{font-weight:650}.draft-head{max-width:800px}.draft-grid{display:grid;grid-template-columns:minmax(0,720px);margin-top:24px}.draft-section{padding:22px 0;border-top:1px solid var(--line)}.draft-section p{margin:6px 0}.support{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap}.support a,.warning a,.meta a,.evidence-return{display:inline-flex;align-items:center;min-height:44px;max-width:100%;padding:3px 6px}.support a{border-radius:4px;background:var(--wash)}.direct-source,blockquote{margin:12px 0;padding:12px 16px;border-left:3px solid var(--line);background:#fffdf8;font:17px/1.6 Georgia,serif;overflow-wrap:anywhere}.source-attribution{font-size:13px;color:var(--muted)}.questions{counter-reset:q;list-style:none;padding:0;margin:0}.questions li{counter-increment:q;padding:22px 0 22px 46px;border-top:1px solid var(--line);position:relative}.questions li:before{content:counter(q,decimal-leading-zero);position:absolute;left:0;color:var(--muted);font-weight:700}.questions strong{font-size:17px;font-weight:650}.question-kind{display:none}.learning{color:var(--muted);font-size:14px}.optional-probe p{font-size:14px;color:var(--muted)}.warning{border-left:3px solid var(--warn);padding:10px 14px;margin:12px 0;background:#f3e9dd;font-size:14px}.checks{max-width:800px;margin:26px 0}.checks ul{padding-left:20px}.checks li{margin-bottom:16px}.evidence-list{max-width:800px;margin:26px 0}.evidence-list>details{border-top:1px solid var(--line);padding:6px 0;scroll-margin-top:20px}.evidence-list details:target{border-left:3px solid var(--blue);padding-left:14px}.source-text{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.65 ui-monospace,monospace;max-height:480px;overflow:auto;padding:12px;background:#fffdf8}.recorded-note{margin:14px 0}.recorded-note pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.55 inherit}.review{max-width:800px;margin:26px 0;padding:20px;border:1px solid var(--line);border-radius:6px;background:var(--wash);color:var(--ink)}.review-label{color:var(--muted)}.review button{margin-top:10px}.review button.secondary{margin-left:8px}.review [data-review-status]{color:var(--muted)}.technical-detail{max-width:800px}.technical-detail p{font-size:13px;color:var(--muted)}footer{padding:16px 0 28px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.meeting-context{gap:8px 20px;padding:10px 0;margin-bottom:10px}.meeting-context .outcome{grid-column:auto}.meeting-context{grid-template-columns:1fr auto 2fr}.draft-head .hero-actions{margin:10px 0}.draft-grid{margin-top:12px}.draft-section{padding:16px 0}.questions li{padding-top:16px;padding-bottom:16px}.section-note>details>summary{font-size:13px}.section-note [hidden]{display:none}dialog[data-evidence-dialog]{position:fixed;inset:0 0 0 auto;margin:0;width:min(580px,95vw);max-width:100%;height:100dvh;max-height:100dvh;border:0;border-left:1px solid var(--line);padding:24px;background:var(--paper,#f8f5ee);color:var(--ink);overflow:auto;overscroll-behavior:contain}dialog::backdrop{background:rgb(30 25 20 / .35)}.evidence-panel-head{display:flex;align-items:start;justify-content:space-between;gap:16px}.evidence-panel-head h2{font-size:20px;margin:0}.evidence-panel-head button{flex-shrink:0}.evidence-panel-head{position:sticky;top:-24px;background:var(--paper,#f8f5ee);padding:12px 0;z-index:1}
@media(max-width:700px){dialog[data-evidence-dialog]{inset:auto 0 0;width:100%;height:85dvh;max-height:85dvh;border-radius:14px 14px 0 0;padding:20px}.meeting-context{gap:8px}.meeting-context .outcome{grid-column:1/-1}.proposal-owner-date{grid-template-columns:minmax(0,1fr);gap:0}header,main,footer,.recorded-mode{width:calc(100% - 32px)}main{padding-top:24px}.identity{gap:4px 16px}.account-identity{flex-basis:100%;font-size:14px}.journey-nav{gap:18px}.planning-work,.context-strip,.option-grid,.meeting-context{grid-template-columns:minmax(0,1fr)}.context-strip div+div{border-left:0;border-top:1px solid var(--line)}.option-grid{gap:0}.field{margin:12px 0}.questions li{padding-left:34px}.review{padding:16px}.review button{width:100%}.review button.secondary{margin-left:0}.hero-actions .button,.hero-actions button{flex-grow:1}.meeting-context .outcome{grid-column:auto}}
:root{font-family:ui-sans-serif,system-ui,sans-serif}body{font-size:17px}.meta,.boundary,.support,.source-attribution,.proposed-cue,.badge,.recorded-mode,.recorded-mode>summary,.context-strip span{font-size:14px}.account-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;align-items:start;margin-top:20px}.account-hero .lede{font:500 23px/1.5 Georgia,serif;margin:0}.action-area{background:#eee6eb;border-top:2px solid var(--plum);padding:20px}.action-area>p{margin:8px 0}.action-area .button{background:var(--plum);border-color:var(--plum)}.action-area .button.secondary{background:transparent;color:var(--plum)}.prepare-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:32px;align-items:start}.prepare-layout>*{min-width:0}.brief-context{margin-top:18px}.brief-context>summary{color:var(--ink);font-size:17px}.brief-context .work-context{padding:16px}.brief-context .work-context p{margin:8px 0}.secondary-worksheets{margin:16px 0}.meeting-options{border-block:1px solid var(--line)}.account-identity{overflow-wrap:anywhere;min-width:0}.account-hero>*{min-width:0}
@media(max-width:700px){main{padding-top:16px}.account-hero,.prepare-layout{grid-template-columns:minmax(0,1fr);gap:12px}.account-hero .lede{font-size:20px;line-height:1.45}.action-area{padding:16px}.action-area .hero-actions{margin:12px 0 0}.identity{gap:4px 12px}.account-identity{flex-basis:auto;flex:1;font-size:14px}.recorded-mode{margin-top:0}.brief-context{margin-top:0}.prepare .field{margin:10px 0}.prepare .field textarea{min-height:80px}.prepare .hero-actions{margin:12px 0}.context-strip{grid-template-columns:minmax(0,1fr)}}

`;

function shell(title: string, body: string, csrf: string, context: FrozenC3AccountContext, recorded: boolean,
  page: C3PageState["page"], hasDraft: boolean, synthetic = false): string {
  const nav = (name: string, route: string, current: C3PageState["page"]) => `<a href="${route}"${page === current ? ' aria-current="page"' : ""}>${name}</a>`;
  const boundary = `<details class="recorded-mode"><summary>${synthetic ? "Synthetic local preview · Session-only" : recorded ? "Recorded preview · Session-only" : "Local preview · Proposed, session-only"}</summary><p>${synthetic ? "Hand-authored fixtures · No AI recordings. Every meeting response and correction is synthetic test data. “Recorded” controls exercise exact matching only." : recorded ? "Private candidate preview · Recorded responses · No live generation. Proposed meeting drafts." : isCuratedContext(context) ? "Agent-curated proposed/template context. No human approval, owner disposition, policy admission or model recording. Owner and date unassigned." : "Proposed and unreviewed local content."} Session-only; no approval or durable save. Drafts and notes survive reload in this browser session only; a server restart loses them.</p></details>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="c3-csrf" content="${esc(csrf)}"><meta name="c3-account" content="${esc(context.context.account.accountId)}">${recorded ? '<meta name="c3-recorded-replay" content="true">' : ""}<title>${esc(title)} · Atliera</title><style>${CSS}</style></head><body><a class="skip-link" href="#main">Skip to content</a><header><div class="identity"><a class="brand" href="/">Atliera</a><span class="account-identity">${esc(context.context.account.accountName)}</span></div><nav class="journey-nav" aria-label="Account journey">${nav("Account Intel", "/", "home")}${nav("Workshop", "/?prepare=1", page === "planning" ? "planning" : "prepare")}${hasDraft ? nav("Meeting draft", "/?draft=1", "draft") : ""}</nav></header>${boundary}${body}<footer><details><summary>Session and preview details</summary><p>Nothing is shared, sent, approved, or saved to the account. Reopening needs the same browser cookie and running server. Prepare reports whether this tab can recover unsubmitted edits.</p>${recorded ? `<p>Any wait replays local ${synthetic ? 'synthetic fixture' : 'recorded'} bytes; it is not live provider timing. Exact request matching has no live fallback.</p>` : ''}</details></footer><script>${SCRIPT}</script></body></html>`;
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
    `<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote><p class="meta">${esc(item.source.title)} · ${esc(item.source.publisher)} · Published ${esc(humanDate(item.source.publicationDate))} · Event ${esc(humanDate(item.source.eventDate))} · Current through ${esc(humanDate(item.source.evidenceCurrentThrough))}</p>${context.context.rendererAnnotations.filter((annotation) => annotation.sourceId === item.source.sourceId && annotation.evidenceIds.includes(item.excerpt.evidenceId)).map((annotation) => `<p class="meta">${esc(annotation.text)}</p>`).join("")}<p class="meta"><a href="${esc(item.source.canonicalUrl)}" target="_blank" rel="noreferrer">Open source (new tab)</a></p><details><summary>Full retained source context</summary><p class="meta">Complete supplied bounded clean text; not original web or PDF completeness.</p><pre class="source-text" tabindex="0">${esc(item.source.fullBoundedCleanText)}</pre></details>`).join("");
  const action = "Prepare for…";
  const pendingBanner = revisionPending ? '<div class="warning"><strong>Revision pending.</strong> The previous valid draft remains available read-only until the revision succeeds or you explicitly discard it.</div>' : "";
  return `<main id="main" tabindex="-1"><p class="eyebrow">Account Intel</p><h1>What to explore</h1><span class="proposed-cue">Proposed account orientation · not reviewed</span>${pendingBanner}<section class="account-hero"><p class="lede">${esc(proposal.accountThesis.text)}</p><div class="action-area"><strong>Proposed next action</strong><div class="hero-actions">${eligible ? `<a class="button" href="/?prepare=1">${action}</a>` : '<span class="badge">Preparation held pending C2 revision</span>'}${hasDraft ? '<a class="button secondary" href="/?draft=1">Reopen session draft</a>' : ""}</div><p>${esc(nextAction)}</p>${context.context.declaredContradictions.map(text => `<p class="warning"><strong>Conflicting context.</strong> ${esc(text)}</p>`).join("")}${context.context.materialGaps[0] ? `<p class="warning">${esc(businessGapLabel(context.context.materialGaps[0]))}</p>` : ""}</div></section>${implication !== proposal.accountThesis.text ? `<div class="orientation"><div><strong>Why this is worth checking</strong><p>${esc(implication)}</p></div></div>` : ""}<details class="home-evidence"><summary>Sources used · ${esc(supportMeaning)}</summary>${evidence}</details><section class="context-strip"><div><strong>Sources used</strong><span>${String(context.context.admittedSources.length)} supplied sources; no new research</span></div>${context.context.materialGaps[0] ? `<div><strong>Still to establish</strong><span>${esc(businessGapLabel(context.context.materialGaps[0]))}</span></div>` : ""}<div><strong>No earlier account review to compare</strong><span>Initial dated events are not called changes against a prior revision</span></div></section><details class="technical-detail"><summary>Context and timing details</summary><p class="boundary">${isCuratedContext(context) ? "This orientation uses agent-curated public excerpts, not admitted C2 evidence." : "This orientation reuses admitted C2 evidence."} It does not claim that the legacy “meaningfully changed” bucket proves temporal change, ${isCuratedContext(context) ? "and no C2 owner disposition or generated C3 content exists" : "and the C2 disposition does not approve generated C3 content"}.</p></details><details><summary>Further uncertainty and checks</summary>${contextChecks(context)}</details>${accountIntelSections(context, false)}</main>`;
}

function sameMeetingRequest(left: C3MeetingFormState, right: C3MeetingFormState): boolean {
  return left.audience === right.audience && left.intendedOutcome === right.intendedOutcome &&
    left.durationMinutes === right.durationMinutes && left.meetingDate === right.meetingDate;
}

function prepare(context: FrozenC3AccountContext, request: C3MeetingFormState, error: string | undefined, hasDraft: boolean,
  recorded: boolean, recordedRequest?: C3MeetingFormState, correctionNote?: string, revisionPending = false, displayedRecordId: string | null = null, pendingRevisionToken: string | null = null): string {
  if (isCuratedContext(context)) return `<main id="main" tabindex="-1"><h1>Plan with the supplied context</h1><p>Agent-curated proposed context · no model-generated meeting draft or recording is available.</p><p>Owner and meeting date are unassigned. Use an editable planning template instead.</p><a class="button" href="/?kind=strategy">Open strategy template</a><a class="button secondary" href="/?kind=next-steps">Open next-steps template</a>${briefContext(context)}${accountIntelSections(context)}</main>`;
  const status = error ?? (recorded ? "Only the exact recorded request will replay. Edited inputs are refused; no live provider will be called." : "A model provider must be configured by the local server operator.");
  const pending = revisionPending && correctionNote !== undefined && correctionNote.length > 0 ? `<p class="warning"><strong>Revision pending — previous draft preserved.</strong> Cancel stops generation; reopen the draft to deliberately discard the revision.</p><details class="recorded-note"><summary>Correction included in this revision</summary><p>This exact correction note remains session-only. It is not approval or account truth. Cancel stops generation but does not discard the pending revision.</p><pre>${esc(correctionNote)}</pre></details>` : "";
  const reset = recordedRequest === undefined ? "" : `<button class="secondary" type="button" data-use-recorded-request data-audience="${esc(recordedRequest.audience)}" data-outcome="${esc(recordedRequest.intendedOutcome)}" data-duration="${String(recordedRequest.durationMinutes)}" data-meeting-date="${esc(recordedRequest.meetingDate)}"${sameMeetingRequest(request, recordedRequest) ? " hidden" : ""}>Use recorded request</button>`;
  return `<main id="main" tabindex="-1"><p class="eyebrow">Prepare for…</p><h1>Prepare a meeting</h1>${hasDraft ? '<p><a class="button secondary" href="/?draft=1">Reopen session draft</a></p>' : ""}${pending}<div class="prepare-layout"><form class="prepare" data-generate data-record-id="${esc(displayedRecordId ?? "")}" data-pending-revision-token="${esc(pendingRevisionToken ?? "")}"><div class="field"><label for="audience">Who is this for?</label><input id="audience" name="audience" required maxlength="160" value="${esc(request.audience)}" placeholder="CISO"></div><div class="field"><label for="outcome">What outcome do you want?</label><textarea id="outcome" name="intendedOutcome" required maxlength="500" placeholder="Understand priorities and agree a useful next step">
${esc(request.intendedOutcome)}</textarea></div><details class="meeting-options"><summary>More options · <span data-options-summary>${esc(request.meetingDate || "Date not set")} · ${request.durationMinutes} minutes</span></summary><div class="option-grid"><div class="field"><label for="duration">Duration</label><select id="duration" name="durationMinutes">${[15,30,45,60].map((value) => `<option value="${String(value)}"${request.durationMinutes === value ? " selected" : ""}>${String(value)} minutes</option>`).join("")}</select></div><div class="field"><label for="meeting-date">Meeting date</label><input id="meeting-date" name="meetingDate" type="date" required value="${esc(request.meetingDate)}"></div></div></details><p class="status-line" data-status role="status" aria-live="polite">${esc(status)}</p><p class="boundary form-recovery" data-form-recovery aria-live="polite">Unsubmitted edits are not durably saved. This tab is checking whether it can keep them through reload.</p><div class="hero-actions"><button type="submit">${recorded ? "Replay exact recorded response" : "Prepare brief"}</button>${reset}<button class="secondary" type="button" data-cancel>Cancel</button></div></form>${briefContext(context)}</div>${workshopKinds("meeting")}${accountIntelSections(context)}<details class="technical-detail"><summary>How this draft is prepared</summary><p class="boundary">${recorded ? "Replay waiting is local request matching and validation, not live model timing. No arbitrary edit can manufacture a result." : "The model receives the complete versioned account context—not the compact Account Home projection. It may select evidence and write prose; it cannot assign approval, governance, or durable-save fields."}</p></details></main>`;
}

function supportLabel(item: C3SupportedText): string {
  return item.supportCategory === "direct_support" ? "Direct support" : item.supportCategory === "cautious_inference" ? "Cautious inference · related evidence context" :
    item.supportCategory === "recommendation" ? "Recommendation · proposed action" : item.supportCategory === "unknown" ? "Unknown · not established" : "Open question";
}

type EvidenceDisplay = { readonly source: FrozenC3AccountContext["context"]["admittedSources"][number];
  readonly excerpt: FrozenC3AccountContext["context"]["admittedSources"][number]["excerpts"][number] };

function citationId(contextName: string, number: number): string {
  return `cite-${contextName.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-${String(number)}`;
}

function evidenceLinks(refs: readonly string[], numberById: ReadonlyMap<string, number>,
  sourceByEvidence: ReadonlyMap<string, EvidenceDisplay>, contextName: string, statement?: C3SupportedText): string {
  if (refs.length === 0) return "No evidence asserted";
  return refs.map((id) => { const number = numberById.get(id) ?? 0; const source = sourceByEvidence.get(id);
    const dated = source?.source.evidenceCurrentThrough ?? source?.source.eventDate ?? source?.source.publicationDate;
    return `<a id="${citationId(contextName, number)}" data-evidence-link data-context="${esc(contextName)}" data-support="${statement?.supportCategory === "direct_support" && statement.text === source?.excerpt.exactExcerpt ? "Direct supporting evidence" : "Related evidence context"}" href="#evidence-${String(number)}" aria-label="${esc(`${contextName} evidence ${String(number)}: ${source?.source.title ?? "source"}`)}">Evidence ${String(number)} · ${dated ? esc(humanDate(dated)) : "Undated"}</a>`; }).join(" ");
}

function contextChecks(context: FrozenC3AccountContext): string {
  return accountGaps(context);
}

function draftPage(context: FrozenC3AccountContext, record: C3GenerationRecord, note: string, recordedCorrection: string | undefined,
  revisionPending: boolean, pendingRevisionToken?: string, notice?: string, sectionNotes: SectionNotes = {}): string {
  const draft = record.draft!;
  const request = record.meetingRequest;
  const sourceByEvidence = new Map(context.context.admittedSources.flatMap((source) => source.excerpts.map((excerpt) => [excerpt.evidenceId, { source, excerpt }] as const)));
  const numberById = new Map(draft.selectedEvidenceRefs.map((id, index) => [id, index + 1]));
  const body = (item: C3SupportedText): string => {
    if (item.supportCategory !== "direct_support") return `<p>${esc(item.text)}</p>`;
    const exact = item.evidenceRefs.map((id) => sourceByEvidence.get(id)).find((entry) => entry?.excerpt.exactExcerpt === item.text)!;
    return `<blockquote class="direct-source">${esc(item.text)}</blockquote><p class="source-attribution">${esc(exact.source.title)} · ${esc(exact.source.publisher)}</p>`;
  };
  const supported = (title: string, item: C3SupportedText) => `<section class="draft-section"><div data-generated-region="${esc(title)}"><h2>${esc(title)}</h2>${body(item)}<p class="support"><span>${esc(supportLabel(item))}</span>${evidenceLinks(item.evidenceRefs, numberById, sourceByEvidence, title, item)}</p></div><button type="button" class="secondary" data-refine-section="${esc(title)}">Refine this section</button>${sectionNoteEditor(title, record.recordId, sectionNotes, false)}</section>`;
  const initialWarning = recordedCorrection !== undefined && record.revision === null ? '<div class="warning"><strong>Recorded initial — before correction.</strong> Historical input to the correction workflow; not recommended meeting copy.</div>' : "";
  const pending = '<p class="status-line" data-revision-differences role="status"></p>';
  const recordedHelp = revisionPending || recordedCorrection === undefined ? "" : record.revision === null ? `<details class="recorded-note"><summary>Exact correction available for the recorded revision</summary><p>One recorded revision is available. This operator-recorded correction is not owner approval or account truth. The button deliberately replaces the textarea with the exact recorded text.</p><pre data-recorded-note>${esc(recordedCorrection)}</pre><button type="button" data-use-recorded-note>Use exact recorded correction</button></details>` : '<p class="meta"><strong>Recorded revision.</strong> No further recorded response exists.</p>';
  const learning = (text: string): string => { const marker = "Optional probe:"; const at = text.indexOf(marker);
    if (at < 0) return `<p class="learning">Learn: ${esc(text)}</p>`;
    const prefix = text.slice(0, at);
    return `${prefix.length === 0 ? "" : `<p class="learning">Learn: ${esc(prefix)}</p>`}<details class="optional-probe"><summary>Optional probe — only if relevant</summary><p>${esc(text.slice(at))}</p></details>`;
  };
  const sourceDetail = (source: EvidenceDisplay["source"]) => `<p class="meta">${esc(source.publisher)} · Published ${esc(humanDate(source.publicationDate))} · Event ${esc(humanDate(source.eventDate))} · Current through ${esc(humanDate(source.evidenceCurrentThrough))}</p><p class="meta">${source.publicationDate === null && source.eventDate === null && source.evidenceCurrentThrough === null ? "Undated source — recheck before meeting." : "Dated evidence does not establish current meeting-day status; recheck before relying on it."}</p><p class="meta"><a href="${esc(source.canonicalUrl)}" target="_blank" rel="noreferrer">Open source (new tab)</a></p>`;
  const retained = (source: EvidenceDisplay["source"]) => `<details><summary>Full retained source context</summary><p class="meta">Complete supplied bounded clean text; not a claim of original web or PDF completeness.</p><pre class="source-text" tabindex="0">${esc(source.fullBoundedCleanText)}</pre></details>`;
  const selectedSources = new Set(draft.selectedEvidenceRefs.map((id) => sourceByEvidence.get(id)!.source.sourceId));
  const otherSources = context.context.admittedSources.filter((source) => !selectedSources.has(source.sourceId));
  const temporal = draft.temporalOutcome === "insufficient_context" ? "Context is insufficient. Treat this as a discovery agenda; the gaps below remain open." : draft.temporalOutcome === "no_material_change_established" ? "No material change established. This brief does not claim new account developments." : "Initial dated discovery. Source dates do not prove a change from an earlier account review.";
  const disabled = "";
  const revisionDisabled = revisionPending || (recordedCorrection !== undefined && record.revision !== null) ? " disabled" : "";
  return `<main id="main" tabindex="-1"><div class="draft-head"><p class="eyebrow">Meeting draft</p><h1>Your meeting brief</h1>${workshopKinds("meeting")}<dl class="meeting-context" aria-label="Meeting setup from this draft’s request"><div><dt>Audience</dt><dd>${esc(request.audience)}</dd></div><div><dt>When · Duration</dt><dd>${esc(humanDate(request.meetingDate))} · ${String(request.durationMinutes)} minutes</dd></div><div class="outcome"><dt>Intended outcome</dt><dd>${esc(request.intendedOutcome)}</dd></div></dl><details data-generated-region="objective" class="technical-detail"${draft.objective.supportCategory === "unknown" ? " open" : ""}><summary>Proposed objective</summary>${body(draft.objective)}<p class="support"><span>${esc(supportLabel(draft.objective))}</span>${evidenceLinks(draft.objective.evidenceRefs, numberById, sourceByEvidence, "Meeting objective", draft.objective)}</p></details><div class="hero-actions"><a class="button secondary" href="/?prepare=1">${recordedCorrection === undefined ? "Edit meeting setup" : "Return to recorded request"}</a><a class="button secondary" href="#review">${revisionPending ? "View session note" : "Add a correction"}</a></div></div>${notice ? `<p class="status-line" role="status">${esc(notice)}</p>` : ""}<div data-generated-region="state">${initialWarning}${revisionPending ? "<p>Revision pending. This is the preserved previous draft. Stop waits for generation; discard restores the previous saved note.</p>" : ""}<p class="meta">${esc(temporal)}</p></div>${pending}<div class="draft-grid"><div>${supported("Situation for this audience", draft.audienceThesis)}${supported("Opening", draft.opening)}<section class="draft-section" aria-labelledby="questions-heading"><div data-generated-region="questions"><h2 id="questions-heading">${draft.questions.length === 3 ? "Three" : String(draft.questions.length)} questions, in order</h2><ol class="questions">${draft.questions.map((question, index) => `<li id="question-${String(index + 1)}"><strong>${esc(question.question)}</strong>${learning(question.intendedLearning)}<p class="support"><span>Open question · Related evidence context</span>${evidenceLinks(question.evidenceRefs, numberById, sourceByEvidence, `Question ${String(index + 1)}`)}</p></li>`).join("")}</ol></div><button type="button" class="secondary" data-refine-section="Questions">Refine these questions</button>${sectionNoteEditor("Questions", record.recordId, sectionNotes, false)}</section>${supported("Useful close", draft.closeCriterion)}</div></div><section data-generated-region="checks" class="checks" aria-labelledby="checks-heading"><h2 id="checks-heading">Before relying on this brief</h2>${draft.risksUnknowns.map((item, index) => `${body(item)}<p class="support"><span>${esc(supportLabel(item))}</span>${evidenceLinks(item.evidenceRefs, numberById, sourceByEvidence, `Risk or unknown ${String(index + 1)}`, item)}</p>`).join("")}${draft.warnings.map((warning, index) => `<div class="warning">${esc(warning.message)}${warning.evidenceRefs.length === 0 ? "" : `<p class="support">${evidenceLinks(warning.evidenceRefs, numberById, sourceByEvidence, `Draft warning ${String(index + 1)}`)}</p>`}</div>`).join("")}</section>${contextChecks(context)}<details class="evidence-list" data-generated-region="evidence" aria-labelledby="evidence-heading"><summary id="evidence-heading">Evidence behind the brief</summary><p class="meta">Exact excerpts and source dates. References attached to an inference or question supply context, not direct proof.</p>${draft.selectedEvidenceRefs.map((id, index) => { const item = sourceByEvidence.get(id)!; return `<details id="evidence-${String(index+1)}"><summary>Evidence ${String(index+1)} · ${esc(item.source.title)}</summary><a class="evidence-return" data-evidence-return href="#questions-heading" hidden>Return to questions</a><div data-evidence-content>${admittedSourceSectionContext(item)}<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote>${sourceDetail(item.source)}${context.context.rendererAnnotations.filter((annotation) => annotation.sourceId === item.source.sourceId && (annotation.evidenceIds.length === 0 || annotation.evidenceIds.includes(id))).map((annotation) => `<p class="meta">${esc(annotation.text)}</p>`).join("")}${retained(item.source)}</div><p class="meta"><a href="#questions-heading">Back to questions</a></p></details>`; }).join("")}${draft.selectedEvidenceRefs.length === 0 ? '<p>No evidence selected by this draft. Do not treat the proposed content as established account fact.</p>' : ""}${otherSources.length === 0 ? "" : `<details><summary>Other retained account sources (${String(otherSources.length)})</summary>${otherSources.map((source) => `<h3>${esc(source.title)}</h3>${sourceDetail(source)}${retained(source)}`).join("")}</details>`}</details><dialog data-evidence-dialog aria-labelledby="evidence-panel-title"><div class="evidence-panel-head"><h2 id="evidence-panel-title">Evidence</h2><button type="button" data-evidence-close autofocus>Close evidence</button></div><p data-evidence-support class="support"></p><div data-evidence-panel-body></div></dialog><section class="review" id="review" aria-labelledby="review-heading"><p class="review-label">Draft review</p><h2 id="review-heading">Refine your brief</h2><p class="meta">Keep a session note, or include it in a revised draft. Notes are lost when this server session ends.</p>${recordedHelp ? `<div data-recorded-help>${recordedHelp}</div>` : ""}<form data-note-form data-record-id="${esc(record.recordId)}" data-meeting-request="${esc(JSON.stringify(request))}" data-revised="${record.revision !== null}"${pendingRevisionToken ? ` data-pending-revision-token="${esc(pendingRevisionToken)}"` : ""}><label for="correction-note">What should change?</label><textarea id="correction-note" data-correction-note name="note" maxlength="1000" placeholder="Describe what should change"${disabled}>
${esc(note)}</textarea><p class="status-line" data-review-status role="status" aria-live="polite"></p><button type="submit"${revisionPending ? " disabled" : ""}>Add a note</button><button class="secondary" type="button" data-revise${revisionDisabled}>Revise brief</button></form><button type="button" data-stop-revision disabled>Stop revision</button><button type="button" data-retry-revision${revisionPending ? "" : " hidden"}>Retry pending revision</button><button type="button" data-discard-revision${revisionPending ? "" : " hidden"}>Discard pending revision</button></section><details data-generated-region="record" class="technical-detail"><summary>Record and timing details</summary><p>Temporal outcome: ${esc(draft.temporalOutcome.replace(/_/gu," "))}. Model prose and raw response are retained unchanged; display grouping does not establish source truth.</p><p>Record: ${esc(record.recordId)}. Context: ${esc(record.contextSha256)}.</p></details></main>`;
}

function admittedSourceSectionContext({ source, excerpt: selected }: EvidenceDisplay): string {
  const headingId = "evidence_c0bc6cf74d035bc8e08a";
  if (selected.evidenceId !== "evidence_2e20762caf4b11701059") return "";
  const heading = source.excerpts.find((item) => item.evidenceId === headingId);
  if (!heading || heading.exactExcerpt !== "“RESPONSIBLE AI" || heading.sourceId !== source.sourceId ||
      selected.sourceId !== source.sourceId || heading.sourceCharStart >= selected.sourceCharStart) return "";
  return `<p class="source-section" data-evidence-id="${headingId}"><strong>Source section:</strong> Responsible AI <span class="meta">Heading evidence ${headingId}</span></p>`;
}

function renderPage(context: FrozenC3AccountContext, state: C3PageState, csrf: string, options?: C3RenderOptions): string {
  const recorded = options !== undefined;
  if (state.page === "planning") return shell(`Workshop for ${context.context.account.accountName}`, planningPage(context, state.brief, state.strategySuggestion), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview);
  if (state.page === "home") return shell(context.context.account.accountName, home(context, state.hasDraft ?? false, recorded,
    state.revisionPending ?? false), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview);
  if (state.page === "prepare") return shell(`Prepare for ${context.context.account.accountName}`, prepare(context, state.request, state.error,
    state.hasDraft ?? false, recorded, options?.initialRequest, state.correctionNote, state.revisionPending, state.displayedRecordId, state.pendingRevisionToken), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview);
  const draft = draftPage(context, state.record, state.correctionNote, options?.correctionNote, state.revisionPending ?? false,
    state.pendingRevisionToken, state.notice, state.sectionNotes);
  return shell(`Draft for ${context.context.account.accountName}`, draft,
    csrf, context, recorded, state.page, true, options?.syntheticPreview);
}

export function renderC3Page(context: FrozenC3AccountContext, state: C3PageState, csrf: string, options?: C3RenderOptions): string {
  if (isCuratedContext(context)) {
    if (options !== undefined || state.page === "draft") throw new Error("Agent-curated context cannot render recorded-model claims");
    return renderPage(context, state, csrf);
  }
  return renderPage(context, state, csrf, options);
}
