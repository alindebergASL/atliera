import assert from 'node:assert/strict';
import test from 'node:test';
import { assertC3ClaimSupport } from '../../src/c3/generation-claims.ts';
import { assertC3ClaimSupport as assertV3ClaimSupport } from '../../src/c3/generation-claims-v3.ts';
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, assertReplayIdentity } from '../../src/c3/draft.ts';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';

// Authored grammar controls, unrelated to private model wording or research.
const discourseCases = [
  ['audienceThesis', 'cautious_inference', 'The planned work may be relevant, but we should confirm whether it still matters.'],
  ['audienceThesis', 'cautious_inference', 'The work could be relevant, but participants should clarify whether it fits the chosen goal.'],
  ['opening', 'cautious_inference', "I'd like to understand which outcome matters now."],
  ['opening', 'cautious_inference', 'I’d like to confirm whether Cedar Renewal and Harbor Access are relevant to your chosen outcome.'],
  ['opening', 'cautious_inference', 'Could we explore whether Cedar Renewal and Harbor Access are relevant to your chosen outcome?'],
  ['risksUnknowns', 'unknown', 'Dates for the Cedar Renewal source and Harbor Access source are unknown.'],
  ['opening', 'cautious_inference', "I'd like to explore the chosen goal, then ask whether the planned Cedar Renewal and Harbor Access plans are relevant."],
  ['risksUnknowns', 'unknown', 'Coverage limits for the cited Cedar Renewal and Harbor Access reports are unknown.'],
  ['risksUnknowns', 'unknown', 'Coverage limits for the selected Cedar Renewal and Harbor Access reports are unknown.'],
  ['closeCriterion', 'recommendation', 'Close by agreeing whether a next step is useful or no follow-up is warranted.'],
] as const;

for (const [field, category, text] of discourseCases) {
  test(`speech-act scope accepts ${text}`, () => {
    assert.throws(() => assertV3ClaimSupport(text, category, ['Synthetic related context.'], field), 'frozen v3 retains its refusal');
    assert.doesNotThrow(() => assertC3ClaimSupport(text, category, ['Synthetic related context.'], field));
  });
}

for (const text of [
  'The planned work may matter, but Harbor owns the platform.',
  "I'd like to learn which outcome matters. Harbor owns the platform.",
  "I'd like to confirm whether Cedar Renewal matters and Harbor owns the platform.",
  'Could we explore whether Cedar Renewal matters, Harbor owns the platform?',
  'Dates for Cedar Renewal are unknown and Harbor owns the platform.',
  'Dates for Cedar Renewal and Harbor Access are unknown, but Harbor owns the platform.',
  'Close by agreeing whether a next step is useful because Harbor owns the platform.',
  'Close with a discussion of the platform that Harbor owns.',
  'We should confirm that Harbor owns the platform.',
  'We should confirm Harbor owns the platform.',
  'Confirm whether the platform that Harbor owns is useful.',
  'Ask whether Cedar Renewal matters and the rollout is complete.',
  'Ask whether Cedar Renewal matters and Harbor Access is operational.',
  'We should confirm the rollout is complete.',
  'Close with agreement that Harbor owns the platform.',
  'Harbor owns the platform and participants should clarify whether it fits.',
  'Ask whether the planned Cedar Renewal matters and Harbor Access plans are operational.',
  'Ownership of Cedar Renewal is unknown and Harbor Access plans are operational.',
  'Harbor selected the platform with unknown scope.',
  'Participants own the platform with unknown scope.',
  'Ask whether participants support Cedar Renewal and Harbor Access plans are operational.',
]) {
  test(`speech-act scope rejects ${text}`, () => {
    for (const category of ['cautious_inference', 'recommendation', 'open_question'] as const) {
      assert.throws(() => assertC3ClaimSupport(text, category, ['Synthetic related context.'], 'opening'), category);
    }
  });
}

// F1: each coordinated action needs its own inquiry; an earlier inquiry cannot
// license an affirmative confirmation. All wording below is synthetic.
const coordinatedActions = [
  ['opening', 'cautious_inference', 'I’d like to learn which priorities matter', 'Harbor owns the platform'],
  ['opening', 'cautious_inference', 'Leaders should clarify which goals matter', 'Harbor has the platform'],
  ['closeCriterion', 'recommendation', 'Close by asking whether a next step is useful', 'Harbor owns the platform'],
] as const;
const coordinatedCases = coordinatedActions.flatMap(([field, category, lead, assertion]) =>
  ['and', 'then', 'and then'].flatMap(join => [
    { field, category, text: `${lead} ${join} confirm ${assertion}.`, outcome: 'refused' },
    { field, category, text: `${lead} ${join} confirm that ${assertion}.`, outcome: 'refused' },
    { field, category, text: `${lead} ${join} ask whether ${assertion}.`, outcome: 'succeeded' },
    { field, category, text: `${lead} ${join} confirm whether ${assertion}.`, outcome: 'succeeded' },
  ] as const));

