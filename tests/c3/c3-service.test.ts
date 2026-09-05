import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import type { IncomingMessage, ServerResponse } from "node:http";

import { loadC3AccountContext, type FrozenC3AccountContext } from "../../src/c3/context.ts";
import type { C3ModelRequest } from "../../src/c3/draft.ts";
import { DisabledC3ModelProvider, type C3ModelProvider } from "../../src/c3/provider.ts";
import { C3_CLIENT_SCRIPT } from "../../src/c3/render.ts";
import { startC3Server, type RunningC3Server } from "../../src/c3/service.ts";

const ROOT = process.cwd();
const HOST = "127.0.0.1:4317";
const ORIGIN = `http://${HOST}`;
let contextPromise: Promise<FrozenC3AccountContext> | undefined;
function context() {
  contextPromise ??= loadC3AccountContext({
    broadInputPath: resolve(ROOT, "fixtures/account-intelligence/c2-01/broad-account-research-input.json"),
    proposalPath: resolve(ROOT, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json"),
    ownerDecisionPath: resolve(ROOT, "docs/decisions/c2-owner-disposition-record.json"),
    accountId: "acc_university_of_utah",
  });
  return contextPromise;
}

function candidate(ctx: FrozenC3AccountContext): string {
  const evidence = ctx.context.admittedSources[0]!.excerpts[0]!.evidenceId;
  return JSON.stringify({ temporalOutcome: "no_material_change_established",
    objective: { text: "Learn current priorities and agree a useful follow-up.", evidenceRefs: [], supportCategory: "recommendation" },
    audienceThesis: { text: "The source context suggests a focused learning agenda may be useful.", evidenceRefs: [evidence], supportCategory: "cautious_inference" },
    opening: { text: "Validate the audience's priorities before proposing a plan.", evidenceRefs: [], supportCategory: "recommendation" },
    questions: [
      { question: "What matters most now?", intendedLearning: "Priority order.", evidenceRefs: [], supportCategory: "open_question" },
      { question: "What constraints matter?", intendedLearning: "Relevant constraints.", evidenceRefs: [evidence], supportCategory: "open_question" },
      { question: "What follow-up helps?", intendedLearning: "A useful next step.", evidenceRefs: [], supportCategory: "open_question" },
    ], risksUnknowns: [{ text: "Current audience priorities remain unknown.", evidenceRefs: [], supportCategory: "unknown" }],
    closeCriterion: { text: "Agree whether and how to continue.", evidenceRefs: [], supportCategory: "recommendation" }, selectedEvidenceRefs: [evidence] });
}

class MemoryResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  readonly headers = new Map<string, string | string[]>();
  readonly chunks: Buffer[] = [];
  readonly complete: Promise<void>;
  private resolveComplete!: () => void;
  constructor() {
    super();
    this.complete = new Promise<void>((resolve) => { this.resolveComplete = resolve; });
  }
  setHeader(name: string, value: string | string[]): void { this.headers.set(name.toLowerCase(), value); }
  writeHead(status: number, headers?: Record<string, string | number>): this {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers ?? {})) this.headers.set(name.toLowerCase(), String(value));
    return this;
  }
  end(body?: string | Buffer): this {
    if (body !== undefined) this.chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
    this.writableEnded = true; this.resolveComplete(); return this;
  }
  text(): string { return Buffer.concat(this.chunks).toString("utf8"); }
}

interface ResponseResult { readonly status: number; readonly text: string; readonly headers: ReadonlyMap<string, string | string[]>; }
async function requestTo(running: RunningC3Server, method: string, url: string, body?: unknown,
  headers: Record<string, string> = {}): Promise<ResponseResult> {
  const req = new PassThrough() as PassThrough & { method: string; url: string; headers: Record<string, string> };
  req.method = method; req.url = url; req.headers = { host: HOST, ...headers };
  const res = new MemoryResponse();
  running.server.emit("request", req as unknown as IncomingMessage, res as unknown as ServerResponse);
  req.end(body === undefined ? undefined : JSON.stringify(body));
  await res.complete;
  return { status: res.statusCode, text: res.text(), headers: res.headers };
}

async function browserSession(running: RunningC3Server) {
  const response = await requestTo(running, "GET", "/");
  const setCookie = response.headers.get("set-cookie");
  assert.equal(typeof setCookie, "string");
  const cookie = (setCookie as string).split(";", 1)[0]!;
  const csrf = response.text.match(/name="c3-csrf" content="([^"]+)"/)?.[1];
  assert.ok(csrf);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => requestTo(running, "POST", path, body,
    { cookie, origin: ORIGIN, "x-c3-csrf": csrf, "content-type": "application/json", ...headers });
  return { cookie, csrf, page: response.text, post };
}

