import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { deepFreezeOwnData, snapshotStrictJson } from '../authority/strict-json.ts';
import { canonicalJson } from './context.ts';

export const RESEARCH_HARD_LIMITS = Object.freeze({ pages: 6, attempts: 6, runs: 2, responseBytes: 262_144, cleanTextChars: 32_000, timeoutMs: 15_000 });
export interface ResearchBinding { readonly principal: string; readonly accountId: string; }
export interface ResearchCaller extends ResearchBinding { readonly sessionId: string; }
export interface ResearchTarget {
  readonly url: string;
  /** Exact additional destinations, never a wildcard redirect permission. */
  readonly redirectUrls: readonly string[];
  readonly publisher: string;
  readonly entityId: string;
  readonly relationshipToAccount: 'account' | 'related_entity';
}
export interface ResearchScope extends ResearchBinding {
  readonly question: string;
  readonly authorizationRef: string;
  readonly allowedHosts: readonly string[];
  readonly targets: readonly ResearchTarget[];
  readonly limits: { readonly [K in keyof typeof RESEARCH_HARD_LIMITS]: number };
}
export const researchHash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export const researchIdentity = (value: unknown): string => researchHash(canonicalJson(value));
export function researchJson<T>(value: T): T {
  return deepFreezeOwnData(snapshotStrictJson(value, 'research', { max_array_length: 100, max_depth: 20,
    max_expanded_json_value_occurrences: 20_000, max_nodes: 20_000, max_object_fields: 60,
    max_string_utf8_bytes: 400_000, max_total_string_utf8_bytes: 8_000_000 })) as T;
}
export function researchId(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$/u.test(value)) throw Error('Invalid research identity');
  return value;
}
function exact(value: object, keys: string[]): void {
  if (Object.keys(value).sort().join(',') !== keys.sort().join(',')) throw Error('Unexpected research fields');
}
export function canonicalResearchUrl(raw: string): string {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(raw)) throw Error('Unsafe source URL');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || isIP(url.hostname) ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(url.hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/u.test(url.hostname)) throw Error('Unsafe source URL');
  return url.href;
}
export function validateResearchScope(input: ResearchScope, binding: ResearchBinding): ResearchScope {
  const scope = researchJson(input);
  exact(scope, ['principal', 'accountId', 'question', 'authorizationRef', 'allowedHosts', 'targets', 'limits']);
  researchId(scope.principal); researchId(scope.accountId); researchId(binding.principal); researchId(binding.accountId);
  if (scope.principal !== binding.principal || scope.accountId !== binding.accountId) throw Error('Research scope ownership mismatch');
  for (const value of [scope.question, scope.authorizationRef]) if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw Error('Explicit research scope required');
  exact(scope.limits, Object.keys(RESEARCH_HARD_LIMITS));
  for (const key of Object.keys(RESEARCH_HARD_LIMITS) as (keyof typeof RESEARCH_HARD_LIMITS)[]) {
    if (!Number.isSafeInteger(scope.limits[key]) || scope.limits[key] < 1 || scope.limits[key] > RESEARCH_HARD_LIMITS[key]) throw Error('Research hard limit refused');
  }
  if (!Array.isArray(scope.allowedHosts) || !scope.allowedHosts.length || scope.allowedHosts.length > 12 || new Set(scope.allowedHosts).size !== scope.allowedHosts.length) throw Error('Explicit official hosts required');
  for (const host of scope.allowedHosts) if (new URL(canonicalResearchUrl(`https://${host}/`)).hostname !== host) throw Error('Invalid official host');
  if (!Array.isArray(scope.targets) || !scope.targets.length || scope.targets.length > scope.limits.pages) throw Error('Requested page limit refused');
  const all = new Set<string>();
  for (const target of scope.targets) {
    exact(target, ['url', 'redirectUrls', 'publisher', 'entityId', 'relationshipToAccount']);
    researchId(target.entityId);
    if (!['account', 'related_entity'].includes(target.relationshipToAccount) || typeof target.publisher !== 'string' || !target.publisher.trim() || target.publisher.length > 300 || !Array.isArray(target.redirectUrls) || target.redirectUrls.length > 6) throw Error('Invalid trusted source attribution');
    for (const raw of [target.url, ...target.redirectUrls]) {
      const url = canonicalResearchUrl(raw);
      if (url !== raw || !scope.allowedHosts.includes(new URL(url).hostname) || all.has(url)) throw Error('Source target must be unique, exact and official');
      all.add(url);
    }
  }
  return scope;
}

export interface SourceResponse {
  readonly status: number;
  readonly mediaType: string;
  readonly body: Uint8Array;
  readonly bodyComplete: boolean;
  readonly location?: string;
}
/** One hop only; implementations must never redirect or retry internally. */
export type ResearchTransport = (request: { readonly url: string; readonly signal: AbortSignal;
  readonly maxBytes: number; readonly timeoutMs: number }) => Promise<SourceResponse>;