for (const { field, category, text, outcome } of coordinatedCases) {
  test(`coordinated action scope ${outcome}: ${text}`, () => {
    if (outcome === 'refused') {
      for (const supportCategory of ['cautious_inference', 'recommendation', 'open_question'] as const) {
        assert.throws(() => assertC3ClaimSupport(text, supportCategory, ['Synthetic related context.'], field), supportCategory);
      }
    } else {
      assert.doesNotThrow(() => assertC3ClaimSupport(text, category, ['Synthetic related context.'], field));
    }
  });
}

for (const mode of ['initial', 'revision'] as const) {
  test(`coordinated action scope preserves ${mode} validation and raw bytes`, () => {
    const context = syntheticWorkshopContext();
    const initialRequest = createC3ModelRequest(context, syntheticMeetingRequest);
    const initial = createGenerationRecord(initialRequest, syntheticMeetingCandidate(context), context);
    assert.equal(initial.outcome, 'succeeded');
    const request = mode === 'initial' ? initialRequest : createC3ModelRequest(context, syntheticMeetingRequest,
      createC3RevisionContext(initial, 'Clarify each action’s inquiry.', 1));
    for (const { field, category, text, outcome } of coordinatedCases) {
      const candidate = JSON.parse(syntheticMeetingCandidate(context));
      candidate[field] = { text, supportCategory: category, evidenceRefs: candidate.selectedEvidenceRefs };
      const raw = JSON.stringify(candidate);
      const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, outcome, `${text}: ${record.refusal?.message}`);
      assert.equal(record.rawResponse, raw);
      assertReplayIdentity(record, context);
    }
  });
}

// Q1 nominal repair: authored noun alternatives share a negative assumption,
// but a completed proposition or a new action never borrows that scope.
const negativeNominalCases = [
  ...['without assuming', 'rather than assume'].flatMap(negative => [
    { text: `Identify the decision path ${negative} routing, scheduling, or storage is the limiting factor.`, outcome: 'succeeded' },
    { text: `Explore alternatives ${negative} Cedar Planning or Harbor Access is the answer.`, outcome: 'succeeded' },
    { text: `Explore alternatives ${negative} capacity or staffing is the constraint.`, outcome: 'succeeded' },
    { text: `Explore alternatives ${negative} Cedar Planning and Harbor Access are the answer.`, outcome: 'succeeded' },
    ...['and to confirm', 'or independently reconfirm', 'and also confirming', 'or to carefully validate'].flatMap(action => [
      { text: `Identify the decision path ${negative} routing is a blocker ${action} Harbor owns the platform.`, outcome: 'refused' },
      { text: `Identify the decision path ${negative} routing or storage is a blocker ${action} Harbor owns the platform.`, outcome: 'refused' },
      { text: `Identify the decision path ${negative} routing or storage is a blocker ${action} whether Harbor owns the platform.`, outcome: 'succeeded' },
    ]),
    { text: `Explore alternatives ${negative} participants support Cedar Planning or Harbor Access is the answer.`, outcome: 'refused' },
    { text: `Explore alternatives ${negative} routing is a blocker or Harbor owns the platform.`, outcome: 'refused' },
    { text: `Explore alternatives ${negative} routing or separately confirming Harbor owns the platform.`, outcome: 'refused' },
  ]),
];
for (const mode of ['initial', 'revision'] as const) {
  for (const { text, outcome } of negativeNominalCases) {
    test(`Q1 nominal ${mode} ${outcome}: ${text}`, () => {
      const context = syntheticWorkshopContext();
      const initialRequest = createC3ModelRequest(context, syntheticMeetingRequest);
      const initial = createGenerationRecord(initialRequest, syntheticMeetingCandidate(context), context);
      assert.equal(initial.outcome, 'succeeded');
      const request = mode === 'initial' ? initialRequest : createC3ModelRequest(context, syntheticMeetingRequest,
        createC3RevisionContext(initial, 'Clarify the decision path.', 1));
      const candidate = JSON.parse(syntheticMeetingCandidate(context));
      candidate.questions[1].intendedLearning = text;
      const raw = JSON.stringify(candidate);
      const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, outcome, record.refusal?.message);
      assert.equal(record.rawResponse, raw);
      assertReplayIdentity(record, context);
    });
  }
}

