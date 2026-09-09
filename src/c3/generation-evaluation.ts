import { canonicalJson } from './context.ts';
import { createC3ModelRequest, createGenerationRecord, type C3ModelRequest, type C3MeetingDraftCandidate } from './draft.ts';
import { createC3VerificationRequest, retainC3Verification, v6Hash } from './generation-contract-v6.ts';
import { c3TransportFailure, type C3ModelProvider, type C3GenerationAudit } from './provider.ts';
import type { FrozenC3ViewContext } from './view-context.ts';

export interface C3EvaluationCase {
  readonly id: string;
  readonly category: string;
  readonly expected: 'accept' | 'reject';
  readonly expectedReason: string;
  readonly context: FrozenC3ViewContext;
  readonly request: C3ModelRequest;
  readonly rawResponse: string;
}
export interface C3EvaluationRow {
  readonly id: string;
  readonly category: string;
  readonly expected: 'accept' | 'reject';
  readonly actual: 'accept' | 'reject';
  readonly direction: 'correct' | 'false_rejection' | 'unsupported_acceptance' | 'inconclusive';
  readonly checkStatus: 'passed' | 'semantic_refusal' | 'integrity_refusal' | 'verifier_unavailable' | 'verifier_invalid';
  readonly verifierCalled: boolean;
  readonly verifierAvailable: boolean;
  readonly recordId: string;
  readonly refusal: string | null;
}

/** Expected labels are authored evaluation judgments, never sent to the verifier. */
export async function runC3VerifierEvaluation(cases: readonly C3EvaluationCase[], provider: C3ModelProvider,
  audit: C3GenerationAudit, options: { deadline: string; maxCalls: number; signal: AbortSignal; onRow?: (row: C3EvaluationRow) => Promise<void> }) {
  const deadline = Date.parse(options.deadline);
  if (!cases.length || cases.length > 24 || new Set(cases.map(item => item.id)).size !== cases.length ||
      !Number.isFinite(deadline) || !Number.isInteger(options.maxCalls) || options.maxCalls < 0 || options.maxCalls > 24) {
    throw new Error('Evaluation requires 1–24 unique cases, an explicit deadline and a 0–24 call ceiling.');
  }
  let calls = 0;
  const rows: C3EvaluationRow[] = [];
  let stopped: 'deadline' | 'cancelled' | 'call_limit' | 'verifier_failure' | null = null;
  for (const item of cases) {
    if (options.signal.aborted || Date.now() >= deadline) { stopped = options.signal.aborted ? 'cancelled' : 'deadline'; break; }
    if (!['accept', 'reject'].includes(item.expected)) throw new Error('Evaluation expected label is required.');
    let verificationRequest;
    try { verificationRequest = createC3VerificationRequest(item.request, item.rawResponse, item.context); }
    catch { /* Integrity refusal is a separately identified zero-call row. */ }
    if (verificationRequest && calls >= options.maxCalls) { stopped = 'call_limit'; break; }
    await audit.retainCandidate(item.request, item.rawResponse);
    if (options.signal.aborted || Date.now() >= deadline) { stopped = options.signal.aborted ? 'cancelled' : 'deadline'; break; }
    let verification;
    let verifierCalled = false;
    let verifierAvailable = false;
    if (verificationRequest) {
      let raw: string | null = null;
      if (provider.verify) {
        verifierCalled = true; calls += 1;
        const deadlineSignal = AbortSignal.timeout(Math.max(1, Math.min(2_147_483_647, deadline - Date.now())));
        try { raw = await provider.verify(verificationRequest, AbortSignal.any([options.signal, deadlineSignal])); }
        catch (error) { await audit.retainFailure(verificationRequest, c3TransportFailure(error)); }
      }
      verifierAvailable = raw !== null;
      verification = retainC3Verification(verificationRequest, raw);
    }
    const record = createGenerationRecord(item.request, item.rawResponse, item.context, verification);
    await audit.retainRecord(record);
    const actual = record.outcome === 'succeeded' ? 'accept' : 'reject';
    const checkStatus: C3EvaluationRow['checkStatus'] = !verificationRequest ? 'integrity_refusal'
      : !verifierAvailable ? 'verifier_unavailable' : actual === 'accept' ? 'passed'
      : record.refusal?.message.startsWith('Evidence check found contradicted or insufficiently supported content;') ? 'semantic_refusal' : 'verifier_invalid';
    const inconclusive = checkStatus === 'verifier_unavailable' || checkStatus === 'verifier_invalid';
    const row: C3EvaluationRow = { id: item.id, category: item.category, expected: item.expected, actual,
      checkStatus, direction: inconclusive ? 'inconclusive' : item.expected === actual ? 'correct' : actual === 'accept' ? 'unsupported_acceptance' : 'false_rejection',
      verifierCalled, verifierAvailable, recordId: record.recordId, refusal: record.refusal?.message ?? null };
    rows.push(row); await options.onRow?.(row);
    if (inconclusive) { stopped = 'verifier_failure'; break; }
  }
  // Integrity gates are zero-call checks, not observations of verifier semantics.
  const semanticRows = rows.filter(row => row.checkStatus === 'passed' || row.checkStatus === 'semantic_refusal');
  const accepts = semanticRows.filter(row => row.expected === 'accept');
  const rejects = semanticRows.filter(row => row.expected === 'reject');
  const falseRejections = accepts.filter(row => row.direction === 'false_rejection').length;
  const unsupportedAcceptances = rejects.filter(row => row.direction === 'unsupported_acceptance').length;
  return { kind: 'atliera.c3.verifier-evaluation', schemaVersion: '1',
    evidenceMeaning: 'Small authored set; independent model agreement is quality control, not proof or approval. Scripted responses test plumbing only. Integrity refusals and transport/format failures are excluded from semantic rates.',
    provider: provider.name, executionMode: provider.executionMode ?? 'unspecified', requestedCases: cases.length,
    completedCases: rows.length, calls, stopped,
    falseRejections: { count: falseRejections, denominator: accepts.length, rate: accepts.length ? falseRejections / accepts.length : null },
    unsupportedAcceptances: { count: unsupportedAcceptances, denominator: rejects.length, rate: rejects.length ? unsupportedAcceptances / rejects.length : null },
    unavailableChecks: rows.filter(row => row.verifierCalled && !row.verifierAvailable).length,
    invalidChecks: rows.filter(row => row.checkStatus === 'verifier_invalid').length,
    integrityRefusals: rows.filter(row => row.checkStatus === 'integrity_refusal').length,
    rows };
}

