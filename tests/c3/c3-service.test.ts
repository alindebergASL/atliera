import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import type { IncomingMessage, ServerResponse } from "node:http";

import { loadC3AccountContext, type FrozenC3AccountContext } from "../../src/c3/context.ts";
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, type C3ModelRequest } from "../../src/c3/draft.ts";
import { DisabledC3ModelProvider, RecordedReplayC3ModelProvider, type C3ModelProvider } from "../../src/c3/provider.ts";
import { C3_CLIENT_SCRIPT, renderC3Page } from "../../src/c3/render.ts";
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
  req.end(body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body));
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

function pendingRevisionToken(html: string): string {
  const token = html.match(/data-pending-revision-token="([A-Za-z0-9_-]{32})"/)?.[1];
  assert.ok(token);
  return token;
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
    assert.doesNotMatch(browser.page, /Private candidate preview|Recorded responses|No live generation/);
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

test("recorded mode prefills exact request, labels every page, preserves notes, and replays unchanged prior and revision IDs", async () => {
  const ctx = await context();
  const initialRequest = { audience: "CIO and engineering leaders", intendedOutcome: "Understand priorities and agree a useful next step",
    durationMinutes: 15 as const, meetingDate: "2026-09-12" };
  const correctionNote = "Recorded correction: keep the exact prior identity and allow no follow-up.";
  const priorRequest = createC3ModelRequest(ctx, initialRequest);
  const priorRaw = candidate(ctx);
  const priorRecord = createGenerationRecord(priorRequest, priorRaw, ctx);
  assert.equal(priorRecord.outcome, "succeeded");
  const revisionContext = createC3RevisionContext(priorRecord, correctionNote, 1);
  const revisionRequest = createC3ModelRequest(ctx, initialRequest, revisionContext);
  const revisionRaw = candidate(ctx);
  const revisionRecord = createGenerationRecord(revisionRequest, revisionRaw, ctx);
  assert.equal(revisionRecord.outcome, "succeeded");
  const provider = new RecordedReplayC3ModelProvider([
    { request: priorRequest, rawResponse: priorRaw }, { request: revisionRequest, rawResponse: revisionRaw },
  ]);
  const running = await startC3Server({ context: ctx, provider, listen: false, expectedHost: HOST,
    now: () => new Date("2031-01-01T00:00:00.000Z"), recordedReplay: { initialRequest, correctionNote } });
  try {
    const browser = await browserSession(running);
    assert.match(browser.page, /Private candidate preview · Recorded responses · No live generation/);
    assert.match(browser.page, /Unmerged and proposed.*Session-only; no approval or durable save/);
    assert.match(browser.page, />Open exact recorded replay</);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /Private candidate preview · Recorded responses · No live generation/);
    assert.match(prepare.text, /value="CIO and engineering leaders"/);
    assert.match(prepare.text, /Understand priorities and agree a useful next step/);
    assert.match(prepare.text, /value="15" selected/);
    assert.match(prepare.text, /value="2026-09-12"/);
    assert.doesNotMatch(prepare.text, /2031-01-08/);
    assert.match(prepare.text, />Replay exact recorded response</);
    assert.match(prepare.text, /data-use-recorded-request[^>]* hidden>Use recorded request/);
    assert.match(prepare.text, /not live model timing|not live provider timing/);

    const generated = await browser.post("/api/generate", initialRequest);
    assert.equal(generated.status, 200);
    const priorHtml = (JSON.parse(generated.text) as { html: string }).html;
    assert.match(priorHtml, /Private candidate preview · Recorded responses · No live generation/);
    assert.match(priorHtml, new RegExp(`data-record-id="${priorRecord.recordId}"`));
    assert.match(priorHtml, /Exact correction available for the recorded revision/);
    assert.match(priorHtml, /data-use-recorded-note>Use exact recorded correction/);
    assert.match(priorHtml, /Recorded correction: keep the exact prior identity and allow no follow-up\./);
    assert.equal(priorHtml.match(/Recorded initial — before correction\./gu)?.length, 1);
    assert.ok(priorHtml.indexOf("Recorded initial — before correction.") < priorHtml.indexOf('class="draft-grid"'));
    assert.match(C3_CLIENT_SCRIPT, /Exact recorded correction copied into the textarea/);

    const arbitrary = "Arbitrary owner note stays a note and has no matching recorded result.";
    const kept = await browser.post("/api/note", { note: arbitrary, recordId: priorRecord.recordId });
    assert.equal(kept.status, 200);
    assert.match((JSON.parse(kept.text) as { html: string }).html, new RegExp(arbitrary));
    const revised = await browser.post("/api/revise", { note: correctionNote, recordId: priorRecord.recordId });
    assert.equal(revised.status, 200);
    const revisionPrepare = (JSON.parse(revised.text) as { html: string }).html;
    assert.match(revisionPrepare, /Revision 1 will include the exact session correction and prior raw\/draft identity/);
    assert.match(revisionPrepare, />Replay exact recorded response</);
    const regenerated = await browser.post("/api/generate", initialRequest);
    assert.equal(regenerated.status, 200);
    const revisionHtml = (JSON.parse(regenerated.text) as { html: string }).html;
    assert.match(revisionHtml, new RegExp(`data-record-id="${revisionRecord.recordId}"`));
    assert.match(revisionHtml, /Recorded revision.*No further recorded response exists/);
    assert.equal(running.status().provider, "recorded-replay");
    assert.equal(running.status().generationSucceeded, 2);

    const editedBrowser = await browserSession(running);
    const edited = await editedBrowser.post("/api/generate", { ...initialRequest, audience: "CISO" });
    assert.equal(edited.status, 502);
    const failure = JSON.parse(edited.text) as { error: string; html: string };
    assert.match(failure.error, /Recorded replay refused: no response matches this exact request/);
    assert.match(failure.error, /no live generation was attempted/);
    assert.match(failure.html, /value="CISO"/);
    assert.match(failure.html, /data-use-recorded-request[^>]*>Use recorded request/);
    assert.doesNotMatch(failure.html, /data-use-recorded-request[^>]* hidden/);
    assert.equal(running.status().generationFailed, 1);

    const arbitraryBrowser = await browserSession(running);
    const arbitraryInitial = await arbitraryBrowser.post("/api/generate", initialRequest);
    const arbitraryId = (JSON.parse(arbitraryInitial.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.equal(arbitraryId, priorRecord.recordId);
    const unmatchedNote = "Keep this arbitrary owner note exactly; do not substitute the recorded correction.";
    const unmatchedRevision = await arbitraryBrowser.post("/api/revise", { note: unmatchedNote, recordId: arbitraryId });
    const unmatchedPrepare = (JSON.parse(unmatchedRevision.text) as { html: string }).html;
    assert.match(unmatchedPrepare, /Revision pending — previous draft preserved/);
    assert.match(unmatchedPrepare, new RegExp(unmatchedNote));
    const unmatchedReplay = await arbitraryBrowser.post("/api/generate", initialRequest);
    assert.equal(unmatchedReplay.status, 502);
    assert.match((JSON.parse(unmatchedReplay.text) as { html: string }).html, new RegExp(unmatchedNote));

    const retryBrowser = await browserSession(running);
    const retryInitial = await retryBrowser.post("/api/generate", initialRequest);
    const retryInitialId = (JSON.parse(retryInitial.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.equal(retryInitialId, priorRecord.recordId);
    assert.equal((await retryBrowser.post("/api/revise", { note: "Discard this unmatched preparation", recordId: retryInitialId })).status, 200);
    const pendingA = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: retryBrowser.cookie });
    const tokenA = pendingRevisionToken(pendingA.text);
    assert.equal((await retryBrowser.post("/api/discard-revision", { recordId: retryInitialId, pendingRevisionToken: tokenA })).status, 200);
    const exactRetry = await retryBrowser.post("/api/revise", { note: correctionNote, recordId: retryInitialId });
    assert.match((JSON.parse(exactRetry.text) as { html: string }).html, /Revision 1 will include/);
    const pendingB = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: retryBrowser.cookie });
    const tokenB = pendingRevisionToken(pendingB.text);
    assert.notEqual(tokenB, tokenA);
    assert.equal((await retryBrowser.post("/api/discard-revision", { recordId: retryInitialId, pendingRevisionToken: tokenA })).status, 409);
    const retainedB = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: retryBrowser.cookie });
    assert.equal(pendingRevisionToken(retainedB.text), tokenB);
    assert.equal((await retryBrowser.post("/api/discard-revision", { recordId: retryInitialId, pendingRevisionToken: tokenB })).status, 200);
    assert.equal((await retryBrowser.post("/api/revise", { note: correctionNote, recordId: retryInitialId })).status, 200);
    const retriedRevision = await retryBrowser.post("/api/generate", initialRequest);
    assert.equal(retriedRevision.status, 200);
    const retriedHtml = (JSON.parse(retriedRevision.text) as { html: string }).html;
    assert.match(retriedHtml, new RegExp(`data-record-id="${revisionRecord.recordId}"`));
    const nextRevision = await retryBrowser.post("/api/revise", { note: "Next successful lineage", recordId: revisionRecord.recordId });
    assert.equal(nextRevision.status, 200);
    assert.match((JSON.parse(nextRevision.text) as { html: string }).html, /Revision 2 will include/);
  } finally { await running.close(); }
});