// Q1: coordination is a scope boundary, not a bare-verb spelling test.
const q1Cases = [
  ...([
    ['opening', 'cautious_inference', 'I’d like to learn which priorities matter', 'Harbor owns the platform'],
    ['opening', 'cautious_inference', 'Leaders should clarify which goals matter', 'Harbor has the platform'],
    ['opening', 'cautious_inference', 'I’d like to learn whether priorities matter', 'Harbor is operational'],
  ] as const).flatMap(([field, category, lead, assertion]) =>
    ['and to confirm', 'and also confirm', 'and to also confirm', 'and also to confirm',
      'and then carefully confirm', 'then independently confirm', 'and to independently confirm',
      'and additionally validate', 'or separately check'].flatMap(action => [
      { field, category, text: `${lead} ${action} ${assertion}.`, outcome: 'refused' },
      { field, category, text: `${lead} ${action} whether ${assertion}.`, outcome: 'succeeded' },
    ])),
  ...['Harbor owns the platform', 'Harbor is operational'].flatMap(assertion =>
    ['and confirming', 'and also confirming', 'and independently confirming', 'and then checking',
      'or additionally validating'].flatMap(action => [
      { field: 'closeCriterion', category: 'recommendation',
        text: `Close by asking whether a next step is useful ${action} ${assertion}.`, outcome: 'refused' },
      { field: 'closeCriterion', category: 'recommendation',
        text: `Close by asking whether a next step is useful ${action} whether ${assertion}.`, outcome: 'succeeded' },
    ])),
  { field: 'opening', category: 'cautious_inference',
    text: 'I’d like to learn which priorities matter and somehow reconfirm Harbor owns the platform.', outcome: 'refused' },
  { field: 'opening', category: 'cautious_inference',
    text: 'I’d like to learn whether priorities matter and somehow reconfirm Harbor is operational.', outcome: 'refused' },
];
for (const mode of ['initial', 'revision'] as const) {
  for (const { field, category, text, outcome } of q1Cases) {
    test(`Q1 ${mode} ${outcome}: ${text}`, () => {
      const context = syntheticWorkshopContext();
      const initialRequest = createC3ModelRequest(context, syntheticMeetingRequest);
      const initial = createGenerationRecord(initialRequest, syntheticMeetingCandidate(context), context);
      assert.equal(initial.outcome, 'succeeded');
      const request = mode === 'initial' ? initialRequest : createC3ModelRequest(context, syntheticMeetingRequest,
        createC3RevisionContext(initial, 'Clarify local inquiry scope.', 1));
      const candidate = JSON.parse(syntheticMeetingCandidate(context));
      candidate[field] = { text, supportCategory: category, evidenceRefs: candidate.selectedEvidenceRefs };
      const raw = JSON.stringify(candidate);
      const record = createGenerationRecord(request, raw, context);
      assert.equal(record.outcome, outcome, record.refusal?.message);
      assert.equal(record.rawResponse, raw);
      assertReplayIdentity(record, context);
    });
  }
}

test('shared named-source date limits retain their governing predicate', () => {
  assert.doesNotThrow(() => assertC3ClaimSupport(
    'Publication, event and current-through dates for the cited Cedar Renewal and Harbor Access sources are unknown.',
    'unknown', ['Synthetic related context.'], 'risksUnknowns'));
});

test('action complements distinguish nominal modifiers from asserted predicates', () => {
  for (const text of ['Learn the participants’ own goals.', "Learn the participant's own goals.", 'Clarify their own goals.',
    'Ask whether the selected plan is relevant.', 'Close with a conclusion that no follow-up is warranted.',
    'Explore constraints without assuming the platform is the answer.']) {
    assert.doesNotThrow(() => assertC3ClaimSupport(text, 'recommendation', [], 'objective'), text);
  }
});

test('all repaired fields use identical initial/revision semantics and keep unchanged raw bytes', () => {
  const context = syntheticWorkshopContext();
  const initial = createGenerationRecord(createC3ModelRequest(context, syntheticMeetingRequest), syntheticMeetingCandidate(context), context);
  const requests = [createC3ModelRequest(context, syntheticMeetingRequest), createC3ModelRequest(context, syntheticMeetingRequest,
    createC3RevisionContext(initial, 'Clarify the conversational scope.', 1))];
  for (const request of requests) {
    const candidate = JSON.parse(syntheticMeetingCandidate(context));
    for (const [field, supportCategory, text] of discourseCases) {
      const value = { text, supportCategory, evidenceRefs: candidate.selectedEvidenceRefs };
      if (field === 'risksUnknowns') candidate.risksUnknowns = [value];
      else candidate[field] = value;
    }
    const raw = JSON.stringify(candidate);
    const record = createGenerationRecord(request, raw, context);
    assert.equal(record.outcome, 'succeeded', record.refusal?.message);
    assert.equal(record.rawResponse, raw);
    assertReplayIdentity(record, context);
    for (const text of [
      'We should confirm whether Cedar Renewal matters and Harbor owns the platform.',
      'Close with the approved purchasing budget.',
      'We should confirm which vendor to use after the account purchased a platform.',
    ]) {
      candidate.opening.text = text;
      const unsafe = JSON.stringify(candidate);
      const refused = createGenerationRecord(request, unsafe, context);
      assert.equal(refused.outcome, 'refused', text);
      assert.equal(refused.rawResponse, unsafe);
    }
  }
});
