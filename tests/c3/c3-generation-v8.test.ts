import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadC3RecordedReplay } from '../../src/c3/cli.ts';
import { canonicalJson } from '../../src/c3/context.ts';
import * as contract from '../../src/c3/generation-contract.ts';
import { v7Hash, validateV7Integrity } from '../../src/c3/generation-contract-v7.ts';
import { C3V8ValidationError } from '../../src/c3/generation-contract-v8.ts';
import { generateVerifiedC3Record, RecordedReplayC3ModelProvider } from '../../src/c3/provider.ts';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';

// PUBLIC synthetic fixtures and injected judgments only; these do not measure model accuracy.
const context = syntheticWorkshopContext();
const raw = syntheticMeetingCandidate(context) + '\n\n';
const request = contract.createC3ModelRequest(context, syntheticMeetingRequest);
const oldRequest = contract.createC3ModelRequest(context, syntheticMeetingRequest, null, '7');
function fixture(bytes = raw, req = request, ctx = context) {
  const check = contract.createC3VerificationRequest(req, bytes, ctx);
  return { bytes, req, ctx, check, result: JSON.parse(scriptedFullCoverage(check)) };
}
function record(f: ReturnType<typeof fixture>) {
  return contract.createGenerationRecord(f.req, f.bytes, f.ctx,
    contract.retainC3Verification(f.check, JSON.stringify(f.result)));
}
function refused(f: ReturnType<typeof fixture>, kind: string) {
  const retained = record(f);
  assert.equal(retained.outcome, 'refused');
  assert.equal(retained.generationContractVersion, '8');
  if (retained.generationContractVersion === '8') assert.equal(retained.refusal?.failureKind, kind);
  assert.equal(retained.rawResponse, f.bytes);
  contract.assertReplayIdentity(retained, f.ctx);
}

test('default v8 adds only field-local generator guidance and version identity to the v7 prompt', () => {
  assert.equal(contract.CURRENT_C3_GENERATION_CONTRACT_VERSION, '8');
  assert.equal(request.generationContractVersion, '8');
  const added = request.prompt.split('\n\n').filter(p => !oldRequest.prompt.split('\n\n').includes(p));
  assert.equal(added.length, 2); // Version header plus the single clarification paragraph.
  assert.equal(added[0], oldRequest.prompt.split('\n\n')[0]!.replace('CONTRACT 7', 'CONTRACT 8'));
  assert.equal(added[1], 'Each display field must cite its own eligible supporting evidence IDs for every factual rationale or presupposition it contains, including source-reported premises inside objective and close recommendations, questions, and intendedLearning. Recommendation or question categories do not exempt their premises. Other fields, selectedEvidenceRefs, and meeting intent cannot supply missing citations. Separate an attributed factual premise from the proposed inquiry and preserve its date, scope and conditional qualifications; citation alone does not establish currentness. Pure actions, open questions without factual presuppositions, and justified evidence-limit unknowns may use empty references.');
  assert.equal(request.prompt.replace(added[1] + '\n\n', '').replace('CONTRACT 8', 'CONTRACT 7'), oldRequest.prompt);
  assert.equal(contract.c3GenerationContractVersion(Object.create({ generationContractVersion: '8' })), '2');
  assert.throws(() => contract.createC3ModelRequest(context, syntheticMeetingRequest, null, '9' as any), /unsupported/);
});

test('v8 verifier instructions and output requirements are unchanged apart from request identity', () => {
  const current = fixture().check;
  const old = fixture(raw, oldRequest).check;
  assert.equal(current.prompt.replaceAll(current.modelRequestSha256, old.modelRequestSha256), old.prompt);
  const v7 = readFileSync(new URL('../../src/c3/generation-contract-v7.ts', import.meta.url), 'utf8');
  const v8 = readFileSync(new URL('../../src/c3/generation-contract-v8.ts', import.meta.url), 'utf8');
  // The complete verifier implementation is frozen-equivalent after version-symbol substitution.
  assert.equal(v8.slice(v8.indexOf('export type C3V8VerificationSchemaVersion')).replaceAll('V8', 'V7').replaceAll('v8Hash', 'v7Hash').replaceAll("'8'", "'7'"),
    v7.slice(v7.indexOf('export type C3V7VerificationSchemaVersion')));
});