function completeBrief(context: FrozenC3ViewContext, thesis: string, refs: string[], sparse = false): string {
  const candidate: C3MeetingDraftCandidate = {
    temporalOutcome: sparse ? 'insufficient_context' : 'no_material_change_established',
    objective: { text: 'Explore the outcome participants want and decide whether another conversation would help.', evidenceRefs: [], supportCategory: 'recommendation' },
    audienceThesis: { text: thesis, evidenceRefs: refs, supportCategory: sparse ? 'unknown' : 'cautious_inference' },
    opening: { text: sparse ? 'Could we start with the outcome you want from this conversation?' : `${thesis} Could we start with whether that work matters to your chosen outcome?`, evidenceRefs: refs, supportCategory: 'recommendation' },
    questions: [
      { question: 'Which outcome would make this conversation useful?', intendedLearning: 'Learn the outcome participants name before prioritizing topics.', evidenceRefs: [], supportCategory: 'open_question' },
      { question: sparse ? 'What, if anything, is getting in the way of that outcome?' : 'How, if at all, does the reported work relate to that outcome?', intendedLearning: 'Explore relevance without presuming that it is a priority. Optional probe: If a constraint matters, ask who could help clarify it.', evidenceRefs: refs, supportCategory: 'open_question' },
      { question: 'Would a next step help, or is it better to leave the discussion here?', intendedLearning: 'Determine whether any follow-up would be useful.', evidenceRefs: [], supportCategory: 'open_question' },
    ],
    risksUnknowns: [{ text: 'The supplied evidence does not establish this audience’s current priority or purchasing intent.', evidenceRefs: [], supportCategory: 'unknown' }],
    closeCriterion: { text: 'Agree whether a next step is useful; if so, discuss what it would accomplish.', evidenceRefs: [], supportCategory: 'recommendation' },
    selectedEvidenceRefs: refs,
  };
  return JSON.stringify({ ...candidate, assertions: [] });
}

