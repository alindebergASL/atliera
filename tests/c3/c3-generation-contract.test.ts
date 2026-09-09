import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import test from 'node:test';
import { canonicalJson, type FrozenC3AccountContext } from '../../src/c3/context.ts';
import { assertReplayIdentity, c3GenerationContractVersion, createC3ModelRequest, createC3RevisionContext,
  createGenerationRecord, reconstructC3ModelRequest, type C3GenerationRecord, type C3ModelRequest } from '../../src/c3/draft.ts';
import { LocalWorkStore, type WorkingBrief } from '../../src/c3/work-store.ts';
import { syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/c3-old-contract.json', import.meta.url), 'utf8')) as {
  provenance: {serializedByRevision: string; draftSourceSha256: string}; context: FrozenC3AccountContext;
  initialRequest: C3ModelRequest; revisedRequest: C3ModelRequest;
  initial: C3GenerationRecord; revised: C3GenerationRecord; refusal: C3GenerationRecord;
  files: {name: string; bytes: string}[];
};
const context = fixture.context;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const v3 = JSON.parse(readFileSync(new URL('../fixtures/c3-v3-contract.json', import.meta.url), 'utf8')) as typeof fixture & {
  provenance: {claimsSourceSha256: string; synthetic: boolean};
};

const v4 = JSON.parse(readFileSync(new URL('../fixtures/c3-v4-contract.json', import.meta.url), 'utf8')) as typeof v3;

test('issued v4 prompt, validator, requests, outcomes and refusal remain frozen at initial HEAD', () => {
  assert.equal(v4.provenance.serializedByRevision, '094b0ea1340b1fdf1fea57b92fdbff89708c6050');
  assert.equal(v4.provenance.synthetic, true);
  const source = readFileSync(new URL('../../src/c3/generation-contract-v4.ts', import.meta.url), 'utf8');
  assert.equal(hash(source.replace('"./generation-claims-v4.ts"', '"./generation-claims.ts"')), v4.provenance.draftSourceSha256);
  assert.equal(hash(readFileSync(new URL('../../src/c3/generation-claims-v4.ts', import.meta.url), 'utf8')), v4.provenance.claimsSourceSha256);
  assert.equal(hash(readFileSync(new URL('../../src/c3/generation-claims.ts', import.meta.url), 'utf8')), v4.provenance.claimsSourceSha256);
  for (const [record, request] of [[v4.initial, v4.initialRequest], [v4.revised, v4.revisedRequest]] as const) {
    assert.equal(c3GenerationContractVersion(record), '4');
    assert.deepEqual(reconstructC3ModelRequest(v4.context, record), request);
    assert.equal(hash(canonicalJson(request)), record.modelRequestSha256);
    assert.deepEqual(createGenerationRecord(request, record.rawResponse, v4.context), record);
    assertReplayIdentity(record, v4.context);
    assert.doesNotMatch(request.prompt, /EMISSION FORMS|GENERATION CONTRACT 5/);
  }
  assert.equal(v4.refusal.outcome, 'refused');
  assertReplayIdentity(v4.refusal, v4.context);
  assert.deepEqual(createGenerationRecord(v4.initialRequest, v4.refusal.rawResponse, v4.context), v4.refusal);
  const hypothetical = createGenerationRecord(createC3ModelRequest(v4.context, v4.initial.meetingRequest), v4.refusal.rawResponse, v4.context);
  assert.equal(hypothetical.outcome, 'refused');
  assert.equal(hypothetical.rawResponseSha256, v4.refusal.rawResponseSha256);
  assert.notEqual(hypothetical.recordId, v4.refusal.recordId);
  for (const generationContractVersion of ['2', '3', '5', undefined]) {
    const changed = {...v4.initial, generationContractVersion} as C3GenerationRecord;
    if (generationContractVersion === undefined) delete (changed as {generationContractVersion?: string}).generationContractVersion;
    assert.throws(() => assertReplayIdentity(changed, v4.context));
  }
});

