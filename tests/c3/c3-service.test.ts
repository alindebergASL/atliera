import assert from "node:assert/strict";
import { randomBytes, webcrypto } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import type { IncomingMessage, ServerResponse } from "node:http";

import { loadC3AccountContext, type FrozenC3AccountContext } from "../../src/c3/context.ts";
import { createC3ModelRequest as createCurrentC3ModelRequest, createC3RevisionContext, createGenerationRecord, type C3ModelRequest } from "../../src/c3/draft.ts";
import { createC3VerificationRequest, retainC3Verification } from '../../src/c3/generation-contract-v6.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';
// Rendering and replay fixtures characterize issued v5. Fresh HTTP operations below use explicit scripted v6 checks.
const createC3ModelRequest: typeof createCurrentC3ModelRequest = (context, input, revision = null, version = '5') =>
  createCurrentC3ModelRequest(context, input, revision, version);
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
  const rawPost = (path: string, body: unknown, headers: Record<string, string> = {}) => requestTo(running, "POST", path, body,
    { cookie, origin: ORIGIN, "x-c3-csrf": csrf, "content-type": "application/json", ...headers });
  // One logical browser: retain only state actually displayed/acknowledged by its responses.
  let recordId: string | null = null, pendingToken: string | null = null, priorNote = "", operationId = "";
  const post = async (path: string, body: any, headers: Record<string, string> = {}) => {
    let wire = body;
    if (path === "/api/generate" || path === "/api/cancel") {
      if (path === "/api/generate") operationId = randomBytes(24).toString("base64url");
      wire = { request: body, operationId, recordId, pendingRevisionToken: pendingToken };
    } else if ((path === "/api/note" || path === "/api/revise") && body && typeof body === "object") wire = { ...body, priorNote };
    const result = await rawPost(path, wire, headers);
    if (result.status < 300) {
      const payload = JSON.parse(result.text);
      if (payload.savedNote !== undefined) priorNote = payload.savedNote;
      if (payload.html) {
        recordId = payload.html.match(/data-record-id="([^"]+)"/)?.[1] ?? recordId;
        pendingToken = payload.html.match(/data-pending-revision-token="([A-Za-z0-9_-]{32})"/)?.[1] ?? null;
        const note = payload.html.match(/<textarea[^>]*data-correction-note[^>]*>\n?([\s\S]*?)<\/textarea>/)?.[1];
        if (note !== undefined) priorNote = note.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '\"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
        else if (path === "/api/revise") priorNote = body.note;
      }
    }
    return result;
  };
  const apply = (proposal: any) => post('/api/apply-revision', {recordId:proposal.recordId,proposalId:proposal.proposalId,instruction:proposal.instruction,pendingRevisionToken:proposal.operation.pendingRevisionToken});
  return { cookie, csrf, page: response.text, post, rawPost, apply };
}

function pendingRevisionToken(html: string): string {
  const token = html.match(/data-pending-revision-token="([A-Za-z0-9_-]{32})"/)?.[1];
  assert.ok(token);
  return token;
}

const meetingRequest = { audience: "CISO", intendedOutcome: "Understand priorities and agree a next step.", durationMinutes: 15, meetingDate: "2026-09-12" };

test("synthetic v5 replay readiness requires two exact admitted local records and preserves their bytes", async () => {
  const ctx = await context();
  const initial = createC3ModelRequest(ctx, meetingRequest);
  const raw = candidate(ctx);
  const priorRecord = createGenerationRecord(initial, raw, ctx);
  const correctionNote = "Keep the exact authored questions.";
  const revision = createC3ModelRequest(ctx, meetingRequest, createC3RevisionContext(priorRecord, correctionNote, 1));
  const revisionRecord = createGenerationRecord(revision, raw, ctx);
  for (const mode of ['admitted', 'unadmitted', 'external'] as const) {
    let calls = 0;
    const running = await startC3Server({ context: ctx, syntheticPreview: true, listen: false, expectedHost: HOST,
      recordedReplay: { initialRequest: priorRecord.meetingRequest, correctionNote,
        ...(mode === 'unadmitted' ? {} : { priorRecord, revisionRecord }) },
      provider: { name: 'synthetic-authored-preview', executionMode: mode === 'external' ? 'external' : 'local',
        async generate(request) { calls += 1; assert.equal(request.generationContractVersion, '5'); return raw; } } });
    try {
      const browser = await browserSession(running);
      const prepare = await requestTo(running, 'GET', '/?prepare=1', undefined, { cookie: browser.cookie });
      if (mode === 'admitted') {
        assert.match(prepare.text, /Only the exact authored example request is available/);
        assert.doesNotMatch(prepare.text, /Fresh generation unavailable/);
        const response = await browser.post('/api/generate', meetingRequest);
        assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.text).recordId, priorRecord.recordId);
        assert.equal(calls, 1);
      } else {
        assert.match(prepare.text, /Fresh generation unavailable/);
        assert.equal(calls, 0);
      }
    } finally { await running.close(); }
  }
  assert.equal(priorRecord.rawResponse, raw);
});

async function harness(provider: C3ModelProvider, now?: () => Date) {
  const scriptedProvider: C3ModelProvider = { name: provider.name, executionMode: provider.executionMode,
    async generate(request, signal) {
      const original = await provider.generate(request, signal);
      if (request.generationContractVersion !== '6') return original;
      try { return JSON.stringify({...JSON.parse(original), assertions: []}); } catch { return original; }
    }, async verify(request, signal) { return provider.verify ? provider.verify(request, signal) : scriptedFullCoverage(request); } };
  return startC3Server({ context: await context(), provider: scriptedProvider, now, listen: false, expectedHost: HOST,
    generationAudit: { async retainCandidate() {}, async retainRecord() {}, async retainFailure() {} } });
}

