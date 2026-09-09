import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../src/c3/context.ts';
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, assertReplayIdentity, validateC3Candidate } from '../../src/c3/draft.ts';
import * as v5 from '../../src/c3/generation-contract-v5.ts';
import { createC3VerificationRequest, displayFields, retainC3Verification, validateV6Integrity, v6Hash, type C3VerificationRequest } from '../../src/c3/generation-contract-v6.ts';
import { CommandC3ModelProvider, generateVerifiedC3Record, type C3GenerationAudit } from '../../src/c3/provider.ts';
import { C3GenerationJournal } from '../../src/c3/generation-journal.ts';
import { runC3VerifierEvaluation } from '../../src/c3/generation-evaluation.ts';
import { LocalWorkStore, type WorkingBrief } from '../../src/c3/work-store.ts';
import { syntheticMeetingCandidate, syntheticMeetingRequest, syntheticWorkshopContext } from '../fixtures/c3-workshop.ts';

const context = syntheticWorkshopContext();
const request = createC3ModelRequest(context, syntheticMeetingRequest);
const raw = JSON.stringify({ ...JSON.parse(syntheticMeetingCandidate(context)), assertions: [] }) + '\n\n';
const verificationRequest = createC3VerificationRequest(request, raw, context);

import { scriptedFullCoverage } from './c3-generation-scripted.ts';

const verification = retainC3Verification(verificationRequest, scriptedFullCoverage(verificationRequest));
const makeRecord = () => createGenerationRecord(request, raw, context, verification);
const audit: C3GenerationAudit = { async retainCandidate() {}, async retainRecord() {}, async retainFailure() {} };

test('current v6 prompt has no finite emission grammar; complete check includes hidden assumptions and source boundaries', () => {
  assert.equal(request.generationContractVersion, '6');
  assert.equal(verificationRequest.schemaVersion, '2');
  assert.match(request.prompt, /GENERATION CONTRACT 6/);
  assert.doesNotMatch(request.prompt, /EMISSION FORMS|beginning exactly|Compact inquiry/);
  assert.match(verificationRequest.prompt, /EVERY DISPLAY FIELD/);
  assert.match(verificationRequest.prompt, /missing from the generator list/);
  assert.match(verificationRequest.prompt, /questions and intendedLearning/);
  assert.match(verificationRequest.prompt, /planned-versus-operational/);
  assert.match(verificationRequest.prompt, /Separate|separate/);
  assert.match(verificationRequest.prompt, /Do not return offsets/);
  assert.match(verificationRequest.prompt, /not proof of unchanged conditions through the meeting date/);
  assert.match(verificationRequest.prompt, /cannot excuse embedded factual premises/);
  for (const field of displayFields(validateV6Integrity(raw, context))) assert.ok(verificationRequest.prompt.includes(field.text));
  for (const source of context.context.admittedSources) for (const excerpt of source.excerpts) assert.ok(verificationRequest.prompt.includes(excerpt.exactExcerpt));
});

test('generator alone cannot create accepted v6 work; original bytes survive both acceptance and refusal', () => {
  const refused = createGenerationRecord(request, raw, context);
  assert.equal(refused.outcome, 'refused');
  assert.equal(refused.rawResponse, raw);
  assert.throws(() => validateC3Candidate(raw, context), /Independent evidence check/);
  assertReplayIdentity(refused, context);
  const accepted = makeRecord();
  assert.equal(accepted.outcome, 'succeeded', accepted.refusal?.message);
  assert.equal(accepted.rawResponse, raw);
  assert.equal(accepted.verification!.rawResponse, verification.rawResponse);
  assert.equal(accepted.rawResponseSha256, v6Hash(raw));
  assert.equal(accepted.draft!.status, 'proposed_unreviewed');
  assert.equal(accepted.draft!.durablySaved, false);
  assert.notEqual(accepted.recordId, refused.recordId);
  assertReplayIdentity(accepted, context);
});

for (const verdict of ['contradicted', 'insufficient']) test(`any ${verdict} span refuses the COMPLETE candidate even when omitted from generator assertions`, () => {
  const result = JSON.parse(scriptedFullCoverage(verificationRequest));
  result.findings.find((item: any) => item.path === 'questions[1].intendedLearning').verdict = verdict;
  const check = retainC3Verification(verificationRequest, JSON.stringify(result));
  const record = createGenerationRecord(request, raw, context, check);
  assert.equal(record.outcome, 'refused');
  assert.match(record.refusal!.message, /contradicted or insufficiently supported/);
  assert.equal(record.verification!.rawResponse, check.rawResponse);
  assertReplayIdentity(record, context);
});

