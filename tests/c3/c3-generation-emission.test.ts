import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalJson } from '../../src/c3/context.ts';
import { createC3ModelRequest as createCurrentC3ModelRequest, createC3RevisionContext, createGenerationRecord, assertReplayIdentity } from '../../src/c3/draft.ts';
// These cases characterize issued v5; current v6 is covered by c3-generation-v6.test.ts.
const createC3ModelRequest: typeof createCurrentC3ModelRequest = (context, input, revision = null, version = '5') =>
  createCurrentC3ModelRequest(context, input, revision, version);
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
// Authored public-in-repo fiction, with matching excerpt bytes and citations. No model recording.
function emissionContext(eventDate: string | null = '2026-07-01', exactExcerpt = 'Harbor Transit describes planned platform work. Morgan Vale is the reported planning lead for Cedar Renewal. The plan describes storage integration and a twelve-month staffing lead time.') {
  const context = structuredClone(syntheticWorkshopContext().context);
  const source = context.admittedSources[0]!;
  const excerpt = {...source.excerpts[0]!, exactExcerpt, exactExcerptSha256: hash(exactExcerpt), sourceCharStart: 0, sourceCharEnd: exactExcerpt.length};
  const otherText = 'The Harbor Transit funding proposal remains subject to approval.';
  const other = {...excerpt, evidenceId: 'evidence_emission_other', exactExcerpt: otherText, exactExcerptSha256: hash(otherText), sourceCharStart: exactExcerpt.length + 1, sourceCharEnd: exactExcerpt.length + 1 + otherText.length};
  const fullText = exactExcerpt + '\n' + otherText;
  const updated = {...context, admittedSources: [{...source, eventDate, fullBoundedCleanText: fullText,
    retrievedContentSha256: hash(fullText), retrievedByteSize: Buffer.byteLength(fullText), excerpts: [excerpt, other]}]};
  const serialized = canonicalJson(updated);
  return {context: updated, canonicalJson: serialized, sha256: hash(serialized)};
}
const context = emissionContext();
const meeting = {...syntheticMeetingRequest, durationMinutes: 15};
const initial = createGenerationRecord(createC3ModelRequest(context, meeting), syntheticMeetingCandidate(context), context);
const requests = () => [createC3ModelRequest(context, meeting), createC3ModelRequest(context, meeting,
  createC3RevisionContext(initial, 'Keep the reported role and clarify relevance.', 1))];

// Public fixture + canonical helpers only. Baselines measured before prose compaction:
// 28,416 initial bytes; 32,533 ordinary revision bytes. Require >=6,000 bytes saved.
// Extra whitespace below is an explicitly synthetic sizing control, not a provider
// response or historical owner evidence. 2,983 newlines add 5,966 serialized prompt
// bytes (JSON escapes each newline) without trimming raw.
for (const [mode, padding, beforeBytes] of [
  ['initial', null, 28_416], ['revision', 0, 32_533], ['synthetic large revision', 2_983, 38_499],
] as const) {
  test(`v5 prompt-size regression: ${mode} saves at least 6000 bytes with full context`, (t) => {
    const ctx = syntheticWorkshopContext();
    const first = createC3ModelRequest(ctx, meeting);
    const raw = syntheticMeetingCandidate(ctx) + '\n'.repeat(padding ?? 0);
    const prior = createGenerationRecord(first, raw, ctx);
    assert.equal(prior.outcome, 'succeeded', prior.refusal?.message);
    const revision = padding === null ? null : createC3RevisionContext(prior,
      'Keep the reported role and clarify relevance.', 1);
    const request = createC3ModelRequest(ctx, meeting, revision);
    assert.ok(request.prompt.endsWith(ctx.canonicalJson), 'retain the entire eligible context');
    assert.ok(request.prompt.includes(canonicalJson(request.meetingRequest)));
    if (revision !== null) {
      assert.equal(revision.priorRawResponse, raw);
      assert.equal(revision.priorRawResponseSha256, hash(raw));
      assert.ok(request.prompt.includes(canonicalJson(revision)), 'retain full revision, draft and raw bytes');
    }
    const bytes = Buffer.byteLength(request.prompt, 'utf8');
    t.diagnostic(`${mode}: before=${beforeBytes}, actual=${bytes}, saved=${beforeBytes - bytes}`);
    assert.ok(bytes <= beforeBytes - 6_000, `${bytes} bytes exceeds ${beforeBytes - 6_000} byte budget`);
  });
}