test('issued v3 prompt, validator, request hashes and synthetic outcomes are frozen', () => {
  assert.equal(v3.provenance.serializedByRevision, '9d986cd2548d6c6c562116fa3937413ee0672653');
  assert.equal(v3.provenance.synthetic, true);
  // The only relocation in the frozen draft is its import of the frozen claims module.
  const source = readFileSync(new URL('../../src/c3/generation-contract-v3.ts', import.meta.url), 'utf8');
  assert.equal(hash(source.replace('"./generation-claims-v3.ts"', '"./generation-claims.ts"')), v3.provenance.draftSourceSha256);
  assert.equal(hash(readFileSync(new URL('../../src/c3/generation-claims-v3.ts', import.meta.url), 'utf8')), v3.provenance.claimsSourceSha256);
  for (const [record, request] of [[v3.initial, v3.initialRequest], [v3.revised, v3.revisedRequest]] as const) {
    assert.equal(c3GenerationContractVersion(record), '3');
    assert.deepEqual(reconstructC3ModelRequest(v3.context, record), request);
    assert.equal(hash(canonicalJson(request)), record.modelRequestSha256);
    assertReplayIdentity(record, v3.context);
  }
  assert.equal(v3.refusal.outcome, 'refused');
  assertReplayIdentity(v3.refusal, v3.context);
  assert.equal(v3.refusal.refusal!.message, 'candidate.opening cautious_inference requires scoped caution, source attribution, or an invitation in each claim');
  assert.deepEqual(createGenerationRecord(v3.initialRequest, v3.refusal.rawResponse, v3.context), v3.refusal);
  const hypothetical = createGenerationRecord(createC3ModelRequest(v3.context, v3.initial.meetingRequest), v3.refusal.rawResponse, v3.context);
  assert.equal(hypothetical.outcome, 'succeeded');
  assert.notEqual(hypothetical.recordId, v3.refusal.recordId);
  assert.equal(hypothetical.rawResponseSha256, v3.refusal.rawResponseSha256);
  assertReplayIdentity(v3.refusal, v3.context);
  for (const generationContractVersion of ['2', '4', '5', undefined]) {
    const changed = {...v3.initial, generationContractVersion} as C3GenerationRecord;
    if (generationContractVersion === undefined) delete (changed as {generationContractVersion?: string}).generationContractVersion;
    assert.throws(() => assertReplayIdentity(changed, v3.context));
  }
});

test('fixture was serialized by exact OLD main; frozen implementation and old request bytes remain exact', () => {
  assert.equal(fixture.provenance.serializedByRevision, '041ec13be1bb5cf8e0e1219a1ec997cf5a58aaf8');
  assert.equal(hash(readFileSync(new URL('../../src/c3/generation-contract-v2.ts', import.meta.url), 'utf8')), fixture.provenance.draftSourceSha256);
  for (const [record, request] of [[fixture.initial, fixture.initialRequest], [fixture.revised, fixture.revisedRequest]] as const) {
    assert.equal(c3GenerationContractVersion(record), '2');
    assert.deepEqual(reconstructC3ModelRequest(context, record), request);
    assert.equal(hash(canonicalJson(request)), record.modelRequestSha256);
    assertReplayIdentity(record, context);
  }
  assert.equal(fixture.refusal.outcome, 'refused');
  assertReplayIdentity(fixture.refusal, context);
  assert.equal(fixture.refusal.refusal!.message, 'candidate.opening cautious_inference must be explicitly tentative');
});

for (const savedFixture of [fixture, v3, v4]) test(`v${c3GenerationContractVersion(savedFixture.initial)} oldsave → newloader preserves exact files, sources, notes, applied history and pending recovery`, () => {
  const fixture = savedFixture;
  const root = mkdtempSync('/tmp/c3-old-new-proof-');
  try {
    for (const file of fixture.files) writeFileSync(`${root}/${file.name}`, file.bytes, {mode: 0o600});
    const store = new LocalWorkStore({root, principal: 'synthetic-operator'}, context);
    const all = store.list(); assert.equal(all.length, 3);
    for (const file of fixture.files) {
      const old = JSON.parse(file.bytes);
      const saved = new LocalWorkStore({root, principal: 'synthetic-operator'}, context).load(old.documentId);
      assert.deepEqual(saved, old);
      assert.equal(readFileSync(`${root}/${file.name}`, 'utf8'), file.bytes);
      assert.equal(saved.work.correctionNote, 'Retained general note');
      assert.equal(saved.work.sectionNotes.Opening, 'Retained opening note');
      assert.ok(saved.work.record.draft!.selectedEvidenceRefs.every(id => context.context.admittedSources.some(s => s.excerpts.some(e => e.evidenceId === id))));
    }
    const pending = all.find(s => s.work.proposal !== null)!;
    assert.deepEqual(pending.work.proposal, fixture.revised);
    assert.deepEqual(pending.work.pendingRevision, fixture.revised.revision);
    assert.equal(all.find(s => s.work.pendingRevision !== null && s.work.proposal === null)!.work.pendingRevisionToken, 'p'.repeat(32));
    assert.deepEqual(all.find(s => s.work.records.length === 2)!.work.records, [fixture.initial, fixture.revised]);
  } finally { rmSync(root, {recursive: true}); }
});