test("HTTP handler renders discoverable responsive journey and disabled-provider failure preserves inputs", async () => {
  const running = await harness(new DisabledC3ModelProvider(), () => new Date("2026-09-05T00:00:00.000Z"));
  try {
    const browser = await browserSession(running);
    assert.match(browser.page, /Prepare brief/);
    assert.match(browser.page, /The sources suggest/);
    assert.match(browser.page, /<blockquote>/);
    assert.match(browser.page, /class="account-readout"/);
    assert.doesNotMatch(browser.page, /id="original-account-proposal"/);
    assert.ok(browser.page.indexOf('>Prepare brief</a>') < browser.page.indexOf('class="account-readout"'));
    assert.match(browser.page, /@media\(max-width:700px\)/);
    assert.match(browser.page, /server restart loses unsaved work/);
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
    now: () => new Date("2031-01-01T00:00:00.000Z"), recordedReplay: { initialRequest, correctionNote, priorRecord, revisionRecord } });
  try {
    const browser = await browserSession(running);
    assert.match(browser.page, /Recorded responses · No live generation/);
    assert.match(browser.page, /Private document storage never changes account truth or approves content/);
    assert.doesNotMatch(browser.page, /Unmerged and proposed/);
    assert.match(browser.page, />Prepare brief</);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /Recorded responses · No live generation/);
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
    assert.match(priorHtml, /Recorded responses · No live generation/);
    assert.match(priorHtml, new RegExp(`data-record-id="${priorRecord.recordId}"`));
    assert.match(priorHtml, /only the fixed recorded instruction below has a response/);
    assert.match(priorHtml, /data-use-recorded-note>Use recorded instruction/);
    assert.match(priorHtml, /Recorded correction: keep the exact prior identity and allow no follow-up\./);
    assert.equal(priorHtml.match(/Recorded initial — before correction\./gu)?.length, 1);
    assert.ok(priorHtml.indexOf("Recorded initial — before correction.") < priorHtml.indexOf('class="draft-grid"'));
    assert.match(C3_CLIENT_SCRIPT, /Fixed instruction selected/);

    const arbitrary = "Arbitrary owner note stays a note and has no matching recorded result.";
    const kept = await browser.post("/api/note", { note: arbitrary, recordId: priorRecord.recordId });
    assert.equal(kept.status, 200);
    assert.match((JSON.parse(kept.text) as { html: string }).html, new RegExp(arbitrary));
    const revised = await browser.post("/api/revise", { note: correctionNote, recordId: priorRecord.recordId });
    assert.equal(revised.status, 200);
    const revisionPrepare = (JSON.parse(revised.text) as { html: string }).html;
    assert.match(revisionPrepare, /data-revision-instruction/);
    assert.match(revisionPrepare, /data-revise>Revise/);
    const regenerated = await browser.post("/api/generate", initialRequest);
    assert.equal(regenerated.status, 200);
    const proposal = JSON.parse(regenerated.text); assert.equal(proposal.recordId, priorRecord.recordId); assert.equal(proposal.proposalId, revisionRecord.recordId);
    const revisionHtml = JSON.parse((await browser.apply(proposal)).text).html;
    assert.match(revisionHtml, new RegExp(`data-record-id="${revisionRecord.recordId}"`));
    assert.match(revisionHtml, /this is the recorded revision\. No further recorded response is available/);
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
    assert.equal(unmatchedRevision.status, 409);
    assert.match(JSON.parse(unmatchedRevision.text).error, /Local exact replay only/);
    const untouched = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: arbitraryBrowser.cookie });
    assert.doesNotMatch(untouched.text, /data-pending-revision-token=/);
    assert.doesNotMatch(untouched.text, new RegExp(unmatchedNote));

    const retryBrowser = await browserSession(running);
    const retryInitial = await retryBrowser.post("/api/generate", initialRequest);
    const retryInitialId = (JSON.parse(retryInitial.text) as { html: string }).html.match(/data-record-id="([^"]+)"/)?.[1];
    assert.equal(retryInitialId, priorRecord.recordId);
    assert.equal((await retryBrowser.post("/api/revise", { note: correctionNote, recordId: retryInitialId })).status, 200);
    const pendingA = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: retryBrowser.cookie });
    const tokenA = pendingRevisionToken(pendingA.text);
    assert.equal((await retryBrowser.post("/api/discard-revision", { recordId: retryInitialId, pendingRevisionToken: tokenA })).status, 200);
    const exactRetry = await retryBrowser.post("/api/revise", { note: correctionNote, recordId: retryInitialId });
    assert.match((JSON.parse(exactRetry.text) as { html: string }).html, /data-revision-instruction/);
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
    const retriedHtml = JSON.parse((await retryBrowser.apply(JSON.parse(retriedRevision.text))).text).html;
    assert.match(retriedHtml, new RegExp(`data-record-id="${revisionRecord.recordId}"`));
    const nextRevision = await retryBrowser.post("/api/revise", { note: "Next successful lineage", recordId: revisionRecord.recordId });
    assert.equal(nextRevision.status, 409);
    assert.match(JSON.parse(nextRevision.text).error, /Local exact replay only/);
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
  assert.match(rendered, /<ol class="questions">/);
  assert.ok(rendered.includes(`<strong>${exactQuestion}</strong>`));
  assert.ok(rendered.includes(`<p class="learning">${exactPrefix}</p>`));
  assert.ok(rendered.includes(`<p>${exactSuffix}</p>`));
  assert.equal(rendered.match(/Optional probe — only if relevant/gu)?.length, 1);
  assert.match(rendered, /data-evidence-link data-context="Question 2"/);
});

test("successful generation is proposed, source-derived, evidence-linked, and retained across reload", async () => {
  const ctx = await context();
  const running = await harness({ name: "test-deterministic", generate: async () => candidate(ctx) });
  try {
    const browser = await browserSession(running);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.equal(prepare.status, 200);
    assert.match(prepare.text, /Prepare a brief/);
    const generated = await browser.post("/api/generate", meetingRequest);
    assert.equal(generated.status, 200);
    const payload = JSON.parse(generated.text) as { html: string; location: string; history: string };
    assert.match(payload.html, /Proposed and unreviewed/);
    assert.match(payload.html, /related evidence context/i);
    assert.match(payload.html, /Evidence behind the brief/);
    const generatedBrief = payload.html.split('<div class="draft-grid">')[1]!.split('<section data-generated-region="checks"')[0]!;
    assert.doesNotMatch(generatedBrief.replace(/<[^>]*>/gu, ''), /evidence_[a-f0-9]+/);
    assert.deepEqual({ location: payload.location, history: payload.history }, { location: "/?draft=1", history: "push" });
    const reloaded = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(reloaded.text, /<h1 data-work-title>/);
    const home = await requestTo(running, "GET", "/", undefined, { cookie: browser.cookie });
    assert.match(home.text, /Overview/);
    assert.match(home.text, /id="journey-overview"[^>]*aria-current="page"/);
    assert.match(home.text, /href="\/\?draft=1"[^>]*>Reopen session draft/);
    assert.equal(running.status().generationSucceeded, 1);
  } finally { await running.close(); }
});