test('issued v5 initial and revision prompts retain controlled emission explicitly', () => {
  for (const request of requests()) {
    assert.equal(request.generationContractVersion, '5');
    assert.match(request.prompt, /GENERATION CONTRACT 5/);
  }
});

test('v5 request composition and validation source bytes require explicit preservation before a future version', () => {
  // Issued v5 at 0c18437abdff24432882394773d10012169ad381. When a real successor
  // exists, preserve/version these semantics first; do not simply refresh hashes.
  // The successor retains the issued module byte-for-byte except its frozen import.
  for (const [file, expected] of [
    ['generation-contract-v5.ts', '1669101e2eafd0d0cd1f6ea3fad47e004847237ce46f3c40cb0ad5e28e869afb'],
    ['generation-claims.ts', 'f0f8792dd9a9e5ce18b2536656572c7d2cf7d24dceaca0682c06a1e9dc8f8518'],
  ]) assert.equal(hash(readFileSync(new URL(`../../src/c3/${file}`, import.meta.url), 'utf8').replace('"./generation-claims-v5.ts"', '"./generation-claims.ts"')), expected,
    'Preserve the issued v5 request/validation contract before changing semantics.');
});

// Synthetic failure-class characterization, not private provider output or a
// proposed wording repair. Every row goes through both complete validators.
const closureContext = emissionContext('2026-07-01',
  'The institute describes planned platform work that Harbor was expected to manage. A July 2026 hiring report describes a twelve-month staffing lead time.');
const closureCases = [
  {name: 'action lexical false refusal', field: 'audienceThesis', category: 'cautious_inference',
    text: 'Lead with the outcome participants name.', outcome: 'refused', error: /cautious_inference requires scoped caution/},
  {name: 'recognized action control', field: 'audienceThesis', category: 'cautious_inference',
    text: 'Ask which outcome participants name.', outcome: 'succeeded'},
  {name: 'personal attribution and relative-clause false refusal', field: 'opening', category: 'cautious_inference',
    text: 'I saw institute sources describe planned platform work that Harbor was expected to manage.', outcome: 'refused', error: /cautious_inference requires scoped caution/},
  {name: 'recognized prefix alone still leaves the relative-clause refusal', field: 'opening', category: 'cautious_inference',
    text: 'The sources describe planned platform work that Harbor was expected to manage.', outcome: 'refused', error: /cautious_inference requires scoped caution/},
  {name: 'recognized source report control', field: 'opening', category: 'cautious_inference',
    text: 'The sources describe planned platform work.', outcome: 'succeeded'},
  {name: 'dated hiring report then applicability uncertainty false refusal', field: 'risksUnknowns', category: 'unknown',
    text: 'A July 2026 hiring report describes a twelve-month staffing lead time. Current applicability is not established by the sources.', outcome: 'refused', error: /unknown must explicitly identify a limit in each asserted claim/},
  {name: 'recognized hiring report and local applicability limit control', field: 'risksUnknowns', category: 'unknown',
    text: 'The source describes a twelve-month staffing lead time. Current applicability is not established by the sources.', outcome: 'succeeded'},
  {name: 'evidence-absence lexical false refusal', field: 'risksUnknowns', category: 'unknown',
    text: 'No admitted excerpt establishes current ownership.', outcome: 'refused', error: /unknown must explicitly identify an unknown or limit/},
  {name: 'recognized evidence-absence control', field: 'risksUnknowns', category: 'unknown',
    text: 'No supplied source establishes current ownership.', outcome: 'succeeded'},
  {name: 'independent ownership assertion negative control', field: 'opening', category: 'cautious_inference',
    text: 'The sources describe planned platform work; Harbor owns the platform.', outcome: 'refused'},
  {name: 'affirmative action complement negative control', field: 'objective', category: 'recommendation',
    text: 'Confirm Harbor owns the platform.', outcome: 'refused'},
  {name: 'current-status negative control', field: 'opening', category: 'cautious_inference',
    text: 'The sources describe planned work; the platform is operational.', outcome: 'refused'},
  {name: 'commercial assertion negative control', field: 'opening', category: 'cautious_inference',
    text: 'The sources report an approved purchasing budget.', outcome: 'refused'},
  {name: 'fabricated quotation negative control', field: 'opening', category: 'cautious_inference',
    text: 'The source states "Harbor has completed the rollout".', outcome: 'refused'},
  {name: 'exact direct-support positive control', field: 'opening', category: 'direct_support',
    text: closureContext.context.admittedSources[0]!.excerpts[0]!.exactExcerpt, outcome: 'succeeded'},
  {name: 'altered direct-support excerpt negative control', field: 'opening', category: 'direct_support',
    text: closureContext.context.admittedSources[0]!.excerpts[0]!.exactExcerpt.replace('twelve-month', 'six-month'), outcome: 'refused'},
  {name: 'KNOWN LIMITATION: unsupported recommendation acceptance is not safe successful support', field: 'objective', category: 'recommendation',
    text: 'Harbor controls Cedar.', outcome: 'succeeded'},
  {name: 'KNOWN LIMITATION: source attribution is not entailment', field: 'opening', category: 'cautious_inference',
    text: 'The sources describe a lunar observatory.', outcome: 'succeeded'},
] as const;