for (const savedFixture of [fixture, v3, v4]) test(`fresh requests use explicit contract; mixed v${c3GenerationContractVersion(savedFixture.initial)}→new history preserves original ancestor and saves`, () => {
  const fixture = savedFixture;
  const revision = createC3RevisionContext(fixture.revised, 'Clarify the close.', 2);
  const request = createC3ModelRequest(context, fixture.initial.meetingRequest, revision);
  assert.equal(request.generationContractVersion, '5');
  const record = createGenerationRecord(request, syntheticMeetingCandidate(context, true), context);
  assert.equal(record.outcome, 'succeeded'); assertReplayIdentity(record, context);
  assert.equal(record.revision!.priorRawResponse, fixture.revised.rawResponse);
  const root = mkdtempSync('/tmp/c3-mixed-proof-');
  try {
    const store = new LocalWorkStore({root, principal: 'synthetic-operator'}, context);
    const work: WorkingBrief = {...JSON.parse(fixture.files[2]!.bytes).work, record, records: [fixture.initial, fixture.revised, record], pendingRevision: null, pendingRevisionToken: null, proposal: null};
    const saved = store.save('doc_444444444444444444444444', 0, work);
    assert.deepEqual(store.load(saved.documentId).work.records, work.records);
  } finally { rmSync(root, {recursive: true}); }
});

test('unknown, removed, injected and downgraded versions never receive hash forgiveness', () => {
  const request = createC3ModelRequest(context, fixture.initial.meetingRequest);
  const fresh = createGenerationRecord(request, fixture.initial.rawResponse, context);
  for (const version of ['1', '6', '', null, 3, undefined]) {
    assert.throws(() => assertReplayIdentity({...fresh, generationContractVersion: version} as C3GenerationRecord, context), /contract version/);
    assert.throws(() => createGenerationRecord({...request, generationContractVersion: version} as C3ModelRequest, fresh.rawResponse, context), /contract version/);
  }
  const removed = structuredClone(fresh); delete (removed as {generationContractVersion?: string}).generationContractVersion;
  assert.throws(() => assertReplayIdentity(removed, context));
  assert.throws(() => assertReplayIdentity({...fresh, generationContractVersion: '2'}, context));
  assert.throws(() => assertReplayIdentity({...fresh, generationContractVersion: '3'}, context));
  assert.throws(() => assertReplayIdentity({...fresh, generationContractVersion: '4'}, context));
  assert.throws(() => assertReplayIdentity({...fixture.initial, generationContractVersion: '2'}, context));
  assert.throws(() => assertReplayIdentity({...fixture.initial, generationContractVersion: '3'}, context));
  assert.throws(() => assertReplayIdentity({...fresh, schemaVersion: '999'} as unknown as C3GenerationRecord, context));
  assert.throws(() => assertReplayIdentity({...fresh, surprise: true} as C3GenerationRecord, context));
  assert.throws(() => createGenerationRecord({...request, prompt: request.prompt + 'tamper'}, fresh.rawResponse, context));
});

test('explicit original contract version is bound in request identity and is not an unversioned old record', () => {
  const request = createC3ModelRequest(context, fixture.initial.meetingRequest, null, '2');
  const record = createGenerationRecord(request, fixture.initial.rawResponse, context);
  assert.equal(request.prompt, fixture.initialRequest.prompt);
  assert.equal(record.generationContractVersion, '2');
  assert.notEqual(record.modelRequestSha256, fixture.initial.modelRequestSha256);
  assertReplayIdentity(record, context);
});