test("two local service ports retain independent browser-jar sessions and a restart invalidates only its session", async () => {
  const ctx = await context();
  const provider: C3ModelProvider = { name: "shared-browser-jar", generate: async () => JSON.stringify({...JSON.parse(candidate(ctx)), assertions: []}),
    async verify(request) { return scriptedFullCoverage(request); } };
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
  const post = async (running: RunningC3Server, csrf: string, path: string, body: unknown): Promise<ResponseResult> => requestTo(running, "POST", path,
    path === "/api/generate" ? { request: body, operationId: randomBytes(24).toString("base64url"), recordId: null, pendingRevisionToken: null } :
    path === "/api/note" ? { ...(body as object), priorNote: "" } : body,
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
    assert.match((await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie })).text, /Prepare a brief/);
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
    assert.equal((await browser.post("/api/planning/next-steps", { version: 0, section: "actions", text: "Blocked while active" })).status, 409);
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

for (const cancelWhileWaiting of [false, true]) {
  test(`overlapping replacements retain cancellation ownership (cancel while waiting: ${cancelWhileWaiting})`, { timeout: 3000 }, async () => {
    const ctx = await context();
    const raw = candidate(ctx);
    const calls: string[] = [];
    const starts: { audience: string; signal: AbortSignal; release: () => void }[] = [];
    let occupied = false;
    let cleanup = false;
    const running = await harness({ name: "synthetic-single-slot", generate: async (request, signal) => {
      calls.push(request.meetingRequest.audience);
      if (cleanup) return raw;
      if (occupied) throw new Error("one generation is already running");
      occupied = true;
      try {
        return await new Promise<string>((resolve) => {
          starts.push({ audience: request.meetingRequest.audience, signal, release: () => resolve(raw) });
        });
      } finally { occupied = false; }
    } });
    // A complete event-loop turn drains the in-memory request body and handler microtasks.
    // Provider settlement stays explicitly gated: no sleep or scheduler-dependent release.
    const drain = () => new Promise<void>((resolve) => setImmediate(resolve));
    try {
      const browser = await browserSession(running);
      const first = browser.post("/api/generate", { ...meetingRequest, audience: "First" });
      await drain();
      assert.equal(starts.length, 1);
      const second = browser.post("/api/generate", { ...meetingRequest, audience: "Second" });
      await drain();
      assert.equal(starts[0]!.signal.aborted, true);
      const third = browser.post("/api/generate", { ...meetingRequest, audience: "Third" });
      await drain();
      assert.deepEqual(calls, ["First"], "both replacements wait for the same predecessor");
      const edited = { ...meetingRequest, audience: "Kept cancellation edits" };
      let cancelled = cancelWhileWaiting ? browser.post("/api/cancel", edited) : undefined;
      await drain();
      starts[0]!.release();
      await drain();
      if (cancelWhileWaiting) assert.deepEqual(calls, ["First"], "cancel invalidates every waiting admission");
      if (!cancelWhileWaiting) {
        cancelled = browser.post("/api/cancel", edited);
        await drain();
        assert.equal(starts[1]?.signal.aborted, true, "cancel must abort the remaining provider, not an overwritten active slot");
        assert.equal(occupied, true, "cancel waits for actual provider settlement");
        assert.deepEqual(calls, ["First", "Third"], "only the newest waiting request may enter the provider");
        starts[1]!.release(); // Even valid late success must not become an accepted draft.
      }
      assert.equal((await cancelled!).status, 200);
      assert.deepEqual((await Promise.all([first, second, third])).map((response) => response.status), [409, 409, 409]);
      assert.deepEqual(calls, cancelWhileWaiting ? ["First"] : ["First", "Third"]);
      assert.equal(running.status().generationSucceeded, 0);
      assert.equal(running.status().generationFailed, 0);
      assert.equal(running.status().generationCancelled, 1);
      assert.equal((await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie })).status, 409);
      const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
      assert.match(prepare.text, /Kept cancellation edits/);
    } finally {
      cleanup = true;
      for (const start of starts) start.release();
      await drain();
      await running.close();
    }
  });
}

for (const disconnectWhileWaiting of [false, true]) {
  test(`disconnected generation cannot dispatch or accept late success (waiting: ${disconnectWhileWaiting})`, async () => {
    const ctx = await context();
    const starts: { signal: AbortSignal; release: () => void }[] = [];
    let cleanup = false;
    const running = await harness({ name: "synthetic-disconnect", generate: async (_request, signal) => {
      if (cleanup) return candidate(ctx);
      await new Promise<void>((resolve) => { starts.push({ signal, release: resolve }); });
      return candidate(ctx);
    } });
    const drain = () => new Promise<void>((resolve) => setImmediate(resolve));
    try {
      const browser = await browserSession(running);
      const prior = disconnectWhileWaiting ? browser.post("/api/generate", meetingRequest) : undefined;
      await drain();
      const req = new PassThrough() as PassThrough & { method: string; url: string; headers: Record<string, string> };
      req.method = "POST"; req.url = "/api/generate";
      req.headers = { host: HOST, cookie: browser.cookie, origin: ORIGIN, "x-c3-csrf": browser.csrf, "content-type": "application/json" };
      const res = new MemoryResponse();
      running.server.emit("request", req as unknown as IncomingMessage, res as unknown as ServerResponse);
      req.end(JSON.stringify({ request: { ...meetingRequest, audience: "Disconnected replacement" }, operationId: "d".repeat(32), recordId: null, pendingRevisionToken: null }));
      await drain();
      assert.equal(starts.length, 1);
      res.emit("close");
      assert.equal(starts[0]!.signal.aborted, true);
      starts[0]!.release();
      await drain();
      assert.equal(starts.length, 1, "a disconnected waiter must never reach the provider");
      assert.equal(res.statusCode, 409);
      assert.equal(res.listenerCount("close"), 0, "waiting and active requests both remove response listeners");
      if (prior !== undefined) assert.equal((await prior).status, 409);
      assert.equal(running.status().generationSucceeded, 0);
      assert.equal((await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie })).status, 409);
    } finally {
      cleanup = true;
      for (const start of starts) start.release();
      await drain();
      await running.close();
    }
  });
}