for (const [name, mutate] of [
  ['missing field', (v: any) => v.findings.pop()],
  ['missing question purpose', (v: any) => { v.findings = v.findings.filter((f: any) => f.path !== 'questions[0].intendedLearning'); }],
  ['gap', (v: any) => { v.findings[0].text = v.findings[0].text.slice(1); }],
  ['duplicate span', (v: any) => v.findings.push(v.findings[0])],
  ['wrong text', (v: any) => { v.findings[0].text += ' altered'; }],
  ['wrong candidate', (v: any) => { v.rawResponseSha256 = '0'.repeat(64); }],
  ['wrong model request', (v: any) => { v.modelRequestSha256 = '0'.repeat(64); }],
  ['wrong account', (v: any) => { v.contextSha256 = '0'.repeat(64); }],
  ['wrong field', (v: any) => { v.findings[0].path = 'notDisplayed'; }],
  ['unrelated citation', (v: any) => { v.findings[1].evidenceRefs = ['not-eligible']; }],
  ['extra approval', (v: any) => { v.approved = true; }],
  ['unsupported verdict', (v: any) => { v.findings[0].verdict = 'probably'; }],
  ['missing scope', (v: any) => { delete v.findings[0].entityScope; }],
  ['uncited factual support', (v: any) => { v.findings[1].kind = 'sourced_statement'; v.findings[1].evidenceRefs = []; }],
] as const) test(`fail closed on verifier ${name}, retaining exact refusal evidence`, () => {
  const parsed = JSON.parse(scriptedFullCoverage(verificationRequest)); mutate(parsed);
  const verifierRaw = JSON.stringify(parsed) + '\n';
  const record = createGenerationRecord(request, raw, context, retainC3Verification(verificationRequest, verifierRaw));
  assert.equal(record.outcome, 'refused'); assert.equal(record.verification!.rawResponse, verifierRaw);
  assertReplayIdentity(record, context);
});

for (const verifierRaw of [null, '{malformed', '\ufeff' + scriptedFullCoverage(verificationRequest), 'I cannot verify this.']) {
  test(`missing/malformed/verbatim refusal check remains unaccepted (${verifierRaw?.slice(0, 12) ?? 'unavailable'})`, () => {
    const record = createGenerationRecord(request, raw, context, retainC3Verification(verificationRequest, verifierRaw));
    assert.equal(record.outcome, 'refused'); assert.equal(record.verification!.rawResponse, verifierRaw);
    assertReplayIdentity(record, context);
  });
}

test('legacy schema 1 mixed supported and unsupported spans are independently bound, including UTF-16 offsets', () => {
  const candidate = JSON.parse(raw);
  candidate.objective.text = 'Discuss priorities 🧭. The lunar platform is operational.';
  const bytes = JSON.stringify(candidate);
  const checkRequest = createC3VerificationRequest(request, bytes, context, '1');
  const output = JSON.parse(scriptedFullCoverage(checkRequest));
  const index = output.findings.findIndex((f: any) => f.path === 'objective.text');
  const field = output.findings[index]; const split = candidate.objective.text.indexOf('The lunar');
  output.findings.splice(index, 1, { ...field, end: split, text: field.text.slice(0, split), kind: 'proposed_action' },
    { ...field, start: split, text: field.text.slice(split), kind: 'sourced_statement', verdict: 'insufficient' });
  const record = createGenerationRecord(request, bytes, context, retainC3Verification(checkRequest, JSON.stringify(output)));
  assert.equal(record.outcome, 'refused'); assert.match(record.refusal!.message, /contradicted or insufficiently supported/);
});

test('deterministic integrity still rejects wrong citations, exact quotes, dates and generator assertion text', () => {
  for (const edit of [
    (c: any) => { c.opening.evidenceRefs = ['wrong-account']; },
    (c: any) => { c.opening.text = 'The report says "we deployed a lunar platform".'; },
    (c: any) => { c.audienceThesis.text += ' altered quote'; },
    (c: any) => { c.temporalOutcome = 'change_against_prior_revision'; },
    (c: any) => { c.assertions = [{path:'opening.text', start:0, end:4, text:'Fake', kind:'proposed_action', evidenceRefs:[],entityScope:'Not applicable', dateScope:'Not applicable', modality:'Proposed'}]; },
  ]) {
    const candidate = JSON.parse(raw); edit(candidate);
    assert.throws(() => createC3VerificationRequest(request, JSON.stringify(candidate), context));
  }
});

