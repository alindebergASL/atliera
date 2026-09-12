import { constants, openSync, closeSync, fstatSync, fsyncSync, readSync, writeFileSync, lstatSync, realpathSync, opendirSync, unlinkSync, linkSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { canonicalJson } from './context.ts';
import { acquireWorkStoreLock } from './work-store-lock.ts';
import { extractResearchSource, researchHash, researchIdentity, researchJson, type ResearchCaller, type ResearchScope, type RetainedResearchSource } from './research-source.ts';

export type ResearchState = 'started' | 'dispatching' | 'retained' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export interface ResearchAttempt {
  readonly number: number; readonly requestedUrl: string; readonly url: string; readonly reservedAt: string; readonly transportInvoked: boolean;
  readonly receivedAt: string | null; readonly status: number | null; readonly mediaType: string | null;
  readonly redirectTo: string | null; readonly error: string | null;
  readonly response: { readonly rawBase64: string; readonly rawSha256: string; readonly byteLength: number; readonly bodyComplete: boolean } | null;
}
export interface ResearchRun extends ResearchCaller {
  readonly kind: 'atliera.c3.research-run'; readonly schemaVersion: '1';
  readonly runId: string; readonly idempotencyKey: string; readonly ordinal: number;
  readonly scope: ResearchScope; readonly scopeSha256: string;
  readonly state: ResearchState; readonly updatedAt: string;
  readonly attempts: readonly ResearchAttempt[]; readonly sources: readonly RetainedResearchSource[];
  readonly error: string | null; readonly snapshotId: string | null;
}
export const terminalResearchState = (state: ResearchState): boolean => ['completed', 'failed', 'cancelled', 'interrupted'].includes(state);
export function researchSnapshotId(run: ResearchRun): string {
  return `snapshot_${researchIdentity({ ...run, snapshotId: null })}`;
}
function iso(value: string): void {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || new Date(value).toISOString() !== value) throw Error('Invalid research receipt time');
}
export function validateResearchRun(input: ResearchRun, scope: ResearchScope): ResearchRun {
  const run = researchJson(input);
  if (Object.keys(run).sort().join(',') !== 'accountId,attempts,error,idempotencyKey,kind,ordinal,principal,runId,schemaVersion,scope,scopeSha256,sessionId,snapshotId,sources,state,updatedAt' ||
      run.error !== null && (typeof run.error !== 'string' || run.error.length > 100)) throw Error('Invalid research run fields');
  if (run.kind !== 'atliera.c3.research-run' || run.schemaVersion !== '1' || run.principal !== scope.principal || run.accountId !== scope.accountId ||
      run.scopeSha256 !== researchIdentity(scope) || canonicalJson(run.scope) !== canonicalJson(scope) ||
      !/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$/u.test(run.sessionId) || !/^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$/u.test(run.idempotencyKey) ||
      !Number.isSafeInteger(run.ordinal) || run.ordinal < 1 || run.ordinal > scope.limits.runs ||
      run.runId !== `run_${researchIdentity([scope.principal, scope.accountId, run.sessionId, run.idempotencyKey, run.scopeSha256])}` ||
      !['started', 'dispatching', 'retained', 'completed', 'failed', 'cancelled', 'interrupted'].includes(run.state) ||
      run.attempts.length > scope.limits.attempts || run.sources.length > scope.targets.length) throw Error('Research run ownership or scope mismatch');
  iso(run.updatedAt);
  if ((['started', 'dispatching', 'retained', 'completed'].includes(run.state) && run.error !== null) ||
      (run.state === 'cancelled' && run.error !== 'cancelled') ||
      (run.state === 'interrupted' && run.error !== 'process_interrupted') ||
      (run.state === 'failed' && (run.error === null || run.error === 'cancelled' || run.error === 'process_interrupted'))) {
    throw Error('Research state and error mismatch');
  }
  for (const [index, attempt] of run.attempts.entries()) {
    if (Object.keys(attempt).sort().join(',') !== 'error,mediaType,number,receivedAt,redirectTo,requestedUrl,reservedAt,response,status,transportInvoked,url' ||
        attempt.error !== null && (typeof attempt.error !== 'string' || attempt.error.length > 100) ||
        attempt.mediaType !== null && (typeof attempt.mediaType !== 'string' || attempt.mediaType.length > 200)) throw Error('Invalid research attempt fields');
    const target = scope.targets.find(item => item.url === attempt.requestedUrl);
    if (!target || attempt.number !== index + 1 || ![target.url, ...target.redirectUrls].includes(attempt.url) ||
        attempt.redirectTo !== null && !target.redirectUrls.includes(attempt.redirectTo) ||
        attempt.status !== null && (!Number.isInteger(attempt.status) || attempt.status < 100 || attempt.status > 599) ||
        attempt.receivedAt === null && (attempt.status !== null || attempt.mediaType !== null || attempt.redirectTo !== null)) throw Error('Invalid research attempt');
    iso(attempt.reservedAt); if (attempt.receivedAt !== null) iso(attempt.receivedAt);
    if (typeof attempt.transportInvoked !== 'boolean' || attempt.receivedAt !== null && !attempt.transportInvoked) throw Error('Invalid transport invocation receipt');
    if (attempt.response !== null) {
      if (Object.keys(attempt.response).sort().join(',') !== 'bodyComplete,byteLength,rawBase64,rawSha256') throw Error('Invalid retained response fields');
      const raw = Buffer.from(attempt.response.rawBase64, 'base64');
      if (typeof attempt.response.bodyComplete !== 'boolean' || attempt.receivedAt === null || raw.length > scope.limits.responseBytes || raw.length !== attempt.response.byteLength || raw.toString('base64') !== attempt.response.rawBase64 || researchHash(raw) !== attempt.response.rawSha256) throw Error('Response checksum mismatch');
    }
  }
  if (new Set(run.sources.map(source => source.requestedUrl)).size !== run.sources.length) throw Error('Duplicate research source');
  for (const source of run.sources) {
    const target = scope.targets.find(item => item.url === source.requestedUrl);
    if (!target || ![target.url, ...target.redirectUrls].includes(source.finalUrl) ||
        !run.attempts.some(attempt => attempt.requestedUrl === source.requestedUrl && attempt.url === source.finalUrl && attempt.status === source.status && attempt.receivedAt === source.retrievedAt && attempt.mediaType === source.mediaType && attempt.response?.rawSha256 === source.rawSha256 && attempt.response.bodyComplete)) throw Error('Source not attached to this run');
    const rebuilt = extractResearchSource(scope, run.runId, target, source.finalUrl,
      { status: source.status, mediaType: source.mediaType, body: Buffer.from(source.rawBase64, 'base64'), bodyComplete: true }, source.retrievedAt);
    if (canonicalJson(rebuilt) !== canonicalJson(source)) throw Error('Retained research source checksum or ownership mismatch');
  }
  if (run.state === 'completed' && run.sources.length !== scope.targets.length) throw Error('Incomplete run cannot claim success');
  if (terminalResearchState(run.state) ? run.snapshotId !== researchSnapshotId(run) : run.snapshotId !== null) throw Error('Research snapshot identity mismatch');
  return run;
}
interface Envelope { readonly sequence: number; readonly previousSha256: string | null; readonly run: ResearchRun; readonly sha256: string; }
const MAX_BYTES = 8_000_000;
const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));

