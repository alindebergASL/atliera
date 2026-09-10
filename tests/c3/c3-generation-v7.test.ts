import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../src/c3/context.ts';
import * as legacy from '../../src/c3/draft.ts';
import * as v6 from '../../src/c3/generation-contract-v6.ts';
import * as v2 from '../../src/c3/generation-contract-v2.ts';
import * as contract from '../../src/c3/generation-contract.ts';
import { C3V7ValidationError, displayFields, validateV7Integrity } from '../../src/c3/generation-contract-v7.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';
import { generationRefusalNotice } from '../../src/c3/generation-outcome.ts';
import { syntheticMeetingCandidate, syntheticMeetingRequest, syntheticWorkshopContext } from '../fixtures/c3-workshop.ts';

const context = syntheticWorkshopContext();
const request = contract.createC3ModelRequest(context, syntheticMeetingRequest);
const raw = syntheticMeetingCandidate(context) + '\n\n';

// Synthetic verdict injection exercises custody/coverage/refusal plumbing only. It is not a semantic model.
function output(check: contract.C3VerificationRequest) {
  const fields = JSON.parse(check.prompt.split('DISPLAY FIELDS\n')[1]!.split('\n\nCOMPLETE ORIGINAL')[0]!);
  return { kind: 'atliera.c3.evidence-verification', schemaVersion: check.schemaVersion,
    contextSha256: check.contextSha256, modelRequestSha256: check.modelRequestSha256, rawResponseSha256: check.rawResponseSha256,
    findings: fields.map((field: any) => ({ ...field, kind: field.path.includes('question') ? 'question' : 'non_assertion',
      entityScope: 'Synthetic fixture', dateScope: 'Synthetic fixture', modality: 'Synthetic fixture',
      verdict: 'supported', reason: 'Injected fixture verdict, not semantic model evidence.' })) };
}
function fixture(bytes = raw, req = request) {
  const check = contract.createC3VerificationRequest(req, bytes, context);
  return { bytes, req, check, result: output(check) };
}
function record(f: ReturnType<typeof fixture>) {
  return contract.createGenerationRecord(f.req, f.bytes, context,
    contract.retainC3Verification(f.check, JSON.stringify(f.result) + '\n\n'));
}
function assertKind(f: ReturnType<typeof fixture>, kind: string, checkRaw: string | null = JSON.stringify(f.result)) {
  assert.throws(() => contract.validateC3Candidate(f.bytes, context, undefined, '7',
    contract.retainC3Verification(f.check, checkRaw), f.req),
  (error: unknown) => error instanceof C3V7ValidationError && error.failureKind === kind);
  const retained = contract.createGenerationRecord(f.req, f.bytes, context, contract.retainC3Verification(f.check, checkRaw));
  assert.equal(retained.generationContractVersion, '7');
  if (retained.generationContractVersion === '7') assert.equal(retained.refusal?.failureKind, kind);
  const original = canonicalJson(retained);
  const label = kind === 'verifier_format' ? 'Evidence-check format rejected' : kind === 'verifier_transport' ? 'Evidence-check transport failed' : 'Evidence check refused this proposal';
  assert.ok(generationRefusalNotice(retained).startsWith(label));
  assert.match(generationRefusalNotice(retained), /Original retained without repair/);
  assert.equal(canonicalJson(retained), original, 'presentation never changes acceptance or retained bytes');
  contract.assertReplayIdentity(retained, context);
}

test('v7 new wire omits annotations and retains concise qualified prose and discovery instructions', () => {
  assert.equal(request.generationContractVersion, '7');
  const schema = JSON.parse(request.prompt.split('OUTPUT SCHEMA\n')[1]!.split('\n\nMEETING REQUEST')[0]!);
  assert.deepEqual(Object.keys(schema).sort(), Object.keys(JSON.parse(raw)).sort());
  assert.equal(Object.hasOwn(schema, 'assertions'), false);
  assert.match(request.prompt, /2–3 sentences/);
  assert.match(request.prompt, /15–20 seconds/);
  assert.match(request.prompt, /preserving qualifications next to the claims/);
  assert.match(request.prompt, /first discover whether a current outcome or constraint exists, allowing none/);
  assert.match(request.prompt, /prior acceptance is not evidence of truth/);
  const check = fixture().check;
  for (const field of displayFields(validateV7Integrity(raw, context))) assert.ok(check.prompt.includes(field.text));
  assert.match(check.prompt, /EVERY DISPLAY FIELD/);
  assert.match(check.prompt, /cannot excuse embedded factual premises/);
  assert.match(check.prompt, /only its own cited IDs/);
});