test('verification identity and bytes participate in record/revision identity and cannot be swapped', () => {
  const original = makeRecord();
  for (const changed of [
    { ...original, verification: { ...verification, rawResponse: verification.rawResponse + ' ' } },
    { ...original, verification: { ...verification, requestSha256: '0'.repeat(64) } },
    { ...original, verification: undefined },
  ]) assert.throws(() => assertReplayIdentity(changed, context));
  const revision = createC3RevisionContext(original, 'Explore the constraints before suggesting a next step.', 1);
  const revisedRequest = createC3ModelRequest(context, syntheticMeetingRequest, revision);
  const check = createC3VerificationRequest(revisedRequest, raw, context);
  const revised = createGenerationRecord(revisedRequest, raw, context, retainC3Verification(check, scriptedFullCoverage(check)));
  assert.equal(revised.outcome, 'succeeded'); assertReplayIdentity(revised, context);
  assert.equal(revised.revision!.priorRawResponse, raw);
  assert.equal(revised.revision!.priorRecordId, original.recordId);
  assert.equal(createGenerationRecord(revisedRequest, raw, context, verification).outcome, 'refused');
});

test('issued v5 module preserves exact original source and behavior through current replay boundary', () => {
  const source = readFileSync(new URL('../../src/c3/generation-contract-v5.ts', import.meta.url), 'utf8');
  assert.equal(v6Hash(source.replace('"./generation-claims-v5.ts"', '"./generation-claims.ts"')), '1669101e2eafd0d0cd1f6ea3fad47e004847237ce46f3c40cb0ad5e28e869afb');
  assert.equal(v6Hash(readFileSync(new URL('../../src/c3/generation-claims-v5.ts', import.meta.url), 'utf8')), 'f0f8792dd9a9e5ce18b2536656572c7d2cf7d24dceaca0682c06a1e9dc8f8518');
  const oldRequest = v5.createC3ModelRequest(context, syntheticMeetingRequest);
  const oldRaw = syntheticMeetingCandidate(context) + '\n\n';
  const oldRecord = v5.createGenerationRecord(oldRequest, oldRaw, context);
  assert.equal(oldRecord.outcome, 'succeeded');
  assert.deepEqual(createGenerationRecord(oldRequest, oldRaw, context), oldRecord);
  assertReplayIdentity(oldRecord, context);
  assert.equal(oldRecord.rawResponse, oldRaw);
});

for (const schemaVersion of ['1', '2'] as const) test(`save/restart/reopen retains v6 schema ${schemaVersion} verification, v5 ancestry, notes and existing title metadata shape without a model`, () => {
  const root = mkdtempSync('/tmp/c3-v6-store-');
  try {
    const prior = v5.createGenerationRecord(v5.createC3ModelRequest(context, syntheticMeetingRequest), syntheticMeetingCandidate(context), context);
    const revision = createC3RevisionContext(prior, 'Keep the original source scope.', 1);
    const req = createC3ModelRequest(context, syntheticMeetingRequest, revision);
    const check = createC3VerificationRequest(req, raw, context, schemaVersion);
    const record = createGenerationRecord(req, raw, context, retainC3Verification(check, scriptedFullCoverage(check)));
    const work: WorkingBrief = { record, records: [prior, record], correctionNote: 'Keep this note exactly.',
      sectionNotes: { Opening: 'Unchanged note.' }, instruction: '', pendingRevision: null, pendingRevisionToken: null,
      proposal: null, proposalStale: false, workVersion: 2 };
    const saved = new LocalWorkStore({root, principal: 'synthetic'}, context).save('doc_555555555555555555555555', 0, work, {title: 'A concise purpose'});
    const before = readdirSync(root).map(name => [name, readFileSync(join(root, name), 'utf8')]);
    const reopened = new LocalWorkStore({root, principal: 'synthetic'}, context).load(saved.documentId);
    assert.deepEqual(reopened, saved); assert.deepEqual(reopened.work, work);
    assert.equal(reopened.metadata!.title, 'A concise purpose'); assert.ok(reopened.metadata!.savedAt);
    for (const [name, bytes] of before) assert.equal(readFileSync(join(root, name!), 'utf8'), bytes);
  } finally { rmSync(root, {recursive: true}); }
});

