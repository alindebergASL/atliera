import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";

import { C3_CLIENT_SCRIPT } from "../../src/c3/render.ts";

type Listener = (event: { preventDefault(): void; currentTarget: Element }) => unknown;

class Field { constructor(public value: string) {} }

class Element {
  readonly listeners = new Map<string, Listener[]>();
  readonly fields: Record<string, Field>;
  readonly elements: { namedItem: (name: string) => Field | null };
  textContent = "";
  disabled = false;
  value = "";

  constructor(values: Record<string, string> = {}, private readonly recordId = "") {
    this.fields = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, new Field(value)]));
    this.elements = { namedItem: (name) => this.fields[name] ?? null };
  }

  addEventListener(name: string, listener: Listener): void {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  async dispatch(name: string): Promise<void> {
    for (const listener of this.listeners.get(name) ?? []) {
      await listener({ preventDefault() {}, currentTarget: this });
    }
  }

  querySelector(selector: string): Element | null {
    return selector === 'button[type="submit"]' ? (this.fields.__button as unknown as Element | undefined) ?? null : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-record-id" ? this.recordId : name === "data-meeting-request" ? JSON.stringify({ audience: "Original", intendedOutcome: "Original outcome", durationMinutes: 15, meetingDate: "2026-09-12" }) : null;
  }
}

class TabStorage {
  readonly values = new Map<string, string>();
  setUnavailable = false;
  removeUnavailable = false;
  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.setUnavailable) throw new Error("storage write blocked");
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    if (this.removeUnavailable) throw new Error("storage removal blocked");
    this.values.delete(key);
  }
}

class FormDataStub {
  constructor(private readonly element: Element) {}
  get(name: string): string | null { return this.element.fields[name]?.value ?? null; }
}

interface ClientOptions {
  readonly csrf: string;
  readonly account?: string;
  readonly storage?: TabStorage;
  readonly storageUnavailable?: boolean;
  readonly form?: Record<string, string>;
  readonly recordId?: string;
  readonly correctionNote?: string;
  readonly fetch: (url: string, init: { readonly method: string; readonly body: string; readonly signal?: AbortSignal }) => Promise<unknown>;
}

function runClient(options: ClientOptions) {
  const button = new Element();
  const form = options.form === undefined ? null : new Element(options.form);
  if (form) (form.fields as Record<string, unknown>).__button = button;
  const cancel = new Element();
  const status = new Element();
  const recovery = new Element();
  const optionsSummary = new Element();
  const noteForm = options.recordId === undefined ? null : new Element({ note: options.correctionNote ?? "" }, options.recordId);
  const revise = new Element();
  const note = new Element();
  note.value = options.correctionNote ?? "";
  const reviewStatus = new Element();
  const csrfMeta = { getAttribute: (name: string) => name === "content" ? options.csrf : null };
  const accountMeta = { getAttribute: (name: string) => name === "content" ? options.account ?? "acc_university_of_utah" : null };
  const writes: string[] = [];
  const navigation: string[] = [];
  const document = {
    querySelector(selector: string): unknown {
      return ({
        '[data-generate]': form,
        '[data-cancel]': cancel,
        '[data-status]': status,
        '[data-form-recovery]': recovery,
        '[data-options-summary]': optionsSummary,
        '[data-note-form]': noteForm,
        '[data-revise]': options.recordId === undefined ? null : revise,
        '[data-correction-note]': options.recordId === undefined ? null : note,
        '[data-revision-instruction]': options.recordId === undefined ? null : note,
        '[data-revision-status]': options.recordId === undefined ? null : reviewStatus,
        '[data-review-status]': options.recordId === undefined ? null : reviewStatus,
        'meta[name="c3-csrf"]': csrfMeta,
        'meta[name="c3-account"]': accountMeta,
      } as Record<string, unknown>)[selector] ?? null;
    },
    open() {},
    write(html: string) { writes.push(html); },
    close() {},
  };
  const window: Record<string, unknown> = { crypto: webcrypto, addEventListener() {}, location: { reload() {}, assign(url: string) { navigation.push(`native:${url}`); } } };
  if (options.storageUnavailable) {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("storage blocked"); } });
  } else {
    window.sessionStorage = options.storage ?? new TabStorage();
  }
  const history = {
    pushState(_state: unknown, _title: string, location: string) { navigation.push(`push:${location}`); },
    replaceState(_state: unknown, _title: string, location: string) { navigation.push(`replace:${location}`); },
  };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window, document, history, FormData: FormDataStub, fetch: options.fetch,
    AbortController, Error, JSON, Number, String });
  return { form, button, cancel, status, recovery, optionsSummary, noteForm, note, revise, reviewStatus, writes, navigation };
}

