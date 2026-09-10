import assert from 'node:assert/strict';
import test from 'node:test';
import { commandC3TimingOptions, CommandC3ModelProvider } from '../../src/c3/provider.ts';
import type { C3ModelRequest } from '../../src/c3/draft.ts';
import { main } from '../../src/c3/cli.ts';

test('operator timing is finite, opt-in, and shares only derived non-secret bounds', () => {
  assert.deepEqual(commandC3TimingOptions(undefined), {});
  assert.deepEqual(commandC3TimingOptions('240000'), {
    timeoutMs: 240000, killGraceMs: 15000,
    environment: { C3_COMMAND_TIMEOUT_MS: '240000', C3_COMMAND_KILL_GRACE_MS: '15000' },
  });
  for (const value of ['', 'Infinity', 'NaN', '0', '-1', '999', '300001', '240000.1', ' 240000', '1e5']) {
    assert.throws(() => commandC3TimingOptions(value), /timeout/);
  }
  assert.equal(commandC3TimingOptions('300000').timeoutMs, 300000);
});

test('command receives the selected envelope and cleanup grace', async () => {
  const provider = new CommandC3ModelProvider({ command: process.execPath,
    args: ['-e', "require('node:fs').writeSync(1,JSON.stringify({outer:process.env.C3_COMMAND_TIMEOUT_MS,grace:process.env.C3_COMMAND_KILL_GRACE_MS}))"],
    ...commandC3TimingOptions('240000') });
  assert.deepEqual(JSON.parse(await provider.generate({} as C3ModelRequest, new AbortController().signal)),
    { outer: '240000', grace: '15000' });
});

test('serve rejects invalid operator timing before command execution or listening', async () => {
  const oldCommand = process.env.C3_MODEL_COMMAND;
  const oldTiming = process.env.C3_MODEL_TIMEOUT_MS;
  try {
    process.env.C3_MODEL_COMMAND = '/unconfigured-offline-test-command';
    process.env.C3_MODEL_TIMEOUT_MS = 'Infinity';
    await assert.rejects(() => main(['serve']), /C3_MODEL_TIMEOUT_MS timeout refused/);
  } finally {
    if (oldCommand === undefined) delete process.env.C3_MODEL_COMMAND; else process.env.C3_MODEL_COMMAND = oldCommand;
    if (oldTiming === undefined) delete process.env.C3_MODEL_TIMEOUT_MS; else process.env.C3_MODEL_TIMEOUT_MS = oldTiming;
  }
});