test('pure action objectives, open questions and evidence-limit unknowns structurally allow empty refs', () => {
  const candidate = JSON.parse(raw);
  candidate.objective.text = 'Explore whether a follow-up would be useful.';
  candidate.questions.forEach((q: any) => { q.evidenceRefs = []; q.question = 'What, if anything, would be useful to explore?'; });
  const bytes = JSON.stringify(candidate);
  assert.deepEqual(validateV7Integrity(bytes, context).objective.evidenceRefs, []);
  assert.doesNotThrow(() => contract.createC3VerificationRequest(request, bytes, context));
  assert.equal(record(fixture(bytes)).outcome, 'succeeded', 'Injected judgments exercise schema only.');
});

test('recommendation premises can own citations; split factual premise and proposed inquiry retain exact coverage', () => {
  const candidate = JSON.parse(raw), evidence = context.context.admittedSources[0]!.excerpts[0]!;
  const premise = `The supplied report states: ${evidence.exactExcerpt} `;
  const inquiry = 'Ask whether any follow-up would be useful.';
  candidate.objective = { text: premise + inquiry, supportCategory: 'recommendation', evidenceRefs: [evidence.evidenceId] };
  const f = fixture(JSON.stringify(candidate));
  const index = f.result.findings.findIndex((v: any) => v.path === 'objective.text');
  const field = f.result.findings[index];
  f.result.findings.splice(index, 1,
    { ...field, text: premise, kind: 'sourced_statement' },
    { ...field, text: inquiry, kind: 'proposed_action', evidenceRefs: [] });
  const accepted = record(f);
  assert.equal(accepted.outcome, 'succeeded');
  contract.assertReplayIdentity(accepted, context);
  for (const mutate of [
    (items: any[]) => { items[index].text = premise.trimEnd(); },
    (items: any[]) => { items.splice(index, 1); },
    (items: any[]) => { items[index + 1].text = premise + inquiry; },
    (items: any[]) => { items[index].evidenceRefs = []; },
  ]) { const altered = { ...f, result: structuredClone(f.result) }; mutate(altered.result.findings); refused(altered, 'verifier_format'); }
  f.result.findings[index].verdict = 'insufficient';
  refused(f, 'semantic_refusal');
});

test('foreign-field and selected-evidence citation borrowing remains denied', () => {
  for (const path of ['objective.text', 'closeCriterion.text', 'questions[0].question', 'questions[0].intendedLearning']) {
    const candidate = JSON.parse(raw);
    candidate.questions[0].evidenceRefs = [];
    const f = fixture(JSON.stringify(candidate));
    const field = f.result.findings.find((v: any) => v.path === path);
    field.kind = 'sourced_statement'; field.evidenceRefs = candidate.selectedEvidenceRefs;
    refused(f, 'verifier_format');
  }
});

test('every v8 display field still requires complete, exact findings and refuses unsupported content', () => {
  for (const field of fixture().result.findings) {
    for (const mode of ['omit', 'change', 'refuse']) {
      const f = fixture(); const index = f.result.findings.findIndex((v: any) => v.path === field.path);
      if (mode === 'omit') f.result.findings.splice(index, 1);
      if (mode === 'change') f.result.findings[index].text = 'Different text.';
      if (mode === 'refuse') f.result.findings[index].verdict = 'contradicted';
      refused(f, mode === 'refuse' ? 'semantic_refusal' : 'verifier_format');
    }
  }
});

test('v8 receipts cannot cross candidate, context, revision request or contract identity', () => {
  const f = fixture(), receipt = contract.retainC3Verification(f.check, JSON.stringify(f.result));
  const accepted = record(f);
  const revision = contract.createC3ModelRequest(context, syntheticMeetingRequest,
    contract.createC3RevisionContext(accepted, 'Shorten the opening.', 1));
  const otherContext = syntheticWorkshopContext('cedar');
  const changed = JSON.parse(raw); changed.opening.text = 'Explore whether a different discussion would help.';
  for (const [req, bytes, ctx] of [
    [request, JSON.stringify(changed), context], [revision, raw, context], [oldRequest, raw, context],
    [contract.createC3ModelRequest(otherContext, syntheticMeetingRequest), syntheticMeetingCandidate(otherContext), otherContext],
  ] as const) assert.equal(contract.createGenerationRecord(req, bytes, ctx, receipt).outcome, 'refused');
  const oldReceipt = contract.retainC3Verification(fixture(raw, oldRequest).check, scriptedFullCoverage(fixture(raw, oldRequest).check));
  assert.equal(contract.createGenerationRecord(request, raw, context, oldReceipt).outcome, 'refused');
  assert.throws(() => contract.createC3VerificationRequest({ ...oldRequest, generationContractVersion: '8' }, raw, context), /identity mismatch/);
  assert.throws(() => contract.createC3VerificationRequest({ ...request, generationContractVersion: '7' }, raw, context), /identity mismatch/);
  assert.throws(() => contract.assertReplayIdentity({ ...accepted, generationContractVersion: '7' } as contract.C3GenerationRecord, context));
  assert.throws(() => contract.validateC3Candidate(raw, context, undefined, '8', receipt, oldRequest), C3V8ValidationError);
  assert.throws(() => contract.createC3VerificationRequest(request, raw, context, '1'), /requires.*schema 2/);
  assert.equal(contract.createGenerationRecord(request, raw, context).outcome, 'refused');
});

