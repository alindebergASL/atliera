import { closeSync } from 'node:fs';
import { canonicalResearchUrl, extractResearchSource, researchId, researchHash, researchIdentity, researchJson, validateResearchScope,
  type ResearchBinding, type ResearchCaller, type ResearchScope, type ResearchTransport, type RetainedResearchSource, type SourceResponse } from './research-source.ts';
import { ResearchStore, researchSnapshotId, terminalResearchState, type ResearchRun, type ResearchState } from './research-store.ts';

export interface ResearchExecutionOptions extends ResearchBinding {
  /** Trusted runtime configuration, never request-body policy. Defaults to disabled. */
  readonly enabled?: boolean;
  readonly scope: ResearchScope;
  /** Existing private directory outside the repository, dedicated to this binding. */
  readonly retentionRoot: string;
  readonly transport?: ResearchTransport;
  readonly now?: () => Date;
  /** Synchronous notification after actual durable stage changes. Observer errors cannot change execution. */
  readonly onProgress?: (run: ResearchRun) => void;
}
export interface ResearchHandle { readonly runId: string; readonly completion: Promise<ResearchRun>; }
export interface ResearchSnapshot {
  readonly snapshotId: string; readonly runId: string; readonly principal: string; readonly accountId: string;
  readonly state: ResearchState; readonly updatedAt: string; readonly error: string | null; readonly question: string; readonly sources: readonly RetainedResearchSource[];
  readonly coverage: { readonly requested: number; readonly retained: number; readonly attempts: number; readonly transportInvocations: number; readonly unavailableUrls: readonly string[] };
  readonly unknowns: readonly string[]; readonly generationEligible: false;
}
function finish(run: ResearchRun, state: ResearchState, at: string, error: string | null): ResearchRun {
  const result = { ...run, state, updatedAt: at, error, snapshotId: null };
  return researchJson({ ...result, snapshotId: researchSnapshotId(result) });
}
const sourceErrors = new Set(['http_status_refused', 'source_size_refused', 'empty_source', 'source_type_refused', 'unreadable_source',
  'empty_or_js_only_source', 'empty_source_projection', 'non_public_address_refused', 'source_connection_refused', 'source_incomplete',
  'transport_scope_refused', 'transport_cancelled_or_timed_out', 'redirect_refused', 'attempt_limit_reached']);