/** Dedicated private directory per principal/account. No writes on construction or read.
 * Cooperative process exclusion uses the same kernel lock protocol as LocalWorkStore.
 * Checksums detect damage, not a malicious operator who can replace the entire private store. */
export class ResearchStore {
  readonly root: string;
  constructor(root: string, private readonly scope: ResearchScope) {
    if (!isAbsolute(root)) throw Error('Research store requires an absolute private root');
    this.root = resolve(root);
    const rel = relative(repo, this.root);
    if (!(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) throw Error('Research store must be outside the repository');
    this.assertRoot();
  }
  private assertRoot(): void {
    const stat = lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(this.root) !== this.root || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw Error('Research root must be private, owned and without symlink ancestors');
  }
  lock(): number { this.assertRoot(); return acquireWorkStoreLock(this.root); }
  private names(): string[] {
    this.assertRoot(); const names: string[] = []; const dir = opendirSync(this.root);
    try { let entry; while ((entry = dir.readSync()) !== null) { names.push(entry.name); if (names.length > 80) throw Error('Research store entry limit'); } }
    finally { dir.closeSync(); }
    if (names.some(name => !/^receipt-[0-9]{4}\.json$/u.test(name) && !/^\.research-pending-[a-f0-9]{32}$/u.test(name))) throw Error('Unexpected research store entry');
    return names.sort();
  }
  private read(name: string): Envelope {
    const fd = openSync(resolve(this.root, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd);
      const interruptedPublication = stat.nlink === 2 && this.names().filter(candidate => candidate.startsWith('.research-pending-')).filter(candidate => {
        const pending = lstatSync(resolve(this.root, candidate));
        return pending.isFile() && !pending.isSymbolicLink() && pending.ino === stat.ino && pending.dev === stat.dev;
      }).length === 1;
      if (!stat.isFile() || stat.nlink !== 1 && !interruptedPublication || stat.size > MAX_BYTES || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw Error('Unsafe research receipt');
      const buffer = Buffer.alloc(stat.size + 1); let size = 0;
      while (size < buffer.length) { const count = readSync(fd, buffer, size, buffer.length - size, null); if (!count) break; size += count; }
      const after = fstatSync(fd);
      if (size !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw Error('Research receipt changed during read');
      const bytes = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
      const value = researchJson(JSON.parse(bytes)) as Envelope;
      if (canonicalJson(value) + '\n' !== bytes || Object.keys(value).sort().join(',') !== 'previousSha256,run,sequence,sha256' ||
          value.sha256 !== researchIdentity({ sequence: value.sequence, previousSha256: value.previousSha256, run: value.run })) throw Error('Research receipt checksum mismatch');
      validateResearchRun(value.run, this.scope);
      return value;
    } finally { closeSync(fd); }
  }
  history(): readonly Envelope[] {
    const names = this.names().filter(name => name.startsWith('receipt-'));
    const entries = names.map((name, index) => { if (name !== this.filename(index + 1)) throw Error('Research receipt sequence corrupted'); return this.read(name); });
    return this.verifyHistory(entries);
  }
  private verifyHistory(entries: readonly Envelope[]): readonly Envelope[] {
    const history: Envelope[] = [];
    const runs = new Map<string, ResearchRun>();
    for (const [index, entry] of entries.entries()) {
      if (entry.sequence !== index + 1 || entry.previousSha256 !== (history.at(-1)?.sha256 ?? null)) throw Error('Research receipt chain corrupted');
      const prior = runs.get(entry.run.runId);
      if (!prior) {
        if (entry.run.ordinal !== runs.size + 1 || entry.run.state !== 'started' || entry.run.attempts.length || entry.run.sources.length || [...runs.values()].some(run => !terminalResearchState(run.state))) throw Error('Invalid research run reservation');
      } else {
        if (terminalResearchState(prior.state) || entry.run.ordinal !== prior.ordinal || entry.run.attempts.length < prior.attempts.length ||
            entry.run.attempts.length > prior.attempts.length + 1 || entry.run.sources.length < prior.sources.length ||
            !prior.sources.every((source, i) => canonicalJson(entry.run.sources[i]) === canonicalJson(source))) throw Error('Historical research receipt mutation');
        // Once an exchange has a response, neither it nor its dispatch reservation may change.
        for (const [i, attempt] of prior.attempts.entries()) {
          const next = entry.run.attempts[i]!;
          if (attempt.transportInvoked && !next.transportInvoked) throw Error('Historical invocation mutation');
          if (attempt.receivedAt !== null ? canonicalJson(attempt) !== canonicalJson(next) :
              ['number', 'url', 'requestedUrl', 'reservedAt'].some(key => (attempt as unknown as Record<string, unknown>)[key] !== (next as unknown as Record<string, unknown>)[key])) throw Error('Historical dispatch mutation');
        }
      }
      runs.set(entry.run.runId, entry.run); history.push(entry);
    }
    return history;
  }
  latest(): ResearchRun[] { return [...new Map(this.history().map(entry => [entry.run.runId, entry.run])).values()]; }
  /** Caller holds the directory lease across reservation, every dispatch, and finalization. */
  append(run: ResearchRun, lease: number): void {
    this.assertRoot();
    const held = fstatSync(lease); const root = lstatSync(this.root);
    if (held.ino !== root.ino || held.dev !== root.dev) throw Error('Research lease root mismatch');
    validateResearchRun(run, this.scope);
    const history = this.history();
    if (history.length >= 64) throw Error('Research receipt limit');
    const payload = { sequence: history.length + 1, previousSha256: history.at(-1)?.sha256 ?? null, run };
    const entry = { ...payload, sha256: researchIdentity(payload) };
    this.verifyHistory([...history, entry]);
    const bytes = canonicalJson(entry) + '\n';
    if (Buffer.byteLength(bytes) > MAX_BYTES) throw Error('Research receipt size limit');
    const temp = resolve(this.root, `.research-pending-${randomBytes(16).toString('hex')}`);
    try {
      const fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
      this.assertRoot(); linkSync(temp, resolve(this.root, this.filename(entry.sequence))); unlinkSync(temp); fsyncSync(lease);
      if (canonicalJson(this.read(this.filename(entry.sequence))) !== canonicalJson(entry)) throw Error('Research receipt readback mismatch');
    } finally { try { unlinkSync(temp); } catch { /* Already published, or preserve original error. */ } }
  }
  /** Explicit recovery only; never repairs or replaces published bytes. Must hold lease. */
  recoverPending(lease: number): void {
    const held = fstatSync(lease); const root = lstatSync(this.root);
    if (held.ino !== root.ino || held.dev !== root.dev) throw Error('Research lease root mismatch');
    const names = this.names();
    for (const name of names.filter(item => item.startsWith('.research-pending-'))) {
      const stat = lstatSync(resolve(this.root, name));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) throw Error('Unsafe pending research receipt');
      if (stat.nlink === 2) {
        const matches = names.filter(item => item.startsWith('receipt-')).filter(item => {
          const other = lstatSync(resolve(this.root, item)); return other.isFile() && !other.isSymbolicLink() && other.ino === stat.ino && other.dev === stat.dev;
        });
        if (matches.length !== 1) throw Error('Unsafe pending research hardlink');
      } else if (stat.nlink !== 1) throw Error('Unsafe pending research hardlink');
      unlinkSync(resolve(this.root, name));
    }
    fsyncSync(lease);
  }
  private filename(sequence: number): string { return `receipt-${String(sequence).padStart(4, '0')}.json`; }
}
