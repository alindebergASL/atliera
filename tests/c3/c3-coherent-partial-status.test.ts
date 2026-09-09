import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('v5 runbook records false refusals and unsupported acceptance without release authority', () => {
  const doc = readFileSync('docs/runbooks/c3-generation-emission-v5.md', 'utf8');
  for (const required of [
    'KNOWN LIMITATION', 'Harbor controls Cedar.', 'false refusals',
    'unsupported assertion acceptance', 'Lexical tuning is closed',
    'assertion-contract decision', 'No admitted excerpt establishes',
    'Lead with the outcome participants name.', 'dated hiring report',
    'personal attribution', 'No new effects are authorized',
  ]) assert.ok(doc.includes(required), required);
});

test('coherent partial status separates historical replay, fresh proof and pending release', () => {
  const doc = readFileSync('docs/status/coherent-workspace-partial-20260909.md', 'utf8');
  for (const required of [
    '../runbooks/c3-generation-emission-v5.md', 'fresh initial/revision journey: UNPROVEN',
    'three paid fresh-initial attempts', 'all three old owner documents',
    'initial → revision → Apply → note → Save → server restart',
    'fresh desktop/mobile browser', 'recorded replay only', 'no provider fallback',
    'exact checked merge', 'backup', 'release readback', 'NOT yet merged/deployed',
    'independent specification review, then quality review', 'GPT-6 Astra/high',
    'Claude Opus 5', 'image critique', 'external and nonbinding',
    'not human tests', 'captures does not establish independent browser execution',
    'No new effects are authorized', 'customer acceptance',
  ]) assert.ok(doc.includes(required), required);
  assert.doesNotMatch(doc, /\/home\/|call-[a-f0-9]{12}|sk-[A-Za-z0-9]|https?:\/\/[^\s]*:\d+/u);
});