test("normal generation supersession still admits and accepts the replacement", async () => {
  const ctx = await context();
  let release!: () => void;
  const signals: AbortSignal[] = [];
  const running = await harness({ name: "synthetic-supersession", generate: async (_request, signal) => {
    signals.push(signal);
    if (signals.length === 1) await new Promise<void>((resolve) => { release = resolve; });
    return candidate(ctx);
  } });
  try {
    const browser = await browserSession(running);
    const first = browser.post("/api/generate", meetingRequest);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const second = browser.post("/api/generate", { ...meetingRequest, audience: "Replacement" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(signals[0]!.aborted, true);
    release();
    assert.equal((await first).status, 409);
    assert.equal((await second).status, 200);
    assert.equal(signals.length, 2);
    assert.equal(signals[1]!.aborted, false);
    assert.equal(running.status().generationSucceeded, 1);
  } finally { release?.(); await running.close(); }
});

test("explicit cancel preserves bounded partial form text instead of restoring the last valid request", async () => {
  const running = await harness({ name: "local", executionMode: "local", generate: async (_request, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")))) });
  try {
    const browser = await browserSession(running);
    const pending = browser.post("/api/generate", meetingRequest);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const partial = { audience: "", intendedOutcome: "Partially edited outcome", durationMinutes: 15, meetingDate: "2026-09-" };
    const cancelled = await browser.post("/api/cancel", partial);
    assert.equal(cancelled.status, 200);
    const payload = JSON.parse(cancelled.text) as { html: string; status: string };
    assert.equal((await pending).status, 409);
    assert.match(payload.status, /Current form text is ready/);
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /Partially edited outcome/);
    assert.match(prepare.text, /value="2026-09-"/);
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
    assert.match(revisionPayload.html, /data-revision-instruction/);
    assert.deepEqual({ location: revisionPayload.location, history: revisionPayload.history }, { location: "/?draft=1", history: "replace" });
    const preservedDraft = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.equal(preservedDraft.status, 200);
    assert.match(preservedDraft.text, new RegExp(`data-record-id="${recordId}"`));
    assert.match(preservedDraft.text, /Revision pending · original unchanged until Apply\./);
    assert.match(preservedDraft.text, /\.review\{[^}]*color:var\(--atl-ink\)/,
      "review uses a legible dark foreground on the light surface");
    assert.match(preservedDraft.text, /Keep original/);
    assert.doesNotMatch(preservedDraft.text, /<textarea[^>]* disabled>/, "pending revision keeps editors available for newer typing");
    assert.match(preservedDraft.text, /<button type="submit" class="secondary">Add note<\/button>/);
    assert.match(preservedDraft.text, /data-revise>Revise<\/button>/);
    assert.doesNotMatch(preservedDraft.text, /data-discard-revision[^>]* disabled/);
    assert.equal((await browser.post("/api/note", { note: "Independent note", recordId })).status, 200);
    assert.equal((await browser.rawPost("/api/revise", { note: "second pending revision", recordId, priorNote: "stale baseline" })).status, 409);
    assert.equal((await browser.post("/api/generate", meetingRequest)).status, 200);
    assert.equal(captured.length, 2);
    assert.equal(captured[0]!.revision, null);
    assert.equal(captured[1]!.revision?.correctionNote, note);
    assert.equal(captured[1]!.revision?.priorRawResponse, JSON.stringify({...JSON.parse(candidate(ctx)), assertions: []}));
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
  const window: Record<string, unknown> = { crypto: webcrypto, addEventListener(name: string, listener: () => void) {
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
    documentListeners.get("click")!.at(-1)!({ button: special.button ?? 0, ctrlKey: false, metaKey: false, shiftKey: false,
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
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window: { crypto: webcrypto, addEventListener() {} }, document, FormData: FormDataStub, fetch: fetchStub, AbortController, Error, JSON, Number });
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
    '[data-correction-note]': note, '[data-revision-instruction]': note, '[data-revision-status]': reviewStatus, '[data-review-status]': reviewStatus, 'meta[name="c3-csrf"]': meta } as Record<string, unknown>)[selector] ?? null; },
    open() {}, write() {}, close() {} };
  const fetchStub = async (url: string, init: { body: string }): Promise<never> => { calls.push({ url, body: init.body }); throw new Error(`${url} network unavailable`); };
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window: { crypto: webcrypto, addEventListener() {} }, document, FormData: FormDataStub, fetch: fetchStub, AbortController, Error, JSON, Number });
  await noteForm.dispatch("submit");
  assert.match(reviewStatus.textContent, /\/api\/note network unavailable/);
  await revise.dispatch("click");
  assert.match(reviewStatus.textContent, /Revision could not be prepared\. Current brief and typing kept/);
  assert.deepEqual(JSON.parse(calls[1]!.body), { note: "Current unsaved correction", recordId: "record-visible", priorNote: "Current unsaved correction" });
});

test("Prepare success uses native safe navigation without rewriting the page", async () => {
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
  const focusEvents: unknown[] = [];
  const heading = { setAttribute: (name: string, value: string) => focusEvents.push([name, value]), focus: (options: unknown) => focusEvents.push(JSON.parse(JSON.stringify(options))) };
  const writes: string[] = []; const navigation: string[] = [];
  const document = { querySelector(selector: string): unknown { return ({ 'main h1': heading, '[data-generate]': form, '[data-status]': status,
    '[data-revise]': revise, '[data-correction-note]': note, '[data-revision-instruction]': note, '[data-revision-status]': reviewStatus, '[data-review-status]': reviewStatus,
    'meta[name="c3-csrf"]': meta } as Record<string, unknown>)[selector] ?? null; },
    open() {}, write(html: string) { writes.push(html); navigation.push(`write:${html}`); }, close() {} };
  class FormDataStub { constructor(private readonly element: Element) {} get(name: string): unknown { return this.element.values[name]; } }
  const history = {
    pushState(_state: unknown, _title: string, location: string) { navigation.push(`push:${location}`); },
    replaceState(_state: unknown, _title: string, location: string) { navigation.push(`replace:${location}`); },
  };
  const fetchStub = async (url: string): Promise<any> => ({ ok: true, json: async () => url === "/api/generate"
    ? ({ outcome: "succeeded", html: "DRAFT PAGE", location: "/?draft=1", history: "push" })
    : ({ html: "PREPARE PAGE", location: "/?prepare=1", history: "replace" }) });
  vm.runInNewContext(C3_CLIENT_SCRIPT, { window: { location: { assign: (url: string) => navigation.push(`native:${url}`) }, crypto: webcrypto, addEventListener() {}, scrollTo: (x: number, y: number) => focusEvents.push([x, y]) }, document, FormData: FormDataStub, fetch: fetchStub, history, AbortController, Error, JSON, Number });
  await form.dispatch("submit");
  assert.deepEqual(navigation, ["native:/?draft=1"]);
  assert.deepEqual(writes, []);
  assert.deepEqual(focusEvents, []);
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

test("exact unchanged submissions retain draft and note, while each meeting decision still targets a new request", async () => {
  const ctx = await context();
  const captured: C3ModelRequest[] = [];
  const running = await harness({ name: "deterministic-targeting-fixture", generate: async (request) => {
    captured.push(request); return candidate(ctx);
  } });
  try {
    const browser = await browserSession(running);
    const initial = JSON.parse((await browser.post("/api/generate", meetingRequest)).text) as { html: string };
    const recordId = initial.html.match(/data-record-id="([^"]+)"/)![1]!;
    const note = "Keep this private session correction.";
    await browser.post("/api/note", { recordId, note });
    const repeated = JSON.parse((await browser.post("/api/note", { recordId, note })).text) as { noChange: boolean; status: string };
    assert.equal(repeated.noChange, true);
    assert.match(repeated.status, /unchanged/);
    for (let i = 0; i < 2; i += 1) {
      const reopened = JSON.parse((await browser.post("/api/generate", meetingRequest)).text) as { html: string; noChange: boolean };
      assert.equal(reopened.noChange, true);
      assert.ok(reopened.html.includes(recordId));
      assert.ok(reopened.html.includes(note));
      assert.match(reopened.html, /no new generation/);
    }
    assert.equal(captured.length, 1);
    assert.equal(running.status().generationAttempted, 1);
    for (const empty of ["", "   ", "\n"]) {
      const noRevision = JSON.parse((await browser.post("/api/revise", { recordId, note: empty })).text) as { noChange: boolean };
      assert.equal(noRevision.noChange, true);
      const page = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
      assert.ok(page.text.includes(note));
      assert.doesNotMatch(page.text, /data-pending-revision-token=/);
    }
    for (const invalid of ["a", "ab", " Leading space", "Trailing space "]) {
      const refused = await browser.post("/api/revise", { recordId, note: invalid });
      assert.equal(refused.status, 400);
      assert.match(refused.text, /draft and saved note were kept/);
      const kept = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
      assert.ok(kept.text.includes(note));
      assert.ok(kept.text.includes(recordId));
      assert.doesNotMatch(kept.text, /data-pending-revision-token=/);
      const setup = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
      assert.ok(setup.text.includes(meetingRequest.intendedOutcome));
      assert.equal(captured.length, 1);
    }
    const cleared = JSON.parse((await browser.post("/api/note", { recordId, note: "" })).text) as { noChange: boolean; html: string };
    assert.equal(cleared.noChange, false);
    assert.doesNotMatch(cleared.html, /Keep this private session correction/);
    assert.equal(JSON.parse((await browser.post("/api/note", { recordId, note: "" })).text).noChange, true);
    // Saving before revising must still work: note equality is against the applied correction, not the saved note.
    await browser.post("/api/note", { recordId, note });
    await browser.post("/api/revise", { recordId, note });
    const proposal = JSON.parse((await browser.post("/api/generate", meetingRequest)).text);
    const revised = JSON.parse((await browser.apply(proposal)).text) as { html: string };
    const revisedId = revised.html.match(/data-record-id="([^"]+)"/)![1]!;
    assert.notEqual(revisedId, recordId);
    assert.equal(captured.length, 2);
    const unchangedRevision = JSON.parse((await browser.post("/api/revise", { recordId: revisedId, note })).text);
    assert.equal(unchangedRevision.noChange, true);
    assert.equal((await browser.post("/api/revise", { recordId, note: "" })).status, 409, "no-op does not bypass stale record guard");
    let current = meetingRequest;
    const decisions = [ { audience: "CIO and engineering leaders" }, { intendedOutcome: "Understand ownership and constraints." },
      { durationMinutes: 30 }, { meetingDate: "2026-09-13" }, { audience: "CIO and  engineering leaders" } ];
    for (const change of decisions) {
      current = { ...current, ...change };
      const result = JSON.parse((await browser.post("/api/generate", current)).text) as { html: string; noChange?: boolean };
      assert.notEqual(result.noChange, true, "one exact-byte change cannot reuse another meeting's draft");
      const last = captured.at(-1)!;
      assert.deepEqual(last.meetingRequest, current);
      assert.equal(last.contextSha256, captured[0]!.contextSha256);
      const setup = result.html.match(/<header class="draft-head"[\s\S]*?<\/header>/)![0];
      assert.ok(setup.includes(current.audience));
      assert.ok(setup.includes(current.intendedOutcome));
      assert.ok(setup.includes(`${current.durationMinutes} min`));
    }
    assert.equal(captured.length, 7);
    assert.equal((await browser.post("/api/generate", { ...current, audience: current.audience + " " })).status, 400, "invalid whitespace is refused, never normalized into a replay");
    assert.equal(captured.length, 7);
  } finally { await running.close(); }
});

test("brief exposes sparse and conflicting fixture context without inventing support or hiding unknowns", async () => {
  const original = await context();
  const conflict = "Two retained sources disagree on ownership; neither is reconciled.";
  const gap = "Current decision owner is not established.";
  const ctx = { ...original, context: { ...original.context, declaredContradictions: [conflict], materialGaps: [gap] } };
  const value = JSON.parse(candidate(ctx));
  value.temporalOutcome = "insufficient_context";
  value.audienceThesis = { text: "Current audience priorities remain unknown.", supportCategory: "unknown", evidenceRefs: [] };
  value.questions[1].evidenceRefs = [];
  value.selectedEvidenceRefs = [];
  const record = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), JSON.stringify(value), ctx);
  assert.equal(record.outcome, "succeeded");
  const html = renderC3Page(ctx, { page: "draft", record, correctionNote: "" }, "csrf");
  assert.match(html, /No evidence selected by this draft/);
  assert.match(html, /Unknown · not established/);
  assert.ok(html.includes(conflict));
  assert.ok(html.includes(gap));
  assert.match(html, /Full source context in Research/);
  assert.match(html, /Context is insufficient/);
  assert.equal(record.rawResponse, JSON.stringify(value));
  const generatedBrief = html.split('<div class="draft-grid">')[1]!.split('<section data-generated-region="checks"')[0]!;
  assert.doesNotMatch(generatedBrief, /data-evidence-link data-context=/);
});

