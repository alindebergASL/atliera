import assert from "node:assert/strict";
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
    return name === "data-record-id" ? this.recordId : null;
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
        '[data-note-form]': noteForm,
        '[data-revise]': options.recordId === undefined ? null : revise,
        '[data-correction-note]': options.recordId === undefined ? null : note,
        '[data-review-status]': options.recordId === undefined ? null : reviewStatus,
        'meta[name="c3-csrf"]': csrfMeta,
        'meta[name="c3-account"]': accountMeta,
      } as Record<string, unknown>)[selector] ?? null;
    },
    open() {},
    write(html: string) { writes.push(html); },
    close() {},
  };
  const window: Record<string, unknown> = { addEventListener() {}, location: { reload() {} } };
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
  return { form, button, cancel, status, recovery, noteForm, revise, reviewStatus, writes, navigation };
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
  assert.equal(calls[1]!.body.intendedOutcome, "");

  const secondSubmit = form.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel"], "new generation waits for cancel settlement");
  resolveCancel({ ok: true, json: async () => ({ status: "cancelled" }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.map((call) => call.url), ["/api/generate", "/api/cancel", "/api/generate"]);
  assert.equal(calls[2]!.body.audience, "CIO and engineering leaders");
  assert.equal(calls[2]!.body.intendedOutcome, "Edited goal while the previous generation is loading");
  await secondSubmit;
  assert.match(client.status.textContent, /Failed to fetch/);
  resolveFirst({ ok: true, json: async () => ({ html: "STALE", location: "/?draft=1", history: "push" }) });
  await firstSubmit;
  assert.deepEqual(client.writes, []);

  const reloaded = runClient({ csrf: "session-a", storage,
    form: { audience: "CIO", intendedOutcome: "", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: async () => { throw new Error("offline"); } });
  assert.equal(reloaded.form!.fields.audience!.value, "CIO and engineering leaders");
  assert.equal(reloaded.form!.fields.intendedOutcome!.value, "Edited goal while the previous generation is loading");
  assert.match(reloaded.recovery.textContent, /only in this tab.*live server session/);
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

test("accepted generation and revision clear stale form recovery before the next Prepare view", async () => {
  const acceptedStorage = new TabStorage();
  const accepted = runClient({ csrf: "accepted-session", storage: acceptedStorage,
    form: { audience: "CISO", intendedOutcome: "Accepted request", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({ html: "DRAFT", location: "/?draft=1", history: "push" }) });
  accepted.form!.fields.audience!.value = "Accepted audience";
  await accepted.form!.dispatch("input");
  await accepted.form!.dispatch("submit");
  assert.deepEqual(accepted.navigation, ["push:/?draft=1"]);
  assert.equal(acceptedStorage.values.size, 0);

  const revisionStorage = new TabStorage();
  const cached = runClient({ csrf: "revision-session", storage: revisionStorage,
    form: { audience: "Old cached audience", intendedOutcome: "Old cached outcome", durationMinutes: "15", meetingDate: "2026-09-12" },
    fetch: () => response({}) });
  await cached.form!.dispatch("input");
  const revision = runClient({ csrf: "revision-session", storage: revisionStorage, recordId: "c3_111111111111111111111111",
    correctionNote: "Revise the displayed draft",
    fetch: () => response({ html: "PREPARE", location: "/?prepare=1", history: "replace" }) });
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
      return response({ html: "UPDATED DRAFT", location: "/?draft=1", history: "replace" });
    } });
  await client.noteForm!.dispatch("submit");
  assert.deepEqual(calls, [{ url: "/api/note", body: {
    note: "Keep the outcome primary.", recordId: "c3_111111111111111111111111" } }]);
  assert.deepEqual(client.navigation, ["replace:/?draft=1"]);
  assert.deepEqual(client.writes, ["UPDATED DRAFT"]);
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
    fetch: () => response({ html: "DRAFT", location: "/?draft=1", history: "push" }) });
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
    fetch: () => response({ html: "DRAFT", location: "/?draft=1", history: "push" }) });
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
    fetch: () => response({ html: "PREPARE", location: "/?prepare=1", history: "replace" }) });
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
  assert.equal(calls[2]!.body.audience, "CIO");
  assert.equal(calls[2]!.body.intendedOutcome, "Second request after cancellation");
  assert.match(client.status.textContent, /retry failed/);
  resolveFirst({ ok: true, json: async () => ({ html: "STALE", location: "/?draft=1", history: "push" }) });
  await firstSubmit;
  assert.deepEqual(client.writes, []);
});