/** Bounded authored cases built from retained contexts; never modifies those contexts or records. */
export function buildC3RetainedEvaluationCases(utah: FrozenC3ViewContext, fedex: FrozenC3ViewContext): C3EvaluationCase[] {
  const locate = (context: FrozenC3ViewContext, fragment: string) => {
    const excerpt = context.context.admittedSources.filter(s => !s.untrustedInstructionsDetected).flatMap(s => s.excerpts)
      .find(e => e.exactExcerpt.includes(fragment));
    if (!excerpt) throw new Error(`Retained evaluation anchor missing: ${fragment}`);
    return excerpt.evidenceId;
  };
  const utahRef = locate(utah, 'three-year reinvestment process');
  const networkRef = locate(fedex, 'fully implemented in Canada');
  const portalRef = locate(fedex, 'In May 2026, we introduced');
  const roleRef = locate(fedex, 'Vishal Talwar');
  const funding = 'The university’s reinvestment report describes a three-year allocation across engineering, AI and other programs.';
  const network = 'FedEx reports that Network 2.0 is fully implemented in Canada and expects to finish the U.S. implementation by the end of 2027.';
  const meeting = { audience: 'CIO and engineering leaders', intendedOutcome: 'Explore priorities and whether a useful next step exists.', durationMinutes: 15 as const, meetingDate: '2026-09-14' };
  const cases: C3EvaluationCase[] = [];
  const add = (id: string, category: string, expected: 'accept' | 'reject', expectedReason: string, context: FrozenC3ViewContext, rawResponse: string) => {
    cases.push({ id, category, expected, expectedReason, context, request: createC3ModelRequest(context, meeting), rawResponse });
  };
  const utahBrief = completeBrief(utah, funding, [utahRef]);
  const fedexBrief = completeBrief(fedex, network, [networkRef]);
  add('utah-natural-complete', 'natural_complete', 'accept', 'Source-attributed allocation, no claim of commercial availability.', utah, utahBrief);
  add('fedex-natural-complete', 'natural_complete', 'accept', 'Preserves Canada status, U.S. future expectation and date.', fedex, fedexBrief);
  const mutate = (raw: string, edit: (candidate: any) => void) => { const value = JSON.parse(raw); edit(value); return JSON.stringify(value); };
  add('natural-personal-attribution', 'false_rejection_control', 'accept', 'Personal source attribution faithfully describes reinvestment.', utah,
    mutate(utahBrief, c => { c.opening.text = 'I read that the university is redirecting funds across several programs over three years. Which part, if any, matters to your outcome?'; }));
  add('unseen-name-and-wording', 'false_rejection_control', 'accept', 'Retains the source-reported titles without asserting present decision authority.', fedex,
    completeBrief(fedex, 'The filing names Vishal Talwar as FedEx’s CDIO and president of FedEx Dataworks, with the roles reported since August 2025.', [roleRef]));
  add('known-unsupported-relation', 'unsupported_relation', 'reject', 'No source establishes this control relation; an action label cannot excuse it.', utah,
    mutate(utahBrief, c => { c.objective.text = 'Harbor controls Cedar.'; }));
  add('known-unrelated-attribution', 'unrelated_attribution', 'reject', 'Attribution and citations do not establish a lunar observatory.', utah,
    mutate(utahBrief, c => { c.opening.text = 'The sources describe a lunar observatory.'; }));
  add('mixed-clause', 'mixed_clause', 'reject', 'The supported first clause cannot support a completed global rollout.', fedex,
    mutate(fedexBrief, c => { c.opening.text = `${network} The entire worldwide rollout is complete.`; }));
  add('question-hidden-premise', 'question_presupposition', 'reject', 'Presupposes available purchasing funds from a reinvestment allocation.', utah,
    mutate(utahBrief, c => { c.questions[1].question = 'How will you spend the available AI purchasing budget?'; }));
  add('action-hidden-rationale', 'action_presupposition', 'reject', 'An action presupposes an unsupported vendor agreement.', utah,
    mutate(utahBrief, c => { c.objective.text = 'Schedule onboarding for the vendor you have already contracted.'; }));
  add('learning-hidden-premise', 'learning_presupposition', 'reject', 'Learning purpose assumes an unsupported purchase.', utah,
    mutate(utahBrief, c => { c.questions[1].intendedLearning = 'Learn how the purchased lunar platform will be deployed.'; }));
  add('planned-to-operational', 'modality', 'reject', 'U.S. completion is expected by end 2027, not established now.', fedex,
    mutate(fedexBrief, c => { c.audienceThesis.text = 'FedEx has completed Network 2.0 in the U.S.'; }));
  add('entity-scope-expansion', 'entity_scope', 'reject', 'Canada implementation does not establish global implementation.', fedex,
    mutate(fedexBrief, c => { c.audienceThesis.text = 'FedEx reports that Network 2.0 is fully implemented worldwide.'; }));
  add('publication-is-not-event', 'date_scope', 'reject', 'The portal assistant was introduced in May, not on the July publication date.', fedex,
    completeBrief(fedex, 'FedEx introduced its Developer Portal AI assistant on July 20, 2026.', [portalRef]));
  add('wrong-eligible-citation', 'wrong_citation', 'reject', 'The portal assistant citation does not support the network claim.', fedex,
    completeBrief(fedex, network, [portalRef]));
  add('wrong-account-citation', 'integrity', 'reject', 'A FedEx citation is not eligible in the Utah context.', utah,
    mutate(utahBrief, c => { c.opening.evidenceRefs = [networkRef]; c.selectedEvidenceRefs.push(networkRef); }));
  add('fabricated-quote', 'integrity', 'reject', 'Quotation is not an exact cited span.', utah,
    mutate(utahBrief, c => { c.opening.text = 'The source says "The lunar rollout is complete".'; }));
  add('malformed-generator', 'integrity', 'reject', 'Invalid JSON cannot reach semantic verification.', utah, '{not json');
  const sparseContext = structuredClone(utah.context);
  const sparseData = { ...sparseContext, admittedSources: [], discoveryLineage: [], relevanceCandidates: [],
    materialGaps: ['Synthetic sparse evaluation variant of retained context; no eligible excerpts supplied.'] };
  const sparseJson = canonicalJson(sparseData);
  const sparse: FrozenC3ViewContext = { context: sparseData, canonicalJson: sparseJson, sha256: v6Hash(sparseJson) };
  add('sparse-natural-complete', 'sparse', 'accept', 'Explicit evidence absence with open questions; no invented account facts.', sparse,
    completeBrief(sparse, 'No eligible source passage is supplied, so account priorities remain unestablished here.', [], true));
  add('sparse-invented-status', 'sparse', 'reject', 'No eligible evidence establishes the asserted deployed status.', sparse,
    mutate(completeBrief(sparse, 'No eligible source passage is supplied.', [], true), c => { c.opening.text = 'Your lunar platform is now operational.'; }));
  const conflictData = { ...fedex.context, declaredContradictions: [...fedex.context.declaredContradictions,
    'Synthetic evaluation conflict: one retained claim says Canada implementation is complete; another says its completion is not established. Neither has priority.'] };
  const conflictJson = canonicalJson(conflictData);
  const conflict: FrozenC3ViewContext = { context: conflictData, canonicalJson: conflictJson, sha256: v6Hash(conflictJson) };
  add('unqualified-conflict', 'contradiction', 'reject', 'The synthetic declared conflict must not be silently resolved.', conflict, fedexBrief);
  return cases;
}