function response(payload: unknown, ok = true): Promise<unknown> {
  return Promise.resolve({ ok, json: async () => payload });
}

test("rapid in-flight edits cache the latest audience and outcome, send one cancel, and order a new generation after it", async () => {
  const storage = new TabStorage();
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  let resolveFirst!: (value: unknown) => void;
  let resolveCancel!: (value: unknown) => void;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const cancelling = new Promise((resolve) => { resolveCancel = resolve; });
  let generationCount = 0;
  const client = runClient({ csrf: "session-a", storage,
    form: { audience: "CISO", intendedOutcome: "Original goal", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      if (url === "/api/cancel") return cancelling;
      generationCount += 1;
      return generationCount === 1 ? first : Promise.reject(new Error("Failed to fetch"));
    } });
  const form = client.form!;
  const firstSubmit = form.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));

  form.fields.intendedOutcome!.value = "";
  await form.dispatch("input");
  form.fields.audience!.value = "CIO";
  form.fields.intendedOutcome!.value = "Edited goal while";
  await form.dispatch("input");
  form.fields.audience!.value = "CIO and engineering leaders";
  form.fields.intendedOutcome!.value = "Edited goal while the previous generation is loading";
  await form.dispatch("input");
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel"]);
  assert.equal((calls[1]!.body.request as Record<string, unknown>).intendedOutcome, "");

  const secondSubmit = form.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel"], "new generation waits for cancel settlement");
  resolveCancel({ ok: true, json: async () => ({ status: "cancelled" }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel", "/api/generate"]);
  assert.equal((calls[2]!.body.request as Record<string, unknown>).audience, "CIO and engineering leaders");
  assert.equal((calls[2]!.body.request as Record<string, unknown>).intendedOutcome, "Edited goal while the previous generation is loading");
  await secondSubmit;
  assert.match(client.status.textContent, /could not be prepared.*inputs are kept/);
  resolveFirst({ ok: true, json: async () => ({ html: "STALE", location: "/?draft=1", history: "push" }) });
  await firstSubmit;
  assert.deepEqual(client.writes, []);

  const reloaded = runClient({ csrf: "session-a", storage,
    form: { audience: "CIO", intendedOutcome: "", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: async () => { throw new Error("offline"); } });
  assert.equal(reloaded.form!.fields.audience!.value, "CIO and engineering leaders");
  assert.equal(reloaded.form!.fields.intendedOutcome!.value, "Edited goal while the previous generation is loading");
  assert.match(reloaded.recovery.textContent, /Meeting setup recovery is available in this tab/);
});

test("a new server session cannot restore stale form bytes from the prior session", () => {
  const storage = new TabStorage();
  const first = runClient({ csrf: "old-session", storage,
    form: { audience: "CISO", intendedOutcome: "Server value", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  first.form!.fields.audience!.value = "Stale audience";
  first.form!.fields.intendedOutcome!.value = "Stale outcome";
  void first.form!.dispatch("input");

  const next = runClient({ csrf: "new-session", storage,
    form: { audience: "", intendedOutcome: "", durationMinutes: "15", meetingDate: "2026-09-19" },
    fetch: () => response({}) });
  assert.equal(next.form!.fields.audience!.value, "");
  assert.equal(next.form!.fields.intendedOutcome!.value, "");
  assert.equal([...storage.values.keys()].some((key) => key.includes("old-session")), false);
});

test("accepted generation navigates natively and one-click revision invalidates stale Prepare recovery even on generation failure", async () => {
  const acceptedStorage = new TabStorage();
  const accepted = runClient({ csrf: "accepted-session", storage: acceptedStorage,
    form: { audience: "CISO", intendedOutcome: "Accepted request", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({ outcome: "succeeded", html: "DRAFT", location: "/?draft=1", history: "push" }) });
  accepted.form!.fields.audience!.value = "Accepted audience";
  await accepted.form!.dispatch("input");
  await accepted.form!.dispatch("submit");
  assert.deepEqual(accepted.navigation, ["native:/?draft=1"]);
  assert.equal(acceptedStorage.values.size, 0);

  const revisionStorage = new TabStorage();
  const cached = runClient({ csrf: "revision-session", storage: revisionStorage,
    form: { audience: "Old cached audience", intendedOutcome: "Old cached outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  await cached.form!.dispatch("input");
  const revision = runClient({ csrf: "revision-session", storage: revisionStorage, recordId: "c3_111111111111111111111111",
    correctionNote: "Revise the displayed draft",
    fetch: (url, init) => { const body = JSON.parse(init.body); return url === "/api/revise" ? response({ revisionReady: true, recordId: body.recordId, pendingRevisionToken: "a".repeat(32), savedNote: body.note, instruction: body.note, request: { audience: "Original", intendedOutcome: "Original outcome", durationMinutes: 15, meetingDate: "2026-09-12" } }) : response({ outcome: "failed", operation: body, error: "Synthetic failure" }); } });
  await revision.revise.dispatch("click");
  assert.equal(revisionStorage.values.size, 0);
  const prepare = runClient({ csrf: "revision-session", storage: revisionStorage,
    form: { audience: "Revision audience", intendedOutcome: "Revision outcome", durationMinutes: "30", meetingDate: "2026-09-20" },
    fetch: () => response({}) });
  assert.equal(prepare.form!.fields.audience!.value, "Revision audience");
  assert.equal(prepare.form!.fields.intendedOutcome!.value, "Revision outcome");
});

test("successful note save visibly confirms session-only non-approval state", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const client = runClient({ csrf: "note-session", recordId: "c3_111111111111111111111111",
    correctionNote: "Keep the outcome primary.",
    fetch: (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      return response({ savedNote: "Keep the outcome primary.", noChange: false, html: "UPDATED DRAFT", location: "/?draft=1", history: "replace" });
    } });
  await client.noteForm!.dispatch("submit");
  assert.deepEqual(calls, [{ url: "/api/note", body: {
    note: "Keep the outcome primary.", priorNote: "Keep the outcome primary.", recordId: "c3_111111111111111111111111" } }]);
  assert.deepEqual(client.navigation, [], "keeping a note preserves the current fragment and scroll position");
  assert.deepEqual(client.writes, [], "keeping a note preserves open evidence and the current textarea");
  assert.equal(client.reviewStatus.textContent, "Note kept for this session. It is not approval or durable storage.");
});

test("storage unavailability makes reload limits explicit and does not block editing", async () => {
  const client = runClient({ csrf: "blocked-storage", storageUnavailable: true,
    form: { audience: "CISO", intendedOutcome: "Initial", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  assert.match(client.recovery.textContent, /cannot be kept through reload/);
  client.form!.fields.audience!.value = "Edited without storage";
  client.form!.fields.intendedOutcome!.value = "Latest offline text";
  await client.form!.dispatch("input");
  assert.equal(client.form!.fields.audience!.value, "Edited without storage");
  assert.equal(client.form!.fields.intendedOutcome!.value, "Latest offline text");
  assert.match(client.recovery.textContent, /Keep this page open or copy them/);
});

test("a populated cache is invalidated when a newer write fails, including accepted generation and revision", async () => {
  const acceptedStorage = new TabStorage();
  const accepted = runClient({ csrf: "accepted-write-fault", storage: acceptedStorage,
    form: { audience: "Cached audience", intendedOutcome: "Cached outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({ outcome: "succeeded", html: "DRAFT", location: "/?draft=1", history: "push" }) });
  await accepted.form!.dispatch("input");
  acceptedStorage.setUnavailable = true;
  accepted.form!.fields.audience!.value = "Accepted newer audience";
  accepted.form!.fields.intendedOutcome!.value = "Accepted newer outcome";
  await accepted.form!.dispatch("input");
  assert.equal(acceptedStorage.values.size, 0, "failed replacement removes superseded bytes when removal remains available");
  assert.match(accepted.recovery.textContent, /cannot be kept through reload/);
  acceptedStorage.setUnavailable = false;
  await accepted.form!.dispatch("submit");
  const acceptedPrepare = runClient({ csrf: "accepted-write-fault", storage: acceptedStorage,
    form: { audience: "Accepted newer audience", intendedOutcome: "Accepted newer outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  assert.equal(acceptedPrepare.form!.fields.audience!.value, "Accepted newer audience");
  assert.equal(acceptedPrepare.form!.fields.intendedOutcome!.value, "Accepted newer outcome");

  const refusedInvalidationStorage = new TabStorage();
  const refusedInvalidation = runClient({ csrf: "accepted-remove-fault", storage: refusedInvalidationStorage,
    form: { audience: "Cached audience", intendedOutcome: "Cached outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({ outcome: "succeeded", html: "DRAFT", location: "/?draft=1", history: "push" }) });
  await refusedInvalidation.form!.dispatch("input");
  refusedInvalidationStorage.setUnavailable = true;
  refusedInvalidationStorage.removeUnavailable = true;
  refusedInvalidation.form!.fields.intendedOutcome!.value = "Accepted while storage refuses invalidation";
  await refusedInvalidation.form!.dispatch("input");
  await refusedInvalidation.form!.dispatch("submit");
  assert.deepEqual(refusedInvalidation.navigation, [], "known stale bytes are not silently carried into the accepted draft view");
  assert.match(refusedInvalidation.status.textContent, /Draft prepared.*superseded reload recovery could not be cleared/);
  assert.equal(refusedInvalidationStorage.values.size, 1, "the browser-refused stale entry remains explicitly unresolved");

  const revisionStorage = new TabStorage();
  const cached = runClient({ csrf: "revision-write-fault", storage: revisionStorage,
    form: { audience: "Superseded audience", intendedOutcome: "Superseded outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  await cached.form!.dispatch("input");
  revisionStorage.setUnavailable = true;
  revisionStorage.removeUnavailable = true;
  const revision = runClient({ csrf: "revision-write-fault", storage: revisionStorage, recordId: "c3_111111111111111111111111",
    correctionNote: "Revise the displayed draft",
    fetch: (url, init) => { const body = JSON.parse(init.body); return url === "/api/revise" ? response({ revisionReady: true, recordId: body.recordId, pendingRevisionToken: "a".repeat(32), savedNote: body.note, instruction: body.note, request: { audience: "Original", intendedOutcome: "Original outcome", durationMinutes: 15, meetingDate: "2026-09-12" } }) : response({ outcome: "failed", operation: body, error: "Synthetic failure" }); } });
  revisionStorage.setUnavailable = false;
  revisionStorage.removeUnavailable = false;
  await revision.revise.dispatch("click");
  assert.equal(revisionStorage.values.size, 0, "revision retries invalidation after initialization storage failure");
  const revisedPrepare = runClient({ csrf: "revision-write-fault", storage: revisionStorage,
    form: { audience: "Revision audience", intendedOutcome: "Revision outcome", durationMinutes: "30", meetingDate: "2026-09-20" },
    fetch: () => response({}) });
  assert.equal(revisedPrepare.form!.fields.audience!.value, "Revision audience");
  assert.equal(revisedPrepare.form!.fields.intendedOutcome!.value, "Revision outcome");
});

test("explicit Cancel preserves a rejected input-triggered cancellation outcome", async () => {
  const storage = new TabStorage();
  let rejectCancel!: (reason: Error) => void;
  const cancelling = new Promise((_resolve, reject) => { rejectCancel = reject; });
  const calls: string[] = [];
  const client = runClient({ csrf: "rejected-shared-cancel", storage,
    form: { audience: "CISO", intendedOutcome: "Original", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: (url) => {
      calls.push(url);
      if (url === "/api/cancel") return cancelling;
      return new Promise(() => undefined);
    } });
  void client.form!.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  client.form!.fields.intendedOutcome!.value = "Latest unchanged form text";
  await client.form!.dispatch("input");
  const explicitCancel = client.cancel.dispatch("click");
  rejectCancel(new Error("Could not confirm cancellation while offline"));
  await explicitCancel;
  assert.deepEqual(calls, ["/api/generate", "/api/cancel"]);
  assert.match(client.status.textContent, /Could not confirm cancellation while offline/);
  assert.doesNotMatch(client.status.textContent, /stopped/i);
  assert.deepEqual(client.writes, []);
  const cached = JSON.parse([...storage.values.values()][0]!) as { intendedOutcome: string };
  assert.equal(cached.intendedOutcome, "Latest unchanged form text");
});

test("direct and repeated Cancel share the barrier before another generation", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  let resolveCancel!: (value: unknown) => void;
  let resolveFirst!: (value: unknown) => void;
  const cancelling = new Promise((resolve) => { resolveCancel = resolve; });
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  let generationCount = 0;
  const client = runClient({ csrf: "direct-cancel-barrier",
    form: { audience: "CISO", intendedOutcome: "First request", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      if (url === "/api/cancel") return cancelling;
      generationCount += 1;
      return generationCount === 1 ? first : response({ error: "retry failed" }, false);
    } });
  const firstSubmit = client.form!.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  const firstCancel = client.cancel.dispatch("click");
  const repeatedCancel = client.cancel.dispatch("click");
  client.form!.fields.audience!.value = "CIO";
  client.form!.fields.intendedOutcome!.value = "Second request after cancellation";
  const secondSubmit = client.form!.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel"], "retry waits and repeated Cancel reuses one operation");
  resolveCancel({ ok: true, json: async () => ({ status: "cancelled" }) });
  await Promise.all([firstCancel, repeatedCancel]);
  await secondSubmit;
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel", "/api/generate"]);
  assert.equal((calls[2]!.body.request as Record<string, unknown>).audience, "CIO");
  assert.equal((calls[2]!.body.request as Record<string, unknown>).intendedOutcome, "Second request after cancellation");
  assert.match(client.status.textContent, /could not be prepared.*inputs are kept/);
  resolveFirst({ ok: true, json: async () => ({ html: "STALE", location: "/?draft=1", history: "push" }) });
  await firstSubmit;
  assert.deepEqual(client.writes, []);
});

test("note save preserves newer typing and no-change revision leaves recovery and draft in place", async () => {
  const storage = new TabStorage();
  storage.values.set('atliera.c3.unsent-form.v1:acc_university_of_utah:note-race', '{"audience":"CISO"}');
  let settle!: (response: unknown) => void;
  const pending = new Promise((resolve) => { settle = resolve; });
  let calls = 0;
  const client = runClient({ csrf: "note-race", storage, recordId: "c3_111111111111111111111111", correctionNote: "Submitted note",
    fetch: () => { calls += 1; return calls === 1 ? pending : response({ noChange: true, status: "No revision requested. Add a correction first." }); } });
  const saving = client.noteForm!.dispatch("submit");
  client.note.value = "Newer typing while save is pending";
  await client.revise.dispatch("click");
  assert.equal(calls, 1, "a concurrent revision cannot supersede an unsettled note action");
  settle({ ok: true, json: async () => ({ status: "Note kept for this session.", savedNote: "Submitted note", noChange: false }) });
  await saving;
  assert.match(client.reviewStatus.textContent, /Newer edits.*still unsaved/);
  assert.deepEqual(client.writes, []);
  assert.equal(client.note.value, "Newer typing while save is pending");
  client.note.value = "";
  await client.revise.dispatch("click");
  assert.equal(calls, 1);
  assert.match(client.reviewStatus.textContent, /No revision requested/);
  assert.deepEqual(client.writes, []);
  assert.deepEqual(client.navigation, []);
  assert.equal(storage.values.size, 1, "a no-op does not clear unsent form recovery");
  assert.equal(client.note.disabled, false);
});

test("native question citations reveal exact evidence and return focus context without replacing a dirty draft", () => {
  const clicks: Array<(event: any) => void> = [];
  const listeners = new Map<string, () => void>();
  let focused = 0;
  let reloads = 0;
  const back = { hidden: true, textContent: "", href: "", setAttribute(_name: string, value: string) { this.href = value; } };
  const target = { open: false, querySelector(selector: string) {
    return selector === 'summary' ? { focus() { focused += 1; } } : selector === '[data-evidence-return]' ? back : null;
  } };
  const note = { value: "Saved note", addEventListener() {} };
  const location = { pathname: "/", search: "?draft=1", hash: "", reload() { reloads += 1; } };
  const document = { querySelector(selector: string) {
    return selector === '#evidence-1' ? target : selector === '[data-correction-note]' ? note : null;
  }, addEventListener(_name: string, callback: (event: any) => void) { clicks.push(callback); } };
  const window = { location, addEventListener(name: string, callback: () => void) { listeners.set(name, callback); } };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { document, window });
  note.value = "Unsaved correction";
  const citation = { id: "cite-question-2-1", getAttribute(name: string) {
    return name === 'href' ? '#evidence-1' : name === 'data-context' ? 'Question 2' : null;
  } };
  for (const callback of clicks) callback({ button: 0, target: { closest() { return citation; } },
    preventDefault() { throw new Error("Native citation navigation must not be prevented"); } });
  assert.equal(target.open, true, "one native click, including keyboard-generated click, reveals the excerpt");
  assert.equal(back.hidden, false);
  assert.equal(back.href, '#cite-question-2-1');
  assert.equal(back.textContent, 'Return to Question 2');
  assert.equal(focused, 1);
  assert.equal(note.value, 'Unsaved correction');
  location.hash = '#evidence-1';
  target.open = false;
  listeners.get('hashchange')!();
  assert.equal(target.open, true, "native fragment Forward or direct fragment entry reveals evidence");
  listeners.get('popstate')!();
  assert.equal(reloads, 0);
});


test("invalid hidden meeting options are revealed without suppressing native validation or editing recovered values", () => {
  const storage = new TabStorage();
  storage.setItem("atliera.c3.unsent-form.v1:acc_university_of_utah:invalid", JSON.stringify({ audience: "CIO", intendedOutcome: "Learn", durationMinutes: 15, meetingDate: "" }));
  const client = runClient({ csrf: "invalid", storage, form: { audience: "CISO", intendedOutcome: "Discuss", durationMinutes: "15", meetingDate: "2026-09-12" }, fetch: () => { throw new Error("No request on invalid input"); } });
  const disclosure = { open: false };
  const listeners = client.form!.listeners.get("invalid") ?? [];
  assert.equal(listeners.length, 1);
  for (const listener of listeners) listener({ target: { closest: () => disclosure }, preventDefault() { throw new Error("Keep native validation"); } } as never);
  assert.equal(disclosure.open, true);
  assert.equal(client.form!.fields.meetingDate!.value, "");
  assert.equal(client.form!.fields.audience!.value, "CIO");
});

test("meeting options summary reflects recovered values and current select/date edits", async () => {
  const storage = new TabStorage();
  storage.setItem("atliera.c3.unsent-form.v1:acc_university_of_utah:summary", JSON.stringify({ audience: "CIO", intendedOutcome: "Learn", durationMinutes: 45, meetingDate: "2026-10-01" }));
  const client = runClient({ csrf: "summary", storage, form: { audience: "CISO", intendedOutcome: "Discuss", durationMinutes: "15", meetingDate: "2026-09-12" }, fetch: () => response({}) });
  assert.equal(client.optionsSummary.textContent, "2026-10-01 · 45 minutes");
  client.form!.fields.durationMinutes!.value = "60";
  await client.form!.dispatch("change");
  assert.equal(client.optionsSummary.textContent, "2026-10-01 · 60 minutes");
  client.form!.fields.meetingDate!.value = "";
  await client.form!.dispatch("input");
  assert.equal(client.optionsSummary.textContent, "Date not set · 60 minutes");
});

test("modal citation keeps dirty notes, targets one excerpt and restores focus and scroll", () => {
  for (const contentSelector of ['[data-evidence-content]', '.research-inspection-body']) {
  const clicks: Array<(event: any) => void> = [];
  const events = new Map<string, () => void>();
  const note = { value: 'Unsaved correction', addEventListener() {} };
  const title = { textContent: '' }; const support = { textContent: '' };
  let cloned: unknown; let focus = false; let scroll: number[] = []; let prevented = false;
  const content = { cloneNode(deep: boolean) { assert.equal(deep, true); return 'exact targeted content'; } };
  const panel = { replaceChildren(value: unknown) { cloned = value; } };
  const dialog = { open: false, scrollTop: 99, showModal() { this.open = true; }, close() { this.open = false; events.get('close')!(); }, addEventListener(name: string, cb: () => void) { events.set(name, cb); }, querySelector(selector: string) { return selector === '[data-evidence-panel-body]' ? panel : selector === '#evidence-panel-title' ? title : selector === '[data-evidence-support]' ? support : null; } };
  const target = { open: false, querySelector(selector: string) { return selector === contentSelector ? content : selector === 'summary' ? { textContent: 'Evidence 1 · Source title' } : null; } };
  const citation = { focus(options: unknown) { assert.deepEqual(JSON.parse(JSON.stringify(options)), { preventScroll: true }); focus = true; }, getAttribute(name: string) { return name === 'href' ? '#evidence-1' : name === 'data-context' ? 'Question 2' : name === 'data-support' ? 'Related evidence context' : null; } };
  const document = { createElement() { return {textContent:'',className:''}; }, body: { style: { overflow: '' } }, querySelector(selector: string) { return selector === '[data-evidence-dialog]' ? dialog : selector === '#evidence-1' ? target : selector === '[data-correction-note]' ? note : null; }, addEventListener(_name: string, cb: (event: any) => void) { clicks.push(cb); } };
  const window = { location: { pathname: '/', search: '?draft=1', hash: '' }, scrollX: 0, scrollY: 640, scrollTo(...args: number[]) { scroll = args; }, addEventListener() {} };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { document, window });
  for (const cb of clicks) cb({ button: 0, target: { closest() { return citation; } }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(dialog.open, true); assert.equal(target.open, false);
  assert.equal(cloned, 'exact targeted content'); assert.equal(support.textContent, 'Related evidence context');
  assert.equal(note.value, 'Unsaved correction'); assert.equal(document.body.style.overflow, 'hidden');
  dialog.close(); assert.equal(focus, true); assert.deepEqual(scroll, [0, 640]); assert.equal(document.body.style.overflow, '');
  }
});