test("selected hiring evidence shows only its admitted preceding same-source Responsible AI heading", async () => {
  const ctx = await context();
  const base = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), candidate(ctx), ctx);
  assert.equal(base.outcome, "succeeded");
  const selectedId = "evidence_2e20762caf4b11701059";
  const record = { ...base, draft: { ...base.draft!, selectedEvidenceRefs: [selectedId] } };
  const rendered = renderC3Page(ctx, { page: "draft", record, correctionNote: "" }, "csrf");
  const selectedExcerpt = ctx.context.admittedSources.flatMap((source) => source.excerpts)
    .find((excerpt) => excerpt.evidenceId === selectedId)!.exactExcerpt;
  assert.match(rendered, /Source section:<\/strong> Responsible AI/);
  assert.match(rendered, /Heading evidence evidence_c0bc6cf74d035bc8e08a/);
  assert.ok(rendered.includes(`<blockquote>${selectedExcerpt}</blockquote>`), "the admitted selected excerpt remains untouched");
  assert.ok(rendered.indexOf("Source section:") < rendered.indexOf("Faculty hiring runs ~12 months"));

  for (const mutation of ["missing", "later", "different-source"] as const) {
    const changed = structuredClone(ctx) as unknown as { context: FrozenC3AccountContext["context"] };
    const source = changed.context.admittedSources.find((item) => item.excerpts.some((excerpt) => excerpt.evidenceId === selectedId))!;
    const headingIndex = source.excerpts.findIndex((excerpt) => excerpt.evidenceId === "evidence_c0bc6cf74d035bc8e08a");
    const heading = source.excerpts[headingIndex]!;
    if (mutation === "missing") (source.excerpts as unknown as Array<typeof heading>).splice(headingIndex, 1);
    else (source.excerpts as unknown as Array<typeof heading>)[headingIndex] = { ...heading,
      ...(mutation === "later" ? { sourceCharStart: 999 } : { sourceId: "source_different" }) };
    const negative = renderC3Page(changed as FrozenC3AccountContext, { page: "draft", record, correctionNote: "" }, "csrf");
    assert.doesNotMatch(negative, /Source section:<\/strong> Responsible AI/, mutation);
  }
});