test('both calls use one command adapter, original responses are durably journaled, with no repair/retry', async () => {
  const root = mkdtempSync('/tmp/c3-v6-command-');
  try {
    const script = join(root, 'wrapper.cjs'); const log = join(root, 'calls.txt'); const candidatePath = join(root, 'candidate.txt');
    writeFileSync(candidatePath, raw);
    writeFileSync(script, `const fs=require('node:fs'); const [candidatePath,log,requestPath]=process.argv.slice(2); const r=JSON.parse(fs.readFileSync(requestPath,'utf8')); fs.appendFileSync(log,r.kind+'\\n'); if(r.kind==='atliera.c3.meeting-draft-model-request') fs.writeSync(1,fs.readFileSync(candidatePath)); else { const f=${scriptedFullCoverage.toString()}; fs.writeSync(1,f(r)); }`);
    const provider = new CommandC3ModelProvider({command: process.execPath, args: [script, candidatePath, log]});
    const journal = new C3GenerationJournal(join(root, 'audit'));
    const record = await generateVerifiedC3Record(provider, request, context, new AbortController().signal, journal);
    assert.equal(record.outcome, 'succeeded', record.refusal?.message);
    assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['atliera.c3.meeting-draft-model-request', 'atliera.c3.evidence-verification-request']);
    const files = readdirSync(journal.root); assert.equal(files.length, 2);
    for (const file of files) assert.equal(statSync(join(journal.root, file)).mode & 0o077, 0);
    const candidate = JSON.parse(readFileSync(join(journal.root, files.find(f => f.startsWith('candidate-'))!), 'utf8'));
    const checked = JSON.parse(readFileSync(join(journal.root, files.find(f => f.startsWith('checked-'))!), 'utf8'));
    assert.equal(candidate.rawResponse, raw); assert.deepEqual(checked, record);
  } finally { rmSync(root, {recursive: true}); }
});

test('external route refuses before spending without verification/audit; retention failure prevents verification', async () => {
  let generated = 0, verified = 0;
  const provider = { name: 'scripted', executionMode: 'external' as const,
    async generate() { generated++; return raw; }, async verify(check: C3VerificationRequest) { verified++; return scriptedFullCoverage(check); } };
  await assert.rejects(generateVerifiedC3Record(provider, request, context, new AbortController().signal), /private attempt retention/);
  assert.equal(generated, 0);
  await assert.rejects(generateVerifiedC3Record(provider, request, context, new AbortController().signal,
    { ...audit, async retainCandidate() { throw Error('disk failed'); } }), /disk failed/);
  assert.equal(generated, 1); assert.equal(verified, 0);
});

test('unavailable verifier and cancellation retain original candidate with a refusal and no second call', async () => {
  for (const cancel of [false, true]) {
    const signal = new AbortController(); let checked = 0; const kept: any[] = [];
    const record = await generateVerifiedC3Record({name:'scripted', async generate() { if (cancel) signal.abort(); return raw; },
      async verify() { checked++; throw Error('transport unavailable'); } }, request, context, signal.signal,
      { ...audit, async retainCandidate(req, bytes) { kept.push(bytes); }, async retainRecord(value) { kept.push(value); } });
    assert.equal(record.outcome, 'refused'); assert.equal(record.verification!.failure, 'unavailable');
    assert.equal(checked, cancel ? 0 : 1); assert.equal(kept[0], raw); assert.deepEqual(kept[1], record);
  }
});

test('scripted evaluation reports false rejection and unsupported acceptance separately, without semantic-performance claims', async () => {
  let n = 0;
  const cases = [
    {id:'supported', category:'scripted', expected:'accept' as const, expectedReason:'Authored control', context, request, rawResponse:raw},
    {id:'unsupported', category:'scripted', expected:'reject' as const, expectedReason:'Authored control', context, request, rawResponse:raw},
  ];
  const report = await runC3VerifierEvaluation(cases, {name:'scripted-plumbing-only', executionMode:'local', async generate(){throw Error('must not generate');},
    async verify(check) { const value = JSON.parse(scriptedFullCoverage(check)); if (++n === 1) value.findings[0].verdict = 'insufficient'; return JSON.stringify(value); } },
    audit, {deadline:'2099-01-01T00:00:00Z',maxCalls:2,signal:new AbortController().signal});
  assert.equal(report.calls, 2); assert.equal(report.falseRejections.count, 1); assert.equal(report.unsupportedAcceptances.count, 1);
  assert.equal(report.falseRejections.denominator, 1); assert.equal(report.unsupportedAcceptances.denominator, 1);
  assert.match(report.evidenceMeaning, /Scripted responses test plumbing only/);
});

