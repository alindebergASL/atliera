import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';
const request = { audience: 'Original audience', intendedOutcome: 'Original outcome', durationMinutes: 15, meetingDate: '2026-09-12' };
class Element {
  value = ''; textContent = ''; disabled = false; hidden = false;
  attrs: Record<string, string> = {}; listeners = new Map<string, (event: any) => any>();
  addEventListener(name: string, fn: (event: any) => any) { this.listeners.set(name, fn); }
  getAttribute(name: string) { return this.attrs[name] ?? null; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  querySelectorAll() { return []; }
  click() { return this.listeners.get('click')?.({ preventDefault() {}, currentTarget: this }); }
}
function client(fetcher: (url: string, body: any) => Promise<any>) {
  const form = new Element(); form.attrs = { 'data-record-id': 'prior', 'data-meeting-request': JSON.stringify(request) };
  const note = new Element(); note.value = 'Improve opening';
  const revise = new Element(), stop = new Element(), retry = new Element(), discard = new Element(), status = new Element(), differences = new Element();
  let generated = 'Prior brief';
  const region = { getAttribute: () => 'opening', replaceChildren: (...children: string[]) => { generated = children.join(''); } };
  const selectors: Record<string, any> = { '[data-note-form]': form, '[data-correction-note]': note, '[data-revise]': revise, '[data-stop-revision]': stop, '[data-retry-revision]': retry, '[data-discard-revision]': discard, '[data-review-status]': status, '[data-revision-differences]': differences };
  const calls: { url: string; body: any }[] = [];
  const document = { querySelector: (s: string) => selectors[s] ?? null, querySelectorAll: (s: string) => s === '[data-generated-region]' ? [region] : [], addEventListener() {} };
  class Parser { parseFromString(html: string) {
    const forms = Array.from(html.matchAll(/<form\b([^>]*)>/g), ([, attrs]) => {
      const form = new Element();
      for (const [, name, value] of attrs!.matchAll(/(data-[\w-]+)(?:="([^"]*)")?/g)) form.attrs[name!] = value ?? '';
      return form;
    });
    return {
      querySelector: (selector: string) => selector === '[data-note-form]' ? forms.find((form) => form.getAttribute('data-note-form') !== null) ?? null :
        selector.startsWith('[data-generated-region=') && html.includes('data-generated-region') ? { childNodes: ['Revised brief'] } : null,
      querySelectorAll: (selector: string) => selector === '[data-local-edit][data-section]' ? forms.filter((form) => form.getAttribute('data-local-edit') !== null && form.getAttribute('data-section') !== null) : [],
    };
  } }
  const probe: any = {};
  vm.runInNewContext(C3_CLIENT_SCRIPT.replace('const applyRevision = (payload, stagedNote) => {', 'probe.state = () => ({ savedNote, pendingRevisionToken }); const originalRebind = rebindSectionNotes; rebindSectionNotes = (...args) => { probe.rebound = true; originalRebind(...args); }; const applyRevision = (payload, stagedNote) => {'), { probe, document, window: { crypto: webcrypto, addEventListener() {} }, DOMParser: Parser, fetch: async (url: string, init: any) => { const body = JSON.parse(init.body); calls.push({ url, body }); return { ok: true, json: async () => fetcher(url, body) }; }, Error, JSON, Number, String });
  return { probe, form, note, revise, stop, retry, discard, status, differences, calls, generated: () => generated };
}
const staged = (body: any) => ({ revisionReady: true, recordId: body.recordId, request, savedNote: body.note, pendingRevisionToken: 'a'.repeat(32) });
const returnedHtml = (recordId = 'c3_' + '2'.repeat(24), sectionId = recordId) => `<section data-generated-region="opening">Revised brief</section><form data-note-form data-record-id="${recordId}"></form><form data-local-edit data-section="Opening" data-record-id="${sectionId}"></form>`;
const success = (body: any) => ({ outcome: 'succeeded', operation: body, recordId: 'c3_' + '2'.repeat(24), savedNote: 'Improve opening', sectionNotes: {}, changedSections: ['Opening'], html: returnedHtml() });

test('one action chains revision and generation while preserving newer typing and prior brief until owned success', async () => {
  let finish!: (payload: any) => void;
  const ui = client(async (url, body) => url === '/api/revise' ? staged(body) : new Promise((resolve) => { finish = resolve; }));
  const work = ui.revise.click(); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(ui.calls.map((c) => c.url), ['/api/revise', '/api/generate']);
  assert.deepEqual(ui.calls[1]!.body.request, request); assert.equal(ui.generated(), 'Prior brief');
  ui.note.value = 'Newer typing'; finish(success(ui.calls[1]!.body)); await work;
  assert.equal(ui.generated(), 'Revised brief'); assert.equal(ui.note.value, 'Newer typing');
  assert.equal(ui.form.getAttribute('data-record-id'), 'c3_' + '2'.repeat(24)); assert.match(ui.differences.textContent, /Changed sections: Opening/);
});

test('stop during staging suppresses generation, retains pending identity, and discard keeps newer typing', async () => {
  let finish!: (payload: any) => void;
  const ui = client(async (url) => url === '/api/revise' ? new Promise((resolve) => { finish = resolve; }) : ({ discarded: true, recordId: 'prior', savedNote: 'Improve opening', status: 'Discarded' }));
  const work = ui.revise.click(); ui.stop.click(); ui.note.value = 'Newer local edit';
  await new Promise((resolve) => setImmediate(resolve));
  finish(staged(ui.calls[0]!.body)); await work;
  assert.equal(ui.calls.length, 1); assert.equal(ui.generated(), 'Prior brief'); assert.equal(ui.retry.hidden, false);
  await ui.discard.click(); assert.equal(ui.note.value, 'Newer local edit'); assert.equal(ui.retry.hidden, true);
  assert.equal(ui.calls[1]!.body.pendingRevisionToken, 'a'.repeat(32));
});

test('failed generation keeps pending correction; retry uses fresh operation and same pending token', async () => {
  let attempts = 0;
  const ui = client(async (url, body) => url === '/api/revise' ? staged(body) : ++attempts === 1 ? ({ outcome: 'failed', operation: body, error: 'Synthetic failure' }) : success(body));
  await ui.revise.click(); assert.equal(ui.generated(), 'Prior brief'); assert.match(ui.status.textContent, /Synthetic failure/);
  ui.note.value = 'Typing after failure'; await ui.retry.click();
  assert.notEqual(ui.calls[1]!.body.operationId, ui.calls[2]!.body.operationId);
  assert.equal(ui.calls[1]!.body.pendingRevisionToken, ui.calls[2]!.body.pendingRevisionToken);
  assert.equal(ui.note.value, 'Typing after failure'); assert.equal(ui.generated(), 'Revised brief');
});

for (const [label, invalid] of Object.entries({
  missingId: { recordId: undefined }, emptyId: { recordId: '' }, wrongId: { recordId: 'next' },
  validFormatMismatchedId: { recordId: 'c3_' + '9'.repeat(24) },
  mismatchedSectionId: { html: returnedHtml(undefined, 'c3_' + '9'.repeat(24)) },
  missingCanonicalForm: { html: '<section data-generated-region="opening">Revised brief</section>' },
  missingCanonicalId: { html: returnedHtml().replace('data-record-id="c3_' + '2'.repeat(24) + '"', '') },
  missingSectionId: { html: returnedHtml(undefined, '') },
  differentNote: { savedNote: 'UNACKNOWLEDGED DIFFERENT NOTE' },
  newerNote: { savedNote: 'Newer typing' }, arrayNotes: { sectionNotes: [] },
  invalidNoteText: { sectionNotes: { Opening: 42 } }, unknownNote: { sectionNotes: { alien: '' } },
  invalidChange: { changedSections: [42] }, unknownChange: { changedSections: ['Alien'] },
  missingHtml: { html: undefined }, emptyHtml: { html: '' }, incompleteHtml: { html: '<p>Incomplete</p>' },
})) test('owned malformed revision acknowledgement preserves every baseline: ' + label, async () => {
  let finish!: (payload: any) => void;
  const ui = client(async (url, body) => url === '/api/revise' ? staged(body) : new Promise((resolve) => { finish = resolve; }));
  const work = ui.revise.click(); await new Promise((resolve) => setImmediate(resolve));
  const before = ui.probe.state(); ui.note.value = 'Newer typing';
  finish({ ...success(ui.calls[1]!.body), ...invalid }); await work;
  assert.equal(ui.generated(), 'Prior brief'); assert.equal(ui.form.getAttribute('data-record-id'), 'prior');
  assert.equal(ui.form.getAttribute('data-revised'), null); assert.equal(ui.differences.textContent, '');
  assert.deepEqual(ui.probe.state(), before); assert.equal(ui.probe.rebound, undefined);
  assert.equal(ui.retry.hidden, false); assert.equal(ui.discard.hidden, false);
  assert.equal(ui.note.value, 'Newer typing'); assert.doesNotMatch(ui.status.textContent, /Revised brief ready/);
});