test("draft hierarchy preserves generated question text and separates only a literal optional probe", async () => {
  const ctx = await context();
  const base = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), candidate(ctx), ctx);
  assert.equal(base.outcome, "succeeded");
  const exactQuestion = "Which outcome matters, without changing these exact words?";
  const exactPrefix = "Establish the selected outcome’s current owner or binding constraint while keeping initiative, university, health-enterprise, and statewide boundaries distinct. ";
  const exactSuffix = "Optional probe: If Responsible AI talent capacity is relevant to the selected outcome, ask whether the June 11, 2026 Year Two report’s adaptation to one-time AI teaching and productivity tools while faculty hiring ran about 12 months is a pattern that matters now.";
  const exactLearning = exactPrefix + exactSuffix;
  const record = { ...base, draft: { ...base.draft!, questions: base.draft!.questions.map((question, index) => index === 0
    ? { ...question, question: exactQuestion, intendedLearning: exactLearning } : question) } };
  const rendered = renderC3Page(ctx, { page: "draft", record, correctionNote: "" }, "csrf");
  assert.match(rendered, /<span class="question-kind">Must ask<\/span>/);
  assert.ok(rendered.includes(`<strong>${exactQuestion}</strong>`));
  assert.ok(rendered.includes(`Learn: ${exactPrefix}</p>`));
  assert.ok(rendered.includes(`<p>${exactSuffix}</p>`));
  assert.equal(rendered.match(/Optional probe — only if relevant/gu)?.length, 1);
  assert.match(rendered, /<details class="technical-detail"><summary>Evidence basis<\/summary>/);
});

