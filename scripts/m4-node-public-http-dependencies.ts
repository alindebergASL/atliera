import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

import type {
  M4DnsResolver,
  M4HttpRequest,
  M4HttpResponse,
  M4HttpTransport,
  M4ResolvedAddress,
} from "../src/capability/public-http-fetch-policy.ts";

/**
 * Dormant first-party live dependency factory. It is intentionally absent from
 * current runtime composition; recorded proof and tests inject inert seams.
 */
export function createNodePublicHttpDependencies(): {
  readonly dns: M4DnsResolver;
  readonly http: M4HttpTransport;
} {
  const dns: M4DnsResolver = Object.freeze({
    async resolve(hostname: string, signal: AbortSignal): Promise<readonly M4ResolvedAddress[]> {
      if (signal.aborted) throw new Error("cancelled");
      const answers = await lookup(hostname, { all: true, verbatim: true });
      if (signal.aborted) throw new Error("cancelled");
      const output: M4ResolvedAddress[] = [];
      for (const answer of answers) {
        if (answer.family !== 4 && answer.family !== 6) throw new Error("unsupported address family");
        output.push(Object.freeze({ address: answer.address, family: answer.family }));
      }
      return Object.freeze(output);
    },
  });

  const http: M4HttpTransport = Object.freeze({
    request(specification: M4HttpRequest): Promise<M4HttpResponse> {
      return new Promise<M4HttpResponse>((resolve, reject) => {
        if (specification.signal.aborted) { reject(new Error("cancelled")); return; }
        const pinned = specification.validatedAddresses[0];
        if (pinned === undefined) { reject(new Error("no validated address")); return; }
        const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
          if (options.all) {
            callback(null, specification.validatedAddresses.map(({ address, family }) => ({ address, family })));
          } else {
            callback(null, pinned.address, pinned.family);
          }
        };
        const request = httpsRequest(specification.url, {
          method: "GET",
          agent: false,
          signal: specification.signal,
          headers: specification.headers,
          lookup: pinnedLookup,
        }, (response) => {
          const connectedAddress = response.socket.remoteAddress;
          if (connectedAddress === undefined) {
            response.destroy();
            reject(new Error("connected address unavailable"));
            return;
          }
          async function* boundedBody(): AsyncIterable<Uint8Array> {
            let byteCount = 0;
            for await (const chunk of response) {
              if (specification.signal.aborted) {
                response.destroy();
                throw new Error("cancelled");
              }
              const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              byteCount += value.byteLength;
              if (!Number.isSafeInteger(byteCount) || byteCount > specification.maxBodyBytes) {
                response.destroy();
                throw new Error("body limit exceeded");
              }
              yield value;
            }
          }
          const contentType = response.headers["content-type"];
          const location = response.headers.location;
          resolve(Object.freeze({
            status: response.statusCode ?? 0,
            headers: Object.freeze({
              "content-type": Array.isArray(contentType) ? undefined : contentType,
              location: Array.isArray(location) ? undefined : location,
            }),
            connectedAddress,
            finalUrl: specification.url,
            body: boundedBody(),
          }));
        });
        request.once("error", reject);
        request.end();
      });
    },
  });
  return Object.freeze({ dns, http });
}