test('integrity-only refusals never dilute semantic verifier rates for either authored label', async () => {
  const base = { category:'scripted', expectedReason:'Authored metric control', context, request };
  const cases = [
    {...base, id:'unsupported-accepted', expected:'reject' as const, rawResponse:raw},
    {...base, id:'supported-rejected', expected:'accept' as const, rawResponse:raw},
    {...base, id:'integrity-reject', expected:'reject' as const, rawResponse:'{not json'},
    {...base, id:'integrity-accept', expected:'accept' as const, rawResponse:'{not json'},
  ];
  let calls = 0;
  const report = await runC3VerifierEvaluation(cases, {name:'scripted-plumbing-only', async generate(){throw Error('must not generate');},
    async verify(check) { const value = JSON.parse(scriptedFullCoverage(check)); if (++calls === 2) value.findings[0].verdict = 'insufficient'; return JSON.stringify(value); }},
    audit, {deadline:'2099-01-01T00:00:00Z', maxCalls:2, signal:new AbortController().signal});
  assert.equal(calls, 2); assert.equal(report.calls, 2); assert.equal(report.completedCases, 4);
  assert.equal(report.integrityRefusals, 2);
  assert.deepEqual(report.falseRejections, {count:1, denominator:1, rate:1});
  assert.deepEqual(report.unsupportedAcceptances, {count:1, denominator:1, rate:1});
  assert.ok(report.rows.slice(2).every(row => row.checkStatus === 'integrity_refusal' && !row.verifierCalled));
});

test('malformed verifier stops evaluation as inconclusive, never as a resolved unsupported case', async () => {
  const item = {id:'unsupported', category:'scripted', expected:'reject' as const, expectedReason:'Authored control', context, request, rawResponse:raw};
  const report = await runC3VerifierEvaluation([item, {...item,id:'next'}], {name:'scripted', async generate(){throw Error('must not generate');}, async verify(){return '{}';}},
    audit, {deadline:'2099-01-01T00:00:00Z', maxCalls:2, signal:new AbortController().signal});
  assert.equal(report.calls, 1); assert.equal(report.stopped, 'verifier_failure'); assert.equal(report.rows[0]!.direction, 'inconclusive');
  assert.equal(report.unsupportedAcceptances.denominator, 0); assert.equal(report.invalidChecks, 1);
});

test('multiline exact quotations are checked deterministically', () => {
  const source = context.context.admittedSources[0]!;
  const exactExcerpt = 'Planning continues.\nTiming remains uncertain.';
  const excerpt = { ...source.excerpts[0]!, exactExcerpt, exactExcerptSha256: v6Hash(exactExcerpt), sourceCharStart: 0, sourceCharEnd: exactExcerpt.length };
  const changed = { ...context.context, admittedSources: [{ ...source, fullBoundedCleanText: exactExcerpt,
    retrievedContentSha256: v6Hash(exactExcerpt), retrievedByteSize: Buffer.byteLength(exactExcerpt), excerpts: [excerpt] }] };
  const serialized = canonicalJson(changed);
  const ctx = {context: changed, canonicalJson: serialized, sha256: v6Hash(serialized)};
  const req = createC3ModelRequest(ctx, syntheticMeetingRequest);
  const candidate = {...JSON.parse(syntheticMeetingCandidate(ctx)), assertions: []};
  candidate.opening = {text:`The source says "${exactExcerpt}".`,evidenceRefs:[excerpt.evidenceId],supportCategory:'cautious_inference'};
  assert.doesNotThrow(() => createC3VerificationRequest(req, JSON.stringify(candidate), ctx));
  candidate.opening.text = 'The source says "A fabricated platform\nis already operational".';
  assert.throws(() => createC3VerificationRequest(req, JSON.stringify(candidate), ctx), /quotation must match/);
});

for (const stage of ['generator', 'verifier'] as const) test(`failed ${stage} command retains exact stdout bytes including invalid UTF-8 without acceptance`, async () => {
  const root = mkdtempSync('/tmp/c3-v6-failure-');
  try {
    const script = join(root, 'fail.cjs'), rawPath = join(root, 'candidate.txt');
    writeFileSync(rawPath, raw);
    writeFileSync(script, `const fs=require('node:fs');const r=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));if(${JSON.stringify(stage)}==='verifier'&&r.kind==='atliera.c3.meeting-draft-model-request'){fs.writeSync(1,fs.readFileSync(process.argv[2]));}else{fs.writeSync(1,Buffer.from([82,69,70,85,83,65,76,255,10]));process.exitCode=2;}`);
    const journal = new C3GenerationJournal(join(root, 'audit'));
    const provider = new CommandC3ModelProvider({command:process.execPath,args:[script,rawPath]});
    if (stage === 'generator') await assert.rejects(generateVerifiedC3Record(provider,request,context,new AbortController().signal,journal), /operator model command failed/);
    else assert.equal((await generateVerifiedC3Record(provider,request,context,new AbortController().signal,journal)).outcome,'refused');
    const files = readdirSync(journal.root);
    const failed = JSON.parse(readFileSync(join(journal.root,files.find(name=>name.startsWith('failed-transport-'))!),'utf8'));
    assert.deepEqual(Buffer.from(failed.failure.rawResponseBase64,'base64'),Buffer.from([82,69,70,85,83,65,76,255,10]));
    assert.equal(failed.failure.retainedBytes,9); assert.equal(failed.failure.receivedBytes,9); assert.equal(failed.failure.truncated,false);
    assert.equal(files.some(name=>name.startsWith('checked-')),stage==='verifier');
  } finally {rmSync(root,{recursive:true});}
});