test('new contract evaluates each claim, not a hedge or unknown elsewhere in a field', () => {
  const request = createC3ModelRequest(context, fixture.initial.meetingRequest);
  const refs = fixture.initial.draft!.selectedEvidenceRefs;
  for (const [text, category] of [
    ['The sources may be relevant. The account deployed a new pilot.', 'cautious_inference'],
    ['This could help, but the account has launched a new program.', 'cautious_inference'],
    ['The account deployed a pilot and this may be relevant.', 'cautious_inference'],
    ['Current priorities are unknown. The account deployed a new pilot.', 'unknown'],
    ['Ask about priorities because the account has launched a pilot.', 'recommendation'],
    ['The account is replacing its vendor. This may matter.', 'cautious_inference'],
    ['Confirm current priorities; the account urgently needs a replacement.', 'recommendation'],
  ] as const) {
    const candidate = JSON.parse(fixture.initial.rawResponse);
    const field = category === 'unknown' ? 'audienceThesis' : 'opening';
    candidate[field] = {text, supportCategory: category, evidenceRefs: refs};
    const raw = JSON.stringify(candidate);
    const record = createGenerationRecord(request, raw, context);
    assert.equal(record.outcome, 'refused', text);
    assert.equal(record.rawResponse, raw);
  }
});

test('independent clauses cannot borrow caution through punctuation, conjunctions or inquiry prefixes', () => {
  for (const [text, category] of [
    ['This may help: Harbor owns the platform.', 'cautious_inference'],
    ['This may help. the account owns the platform.', 'cautious_inference'],
    ['Ask if discussion would help, the rollout is complete.', 'recommendation'],
    ['Ask whether priorities changed, the rollout is complete.', 'recommendation'],
    ['Ask which priority matters, the account owns the platform.', 'recommendation'],
    ['The planned work may matter while Harbor owns the platform.', 'cautious_inference'],
    ['Current priorities are unknown, Harbor owns the platform.', 'unknown'],
    ['The account owns the platform, which may be relevant.', 'cautious_inference'],
    ['Harbor owns the platform with possible scope for improvement.', 'cautious_inference'],
    ['Harbor owns the platform with unknown current priorities.', 'unknown'],
    ['Harbor owns the platform and could clarify the boundary.', 'cautious_inference'],
    ['The source describes planned work, which Harbor now manages.', 'cautious_inference'],
    ['The source describes planned work that Harbor now manages.', 'cautious_inference'],
  ] as const) {
    const candidate = JSON.parse(fixture.initial.rawResponse);
    const field = category === 'unknown' ? 'audienceThesis' : 'opening';
    candidate[field] = {text, supportCategory: category, evidenceRefs: fixture.initial.draft!.selectedEvidenceRefs};
    const raw = JSON.stringify(candidate);
    const record = createGenerationRecord(createC3ModelRequest(context, fixture.initial.meetingRequest), raw, context);
    assert.equal(record.outcome, 'refused', text); assert.equal(record.rawResponse, raw);
  }
});

