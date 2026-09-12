import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import type { RequestOptions } from 'node:https';
import { createNativeResearchDependencies, createTestOnlyResearchExchange, type ResearchSocketTestDependencies } from '../../src/c3/research-native-https.ts';

const address = '8.8.8.8'; // Synthetic address label only; never contacted.
const input = (signal = new AbortController().signal, timeoutMs = 1000) => ({ url: 'https://research.example.org/access', signal, maxBytes: 80, timeoutMs });
function fixture(behavior: (response: EventEmitter & { complete: boolean; headers: Record<string,string>; socket: { remoteAddress: string; authorized: boolean }; statusCode: number; destroy(): void }, options: RequestOptions, req: EventEmitter) => void) {
  let calls = 0, ended = 0, destroyed = 0;
  let options: RequestOptions;
  const dependencies: ResearchSocketTestDependencies = { request(value, receive) {
    calls++; options = value;
    const response = Object.assign(new EventEmitter(), { complete: true, statusCode: 200, headers: { 'content-type': 'text/plain' },
      socket: Object.assign(new EventEmitter(), { remoteAddress: address, authorized: true }), destroy() { destroyed++; } });
    const req = Object.assign(new EventEmitter(), { destroy() { destroyed++; }, end() {
      ended++;
      queueMicrotask(() => { behavior(response, value, req); receive(response); });
    } });
    return req;
  } };
  return { exchange: createTestOnlyResearchExchange(dependencies), state: () => ({ calls, ended, destroyed, options: options! }) };
}
const emitBody = (response: EventEmitter, body = 'Service access requires an application.') => queueMicrotask(() => { response.emit('data', Buffer.from(body)); response.emit('end'); });
test('SYNTHETIC native construction is inert; pinned TLS GET has exact no-proxy/no-credential options', async () => {
  createNativeResearchDependencies();
  const f = fixture((response) => emitBody(response));
  assert.equal(f.state().calls, 0);
  const result = await f.exchange(input(), address);
  assert.equal(result.bodyComplete, true); assert.equal(result.connectedAddress, address); assert.equal(result.contentEncoding, null);
  assert.equal(f.state().calls, 1); assert.equal(f.state().ended, 1);
  const options = f.state().options;
  assert.deepEqual(Object.keys(options).sort(), ['protocol','hostname','port','path','method','servername','rejectUnauthorized','checkServerIdentity','family','autoSelectFamily','agent','headers','lookup'].sort());
  assert.equal(options.hostname, 'research.example.org'); assert.equal(options.servername, 'research.example.org'); assert.equal(options.rejectUnauthorized, true); assert.equal(options.agent, false);
  assert.equal(options.method, 'GET'); assert.equal(options.port, 443); assert.equal(options.path, '/access');
  assert.deepEqual(options.headers, { 'User-Agent':'Atliera-bounded-research/1', Accept:'text/html, text/plain', 'Accept-Encoding':'identity' });
  let pinned: unknown[] = [];
  (options.lookup as Function)('research.example.org', { family:4 }, (...values: unknown[]) => { pinned = values; });
  assert.deepEqual(pinned, [null,address,4]);
  const wrong = options.checkServerIdentity!('other.example.org', { subjectaltname:'DNS:research.example.org', subject:{} } as never);
  assert.equal((wrong as NodeJS.ErrnoException | undefined)?.code, 'ERR_TLS_CERT_ALTNAME_INVALID');
});
for (const [label, mutate, error] of [
  ['address mismatch', (r: any) => { r.socket.remoteAddress = '8.8.4.4'; }, 'source_connection_refused'],
  ['unauthorized TLS', (r: any) => { r.socket.authorized = false; }, 'source_connection_refused'],
  ['gzip refusal', (r: any) => { r.headers['content-encoding'] = 'gzip'; }, 'source_type_refused'],
  ['encoded header array refusal', (r: any) => { r.headers['content-encoding'] = ['identity']; }, 'source_type_refused'],
  ['advertised oversized', (r: any) => { r.headers['content-length'] = '81'; }, 'source_size_refused'],
  ['stream oversized', (r: any) => { queueMicrotask(() => r.emit('data', Buffer.alloc(81))); }, 'source_size_refused'],
  ['truncated end', (r: any) => { r.complete = false; emitBody(r); }, 'source_incomplete'],
  ['length mismatch', (r: any) => { r.headers['content-length'] = '79'; emitBody(r); }, 'source_incomplete'],
  ['midstream error', (r: any) => { queueMicrotask(() => r.emit('error', Error('private socket error'))); }, 'source_incomplete'],
  ['midstream aborted', (r: any) => { queueMicrotask(() => r.emit('aborted')); }, 'source_incomplete'],
  ['premature close', (r: any) => { queueMicrotask(() => r.emit('close')); }, 'source_incomplete'],
] as const) test(`SYNTHETIC native ${label}`, async () => {
  const f = fixture(mutate); await assert.rejects(f.exchange(input(),address), new RegExp(error));
  assert.equal(f.state().calls,1); assert.ok(f.state().destroyed >= 1);
});
test('SYNTHETIC native redirects are returned as one complete hop, never followed', async () => {
  const f = fixture(r => { r.statusCode = 302; r.headers.location = '/other'; emitBody(r,'Redirect'); });
  const result = await f.exchange(input(),address); assert.equal(result.status,302); assert.equal(result.location,'/other'); assert.equal(f.state().calls,1);
});
test('SYNTHETIC native cancellation and deadline destroy streams, with zero pre-abort dispatch', async () => {
  const controller = new AbortController(); controller.abort(); const prior = fixture(() => {});
  await assert.rejects(prior.exchange(input(controller.signal),address), /cancelled/); assert.equal(prior.state().calls,0);
  const active = new AbortController(); const f = fixture(() => { queueMicrotask(() => active.abort()); });
  await assert.rejects(f.exchange(input(active.signal),address), /cancelled/); assert.ok(f.state().destroyed >= 1);
  const timed = fixture(() => {}); await assert.rejects(timed.exchange(input(undefined,10),address), /timed_out/); assert.ok(timed.state().destroyed >= 1);
});

for (const variant of ['foreign-host', 'all-addresses', 'wrong-family', 'second-lookup']) test(`SYNTHETIC pinned lookup refuses ${variant}`, async () => {
  const f = fixture((response, options) => {
    const lookup = options.lookup as Function;
    const callback = () => {};
    if (variant === 'second-lookup') lookup('research.example.org', { family: 4 }, callback);
    lookup(variant === 'foreign-host' ? 'elsewhere.example.org' : 'research.example.org',
      { family: variant === 'wrong-family' ? 6 : 4, all: variant === 'all-addresses' }, callback);
    emitBody(response);
  });
  await assert.rejects(f.exchange(input(), address), /transport_scope_refused/);
  assert.equal(f.state().calls, 1);
});