// Sprint regressions use authored synthetic context; no retained private research or provider calls.
test("Account Intel and purpose-specific templates share injected context without account or kind bleed", async () => {
  const { syntheticWorkshopContext } = await import("../fixtures/c3-workshop.ts");
  for (const account of ["harbor", "cedar"] as const) {
    const ctx = syntheticWorkshopContext(account);
    const running = await startC3Server({ context: ctx, provider: new DisabledC3ModelProvider(), listen: false, expectedHost: HOST });
    try {
      const browser = await browserSession(running);
      assert.match(browser.page, /Overview/);
      const research = await requestTo(running, "GET", "/?view=research&topic=initiatives", undefined, { cookie: browser.cookie });
      assert.match(research.text, /Developments and priorities/);
      assert.match(research.text, /Stakeholders and relationships/);
      assert.doesNotMatch(browser.page, account === "harbor" ? /Cedar Works/ : /Harbor Transit/);
      const strategy = await requestTo(running, "GET", "/?kind=strategy", undefined, { cookie: browser.cookie });
      assert.match(strategy.text, /Options and tradeoffs/);
      assert.match(strategy.text, /not AI-generated/);
      const setup = await browser.post("/api/planning/strategy", { version: 0, audience: "CIO", intendedOutcome: "Choose what to validate", detail: "This quarter" });
      assert.equal(setup.status, 200);
      const edit = await browser.post("/api/planning/strategy", { version: 1, section: "options", text: "Compare a bounded pilot with waiting." });
      assert.equal(edit.status, 200);
      assert.equal((await browser.post("/api/planning/strategy", { version: 1, section: "options", text: "Stale overwrite" })).status, 409);
      const noChange = await browser.post("/api/planning/strategy", { version: 2, section: "options", text: "Compare a bounded pilot with waiting." });
      assert.equal(JSON.parse(noChange.text).noChange, true);
      const reopened = await requestTo(running, "GET", "/?kind=strategy", undefined, { cookie: browser.cookie });
      assert.match(reopened.text, /Compare a bounded pilot with waiting\./);
      const next = await requestTo(running, "GET", "/?kind=next-steps", undefined, { cookie: browser.cookie });
      assert.match(next.text, /Owners and dependencies/);
      assert.doesNotMatch(next.text, /Compare a bounded pilot with waiting\./);
      const accountHome = await requestTo(running, "GET", "/", undefined, { cookie: browser.cookie });
      assert.doesNotMatch(accountHome.text, /Compare a bounded pilot with waiting\./);
      assert.equal((await browser.post("/api/planning/next-steps", { version: 0, section: "actions", text: "User next step" }, { "x-c3-csrf": "bad" })).status, 403);
      const otherSession = await browserSession(running);
      const otherBrief = await requestTo(running, "GET", "/?kind=strategy", undefined, { cookie: otherSession.cookie });
      assert.doesNotMatch(otherBrief.text, /Compare a bounded pilot with waiting\./);
      assert.equal(running.status().generationAttempted, 0);
    } finally { await running.close(); }
  }
});