test("successful generation is proposed, source-derived, evidence-linked, and retained across reload", async () => {
  const ctx = await context();
  const running = await harness({ name: "test-deterministic", generate: async () => candidate(ctx) });
  try {
    const browser = await browserSession(running);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.equal(prepare.status, 200);
    assert.match(prepare.text, /Prepare for…/);
    const generated = await browser.post("/api/generate", meetingRequest);
    assert.equal(generated.status, 200);
    const payload = JSON.parse(generated.text) as { html: string; location: string; history: string };
    assert.match(payload.html, /Proposed · Not reviewed · Not durably saved/);
    assert.match(payload.html, /related evidence context/i);
    assert.match(payload.html, /Selected evidence/);
    assert.doesNotMatch(payload.html, /evidence_[a-f0-9]+/);
    assert.deepEqual({ location: payload.location, history: payload.history }, { location: "/?draft=1", history: "push" });
    const reloaded = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(reloaded.text, /Meeting draft/);
    const home = await requestTo(running, "GET", "/", undefined, { cookie: browser.cookie });
    assert.match(home.text, /Account Home/);
    assert.doesNotMatch(home.text, /Meeting draft/);
    assert.match(home.text, /href="\/\?draft=1"[^>]*>Reopen session draft/);
    assert.equal(running.status().generationSucceeded, 1);
  } finally { await running.close(); }
});