/** Bounded retrieval/retention only. No search, synthesis, admission, generation or startup dispatch. */
export class BoundedResearchExecution {
  private readonly scope: ResearchScope;
  private readonly store: ResearchStore;
  private readonly now: () => Date;
  private readonly transport: ResearchTransport | undefined;
  private readonly observer: ResearchExecutionOptions['onProgress'];
  private enabled: boolean;
  private active: { run: ResearchRun; controller: AbortController; completion: Promise<ResearchRun> } | undefined;
  constructor(options: ResearchExecutionOptions) {
    this.scope = validateResearchScope(options.scope, options);
    this.store = new ResearchStore(options.retentionRoot, this.scope);
    this.now = options.now ?? (() => new Date()); this.transport = options.transport; this.observer = options.onProgress;
    this.enabled = options.enabled === true && typeof options.transport === 'function';
    // Validate existing custody without writing, recovering, or dispatching.
    const lease = this.store.lock();
    try { this.store.latest(); } finally { closeSync(lease); }
  }
  private caller(input: ResearchCaller): ResearchCaller {
    const caller = researchJson(input);
    researchId(caller.principal); researchId(caller.accountId); researchId(caller.sessionId);
    if (Object.keys(caller).sort().join(',') !== 'accountId,principal,sessionId' || caller.principal !== this.scope.principal || caller.accountId !== this.scope.accountId) throw Error('Research caller ownership mismatch');
    return caller;
  }
  private stamp(): string {
    const at = this.now().toISOString();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(at)) throw Error('Invalid research clock');
    return at;
  }
  private notify(run: ResearchRun): void { try { this.observer?.(researchJson(run)); } catch { /* Observation cannot grant dispatch or break retention. */ } }
  private readRuns(): ResearchRun[] {
    if (this.active) return this.store.latest();
    const lease = this.store.lock();
    try {
      // A process-death reservation remains consumed. Reads never silently resume it.
      return this.store.latest().map(run => terminalResearchState(run.state) ? run : finish(run, 'interrupted', run.updatedAt, 'process_interrupted'));
    } finally { closeSync(lease); }
  }
  getRun(callerInput: ResearchCaller, runId: string): ResearchRun {
    const caller = this.caller(callerInput);
    const run = this.readRuns().find(item => item.runId === runId);
    if (!run || run.sessionId !== caller.sessionId) throw Error('Research run unavailable for this session');
    return researchJson(run);
  }
  /** Explicit restart bookkeeping. No transport and no automatic retry. */
  recover(callerInput: ResearchCaller): void {
    this.caller(callerInput);
    if (this.active) throw Error('Research account already active');
    const lease = this.store.lock();
    try { this.store.recoverPending(lease); this.recoverRuns(lease); } finally { closeSync(lease); }
  }
  private recoverRuns(lease: number): void {
    for (const run of this.store.latest()) if (!terminalResearchState(run.state)) {
      const interrupted = finish(run, 'interrupted', run.updatedAt, 'process_interrupted');
      this.store.append(interrupted, lease); this.notify(interrupted);
    }
  }
  start(callerInput: ResearchCaller, idempotencyKey: string): ResearchHandle {
    const caller = this.caller(callerInput); researchId(idempotencyKey);
    const scopeSha256 = researchIdentity(this.scope);
    const runId = `run_${researchIdentity([caller.principal, caller.accountId, caller.sessionId, idempotencyKey, scopeSha256])}`;
    if (this.active) {
      if (this.active.run.runId === runId) return { runId, completion: this.active.completion };
      throw Error('Research account already active');
    }
    const lease = this.store.lock(); let transferred = false;
    try {
      const runs = this.store.latest();
      const prior = runs.find(run => run.idempotencyKey === idempotencyKey);
      if (prior) {
        if (prior.runId !== runId) throw Error('Research idempotency key belongs to another session');
        return { runId, completion: Promise.resolve(terminalResearchState(prior.state) ? prior : finish(prior, 'interrupted', prior.updatedAt, 'process_interrupted')) };
      }
      if (!this.enabled || !this.transport) throw Error('Research execution disabled');
      if (runs.length >= this.scope.limits.runs) throw Error('Research run cap exhausted');
      // No mutation for invalid caller, disabled execution, replay, or exhausted cap.
      this.store.recoverPending(lease);
      this.recoverRuns(lease);
      const run: ResearchRun = researchJson({ ...caller, kind: 'atliera.c3.research-run', schemaVersion: '1', runId,
        idempotencyKey, ordinal: runs.length + 1, scope: this.scope, scopeSha256, state: 'started', updatedAt: this.stamp(),
        attempts: [], sources: [], error: null, snapshotId: null });
      this.store.append(run, lease);
      const controller = new AbortController();
      const completion = Promise.resolve().then(() => this.execute(lease));
      this.active = { run, controller, completion }; transferred = true;
      this.notify(run);
      return { runId, completion };
    } finally { if (!transferred) closeSync(lease); }
  }
  cancel(callerInput: ResearchCaller, runId: string): ResearchRun {
    const run = this.getRun(callerInput, runId);
    if (this.active?.run.runId === runId) this.active.controller.abort();
    return run;
  }
  /** Runtime live-disable: prevents queued dispatch and aborts the current exchange. */
  stop(): void { this.enabled = false; this.active?.controller.abort(); }
  private async execute(lease: number): Promise<ResearchRun> {
    const active = this.active!;
    const persist = (next: ResearchRun): void => {
      this.store.append(next, lease); active.run = researchJson(next); this.notify(active.run);
    };
    const check = (): void => { if (!this.enabled || active.controller.signal.aborted) throw Error('cancelled'); };
    try {
      for (const target of this.scope.targets) {
        let url = target.url;
        const visited = new Set<string>();
        while (true) {
          check();
          if (active.run.attempts.length >= this.scope.limits.attempts) throw Error('attempt_limit_reached');
          if (visited.has(url)) throw Error('redirect_refused');
          visited.add(url);
          const reservedAt = this.stamp();
          persist({ ...active.run, state: 'dispatching', updatedAt: reservedAt, attempts: [...active.run.attempts,
            { number: active.run.attempts.length + 1, requestedUrl: target.url, url, reservedAt, transportInvoked: false,
              receivedAt: null, status: null, mediaType: null, redirectTo: null, error: null, response: null }] });
          check();
          let response: SourceResponse;
          const controller = new AbortController();
          const abort = (): void => controller.abort();
          active.controller.signal.addEventListener('abort', abort, { once: true });
          const timer = setTimeout(abort, this.scope.limits.timeoutMs);
          let rejectAbort: (() => void) | undefined;
          try {
            const cancelled = new Promise<never>((_, reject) => {
              rejectAbort = () => reject(Error('transport_cancelled_or_timed_out'));
              controller.signal.addEventListener('abort', rejectAbort, { once: true });
            });
            let exchange: Promise<SourceResponse>;
            // Invoke once, then record the invocation. A crash in this gap leaves a consumed
            // reservation with an unknown dispatch outcome; it never restores the allowance.
            try {
              exchange = Promise.resolve(this.transport!({ url, signal: controller.signal, maxBytes: this.scope.limits.responseBytes,
                timeoutMs: this.scope.limits.timeoutMs }));
            } catch (error) { exchange = Promise.reject(error); }
            // Attach rejection handling before persistence, including non-cooperative late transports.
            const settled = Promise.race([exchange, cancelled]);
            settled.catch(() => undefined);
            persist({ ...active.run, attempts: [...active.run.attempts.slice(0, -1), { ...active.run.attempts.at(-1)!, transportInvoked: true }] });
            response = await settled;
            // Late, non-cooperative transports cannot publish a cancelled response.
            check(); controller.signal.throwIfAborted();
          } finally {
            clearTimeout(timer); active.controller.signal.removeEventListener('abort', abort);
            if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
          }
          const receivedAt = this.stamp();
          let redirectTo: string | null = null;
          let responseError: string | null = null;
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            try {
              if (!response.location) throw Error('redirect_refused');
              const next = canonicalResearchUrl(new URL(response.location, url).href);
              if (!target.redirectUrls.includes(next) || visited.has(next)) throw Error('redirect_refused');
              redirectTo = next;
            } catch { responseError = 'redirect_refused'; }
          }
          if (!(response.body instanceof Uint8Array) || response.body.byteLength > this.scope.limits.responseBytes) responseError = 'source_size_refused';
          if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599 || typeof response.bodyComplete !== 'boolean' || typeof response.mediaType !== 'string' || response.mediaType.length > 200) throw Error('transport_failed');
          const attempt = { ...active.run.attempts.at(-1)!, receivedAt, status: response.status, mediaType: response.mediaType.toLowerCase().trim(), redirectTo, error: responseError,
            response: response.body instanceof Uint8Array && response.body.byteLength <= this.scope.limits.responseBytes
              ? { rawBase64: Buffer.from(response.body).toString('base64'), rawSha256: researchHash(response.body), byteLength: response.body.byteLength, bodyComplete: response.bodyComplete } : null };
          persist({ ...active.run, updatedAt: receivedAt, attempts: [...active.run.attempts.slice(0, -1), attempt] });
          check();
          if (responseError) throw Error(responseError);
          if (redirectTo) { url = redirectTo; continue; }
          const source = extractResearchSource(this.scope, active.run.runId, target, url, response, receivedAt);
          persist({ ...active.run, state: 'retained', updatedAt: receivedAt, sources: [...active.run.sources, source] });
          check(); break;
        }
      }
      const completed = finish(active.run, 'completed', this.stamp(), null); persist(completed); return completed;
    } catch (error) {
      const cancelled = active.controller.signal.aborted || !this.enabled;
      const reason = cancelled ? 'cancelled' : error instanceof Error && sourceErrors.has(error.message) ? error.message : 'transport_or_retention_failed';
      const failed = finish(active.run, cancelled ? 'cancelled' : 'failed', this.stamp(), reason);
      // Persistence failure rejects completion: never claim an unretained successful/failed snapshot.
      persist(failed); return failed;
    } finally { this.active = undefined; closeSync(lease); }
  }
  snapshots(callerInput: ResearchCaller): readonly ResearchSnapshot[] {
    this.caller(callerInput);
    return this.readRuns().filter(run => run.snapshotId !== null).map(run => researchJson({ snapshotId: run.snapshotId!, runId: run.runId,
      principal: run.principal, accountId: run.accountId, state: run.state, updatedAt: run.updatedAt, error: run.error, question: run.scope.question, sources: run.sources,
      coverage: { requested: run.scope.targets.length, retained: run.sources.length, attempts: run.attempts.length, transportInvocations: run.attempts.filter(attempt => attempt.transportInvoked).length,
        unavailableUrls: run.scope.targets.filter(target => !run.sources.some(source => source.requestedUrl === target.url)).map(target => target.url) },
      unknowns: ['Publication, event and evidence-current-through dates are not established.', 'Retrieval does not establish current access or service readiness.',
        'Supported findings, inference, conflict classification, relevance and generation eligibility require separate admission and synthesis.',
        ...(run.sources.some(source => source.extraction.truncated) ? ['At least one clean-text projection was truncated.'] : [])], generationEligible: false }));
  }
  snapshot(caller: ResearchCaller, snapshotId: string): ResearchSnapshot {
    const snapshot = this.snapshots(caller).find(item => item.snapshotId === snapshotId);
    if (!snapshot) throw Error('Research snapshot unavailable for this account and principal');
    return snapshot;
  }
  /** IDs resolve through bound custody; supplied foreign source/snapshot objects are never attached. */
  source(caller: ResearchCaller, snapshotId: string, sourceId: string): RetainedResearchSource {
    const source = this.snapshot(caller, snapshotId).sources.find(item => item.sourceId === sourceId);
    if (!source) throw Error('Research source does not belong to this snapshot');
    return source;
  }
  recovery(caller: ResearchCaller): { readonly remainingRuns: number; readonly recoverable: boolean } {
    this.caller(caller); const remainingRuns = this.scope.limits.runs - this.readRuns().length;
    return { remainingRuns, recoverable: this.enabled && remainingRuns > 0 && !this.active };
  }
  compare(caller: ResearchCaller, beforeId: string, afterId: string): readonly { readonly url: string; readonly change: 'added' | 'changed' | 'unchanged' | 'removed' | 'unavailable'; readonly cleanTextChanged: boolean | null }[] {
    const before = this.snapshot(caller, beforeId); const after = this.snapshot(caller, afterId);
    const urls = new Set([...before.sources.map(source => source.requestedUrl), ...after.sources.map(source => source.requestedUrl), ...after.coverage.unavailableUrls]);
    return [...urls].map(url => {
      const old = before.sources.find(source => source.requestedUrl === url); const next = after.sources.find(source => source.requestedUrl === url);
      return { url, change: next ? old ? old.rawSha256 === next.rawSha256 ? 'unchanged' : 'changed' : 'added' : after.coverage.unavailableUrls.includes(url) ? 'unavailable' : 'removed',
        cleanTextChanged: old && next ? old.cleanTextSha256 !== next.cleanTextSha256 : null };
    });
  }
}