test("in-place meeting notes retain raw response, bind displayed identity and protect pending revisions", async () => {
  const { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } = await import("../fixtures/c3-workshop.ts");
  const ctx = syntheticWorkshopContext();
  const raw = JSON.stringify({...JSON.parse(syntheticMeetingCandidate(ctx)), assertions: []});
  const exact = createCurrentC3ModelRequest(ctx, syntheticMeetingRequest);
  const verificationRequest = createC3VerificationRequest(exact, raw, ctx);
  const record = createGenerationRecord(exact, raw, ctx, retainC3Verification(verificationRequest, scriptedFullCoverage(verificationRequest)));
  const replay = new RecordedReplayC3ModelProvider([{ request: exact, rawResponse: raw }]);
  const running = await startC3Server({ context: ctx, provider: {name:replay.name,executionMode:'local',generate:replay.generate.bind(replay),
    async verify(request) { return scriptedFullCoverage(request); }}, listen: false, expectedHost: HOST });
  try {
    const browser = await browserSession(running);
    assert.equal((await browser.post("/api/generate", syntheticMeetingRequest)).status, 200);
    const edit = { recordId: record.recordId, section: "Opening", text: "Ask about the participant’s priority first.", priorText: "" };
    assert.equal((await browser.post("/api/section-note", edit)).status, 200);
    assert.equal((await browser.post("/api/section-note", edit)).status, 409, "stale prior text cannot overwrite a saved note");
    assert.equal(JSON.parse((await browser.post("/api/section-note", { ...edit, priorText: edit.text })).text).noChange, true);
    const page = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(page.text, /Ask about the participant’s priority first/);
    assert.match(page.text, /Confirm what matters to this audience before proposing a direction\./);
    assert.equal(record.rawResponse, raw);
    assert.equal((await browser.post("/api/section-note", { ...edit, priorText: edit.text, text: "" })).status, 200);
    assert.equal((await browser.post("/api/revise", { recordId: record.recordId, note: "A correction without any recorded response" })).status, 200);
    assert.equal((await browser.post("/api/section-note", edit)).status, 200);
    assert.equal((await browser.post("/api/planning/strategy", { version: 0, section: "decision", text: "Blocked while pending" })).status, 409);
    assert.equal((await browser.post("/api/planning/next-steps", { version: 0, proposedNextStep: { concern: "Question", action: "Investigate", owner: "", targetDate: "", questionOrBlocker: "", evidenceIds: [] } })).status, 409);
    assert.equal((await browser.post("/api/generate", syntheticMeetingRequest)).status, 502);
    const preserved = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    assert.match(preserved.text, /Revision pending/);
    assert.match(preserved.text, /Confirm what matters to this audience before proposing a direction\./);
  } finally { await running.close(); }
});

test("sparse and conflicting synthetic contexts remain explicit across account and planning views", async () => {
  const { syntheticWorkshopContext } = await import("../fixtures/c3-workshop.ts");
  for (const mode of ["sparse", "conflict"] as const) {
    const running = await startC3Server({ context: syntheticWorkshopContext("harbor", mode), provider: new DisabledC3ModelProvider(), listen: false, expectedHost: HOST });
    try {
      const browser = await browserSession(running);
      for (const route of ["/", "/?kind=strategy", "/?kind=next-steps"]) {
        const page = await requestTo(running, "GET", route, undefined, { cookie: browser.cookie });
        assert.match(page.text, mode === "sparse" ? route === "/" ? /There is not enough matched evidence/ : /No admitted sources/ : /Conflicting context/);
      }
    } finally { await running.close(); }
  }
});

test("Slice A displayed state fails closed and notes compare their saved baseline", async () => {
  const ctx = await context();
  const running = await harness({ name: "synthetic", generate: async () => candidate(ctx) });
  try {
    const browser = await browserSession(running);
    const headers = { cookie: browser.cookie, origin: ORIGIN, "x-c3-csrf": browser.csrf, "content-type": "application/json" };
    const post = (path: string, body: unknown) => requestTo(running, "POST", path, body, headers);
    assert.equal((await post("/api/generate", meetingRequest)).status, 409);
    const operation = { request: meetingRequest, operationId: "a".repeat(32), recordId: null, pendingRevisionToken: null };
    const generated = await post("/api/generate", operation);
    assert.equal(generated.status, 200);
    const recordId = JSON.parse(generated.text).html.match(/data-record-id="([^"]+)"/)[1];
    assert.equal((await post("/api/note", { recordId, note: "first", priorNote: "" })).status, 200);
    assert.equal((await post("/api/note", { recordId, note: "lost update", priorNote: "" })).status, 409);
    assert.equal((await post("/api/revise", { recordId, note: "lost revision", priorNote: "" })).status, 409);
    assert.equal((await post("/api/note", { recordId, note: "missing" })).status, 409);
    const revision = await post("/api/revise", { recordId, note: "new revision", priorNote: "first" });
    assert.equal(revision.status, 200);
    assert.equal((await post("/api/generate", { ...operation, operationId: "b".repeat(32), recordId })).status, 409);
    assert.equal(running.status().generationAttempted, 1);
  } finally { await running.close(); }
});

test("CS-04 cancellation owns one operation, fences early arrivals, and derives copy from metadata", async () => {
  for (const executionMode of ["local", "external"] as const) {
    const ctx = await context();
    const signals: AbortSignal[] = [];
    const running = await harness({ name: executionMode === "local" ? "operator-command" : "recorded-replay", executionMode,
      generate: async (request, signal) => { assert.deepEqual(Object.keys(request.meetingRequest).sort(), Object.keys(meetingRequest).sort()); signals.push(signal); return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("stopped")))); } });
    try {
      const browser = await browserSession(running);
      const operation = { request: meetingRequest, operationId: "e".repeat(32), recordId: null, pendingRevisionToken: null };
      assert.equal((await browser.rawPost("/api/cancel", operation)).status, 200);
      assert.equal((await browser.rawPost("/api/generate", operation)).status, 409);
      assert.equal(running.status().generationAttempted, 0);
      const current = { ...operation, operationId: "f".repeat(32) };
      const pending = browser.rawPost("/api/generate", current);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal((await browser.rawPost("/api/cancel", { ...operation, request: { ...meetingRequest, audience: "Stale tab" } })).status, 409);
      assert.equal(signals[0]!.aborted, false);
      assert.equal((await browser.rawPost("/api/cancel", meetingRequest)).status, 409);
      const cancelled = await browser.rawPost("/api/cancel", current);
      assert.equal(cancelled.status, 200);
      assert.equal((await pending).status, 409);
      assert.equal(signals[0]!.aborted, true);
      if (executionMode === "local") { assert.match(cancelled.text, /No remote model work/); assert.doesNotMatch(cancelled.text, /billed/); }
      else assert.match(cancelled.text, /remote billed-work status may be unknown/);
      assert.equal((await browser.rawPost("/api/cancel", current)).status, 409, "late cancel cannot change the form");
      assert.equal(running.status().generationAttempted, 1);
    } finally { await running.close(); }
  }
});

test("CS-05 rendered textareas preserve a leading LF for note and planning no-change/clear roundtrips", async () => {
  const { sectionNoteEditor, planningPage } = await import("../../src/c3/planning-render.ts");
  const { newPlanningBrief } = await import("../../src/c3/planning.ts");
  const ctx = await context();
  const record = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), candidate(ctx), ctx);
  const note = "\nLeading newline";
  const html = renderC3Page(ctx, { page: "draft", record, correctionNote: note, sectionNotes: { Opening: note } }, "csrf");
  assert.match(html, /data-correction-note[^>]*>\n\nLeading newline<\/textarea>/);
  assert.match(sectionNoteEditor("Opening", record.recordId, { Opening: note }, false), />\n\nLeading newline<\/textarea>/);
  const brief = newPlanningBrief("strategy");
  const planning = planningPage(ctx, { ...brief, audience: note });
  assert.match(planning, /name="audience"[^>]*>\n\nLeading newline<\/textarea>/);
  // WHATWG textarea parsing consumes exactly the sentinel LF; remaining bytes form the baseline.
  for (const value of [note, "\n\nTwo", "", "plain"]) assert.equal(("\n" + value).replace(/^\n/, ""), value);
});

