import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { FrozenC3AccountContext } from "./context.ts";
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, snapshotMeetingFormState, snapshotMeetingRequest,
  type C3GenerationRecord, type C3MeetingFormState, type C3MeetingRequest, type C3RevisionContext } from "./draft.ts";
import type { C3ModelProvider } from "./provider.ts";
import { renderC3Page } from "./render.ts";

type GenerationEventKind = "attempted" | "succeeded" | "refused" | "cancelled" | "failed";
interface GenerationEvent { readonly kind: GenerationEventKind; readonly sequence: number; }

interface Session {
  readonly id: string;
  readonly csrf: string;
  form: C3MeetingFormState;
  record?: C3GenerationRecord;
  correctionNote: string;
  pendingRevision: C3RevisionContext | null;
  revisionNumber: number;
  sequence: number;
  active?: { readonly controller: AbortController; readonly sequence: number; readonly settled: Promise<void> };
}

export interface C3ServiceStatus {
  readonly provider: string;
  readonly generationAttempted: number;
  readonly generationSucceeded: number;
  readonly generationRefused: number;
  readonly generationCancelled: number;
  readonly generationFailed: number;
  readonly c2Implementation: "complete";
  readonly ownerDisposition: "recorded";
  readonly customerAvailability: "local_prototype_only";
}