test('no verifier dispatch after audit crosses evaluation deadline', async () => {
  let called = false;
  const item = {id:'deadline',category:'scripted',expected:'accept' as const,expectedReason:'Authored control',context,request,rawResponse:raw};
  const report = await runC3VerifierEvaluation([item],{name:'scripted',async generate(){throw Error('unused');},async verify(){called=true;return '{}';}},
    {...audit,async retainCandidate(){await new Promise(resolve=>setTimeout(resolve,60));}},
    {deadline:new Date(Date.now()+30).toISOString(),maxCalls:1,signal:new AbortController().signal});
  assert.equal(called,false);assert.equal(report.calls,0);assert.equal(report.stopped,'deadline');
});

test('duplicate candidate/verifier object members are malformed, never silently overridden', () => {
  const duplicateCandidate = raw.replace('"assertions":[]','"assertions":[],"assertions":[]');
  assert.throws(()=>validateV6Integrity(duplicateCandidate,context),/strict JSON/);
  const duplicateCheck = verification.rawResponse!.replace('"schemaVersion":"2"','"schemaVersion":"1","schemaVersion":"2"');
  const record = createGenerationRecord(request,raw,context,retainC3Verification(verificationRequest,duplicateCheck));
  assert.equal(record.outcome,'refused');assert.equal(record.verification!.rawResponse,duplicateCheck);
  assert.match(record.refusal!.message,/strict JSON/);
});

// Pre-edit schema 1 identities from authored synthetic fixtures only; no retained private response is copied here.
test('schema 1 exact request, success and offset-refusal identities replay unchanged while fresh checks default to 2', () => {
  const legacy = createC3VerificationRequest(request, raw, context, '1');
  assert.equal(v6Hash(canonicalJson(request)), '4590654f474cc7f50b22b1c7f8422af0ad3ea7c51f8a3b52f944826c6289433f');
  assert.equal(v6Hash(canonicalJson(legacy)), '224051fb09db3a67df689bee1b16aae92bd4bfda63e7df3df0bfe4ce1d416c47');
  assert.equal(legacy.schemaVersion, '1');
  assert.match(legacy.prompt, /Offsets are JavaScript UTF-16 code units/);
  assert.doesNotMatch(legacy.prompt, /not proof of unchanged conditions through the meeting date/);
  assert.equal(createC3VerificationRequest(request, raw, context).schemaVersion, '2');
  assert.deepEqual(createC3VerificationRequest(request, raw, context, '2'), verificationRequest);
  const successRaw = scriptedFullCoverage(legacy);
  const output = JSON.parse(successRaw); output.findings[0].end -= 1;
  const refusalRaw = JSON.stringify(output) + '\n';
  const expected = [
    { bytes: successRaw, outcome: 'succeeded', id: 'c3_79b7b69c31c4c42e99fade78', hash: '3d47d13b0bce6631d0e32dc18df6eba7cd63f016bb20c3097a13947b759092b8' },
    { bytes: refusalRaw, outcome: 'refused', id: 'c3_75e409dbd30ce6247d0775e5', hash: '8e2b236ad3dfad5033828773d306b472343fe37fc175375ca53a2d06dec24b45' },
  ];
  for (const fixture of expected) {
    const record = createGenerationRecord(request, raw, context, retainC3Verification(legacy, fixture.bytes));
    assert.equal(record.outcome, fixture.outcome);
    assert.equal(record.recordId, fixture.id);
    assert.equal(v6Hash(canonicalJson(record)), fixture.hash);
    assert.equal(record.rawResponse, raw);
    assert.equal(record.verification!.rawResponse, fixture.bytes);
    const stored = JSON.parse(JSON.stringify(record));
    assertReplayIdentity(stored, context);
    assert.deepEqual(createGenerationRecord(request, raw, context, stored.verification), record);
  }
});