const meetingRequest = { audience: "CISO", intendedOutcome: "Understand priorities and agree a next step.", durationMinutes: 15, meetingDate: "2026-09-12" };

async function harness(provider: C3ModelProvider, now?: () => Date) {
  return startC3Server({ context: await context(), provider, now, listen: false, expectedHost: HOST });
}

test("HTTP handler renders discoverable responsive journey and disabled-provider failure preserves inputs", async () => {
  const running = await harness(new DisabledC3ModelProvider(), () => new Date("2026-09-05T00:00:00.000Z"));
  try {
    const browser = await browserSession(running);
    assert.match(browser.page, /Prepare for…/);
    assert.match(browser.page, /Proposed account orientation · not reviewed/);
    assert.match(browser.page, /Related evidence context for this proposed thesis|Direct source support/);
    assert.match(browser.page, /<blockquote>/);
    assert.match(browser.page, /Why this is worth checking/);
    assert.match(browser.page, /Focused next action/);
    assert.ok(browser.page.indexOf('class="hero-actions"') < browser.page.indexOf('class="orientation"'),
      "primary preparation action precedes the longer orientation rationale on narrow screens");
    assert.match(browser.page, /@media\(max-width:700px\)/);
    assert.match(browser.page, /server restart loses it/);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /value="2026-09-12"/);
    assert.match(prepare.text, /Preparing a proposed draft/);
    const failed = await browser.post("/api/generate", meetingRequest);
    assert.equal(failed.status, 502);
    const payload = JSON.parse(failed.text) as { html: string };
    assert.match(payload.html, /value="CISO"/);
    assert.match(payload.html, /Understand priorities and agree a next step/);
    assert.equal(running.status().generationFailed, 1);
    assert.equal(running.status().customerAvailability, "local_prototype_only");
  } finally { await running.close(); }
});

test("successful generation is proposed, source-derived, evidence-linked, and retained across reload", async () => {
  const ctx = await context();
  const running = await harness({ name: "test-deterministic", generate: async () => candidate(ctx) });
  try {
    const browser = await browserSession(running);
    const generated = await browser.post("/api/generate", meetingRequest);
    assert.equal(generated.status, 200);
    const payload = JSON.parse(generated.text) as { html: string };
    assert.match(payload.html, /Proposed · Not reviewed · Not durably saved/);
    assert.match(payload.html, /related evidence context/i);
    assert.match(payload.html, /Selected evidence/);
    assert.doesNotMatch(payload.html, /evidence_[a-f0-9]+/);
    const reloaded = await requestTo(running, "GET", "/", undefined, { cookie: browser.cookie });
    assert.match(reloaded.text, /Meeting draft/);
    assert.equal(running.status().generationSucceeded, 1);
  } finally { await running.close(); }
});

test("invalid model JSON is refused without repair; Host, Origin, session, and CSRF boundaries reject", async () => {
  const running = await harness({ name: "test-invalid", generate: async () => "not json" });
  try {
    const badHost = await requestTo(running, "GET", "/", undefined, { host: "evil.example" });
    assert.equal(badHost.status, 400);
    const browser = await browserSession(running);
    for (const target of ["//[", "//evil.example/path", "http://evil.example/path", "/api//generate", "/\\evil"]) {
      const malformed = await requestTo(running, "GET", target, undefined, { cookie: browser.cookie });
      assert.equal(malformed.status, 400, target);
    }
    assert.equal((await requestTo(running, "GET", "/healthz")).status, 200);
    assert.match((await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie })).text, /Prepare for…/);
    const noOrigin = await requestTo(running, "POST", "/api/generate", meetingRequest,
      { cookie: browser.cookie, "x-c3-csrf": browser.csrf, "content-type": "application/json" });
    assert.equal(noOrigin.status, 403);
    const noCsrf = await requestTo(running, "POST", "/api/generate", meetingRequest,
      { cookie: browser.cookie, origin: ORIGIN, "content-type": "application/json" });
    assert.equal(noCsrf.status, 403);
    const tooLarge = await browser.post("/api/note", { note: "x".repeat(17 * 1024) });
    assert.equal(tooLarge.status, 400);
    const refused = await browser.post("/api/generate", meetingRequest);
    assert.equal(refused.status, 422);
    const payload = JSON.parse(refused.text) as { html: string; refusal: { code: string } };
    assert.equal(payload.refusal.code, "invalid_model_candidate");
    assert.match(payload.html, /Candidate refused without repair/);
    assert.equal(running.status().generationRefused, 1);
  } finally { await running.close(); }
});