export interface C3ServerOptions {
  readonly context: FrozenC3AccountContext;
  readonly provider: C3ModelProvider;
  readonly port?: number;
  readonly now?: () => Date;
  /** Test seam: create the real HTTP request handler without opening a socket. */
  readonly listen?: boolean;
  readonly expectedHost?: string;
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

function nextMeetingDate(now: Date): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function newSession(now: () => Date): Session {
  return { id: randomBytes(24).toString("base64url"), csrf: randomBytes(24).toString("base64url"),
    form: { audience: "", intendedOutcome: "", durationMinutes: 15, meetingDate: nextMeetingDate(now()) },
    correctionNote: "", pendingRevision: null, revisionNumber: 0, sequence: 0 };
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

function readBody(req: IncomingMessage, maxBytes = 16 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) { reject(new Error("request body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"))); } catch { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function count(events: readonly GenerationEvent[], kind: GenerationEventKind): number {
  return events.filter((event) => event.kind === kind).length;
}

export async function startC3Server(options: C3ServerOptions): Promise<RunningC3Server> {
  const sessions = new Map<string, Session>();
  const events: GenerationEvent[] = [];
  const now = options.now ?? (() => new Date());
  const { C3_SCRIPT_SHA256 } = await import("./render.ts");
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
    let session = cookieValue(req, "c3sid") === undefined ? undefined : sessions.get(cookieValue(req, "c3sid")!);
    if (session === undefined && req.method === "GET" && (url.pathname === "/" || url.pathname === "/account")) {
      if (sessions.size >= 64) { json(res, 503, { error: "local session limit reached; restart the prototype to clear session memory" }); return; }
      session = newSession(now); sessions.set(session.id, session);
      res.setHeader("set-cookie", `c3sid=${session.id}; HttpOnly; SameSite=Strict; Path=/`);
    }
    if (session === undefined) { json(res, 401, { error: "session required" }); return; }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/account")) {
      const page = url.searchParams.get("prepare") === "1" ? { page: "prepare" as const, request: session.form } :
        session.record?.draft === undefined ? { page: "home" as const } : { page: "draft" as const, record: session.record, correctionNote: session.correctionNote };
      html(res, 200, renderC3Page(options.context, page, session.csrf), C3_SCRIPT_SHA256); return;
    }
    if (req.method !== "POST" || !url.pathname.startsWith("/api/")) { json(res, 404, { error: "not found" }); return; }
    if (req.headers.origin !== `http://${expectedHost}` || req.headers["x-c3-csrf"] !== session.csrf ||
        !/^application\/json(?:;|$)/iu.test(req.headers["content-type"] ?? "")) {
      json(res, 403, { error: "same-origin session guard refused request" }); return;
    }
    let body: unknown;
    try { body = await readBody(req); } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : "invalid request" }); return; }
    if (url.pathname === "/api/cancel") {
      try { session.form = snapshotMeetingFormState(body); } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "invalid form state" }); return;
      }
      const active = session.active;
      session.sequence += 1;
      if (active !== undefined) { active.controller.abort(); events.push({ kind: "cancelled", sequence: session.sequence }); await active.settled; }
      const page = renderC3Page(options.context, { page: "prepare", request: session.form,
        error: "Local generation stopped and current form text was kept. Remote billed-work status may remain unknown in operator accounting." }, session.csrf);
      json(res, 200, { html: page,
        status: "Local generation stopped. Current form text is ready to edit or submit again; remote billed-work status may be unknown." }); return;
    }
    if (url.pathname === "/api/note") {
      let note: string;
      try { note = recordText(body, "note", 1_000); } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "invalid correction note" }); return;
      }
      if (session.record?.draft === undefined) { json(res, 409, { error: "draft required" }); return; }
      session.correctionNote = note;
      json(res, 200, { html: renderC3Page(options.context, { page: "draft", record: session.record, correctionNote: note }, session.csrf) }); return;
    }
    if (url.pathname === "/api/revise") {
      if (session.record?.draft === undefined) { json(res, 409, { error: "draft required" }); return; }
      let note: string;
      try { note = recordText(body, "note", 1_000); } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "invalid correction note" }); return;
      }
      const prior = session.record;
      const active = session.active;
      session.sequence += 1;
      if (active !== undefined) { active.controller.abort(); await active.settled; }
      session.revisionNumber += 1;
      session.correctionNote = note;
      session.pendingRevision = createC3RevisionContext(prior, note, session.revisionNumber);
      session.form = prior.meetingRequest;
      session.record = undefined;
      json(res, 200, { html: renderC3Page(options.context, { page: "prepare", request: session.form,
        error: `Revision ${String(session.revisionNumber)} will include the exact session correction and prior raw/draft identity.` }, session.csrf) }); return;
    }
    if (url.pathname !== "/api/generate") { json(res, 404, { error: "not found" }); return; }
    let request: C3MeetingRequest;
    try { request = snapshotMeetingRequest(body); } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : "invalid meeting request" }); return;
    }
    if (options.context.context.ownerCorrections.some((item) => item.text.includes("not enabled"))) {
      json(res, 409, { error: "account preparation is held pending the recorded C2 revision" }); return;
    }
    session.form = request;
    const previous = session.active;
    if (previous !== undefined) { previous.controller.abort(); await previous.settled; }
    session.sequence += 1;
    const sequence = session.sequence;
    const controller = new AbortController();
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => { resolveSettled = resolve; });
    session.active = { controller, sequence, settled };
    events.push({ kind: "attempted", sequence });
    const onResponseClose = (): void => { if (!res.writableEnded) controller.abort(); };
    res.once("close", onResponseClose);
    try {
      const modelRequest = createC3ModelRequest(options.context, request, session.pendingRevision);
      const raw = await options.provider.generate(modelRequest, controller.signal);
      const generation = createGenerationRecord(modelRequest, raw, options.context);
      if (session.sequence !== sequence || controller.signal.aborted) {
        if (!res.writableEnded) json(res, 409, { error: "stale generation discarded" });
        return;
      }
      if (generation.outcome === "refused") {
        events.push({ kind: "refused", sequence });
        const page = renderC3Page(options.context, { page: "prepare", request,
          error: `Candidate refused without repair: ${generation.refusal!.message}` }, session.csrf);
        json(res, 422, { html: page, refusal: generation.refusal }); return;
      }
      session.record = generation;
      session.pendingRevision = null;
      events.push({ kind: "succeeded", sequence });
      json(res, 200, { html: renderC3Page(options.context, { page: "draft", record: generation, correctionNote: session.correctionNote }, session.csrf) });
    } catch (error) {
      if (session.sequence !== sequence || controller.signal.aborted) {
        if (!res.writableEnded) json(res, 409, { error: "stale generation discarded" });
        return;
      }
      events.push({ kind: "failed", sequence });
      const message = error instanceof Error ? error.message : "generation failed";
      json(res, 502, { html: renderC3Page(options.context, { page: "prepare", request, error: message }, session.csrf), error: message });
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

  const status = (): C3ServiceStatus => ({ provider: options.provider.name,
    generationAttempted: count(events, "attempted"), generationSucceeded: count(events, "succeeded"),
    generationRefused: count(events, "refused"), generationCancelled: count(events, "cancelled"),
    generationFailed: count(events, "failed"), c2Implementation: "complete", ownerDisposition: "recorded",
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

function recordText(value: unknown, key: string, max: number): string {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error("invalid request");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).length !== 1 || typeof root[key] !== "string" || root[key].length < 1 || root[key].length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(root[key])) {
    throw new Error("invalid correction note");
  }
  return root[key];
}