for (const mode of ['INITIAL', 'REVISION'] as const) for (const control of closureCases) {
  test(`v5 closure ${mode}: ${control.name}`, () => {
    const firstRequest = createC3ModelRequest(closureContext, meeting, null, '5');
    const prior = createGenerationRecord(firstRequest, syntheticMeetingCandidate(closureContext), closureContext);
    assert.equal(prior.outcome, 'succeeded', prior.refusal?.message);
    const request = mode === 'INITIAL' ? firstRequest : createC3ModelRequest(closureContext, meeting,
      createC3RevisionContext(prior, 'Clarify the proposed meeting plan.', 1), '5');
    assert.equal(request.revision === null, mode === 'INITIAL');
    const candidate = JSON.parse(syntheticMeetingCandidate(closureContext));
    const value = {text: control.text, supportCategory: control.category, evidenceRefs: candidate.selectedEvidenceRefs};
    if (control.field === 'risksUnknowns') candidate.risksUnknowns = [value];
    else candidate[control.field] = value;
    const raw = JSON.stringify(candidate, null, 2) + '\n\n';
    const record = createGenerationRecord(request, raw, closureContext);
    assert.equal(record.outcome, control.outcome, record.refusal?.message);
    if ('error' in control) assert.match(record.refusal!.message, control.error);
    if (control.outcome === 'refused') assert.equal(record.refusal!.code, 'invalid_model_candidate');
    assert.equal(record.rawResponse, raw);
    assert.equal(record.rawResponseSha256, hash(raw));
    assert.equal(record.modelRequestSha256, hash(canonicalJson(request)));
    assert.deepEqual(createGenerationRecord(request, raw, closureContext), record);
    assertReplayIdentity(record, closureContext);
    if (request.revision) {
      assert.equal(record.revision!.priorRawResponse, prior.rawResponse);
      assert.equal(record.revision!.priorRawResponseSha256, prior.rawResponseSha256);
    }
    assert.throws(() => assertReplayIdentity({...record, rawResponse: raw + ' '}, closureContext));
    assert.throws(() => assertReplayIdentity({...record,
      outcome: record.outcome === 'succeeded' ? 'refused' : 'succeeded'}, closureContext));
  });
}

test('future prompts carry source-faithful financial and emission instructions', () => {
  for (const request of requests()) {
    assert.match(request.prompt, /EMISSION FORMS/);
    assert.match(request.prompt, /The sources do not establish available purchasing budget, remaining amounts, eligible uses, procurement status, or buying intent\./);
    assert.match(request.prompt, /Every claim must remain semantically faithful/);
  }
});