test("cancellation signals provider, discards stale completion, and preserves inputs", async () => {
  let sawAbort = false;
  const provider: C3ModelProvider = { name: "test-slow", generate: (_request: C3ModelRequest, signal: AbortSignal) => new Promise((resolve) => {
    signal.addEventListener("abort", () => { sawAbort = true; setTimeout(() => resolve("{}"), 5); }, { once: true });
  }) };
  const running = await harness(provider);
  try {
    const browser = await browserSession(running);
    const pending = browser.post("/api/generate", meetingRequest);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const changedRequest = { ...meetingRequest, audience: "CIO and engineering leaders" };
    const cancelled = await browser.post("/api/cancel", changedRequest);
    assert.equal(cancelled.status, 200);
    assert.equal((await pending).status, 409);
    assert.equal(sawAbort, true);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /value="CIO and engineering leaders"/);
    assert.equal(running.status().generationCancelled, 1);
    assert.equal(running.status().generationSucceeded, 0);
  } finally { await running.close(); }
});

test("explicit cancel preserves bounded partial form text instead of restoring the last valid request", async () => {
  const running = await harness(new DisabledC3ModelProvider());
  try {
    const browser = await browserSession(running);
    await browser.post("/api/generate", meetingRequest);
    const partial = { audience: "", intendedOutcome: "Partially edited outcome", durationMinutes: 15, meetingDate: "2026-09-" };
    const cancelled = await browser.post("/api/cancel", partial);
    assert.equal(cancelled.status, 200);
    const payload = JSON.parse(cancelled.text) as { html: string; status: string };
    assert.match(payload.html, /value="" placeholder="CISO"/);
    assert.match(payload.html, /Partially edited outcome/);
    assert.match(payload.html, /value="2026-09-"/);
    assert.match(payload.status, /Current form text is ready/);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /Partially edited outcome/);
    assert.doesNotMatch(prepare.text, /value="CISO"/);
  } finally { await running.close(); }
});

test("revision sends unsaved correction plus exact prior raw/draft identity and changes model-request identity", async () => {
  const ctx = await context();
  const captured: C3ModelRequest[] = [];
  const running = await harness({ name: "capture-only", generate: async (request) => { captured.push(request); return candidate(ctx); } });
  try {
    const browser = await browserSession(running);
    assert.equal((await browser.post("/api/generate", meetingRequest)).status, 200);
    const note = "Unsaved textarea correction: lead with ownership, preserve the funding caveat.";
    const revision = await browser.post("/api/revise", { note });
    assert.equal(revision.status, 200);
    assert.match((JSON.parse(revision.text) as { html: string }).html, /Revision 1 will include/);
    assert.equal((await browser.post("/api/generate", meetingRequest)).status, 200);
    assert.equal(captured.length, 2);
    assert.equal(captured[0]!.revision, null);
    assert.equal(captured[1]!.revision?.correctionNote, note);
    assert.equal(captured[1]!.revision?.priorRawResponse, candidate(ctx));
    assert.ok(captured[1]!.revision?.priorDraft);
    assert.notEqual(captured[0]!.revisionSha256, captured[1]!.revisionSha256);
    assert.notEqual(JSON.stringify(captured[0]), JSON.stringify(captured[1]));
    assert.equal(captured[1]!.contextSha256, captured[0]!.contextSha256);
    assert.equal(captured[1]!.revision?.changesAccountTruth, false);
    assert.equal(captured[1]!.revision?.impliesApprovalOrPersistence, false);
  } finally { await running.close(); }
});

