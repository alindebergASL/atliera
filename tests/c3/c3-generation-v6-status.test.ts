import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const status = readFileSync(new URL('../../docs/strategy/c3-generation-v6-diagnostic-status.md', import.meta.url), 'utf8');
test('v6 diagnostic distinguishes empirical semantics, integrity controls and a failed fresh workflow', () => {
  for (const fact of ['2/3 false rejections','0/4 unsupported acceptances','Three separate malformed integrity controls','seven actual verifier calls','100-second limit','HTTP 502','USD1.0549905','USD1.716187','no accepted fresh initial','no retry, fallback, response healing','unknown final provider cost']) assert.ok(status.includes(fact), fact);
  for (const marker of ['fresh_generation_readiness','fresh_workflow_completed','customer_acceptance','raw_private_evidence_committed','production_deployment_authorized_by_this_record']) assert.match(status,new RegExp('^'+marker+': false$','m'));
  assert.match(status,/^current_provider_execution_authorization: none$/m);
  assert.match(status,/direct provider APIs, including Anthropic API and OpenAI API, remain first-class/);
  assert.match(status,/page reload, not durable Save/);
  assert.match(status,/Save\/restart\/reopen was exercised separately by the in-process persistence regression/);
  assert.doesNotMatch(status,/Chromium review exercised synthetic initial, revision, explicit Apply and saved reopen/);
  assert.match(status,/not human approvals/);
  assert.match(status,/Qwen review attempts produced no usable verdict/);
  assert.doesNotMatch(status,/\b(?:sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})\b|\/home\/[A-Za-z0-9_.-]+\//);
});