const pairs = [
  {positive: 'The sources describe planned platform work; this planned work may be a useful topic to confirm.', negative: 'The sources describe planned platform work; these plans are useful anchors.', category: 'cautious_inference', fields: ['audienceThesis','opening','risksUnknowns']},
  {positive: 'The source describes planned platform work.', negative: 'The source describes planned platform work, which Harbor now manages.', category: 'cautious_inference', fields: ['audienceThesis','opening','risksUnknowns']},
  {positive: 'The sources do not establish available purchasing budget, remaining amounts, eligible uses, procurement status, or buying intent.', negative: 'The sources report an approved purchasing budget.', category: 'unknown', fields: ['objective','audienceThesis','risksUnknowns','closeCriterion']},
  {positive: 'Current ownership is not established by the sources. Decision authority is not established by the sources.', negative: 'Current ownership is not established by the sources. Harbor owns the platform.', category: 'unknown', fields: ['objective','audienceThesis','risksUnknowns','closeCriterion']},
  {positive: 'Ask whether the reported role still applies to the chosen outcome.', negative: 'Ask whether the reported role still applies and Harbor owns the platform.', category: 'recommendation', fields: ['objective','opening','closeCriterion']},
  {positive: 'Optional probe: If staffing matters to the chosen outcome, ask whether the reported lead time is relevant.', negative: 'Optional probe: If staffing matters to the chosen outcome, confirm Harbor owns the platform.', category: 'recommendation', fields: ['opening']},
] as const;

// One mutation per complete candidate: fail-fast cannot conceal another field's result.
for (const [mode, request] of requests().entries()) {
  for (const pair of pairs) for (const field of [...pair.fields, 'intendedLearning']) {
    test(`emission pair mode ${mode} ${field}: ${pair.positive}`, () => {
      for (const [text, outcome] of [[pair.positive,'succeeded'],[pair.negative,'refused']] as const) {
        const candidate = JSON.parse(syntheticMeetingCandidate(context));
        if (field === 'intendedLearning') candidate.questions[1].intendedLearning = text;
        else {
          const value = {text, supportCategory: pair.category, evidenceRefs: candidate.selectedEvidenceRefs};
          if (field === 'risksUnknowns') candidate.risksUnknowns = [value]; else candidate[field] = value;
        }
        const raw = JSON.stringify(candidate, null, 2) + '\n';
        const record = createGenerationRecord(request, raw, context);
        assert.equal(record.outcome, outcome, `${text}: ${record.refusal?.message}`);
        assert.equal(record.rawResponse, raw); assert.equal(record.rawResponseSha256, hash(raw));
        assertReplayIdentity(record, context);
      }
    });
  }
  for (const field of ['question', 'intendedLearning'] as const) for (let index = 0; index < 3; index++) {
    test(`all question fields mode ${mode} ${index}.${field} retain inquiry and citation checks`, () => {
      const excerpt = context.context.admittedSources[0]!.excerpts[0]!.exactExcerpt;
      for (const [text, outcome] of [
        ['Could we explore whether the planned platform work matters to your chosen outcome?', 'succeeded'],
        ['Ask whether the reported role still applies to the chosen outcome?', 'succeeded'],
        ['Ask whether this matters; the platform is operational?', 'refused'],
        ['The sources describe planned work; Harbor owns the platform?', 'refused'],
        ['Which supplier should receive the approved purchasing budget?', 'refused'],
        [`The source states "${excerpt}"; could we explore whether that matters?`, 'succeeded'],
        ['The source states "Harbor has completed the rollout"; could we explore whether that matters?', 'refused'],
      ] as const) {
        const candidate = JSON.parse(syntheticMeetingCandidate(context)); candidate.questions[index][field] = text;
        const raw = JSON.stringify(candidate); const record = createGenerationRecord(request, raw, context);
        assert.equal(record.outcome, outcome, `${text}: ${record.refusal?.message}`);
        assert.equal(record.rawResponse, raw); assertReplayIdentity(record, context);
      }
    });
  }
  test(`full useful candidate mode ${mode} keeps names, technical anchors, three questions and conditional probes`, () => {
    for (const probes of [1,2]) {
      const candidate = JSON.parse(syntheticMeetingCandidate(context));
      candidate.audienceThesis = {text: 'The source describes Morgan Vale as the reported planning lead for Cedar Renewal; this planned work may be a useful topic to confirm.', supportCategory: 'cautious_inference', evidenceRefs: candidate.selectedEvidenceRefs};
      candidate.opening = {text: 'The sources describe planned platform work; this planned work may be a useful topic to confirm.', supportCategory: 'cautious_inference', evidenceRefs: candidate.selectedEvidenceRefs};
      candidate.questions[0].question = 'Which outcome matters most for this discussion?';
      candidate.questions[1].question = 'Could we explore whether Morgan Vale’s reported planning role still applies to your chosen outcome?';
      candidate.questions[1].intendedLearning = 'Ask whether the reported role still applies to the chosen outcome. Optional probe: If staffing matters to the chosen outcome, ask whether the reported twelve-month lead time is relevant.';
      candidate.questions[2].question = 'What would a useful next step accomplish, if any?';
      if (probes === 2) candidate.questions[2].intendedLearning = 'Optional probe: If integration matters to the chosen outcome, ask whether the planned storage integration is relevant.';
      candidate.risksUnknowns = [{text: pairs[3].positive, supportCategory: 'unknown', evidenceRefs: candidate.selectedEvidenceRefs}, {text: pairs[2].positive, supportCategory: 'unknown', evidenceRefs: candidate.selectedEvidenceRefs}];
      candidate.closeCriterion.text = 'Close by agreeing whether a next step is useful or no follow-up is warranted.';
      const raw = JSON.stringify(candidate); const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, 'succeeded', record.refusal?.message); assert.equal(record.rawResponse, raw);
      assert.equal(record.draft!.questions.length, 3); assert.equal(raw.match(/Optional probe:/g)?.length, probes);
      assertReplayIdentity(record, context);
      for (const failure of ['unknown-id','missing-citation','quote-ref-mismatch','current-upgrade']) {
        const bad = structuredClone(candidate);
        if (failure === 'unknown-id') bad.opening.evidenceRefs = ['evidence_unknown'];
        if (failure === 'missing-citation') bad.opening.evidenceRefs = [];
        if (failure === 'quote-ref-mismatch') {
          bad.opening.text = `The source states "${context.context.admittedSources[0]!.excerpts[0]!.exactExcerpt}"`;
          bad.opening.evidenceRefs = ['evidence_emission_other'];
          bad.selectedEvidenceRefs.push('evidence_emission_other');
        }
        if (failure === 'current-upgrade') bad.opening.text = 'The sources describe planned work; the platform is operational.';
        const bytes = JSON.stringify(bad); const refused = createGenerationRecord(request, bytes, context);
        assert.equal(refused.outcome, 'refused', failure); assert.equal(refused.rawResponse, bytes);
      }
    }
  });
}