// These fixtures prescribe verdicts to exercise structural and refusal plumbing, not model semantic quality.
function scriptedPartitions(fieldText: string, segments: readonly string[], path = 'objective.text') {
  const candidate = JSON.parse(raw);
  if (path === 'questions[0].question') candidate.questions[0].question = fieldText;
  else candidate.objective.text = fieldText;
  const bytes = JSON.stringify(candidate) + '\n';
  const check = createC3VerificationRequest(request, bytes, context, '2');
  const output = JSON.parse(scriptedFullCoverage(check));
  const index = output.findings.findIndex((f: any) => f.path === path);
  const field = output.findings[index];
  output.findings.splice(index, 1, ...segments.map(text => ({ ...field, text })));
  return { bytes, check, output };
}

function partitionRecord(fixture: ReturnType<typeof scriptedPartitions>) {
  return createGenerationRecord(request, fixture.bytes, context,
    retainC3Verification(fixture.check, JSON.stringify(fixture.output) + '\n\n'));
}

const unicodeSegments = ['Discuss ', '🧭', ' ', 'cafe\u0301.', '\t ', 'Confirm\u00a0next.', '\n', 'Proceed.'];
const unicodeField = unicodeSegments.join('');

test('schema 2 exact partitions advance UTF-16 cursors and retain astral, combining, punctuation and whitespace-only segments', () => {
  const fixture = scriptedPartitions(unicodeField, unicodeSegments);
  const record = partitionRecord(fixture);
  assert.equal('🧭'.length, 2);
  assert.equal(record.outcome, 'succeeded', record.refusal?.message);
  assert.equal(record.draft!.objective.text, unicodeField);
  assert.equal(record.draft!.status, 'proposed_unreviewed');
  assert.equal(record.draft!.durablySaved, false);
  assert.equal(record.verification!.rawResponse, JSON.stringify(fixture.output) + '\n\n');
  assert.ok(fixture.output.findings.every((f: any) => !Object.hasOwn(f, 'start') && !Object.hasOwn(f, 'end')));
  assertReplayIdentity(record, context);
});

for (const [name, mutate] of [
  ['empty segment', (f: any[]) => { f[0].text = ''; }],
  ['nonstring segment', (f: any[]) => { f[0].text = 42; }],
  ['trimmed whitespace', (f: any[]) => { f[0].text = f[0].text.trim(); }],
  ['unicode normalization', (f: any[]) => { f[3].text = f[3].text.normalize('NFC'); }],
  ['nonbreaking space replacement', (f: any[]) => { f[5].text = f[5].text.replace('\u00a0', ' '); }],
  ['newline replacement', (f: any[]) => { f[6].text = '\r\n'; }],
  ['astral replacement', (f: any[]) => { f[1].text = '🛰'; }],
  ['wrong segment ordering', (f: any[]) => { [f[0].text, f[1].text] = [f[1].text, f[0].text]; }],
  ['gap', (f: any[]) => { f[3].text = f[3].text.slice(1); }],
  ['overlap', (f: any[]) => { f[3].text = ' ' + f[3].text; }],
  ['partial coverage', (f: any[]) => { f[7].text = 'Proceed'; }],
  ['unknown path', (f: any[]) => { f[0].path = 'objective'; }],
  ['missing path', (f: any[]) => { delete f[0].path; }],
  ['model start offset', (f: any[]) => { f[0].start = 0; }],
  ['model end offset', (f: any[]) => { f[0].end = f[0].text.length; }],
  ['extra finding key', (f: any[]) => { f[0].accepted = true; }],
] as const) test(`schema 2 rejects ${name} without repairing original bytes`, () => {
  const fixture = scriptedPartitions(unicodeField, unicodeSegments);
  mutate(fixture.output.findings.filter((f: any) => f.path === 'objective.text'));
  const record = partitionRecord(fixture);
  assert.equal(record.outcome, 'refused');
  assert.equal(record.rawResponse, fixture.bytes);
  assert.equal(record.verification!.rawResponse, JSON.stringify(fixture.output) + '\n\n');
  assertReplayIdentity(record, context);
});

for (const example of [
  { path: 'objective.text', segments: ['Discuss priorities 🧭. ', 'The lunar platform is operational.'], kind: 'proposed_action' },
  { path: 'questions[0].question', segments: ['Which owner will expand ', 'the operational lunar platform?'], kind: 'question' },
]) for (const verdict of ['insufficient', 'contradicted']) test(`schema 2 ${example.kind} embedded premise ${verdict} refuses despite exact complete partitions`, () => {
  const fixture = scriptedPartitions(example.segments.join(''), example.segments, example.path);
  const findings = fixture.output.findings.filter((f: any) => f.path === example.path);
  findings[0].kind = example.kind;
  findings[1].kind = 'sourced_statement'; findings[1].verdict = verdict;
  findings[1].reason = 'Authored negative control: operational status is unestablished.';
  const record = partitionRecord(fixture);
  assert.equal(record.outcome, 'refused');
  assert.match(record.refusal!.message, /contradicted or insufficiently supported/);
  assertReplayIdentity(record, context);
});

