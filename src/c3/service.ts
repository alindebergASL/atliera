import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { isCuratedContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, snapshotMeetingFormState, snapshotMeetingRequest,
  type C3GenerationRecord, type C3MeetingFormState, type C3MeetingRequest, type C3RevisionContext } from "./draft.ts";
import type { C3ModelProvider } from "./provider.ts";
import { boundedPlanningText, MEETING_NOTE_SECTIONS, newPlanningBrief, updatePlanningBrief, type PlanningBrief, type PlanningKind } from "./planning.ts";
import { renderC3Page } from "./render.ts";

type GenerationEventKind = "attempted" | "succeeded" | "refused" | "cancelled" | "failed";
interface GenerationEvent { readonly kind: GenerationEventKind; readonly sequence: number; }

interface Session {
  readonly id: string;
  readonly csrf: string;
  form: C3MeetingFormState;
  record?: C3GenerationRecord;
  correctionNote: string;
  planning: Record<PlanningKind, PlanningBrief>;
  sectionNotes: Record<string, string>;

  pendingPriorNote: string | null;
  pendingRevision: C3RevisionContext | null;
  pendingRevisionToken: string | null;
  revisionNumber: number;
  sequence: number;
  operations: Set<string>;
  active?: { readonly operationId: string; readonly controller: AbortController; readonly sequence: number; readonly settled: Promise<void> };
}

export interface C3ServiceStatus {
  readonly provider: string;
  readonly generationAttempted: number;
  readonly generationSucceeded: number;
  readonly generationRefused: number;
  readonly generationCancelled: number;
  readonly generationFailed: number;
  readonly c2Implementation: "complete";
  readonly ownerDisposition: "recorded" | "absent";
  readonly customerAvailability: "local_prototype_only";
}

export interface C3ServerOptions {
  readonly context: FrozenC3AccountContext;
  readonly provider: C3ModelProvider;
  readonly port?: number;
  /** Labels hand-authored local fixtures; never changes request matching. */
  readonly syntheticPreview?: boolean;
  readonly now?: () => Date;
  /** Test seam: create the real HTTP request handler without opening a socket. */
  readonly listen?: boolean;
  readonly expectedHost?: string;
  /** Validated operator recordings used only to prefill and explain an exact local replay. */
  readonly recordedReplay?: {
    readonly initialRequest: C3MeetingRequest;
    readonly correctionNote: string;
  };
}

export interface RunningC3Server {
  readonly server: Server;
  readonly origin: string;
  readonly status: () => C3ServiceStatus;
  close(): Promise<void>;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body),
    "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}

function html(res: ServerResponse, status: number, value: string, scriptHash: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(value),
    "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    "content-security-policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'` });
  res.end(value);
}

function cookieValue(req: IncomingMessage, name: string): string | undefined {
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").map((item) => item.trim().split("=")).find(([key]) => key === name)?.[1];
}

function sessionCookieName(expectedHost: string): string {
  const port = new URL(`http://${expectedHost}`).port;
  if (!/^[0-9]+$/u.test(port)) throw new Error("local service host must include a bound port");
  // Cookie names prevent same-host local services from overwriting browser state; they are not a security boundary.
  return `c3sid_${port}`;
}

function nextMeetingDate(now: Date): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function newSession(now: () => Date, initialRequest?: C3MeetingRequest): Session {
  return { id: randomBytes(24).toString("base64url"), csrf: randomBytes(24).toString("base64url"),
    form: initialRequest ?? { audience: "", intendedOutcome: "", durationMinutes: 15, meetingDate: nextMeetingDate(now()) },
    planning: { strategy: newPlanningBrief("strategy"), "next-steps": newPlanningBrief("next-steps") }, sectionNotes: {},
    correctionNote: "", pendingPriorNote: null, pendingRevision: null, pendingRevisionToken: null, revisionNumber: 0, sequence: 0, operations: new Set() };
}

function parseRequestTarget(rawTarget: string | undefined, expectedHost: string): URL {
  const target = rawTarget ?? "/";
  const path = target.split("?", 1)[0]!;
  if (!target.startsWith("/") || target.startsWith("//") || path.includes("//") || target.includes("\\") || target.includes("#")) {
    throw new Error("malformed request target");
  }
  const parsed = new URL(target, `http://${expectedHost}`);
  if (parsed.origin !== `http://${expectedHost}`) throw new Error("absolute request target refused");
  return parsed;
}