test("CS-05 leading newline section note can reload, keep unchanged, then clear", async () => {
  const ctx = await context(), running = await harness({ name: "local", executionMode: "local", generate: async () => candidate(ctx) });
  try {
    const browser = await browserSession(running);
    const generated = JSON.parse((await browser.post("/api/generate", meetingRequest)).text);
    const recordId = generated.html.match(/data-record-id="([^"]+)"/)[1];
    const value = "\nSection note";
    assert.equal((await browser.post("/api/section-note", { recordId, section: "Opening", priorText: "", text: value })).status, 200);
    const reopened = await requestTo(running, "GET", "/?draft=1", undefined, { cookie: browser.cookie });
    const htmlText = reopened.text.match(/id="note-opening"[^>]*>\n([\s\S]*?)<\/textarea>/)?.[1];
    assert.equal(htmlText, value);
    assert.equal(JSON.parse((await browser.post("/api/section-note", { recordId, section: "Opening", priorText: htmlText, text: htmlText })).text).noChange, true);
    assert.equal((await browser.post("/api/section-note", { recordId, section: "Opening", priorText: htmlText, text: "" })).status, 200);
  } finally { await running.close(); }
});


test("proposed step bridge is read-only and validates session, kind and frozen evidence without generation", async () => {
  const { loadCuratedC3Context } = await import("../../src/c3/curated-context.ts");
  const { loadC3AccountContext } = await import("../../src/c3/context.ts");
  const contexts = [await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri"),
    await loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" })];
  for (const ctx of contexts) {
    const running = await startC3Server({ context: ctx, provider: new DisabledC3ModelProvider(), listen: false, expectedHost: HOST });
    try {
      const browser = await browserSession(running);
      const proposal = { concern: "Exact concern", action: "Authored action", owner: "", targetDate: "", questionOrBlocker: "", evidenceIds: [ctx.context.admittedSources[0]!.excerpts[0]!.evidenceId] };
      const route = "/api/planning/next-steps";
      await browser.post("/api/planning/strategy", { version: 0, section: "decision", text: "Separate strategy suggestion" });
      const before = await requestTo(running, "GET", "/?kind=next-steps&from=strategy", undefined, { cookie: browser.cookie });
      assert.match(before.text, /Separate strategy suggestion/);
      assert.match(before.text, /No proposed next step kept/);
      assert.equal((await browser.post(route, { version: 0, proposedNextStep: proposal }, { "x-c3-csrf": "bad" })).status, 403);
      assert.equal((await browser.post("/api/planning/strategy", { version: 1, proposedNextStep: proposal })).status, 409);
      assert.equal((await browser.post(route, { version: 0, proposedNextStep: { ...proposal, evidenceIds: [contexts.find((other) => other !== ctx)!.context.admittedSources[0]!.excerpts[0]!.evidenceId] } })).status, 409);
      assert.equal((await browser.post(route, { version: 0, proposedNextStep: proposal })).status, 200);
      const saved = await requestTo(running, "GET", "/?kind=next-steps", undefined, { cookie: browser.cookie });
      const bridge = await requestTo(running, "GET", "/?kind=next-steps&from=strategy", undefined, { cookie: browser.cookie });
      assert.match(bridge.text, /Authored action/); assert.match(bridge.text, /Separate strategy suggestion/);
      assert.equal((await requestTo(running, "GET", "/?kind=next-steps", undefined, { cookie: browser.cookie })).text, saved.text);
      assert.equal(JSON.parse((await browser.post(route, { version: 1, proposedNextStep: proposal })).text).noChange, true);
      assert.equal(running.status().generationAttempted, 0);
    } finally { await running.close(); }
  }
});

test("Brief contextual citations select support by originating statement and collapse collection", async () => {
  const ctx = await context();
  const value = JSON.parse(candidate(ctx));
  const excerpt = ctx.context.admittedSources[0]!.excerpts[0]!;
  value.opening = { text: excerpt.exactExcerpt, evidenceRefs: [excerpt.evidenceId], supportCategory: 'direct_support' };
  const record = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), JSON.stringify(value), ctx);
  const html = renderC3Page(ctx, { page: 'draft', record, correctionNote: '' }, 'csrf');
  assert.match(html, /data-context="Opening" data-support="Direct supporting evidence"/);
  assert.match(html, /data-context="Question 2" data-support="Related evidence context"/);
  assert.match(html, /<details class="evidence-list"[^>]*><summary id="evidence-heading">Evidence behind the brief<\/summary>/);
  assert.match(html, /<dialog[^>]*data-evidence-dialog/);
  assert.doesNotMatch(html, /No user note for this section/);
  assert.match(html, /data-saved-copy class="user-copy" hidden/);
});
test("Brief heading reflects actual question count without changing source or note phrases", async () => {
  const ctx = await context();
  const value = JSON.parse(candidate(ctx));
  value.questions.push({ ...value.questions[0], question: 'What else should we learn?' });
  const record = createGenerationRecord(createC3ModelRequest(ctx, { ...meetingRequest, durationMinutes: 30 }), JSON.stringify(value), ctx);
  const note = 'Three questions, in order · No user note for this section.';
  const html = renderC3Page(ctx, { page: 'draft', record, correctionNote: note, sectionNotes: { Opening: note } }, 'csrf');
  assert.match(html, /id="questions-heading">4 questions/);
  assert.ok(html.includes('User note · ' + note));
});
test("Responsible AI source heading is structural even when source title contains renderer phrases", async () => {
  const ctx = structuredClone(await context());
  const selectedId = 'evidence_2e20762caf4b11701059';
  const source = ctx.context.admittedSources.find(s => s.excerpts.some(e => e.evidenceId === selectedId))!;
  Object.assign(source, { title: 'Three questions, in order · No user note for this section.' });
  const base = createGenerationRecord(createC3ModelRequest(ctx, meetingRequest), candidate(ctx), ctx);
  const record = { ...base, draft: { ...base.draft!, selectedEvidenceRefs: [selectedId] } };
  const html = renderC3Page(ctx, { page: 'draft', record, correctionNote: '' }, 'csrf');
  assert.match(html, /data-evidence-content[^>]*>[\s\S]*?Source section:<\/strong> Responsible AI/);
  assert.ok(html.includes(source.title));
});

