import { Resolver } from 'node:dns';
import { request, type RequestOptions } from 'node:https';
import { checkServerIdentity } from 'node:tls';
import { isIP } from 'node:net';
import { canonicalResearchUrl, RESEARCH_HARD_LIMITS } from './research-source.ts';
import type { RestrictedResearchDependencies } from './research-transport.ts';

interface Socket {
  readonly remoteAddress?: string; readonly authorized?: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
}
interface Response {
  readonly statusCode?: number; readonly complete: boolean; readonly socket: Socket;
  readonly headers: Record<string, string | string[] | undefined>;
  on(event: string, listener: (...args: any[]) => void): unknown;
  destroy(): void;
}
interface Request {
  on(event: string, listener: (...args: any[]) => void): unknown;
  end(): void; destroy(): void;
}
/** TEST ONLY seam: the production exchange state machine, with deterministic request
 * events or a host-local TLS connector. No production caller supplies this dependency. */
export interface ResearchSocketTestDependencies {
  request(options: RequestOptions, response: (incoming: Response) => void): Request;
}
function exchangeWith(dependencies: ResearchSocketTestDependencies): RestrictedResearchDependencies['exchange'] {
  return (input, address) => new Promise((resolve, reject) => {
    const url = new URL(canonicalResearchUrl(input.url));
    const family = isIP(address);
    if (!family || !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || input.maxBytes > RESEARCH_HARD_LIMITS.responseBytes ||
        !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > RESEARCH_HARD_LIMITS.timeoutMs) {
      reject(Error('transport_scope_refused')); return;
    }
    let req: Request | undefined, response: Response | undefined;
    let settled = false, lookupUsed = false;
    const cleanup = (): void => { clearTimeout(timer); input.signal.removeEventListener('abort', abort); };
    const refuse = (reason: string): void => {
      if (settled) return; settled = true; cleanup(); reject(Error(reason)); response?.destroy(); req?.destroy();
    };
    const abort = (): void => refuse('transport_cancelled_or_timed_out');
    const timer = setTimeout(abort, input.timeoutMs);
    input.signal.addEventListener('abort', abort, { once: true });
    if (input.signal.aborted) { abort(); return; }
    const pinned = (socket: Socket): boolean => socket.remoteAddress === address && socket.authorized === true;
    const options: RequestOptions & { autoSelectFamily: false } = {
      protocol: 'https:', hostname: url.hostname, port: 443, path: url.pathname + url.search,
      method: 'GET', servername: url.hostname, rejectUnauthorized: true, checkServerIdentity,
      family, autoSelectFamily: false, agent: false,
      headers: { 'User-Agent': 'Atliera-bounded-research/1', Accept: 'text/html, text/plain', 'Accept-Encoding': 'identity' },
      lookup: ((host: string, lookupOptions: { all?: boolean; family?: number }, callback: (error: Error | null, address?: string, family?: number) => void) => {
        if (lookupUsed || host !== url.hostname || lookupOptions.all === true || lookupOptions.family !== family) {
          callback(Error('transport_scope_refused')); refuse('transport_scope_refused'); return;
        }
        lookupUsed = true; callback(null, address, family);
      }) as RequestOptions['lookup'],
    };
    try {
      req = dependencies.request(options, incoming => {
        if (settled) { incoming.destroy(); return; }
        response = incoming;
        if (!pinned(incoming.socket)) { refuse('source_connection_refused'); return; }
        const encoding = incoming.headers['content-encoding'];
        const contentEncoding = typeof encoding === 'string' ? encoding.toLowerCase().trim() : null;
        if (encoding !== undefined && (typeof encoding !== 'string' || contentEncoding !== 'identity')) { refuse('source_type_refused'); return; }
        const length = incoming.headers['content-length'];
        if (length !== undefined && (typeof length !== 'string' || !/^[0-9]+$/u.test(length) || !Number.isSafeInteger(Number(length)))) { refuse('source_incomplete'); return; }
        if (Number(length) > input.maxBytes) { refuse('source_size_refused'); return; }
        const mediaType = incoming.headers['content-type'];
        const location = incoming.headers.location;
        if (typeof mediaType !== 'string' || mediaType.length > 200 || location !== undefined && typeof location !== 'string' ||
            !Number.isInteger(incoming.statusCode) || incoming.statusCode! < 100 || incoming.statusCode! > 599) { refuse('source_type_refused'); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        incoming.on('data', (chunk: unknown) => {
          if (settled) return;
          if (!(chunk instanceof Uint8Array)) { refuse('source_incomplete'); return; }
          bytes += chunk.byteLength;
          if (bytes > input.maxBytes) { refuse('source_size_refused'); return; }
          chunks.push(Buffer.from(chunk));
        });
        incoming.on('error', () => refuse('source_incomplete'));
        incoming.on('aborted', () => refuse('source_incomplete'));
        incoming.on('close', () => { if (!settled) refuse('source_incomplete'); });
        incoming.on('end', () => {
          if (settled) return;
          if (!incoming.complete || length !== undefined && bytes !== Number(length)) { refuse('source_incomplete'); return; }
          settled = true; cleanup();
          resolve({ status: incoming.statusCode!, mediaType, body: Buffer.concat(chunks, bytes), bodyComplete: true,
            connectedAddress: incoming.socket.remoteAddress!, contentEncoding, ...(typeof location === 'string' ? { location } : {}) });
        });
      });
      req.on('error', () => refuse('source_connection_refused'));
      req.on('socket', (socket: Socket) => {
        socket.on('secureConnect', () => { if (!pinned(socket)) refuse('source_connection_refused'); });
        socket.on('error', () => refuse('source_connection_refused'));
      });
      if (settled) req.destroy(); else req.end();
    } catch { refuse('source_connection_refused'); }
  });
}
export function createTestOnlyResearchExchange(dependencies: ResearchSocketTestDependencies): RestrictedResearchDependencies['exchange'] {
  return exchangeWith(dependencies);
}
/** Inert construction. One DNS answer (A and AAAA), then one pinned GET per invocation.
 * No environment, proxy, cookie jar, credentials, redirects, retries or decompression. */
export function createNativeResearchDependencies(): RestrictedResearchDependencies {
  return {
    resolve: (host, signal) => new Promise((resolve, reject) => {
      const resolver = new Resolver({ timeout: 2000, tries: 1 });
      const abort = (): void => { resolver.cancel(); reject(Error('transport_cancelled_or_timed_out')); };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      const query = (family: 4 | 6): Promise<string[]> => new Promise((done, fail) => {
        const callback = (error: NodeJS.ErrnoException | null, addresses: string[]): void => {
          if (error && error.code !== 'ENODATA') fail(Error('source_connection_refused')); else done(addresses ?? []);
        };
        if (family === 4) resolver.resolve4(host, callback); else resolver.resolve6(host, callback);
      });
      Promise.all([query(4), query(6)]).then(parts => resolve(parts.flat()), reject)
        .finally(() => { signal?.removeEventListener('abort', abort); resolver.cancel(); });
    }),
    exchange: exchangeWith({ request: (options, response) => request(options, response) }),
  };
}
