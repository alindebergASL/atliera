import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { GENERATION_PROGRESS_CLIENT_SCRIPT } from '../../src/c3/generation-progress-client.ts';

function observation() {
  let next: (() => Promise<void>) | null = null, current = true;
  let response: any = { operationId: 'owned', active: true, stage: 'preparing', elapsedSeconds: 12 };
  const calls: string[] = [];
  const status = { textContent: 'Preparing' };
  const scope: any = { recordedReplay: false, setTimeout(fn: () => Promise<void>) { next = fn; return 1; }, clearTimeout() { next = null; },
    requestJson: async (route: string) => { calls.push(route); if (response instanceof Error) throw response; return response; } };
  vm.runInNewContext(GENERATION_PROGRESS_CLIENT_SCRIPT + ';globalThis.observe = observeGeneration;', scope);
  const stop = scope.observe({ operationId: 'owned' }, status, () => current, ' Original unchanged.');
  return { status, calls, stop, response(value: any) { response = value; }, abandon() { current = false; }, async tick() { const fn = next; next = null; await fn?.(); }, scheduled: () => next !== null };
}

test('progress uses actual owned server stage and elapsed time, never a time threshold', async () => {
  const ui = observation(); assert.equal(ui.status.textContent, 'Preparing');
  await ui.tick(); assert.equal(ui.status.textContent, 'Preparing · 12s elapsed. Original unchanged.');
  ui.response({ operationId: 'owned', active: true, stage: 'preparing', elapsedSeconds: 180 });
  await ui.tick(); assert.match(ui.status.textContent, /^Preparing · 180s/);
  ui.response({ operationId: 'owned', active: true, stage: 'checking-evidence', elapsedSeconds: 181 });
  await ui.tick(); assert.match(ui.status.textContent, /^Checking evidence · 181s/);
  assert.deepEqual(ui.calls, Array(3).fill('/api/generation-status'));
  ui.stop(); assert.equal(ui.scheduled(), false); await ui.tick(); assert.equal(ui.calls.length, 3);
});
test('foreign/stale observations cannot replace the current stage and cancellation stops polling', async () => {
  const ui = observation();
  ui.response({ operationId: 'other', active: true, stage: 'checking-evidence', elapsedSeconds: 10 });
  await ui.tick(); assert.equal(ui.status.textContent, 'Preparing');
  assert.equal(ui.scheduled(), false);
  const abandoned = observation(); abandoned.abandon(); await abandoned.tick(); assert.equal(abandoned.calls.length, 0);
});
test('status failure is not generation failure or a retry and preserves recovery wording', async () => {
  const ui = observation(); ui.response(new Error('offline')); await ui.tick();
  assert.match(ui.status.textContent, /Progress update unavailable; the request may still be running/);
  assert.match(ui.status.textContent, /Original unchanged/);
  assert.deepEqual(ui.calls, ['/api/generation-status']); ui.stop();
});