const parts = ['Discuss 🧭 ', 'cafe\u0301', '—', 'plans.', '\n', 'Confirm\u00a0scope', '; ', 'allow none.'];
for (const phase of ['initial', 'revision'] as const) test(`${phase}: Unicode, punctuation and changed text remain exact through request, checker and replay`, () => {
  const original = record(fixture());
  const originalBytes = canonicalJson(original);
  const revision = contract.createC3RevisionContext(original, 'Shorten the opening and discover whether a constraint exists.', 1);
  const req = phase === 'revision' ? contract.createC3ModelRequest(context, syntheticMeetingRequest, revision) : request;
  const candidate = JSON.parse(raw);
  const segments = phase === 'revision' ? ['Explore 🛰 ', ...parts.slice(1), ' Then decide.'] : parts;
  candidate.opening.text = segments.join('');
  candidate.questions[0].question = 'Is there a current outcome to explore—if any?';
  candidate.questions[1].question = 'If so, is anything constraining it today—and who could clarify?';
  const bytes = JSON.stringify(candidate) + '\n';
  const f = fixture(bytes, req);
  const index = f.result.findings.findIndex((field: any) => field.path === 'opening.text');
  f.result.findings.splice(index, 1, ...segments.map(text => ({ ...f.result.findings[index], text })));
  const accepted = record(f);
  assert.equal(accepted.outcome, 'succeeded', accepted.refusal?.message);
  assert.equal(accepted.rawResponse, bytes);
  assert.equal(accepted.draft!.opening.text, segments.join(''));
  assert.equal(accepted.draft!.status, 'proposed_unreviewed');
  assert.equal(accepted.draft!.durablySaved, false);
  assert.equal(canonicalJson(original), originalBytes);
  contract.assertReplayIdentity(JSON.parse(JSON.stringify(accepted)), context);
  for (const change of [
    (fs: any[]) => { fs[index + 1].text = fs[index + 1].text.normalize('NFC'); },
    (fs: any[]) => { fs[index].text = fs[index].text.trim(); },
    (fs: any[]) => { fs[index].text = 'Changed after checking.'; },
    (fs: any[]) => { fs[index].start = 0; },
  ]) {
    const altered = { ...f, result: structuredClone(f.result) }; change(altered.result.findings);
    assertKind(altered, 'verifier_format');
    assert.equal(record(altered).rawResponse, bytes);
  }
});

for (const field of displayFields(validateV7Integrity(raw, context))) {
  test(`complete checker cannot omit or normalize ${field.path}`, () => {
    for (const mode of ['omit', 'alter', 'refuse'] as const) {
      const f = fixture();
      if (mode === 'omit') f.result.findings = f.result.findings.filter((item: any) => item.path !== field.path);
      else f.result.findings.find((item: any) => item.path === field.path)[mode === 'alter' ? 'text' : 'verdict'] = mode === 'alter' ? 'Wrong text.' : 'insufficient';
      assertKind(f, mode === 'refuse' ? 'semantic_refusal' : 'verifier_format');
      const refused = record(f); assert.equal(refused.outcome, 'refused');
      assert.equal(refused.rawResponse, raw); contract.assertReplayIdentity(refused, context);
    }
  });
}