test('schema 2 coverage cursors are independent per supplied field path', () => {
  const fixture = scriptedPartitions(unicodeField, unicodeSegments);
  const first = fixture.output.findings.findIndex((f: any) => f.path === 'objective.text');
  const [segment] = fixture.output.findings.splice(first, 1);
  fixture.output.findings.unshift(segment); // Other paths may interleave; order within each path is binding.
  assert.equal(partitionRecord(fixture).outcome, 'succeeded');
});

test('schema 2 a cited supported clause cannot lend support to the next unsupported clause', () => {
  const candidate = JSON.parse(raw);
  const excerpt = context.context.admittedSources[0]!.excerpts[0]!;
  const supported = excerpt.exactExcerpt + ' ';
  const unsupported = 'The lunar platform is operational.';
  candidate.opening = { text: supported + unsupported, evidenceRefs: [excerpt.evidenceId], supportCategory: 'cautious_inference' };
  const bytes = JSON.stringify(candidate);
  const check = createC3VerificationRequest(request, bytes, context, '2');
  const output = JSON.parse(scriptedFullCoverage(check));
  const index = output.findings.findIndex((f: any) => f.path === 'opening.text');
  const field = output.findings[index];
  output.findings.splice(index, 1,
    { ...field, text: supported, kind: 'sourced_statement', reason: 'Authored control: copies the cited synthetic source.' },
    { ...field, text: unsupported, kind: 'sourced_statement', verdict: 'insufficient', reason: 'Authored control: operational status is absent.' });
  const record = createGenerationRecord(request, bytes, context, retainC3Verification(check, JSON.stringify(output)));
  assert.equal(record.outcome, 'refused');
  assert.match(record.refusal!.message, /contradicted or insufficiently supported/);
  assertReplayIdentity(record, context);
});

test('schema 2 full coverage is required for every path even when other fields have many segments', () => {
  const fixture = scriptedPartitions(unicodeField, unicodeSegments);
  fixture.output.findings = fixture.output.findings.filter((f: any) => f.path !== 'closeCriterion.text');
  const record = partitionRecord(fixture);
  assert.equal(record.outcome, 'refused');
  assert.match(record.refusal!.message, /coverage is incomplete/);
  assertReplayIdentity(record, context);
});

for (const schemaVersion of ['3', '', 1, null, undefined]) test(`missing/unknown retained verifier schema ${String(schemaVersion)} fails closed`, () => {
  const changed = JSON.parse(JSON.stringify({ ...verificationRequest, schemaVersion })) as C3VerificationRequest;
  const record = createGenerationRecord(request, raw, context, retainC3Verification(changed, verification.rawResponse));
  assert.equal(record.outcome, 'refused');
  assert.match(record.refusal!.message, /Unknown evidence verification schema/);
  if (schemaVersion !== undefined) {
    assert.throws(() => createC3VerificationRequest(request, raw, context, schemaVersion as any), /Unknown evidence verification schema/);
  }
});

for (const schemaVersion of ['1', '2'] as const) test(`schema ${schemaVersion} response cannot select another validator or omit its version`, () => {
  const check = createC3VerificationRequest(request, raw, context, schemaVersion);
  for (const wrongVersion of [schemaVersion === '1' ? '2' : '1', '3', undefined]) {
    const output = JSON.parse(scriptedFullCoverage(check)); output.schemaVersion = wrongVersion;
    const record = createGenerationRecord(request, raw, context, retainC3Verification(check, JSON.stringify(output)));
    assert.equal(record.outcome, 'refused');
    assert.match(record.refusal!.message, /identity mismatch|unexpected or missing fields/);
    assertReplayIdentity(record, context);
  }
  if (schemaVersion === '1') {
    const output = JSON.parse(scriptedFullCoverage(check));
    for (const finding of output.findings) { delete finding.start; delete finding.end; }
    const record = createGenerationRecord(request, raw, context, retainC3Verification(check, JSON.stringify(output)));
    assert.equal(record.outcome, 'refused');
    assert.match(record.refusal!.message, /unexpected or missing fields/);
    assertReplayIdentity(record, context);
  }
});