test("two local service ports retain independent browser-jar sessions and a restart invalidates only its session", async () => {
  const ctx = await context();
  const provider: C3ModelProvider = { name: "shared-browser-jar", generate: async () => candidate(ctx) };
  const cookieJar = new Map<string, string>();
  const cookieHeader = (): string => [...cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");
  const rememberCookie = (response: ResponseResult): void => {
    const setCookie = response.headers.get("set-cookie");
    assert.equal(typeof setCookie, "string");
    assert.match(setCookie as string, /; HttpOnly; SameSite=Strict; Path=\/$/u);
    const pair = (setCookie as string).split(";", 1)[0]!;
    const separator = pair.indexOf("=");
    assert.ok(separator > 0);
    cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1));
  };
  const get = async (running: RunningC3Server, path: string): Promise<ResponseResult> => requestTo(running, "GET", path, undefined,
    { host: new URL(running.origin).host, ...(cookieJar.size === 0 ? {} : { cookie: cookieHeader() }) });
  const post = async (running: RunningC3Server, csrf: string, path: string, body: unknown): Promise<ResponseResult> => requestTo(running, "POST", path, body,
    { host: new URL(running.origin).host, cookie: cookieHeader(), origin: running.origin,
      "x-c3-csrf": csrf, "content-type": "application/json" });
  const start = (expectedHost: string) => startC3Server({ context: ctx, provider, listen: false, expectedHost });

  let first = await start("127.0.0.1:4317");
  const second = await start("127.0.0.1:4318");
  try {
    const firstHome = await get(first, "/");
    rememberCookie(firstHome);
    const firstCsrf = firstHome.text.match(/name="c3-csrf" content="([^"]+)"/)?.[1];
    assert.ok(firstCsrf);
    const firstGenerated = await post(first, firstCsrf, "/api/generate", meetingRequest);
    const firstRecordId = (JSON.parse(firstGenerated.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(firstRecordId);
    assert.equal((await post(first, firstCsrf, "/api/note", { note: "Port 4317 correction", recordId: firstRecordId })).status, 200);

    const secondHome = await get(second, "/");
    rememberCookie(secondHome);
    const secondCsrf = secondHome.text.match(/name="c3-csrf" content="([^"]+)"/)?.[1];
    assert.ok(secondCsrf);
    const secondGenerated = await post(second, secondCsrf, "/api/generate", { ...meetingRequest, audience: "CIO" });
    const secondRecordId = (JSON.parse(secondGenerated.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(secondRecordId);
    assert.equal((await post(second, secondCsrf, "/api/note", { note: "Port 4318 correction", recordId: secondRecordId })).status, 200);

    assert.equal(cookieJar.size, 2, "the browser jar keeps one host cookie name per bound service port");
    assert.ok([...cookieJar.keys()].every((name) => /^c3sid_[0-9]+$/u.test(name)));
    const firstDraft = await get(first, "/?draft=1");
    const secondDraft = await get(second, "/?draft=1");
    assert.equal(firstDraft.status, 200);
    assert.match(firstDraft.text, /Port 4317 correction/);
    assert.doesNotMatch(firstDraft.text, /Port 4318 correction/);
    assert.equal(secondDraft.status, 200);
    assert.match(secondDraft.text, /Port 4318 correction/);
    assert.doesNotMatch(secondDraft.text, /Port 4317 correction/);

    await first.close();
    first = await start("127.0.0.1:4317");
    const invalidated = await get(first, "/?draft=1");
    rememberCookie(invalidated);
    assert.equal(invalidated.status, 409);
    assert.match(invalidated.text, /No session draft is available/);
    assert.equal((await get(second, "/?draft=1")).status, 200, "restarting one service does not clear the other service's memory");
  } finally {
    await first.close();
    await second.close();
  }
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

test("HTTP JSON decoding is fatal UTF-8 and malformed bytes do not reach the provider", async () => {
  let calls = 0;
  const running = await harness({ name: "must-not-run", generate: async () => { calls += 1; return "{}"; } });
  try {
    const browser = await browserSession(running);
    const malformed = Buffer.concat([Buffer.from('{"audience":"'), Buffer.from([0xff]), Buffer.from('","intendedOutcome":"Learn priorities","durationMinutes":15,"meetingDate":"2026-09-12"}')]);
    const response = await requestTo(running, "POST", "/api/generate", malformed,
      { cookie: browser.cookie, origin: ORIGIN, "x-c3-csrf": browser.csrf, "content-type": "application/json" });
    assert.equal(response.status, 400);
    assert.match(response.text, /invalid JSON body/);
    assert.equal(calls, 0);
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
    const generated = await browser.post("/api/generate", meetingRequest);
    assert.equal(generated.status, 200);
    const recordId = (JSON.parse(generated.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(recordId);
    const note = "Unsaved textarea correction: lead with ownership, preserve the funding caveat.";
    const revision = await browser.post("/api/revise", { note, recordId });
    assert.equal(revision.status, 200);
    const revisionPayload = JSON.parse(revision.text) as { html: string; location: string; history: string };
    assert.match(revisionPayload.html, /Revision 1 will include/);
    assert.deepEqual({ location: revisionPayload.location, history: revisionPayload.history }, { location: "/?prepare=1", history: "replace" });
    const preservedDraft = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.equal(preservedDraft.status, 200);
    assert.match(preservedDraft.text, new RegExp(`data-record-id="${recordId}"`));
    assert.match(preservedDraft.text, /Revision pending.*preserved previous draft/s);
    assert.match(preservedDraft.text, /\.review \.warning\{color:var\(--ink\)\}/,
      "pending warning explicitly overrides the review panel's white foreground");
    assert.match(preservedDraft.text, /Discard pending revision and return to previous draft/);
    assert.match(preservedDraft.text, /<textarea[^>]* disabled>/);
    assert.match(preservedDraft.text, /<button type="submit" disabled>Keep note for this session<\/button>/);
    assert.match(preservedDraft.text, /data-revise disabled>Request revised draft<\/button>/);
    assert.doesNotMatch(preservedDraft.text, /data-discard-revision[^>]* disabled/);
    assert.equal((await browser.post("/api/note", { note: "stale note", recordId })).status, 409);
    assert.equal((await browser.post("/api/revise", { note: "second pending revision", recordId })).status, 409);
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

test("failed or refused revision preserves the prior record until explicit record-bound discard", async () => {
  const ctx = await context();
  for (const outcome of ["failed", "refused"] as const) {
    let calls = 0;
    const running = await harness({ name: `revision-${outcome}`, generate: async () => {
      calls += 1;
      if (calls === 1) return candidate(ctx);
      if (outcome === "failed") throw new Error("provider failed deterministically");
      return "not json";
    } });
    try {
      const browser = await browserSession(running);
      const initial = await browser.post("/api/generate", meetingRequest);
      const recordId = (JSON.parse(initial.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
      assert.ok(recordId);
      assert.equal((await browser.post("/api/revise", { note: `Exact ${outcome} correction`, recordId })).status, 200);
      const replacement = await browser.post("/api/generate", meetingRequest);
      assert.equal(replacement.status, outcome === "failed" ? 502 : 422);
      const preserved = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
      assert.equal(preserved.status, 200);
      assert.match(preserved.text, new RegExp(`data-record-id="${recordId}"`));
      assert.match(preserved.text, /Revision pending/);
      const token = pendingRevisionToken(preserved.text);
      assert.equal((await browser.post("/api/discard-revision", { recordId: "c3_000000000000000000000000", pendingRevisionToken: token })).status, 409);
      assert.equal((await browser.post("/api/discard-revision", { recordId })).status, 409);
      const discarded = await browser.post("/api/discard-revision", { recordId, pendingRevisionToken: token });
      assert.equal(discarded.status, 200);
      assert.doesNotMatch((JSON.parse(discarded.text) as { html: string }).html, /Revision pending/);
      assert.equal((await browser.post("/api/note", { note: "Previous draft usable again", recordId })).status, 200);
    } finally { await running.close(); }
  }
});

test("cancelling a pending revision stops generation without discarding the revision or prior record", async () => {
  const ctx = await context();
  let calls = 0;
  const running = await harness({ name: "cancel-revision", generate: async (_request, signal) => {
    calls += 1;
    if (calls === 1) return candidate(ctx);
    return new Promise<string>((resolve) => signal.addEventListener("abort", () => resolve("{}"), { once: true }));
  } });
  try {
    const browser = await browserSession(running);
    const initial = await browser.post("/api/generate", meetingRequest);
    const recordId = (JSON.parse(initial.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(recordId);
    assert.equal((await browser.post("/api/revise", { note: "Cancelled exact correction", recordId })).status, 200);
    const pending = browser.post("/api/generate", meetingRequest);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await browser.post("/api/cancel", meetingRequest)).status, 200);
    assert.equal((await pending).status, 409);
    const preserved = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.equal(preserved.status, 200);
    assert.match(preserved.text, new RegExp(`data-record-id="${recordId}"`));
    assert.match(preserved.text, /Revision pending/);
  } finally { await running.close(); }
});

test("note and revise actions are bound to the displayed record and stale tabs cannot alter a newer draft", async () => {
  const ctx = await context();
  const captured: C3ModelRequest[] = [];
  const running = await harness({ name: "capture-record-binding", generate: async (request) => { captured.push(request); return candidate(ctx); } });
  try {
    const browser = await browserSession(running);
    const first = await browser.post("/api/generate", meetingRequest);
    const firstId = (JSON.parse(first.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(firstId);
    assert.equal((await browser.post("/api/note", { note: "Correction only for CISO draft A", recordId: firstId })).status, 200);
    const secondRequest = { ...meetingRequest, audience: "CIO and engineering leaders" };
    const second = await browser.post("/api/generate", secondRequest);
    const secondHtml = (JSON.parse(second.text) as { html: string }).html;
    const secondId = secondHtml.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(secondId);
    assert.notEqual(secondId, firstId);
    assert.doesNotMatch(secondHtml, /Correction only for CISO draft A/);

    for (const path of ["/api/note", "/api/revise"]) {
      const missing = await browser.post(path, { note: "Old-tab correction" });
      assert.equal(missing.status, 409, `${path} missing identity`);
      assert.match(missing.text, /displayed draft identity is missing or stale/i);
      const stale = await browser.post(path, { note: "Old-tab correction", recordId: firstId });
      assert.equal(stale.status, 409, `${path} stale identity`);
      assert.match(stale.text, /displayed draft identity is missing or stale/i);
    }
    const latest = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(latest.text, new RegExp(`data-record-id="${secondId}"`));
    assert.doesNotMatch(latest.text, /Old-tab correction/);
    assert.equal(captured.length, 2);

    const note = await browser.post("/api/note", { note: "Correction for visible CIO draft", recordId: secondId });
    assert.equal(note.status, 200);
    assert.match((JSON.parse(note.text) as { html: string }).html, /Correction for visible CIO draft/);
    const revise = await browser.post("/api/revise", { note: "Revise visible CIO draft", recordId: secondId });
    assert.equal(revise.status, 200);
    assert.equal((await browser.post("/api/generate", secondRequest)).status, 200);
    assert.equal(captured[2]!.meetingRequest.audience, "CIO and engineering leaders");
    assert.equal(captured[2]!.revision?.priorRecordId, secondId);
    assert.equal(captured[2]!.revision?.correctionNote, "Revise visible CIO draft");
  } finally { await running.close(); }
});

test("a displayed old draft cannot abort a newer generation in another tab", async () => {
  const ctx = await context();
  let calls = 0;
  let resolveSecond!: (value: string) => void;
  let secondAborted = false;
  const running = await harness({ name: "record-binding-during-generation", generate: async (_request, signal) => {
    calls += 1;
    if (calls === 1) return candidate(ctx);
    signal.addEventListener("abort", () => { secondAborted = true; }, { once: true });
    return new Promise<string>((resolve) => { resolveSecond = resolve; });
  } });
  try {
    const browser = await browserSession(running);
    const first = await browser.post("/api/generate", meetingRequest);
    const firstId = (JSON.parse(first.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.ok(firstId);
    const secondRequest = { ...meetingRequest, audience: "CIO and engineering leaders" };
    const pending = browser.post("/api/generate", secondRequest);
    await new Promise((resolve) => setImmediate(resolve));
    const staleRevision = await browser.post("/api/revise", { note: "Do not target unseen content", recordId: firstId });
    assert.equal(staleRevision.status, 409);
    assert.match(staleRevision.text, /missing or stale/i);
    assert.equal(secondAborted, false);
    resolveSecond(candidate(ctx));
    assert.equal((await pending).status, 200);
    assert.equal(secondAborted, false);
    const latest = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(latest.text, /data-record-id="c3_/);
    assert.doesNotMatch(latest.text, /Do not target unseen content/);
  } finally { await running.close(); }
});

test("client history ignores evidence fragments and requires an explicit decision before dirty-note route loss", () => {
  const listeners = new Map<string, Array<(event?: { preventDefault(): void; returnValue?: string }) => void>>();
  let reloads = 0;
  let confirms = 0;
  let approve = false;
  const pushed: string[] = [];
  const noteListeners = new Map<string, Array<() => void>>();
  const note = { value: "Unsaved correction remains in the textarea",
    addEventListener(name: string, listener: () => void) { noteListeners.set(name, [...(noteListeners.get(name) ?? []), listener]); },
    dispatch(name: string) { for (const listener of noteListeners.get(name) ?? []) listener(); } };
  const location = { pathname: "/", search: "?draft=1", hash: "", reload() { reloads += 1; } };
  const window: Record<string, unknown> = { addEventListener(name: string, listener: () => void) {
    listeners.set(name, [...(listeners.get(name) ?? []), listener]);
  }, removeEventListener(name: string, listener: () => void) {
    listeners.set(name, (listeners.get(name) ?? []).filter((candidate) => candidate !== listener));
  }, confirm() { confirms += 1; return approve; }, location };
  const history = { pushState(_state: unknown, _title: string, path: string) { pushed.push(path); location.search = path.slice(1); } };
  const documentListeners = new Map<string, Array<(event: any) => void>>();
  const document = { activeElement: note,
    querySelector: (selector: string) => selector === "[data-correction-note]" ? note : null,
    addEventListener(name: string, listener: (event: any) => void) {
      documentListeners.set(name, [...(documentListeners.get(name) ?? []), listener]);
    } };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window, document, history });
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window, document, history });
  assert.equal(listeners.get("popstate")?.length, 1, "document.write script execution does not multiply the route listener");

  location.hash = "#evidence-1";
  assert.equal(reloads, 0, "a native evidence link does not reload the document");
  location.hash = "";
  listeners.get("popstate")![0]!();
  location.hash = "#evidence-1";
  listeners.get("popstate")![0]!();
  assert.equal(reloads, 0, "Back/Forward within evidence fragments remains same-document navigation");
  assert.equal(note.value, "Unsaved correction remains in the textarea");
  assert.equal(document.activeElement, note);

  note.value = "Dirty correction that has not been kept";
  let unloadPrevented = false;
  listeners.get("beforeunload")![0]!({ preventDefault() { unloadPrevented = true; } });
  assert.equal(unloadPrevented, true);
  for (const special of [
    { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { download: true }, { target: "_blank" },
  ]) {
    const link = { getAttribute(name: string) { return name === "href" ? "/" : name === "target" ? special.target ?? null : null; },
      hasAttribute(name: string) { return name === "download" && special.download === true; } };
    documentListeners.get("click")![0]!({ button: special.button ?? 0, ctrlKey: false, metaKey: false, shiftKey: false,
      altKey: false, ...special, target: { closest() { return link; } }, preventDefault() { throw new Error("special click prevented"); } });
  }
  assert.equal(confirms, 0, "modified, non-primary, download, and non-self clicks do not grant approval");
  unloadPrevented = false;
  listeners.get("beforeunload")![0]!({ preventDefault() { unloadPrevented = true; } });
  assert.equal(unloadPrevented, true, "special clicks leave dirty-note unload protection armed");
  location.hash = "";
  location.search = "";
  listeners.get("popstate")![0]!();
  assert.equal(confirms, 1);
  assert.deepEqual(pushed, ["/?draft=1"]);
  assert.equal(reloads, 0, "declining the warning keeps the draft and its dirty note");

  approve = true;
  location.search = "";
  listeners.get("popstate")![0]!();
  assert.equal(reloads, 1);
  note.value = "Edited again after navigation approval";
  note.dispatch("input");
  unloadPrevented = false;
  listeners.get("beforeunload")![0]!({ preventDefault() { unloadPrevented = true; } });
  assert.equal(unloadPrevented, true, "subsequent input revokes an earlier navigation approval");

  vm.runInNewContext(C3_CLIENT_SCRIPT, { window, document, history });
  note.value = "Unsaved correction remains in the textarea";
  location.search = "?prepare=1";
  listeners.get("popstate")![0]!();
  assert.equal(reloads, 2);
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window, document, history });
  location.search = "?draft=1";
  listeners.get("popstate")![0]!();
  assert.equal(reloads, 3, "Home, Prepare, and Draft history entries each resolve their URL-owned document");
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
    getAttribute(name: string): string | null { return name === "content" ? "csrf" : name === "data-record-id" ? "record-visible" : null; }
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
  assert.deepEqual(JSON.parse(calls[1]!.body), { note: "Current unsaved correction", recordId: "record-visible" });
});

test("rendered client updates allowlisted history before draft replacement and revision returns to Prepare", async () => {
  type Listener = (event: any) => unknown;
  class Element {
    readonly listeners = new Map<string, Listener[]>(); value = "Visible correction"; disabled = false; textContent = "";
    constructor(readonly values: Record<string, unknown> = {}) {}
    addEventListener(name: string, listener: Listener): void { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
    async dispatch(name: string): Promise<void> { for (const listener of this.listeners.get(name) ?? []) await listener({ preventDefault() {}, currentTarget: this }); }
    querySelector(selector: string): unknown { return selector === 'button[type="submit"]' ? button : null; }
    getAttribute(name: string): string | null { return name === "content" ? "csrf" : name === "data-record-id" ? "record-visible" : null; }
  }
  const form = new Element({ audience: "CISO", intendedOutcome: "Learn", durationMinutes: "15", meetingDate: "2026-09-12" });
  const button = new Element(); const status = new Element(); const meta = new Element(); const revise = new Element(); const note = new Element(); const reviewStatus = new Element();
  const writes: string[] = []; const navigation: string[] = [];
  const document = { querySelector(selector: string): unknown { return ({ '[data-generate]': form, '[data-status]': status,
    '[data-revise]': revise, '[data-correction-note]': note, '[data-review-status]': reviewStatus,
    'meta[name="c3-csrf"]': meta } as Record<string, unknown>)[selector] ?? null; },
    open() {}, write(html: string) { writes.push(html); navigation.push(`write:${html}`); }, close() {} };
  class FormDataStub { constructor(private readonly element: Element) {} get(name: string): unknown { return this.element.values[name]; } }
  const history = {
    pushState(_state: unknown, _title: string, location: string) { navigation.push(`push:${location}`); },
    replaceState(_state: unknown, _title: string, location: string) { navigation.push(`replace:${location}`); },
  };
  const fetchStub = async (url: string): Promise<any> => ({ ok: true, json: async () => url === "/api/generate"
    ? ({ html: "DRAFT PAGE", location: "/?draft=1", history: "push" })
    : ({ html: "PREPARE PAGE", location: "/?prepare=1", history: "replace" }) });
  vm.runInNewContext(C3_CLIENT_SCRIPT, { document, FormData: FormDataStub, fetch: fetchStub, history, AbortController, Error, JSON, Number });
  await form.dispatch("submit");
  assert.deepEqual(navigation, ["push:/?draft=1", "write:DRAFT PAGE"]);
  await revise.dispatch("click");
  assert.deepEqual(navigation.slice(2), ["replace:/?prepare=1", "write:PREPARE PAGE"]);
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