for (const [name, mutate] of [
  ['generator annotations even empty', (c: any) => { c.assertions = []; }],
  ['unknown citation', (c: any) => { c.questions[0].evidenceRefs = ['unknown-evidence']; }],
  ['duplicate citation', (c: any) => { c.questions[0].evidenceRefs.push(c.questions[0].evidenceRefs[0]); }],
  ['citation union mismatch', (c: any) => { c.selectedEvidenceRefs = []; }],
  ['unsupported exact quote', (c: any) => { c.opening.text = 'The source says “a completely fictional statement”.'; }],
  ['fake direct support', (c: any) => { c.audienceThesis.text = 'Invented direct statement.'; }],
  ['meeting revision as account change', (c: any) => { c.temporalOutcome = 'change_against_prior_revision'; }],
] as const) test(`structural refusal: ${name}`, () => {
  const candidate = JSON.parse(raw); mutate(candidate); const bytes = JSON.stringify(candidate);
  assert.throws(() => contract.createC3VerificationRequest(request, bytes, context));
  assert.throws(() => contract.validateC3Candidate(bytes, context, undefined, '7', undefined, request),
    (e: unknown) => e instanceof C3V7ValidationError && e.failureKind === 'structural');
  const refused = contract.createGenerationRecord(request, bytes, context); assert.equal(refused.outcome, 'refused');
  if (refused.generationContractVersion === '7') assert.equal(refused.refusal?.failureKind, 'structural');
  assert.match(generationRefusalNotice(refused), /^Draft format rejected\./);
  assert.equal(refused.rawResponse, bytes); contract.assertReplayIdentity(refused, context);
});

for (const mode of ['sparse', 'conflict'] as const) test(`v7 keeps ${mode} evidence limits visible and checked`, () => {
  const ctx = syntheticWorkshopContext('cedar', mode);
  const req = contract.createC3ModelRequest(ctx, syntheticMeetingRequest);
  const bytes = syntheticMeetingCandidate(ctx);
  const check = contract.createC3VerificationRequest(req, bytes, ctx);
  const retained = contract.createGenerationRecord(req, bytes, ctx, contract.retainC3Verification(check, JSON.stringify(output(check))));
  assert.equal(retained.outcome, 'succeeded');
  if (mode === 'sparse') {
    assert.equal(retained.draft!.temporalOutcome, 'insufficient_context');
    assert.deepEqual(retained.draft!.selectedEvidenceRefs, []);
  } else assert.ok(retained.draft!.warnings.some(w => w.code === 'known_contradiction'));
  contract.assertReplayIdentity(retained, ctx);
});

test('verifier format, semantic refusal and transport unavailability stay distinct without changing raw output', () => {
  const f = fixture();
  assertKind(f, 'verifier_format', '{malformed');
  assertKind(f, 'verifier_transport', null);
  for (const verdict of ['insufficient', 'contradicted']) {
    f.result.findings[0].verdict = verdict; assertKind(f, 'semantic_refusal');
    assert.equal(record(f).outcome, 'refused');
  }
  const mixed = fixture(); mixed.result.findings[0].verdict = 'insufficient'; mixed.result.findings.pop();
  assertKind(mixed, 'verifier_format'); // Incomplete output cannot masquerade as a complete semantic judgment.
  assert.equal(contract.createGenerationRecord(request, raw, context).outcome, 'refused');
});

test('field citation ownership and candidate/request/schema identities cannot be substituted', () => {
  for (const mutate of [
    (f: any) => { f.result.findings.find((v: any) => v.path === 'objective.text').evidenceRefs = JSON.parse(raw).selectedEvidenceRefs; },
    (f: any) => { f.result.findings[0].kind = 'sourced_statement'; f.result.findings[0].evidenceRefs = []; },
    (f: any) => { f.result.rawResponseSha256 = '0'.repeat(64); },
    (f: any) => { f.result.modelRequestSha256 = '0'.repeat(64); },
    (f: any) => { f.result.contextSha256 = '0'.repeat(64); },
    (f: any) => { f.result.schemaVersion = '1'; },
    (f: any) => { f.result.findings.push(f.result.findings[0]); },
  ]) { const f = fixture(); mutate(f); assertKind(f, 'verifier_format'); }
  assert.throws(() => contract.createC3VerificationRequest(request, raw, context, '1'), /requires.*schema 2/);
  const f = fixture(); const check = { ...f.check, generationContractVersion: '6' } as contract.C3VerificationRequest;
  assert.equal(contract.createGenerationRecord(request, raw, context, contract.retainC3Verification(check, JSON.stringify(f.result))).outcome, 'refused');
  const duplicate = raw.replace('"temporalOutcome":', '"temporalOutcome":"insufficient_context","temporalOutcome":');
  assert.throws(() => validateV7Integrity(duplicate, context), /strict JSON/);
});

