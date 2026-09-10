/** Disposable authored fixtures only; scripted verification makes no semantic evidence claim. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { syntheticWorkshopContext, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { startC3Server, type RunningC3Server, type C3ServerOptions } from '../../src/c3/service.ts';
import { createRecordOriginReceipt } from '../../src/c3/work-store.ts';
import type { C3ModelProvider } from '../../src/c3/provider.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';

export const originalContext = syntheticWorkshopContext();
export const refreshedContext = syntheticWorkshopContext('harbor', 'sparse');
export const memoryOnly = process.env.C3_HISTORICAL_IN_PROCESS === '1';
export const originReceipt: NonNullable<C3ServerOptions['originReceipt']> = record =>
  createRecordOriginReceipt(record, 'synthetic', `synthetic-http-fixture:${record.recordId}`);
export function fixtureProvider(): C3ModelProvider {
  return { name: 'synthetic-http-fixture', executionMode: 'local',
    async generate(request) {
      const context = request.contextSha256 === originalContext.sha256 ? originalContext : refreshedContext;
      assert.equal(request.contextSha256, context.sha256);
      return syntheticMeetingCandidate(context, request.revision !== null) + '\n\n';
    }, async verify(request) { return scriptedFullCoverage(request); } };
}
export function startFixture(root: string, options: Partial<C3ServerOptions> = {}) {
  return startC3Server({ context: refreshedContext, provider: fixtureProvider(), workStore: { root, principal: 'synthetic-http-operator' },
    originReceipt, listen: !memoryOnly, ...options });
}
class MemoryResponse extends EventEmitter {
  status = 200; headers: Record<string, string> = {}; text = ''; writableEnded = false;
  done: Promise<void>; finish!: () => void;
  constructor() { super(); this.done = new Promise(resolve => { this.finish = resolve; }); }
  setHeader(name: string, value: string) { this.headers[name] = value; }
  writeHead(status: number, headers: Record<string, string>) { this.status = status; Object.assign(this.headers, headers); }
  end(text: string) { this.text = text; this.writableEnded = true; this.finish(); }
}
export async function browser(server: Pick<RunningC3Server, 'origin'> & Partial<Pick<RunningC3Server, 'server'>>) {
  let cookie = '', csrf = '', documentId = '';
  const call = async (path: string, body?: unknown) => {
    const headers = { host: new URL(server.origin).host, cookie, origin: server.origin, 'content-type': 'application/json', 'x-c3-csrf': csrf, 'x-c3-document': documentId };
    let status: number, text: string, setCookie: string | null;
    if (memoryOnly && server.server) {
      const req = new PassThrough() as unknown as IncomingMessage;
      Object.assign(req, { method: body === undefined ? 'GET' : 'POST', url: path, headers });
      const res = new MemoryResponse(); server.server.emit('request', req, res as unknown as ServerResponse);
      (req as unknown as PassThrough).end(body === undefined ? undefined : JSON.stringify(body)); await res.done;
      status = res.status; text = res.text; setCookie = res.headers['set-cookie'] ?? null;
    } else {
      const response = await fetch(server.origin + path, { method: body === undefined ? 'GET' : 'POST', headers,
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
      status = response.status; text = await response.text(); setCookie = response.headers.get('set-cookie');
    }
    if (setCookie) cookie = setCookie.split(';')[0]!;
    if (status < 300) {
      const result = body === undefined ? undefined : JSON.parse(text);
      const page = result?.html ?? text;
      csrf = page.match(/name="c3-csrf" content="([^"]+)"/)?.[1] ?? csrf;
      documentId = result?.documentId ?? page.match(/name="c3-document" content="([^"]+)"/)?.[1] ?? documentId;
    }
    return { status, text, json: () => JSON.parse(text) };
  };
  assert.equal((await call('/')).status, 200);
  return { call };
}
// Only this explicitly owned disposable fixture child is launched/killed by the restart regression.
if (process.argv[2] === '--serve-historical-fixture') {
  try {
    const server = await startFixture(process.argv[3]!, { context: process.argv[4] === 'old' ? originalContext : refreshedContext, listen: true });
    process.send?.({ origin: server.origin });
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : 'fixture startup failed' });
    process.exitCode = 1;
  }
}