test("Refine stage and generation acknowledge owned continuous revision and computed differences", async () => {
  const ctx = await context(); let calls = 0;
  const running = await harness({ name: "synthetic-refine", executionMode: "local", async generate() {
    calls++; const raw = JSON.parse(candidate(ctx)); if (calls > 1) raw.opening.text = "Ask about the next decision."; return JSON.stringify(raw);
  } });
  try {
    const browser = await browserSession(running);
    const first = JSON.parse((await browser.post("/api/generate", meetingRequest)).text);
    assert.equal(first.outcome, "succeeded");
    const stage = JSON.parse((await browser.rawPost("/api/revise", { recordId: first.recordId, priorNote: "", note: "Improve the opening." })).text);
    assert.equal(stage.revisionReady, true); assert.deepEqual(stage.request, meetingRequest);
    assert.equal(stage.recordId, first.recordId); assert.equal(stage.savedNote, ""); assert.equal(stage.instruction, "Improve the opening.");
    const operation = { request: stage.request, recordId: stage.recordId, pendingRevisionToken: stage.pendingRevisionToken, operationId: randomBytes(24).toString("base64url") };
    const wrong = await browser.rawPost("/api/generate", { ...operation, request: { ...meetingRequest, audience: "Other audience" } });
    assert.equal(wrong.status, 409); assert.equal(calls, 1);
    const next = JSON.parse((await browser.rawPost("/api/generate", operation)).text);
    assert.equal(next.outcome, "succeeded"); assert.deepEqual(next.operation, operation);
    assert.equal(next.savedNote, stage.savedNote); assert.equal(next.recordId, first.recordId); assert.notEqual(next.proposalId, first.recordId); assert.equal(next.proposalReady, true);
    assert.deepEqual(next.changedSections, ["Opening"]); assert.deepEqual(next.sectionNotes, {});
  } finally { await running.close(); }
});

test("continuous Refine program has no document rewrite and uses explicit outcome protocol", () => {
  assert.doesNotMatch(C3_CLIENT_SCRIPT, /document\.(?:open|write|close)\(/);
  assert.match(C3_CLIENT_SCRIPT, /revisionReady/); assert.match(C3_CLIENT_SCRIPT, /payload\.outcome/);
  assert.match(C3_CLIENT_SCRIPT, /rebindSectionNotes/);
});

test("workspace routes retain session identity and disabled generation is visible before submission", async () => {
  const running = await startC3Server({ context: await context(), provider: new DisabledC3ModelProvider(), listen: false, expectedHost: HOST });
  try {
    const browser = await browserSession(running);
    for (const [url, selected] of [["/", "overview"], ["/account?view=research&topic=people", "research"], ["/?view=research&topic=technology&reading=redtail-platform", "research"], ["/?view=workshop", "workshop"], ["/?prepare=1", "workshop"], ["/?kind=strategy", "workshop"]]) {
      const response = await requestTo(running, "GET", url!, undefined, { cookie: browser.cookie });
      assert.equal(response.status, 200, url);
      assert.ok(response.text.includes(`id="journey-${selected}"`));
      assert.match(response.text, new RegExp(`id="journey-${selected}"[^>]*aria-current="page"`));
      assert.ok(response.text.includes(`name="c3-csrf" content="${browser.csrf}"`));
      assert.equal(response.headers.has("set-cookie"), false);
    }
    const prepare = await requestTo(running, "GET", "/?prepare=1", undefined, { cookie: browser.cookie });
    assert.match(prepare.text, /Generation unavailable\. This server has no configured model provider/);
    assert.match(prepare.text, /data-generation-available="false"/);
    assert.match(prepare.text, /<button type="submit" disabled hidden>Prepare brief<\/button>/);
    for (const query of ["view=unknown", "view=research&topic=unknown", "view=research&reading=%3Cscript%3E"]) {
      assert.equal((await requestTo(running, "GET", `/?${query}`, undefined, { cookie: browser.cookie })).status, 400);
    }
    assert.equal(running.status().generationSucceeded, 0);
  } finally { await running.close(); }
});

test('title route rejects hostile bodies, cross-origin/CSRF requests and oversized input without changing work', async()=>{
 const ctx=await context();const running=await harness({name:'external-label-only',executionMode:'external',async generate(){return candidate(ctx);}});
 try{
  const browser=await browserSession(running);const first=JSON.parse((await browser.post('/api/generate',meetingRequest)).text);
  const state=JSON.parse((await browser.rawPost('/api/work-state',{})).text);
  assert.equal(state.origin,'unknown');
  const body={recordId:first.recordId,workVersion:state.workVersion,title:'New title'};
  const deniedHeaders:Record<string,string>[]=[{origin:'http://evil.example'},{'x-c3-csrf':'wrong'},{'content-type':'text/plain'}];
  for(const headers of deniedHeaders)assert.equal((await browser.rawPost('/api/work/title',body,headers)).status,403);
  for(const hostile of [null,[],{...body,origin:'live'},{...body,generationContractVersion:'3'},{...body,title:'\u0000'},Buffer.from('{not-json'),Buffer.from('x'.repeat(17000))])assert.equal((await browser.rawPost('/api/work/title',hostile)).status,400);
  assert.deepEqual(JSON.parse((await browser.rawPost('/api/work-state',{})).text),state);
  assert.equal((await browser.rawPost('/api/work/title',body)).status,200);
 }finally{await running.close();}
});

test('v6 verifier refusal leaves original, instruction and kept note intact; no proposal can be applied', async () => {
  const ctx = await context(); let generations = 0, verifications = 0;
  const running = await harness({name:'scripted-evidence-check',executionMode:'local',async generate(){generations++;return candidate(ctx);},
    async verify(request) {
      const result = JSON.parse(scriptedFullCoverage(request));
      if (++verifications === 2) {
        const finding = result.findings.find((item:any)=>item.path==='questions[1].question');
        finding.verdict='insufficient';finding.reason='Scripted unsupported-presupposition fixture, not a semantic-model result.';
      }
      return JSON.stringify(result);
    }});
  try {
    const browser = await browserSession(running);
    const first = JSON.parse((await browser.post('/api/generate',meetingRequest)).text);
    const recordId = first.recordId;
    await browser.post('/api/note',{recordId,note:'Keep the original note.'});
    const staged = JSON.parse((await browser.post('/api/revise',{recordId,note:'Explore whether the reported work matters.'})).text);
    const refused = await browser.post('/api/generate',meetingRequest);
    assert.equal(refused.status,422);
    assert.match(JSON.parse(refused.text).error,/contradicted or insufficiently supported/);
    const page = await requestTo(running,'GET','/?draft=1',undefined,{cookie:browser.cookie});
    assert.ok(page.text.includes(recordId));assert.match(page.text,/Keep the original note/);
    assert.match(page.text,/Explore whether the reported work matters/);
    assert.equal((await browser.post('/api/apply-revision',{recordId,proposalId:recordId,instruction:'Explore whether the reported work matters.',pendingRevisionToken:staged.pendingRevisionToken})).status,409);
    assert.equal(generations,2);assert.equal(verifications,2);assert.equal(running.status().generationRefused,1);
  } finally {await running.close();}
});

test('unconfigured external verification/audit is visibly unavailable and cannot spend', async () => {
  const ctx = await context();let calls=0;
  const running = await startC3Server({context:ctx,provider:{name:'operator-command',executionMode:'external',async generate(){calls++;return candidate(ctx);}},listen:false,expectedHost:HOST});
  try {
    const browser = await browserSession(running);
    const prepare=await requestTo(running,'GET','/?prepare=1',undefined,{cookie:browser.cookie});
    assert.match(prepare.text,/Fresh generation unavailable/);
    const response=await browser.post('/api/generate',meetingRequest);
    assert.equal(response.status,502);assert.equal(calls,0);
  } finally {await running.close();}
});
