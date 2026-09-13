import { questionPassages } from './research-render.ts';
import { relative, resolve, sep } from 'node:path';
import { BoundedResearchExecution, type ResearchSnapshot } from './research-run.ts';
import { researchId, researchIdentity, researchJson, validateResearchScope, type ResearchScope, type ResearchCaller, type ResearchTransport, type ResearchPassage } from './research-source.ts';
import { createRestrictedResearchTransport } from './research-transport.ts';
import { createNativeResearchDependencies } from './research-native-https.ts';

/** Trusted, private operator input. authorizationRef is provenance, never sufficient authority.
 * Parent binds reviewed code/config to the current user grant before explicitly enabling. */
export interface AccountResearchConfiguration {
  readonly principal: string; readonly accountId: string; readonly enabled: boolean;
  readonly scope: ResearchScope; readonly retentionRoot: string;
  readonly validFrom: string; readonly validUntil: string;
}
export interface AccountResearchOptions {
  readonly config: AccountResearchConfiguration;
  /** TEST ONLY synthetic acquisition; no native I/O required by handler tests. */
  readonly testOnlyTransport?: ResearchTransport;
  /** Trusted operator kill switch checked before each dispatch; never browser supplied. */
  readonly networkEnabled?: () => boolean;
}
export function validateAccountResearchConfiguration(value: AccountResearchConfiguration, accountId: string, principal?: string, workRoot?: string): AccountResearchConfiguration {
  const config = researchJson(value);
  if (Object.keys(config).sort().join(',') !== 'accountId,enabled,principal,retentionRoot,scope,validFrom,validUntil' ||
      typeof config.enabled !== 'boolean' || config.accountId !== accountId || principal !== undefined && config.principal !== principal) throw Error('Research configuration binding refused');
  researchId(config.principal); researchId(config.accountId);
  validateResearchScope(config.scope, config);
  for (const time of [config.validFrom, config.validUntil]) if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(time) || !Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== time) throw Error('Explicit research validity window required');
  if (config.validFrom >= config.validUntil) throw Error('Invalid research validity window');
  if (typeof config.retentionRoot !== 'string') throw Error('Private research retention root required');
  if (workRoot) {
    const paths = [resolve(config.retentionRoot), resolve(workRoot)];
    for (const [a, b] of [paths, paths.slice().reverse()]) {
      const rel = relative(a!, b!);
      if (rel === '' || rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep)) throw Error('Research and work retention roots must be separate');
    }
  }
  return config;
}
function keys(body: unknown, expected: string[]): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== expected.sort().join(',')) throw Error('Invalid research request fields');
  const values = body as Record<string, unknown>;
  for (const key of expected) if (typeof values[key] !== 'string') throw Error('Invalid research request identity');
  return values as Record<string, string>;
}
export interface ResearchSelection {
  readonly accountId: string; readonly principal: string; readonly snapshotId: string; readonly sourceId: string;
  readonly rawSha256: string; readonly cleanTextSha256: string; readonly passage: ResearchPassage;
  readonly acquisition: 'direct-source'; readonly findingId: null; readonly generationEligible: false; readonly reason: string;
}
export interface ResearchDisplay {
  readonly configured: boolean; readonly available: boolean; readonly reason: string;
  readonly question: string | null; readonly requested: number; readonly remainingRuns: number;
  readonly run: { runId: string; state: string; error: string | null; captured: number; attempts: number; updatedAt: string } | null;
  readonly snapshots: readonly ResearchSnapshot[];
  readonly comparison: ReturnType<BoundedResearchExecution['compare']>;
}
export class AccountResearchService {
  private readonly execution: BoundedResearchExecution;
  private readonly ownedRuns = new Map<string, string>();
  private readonly completions = new Set<Promise<unknown>>();
  private stopped = false;
  readonly config: AccountResearchConfiguration;
  constructor(options: AccountResearchOptions, binding: { accountId: string; principal?: string; workRoot?: string }, private readonly now: () => Date) {
    this.config = validateAccountResearchConfiguration(options.config, binding.accountId, binding.principal, binding.workRoot);
    this.networkEnabled = options.networkEnabled ?? (() => true);
    const transport = options.testOnlyTransport ?? createRestrictedResearchTransport(this.config.scope, createNativeResearchDependencies());
    this.execution = new BoundedResearchExecution({ ...this.config, now, transport: input => {
      if (this.unavailable()) throw Error('transport_scope_refused');
      return transport(input);
    } });
  }
  private readonly networkEnabled: () => boolean;
  private caller(sessionId: string): ResearchCaller { return { principal: this.config.principal, accountId: this.config.accountId, sessionId: `browser_${sessionId}` }; }
  private unavailable(): string | null {
    if (this.stopped || !this.config.enabled || !this.networkEnabled()) return 'Research network execution is disabled by the operator.';
    const time = this.now().toISOString();
    if (time < this.config.validFrom || time >= this.config.validUntil) return 'The configured research window is not active. Retained sources remain inspectable.';
    return null;
  }
  display(sessionId: string): ResearchDisplay {
    const caller = this.caller(sessionId);
    const snapshots = this.execution.snapshots(caller);
    const currentId = this.ownedRuns.get(sessionId);
    const run = currentId ? this.execution.getRun(caller, currentId) : undefined;
    const recovery = this.execution.recovery(caller);
    const remainingRuns = recovery.remainingRuns;
    const reason = this.unavailable() ?? (remainingRuns === 0 ? 'The persistent research allowance is exhausted. Retained sources remain inspectable.' : !recovery.recoverable ? 'Research is active for this account. Only the initiating browser session can cancel it.' : 'Exact official pages only. Start or refresh explicitly; no search or model analysis.');
    return { configured: true, available: !this.unavailable() && recovery.recoverable, reason, question: this.config.scope.question,
      requested: this.config.scope.targets.length, remainingRuns,
      run: run ? { runId: run.runId, state: run.state, error: run.error, captured: run.sources.length, attempts: run.attempts.length, updatedAt: run.updatedAt } : null,
      snapshots, comparison: snapshots.length > 1 ? this.execution.compare(caller, snapshots.at(-2)!.snapshotId, snapshots.at(-1)!.snapshotId) : [] };
  }
  action(sessionId: string, path: string, body: unknown): { display: ResearchDisplay; inspectedSnapshot?: ResearchSnapshot; inspectedSource?: ReturnType<BoundedResearchExecution['source']>; selection?: ResearchSelection } {
    const caller = this.caller(sessionId);
    let extra: { inspectedSnapshot?: ResearchSnapshot; inspectedSource?: ReturnType<BoundedResearchExecution['source']>; selection?: ResearchSelection } = {};
    if (path === '/api/research/start' || path === '/api/research/refresh') {
      const refresh = path === '/api/research/refresh';
      const value = keys(body, refresh ? ['snapshotId'] : []);
      const key = refresh ? `refresh_${researchIdentity(value.snapshotId)}` : 'initial';
      const runId = `run_${researchIdentity([caller.principal, caller.accountId, caller.sessionId, key, researchIdentity(this.config.scope)])}`;
      let replay = false;
      try { this.execution.getRun(caller, runId); replay = true; } catch { /* New explicit operation. */ }
      if (!replay) {
        const unavailable = this.unavailable(); if (unavailable) throw Error(unavailable);
        const snapshots = this.execution.snapshots(caller);
        if (refresh ? snapshots.at(-1)?.snapshotId !== value.snapshotId : snapshots.length > 0) throw Error('Research selection is stale. Inspect the latest snapshot before an explicit refresh.');
      }
      const handle = this.execution.start(caller, key); this.ownedRuns.set(sessionId, handle.runId);
      const completion = handle.completion.catch(() => undefined).finally(() => this.completions.delete(completion));
      this.completions.add(completion);
    } else if (path === '/api/research/status') keys(body, []);
    else if (path === '/api/research/cancel') {
      const value = keys(body, ['runId']); this.execution.cancel(caller, value.runId!);
    } else if (path === '/api/research/run') {
      const value = keys(body, ['runId']); this.execution.getRun(caller, value.runId!); this.ownedRuns.set(sessionId, value.runId!);
    } else if (path === '/api/research/recover') { keys(body, []); this.execution.recover(caller); }
    else if (path === '/api/research/snapshot') {
      const value = keys(body, ['snapshotId']); extra = { inspectedSnapshot: this.execution.snapshot(caller, value.snapshotId!) };
    } else if (path === '/api/research/source' || path === '/api/research/select') {
      const value = keys(body, path.endsWith('/select') ? ['snapshotId', 'sourceId', 'passageSha256'] : ['snapshotId', 'sourceId']);
      const source = this.execution.source(caller, value.snapshotId!, value.sourceId!);
      if (path.endsWith('/select')) {
        if (this.execution.snapshots(caller).at(-1)?.snapshotId !== value.snapshotId || this.execution.snapshot(caller, value.snapshotId!).state !== 'completed') throw Error('Selected snapshot is stale. Historical evidence remains inspectable.');
        const passage = questionPassages(source, this.config.scope.question).find(item => item.sha256 === value.passageSha256);
        if (!passage) throw Error('Selected passage is not retained by this source');
        extra = { selection: { accountId: caller.accountId, principal: caller.principal, snapshotId: value.snapshotId!, sourceId: source.sourceId,
          rawSha256: source.rawSha256, cleanTextSha256: source.cleanTextSha256, passage, acquisition: source.acquisition,
          findingId: null, generationEligible: false, reason: 'Exact passage selected. Validated finding admission is still required before targeted brief generation.' } };
      } else extra = { inspectedSource: source };
    } else throw Error('Unknown research route');
    return { display: this.display(sessionId), ...extra };
  }
  /** Re-resolve current immutable custody before admission or first generation. */
  selectedRun(sessionId: string, snapshotId: string): import('./research-store.ts').ResearchRun {
    const caller = this.caller(sessionId);
    const latest = this.execution.snapshots(caller).at(-1);
    if (!latest || latest.snapshotId !== snapshotId || latest.state !== 'completed') throw Error('Completed latest snapshot required');
    const run = this.execution.latestCompletedRun(caller, latest.snapshotId);
    return run;
  }
  disable(): void { this.stopped = true; this.execution.stop(); }
  async close(): Promise<void> { this.disable(); await Promise.all([...this.completions]); }
}
export const unavailableResearchDisplay = (): ResearchDisplay => ({ configured: false, available: false,
  reason: 'Research unavailable. No trusted per-account scope and private source retention are configured.', question: null, requested: 0, remainingRuns: 0, run: null, snapshots: [], comparison: [] });