test('initial and revision contracts share positive framing, exact quotes and adversarial support examples', () => {
  const requests = [createC3ModelRequest(context, fixture.initial.meetingRequest),
    createC3ModelRequest(context, fixture.initial.meetingRequest, createC3RevisionContext(fixture.initial, 'Use a natural opening.', 1))];
  const refs = fixture.initial.draft!.selectedEvidenceRefs;
  const excerpt = context.context.admittedSources.flatMap(s => s.excerpts).find(e => e.evidenceId === refs[0])!.exactExcerpt;
  const alternate = context.context.admittedSources.flatMap(s => s.excerpts).find(e => e.evidenceId !== refs[0])!.evidenceId;
  for (const request of requests) {
    assert.match(request.prompt, /GENERATION CONTRACT 5/);
    assert.match(request.prompt, /applies identically to initial and revised output/);
    assert.match(request.prompt, /Each independent assertion needs its own support or uncertainty/);
    assert.notEqual(request.prompt, fixture.initialRequest.prompt);
    for (const [text, supportCategory] of [
      ['The source describes the published mission and operating structure; could we explore whether that matters to your chosen outcome?', 'cautious_inference'],
      ['My aim is to learn which outcome matters now. I would like to confirm whether the reported structure still applies.', 'cautious_inference'],
      ['The reported structure may be a useful topic to confirm. Ask which boundary matters now.', 'cautious_inference'],
      ['It is possible that the reported structure matters to this discussion.', 'cautious_inference'],
      ['It is possible that Harbor owns the platform.', 'cautious_inference'],
      ['The source reports that Harbor publishes its mission and operating structure.', 'cautious_inference'],
      ['Two possible starting points are topics to confirm with you.', 'cautious_inference'],
      ['Ask whether the rollout is complete.', 'recommendation'],
      ['If the rollout is complete, ask what changed.', 'recommendation'],
      ['Ask which outcome matters now and whether any next step is useful.', 'recommendation'],
      [`The source states "${excerpt}" Ask which outcome matters now.`, 'cautious_inference'],
      [excerpt, 'direct_support'],
    ] as const) {
      const candidate = JSON.parse(fixture.initial.rawResponse);
      candidate.opening = {text, supportCategory, evidenceRefs: refs};
      const raw = JSON.stringify(candidate);
      const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, 'succeeded', `${text}: ${record.refusal?.message}`);
      assert.equal(record.rawResponse, raw); assertReplayIdentity(record, context);
    }
    for (const [text, supportCategory, evidenceRefs] of [
      ['The source reports that the account has an approved purchasing budget.', 'cautious_inference', refs],
      ['This may matter. The rollout is complete.', 'cautious_inference', refs],
      ['We should buy the replacement immediately.', 'recommendation', refs],
      [`The source states "${excerpt.replace('Harbor', 'Invented')}"`, 'cautious_inference', refs],
      [`The source states "${excerpt}"`, 'cautious_inference', [alternate]],
      [excerpt + ' Ask which outcome matters.', 'direct_support', refs],
      [excerpt, 'direct_support', [alternate]],
    ] as const) {
      const candidate = JSON.parse(fixture.initial.rawResponse);
      candidate.opening = {text, supportCategory, evidenceRefs};
      candidate.selectedEvidenceRefs = [...new Set([...candidate.selectedEvidenceRefs, ...evidenceRefs])];
      const raw = JSON.stringify(candidate);
      const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, 'refused', text); assert.equal(record.rawResponse, raw);
    }
  }
});

test('historical success and refusal are not reclassified by the new content rules', () => {
  const raw = JSON.parse(fixture.initial.rawResponse);
  raw.opening = {text: 'The sources may be relevant. The account owns the platform.', supportCategory: 'cautious_inference', evidenceRefs: fixture.initial.draft!.selectedEvidenceRefs};
  const bytes = JSON.stringify(raw);
  const old = createGenerationRecord(fixture.initialRequest, bytes, context);
  assert.equal(old.outcome, 'succeeded'); assertReplayIdentity(old, context);
  const current = createGenerationRecord(createC3ModelRequest(context, fixture.initial.meetingRequest), bytes, context);
  assert.equal(current.outcome, 'refused');
  assertReplayIdentity(fixture.refusal, context);
});

test('category selection identifies an actual unknown and keeps source reports out of action-only recommendations', () => {
  for (const [text, supportCategory, outcome] of [
    ['Current ownership remains to be learned.', 'unknown', 'succeeded'],
    ['Current ownership remains unverified.', 'unknown', 'succeeded'],
    ['Current ownership remains open.', 'unknown', 'succeeded'],
    ['Ask which outcome matters now.', 'unknown', 'refused'],
    ['The source describes the published operating structure.', 'unknown', 'refused'],
    ['The source describes the published operating structure.', 'recommendation', 'refused'],
  ] as const) {
    const candidate = JSON.parse(fixture.initial.rawResponse);
    const field = supportCategory === 'unknown' ? 'audienceThesis' : 'opening';
    candidate[field] = {text, supportCategory, evidenceRefs: fixture.initial.draft!.selectedEvidenceRefs};
    const raw = JSON.stringify(candidate);
    const record = createGenerationRecord(createC3ModelRequest(context, fixture.initial.meetingRequest), raw, context);
    assert.equal(record.outcome, outcome, `${text}: ${record.refusal?.message}`);
  }
});
