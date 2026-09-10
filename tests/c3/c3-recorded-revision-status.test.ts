import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const text = readFileSync(new URL('../../docs/strategy/c3-recorded-revision-availability.md', import.meta.url), 'utf8');
test('recorded-revision continuation separates historical evidence from authority', () => {
  for (const name of ['fresh_workflow_completed', 'customer_acceptance', 'raw_private_evidence_committed', 'provider_execution_authorized_by_this_record', 'preview_deployment_authorized_by_this_record']) {
    assert.match(text, new RegExp('^' + name + ': false$', 'm'));
    assert.doesNotMatch(text, new RegExp('^' + name + ': true$', 'm'));
  }
  assert.match(text, /2\/3 false rejections and 0\/4 unsupported acceptances/);
  assert.match(text, /Qwen is not generally unusable/);
  assert.match(text, /Same-family generator\/verifier correlation/);
  assert.match(text, /fifteen-attempt checkpoint/);
  assert.match(text, /thirteen received attempts were settled at USD1\.9742505/);
  assert.match(text, /Two unresolved attempts retain the full USD1\.716187 reservation each/);
  assert.match(text, /not released its conservative reservation/);
  assert.match(text, /Synthetic replay compatibility tests are not fresh-generation proof/);
  assert.match(text, /Exact excerpt matching is not independent world-truth or currentness verification/);
  assert.doesNotMatch(text, /\/home\/|\/var\/lib\/|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]{12,}/);
});
