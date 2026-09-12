import { isPublicAddress } from '../capability/public-http-fetch-policy.ts';
import { canonicalResearchUrl, validateResearchScope, type ResearchScope, type ResearchTransport, type SourceResponse } from './research-source.ts';

export interface RestrictedResearchDependencies {
  /** Trusted runtime resolver. The wrapper rejects the entire answer if any address is nonpublic. */
  resolve(host: string): Promise<readonly string[]>;
  /** Exactly one bounded HTTPS exchange to the supplied pinned address, preserving URL
   * hostname TLS verification. No redirect, retry, cookies, credentials, decompression or proxy.
   * The implementation must enforce maxBytes while streaming and honor signal cancellation.
   * C2/D must supply and review this socket implementation; this interface is not its proof. */
  exchange(input: Parameters<ResearchTransport>[0], address: string): Promise<SourceResponse & {
    readonly connectedAddress: string; readonly bodyComplete: boolean; readonly contentEncoding: string | null;
  }>;
}
function restricted(scopeInput: ResearchScope, dependencies: RestrictedResearchDependencies): ResearchTransport {
  const scope = validateResearchScope(scopeInput, scopeInput);
  const exactUrls = new Set(scope.targets.flatMap(target => [target.url, ...target.redirectUrls]));
  return async input => {
    const url = canonicalResearchUrl(input.url);
    if (!exactUrls.has(url) || !scope.allowedHosts.includes(new URL(url).hostname) ||
        !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || input.maxBytes > scope.limits.responseBytes ||
        !Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > scope.limits.timeoutMs) throw Error('transport_scope_refused');
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    input.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, input.timeoutMs);
    let rejectAbort: (() => void) | undefined;
    try {
      const cancelled = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(Error('transport_cancelled_or_timed_out'));
        controller.signal.addEventListener('abort', rejectAbort, { once: true });
      });
      cancelled.catch(() => undefined);
      if (input.signal.aborted) controller.abort();
      controller.signal.throwIfAborted();
      const addresses = await Promise.race([dependencies.resolve(new URL(url).hostname), cancelled]);
      controller.signal.throwIfAborted();
      if (!addresses.length || addresses.length > 32 || addresses.some(address => !isPublicAddress(address))) throw Error('non_public_address_refused');
      const result = await Promise.race([dependencies.exchange({ ...input, signal: controller.signal }, addresses[0]!), cancelled]);
      controller.signal.throwIfAborted();
      if (result.connectedAddress !== addresses[0]) throw Error('source_connection_refused');
      if (!result.bodyComplete) throw Error('source_incomplete');
      if (result.contentEncoding !== null && result.contentEncoding !== 'identity') throw Error('source_type_refused');
      if (!(result.body instanceof Uint8Array) || result.body.byteLength > input.maxBytes) throw Error('source_size_refused');
      return result;
    } finally {
      clearTimeout(timer); input.signal.removeEventListener('abort', abort);
      if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
    }
  };
}
/** Inert, restricted one-hop factory. Requires an explicitly supplied trusted exchange;
 * the repository's existing outbound import boundary remains unchanged. No default socket,
 * DNS, authorization, ledger, eligibility, provider or M4 execution kernel is enabled. */
export function createRestrictedResearchTransport(scope: ResearchScope, dependencies: RestrictedResearchDependencies): ResearchTransport {
  if (!dependencies || typeof dependencies.resolve !== 'function' || typeof dependencies.exchange !== 'function') throw Error('Explicit restricted exchange required');
  return restricted(scope, { resolve: dependencies.resolve.bind(dependencies), exchange: dependencies.exchange.bind(dependencies) });
}
/** TEST ONLY: synthetic DNS and exchange, with the same URL/address/size policy.
 * This seam is not production authorization and never opens a socket itself. */
export function createTestOnlyRestrictedResearchTransport(scope: ResearchScope, synthetic: RestrictedResearchDependencies): ResearchTransport {
  return createRestrictedResearchTransport(scope, synthetic);
}