// Held out from earlier question-recovery prose. Authored positives/negatives, not model acceptance-rate evidence.
for (const example of [
  { name: 'ordinary discovery', text: 'What would make this discussion useful for your team?', verdict: 'supported' },
  { name: 'existence before constraint', text: 'Is anything limiting progress, or is there no constraint to address?', verdict: 'supported' },
  { name: 'conditional ownership', text: 'If a relevant outcome emerges, who could help us understand it?', verdict: 'supported' },
  { name: 'scope expansion', text: 'How will all operating divisions adopt the depot pilot?', verdict: 'insufficient' },
  { name: 'current date promotion', text: 'Who owns the program that remains operational today?', verdict: 'insufficient' },
  { name: 'decisive presupposition', text: 'Which current constraint is decisive: staffing, procurement, or governance?', verdict: 'insufficient' },
]) test(`heldout synthetic verdict plumbing: ${example.name}`, () => {
  const candidate = JSON.parse(raw); candidate.questions[0].question = example.text;
  const f = fixture(JSON.stringify(candidate));
  f.result.findings.find((field: any) => field.path === 'questions[0].question').verdict = example.verdict;
  const result = record(f); assert.equal(result.outcome, example.verdict === 'supported' ? 'succeeded' : 'refused');
  contract.assertReplayIdentity(result, context);
});

test('v6 source, prompt and schema 1/2 success/refusal replay remain unchanged through new dispatch', () => {
  assert.equal(createHash('sha256').update(readFileSync(new URL('../../src/c3/generation-contract-v6.ts', import.meta.url))).digest('hex'), 'cf698e9240a0f4f9887a9a1be85008efaeeec84e2d3b8be92cfff6a7863194f1');
  const oldRequest = legacy.createC3ModelRequest(context, syntheticMeetingRequest, null, '6');
  assert.deepEqual(contract.createC3ModelRequest(context, syntheticMeetingRequest, null, '6'), oldRequest);
  assert.equal(v6.v6Hash(canonicalJson(oldRequest)), '4590654f474cc7f50b22b1c7f8422af0ad3ea7c51f8a3b52f944826c6289433f');
  const oldRaw = JSON.stringify({ ...JSON.parse(raw), assertions: [] }) + '\n\n';
  for (const schema of ['1', '2'] as const) {
    const check = v6.createC3VerificationRequest(oldRequest, oldRaw, context, schema);
    assert.deepEqual(contract.createC3VerificationRequest(oldRequest, oldRaw, context, schema), check);
    for (const verdict of ['supported', 'insufficient']) {
      const result = JSON.parse(scriptedFullCoverage(check)); result.findings[0].verdict = verdict;
      const verification = v6.retainC3Verification(check, JSON.stringify(result));
      const oldRecord = legacy.createGenerationRecord(oldRequest, oldRaw, context, verification);
      assert.deepEqual(contract.createGenerationRecord(oldRequest, oldRaw, context, verification), oldRecord);
      assert.deepEqual(contract.reconstructC3ModelRequest(context, oldRecord), oldRequest);
      contract.assertReplayIdentity(JSON.parse(JSON.stringify(oldRecord)), context);
    }
  }
  assert.throws(() => validateV7Integrity(oldRaw, context), /unexpected or missing/);
  assert.throws(() => v6.validateV6Integrity(raw, context), /unexpected or missing/);
  assert.throws(() => contract.createC3ModelRequest(context, syntheticMeetingRequest, null, '8' as any), /unsupported/);
});

test('historical 2–5 and missing markers never select the fresh v7 prompt', () => {
  const requests = [v2.createC3ModelRequest(context, syntheticMeetingRequest),
    ...(['2', '3', '4', '5'] as const).map(version => legacy.createC3ModelRequest(context, syntheticMeetingRequest, null, version))];
  for (const req of requests) {
    const oldRecord = legacy.createGenerationRecord(req, raw, context);
    assert.deepEqual(contract.createGenerationRecord(req, raw, context), oldRecord);
    assert.deepEqual(contract.reconstructC3ModelRequest(context, oldRecord), req);
    contract.assertReplayIdentity(oldRecord, context);
  }
  assert.equal(contract.c3GenerationContractVersion(Object.create({ generationContractVersion: '7' })), '2');
  assert.equal(contract.c3GenerationContractVersion({}), '2');
});
