import { WORKING_DOCUMENT_CLIENT_SCRIPT } from './work-client.ts';
import { WORKSPACE_CSS } from "./workspace-style.ts";
import { researchUrl, type ResearchTopic, type WorkspaceDestination } from "./workspace-route.ts";
import { createHash } from "node:crypto";
import { projectAccount, type AccountReading, type AccountTopic } from "./account-projection.ts";
import { ACCOUNT_READING_CLIENT_SCRIPT } from "./account-client.ts";
import { projectAccountResearch, renderAccountResearch } from "./account-research.ts";

import { PLANNING_CLIENT_SCRIPT } from "./planning-client.ts";
import { accountGaps, businessGapLabel, briefContext, accountIntelSections, planningPage, sectionNoteEditor, workshopKinds } from "./planning-render.ts";
import type { PlanningBrief, SectionNotes } from "./planning.ts";
import { isCuratedContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";
import type { C3GenerationRecord, C3MeetingFormState, C3SupportedText } from "./draft.ts";

export type WorkOrigin = 'live' | 'historical-replay' | 'synthetic' | 'unknown';
export interface WorkDisplayState {
  readonly available: boolean; readonly documentId: string; readonly version: number;
  readonly workVersion: number; readonly saved: boolean; readonly title?: string;
  readonly savedAt?: string; readonly origin?: WorkOrigin;
  readonly savedWorks: readonly { documentId: string; version: number; audience: string;
    title?: string; intendedOutcome?: string; meetingDate?: string; savedAt?: string; origin?: WorkOrigin }[];
  readonly storageError?: string;
}
type C3PendingState = { readonly revisionPending: true; readonly pendingRevisionToken: string } |
  { readonly revisionPending?: false; readonly pendingRevisionToken?: never };

export type C3PageState = (
  | { readonly page: "planning"; readonly brief: PlanningBrief; readonly strategySuggestion?: PlanningBrief["sections"][number]; readonly hasDraft?: boolean }
  | { readonly page: "home"; readonly hasDraft?: boolean }
  | { readonly page: "research"; readonly topic: ResearchTopic; readonly reading?: string; readonly hasDraft?: boolean }
  | { readonly page: "workshop"; readonly hasDraft?: boolean; readonly worksheets?: readonly PlanningBrief[] }
  | { readonly page: "prepare"; readonly request: C3MeetingFormState; readonly error?: string; readonly hasDraft?: boolean;
      readonly correctionNote?: string; readonly displayedRecordId?: string | null }
  | { readonly page: "draft"; readonly record: C3GenerationRecord; readonly correctionNote: string; readonly notice?: string; readonly sectionNotes?: SectionNotes }) & C3PendingState & { readonly instruction?: string; readonly proposalStale?: boolean; readonly proposal?: C3GenerationRecord | null; readonly work?: WorkDisplayState; readonly generation?: { readonly available: boolean; readonly explanation: string } };

export interface C3RenderOptions {
  readonly correctionNote: string;
  readonly syntheticPreview?: boolean;
  readonly initialRequest: C3MeetingFormState;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function uiIcon(kind: 'priority' | 'people' | 'technology' | 'source' | 'question'): string {
  const paths = {
    priority: '<path d="M5 20v-6m7 6V9m7 11V4"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/>',
    technology: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>',
    source: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

function humanDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date not established";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00.000Z`));
}

const SCRIPT = `
(() => {
  const csrf = document.querySelector('meta[name="c3-csrf"]')?.getAttribute('content') || '';
  const account = document.querySelector('meta[name="c3-account"]')?.getAttribute('content') || '';
  let workDocumentId = document.querySelector('meta[name="c3-document"]')?.getAttribute('content') || '';
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
  let flushSectionNotes = async () => {};
  let displayedSectionNotes = () => ({});
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
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-c3-csrf': csrf, 'x-c3-document': workDocumentId }, body: JSON.stringify(body), signal });
    const payload = await response.json().catch(() => ({ error: 'Invalid local service response' }));
    if (!response.ok && typeof payload.html !== 'string') { const error = new Error(payload.error || 'Request failed'); error.status = response.status; error.route = url; throw error; }
    return payload;
  };
  const showFailure = (status, error, message) => {
    const diagnostics = status?.parentElement?.querySelector?.('[data-error-diagnostics]');
    if(diagnostics) { diagnostics.hidden = false; const exact = diagnostics.querySelector('pre'); if(exact) exact.textContent = error instanceof Error ? error.message : String(error); }
    if(status) status.textContent = message;
  };
  const revealEvidence = () => {
    const hash = typeof window !== 'undefined' ? window.location?.hash || '' : '';
    if (!/^#evidence-[0-9]+$/.test(hash)) return;
    const target = document.querySelector(hash);
    if (!target) return;
    const store = target.closest?.('.evidence-store');
    if (store) store.hidden = false;
    target.open = true;
    let ancestor = target.parentElement;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
    target.querySelector('summary')?.focus();
  };
  const evidenceDialog = document.querySelector('[data-evidence-dialog]');
  let evidenceOrigin = null;
  let evidenceScroll = [0, 0];
  let priorBodyOverflow = '';
  let inspectorMode = 'evidence';
  let detailView = null;
  let inspectedLink = null;
  let revisionVisited = false;
  let revisionScroll = 0;
  let changingInspectorMode = false;
  const panelBody = () => evidenceDialog?.querySelector('[data-evidence-panel-body]');
  const dockInspector = () => {
    if(!window.matchMedia?.('(min-width: 1440px)').matches || typeof evidenceDialog?.show !== 'function') return false;
    if(typeof window.getComputedStyle !== 'function') return true;
    const style = window.getComputedStyle(document.documentElement);
    const rootSize = parseFloat(style.fontSize) || 16;
    const sidebar = parseFloat(style.getPropertyValue('--atl-sidebar')) || 208;
    const inspector = parseFloat(style.getPropertyValue('--atl-inspector')) || 420;
    // Worksheets already split their reading area; keep their inspector modal.
    if(document.querySelector('.planning-work')) return false;
    const main = document.querySelector('main');
    const box = main?.getBoundingClientRect?.();
    const mainStyle = main ? window.getComputedStyle(main) : null;
    const currentReadingWidth = box ? box.width - (parseFloat(mainStyle.paddingLeft) || 0) - (parseFloat(mainStyle.paddingRight) || 0) : Infinity;
    return Math.min(currentReadingWidth, window.innerWidth - sidebar - inspector - 90) >= Math.max(640, 40 * rootSize);
  };
  const presentInspector = (origin) => {
    if (!evidenceDialog) return;
    if (evidenceDialog.open) {
      // A new page entry owns Close; internal Detail/Evidence/Revision navigation keeps that receipt.
      if(origin && !origin.closest?.('dialog')) {
        evidenceOrigin = origin;
        evidenceScroll = [window.scrollX || 0, window.scrollY || 0];
      }
      return;
    }
    evidenceOrigin = origin || document.activeElement;
    evidenceScroll = [window.scrollX || 0, window.scrollY || 0];
    priorBodyOverflow = document.body?.style?.overflow || '';
    if (dockInspector()) { evidenceDialog.show(); evidenceDialog.setAttribute('data-docked', 'true'); }
    else { evidenceDialog.showModal(); evidenceDialog.removeAttribute?.('data-docked'); if(document.body?.style) document.body.style.overflow = 'hidden'; }
  };
  const inspectorRoutes = () => {
    const back = evidenceDialog?.querySelector('[data-inspector-back]');
    if(back) { back.hidden = inspectorMode !== 'evidence' || !detailView; back.textContent = 'Back to details'; }
    const close = evidenceDialog?.querySelector('[data-evidence-close]');
    if(close) close.textContent = inspectorMode === 'detail' ? 'Close details' : inspectorMode === 'revision' ? 'Close revision' : 'Close evidence';
    const revision = evidenceDialog?.querySelector('[data-return-revision]');
    if(revision) revision.hidden = inspectorMode === 'revision' || !revisionVisited;
  };
  const retainInspectorView = () => {
    if(inspectorMode === 'detail' && detailView) { detailView.scroll = panelBody()?.scrollTop || 0; detailView.dialogScroll = evidenceDialog.scrollTop; detailView.focus = document.activeElement; }
    if(inspectorMode === 'revision') revisionScroll = evidenceDialog.querySelector('[data-revision-panel]')?.scrollTop || 0;
  };
  const selectInspectedLink = link => {
    inspectedLink?.removeAttribute?.('data-inspected'); inspectedLink = link; link?.setAttribute?.('data-inspected','true');
  };
  const showDetailView = (restore = false) => {
    if(!detailView) return;
    inspectorMode = 'detail';
    const panel = panelBody(); panel.hidden = false; panel.replaceChildren(detailView.node);
    const revision = evidenceDialog.querySelector('[data-revision-panel]'); if(revision) revision.hidden = true;
    evidenceDialog.querySelector('[data-evidence-support]').hidden = true;
    evidenceDialog.querySelector('#evidence-panel-title').textContent = detailView.title;
    panel.scrollTop = restore ? detailView.scroll : 0;
    evidenceDialog.scrollTop = restore ? detailView.dialogScroll : 0;
    inspectorRoutes();
    if(restore) detailView.focus?.focus?.({preventScroll:true});
    else evidenceDialog.querySelector('[data-evidence-close]')?.focus?.({preventScroll:true});
  };
  evidenceDialog?.querySelector('[data-evidence-close]')?.addEventListener('click', () => evidenceDialog.close());
  evidenceDialog?.querySelector('[data-inspector-back]')?.addEventListener('click', () => showDetailView(true));
  evidenceDialog?.querySelector('[data-return-revision]')?.addEventListener('click', () => openRevisionSheet('Brief', true));
  evidenceDialog?.addEventListener('keydown', event => {
    if(event.key === 'Escape' && evidenceDialog.getAttribute('data-docked') === 'true') {event.preventDefault(); evidenceDialog.close();}
    if(event.key !== 'Tab' || evidenceDialog.getAttribute('data-docked') === 'true' || event.ctrlKey || event.altKey || event.metaKey) return;
    const focusable = Array.from(evidenceDialog.querySelectorAll('a[href],button,input,textarea,select,summary,[tabindex]')).filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length > 0);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if(!first) { event.preventDefault(); evidenceDialog.focus(); return; }
    if(event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {event.preventDefault(); last.focus();}
    else if(!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {event.preventDefault(); first.focus();}
  });
  evidenceDialog?.addEventListener('close', () => {
    if(changingInspectorMode || evidenceDialog.open) return;
    retainInspectorView();
    if (document.body?.style) document.body.style.overflow = priorBodyOverflow;
    selectInspectedLink(null);
    const returnTarget = evidenceOrigin?.isConnected === false ? (document.getElementById?.(evidenceOrigin.id) || document.querySelector('main')) : evidenceOrigin;
    returnTarget?.focus?.({ preventScroll: true });
    window.scrollTo?.(...evidenceScroll);
    evidenceOrigin = null; detailView = null;
  });
  window.addEventListener?.('resize', () => {
    if(!evidenceDialog?.open || dockInspector() === (evidenceDialog.getAttribute('data-docked') === 'true')) return;
    const focus = document.activeElement;
    changingInspectorMode = true; evidenceDialog.close();
    if(dockInspector()) { evidenceDialog.show(); evidenceDialog.setAttribute('data-docked','true'); if(document.body?.style) document.body.style.overflow = priorBodyOverflow; }
    else { evidenceDialog.showModal(); evidenceDialog.removeAttribute('data-docked'); if(document.body?.style) document.body.style.overflow = 'hidden'; }
    // Queued native close events see the reopened dialog; synchronous test hosts see the flag.
    changingInspectorMode = false;
    focus?.focus?.({preventScroll:true});
  });
  document.addEventListener?.('click', (event) => {
    const detail = event.target?.closest?.('a[data-detail-link]');
    if(detail?.getAttribute('data-detail-target') && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const target = document.getElementById(detail.getAttribute('data-detail-target'));
      const content = target?.querySelector('[data-detail-content]');
      if(content && typeof evidenceDialog?.showModal === 'function') {
        event.preventDefault(); retainInspectorView(); presentInspector(detail); selectInspectedLink(detail);
        detailView = {node:content.cloneNode(true), title:target.getAttribute('data-detail-title'), scroll:0, dialogScroll:0, focus:null};
        showDetailView(); return;
      }
    }
    const link = event.target?.closest?.('a[data-evidence-link], a[data-research-link]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    const content = target.querySelector('[data-evidence-content]') || target.querySelector('.research-inspection-body');
    if (content && typeof evidenceDialog?.showModal === 'function') {
      retainInspectorView();
      // A citation from the document opens directly; only a detail citation owns a Back route.
      if(inspectorMode !== 'detail' || !link.closest?.('[data-detail-content]')) detailView = null;
      presentInspector(link);
      if(!detailView) selectInspectedLink(link);
      const panel = panelBody();
      const revision = evidenceDialog.querySelector('[data-revision-panel]'); if(revision) revision.hidden = true;
      panel.hidden = false; evidenceDialog.querySelector('[data-evidence-support]').hidden = false;
      panel.replaceChildren(content.cloneNode(true));
      evidenceDialog.querySelector('#evidence-panel-title').textContent = 'Evidence';
      const sourceTitle = document.createElement('p'); sourceTitle.className = 'evidence-source-title';
      sourceTitle.textContent = (target.getAttribute?.('data-source-title') || target.querySelector('summary')?.textContent || 'Retained source').replace(/^Evidence [0-9]+ · /, '');
      panel.prepend?.(sourceTitle);
      evidenceDialog.querySelector('[data-evidence-support]').textContent = link.getAttribute('data-support') || 'Related evidence context';
      inspectorMode = 'evidence'; inspectorRoutes();
      panel.scrollTop = 0; evidenceDialog.scrollTop = 0;
      (detailView ? evidenceDialog.querySelector('[data-inspector-back]') : evidenceDialog.querySelector('[data-evidence-close]'))?.focus?.({preventScroll:true});
      event.preventDefault();
      return;
    }
    const store = target.closest?.('.evidence-store');
    if (store) store.hidden = false;
    target.open = true;
    let ancestor = target.parentElement;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
    const back = target.querySelector('[data-evidence-return]');
    if (back) { back.setAttribute('href', '#' + link.id); back.textContent = 'Return to ' + link.getAttribute('data-context'); back.hidden = false; }
    target.querySelector('summary')?.focus();
  });
  if (typeof window !== 'undefined') window.addEventListener('hashchange', revealEvidence);
  revealEvidence();
${ACCOUNT_READING_CLIENT_SCRIPT}
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
    const generationUnavailable = form.getAttribute('data-generation-available') === 'false';
    const status = document.querySelector('[data-status]');
    const recovery = document.querySelector('[data-form-recovery]');
    const recordedReset = document.querySelector('[data-use-recorded-request]');
    const unavailable = () => { formCache = null; if (recovery) recovery.textContent = 'Unsubmitted edits cannot be kept through reload in this browser. Keep this page open or copy them before reloading.'; };
    const available = () => { if (recovery) recovery.textContent = 'Meeting setup recovery is available in this tab.'; };
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
    const ready = (message) => { if (button) button.disabled = generationUnavailable; if (status) status.textContent = message + (generationUnavailable ? ' Generation remains unavailable.' : ''); };
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
      if (generationUnavailable) return;
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
        } else if (token === requestToken) { ready('The brief was not prepared. Inputs kept.'); if(payload.error) showFailure(status, new Error(payload.error), 'The brief was not prepared. Inputs kept.'); }
      } catch (error) {
        if (token === requestToken && error?.name !== 'AbortError') { ready('The brief could not be prepared. Your inputs are kept.'); showFailure(status, error, 'The brief could not be prepared. Your inputs are kept.'); }
      } finally {
        if (token === requestToken) { controller = null; if (button) button.disabled = generationUnavailable; }
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
    if(event.defaultPrevented) return;
    const entry = event.target?.closest?.('[data-refine-section]');
    if (entry?.getAttribute('data-refine-section') && reviewStatus) {
      openRevisionSheet(entry.getAttribute('data-refine-section'), false, entry); return;
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
    event.preventDefault(); if (reviewBusy) return; reviewBusy = true; controls(); const data = new FormData(event.currentTarget); const status = document.querySelector('[data-review-status]');
    const token = ++reviewToken; const recordId = event.currentTarget.getAttribute('data-record-id') || '';
    const submittedNote = String(data.get('note') || '');
    try {
      const payload = await requestJson('/api/note', { note: submittedNote, recordId, priorNote: savedNote });
      if (token === reviewToken) {
        if (payload.savedNote !== submittedNote || typeof payload.noChange !== 'boolean') throw new Error('Note save was not confirmed');
        if (savedNote !== payload.savedNote) markWorkDirty();
        savedNote = payload.savedNote;
        reviewNavigationApproved = false;
        if (status) status.textContent = (payload.status || 'Note kept for this session. It is not approval or durable storage.') +
          (noteIsDirty() ? ' Newer edits in the textarea are still unsaved.' : '');
      }
    }
    catch (error) { if (token === reviewToken && status) status.textContent = error instanceof Error ? error.message : 'Could not keep correction note'; }
    finally { reviewBusy = false; controls(); }
  });
${WORKING_DOCUMENT_CLIENT_SCRIPT}
${PLANNING_CLIENT_SCRIPT}
  controls();
})();`;

/** Exact inert browser program, exported only for deterministic handler regression execution. */
export const C3_CLIENT_SCRIPT = SCRIPT;

export const C3_SCRIPT_SHA256 = createHash("sha256").update(SCRIPT, "utf8").digest("base64");

const CSS = WORKSPACE_CSS;

function shell(title: string, body: string, csrf: string, context: FrozenC3AccountContext, recorded: boolean,
  page: C3PageState["page"], hasDraft: boolean, synthetic = false, work?: WorkDisplayState): string {
  const destination: WorkspaceDestination = page === "home" ? "overview" : page === "research" ? "research" : "workshop";
  const icons = { overview: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>', research: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', workshop: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/>' };
  const navigation = `<nav class="workspace-nav" aria-label="Account journey">${([['overview', 'Overview', '/'], ['research', 'Research', researchUrl('initiatives')], ['workshop', 'Workshop', '/?view=workshop']] as const).map(([id, label, route]) => `<a id="journey-${id}" href="${esc(route)}"${destination === id ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg><span>${label}</span></a>`).join('')}</nav>`;
  const fallbackInspector = body.includes('data-evidence-dialog') ? '' : '<dialog data-evidence-dialog aria-labelledby="evidence-panel-title"><div class="evidence-panel-head"><h2 id="evidence-panel-title">Evidence</h2><button class="secondary" type="button" data-evidence-close autofocus>Close evidence</button></div><p data-evidence-support class="support"></p><div data-evidence-panel-body></div></dialog>';
  const withInspector = (body + fallbackInspector).replace('<div class="evidence-panel-head">',
    `<p class="inspector-account" data-inspector-account>${esc(context.context.account.accountName)}</p><div class="inspector-routes"><button type="button" class="text-control" data-inspector-back hidden>Back to item</button><button type="button" class="text-control" data-return-revision hidden>Return to revision</button></div><div class="evidence-panel-head">`);
  const storage = work?.available ? 'Private local storage available · use Save to retain a brief across restart.' : 'Session only · server restart loses unsaved work.';
  const boundary = `<details class="recorded-mode"><summary>Content and storage details</summary><p>${synthetic ? 'Hand-authored fixtures · No AI recordings. Exact replay has no live fallback.' : recorded ? 'Recorded responses · No live generation. Exact request matching has no live fallback.' : isCuratedContext(context) ? 'Agent-curated proposed/template context. No human approval, owner disposition, policy admission or model recording. Owner and date unassigned.' : 'Proposed and unreviewed local content.'} Private document storage never changes account truth or approves content. ${esc(storage)}</p></details>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="c3-csrf" content="${esc(csrf)}"><meta name="c3-account" content="${esc(context.context.account.accountId)}"><meta name="c3-document" content="${esc(work?.documentId ?? '')}">${recorded ? '<meta name="c3-recorded-replay" content="true">' : ""}<title>${esc(title)} · Atliera</title><style>${CSS}</style></head><body><a class="skip-link" href="#main">Skip to content</a><aside class="workspace-sidebar"><a class="brand" href="/">atliera</a><p class="sidebar-context">Account workspace</p>${navigation}</aside><div class="workspace-frame"><header class="workspace-header"><span class="account-identity">${esc(context.context.account.accountName)}</span>${destination === 'overview' ? '<a class="button" href="/?prepare=1">Prepare brief</a>' : destination === 'research' ? '<a class="quiet-link" href="/">Back to overview</a>' : page !== 'workshop' ? '<a class="quiet-link header-back" href="/?view=workshop" aria-label="Back to Workshop"><span aria-hidden="true">←</span><span class="header-back-label">Back to Workshop</span></a>' : ''}</header>${page === "prepare" || page === "workshop" ? `<p class="storage-notice">${esc(storage)}</p>` : ""}${withInspector}${accountDetailLibrary(context)}${boundary}</div><script>${SCRIPT}</script></body></html>`;
}

function home(frozen: FrozenC3AccountContext, hasDraft: boolean, recorded: boolean, revisionPending: boolean, topic?: ResearchTopic, selectedReading?: string): string {
  const context = frozen.context;
  const { account, proposal, admittedSources: sources } = context;
  const projection = projectAccount(frozen);
  const publicResearch = projectAccountResearch(account.accountId);
  const evidence = sources.flatMap(source => source.excerpts.map(excerpt => ({ source, excerpt })));
  const byEvidence = new Map(evidence.map(item => [item.excerpt.evidenceId, item] as const));
  const numbers = new Map(evidence.map((item, index) => [item.excerpt.evidenceId, index + 1] as const));
  const refs = (ids: readonly string[], label: string) => evidenceLinks(ids.filter(id => numbers.has(id)), numbers, byEvidence, label);
  const notes = (topic: AccountTopic) => projection.readings.filter(item => item.topic === topic);
  const state = (note: AccountReading) => note.kind === "hypothesis" ? "Hypothesis · unvalidated" : note.kind === "interpretation" ? "Interpretation · unreviewed" : "Source summary · unreviewed";
  const noteBody = (note: AccountReading) => `<p>${esc(note.text)}</p>${note.limit ? `<p class="reading-limit">${esc(note.limit)}</p>` : ""}<p class="support"><span>${state(note)}</span>${refs(note.evidenceIds, note.title)}</p>`;
  const row = (note: AccountReading) => `<article id="reading-${esc(note.id)}" class="account-reading" tabindex="-1"${selectedReading === note.id ? ' data-selected="true"' : ''}>${selectedReading === note.id ? '<p class="selection-label">Selected item</p>' : ''}<h3>${esc(note.title)}</h3>${note.period ? `<p class="discovery-period">${esc(note.period)}</p>` : ""}${noteBody(note)}${detailLink(note)}${note.question ? `<p class="context-note"><strong>Still to confirm</strong><br>${esc(note.question)}</p>` : ''}</article>`;
  const rows = (group: AccountTopic) => notes(group).map(row).join('');
  const sourceDates = (source: EvidenceDisplay["source"]) => `<p class="meta">${esc(source.publisher)} · ${esc(source.publicationDate ? humanDate(source.publicationDate) : "Undated")} · Event ${esc(humanDate(source.eventDate))} · Current through ${esc(humanDate(source.evidenceCurrentThrough))}</p><details><summary>Source details</summary><p class="meta">Source: ${esc(source.sourceId)} · Acquired ${esc(source.retrievedAt)}. Acquisition is not publication or currentness.</p></details>`;
  const retained = (source: EvidenceDisplay["source"]) => `<details><summary>Full retained source context</summary><p class="meta">Complete supplied bounded clean text; not original web or PDF completeness. Retained inspection only; no live lookup.</p><pre class="source-text" tabindex="0">${esc(source.fullBoundedCleanText)}</pre></details>`;
  const sourceContext = (source: EvidenceDisplay["source"]) => `${source.untrustedInstructionsDetected ? '<p class="warning">Untrusted instructions detected. Inspection only; excluded from Account reading notes and draft evidence.</p>' : ""}<p class="meta"><strong>Source scope:</strong> ${esc(source.entity.name)}. ${esc(source.entity.relationshipToAccount)}</p>${sourceDates(source)}${context.rendererAnnotations.filter(item => item.sourceId === source.sourceId).map(item => `<p class="meta">${esc(item.text)}</p>`).join("")}<p class="meta"><a href="${esc(source.canonicalUrl)}" target="_blank" rel="noreferrer">Open original source (new tab)</a></p>`;
  const excerptStatus = (id: string) => {
    const selected = [proposal.accountThesis, ...proposal.establishedContext, ...proposal.meaningfullyChanged, ...proposal.whyChangeMayMatter, ...proposal.stillOpenQuestions, proposal.recommendedNextMove].some(item => item.evidenceIds.includes(id));
    return isCuratedContext(frozen) ? "Agent-curated excerpt · unreviewed; no policy admission or human approval." : selected ? "Retained C2 excerpt used in the existing proposal. This Account summary is unreviewed; it creates no new approval." : "Retained source context outside the selected proposal · unreviewed. Inspection does not promote it into approved account material.";
  };
  const research = `<section id="account-research" class="account-section account-research" tabindex="-1" aria-labelledby="heading-research"><div class="section-heading"><div><p class="eyebrow">Evidence & research</p><h2 id="heading-research">The retained source library</h2></div><a class="quiet-link" href="/?view=research&amp;topic=initiatives">Back to initiatives</a></div><p class="section-intro">${sources.length} supplied sources. Exact excerpts, scope and dates remain available here. These historical context sources are unchanged. Research inspection makes no live lookup.</p>${renderAccountResearch(publicResearch, undefined, true)}<h3>Historical context sources</h3>${sources.length === 0 ? '<p>No retained sources are available. The account has no source-backed orientation to inspect.</p>' : sources.map((source, sourceIndex) => `<article class="research-source" data-source-id="${esc(source.sourceId)}"><h3>${esc(source.title)}</h3><p class="source-scope">${esc(source.entity.name)} · ${source.excerpts.length} excerpts</p><p class="support"><span>Exact retained excerpts</span>${refs(source.excerpts.map(excerpt => excerpt.evidenceId), `Research · ${source.title}`)}</p><details><summary>Source dates, scope &amp; retained text</summary>${sourceContext(source)}${source.excerpts.map(excerpt => {
    const number = numbers.get(excerpt.evidenceId)!;
    return `<details id="evidence-${number}" class="research-excerpt"><summary>Evidence ${number} · ${esc(source.title)}</summary><a data-evidence-return hidden href="#account-topics">Return to account topics</a><div data-evidence-content data-source-id="${esc(source.sourceId)}" data-evidence-id="${esc(excerpt.evidenceId)}"><p class="meta">${esc(excerptStatus(excerpt.evidenceId))}</p>${admittedSourceSectionContext({ source, excerpt })}<blockquote>${esc(excerpt.exactExcerpt)}</blockquote>${sourceContext(source)}${retained(source)}</div></details>`;
  }).join("")}${source.excerpts.length === 0 ? retained(source) : ""}<p class="meta">Source reference: ${esc(source.sourceId)}</p></details></article>`).join("")}${projection.passages.map((passage, index) => `<details id="evidence-${evidence.length + index + 1}" class="research-source"><summary>Source context · ${esc(passage.title)}</summary><a data-evidence-return hidden href="#account-people">Return to people & operating context</a><div data-evidence-content data-source-id="${esc(passage.source.sourceId)}"><p class="meta">Exact source context · unreviewed. This passage has no selected evidence ID and is not added to the proposal or model context.</p><blockquote>${esc(passage.exactText)}</blockquote><p class="reading-limit">${esc(passage.limit)}</p>${sourceContext(passage.source)}${retained(passage.source)}</div></details>`).join("")}</section>`;
  const overview = notes("overview")[0];
  const questions = projection.readings.filter(item => item.question);
  const related = context.entities.filter(item => item.entityId !== account.accountId);
  const priorProposal = `<details class="account-details" id="original-account-proposal"><summary>Original proposal & preparation context</summary><p class="proposed-cue">Proposed account orientation · not reviewed</p><p class="lede">${esc(proposal.accountThesis.text)}</p><p class="support"><span>${proposal.accountThesis.state === "source-backed fact" ? "Direct source support" : "Related evidence context for this proposed thesis"}</span>${refs(proposal.accountThesis.evidenceIds, "Original account thesis")}</p><h3>Proposed next action</h3><p>${esc(proposal.recommendedNextMove.text)}</p><p class="support">${refs(proposal.recommendedNextMove.evidenceIds, "Original next move")}</p>${accountIntelSections(frozen, false, false)}</details>`;
  // Brief source summaries are authored against the same verified reading identities; no mechanical truncation.
  const summaries: Readonly<Record<string, string>> = {
    "strategic-reinvestment": "A three-year plan spans engineering, AI, behavioral health, civic education, biotechnology and nursing.",
    "responsible-ai-workforce": "Interdisciplinary training ambitions sit alongside a reported hiring cycle and a competitive AI talent market.",
    "redtail-access": "A described statewide resource combines advanced computing, training and support.",
    "health-ai-vault": "A planned system connects health research, population data and CHPC, with separate system and infrastructure funding.",
    "mizzouforward": "A described 10-year effort combines faculty recruitment, research infrastructure and student success.",
  };
  const readingTopic = (note: AccountReading): ResearchTopic => note.topic === 'people' || note.topic === 'technology' ? note.topic : 'initiatives';
  const tile = (note: AccountReading) => `<a data-detail-link aria-haspopup="dialog" data-detail-target="detail-${esc(note.id)}" class="priority-tile" href="${esc(researchUrl(readingTopic(note), note.id))}"><span class="item-icon">${uiIcon("priority")}</span><div class="priority-copy"><h3>${esc(note.title)}</h3><p>${esc(note.text)}</p>${note.limit ? `<p class="reading-limit">${esc(note.limit)}</p>` : ''}</div><span class="view-details">View details</span></a>`;
  const summarySection = (group: 'people' | 'technology', title: string, empty: string) => `<section id="account-${group}" class="summary-section"><h2>${title}</h2>${notes(group).slice(0, 2).map(note => `<a data-detail-link aria-haspopup="dialog" data-detail-target="detail-${esc(note.id)}" class="summary-row" href="${esc(researchUrl(group, note.id))}"><span class="item-icon">${uiIcon(group)}</span><div><h3>${esc(note.title)}</h3><p>${esc(compactReading(note).text)}</p><span class="view-details">View details</span></div></a>`).join('') || `<p>${empty}</p>`}<a class="quiet-link" href="${esc(researchUrl(group))}">Explore ${group === 'people' ? 'people &amp; operating context' : 'technology &amp; services'} →</a></section>`;
  const inspector = `<dialog data-evidence-dialog aria-labelledby="evidence-panel-title"><div class="evidence-panel-head"><h2 id="evidence-panel-title">Evidence</h2><button class="secondary" type="button" data-evidence-close autofocus>Close evidence</button></div><p data-evidence-support class="support"></p><div data-evidence-panel-body></div></dialog>`;
  // The inspector can read exact local evidence without appending the source library to other views.
  const evidenceStore = (ids: readonly string[]) => `<div class="evidence-store" hidden>${evidence.filter(item => ids.includes(item.excerpt.evidenceId)).map(item => `<details id="evidence-${numbers.get(item.excerpt.evidenceId)}"><summary>${esc(item.source.title)}</summary><div data-evidence-content data-source-id="${esc(item.source.sourceId)}" data-evidence-id="${esc(item.excerpt.evidenceId)}"><p class="meta">${esc(excerptStatus(item.excerpt.evidenceId))}</p>${admittedSourceSectionContext(item)}<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote>${sourceContext(item.source)}${topic ? retained(item.source) : `<a class="quiet-link" href="${esc(researchUrl('sources'))}">Full retained source context →</a>`}</div></details>`).join('')}${(topic ? projection.passages : []).map((passage, index) => `<details id="evidence-${evidence.length + index + 1}"><summary>${esc(passage.title)}</summary><div data-evidence-content><p class="meta">Exact source context · unreviewed; outside the selected proposal. No selected evidence ID.</p><blockquote>${esc(passage.exactText)}</blockquote><p>${esc(passage.limit)}</p>${sourceContext(passage.source)}</div></details>`).join('')}</div>`;
  const contradictions = context.declaredContradictions.map(text => `<p class="warning"><strong>Conflicting context.</strong> ${esc(text)}</p>`).join('');
  const unknowns = `<section id="account-unknowns" class="account-section"><h2>Worth understanding</h2>${questions.length ? `<ul class="account-questions">${questions.map(item => `<li>${esc(item.question!)} <a class="quiet-link" href="${esc(researchUrl(readingTopic(item), item.id))}">View ${esc(item.title)} context →</a></li>`).join('')}</ul>` : '<p>Specific priorities, operating roles and service questions need source context first.</p>'}${accountGaps(frozen)}</section>`;
  if (topic) {
    const matching = projection.readings.filter(note => topic === 'initiatives' ? !['people', 'technology'].includes(note.topic) : note.topic === topic);
    const selected = matching.find(note => note.id === selectedReading);
    const selectionNotice = selectedReading && !selected ? '<p class="context-note" role="status">That reading is not available in this topic’s retained account evidence. Explore the available research below.</p>' : '';
    const topics = `<div class="research-topic-picker"><label for="research-topic">Research topic</label><select id="research-topic" data-research-topic>${(['initiatives', 'people', 'technology', 'sources'] as const).map(id => `<option value="${esc(researchUrl(id))}"${topic === id ? ' selected' : ''}>${id[0]!.toUpperCase() + id.slice(1)}</option>`).join('')}</select></div><nav id="account-topics" class="research-topics" aria-label="Research topics">${(['initiatives', 'people', 'technology', 'sources'] as const).map(id => `<a href="${esc(researchUrl(id))}"${topic === id ? ' aria-current="page"' : ''}>${id[0]!.toUpperCase() + id.slice(1)}</a>`).join('')}</nav>`;
    const people = `<section id="account-people"><h2>People &amp; operating context</h2><p class="section-intro">Functions and relationships from retained material. Named people are not buying owners.</p>${rows('people')}${projection.passages.map((passage, index) => `<article class="account-reading"><h3>${esc(passage.title)}</h3><p>${esc(passage.limit)}</p><p class="support"><a id="cite-account-passage-${index + 1}" data-evidence-link data-context="${esc(passage.title)}" href="#evidence-${evidence.length + index + 1}">Inspect source passage</a></p></article>`).join('')}${related.length ? `<details><summary>Organization boundaries</summary><ul>${related.map(item => `<li><strong>${esc(item.name)}</strong><p>${esc(context.relationships.find(relation => relation.entityId === item.entityId)?.relationshipToAccount ?? item.relationshipToAccount)}</p></li>`).join('')}</ul></details>` : '<p>No additional stakeholder relationships are established.</p>'}</section>`;
    const groups = topic === 'people' ? people : topic === 'technology' ? `<section id="account-technology"><h2>Technology &amp; services</h2><p class="section-intro">Platforms, services and investment areas; not a complete installed technology inventory.</p>${rows('technology') || '<p>No matched technology reading is established in retained historical evidence.</p>'}</section>` : `<section id="account-priorities"><h2>Priorities &amp; initiatives</h2>${rows('priorities') || '<p>No matched priorities are established. Inspect the supplied context without inferring new initiatives.</p>'}</section><section id="account-discoveries"><h2>Discoveries &amp; timing</h2><p><strong>No earlier account review to compare.</strong> Dated discoveries do not establish changes since a prior review.</p>${rows('discoveries')}</section><section id="account-hypotheses"><h2>Opportunity hypotheses</h2><p>Possible areas to investigate, not qualified opportunities.</p>${rows('hypotheses')}</section>${unknowns}${priorProposal}`;
    const separate = topic === 'people' || topic === 'technology' ? renderAccountResearch(publicResearch, topic, true) : '';
    return `<main id="main" class="research-workspace" tabindex="-1"><h1>Research</h1><p class="lede">Explore the retained account knowledge and inspect its support.</p>${topics}${selectionNotice}${contradictions}${topic === 'sources' ? research + priorProposal : (selected?.topic === 'overview' ? row(selected) : '') + groups + separate}<details class="technical-detail"><summary>Context and timing details</summary><p class="boundary">${isCuratedContext(frozen) ? 'This orientation uses agent-curated public excerpts, not admitted C2 evidence.' : 'This orientation reuses admitted C2 evidence.'} It does not claim that the legacy “meaningfully changed” bucket proves temporal change, ${isCuratedContext(frozen) ? 'and no C2 owner disposition or generated C3 content exists' : 'and the C2 disposition does not approve generated C3 content'}.</p></details>${topic === 'sources' ? '' : evidenceStore(evidence.map(item => item.excerpt.evidenceId))}${inspector}</main>`;
  }
  return `<main id="main" class="account-workspace" tabindex="-1"><section id="account-overview" class="account-readout"><p class="account-subtitle">${esc(account.admittedContext.sector ?? 'Sector not established')} · ${esc(account.admittedContext.geography ?? 'Geography not established')}</p><h1>${esc(overview ? compactReading(overview).title : 'Explore the retained account context.')}</h1>${overview ? `<p class="lede">${esc(compactReading(overview).text)}</p>${detailLink(overview)}` : `<p>There is not enough matched evidence for a substantive Account reading. No priorities, people or technology are inferred from the account name.</p><a class="quiet-link" href="${esc(researchUrl('initiatives'))}#original-account-proposal">Inspect original proposal →</a>`}<a class="source-chip research-basis" href="${esc(researchUrl('sources'))}">${uiIcon("source")}<span>Public research · details</span></a></section>${contradictions}${revisionPending ? '<p class="context-note">Revision pending. <a href="/?draft=1">Reopen the preserved session draft</a>.</p>' : ''}${notes('priorities').length ? `<section id="account-priorities" class="account-section"><div class="section-heading"><h2>Priorities &amp; initiatives</h2><a class="quiet-link" href="${esc(researchUrl('initiatives'))}">View all →</a></div><div class="priority-grid">${preparationAnchors(projection.readings).map(note => tile(compactReading(note))).join('')}</div></section>` : ''}<div class="account-columns">${summarySection('people', 'People &amp; operating context', 'Explore publicly reported roles and their limits in Research.')}${summarySection('technology', 'Technology landscape', 'Explore the available service research and its scope.')}</div><section class="context-note account-confirmation"><span class="item-icon">${uiIcon("question")}</span><div><h2>Worth confirming</h2><p>${esc(questions[0]?.question ?? 'Which priorities are active, and what evidence establishes their current status?')}</p></div><a class="quiet-link" href="${esc(researchUrl('initiatives'))}#account-unknowns">Explore open questions →</a></section>${hasDraft ? '<p><a id="account-reopen" href="/?draft=1">Reopen session draft</a></p>' : ''}${evidenceStore(overview?.evidenceIds ?? [])}${inspector}</main>`;

}

function workshop(state: Extract<C3PageState, { page: "workshop" }>): string {
  const edited = (state.worksheets ?? []).filter(brief => brief.version > 0);
  const work = state.work;
  const currentSaved = state.hasDraft && work?.savedWorks.some(item => item.documentId === work.documentId && item.version === work.version);
  const continueWork = state.hasDraft && (!currentSaved || !work?.saved);
  const rows = (work?.savedWorks ?? []).map(item => {
    const current = Boolean(state.hasDraft && item.documentId === work?.documentId);
    const currentVersion = current && item.version === work?.version;
    const title = displayWorkTitle(item.title, item.intendedOutcome || `Brief for ${item.audience}`);
    const opener = currentVersion && work?.saved ? `<a class="saved-title" href="/?draft=1">${esc(title)}</a>` : `<button type="button" class="saved-title" data-reopen-work="${esc(item.documentId)}" data-replaces-unsaved="${Boolean(state.hasDraft && !work?.saved)}" data-work-version="${work?.workVersion ?? 0}">${esc(title)}</button>`;
    return `<article class="workshop-item"${current ? ' data-current-work="true"' : ''}><div><h3>${opener}</h3>${item.intendedOutcome && item.intendedOutcome !== title ? `<p class="work-preview">${esc(item.intendedOutcome)}</p>` : ''}<p class="saved-metadata">${esc(item.audience)}${item.meetingDate ? ` · Meeting ${esc(humanDate(item.meetingDate))}` : ''}</p><p class="meta">${originLabel(item.origin)} · Version ${item.version}${savedTime(item.savedAt) ? ` · Last saved ${savedTime(item.savedAt)}` : ''}${current ? ` · ${!currentVersion ? `Current session is based on saved version ${work?.version}` : work?.saved ? 'Current brief' : 'Current session has unsaved changes'}` : ''}</p></div><details class="saved-record-details"><summary>Brief details</summary><p class="meta">Record ${esc(item.documentId.slice(-8))}</p><p class="meta">Open the brief, then Document details to edit its title.</p></details></article>`;
  }).join('');
  return `<main id="main" class="workshop-workspace" tabindex="-1"><div class="section-heading"><div><h1>Workshop</h1><p class="lede">Prepare, refine and return to your work.</p></div><a class="button" href="/?prepare=1">Prepare brief</a></div>${state.generation && !state.generation.available ? `<details class="generation-availability"><summary>Generation unavailable</summary><p class="meta">${esc(state.generation.explanation)}</p></details>` : ''}<div class="workshop-groups">${continueWork ? `<section class="workshop-list current-work"><h2>Continue working</h2><article class="workshop-item"><h3>${esc(displayWorkTitle(work?.title, work?.title || 'Meeting brief'))}</h3><p>${currentSaved ? 'Unsaved changes to the saved brief below.' : work?.saved ? `Current session shows saved version ${work.version}.` : 'Current session brief · unsaved changes.'}${state.revisionPending ? ' Revision pending.' : ''}</p><a class="quiet-link" href="/?draft=1">Reopen session draft →</a></article></section>` : ''}${work?.available ? `<section class="workshop-list"><h2>Saved briefs</h2><p data-work-list-status role="status">${work.storageError ? 'Saved briefs could not be loaded. Current work is kept.' : ''}</p>${errorDiagnostics(work.storageError)}${rows || (work.storageError ? '' : '<p>No saved briefs for this account.</p>')}</section>` : ''}${!state.hasDraft ? '<p class="workshop-empty">No meeting brief yet. Start with the audience and outcome, or use an editable worksheet below.</p>' : ''}${edited.map(brief => `<article class="workshop-item"><h3>${brief.kind === 'strategy' ? 'Strategy' : 'Next steps'} worksheet</h3><p>${esc(brief.audience || 'Audience not set')} · Session version ${brief.version}</p><a class="quiet-link" href="/?kind=${brief.kind}">Open worksheet →</a></article>`).join('')}</div><section class="account-section"><h2>Planning worksheets</h2><p class="meta">Editable templates · not AI-generated.</p><nav class="journey-nav" aria-label="Planning worksheets"><a href="/?kind=strategy">Strategy worksheet →</a><a href="/?kind=next-steps">Next-steps worksheet →</a></nav></section></main>`;
}

function sameMeetingRequest(left: C3MeetingFormState, right: C3MeetingFormState): boolean {
  return left.audience === right.audience && left.intendedOutcome === right.intendedOutcome &&
    left.durationMinutes === right.durationMinutes && left.meetingDate === right.meetingDate;
}

function prepare(context: FrozenC3AccountContext, request: C3MeetingFormState, error: string | undefined, hasDraft: boolean,
  recorded: boolean, recordedRequest?: C3MeetingFormState, correctionNote?: string, revisionPending = false, displayedRecordId: string | null = null, pendingRevisionToken: string | null = null, generation?: C3PageState["generation"], syntheticPreview = false): string {
  if (isCuratedContext(context)) return `<main id="main" tabindex="-1"><h1>Plan with the supplied context</h1><p>Agent-curated proposed context · no model-generated meeting draft or recording is available.</p><p>Owner and meeting date are unassigned. Use an editable planning template instead.</p><a class="button" href="/?kind=strategy">Open strategy template</a><a class="button secondary" href="/?kind=next-steps">Open next-steps template</a>${briefContext(context)}${accountIntelSections(context)}</main>`;
  const canGenerate = generation ? generation.available : recorded;
  const unavailableMessage = generation?.explanation ?? "Generation unavailable. No available model provider has been established for this preview.";
  const status = error ?? (!canGenerate ? unavailableMessage : recorded ? (syntheticPreview ? "Only the exact authored example request is available. Edited inputs are refused; no live provider will be called." : "Only the exact recorded request will replay. Edited inputs are refused; no live provider will be called.") : generation?.explanation ?? "Generation route configured. Preparing creates a proposed session draft.");
  const pending = revisionPending && correctionNote !== undefined && correctionNote.length > 0 ? `<p class="warning"><strong>Revision pending — previous draft preserved.</strong> Cancel stops generation; reopen the draft to deliberately discard the revision.</p><details class="recorded-note"><summary>Correction included in this revision</summary><p>This exact correction note remains session-only. It is not approval or account truth. Cancel stops generation but does not discard the pending revision.</p><pre>${esc(correctionNote)}</pre></details>` : "";
  const reset = recordedRequest === undefined ? "" : `<button class="secondary" type="button" data-use-recorded-request data-audience="${esc(recordedRequest.audience)}" data-outcome="${esc(recordedRequest.intendedOutcome)}" data-duration="${String(recordedRequest.durationMinutes)}" data-meeting-date="${esc(recordedRequest.meetingDate)}"${sameMeetingRequest(request, recordedRequest) ? " hidden" : ""}>Use ${syntheticPreview ? 'example' : 'recorded'} request</button>`;
  return `<main id="main" tabindex="-1"><h1>Prepare a brief</h1><p class="lede">Start with the audience and the outcome.</p>${hasDraft ? '<p><a class="button secondary" href="/?draft=1">Reopen session draft</a></p>' : ""}${pending}<div class="prepare-layout"><form class="prepare" data-generate data-generation-available="${canGenerate}" data-record-id="${esc(displayedRecordId ?? "")}" data-pending-revision-token="${esc(pendingRevisionToken ?? "")}"><div class="field"><label for="audience">Who is this for?</label><input id="audience" name="audience" required maxlength="160" value="${esc(request.audience)}" placeholder="CISO"></div><div class="field"><label for="outcome">What outcome do you want?</label><textarea id="outcome" name="intendedOutcome" required maxlength="500" placeholder="Understand priorities and agree a useful next step">
${esc(request.intendedOutcome)}</textarea></div><details class="meeting-options"><summary>More options · <span data-options-summary>${esc(request.meetingDate || "Date not set")} · ${request.durationMinutes} minutes</span></summary><div class="option-grid"><div class="field"><label for="duration">Duration</label><select id="duration" name="durationMinutes">${[15,30,45,60].map((value) => `<option value="${String(value)}"${request.durationMinutes === value ? " selected" : ""}>${String(value)} minutes</option>`).join("")}</select></div><div class="field"><label for="meeting-date">Meeting date (optional)</label><input id="meeting-date" name="meetingDate" type="date" value="${esc(request.meetingDate)}"><p class="meta">If omitted, source freshness is assessed one week from preparation.</p></div></div></details><p class="status-line" data-status role="status" aria-live="polite">${esc(error ? "The brief could not be prepared. Your inputs are kept." : status)}</p>${errorDiagnostics(error)}<div class="hero-actions"><button type="submit"${canGenerate ? "" : " disabled hidden"}>${recorded ? (syntheticPreview ? "Open exact authored example" : "Replay exact recorded response") : "Prepare brief"}</button>${reset}<button class="secondary" type="button" data-cancel>Cancel</button></div>${!canGenerate ? '<p><a class="button" href="/?kind=strategy">Use an editable strategy worksheet →</a></p>' : ""}<p class="boundary form-recovery" data-form-recovery aria-live="polite">Meeting setup is kept in this tab when reload recovery is available.</p></form>${preparationContext(context)}</div><details class="technical-detail"><summary>How this draft is prepared</summary><p class="boundary">${recorded ? "Replay waiting is local request matching and validation, not live model timing. No arbitrary edit can manufacture a result." : "The model receives the complete versioned account context—not the compact Account Home projection. It may select evidence and write prose; it cannot assign approval, governance, or durable-save fields."}</p></details></main>`;
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
    return `<a class="source-chip" id="${citationId(contextName, number)}" data-evidence-link data-context="${esc(contextName)}" data-support="${statement?.supportCategory === "direct_support" && statement.text === source?.excerpt.exactExcerpt ? "Direct supporting evidence" : "Related evidence context"}" href="#evidence-${String(number)}" aria-label="${esc(`${contextName} evidence ${String(number)}: ${source?.source.title ?? "source"}${source ? ` · ${source.source.publisher}` : ""}`)}">${uiIcon("source")}<span class="source-chip-label" title="${esc(source?.source.title ?? "Source")}">${esc(source?.source.title ?? "Source")}</span><span class="source-chip-number">${String(number)}</span></a>`; }).join(" ");
}

function contextChecks(context: FrozenC3AccountContext): string {
  return accountGaps(context);
}

function draftPage(context: FrozenC3AccountContext, record: C3GenerationRecord, note: string, recordedCorrection: string | undefined,
  revisionPending: boolean, pendingRevisionToken?: string, notice?: string, sectionNotes: SectionNotes = {}, state?: C3PageState, syntheticPreview = false): string {
  const draft = record.draft!;
  const request = record.meetingRequest;
  const sourceByEvidence = new Map(context.context.admittedSources.flatMap((source) => source.excerpts.map((excerpt) => [excerpt.evidenceId, { source, excerpt }] as const)));
  const numberById = new Map(draft.selectedEvidenceRefs.map((id, index) => [id, index + 1]));
  const body = (item: C3SupportedText): string => {
    if (item.supportCategory !== "direct_support") return `<p>${esc(item.text)}</p>`;
    const exact = item.evidenceRefs.map((id) => sourceByEvidence.get(id)).find((entry) => entry?.excerpt.exactExcerpt === item.text)!;
    return `<blockquote class="direct-source">${esc(item.text)}</blockquote><p class="source-attribution">${esc(exact.source.title)} · ${esc(exact.source.publisher)}</p>`;
  };
  const support = (title: string, item: C3SupportedText) => `<div class="brief-support">${item.evidenceRefs.length ? `<p class="support">${evidenceLinks(item.evidenceRefs, numberById, sourceByEvidence, title, item)}</p>` : ''}<details class="support-details"><summary>Support details<span class="sr-only"> for ${esc(title)}</span></summary><p class="meta">${esc(supportLabel(item))}${item.evidenceRefs.length ? '. References on an inference or recommendation provide context, not direct proof.' : ' · No evidence asserted'}</p></details></div>`;
  const editing = (title: string) => `<div class="section-editing">${sectionNoteEditor(title, record.recordId, sectionNotes, false, state?.work?.available ?? false)}<button type="button" class="text-control" data-refine-section="${esc(title)}" aria-label="Revise ${esc(title)}">Revise</button></div>`;
  const supported = (title: string, item: C3SupportedText, heading = title) => `<section class="draft-section"><div data-generated-region="${esc(title)}"><h2>${esc(heading)}</h2>${body(item)}${support(title, item)}</div>${editing(title)}</section>`;
  const initialWarning = recordedCorrection !== undefined && record.revision === null ? (syntheticPreview
    ? '<p class="meta brief-qualification">Authored initial example — before the example revision. Not model output.</p>'
    : '<p class="meta brief-qualification"><strong>Recorded initial — before correction.</strong> Not recommended meeting copy.</p>') : "";
  const secondarySetup = `<details data-generated-region="objective" class="brief-objective"${draft.objective.supportCategory === "unknown" ? " open" : ""}><summary>Proposed objective</summary>${body(draft.objective)}${support("Meeting objective", draft.objective)}</details>`;
  const pending = '<p class="status-line" data-revision-differences role="status"></p>';
  const recordedHelp = recordedCorrection === undefined ? "" : syntheticPreview ? (record.revision === null
    ? `<p class="meta replay-disclosure" id="replay-instruction-help">Synthetic example · only the fixed authored instruction below has a response.</p><details class="recorded-note"><summary>Example instruction</summary><pre data-recorded-note>${esc(recordedCorrection)}</pre><button type="button" class="secondary" data-use-recorded-note>Use example instruction</button></details>`
    : '<p class="meta replay-disclosure" id="replay-instruction-help">Synthetic example · this is the authored revision. No further example response is available.</p>') : record.revision === null
    ? `<p class="meta replay-disclosure" id="replay-instruction-help">Historical replay · only the fixed recorded instruction below has a response.</p><details class="recorded-note"><summary>Recorded instruction</summary><pre data-recorded-note>${esc(recordedCorrection)}</pre><button type="button" class="secondary" data-use-recorded-note>Use recorded instruction</button></details>`
    : '<p class="meta replay-disclosure" id="replay-instruction-help">Historical replay · this is the recorded revision. No further recorded response is available.</p>';

  const learning = (text: string): string => { const marker = "Optional probe:"; const at = text.indexOf(marker);
    if (at < 0) return `<p class="learning">${esc(text)}</p>`;
    const prefix = text.slice(0, at);
    return `${prefix.length === 0 ? "" : `<p class="learning">${esc(prefix)}</p>`}<details class="optional-probe"><summary>Optional probe — only if relevant</summary><p>${esc(text.slice(at))}</p></details>`;
  };
  const sourceDetail = (source: EvidenceDisplay["source"]) => `<p class="meta">${esc(source.publisher)} · ${esc(source.publicationDate ? humanDate(source.publicationDate) : "Undated")} · Event ${esc(humanDate(source.eventDate))} · Current through ${esc(humanDate(source.evidenceCurrentThrough))}</p><p class="meta">${source.publicationDate === null && source.eventDate === null && source.evidenceCurrentThrough === null ? "Undated source — recheck before meeting." : "Dated evidence does not establish current meeting-day status; recheck before relying on it."}</p><p class="meta"><a href="${esc(source.canonicalUrl)}" target="_blank" rel="noreferrer">Open source (new tab)</a></p>`;
  const retained = (_source: EvidenceDisplay["source"]) => `<a class="quiet-link" href="${esc(researchUrl('sources'))}">Full source context in Research →</a>`;
  const selectedSources = new Set(draft.selectedEvidenceRefs.map((id) => sourceByEvidence.get(id)!.source.sourceId));
  const otherSources = context.context.admittedSources.filter((source) => !selectedSources.has(source.sourceId));
  const temporal = draft.temporalOutcome === "insufficient_context" ? "Context is insufficient. Treat this as a discovery agenda; the gaps below remain open." : draft.temporalOutcome === "no_material_change_established" ? "No material change established. This brief does not claim new account developments." : "Initial dated discovery. Source dates do not prove a change from an earlier account review.";
  const revisionDisabled = !(state?.generation?.available ?? recordedCorrection !== undefined) || (recordedCorrection !== undefined && record.revision !== null) ? " disabled" : "";
  return `<main id="main" class="brief-workspace" tabindex="-1"><header class="draft-head"><h1 data-work-title>${esc(displayWorkTitle(state?.work?.title, request.intendedOutcome))}</h1><p class="brief-metadata" aria-label="Meeting setup from this draft’s request"><span>${esc(request.audience)}</span><span>${String(request.durationMinutes)} min</span></p><div class="brief-toolbar">${workToolbar(state?.work)}<div class="document-actions"><a class="text-control" href="#review" data-add-note>Add note</a><button type="button" class="text-control" data-refine-section="Brief">Revise</button><details class="brief-setup"><summary>Document details</summary>${titleEditor(state?.work, request.intendedOutcome)}<p class="meta">Meeting ${esc(humanDate(request.meetingDate))}</p><p class="meta" data-saved-timestamp>${state?.work?.savedAt ? `Last saved ${savedTime(state.work.savedAt)}` : 'Last-saved time was not recorded.'}</p><p class="meta" data-saved-version>${state?.work?.version ? `Saved version ${state.work.version}` : 'No saved version'}</p><p class="meta" data-generated-region="document-scope">${draft.selectedEvidenceRefs.length} selected evidence passages · Record ${esc(record.recordId)}</p>${briefDetailLinks(context)}<a class="quiet-link" href="/?prepare=1">${recordedCorrection === undefined ? "Edit meeting setup" : syntheticPreview ? "Return to example request" : "Return to recorded request"}</a><p class="meta">Intended outcome: ${esc(request.intendedOutcome)}</p></details></div></div></header>${notice ? `<p class="status-line" role="status">${esc(notice)}</p>` : ""}<div data-generated-region="state">${initialWarning}${revisionPending ? '<p class="meta brief-qualification">Revision pending · original unchanged until Apply.</p>' : ""}</div>${pending}<div class="draft-grid"><div>${supported("Situation for this audience", draft.audienceThesis, "Situation")}${supported("Opening", draft.opening)}<section class="draft-section" aria-labelledby="questions-heading"><div data-generated-region="questions"><h2 id="questions-heading">${draft.questions.length === 3 ? "Three" : String(draft.questions.length)} questions</h2><ol class="questions">${draft.questions.map((question, index) => `<li id="question-${String(index + 1)}"><strong>${esc(question.question)}</strong><details class="question-context"><summary>Question context<span class="sr-only"> for question ${String(index + 1)}</span></summary>${learning(question.intendedLearning)}<p class="meta">Open question · Related evidence context${question.evidenceRefs.length ? "" : " · No evidence asserted"}</p></details>${question.evidenceRefs.length ? `<p class="support">${evidenceLinks(question.evidenceRefs, numberById, sourceByEvidence, `Question ${String(index + 1)}`)}</p>` : ""}</li>`).join("")}</ol></div>${editing("Questions")}</section>${supported("Useful close", draft.closeCriterion, "Useful close")}</div></div><section data-generated-region="checks" class="checks" aria-labelledby="checks-heading"><h2 id="checks-heading">Before relying on this brief</h2>${draft.risksUnknowns.map(body).join("")}${draft.risksUnknowns.length ? `<details class="risk-evidence"><summary>Evidence for these limits</summary>${draft.risksUnknowns.map((item, index) => `<article><h3>Limit ${String(index + 1)}</h3>${body(item)}${support(`Risk or unknown ${String(index + 1)}`, item)}</article>`).join("")}</details>` : ""}<details class="support-details"><summary>Source qualifications &amp; timing</summary><p class="meta">${esc(temporal)}</p>${draft.warnings.map((warning, index) => `<div class="warning">${esc(warning.message)}${warning.evidenceRefs.length === 0 ? "" : `<p class="support">${evidenceLinks(warning.evidenceRefs, numberById, sourceByEvidence, `Draft warning ${String(index + 1)}`)}</p>`}</div>`).join("")}</details></section>${secondarySetup}${contextChecks(context)}<details class="evidence-list" data-generated-region="evidence" aria-labelledby="evidence-heading"><summary id="evidence-heading">Evidence behind the brief</summary><p class="meta">Exact excerpts and source dates. References attached to an inference or question supply context, not direct proof.</p>${draft.selectedEvidenceRefs.map((id, index) => { const item = sourceByEvidence.get(id)!; return `<details id="evidence-${String(index+1)}"><summary>Evidence ${String(index+1)} · ${esc(item.source.title)}</summary><a class="evidence-return" data-evidence-return href="#questions-heading" hidden>Return to questions</a><div data-evidence-content>${admittedSourceSectionContext(item)}<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote>${sourceDetail(item.source)}${context.context.rendererAnnotations.filter((annotation) => annotation.sourceId === item.source.sourceId && (annotation.evidenceIds.length === 0 || annotation.evidenceIds.includes(id))).map((annotation) => `<p class="meta">${esc(annotation.text)}</p>`).join("")}${retained(item.source)}</div><p class="meta"><a href="#questions-heading">Back to questions</a></p></details>`; }).join("")}${draft.selectedEvidenceRefs.length === 0 ? '<p>No evidence selected by this draft. Do not treat the proposed content as established account fact.</p>' : ""}${otherSources.length === 0 ? "" : `<details><summary>Other retained account sources (${String(otherSources.length)})</summary>${otherSources.map((source) => `<h3>${esc(source.title)}</h3>${sourceDetail(source)}${retained(source)}`).join("")}</details>`}</details><dialog data-evidence-dialog aria-labelledby="evidence-panel-title"><div class="evidence-panel-head"><h2 id="evidence-panel-title">Evidence</h2><button type="button" data-evidence-close autofocus>Close evidence</button></div><p data-evidence-support class="support"></p><div data-evidence-panel-body></div><div data-revision-panel hidden data-original-sections="${esc(JSON.stringify({Opening:draft.opening.text,'Situation for this audience':draft.audienceThesis.text,Questions:draft.questions.map(q => q.question + '\n' + q.intendedLearning).join('\n\n'),'Useful close':draft.closeCriterion.text}))}" data-proposal-stale="${state?.proposalStale ?? false}" data-generation-available="${state?.generation?.available ?? recordedCorrection !== undefined}" data-proposal-id="${esc(state?.proposal?.recordId ?? '')}" data-proposal-instruction="${esc(state?.proposal?.revision?.correctionNote ?? '')}">${state?.generation && !state.generation.available ? `<p class="meta">${esc(state.generation.explanation)}</p>` : ''}${recordedHelp ? `<div data-recorded-help>${recordedHelp}</div>` : ''}<label for="revision-instruction">${recordedCorrection !== undefined ? (syntheticPreview ? 'Example instruction' : 'Recorded instruction') : 'Your instruction'}</label><textarea id="revision-instruction" data-revision-instruction maxlength="1000"${recordedCorrection !== undefined ? ' readonly aria-describedby="replay-instruction-help"' : ''}>
${esc(state?.instruction ?? '')}</textarea><div data-original-preview><h3 data-original-heading>Original opening</h3><p class="revision-original" data-revision-original>${esc(draft.opening.text)}</p></div><div data-proposal-comparison${state?.proposal ? '' : ' hidden'}>${state?.proposal ? proposalComparison(record, state.proposal) : ''}</div><p data-revision-status role="status" aria-live="polite">The current brief stays unchanged until you apply.</p>${errorDiagnostics()}<div class="revision-actions"><button type="button" data-revise${revisionDisabled}${!(state?.generation?.available ?? recordedCorrection !== undefined) ? ' hidden' : ''}>Revise</button><button type="button" class="secondary" data-stop-revision disabled>Stop revision</button><button type="button" data-apply-revision disabled>Apply revision</button><button type="button" class="secondary" data-discard-revision>Keep original</button></div>${briefDetailLinks(context)}</div></dialog><details class="review" id="review"${note ? " open" : ""}><summary id="review-heading">Notes${note ? " · 1 annotation" : ""}</summary><form data-note-form data-record-id="${esc(record.recordId)}" data-meeting-request="${esc(JSON.stringify(request))}" data-revised="${record.revision !== null}"${pendingRevisionToken ? ` data-pending-revision-token="${esc(pendingRevisionToken)}"` : ''}><label for="correction-note">Your note</label><textarea id="correction-note" data-correction-note name="note" maxlength="1000">
${esc(note)}</textarea><p class="status-line" data-review-status role="status" aria-live="polite"></p><button type="submit" class="secondary">Add note</button></form></details><details data-generated-region="record" class="technical-detail"><summary>Record and timing details</summary><p>Temporal outcome: ${esc(draft.temporalOutcome.replace(/_/gu," "))}. Model prose and raw response are retained unchanged; display grouping does not establish source truth.</p><p>Record: ${esc(record.recordId)}. Context: ${esc(record.contextSha256)}.</p></details></main>`;
}

function admittedSourceSectionContext({ source, excerpt: selected }: EvidenceDisplay): string {
  if (["evidence_8b368890779e935f142d", "evidence_666b6f5a4766efdf1762"].includes(selected.evidenceId)) {
    const header = source.excerpts.find(item => item.evidenceId === "evidence_175e89ab7dc438a1bd5d" &&
      item.sourceId === source.sourceId && item.exactExcerpt === "REINVESTMENT AREA APPROVED 3-YR CURRENT 3-YR NET CHANGE");
    return header ? `<p class="source-section"><strong>Exact table header</strong></p><blockquote>${esc(header.exactExcerpt)}</blockquote><p class="meta">Reinvestment table. The figures and dash below are retained exactly; they do not establish an available balance.</p>` : '<p class="warning">Table header unavailable. Do not interpret the isolated row as available budget.</p>';
  }
  const headingId = "evidence_c0bc6cf74d035bc8e08a";
  if (selected.evidenceId !== "evidence_2e20762caf4b11701059") return "";
  const heading = source.excerpts.find((item) => item.evidenceId === headingId);
  if (!heading || heading.exactExcerpt !== "“RESPONSIBLE AI" || heading.sourceId !== source.sourceId ||
      selected.sourceId !== source.sourceId || heading.sourceCharStart >= selected.sourceCharStart) return "";
  return `<p class="source-section" data-evidence-id="${headingId}"><strong>Source section:</strong> Responsible AI <span class="meta">Heading evidence ${headingId}</span></p>`;
}

function renderPage(context: FrozenC3AccountContext, state: C3PageState, csrf: string, options?: C3RenderOptions): string {
  const recorded = options !== undefined;
  if (state.page === "planning") return shell(`Workshop for ${context.context.account.accountName}`, planningPage(context, state.brief, state.strategySuggestion), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview, state.work);
  if (state.page === "workshop") return shell(`Workshop for ${context.context.account.accountName}`, workshop(state), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview, state.work);
  if (state.page === "research") return shell(`Research for ${context.context.account.accountName}`, home(context, state.hasDraft ?? false, recorded, state.revisionPending ?? false, state.topic, state.reading), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview, state.work);
  if (state.page === "home") return shell(context.context.account.accountName, home(context, state.hasDraft ?? false, recorded,
    state.revisionPending ?? false), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview, state.work);
  if (state.page === "prepare") return shell(`Prepare for ${context.context.account.accountName}`, prepare(context, state.request, state.error,
    state.hasDraft ?? false, recorded, options?.initialRequest, state.correctionNote, state.revisionPending, state.displayedRecordId, state.pendingRevisionToken, state.generation, options?.syntheticPreview), csrf, context, recorded, state.page, state.hasDraft ?? false, options?.syntheticPreview, state.work);
  const draft = draftPage(context, state.record, state.correctionNote, options?.correctionNote, state.revisionPending ?? false,
    state.pendingRevisionToken, state.notice, state.sectionNotes, state, options?.syntheticPreview);
  return shell(`Draft for ${context.context.account.accountName}`, draft,
    csrf, context, recorded, state.page, true, options?.syntheticPreview, state.work);
}

export function renderC3Page(context: FrozenC3AccountContext, state: C3PageState, csrf: string, options?: C3RenderOptions): string {
  if (isCuratedContext(context)) {
    if (options !== undefined || state.page === "draft") throw new Error("Agent-curated context cannot render recorded-model claims");
    return renderPage(context, state, csrf);
  }
  return renderPage(context, state, csrf, options);
}

/** Short authored surface copy is activated only by projectAccount's exact evidence bindings. */
function compactReading(note: AccountReading): AccountReading {
  const copy: Record<string,[string,string,string?]> = {
    'reinvestment-compute-health':['Reinvestment, computing and health data.','The sources suggest three distinct areas to explore: education, statewide AI computing and a planned health-data partnership. Current delivery and responsibilities need confirmation.'],
    'student-research-engagement':['Student success, research and engagement.','The strategy links student outcomes, scholarship and statewide engagement. MizzouForward describes a long-term investment effort; current progress needs confirmation.'],
    'strategic-reinvestment':['Strategic reinvestment','A three-year plan spans engineering, AI, health and education.','Institutional reallocation, not available purchasing budget.'],
    'redtail-access':['Research computing','Redtail is described as statewide computing, training and support.','Undated description; current access needs confirmation.'],
    'health-ai-vault':['Health-data collaboration','The planned UHAIV system connects health research, population data and CHPC.','Undated plans; funding is not a remaining solution budget.'],
    'chpc':['CHPC · research computing','Reported future management of Redtail; current responsibilities unconfirmed.'],
    'health-data-partners':['Health-data collaboration','Named research, population-data and computing partners; access rights unconfirmed.'],
    'redtail-platform':['Redtail AI Factory','Statewide computing remit; current service readiness unconfirmed.'],
    'health-data-system':['Health-data system','Planned UHAIV and infrastructure work; current delivery unconfirmed.'],
  };
  const value=copy[note.id]; return value ? {...note,title:value[0],text:value[1],limit:value[2]} : note;
}
function preparationAnchors(readings: readonly AccountReading[]): AccountReading[] {
  const preferred=['strategic-reinvestment','redtail-access','health-ai-vault'];
  const priorities=readings.filter(item=>item.topic==='priorities');
  const selected=preferred.flatMap(id=>priorities.filter(item=>item.id===id));
  return (selected.length ? selected : priorities).slice(0,3);
}
function preparationContext(context:FrozenC3AccountContext):string {
  const anchors=preparationAnchors(projectAccount(context).readings);
  const evidence=context.context.admittedSources.flatMap(source=>source.excerpts.map(excerpt=>({source,excerpt})));
  return `<aside class="brief-context"><h2>Context for this brief</h2><p class="meta">Source summaries carried from this account.</p>${anchors.map((item,index)=>{const short=compactReading(item);return `<section class="preparation-anchor"><h3>${esc(short.title)}</h3><p>${esc(short.text)}</p>${short.limit ? `<p class="meta">${esc(short.limit)}</p>` : ''}${detailLink(item)}<a class="quiet-link source-opener" href="#evidence-${index+1}" data-evidence-link data-context="${esc(short.title)}" data-support="Source context for this summary">Inspect source</a></section>`;}).join('') || '<p>No matched preparation anchors. Inspect the supplied research before relying on a brief.</p>'}<a class="quiet-link" href="${esc(researchUrl('initiatives'))}">Explore context in Research →</a><div class="evidence-store" hidden>${anchors.map((anchor,index)=>`<details id="evidence-${index+1}"><summary>${esc(anchor.title)}</summary><div data-evidence-content>${evidence.filter(item=>anchor.evidenceIds.includes(item.excerpt.evidenceId)).map(item=>`<h3>${esc(item.source.title)}</h3><blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote><p>${esc(item.source.publisher)}</p><p class="meta">${esc(humanDate(item.source.publicationDate))} · Current status may need confirmation.</p><details><summary>Source details</summary><p>Published ${esc(humanDate(item.source.publicationDate))} · Event ${esc(humanDate(item.source.eventDate))} · Current through ${esc(humanDate(item.source.evidenceCurrentThrough))}</p><p>Source: ${esc(item.source.sourceId)} · Evidence: ${esc(item.excerpt.evidenceId)}</p><p>Acquired ${esc(item.source.retrievedAt)}; acquisition is not publication.</p><p>${esc(item.source.entity.name)} · ${esc(item.source.entity.relationshipToAccount)}</p></details><a class="quiet-link" href="${esc(item.source.canonicalUrl)}" target="_blank" rel="noreferrer">Open original source</a>`).join('')}<a class="quiet-link" href="${esc(researchUrl('sources'))}">Full source context in Research →</a></div></details>`).join('')}</div></aside>`;
}
function workToolbar(work?:WorkDisplayState):string {
  return `<div data-work-controls data-store-available="${Boolean(work?.available)}" class="work-toolbar"><span data-work-status role="status" aria-live="polite">${work?.available ? work.saved ? 'Saved' : 'Unsaved changes' : 'Session only'}</span><span class="work-origin">${originLabel(work?.origin)}</span><span class="meta" data-last-saved>${work?.savedAt ? `Saved ${relativeSavedTime(work.savedAt)}` : ''}</span>${errorDiagnostics()}${work?.available ? `<button type="button" data-save-work${work.saved ? " hidden" : ""}>Save</button><button type="button" class="secondary" data-save-copy hidden>Save a copy</button>` : ''}</div>`;
}
function proposalComparison(original:C3GenerationRecord, proposed:C3GenerationRecord):string {
  const labels={opening:'Opening',audienceThesis:'Situation',objective:'Objective',questions:'Questions',closeCriterion:'Useful close',risksUnknowns:'Risks and unknowns',warnings:'Warnings',selectedEvidenceRefs:'Evidence',temporalOutcome:'Temporal outcome'} as const;
  const text=(value:unknown):string => typeof value==='string' ? value : Array.isArray(value) ? value.map(item=>typeof item==='string'?item:item.question ? `${item.question} ${item.intendedLearning}` : item.text ?? item.message).join('\n\n') : (value as {text:string}).text;
  return Object.entries(labels).filter(([key])=>JSON.stringify(original.draft![key as keyof typeof labels])!==JSON.stringify(proposed.draft![key as keyof typeof labels])).map(([key,label])=>`<section><h3>Proposed ${label.toLowerCase()}</h3><p class="revision-proposed">${esc(text(proposed.draft![key as keyof typeof labels]))}</p><h3>Original ${label.toLowerCase()}</h3><p class="revision-original">${esc(text(original.draft![key as keyof typeof labels]))}</p></section>`).join('') || '<p>No content change proposed. Keep original or regenerate.</p>';
}

function detailTopic(note: AccountReading): ResearchTopic {
  return note.topic === 'people' || note.topic === 'technology' ? note.topic : 'initiatives';
}
function detailLink(note: AccountReading): string {
  return `<a class="quiet-link detail-opener" data-detail-link aria-haspopup="dialog" data-detail-target="detail-${esc(note.id)}" href="${esc(researchUrl(detailTopic(note), note.id))}">View details<span class="sr-only"> · ${esc(note.title)}</span></a>`;
}
function briefDetailLinks(context: FrozenC3AccountContext): string {
  return `<details class="companion-details"><summary>Account context</summary>${preparationAnchors(projectAccount(context).readings).map(note => `<p><strong>${esc(compactReading(note).title)}</strong><br>${detailLink(note)}</p>`).join('') || '<p>No matched account details are available.</p>'}</details>`;
}
/** Exact retained passages only; this hidden library never changes model context or raw records. */
function accountDetailLibrary(context: FrozenC3AccountContext): string {
  const projection = projectAccount(context);
  const byEvidence = new Map(context.context.admittedSources.flatMap(source => source.excerpts.map(excerpt => [excerpt.evidenceId, {source, excerpt}] as const)));
  const sourceInfo = (source: EvidenceDisplay['source']) => `<p class="meta">${esc(source.publisher)} · ${esc(source.entity.name)}</p><p class="meta">${esc(source.publicationDate ? humanDate(source.publicationDate) : "Undated")} · Event ${esc(humanDate(source.eventDate))} · Current through ${esc(humanDate(source.evidenceCurrentThrough))}</p>`;
  const details = projection.details.map(detail => {
    const note = projection.readings.find(note => note.id === detail.readingId)!;
    return `<section id="detail-${esc(note.id)}" data-detail-title="${esc(note.topic === 'overview' ? 'Account context' : note.title.split(' · ')[0]!)}"><div data-detail-content data-reading-id="${esc(note.id)}" data-reading-topic="${detailTopic(note)}"><p class="detail-orientation">${esc(note.text)}</p><p class="eyebrow">${note.kind === 'hypothesis' ? 'Hypothesis · unvalidated' : note.kind === 'interpretation' ? 'Interpretation · unreviewed' : 'Source summary · unreviewed'}</p>${note.period ? `<p class="meta">${esc(note.period)}</p>` : ''}${note.limit ? `<section class="detail-limit"><h3>What remains unclear</h3><p class="reading-limit">${esc(note.limit)}</p></section>` : ''}${detail.sections.map(section => {
      const {source} = byEvidence.get(section.evidenceId)!;
      return `<section class="retained-detail" data-source-id="${esc(section.sourceId)}" data-evidence-id="${esc(section.evidenceId)}"><h3>${esc(section.title)}</h3>${section.summary ? `<p>${esc(section.summary)}</p>` : `<p class="meta">Only this retained passage is available for this point; no expanded interpretation is established.</p><blockquote>${esc(section.exactText)}</blockquote>`}<a class="source-chip" data-evidence-link data-context="${esc(note.title)}" data-support="Exact retained source context · inspection does not establish current status or approval" href="#detail-evidence-${esc(section.evidenceId)}">${uiIcon('source')}<span>View evidence<span class="sr-only"> · ${esc(section.title)}</span></span></a></section>`;
    }).join('')}${note.question ? `<section class="detail-question"><h3>Suggested question</h3><p>${esc(note.question)}</p></section>` : ''}${context.context.declaredContradictions.map(text => `<p class="warning"><strong>Conflicting context.</strong> ${esc(text)}</p>`).join('')}<a class="quiet-link" data-open-research href="${esc(researchUrl(detailTopic(note), note.id))}">Open in Research →</a></div></section>`;
  }).join('');
  const ids = [...new Set(projection.details.flatMap(detail => detail.sections.map(section => section.evidenceId)))];
  const evidence = ids.map(id => { const item = byEvidence.get(id)!; return `<details id="detail-evidence-${esc(id)}"><summary>${esc(item.source.title)}</summary><div data-evidence-content>${admittedSourceSectionContext(item)}<blockquote>${esc(item.excerpt.exactExcerpt)}</blockquote>${sourceInfo(item.source)}<p class="meta">${esc(item.source.entity.relationshipToAccount)}</p>${context.context.rendererAnnotations.filter(annotation => annotation.sourceId === item.source.sourceId && (!annotation.evidenceIds.length || annotation.evidenceIds.includes(id))).map(annotation => `<p class="reading-limit">${esc(annotation.text)}</p>`).join('')}<details><summary>Exact source details</summary><p class="meta">Source ${esc(item.source.sourceId)} · Evidence ${esc(id)}</p><p class="meta">Acquired ${esc(item.source.retrievedAt)}. Acquisition is not publication or currentness.</p><p class="meta">${isCuratedContext(context) ? 'Agent-curated excerpt · unreviewed; no policy admission or human approval.' : 'Retained excerpt; inspection does not change its original admission or approval boundaries.'}</p></details><a href="${esc(item.source.canonicalUrl)}" target="_blank" rel="noreferrer">Open original source (new tab)</a><p><a class="quiet-link" href="${esc(researchUrl('sources'))}">Full retained source context in Research →</a></p></div></details>`; }).join('');
  return details ? `<div hidden class="detail-library">${details}${evidence}</div>` : '';
}
function originLabel(origin?: WorkOrigin): string {
  return origin === 'historical-replay' ? 'Historical replay' : origin === 'live' ? 'Live generation' : origin === 'synthetic' ? 'Synthetic example' : 'Origin not established';
}
function savedTime(savedAt?: string): string {
  if (!savedAt || !Number.isFinite(Date.parse(savedAt))) return '';
  return `<time datetime="${esc(savedAt)}">${esc(new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZone:'UTC', timeZoneName:'short'}).format(new Date(savedAt)))}</time>`;
}
function titleEditor(work: WorkDisplayState | undefined, fallback: string): string {
  return `<details class="title-editor"><summary>Edit title</summary><form data-title-form data-work-version="${work?.workVersion ?? 0}"><label for="work-title-input">Brief title</label><input id="work-title-input" name="title" data-title-input required maxlength="160" value="${esc(work?.title || fallback.slice(0,160))}">${displayWorkTitle(work?.title, fallback) !== (work?.title || fallback) ? `<button type="button" class="secondary" data-use-title-suggestion data-title-suggestion="${esc(displayWorkTitle(work?.title, fallback))}">Use shorter title</button>` : ''}<button type="submit" class="secondary">Keep title</button><p data-title-status class="meta" role="status"></p>${errorDiagnostics()}</form></details>`;
}

function errorDiagnostics(message?: string): string {
  return `<details data-error-diagnostics${message ? '' : ' hidden'}><summary>Exact diagnostics</summary><pre class="user-copy">${esc(message ?? '')}</pre></details>`;
}

/** Recognition copy only. Explicit titles remain intact; legacy outcome-derived titles get a short display suggestion. */
function displayWorkTitle(title: string | undefined, outcome: string): string {
  if (title && title !== outcome && title !== outcome.slice(0, 160)) return title;
  const clean = outcome.replace(/\s+/gu, ' ').trim();
  if (clean.length <= 44) return clean || 'Meeting brief';
  const clause = clean.split(/\s+(?:and|so that|in order to)\s+|[.;:]/u)[0]!;
  if (clause.length >= 12 && clause.length <= 44) return clause;
  const words = clean.slice(0, 44).replace(/\s+\S*$/u, '');
  return `${words || clean.slice(0, 44)}…`;
}
function relativeSavedTime(value: string): string {
  const age = Date.now() - Date.parse(value);
  if (!Number.isFinite(age) || age < 0) return savedTime(value);
  if (age < 60_000) return 'just now';
  if (age < 3_600_000) return `${Math.floor(age / 60_000)} min ago`;
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)} hr ago`;
  return `${Math.floor(age / 86_400_000)} days ago`;
}