function readJson(req: IncomingMessage, maxBytes = 16 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) { reject(new Error("request body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes));
        resolve(JSON.parse(decoded));
      } catch { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function count(events: readonly GenerationEvent[], kind: GenerationEventKind): number {
  return events.filter((event) => event.kind === kind).length;
}

function pendingPageState(session: Session): { readonly revisionPending: true; readonly pendingRevisionToken: string } |
  { readonly revisionPending: false } {
  if (session.pendingRevision !== null && session.pendingRevisionToken !== null) {
    return { revisionPending: true, pendingRevisionToken: session.pendingRevisionToken };
  }
  return { revisionPending: false };
}

function submittedPendingRevisionToken(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const token = (value as Record<string, unknown>).pendingRevisionToken;
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/u.test(token) ? token : undefined;
}

export async function startC3Server(options: C3ServerOptions): Promise<RunningC3Server> {
  if (isCuratedContext(options.context) && options.recordedReplay !== undefined) throw new Error("Agent-curated context cannot claim recorded replay");
  const sessions = new Map<string, Session>();
  const events: GenerationEvent[] = [];
  const now = options.now ?? (() => new Date());
  const { C3_SCRIPT_SHA256 } = await import("./render.ts");
  const render = (state: Parameters<typeof renderC3Page>[1], csrf: string): string => renderC3Page(options.context, state.page === "draft" ? { ...state, sectionNotes: [...sessions.values()].find((session) => session.csrf === csrf)?.sectionNotes ?? {} } : state.page === "prepare" ? { ...state, displayedRecordId: [...sessions.values()].find((session) => session.csrf === csrf)?.record?.recordId ?? null } : state, csrf,
    options.recordedReplay === undefined ? undefined : { correctionNote: options.recordedReplay.correctionNote,
      initialRequest: options.recordedReplay.initialRequest, syntheticPreview: options.syntheticPreview });
  let expectedHost = "";

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const host = req.headers.host;
    if (host !== expectedHost) { json(res, 400, { error: "host refused" }); return; }
    let url: URL;
    try { url = parseRequestTarget(req.url, expectedHost); }
    catch { json(res, 400, { error: "malformed request target" }); return; }
    if (url.pathname === "/healthz" && req.method === "GET") {
      json(res, 200, status()); return;
    }
    const cookieName = sessionCookieName(expectedHost);
    const sessionId = cookieValue(req, cookieName);
    let session = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (session === undefined && req.method === "GET" && (url.pathname === "/" || url.pathname === "/account")) {
      if (sessions.size >= 64) { json(res, 503, { error: "local session limit reached; restart the prototype to clear session memory" }); return; }
      session = newSession(now, options.recordedReplay?.initialRequest); sessions.set(session.id, session);
      res.setHeader("set-cookie", `${cookieName}=${session.id}; HttpOnly; SameSite=Strict; Path=/`);
    }
    if (session === undefined) { json(res, 401, { error: "session required" }); return; }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/account")) {
      const hasDraft = session.record?.draft !== undefined;
      const kind = url.searchParams.get("kind");
      if (kind !== null) {
        if (kind !== "strategy" && kind !== "next-steps") { json(res, 400, { error: "Unknown brief kind" }); return; }
        html(res, 200, render({ page: "planning", brief: session.planning[kind], hasDraft }, session.csrf), C3_SCRIPT_SHA256); return;
      }
      const pending = pendingPageState(session);
      if (url.searchParams.get("draft") === "1") {
        if (!hasDraft) {
          html(res, 409, render({ page: "prepare", request: session.form,
            error: "No session draft is available. Keep or edit these inputs and prepare a new draft." }, session.csrf), C3_SCRIPT_SHA256);
          return;
        }
        html(res, 200, render({ page: "draft", record: session.record!,
          correctionNote: session.correctionNote, ...pending }, session.csrf), C3_SCRIPT_SHA256); return;
      }
      const page = url.searchParams.get("prepare") === "1" ?
        { page: "prepare" as const, request: session.form, hasDraft, correctionNote: session.correctionNote, ...pending } :
        { page: "home" as const, hasDraft, ...pending };
      html(res, 200, render(page, session.csrf), C3_SCRIPT_SHA256); return;
    }
    if (req.method !== "POST" || !url.pathname.startsWith("/api/")) { json(res, 404, { error: "not found" }); return; }
    if (req.headers.origin !== `http://${expectedHost}` || req.headers["x-c3-csrf"] !== session.csrf ||
        !/^application\/json(?:;|$)/iu.test(req.headers["content-type"] ?? "")) {
      json(res, 403, { error: "same-origin session guard refused request" }); return;
    }
    let body: unknown;
    try { body = await readJson(req); } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : "invalid request" }); return; }
    if (url.pathname.startsWith("/api/planning/")) {
      const kind = url.pathname.slice("/api/planning/".length);
      if (kind !== "strategy" && kind !== "next-steps") { json(res, 400, { error: "Unknown brief kind" }); return; }
      if (options.context.context.ownerCorrections.some((item) => item.text.includes("not enabled"))) {
        json(res, 409, { error: "account preparation is held pending the recorded C2 revision" }); return;
      }
      try {
        const result = updatePlanningBrief(session.planning[kind], body);
        session.planning[kind] = result.brief;
        json(res, 200, { version: result.brief.version, noChange: result.noChange,
          status: result.noChange ? "No change. Existing session text kept." : `Session edit kept · version ${result.brief.version}. No account truth, approval, or durable save changed.` });
      } catch (error) { json(res, 409, { error: error instanceof Error ? error.message : "Planning edit refused" }); }
      return;
    }
    if (url.pathname === "/api/section-note") {
      const displayedRecordId = submittedRecordId(body);
      if (displayedRecordId === undefined || session.active !== undefined || session.pendingRevision !== null ||
          session.record?.draft === undefined || session.record.recordId !== displayedRecordId) {
        json(res, 409, { error: "Displayed draft is stale or revision is pending. Reopen the current draft before keeping a section note." }); return;
      }
      try {
        const value = body as Record<string, unknown>;
        if (Object.keys(value).sort().join(",") !== "priorText,recordId,section,text" ||
            !MEETING_NOTE_SECTIONS.includes(value.section as typeof MEETING_NOTE_SECTIONS[number])) throw new Error("Invalid section note");
        const section = value.section as string;
        const text = boundedPlanningText(value.text, 1000);
        const prior = session.sectionNotes[section] ?? "";
        if (value.priorText !== prior) throw new Error("Section note is stale. Copy your unsaved text and reopen the current draft.");
        session.sectionNotes[section] = text;
        json(res, 200, { noChange: text === prior, status: text === prior ? "Note unchanged. Already kept for this session." :
          text === "" ? "Section note cleared. Recorded text unchanged." : "Section note kept for this session. Recorded text unchanged; no revision requested." });
      } catch (error) { json(res, 409, { error: error instanceof Error ? error.message : "Section note refused" }); }
      return;
    }
    if (url.pathname === "/api/cancel") {
      const operation = operationEnvelope(body);
      if (operation === undefined || !matchesDisplayedState(session, operation)) {
        json(res, 409, { error: "Displayed operation state is missing or stale. Current session work was kept." }); return;
      }
      const active = session.active;
      if (active?.operationId !== operation.operationId) {
        if (active !== undefined || session.operations.has(operation.operationId) || session.operations.size >= 256) {
          json(res, 409, { error: "This page does not own the active operation. Current session work was kept." }); return;
        }
        // Remember cancellation arriving before generation; do not replace any session form.
        session.operations.add(operation.operationId);
        json(res, 200, { status: "No local work started for this operation. Current page inputs are kept." }); return;
      }
      let form: C3MeetingFormState;
      try { form = snapshotMeetingFormState(operation.request); } catch {
        json(res, 400, { error: "invalid form state" }); return;
      }
      session.form = form;
      session.sequence += 1;
      active.controller.abort(); events.push({ kind: "cancelled", sequence: session.sequence }); await active.settled;
      const status = options.provider.executionMode === "local" ?
        "Local generation stopped. Current form text is ready to edit or submit again. No remote model work was started." :
        "Local generation stopped. Current form text is ready to edit or submit again; remote billed-work status may be unknown.";
      json(res, 200, { status }); return;
    }
    if (url.pathname === "/api/note") {
      const displayedRecordId = submittedRecordId(body);
      if (displayedRecordId === undefined || session.active !== undefined || session.pendingRevision !== null || session.record?.draft === undefined ||
          session.record.recordId !== displayedRecordId) {
        json(res, 409, { error: "Displayed draft identity is missing or stale. Reopen the current session draft before keeping a note." }); return;
      }
      if ((body as Record<string, unknown>).priorNote !== session.correctionNote) {
        json(res, 409, { error: "Saved note baseline is missing or stale. Copy your typed text and reopen the current draft." }); return;
      }
      let action: ReviewAction;
      try { action = reviewAction(body); } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "invalid correction note" }); return;
      }
      const noChange = session.correctionNote === action.note;
      session.correctionNote = action.note;
      json(res, 200, { noChange, savedNote: action.note, status: noChange ? "Note unchanged. Already kept for this session." :
        "Note kept for this session. It is not approval or durable storage.", html: render({ page: "draft", record: session.record,
        correctionNote: action.note, revisionPending: false }, session.csrf), location: "/?draft=1", history: "replace" }); return;
    }
    if (url.pathname === "/api/discard-revision") {
      const displayedRecordId = submittedRecordId(body);
      const pendingRevisionToken = submittedPendingRevisionToken(body);
      if (displayedRecordId === undefined || session.active !== undefined || session.pendingRevision === null ||
          session.record?.draft === undefined || session.record.recordId !== displayedRecordId ||
          pendingRevisionToken === undefined || pendingRevisionToken !== session.pendingRevisionToken) {
        json(res, 409, { error: "Pending revision identity is missing or stale. Reopen the current session draft before discarding it." }); return;
      }
      session.sequence += 1;
      session.pendingRevision = null;
      session.pendingRevisionToken = null;
      session.correctionNote = session.pendingPriorNote ?? session.correctionNote;
      session.pendingPriorNote = null;
      json(res, 200, { html: render({ page: "draft", record: session.record, correctionNote: session.correctionNote,
        revisionPending: false }, session.csrf), location: "/?draft=1", history: "replace" }); return;
    }
    if (url.pathname === "/api/revise") {
      const displayedRecordId = submittedRecordId(body);
      if (displayedRecordId === undefined || session.active !== undefined || session.pendingRevision !== null || session.record?.draft === undefined ||
          session.record.recordId !== displayedRecordId) {
        json(res, 409, { error: "Displayed draft identity is missing or stale. Reopen the current session draft before requesting revision." }); return;
      }
      if ((body as Record<string, unknown>).priorNote !== session.correctionNote) {
        json(res, 409, { error: "Saved note baseline is missing or stale. Copy your typed text and reopen the current draft." }); return;
      }
      let action: ReviewAction;
      try { action = reviewAction(body); } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "invalid correction note" }); return;
      }
      const prior = session.record;
      if (action.note.trim().length === 0 || action.note === prior.revision?.correctionNote) {
        json(res, 200, { noChange: true, status: action.note.trim().length === 0 ?
          "No revision requested. Add a correction first; the current draft and note are unchanged." :
          "Correction unchanged from the one already used for this draft. No revision requested; draft and note kept." }); return;
      }
      const revisionNumber = (prior.revision?.revisionNumber ?? 0) + 1;
      let revision: C3RevisionContext;
      try { revision = createC3RevisionContext(prior, action.note, revisionNumber); }
      catch {
        json(res, 400, { error: "Use at least three characters with no leading or trailing whitespace for a revision. Your draft and saved note were kept." }); return;
      }
      session.sequence += 1;
      session.revisionNumber = revisionNumber;
      session.pendingPriorNote = session.correctionNote;
      session.correctionNote = action.note;
      session.pendingRevision = revision;
      const pendingRevisionToken = randomBytes(24).toString("base64url");
      session.pendingRevisionToken = pendingRevisionToken;
      session.form = prior.meetingRequest;
      json(res, 200, { html: render({ page: "prepare", request: session.form,
        error: `Revision ${String(session.revisionNumber)} will include the exact session correction and prior raw/draft identity.`,
        correctionNote: session.correctionNote, hasDraft: true, revisionPending: true,
        pendingRevisionToken }, session.csrf),
        location: "/?prepare=1", history: "replace" }); return;
    }
    if (url.pathname !== "/api/generate") { json(res, 404, { error: "not found" }); return; }
    if (isCuratedContext(options.context)) {
      json(res, 409, { error: "Agent-curated context is template-only; no live generation or recorded-model response is available. Use Strategy or Next steps." }); return;
    }
    const operation = operationEnvelope(body);
    if (operation === undefined || !matchesDisplayedState(session, operation) ||
        session.operations.has(operation.operationId) || session.operations.size >= 256) {
      json(res, 409, { error: "Displayed generation state is missing, stale, or already used. Reopen Prepare before submitting." }); return;
    }
    let request: C3MeetingRequest;
    try { request = snapshotMeetingRequest(operation.request); } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : "invalid meeting request" }); return;
    }
    if (options.context.context.ownerCorrections.some((item) => item.text.includes("not enabled"))) {
      json(res, 409, { error: "account preparation is held pending the recorded C2 revision" }); return;
    }
    session.operations.add(operation.operationId);
    // Reopening is an exact comparison against the current successful record, never a replay fallback.
    // Active work and pending corrections retain their existing cancellation/identity paths.
    if (session.active === undefined && session.pendingRevision === null && session.record?.draft !== undefined &&
        sameMeetingRequest(session.record.meetingRequest, request)) {
      session.form = request;
      const status = "Meeting inputs unchanged. Reopened the existing session draft; no new generation. Your note is kept.";
      json(res, 200, { noChange: true, status, html: render({ page: "draft", record: session.record,
        correctionNote: session.correctionNote, notice: status, revisionPending: false }, session.csrf),
        location: "/?draft=1", history: "push" }); return;
    }
    session.form = request;
    // Claim ownership before yielding: concurrent replacements may await the same
    // predecessor, but only the newest request (unless cancelled) may start work.
    session.sequence += 1;
    const sequence = session.sequence;
    const previous = session.active;
    const controller = new AbortController();
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => { resolveSettled = resolve; });
    const onResponseClose = (): void => { if (!res.writableEnded) controller.abort(); };
    res.once("close", onResponseClose);
    session.active = { operationId: operation.operationId, controller, sequence, settled };
    try {
      if (previous !== undefined) { previous.controller.abort(); await previous.settled; }
      if (session.sequence !== sequence || controller.signal.aborted || res.destroyed) {
        if (!res.writableEnded && !res.destroyed) json(res, 409, { error: "stale generation discarded" });
        return;
      }
      events.push({ kind: "attempted", sequence });
      const revision = session.pendingRevision;
      const modelRequest = createC3ModelRequest(options.context, request, revision);
      const raw = await options.provider.generate(modelRequest, controller.signal);
      const generation = createGenerationRecord(modelRequest, raw, options.context);
      if (session.sequence !== sequence || controller.signal.aborted) {
        if (!res.writableEnded) json(res, 409, { error: "stale generation discarded" });
        return;
      }
      if (generation.outcome === "refused") {
        events.push({ kind: "refused", sequence });
        const page = render({ page: "prepare", request,
          error: `Candidate refused without repair: ${generation.refusal!.message}`,
          hasDraft: session.record?.draft !== undefined, correctionNote: session.correctionNote,
          ...pendingPageState(session) }, session.csrf);
        json(res, 422, { html: page, location: "/?prepare=1", history: "replace", refusal: generation.refusal }); return;
      }
      if (revision === null) session.sectionNotes = {};
      session.record = generation;
      session.correctionNote = revision?.correctionNote ?? "";
      session.pendingRevision = null;
      session.pendingRevisionToken = null;
      session.pendingPriorNote = null;
      events.push({ kind: "succeeded", sequence });
      json(res, 200, { html: render({ page: "draft", record: generation, correctionNote: session.correctionNote,
        revisionPending: false }, session.csrf),
        location: "/?draft=1", history: "push" });
    } catch (error) {
      if (session.sequence !== sequence || controller.signal.aborted) {
        if (!res.writableEnded) json(res, 409, { error: "stale generation discarded" });
        return;
      }
      events.push({ kind: "failed", sequence });
      const message = error instanceof Error ? error.message : "generation failed";
      json(res, 502, { html: render({ page: "prepare", request, error: message,
        hasDraft: session.record?.draft !== undefined, correctionNote: session.correctionNote,
        ...pendingPageState(session) }, session.csrf),
        location: "/?prepare=1", history: "replace", error: message });
    } finally {
      res.off("close", onResponseClose);
      if (session.active?.sequence === sequence) session.active = undefined;
      resolveSettled();
    }
  };

  const server = createServer((req, res) => {
    void handleRequest(req, res).catch(() => {
      if (res.writableEnded || res.destroyed) return;
      if (res.headersSent) res.destroy();
      else json(res, 500, { error: "bounded request handling failure" });
    });
  });

  const status = (): C3ServiceStatus => ({ provider: isCuratedContext(options.context) ? "disabled_curated_template_only" : options.provider.name,
    generationAttempted: count(events, "attempted"), generationSucceeded: count(events, "succeeded"),
    generationRefused: count(events, "refused"), generationCancelled: count(events, "cancelled"),
    generationFailed: count(events, "failed"), c2Implementation: "complete", ownerDisposition: options.context.context.ownerDecisionSource === null ? "absent" : "recorded",
    customerAvailability: "local_prototype_only" });
  if (options.listen === false) {
    expectedHost = options.expectedHost ?? "127.0.0.1:4317";
  } else {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port ?? 0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("local server did not bind a TCP port");
    expectedHost = `127.0.0.1:${String(address.port)}`;
  }
  return { server, origin: `http://${expectedHost}`, status,
    close: async () => {
      const active = [...sessions.values()].flatMap((session) => session.active === undefined ? [] : [session.active]);
      for (const generation of active) generation.controller.abort();
      await Promise.all(active.map((generation) => generation.settled));
      if (!server.listening) return;
      await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
    } };
}