test("rendered client restores edited in-flight form, ignores stale HTML, and confines requests to fixed same-origin POST routes", async () => {
  type Listener = (event: any) => unknown;
  class Element {
    readonly listeners = new Map<string, Listener[]>();
    textContent = ""; disabled = false; value = "";
    constructor(readonly values: Record<string, unknown> = {}) {}
    addEventListener(name: string, listener: Listener): void { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
    async dispatch(name: string): Promise<void> { for (const listener of this.listeners.get(name) ?? []) await listener({ preventDefault() {}, currentTarget: this }); }
    querySelector(selector: string): unknown { return selector === 'button[type="submit"]' ? button : null; }
    getAttribute(name: string): string | null { return name === "content" ? "csrf" : null; }
  }
  const form = new Element({ audience: "CISO", intendedOutcome: "First outcome", durationMinutes: "15", meetingDate: "2026-09-12" });
  const button = new Element(); const cancel = new Element(); const status = new Element(); const meta = new Element();
  const writes: string[] = []; const calls: { url: string; method: string }[] = [];
  let resolveGeneration!: (value: unknown) => void;
  const generation = new Promise((resolve) => { resolveGeneration = resolve; });
  const document = {
    querySelector(selector: string): unknown {
      return ({ '[data-generate]': form, '[data-cancel]': cancel, '[data-status]': status,
        'meta[name="c3-csrf"]': meta } as Record<string, unknown>)[selector] ?? null;
    },
    open() {}, write(html: string) { writes.push(html); }, close() {},
  };
  class FormDataStub { constructor(private readonly element: Element) {} get(name: string): unknown { return this.element.values[name]; } }
  let failCancel = false;
  const fetchStub = async (url: string, init: { method: string }): Promise<any> => {
    calls.push({ url, method: init.method });
    if (url === "/api/generate") return generation;
    if (url === "/api/cancel") {
      if (failCancel) throw new Error("cancel network unavailable");
      return { ok: true, json: async () => ({ status: "Ready with edited inputs." }) };
    }
    throw new Error("unexpected route");
  };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { document, FormData: FormDataStub, fetch: fetchStub, AbortController, Error, JSON, Number });
  const submitting = form.dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  form.values.audience = "CIO and engineering leaders";
  await form.dispatch("input");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /Ready with edited inputs/);
  resolveGeneration({ ok: true, json: async () => ({ html: "STALE PAGE" }) });
  await submitting;
  assert.deepEqual(writes, []);
  assert.deepEqual(calls, [{ url: "/api/generate", method: "POST" }, { url: "/api/cancel", method: "POST" }]);
  assert.ok(calls.every((call) => call.url.startsWith("/api/") && !call.url.startsWith("//") && call.method === "POST"));

  form.values.audience = ""; form.values.meetingDate = "2026-09-";
  await cancel.dispatch("click");
  assert.equal(writes.length, 0);
  assert.equal(button.disabled, false);
  failCancel = true;
  await cancel.dispatch("click");
  assert.match(status.textContent, /cancel network unavailable/);
});

test("rendered review handlers surface note and revise network errors and revise with current textarea text", async () => {
  type Listener = (event: any) => unknown;
  class Element {
    readonly listeners = new Map<string, Listener[]>(); textContent = ""; value = "Current unsaved correction";
    addEventListener(name: string, listener: Listener): void { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
    async dispatch(name: string): Promise<void> { for (const listener of this.listeners.get(name) ?? []) await listener({ preventDefault() {}, currentTarget: this }); }
    getAttribute(name: string): string | null { return name === "content" ? "csrf" : null; }
  }
  const noteForm = new Element(); const revise = new Element(); const note = new Element(); const reviewStatus = new Element(); const meta = new Element();
  class FormDataStub { get(name: string): unknown { return name === "note" ? note.value : null; } }
  const calls: { url: string; body: string }[] = [];
  const document = { querySelector(selector: string): unknown { return ({ '[data-note-form]': noteForm, '[data-revise]': revise,
    '[data-correction-note]': note, '[data-review-status]': reviewStatus, 'meta[name="c3-csrf"]': meta } as Record<string, unknown>)[selector] ?? null; },
    open() {}, write() {}, close() {} };
  const fetchStub = async (url: string, init: { body: string }): Promise<never> => { calls.push({ url, body: init.body }); throw new Error(`${url} network unavailable`); };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { document, FormData: FormDataStub, fetch: fetchStub, AbortController, Error, JSON, Number });
  await noteForm.dispatch("submit");
  assert.match(reviewStatus.textContent, /\/api\/note network unavailable/);
  await revise.dispatch("click");
  assert.match(reviewStatus.textContent, /\/api\/revise network unavailable/);
  assert.deepEqual(JSON.parse(calls[1]!.body), { note: "Current unsaved correction" });
});

test("server shutdown waits for active provider abort cleanup", async () => {
  let cleanupFinished = false;
  const running = await harness({ name: "shutdown-aware", generate: (_request, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => setTimeout(() => { cleanupFinished = true; reject(new Error("local cleanup complete")); }, 30), { once: true });
  }) });
  const browser = await browserSession(running);
  const pending = browser.post("/api/generate", meetingRequest);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const started = Date.now();
  await running.close();
  assert.equal(cleanupFinished, true);
  assert.ok(Date.now() - started >= 25);
  assert.equal((await pending).status, 409);
});