test('v8 never substitutes earlier acceptance for an unchanged objective in a revision', () => {
  const original = record(fixture()), originalBytes = canonicalJson(original);
  const revision = contract.createC3ModelRequest(context, syntheticMeetingRequest,
    contract.createC3RevisionContext(original, 'Shorten the opening.', 1));
  const candidate = JSON.parse(raw); candidate.opening.text = 'Ask whether a follow-up helps.';
  const f = fixture(JSON.stringify(candidate), revision);
  f.result.findings.find((v: any) => v.path === 'objective.text').verdict = 'insufficient';
  assert.equal(candidate.objective.text, original.draft!.objective.text);
  refused(f, 'semantic_refusal');
  assert.equal(canonicalJson(original), originalBytes);
});

test('fresh provider dispatch uses v8 while exact recorded v7 requests remain pinned', async () => {
  const seen: string[] = [];
  const fresh = await generateVerifiedC3Record({ name: 'synthetic-local', executionMode: 'local',
    async generate(req) { seen.push(req.generationContractVersion!); return raw; },
    async verify(req) { seen.push(req.generationContractVersion); return scriptedFullCoverage(req); },
  }, request, context, new AbortController().signal);
  assert.deepEqual(seen, ['8', '8']); assert.equal(fresh.outcome, 'succeeded');
  const replay = new RecordedReplayC3ModelProvider([{ request: oldRequest, rawResponse: raw }]);
  assert.equal(await replay.generate(oldRequest, new AbortController().signal), raw);
  await assert.rejects(replay.generate(request, new AbortController().signal), /record|match|replay/i);
});