interface ReviewAction { readonly note: string; readonly recordId: string; }

function submittedRecordId(value: unknown): string | undefined {
  if (value === null || Array.isArray(value) || typeof value !== "object") return undefined;
  const recordId = (value as Record<string, unknown>).recordId;
  return typeof recordId === "string" && /^c3_[a-f0-9]{24}$/u.test(recordId) ? recordId : undefined;
}

function reviewAction(value: unknown): ReviewAction {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error("invalid request");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).sort().join(",") !== "note,priorNote,recordId" || typeof root.note !== "string" || root.note.length > 1_000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(root.note) || submittedRecordId(root) === undefined) {
    throw new Error("invalid correction note");
  }
  return { note: root.note, recordId: root.recordId as string };
}

function sameMeetingRequest(left: C3MeetingRequest, right: C3MeetingRequest): boolean {
  return left.audience === right.audience && left.intendedOutcome === right.intendedOutcome &&
    left.durationMinutes === right.durationMinutes && left.meetingDate === right.meetingDate;
}

interface OperationEnvelope { readonly request: unknown; readonly operationId: string; readonly recordId: string | null; readonly pendingRevisionToken: string | null; }
function operationEnvelope(value: unknown): OperationEnvelope | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const root = value as Record<string, unknown>;
  if (Object.keys(root).sort().join(",") !== "operationId,pendingRevisionToken,recordId,request" ||
      typeof root.operationId !== "string" || !/^[A-Za-z0-9_-]{32,64}$/u.test(root.operationId) ||
      !(root.recordId === null || submittedRecordId(root) !== undefined) ||
      !(root.pendingRevisionToken === null || submittedPendingRevisionToken(root) !== undefined)) return undefined;
  return root as unknown as OperationEnvelope;
}
function matchesDisplayedState(session: Session, operation: OperationEnvelope): boolean {
  return operation.recordId === (session.record?.recordId ?? null) && operation.pendingRevisionToken === session.pendingRevisionToken;
}