test('temporal outcome depends on eligible selected event dates, never meeting-draft revision', () => {
  for (const eventDate of ['2026-07-01',null]) {
    const ctx = emissionContext(eventDate);
    const prior = createGenerationRecord(createC3ModelRequest(ctx, meeting),syntheticMeetingCandidate(ctx),ctx);
    for (const revision of [null,createC3RevisionContext(prior,'Clarify relevance.',1)]) {
      for (const temporalOutcome of ['initial_dated_event_discovery','no_material_change_established','change_against_prior_revision']) {
        const candidate=JSON.parse(syntheticMeetingCandidate(ctx));candidate.temporalOutcome=temporalOutcome;
        const raw=JSON.stringify(candidate);const record=createGenerationRecord(createC3ModelRequest(ctx,meeting,revision),raw,ctx);
        assert.equal(record.outcome, temporalOutcome === 'change_against_prior_revision' || (temporalOutcome === 'initial_dated_event_discovery' && eventDate === null) ? 'refused' : 'succeeded');
        assert.equal(record.rawResponse,raw);
      }
    }
  }
});


test('University-prefixed attribution retains v4 cautious-inference refusal in source-framing fields', () => {
  for (const request of requests()) for (const field of ['audienceThesis', 'opening', 'risksUnknowns']) {
    for (const [text, outcome] of [['The sources describe planned platform work.', 'succeeded'], ['The University sources describe planned platform work.', 'refused']] as const) {
      const candidate = JSON.parse(syntheticMeetingCandidate(context));
      const value = {text, supportCategory: 'cautious_inference', evidenceRefs: candidate.selectedEvidenceRefs};
      if (field === 'risksUnknowns') candidate.risksUnknowns = [value]; else candidate[field] = value;
      const raw = JSON.stringify(candidate); const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, outcome, record.refusal?.message); assert.equal(record.rawResponse, raw);
    }
  }
});