export interface ResearchPassage { readonly text: string; readonly start: number; readonly end: number; readonly sha256: string; readonly cleanTextSha256: string; }
export interface RetainedResearchSource extends ResearchBinding {
  readonly sourceId: string; readonly runId: string;
  readonly requestedUrl: string; readonly finalUrl: string;
  readonly acquisition: 'direct-source';
  readonly publisher: string; readonly entityId: string; readonly relationshipToAccount: ResearchTarget['relationshipToAccount'];
  readonly retrievedAt: string; readonly status: number; readonly mediaType: string;
  readonly rawBase64: string; readonly rawSha256: string; readonly rawByteLength: number;
  readonly cleanText: string; readonly cleanTextSha256: string;
  readonly extraction: { readonly version: 'static-text-v1'; readonly maxResponseBytes: number; readonly maxCleanTextChars: number; readonly truncated: boolean; readonly fetchedBodyComplete: true; readonly renderedPageCompleteness: 'unknown' };
  readonly publicationDate: null; readonly eventDate: null; readonly evidenceCurrentThrough: null;
  readonly passages: readonly ResearchPassage[];
  readonly generationEligible: false;
}
export function researchPassage(text: string, start: number, end: number): ResearchPassage {
  const excerpt = text.slice(start, end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > text.length || end <= start ||
      Buffer.byteLength(excerpt) > 4000 || text.indexOf(excerpt) !== start || text.indexOf(excerpt, start + 1) !== -1) throw Error('Excerpt must uniquely match exact clean-text offsets');
  researchJson(excerpt);
  return { text: excerpt, start, end, sha256: researchHash(excerpt), cleanTextSha256: researchHash(text) };
}
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/giu, (whole, code: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (!code.startsWith('#')) return named[code.toLowerCase()] ?? whole;
    const number = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : whole;
  });
}
export function extractResearchSource(scope: ResearchScope, runId: string, target: ResearchTarget, finalUrl: string,
  response: SourceResponse, retrievedAt: string): RetainedResearchSource {
  if (response.bodyComplete !== true) throw Error('source_incomplete');
  if (!Number.isInteger(response.status) || response.status < 200 || response.status > 299) throw Error('http_status_refused');
  if (!(response.body instanceof Uint8Array) || response.body.byteLength > scope.limits.responseBytes) throw Error('source_size_refused');
  if (!response.body.byteLength) throw Error('empty_source');
  const mediaType = response.mediaType.toLowerCase().trim();
  if (!/^text\/(?:html|plain)(?:\s*;\s*charset=(?:"utf-8"|utf-8|us-ascii))?$/u.test(mediaType)) throw Error('source_type_refused');
  const raw = Buffer.from(response.body);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch { throw Error('unreadable_source'); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw Error('unreadable_source');
  if (mediaType.startsWith('text/html')) {
    // A bounded, inert lexical projection, not a browser/DOM or a completeness claim.
    text = text.replace(/<!--[\s\S]*?(?:-->|$)/gu, ' ').replace(/<(script|style|noscript|template|head)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/giu, ' ')
      .replace(/<[^>]*>/gu, ' ');
    text = decodeEntities(text);
  }
  text = text.replace(/\s+/gu, ' ').trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) throw Error('empty_or_js_only_source');
  const truncated = text.length > scope.limits.cleanTextChars;
  text = text.slice(0, scope.limits.cleanTextChars).replace(/[\ud800-\udbff]$/u, '').trim();
  if (!text) throw Error('empty_source_projection');
  const rawSha256 = researchHash(raw);
  let passages: ResearchPassage[] = [];
  // Retrieval supplies an exact inspectable passage, never a finding or relevance judgment.
  const end = Math.min(text.length, 900);
  try { passages = [researchPassage(text, 0, end)]; } catch { /* Repeated prefix: no invented unique excerpt. */ }
  return researchJson({ principal: scope.principal, accountId: scope.accountId, runId,
    sourceId: `source_${researchIdentity([scope.principal, scope.accountId, runId, target.url, rawSha256])}`,
    requestedUrl: target.url, finalUrl, acquisition: 'direct-source', publisher: target.publisher, entityId: target.entityId,
    relationshipToAccount: target.relationshipToAccount, retrievedAt, status: response.status, mediaType,
    rawBase64: raw.toString('base64'), rawSha256, rawByteLength: raw.length, cleanText: text, cleanTextSha256: researchHash(text),
    extraction: { version: 'static-text-v1', maxResponseBytes: scope.limits.responseBytes, maxCleanTextChars: scope.limits.cleanTextChars,
      truncated, fetchedBodyComplete: true, renderedPageCompleteness: 'unknown' },
    publicationDate: null, eventDate: null, evidenceCurrentThrough: null, passages, generationEligible: false });
}