// Captured on the untouched base before implementation; public synthetic data only.
const historicalHashes = {
  "request": "74a7723f22729640738fb4888508efd615f04412566177ec070574ea3477ea9e",
  "prompt": "82a6b3207489c2a1864bcf1dfb49fa9a20a8370e9ff922c5873bf0d561486a90",
  "check": "9c64ddf5f6bcfb56517568ef86a8f0cb3113a71625b9adc8c941b0c6ac143e44",
  "checkPrompt": "359b182527b08a1abdafdf1d48ede809bfaadb672ee5c21d68463c2a44fb6fde",
  "accepted": "d7ec21f104c9bda0d0d0b2d78665703cdcae8ad182c89f6cf9188aa9a31e9111",
  "refused": "30c10ae671d1d7712235c076a38eb1d32a8b8e528976f792269190ac1ca4c960",
  "revision": "b8a6994069072d93834210d6b598dd64776e15c097ab904bf2764213df719da2",
  "revisionPrompt": "787de40c550d951deda95f083504b18854b135904d1b5fa0827e6a9128c42d12"
};
const frozenSourceHashes = {
  "src/c3/draft.ts": "8c9de4587aae2fd791cc91a2c1071b4295bebf9c39deb32b7be0112038141fa1",
  "src/c3/generation-claims-v3.ts": "015da5bcf0a47686f1f549fad11d1fc45bfba5e3c1c41435f63a3e81c482b405",
  "src/c3/generation-claims-v4.ts": "f0f8792dd9a9e5ce18b2536656572c7d2cf7d24dceaca0682c06a1e9dc8f8518",
  "src/c3/generation-claims-v5.ts": "f0f8792dd9a9e5ce18b2536656572c7d2cf7d24dceaca0682c06a1e9dc8f8518",
  "src/c3/generation-claims.ts": "f0f8792dd9a9e5ce18b2536656572c7d2cf7d24dceaca0682c06a1e9dc8f8518",
  "src/c3/generation-contract-v2.ts": "389764416e8839e121dd0a1f09182f360d715dcfb5045f32a61d723f51ceec4d",
  "src/c3/generation-contract-v3.ts": "59a5dc04a6ffb64b192cd5f7f2f3d6801bb9aa0f14e4546933a3d56ed927352a",
  "src/c3/generation-contract-v4.ts": "fad9c1e64d757cb4b7a597a38b88b6545ab741f9a76cc67088ba962790fb0a1c",
  "src/c3/generation-contract-v5.ts": "b0811c0f3ec70b448ef41382051db61c5bde6396f82a8532993508da13103d64",
  "src/c3/generation-contract-v6.ts": "cf698e9240a0f4f9887a9a1be85008efaeeec84e2d3b8be92cfff6a7863194f1",
  "src/c3/generation-contract-v7.ts": "45ebe40a8f62848736abd1d22eb8d82fba847e74ea798495a23f4a27fbddc05e"
};
test('v7 source, full request/prompt and accepted/refused record hashes reconstruct unchanged', () => {
  for (const [path, expected] of Object.entries(frozenSourceHashes)) {
    assert.equal(v7Hash(readFileSync(new URL('../../' + path, import.meta.url), 'utf8')), expected, path);
  }
  const f = fixture(raw, oldRequest), accepted = record(f);
  f.result.findings[0].verdict = 'insufficient'; const refused = record(f);
  assert.equal(accepted.outcome, 'succeeded'); assert.equal(refused.outcome, 'refused');
  const revision = contract.createC3ModelRequest(context, syntheticMeetingRequest,
    contract.createC3RevisionContext(accepted, 'Shorten the opening.', 1), '7');
  const values = { request: oldRequest, prompt: oldRequest.prompt, check: f.check, checkPrompt: f.check.prompt,
    accepted, refused, revision, revisionPrompt: revision.prompt };
  for (const [key, value] of Object.entries(values)) assert.equal(v7Hash(typeof value === 'string' ? value : canonicalJson(value)),
    historicalHashes[key as keyof typeof historicalHashes], key);
  for (const old of [accepted, refused]) {
    assert.deepEqual(contract.reconstructC3ModelRequest(context, old), oldRequest);
    contract.assertReplayIdentity(JSON.parse(JSON.stringify(old)), context);
  }
  const revised = record(fixture(syntheticMeetingCandidate(context, true), revision));
  assert.deepEqual(contract.reconstructC3ModelRequest(context, revised), revision);
  assert.match(revision.prompt, /^GENERATION CONTRACT 7\./);
  assert.doesNotMatch(revision.prompt, /Each display field must cite its own/);
  contract.assertReplayIdentity(revised, context);
});

for (const version of ['7', '8'] as const) test(`recorded ${version} bundle keeps exact initial/revision requests and requires its own receipts`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-v8-pinned-public-'));
  try {
    const initialRequest = contract.createC3ModelRequest(context, syntheticMeetingRequest, null, version);
    const initial = record(fixture(raw, initialRequest));
    const revisionRequest = contract.createC3ModelRequest(context, syntheticMeetingRequest,
      contract.createC3RevisionContext(initial, 'Shorten the opening.', 1), version);
    const revised = record(fixture(syntheticMeetingCandidate(context, true), revisionRequest));
    const files = new Map<string, string>();
    for (const [name, req, retained] of [['prior', initialRequest, initial], ['revision', revisionRequest, revised]] as const) {
      await mkdir(join(root, name));
      for (const [file, bytes] of [['model-request.json', JSON.stringify(req)], ['raw-response.txt', retained.rawResponse],
        ['verification.json', JSON.stringify(retained.verification)]] as const) {
        const path = join(root, name, file); files.set(path, bytes); await writeFile(path, bytes);
      }
    }
    const replay = await loadC3RecordedReplay(context, root);
    assert.deepEqual(replay.priorRecord, initial); assert.deepEqual(replay.revisionRecord, revised);
    assert.equal(await replay.provider.generate(revisionRequest, new AbortController().signal), revised.rawResponse);
    for (const [path, bytes] of files) assert.equal(await readFile(path, 'utf8'), bytes);
    const path = join(root, 'revision', 'verification.json');
    await writeFile(path, JSON.stringify(initial.verification));
    await assert.rejects(loadC3RecordedReplay(context, root), /refused without repair/);
    await rm(path);
    await assert.rejects(loadC3RecordedReplay(context, root), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
