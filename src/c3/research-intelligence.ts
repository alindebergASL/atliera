import { admitAccountResearch } from '../account-intelligence/admission.ts';
import { snapshotAdmittedResearchPolicy } from '../account-intelligence/research-policy.ts';
import { createAccountResearchPlan, snapshotAccountResearchRequest } from '../account-intelligence/research-plan.ts';
import { accountIntelligenceQualifiedFundingObserved, snapshotAccountIntelligenceProposal, systemOwnedMaterialGaps, systemOwnedResearchCoverage } from '../account-intelligence/proposal.ts';
import type { DirectSourceAcquisition, IntelligenceStatement, RetainedSourceCustody, TaxonomyAdmissionAuthority } from '../account-intelligence/contracts.ts';
import { canonicalJson, type C3AccountContext, type FrozenC3AccountContext } from './context.ts';
import type { FrozenC3ViewContext } from './view-context.ts';
import { researchHash, researchIdentity, researchJson, researchPassage, validateResearchScope } from './research-source.ts';
import { validateResearchRun, type ResearchRun } from './research-store.ts';
import { questionPassages } from './research-render.ts';

export interface ResearchIntelligenceBinding {
  readonly kind: 'validated-direct-source-proposal';
  readonly baseContextCanonicalJson: string;
  readonly run: ResearchRun;
  readonly sourceId: string;
  readonly passageSha256: string;
  readonly acquisition: DirectSourceAcquisition;
  readonly selectedEvidenceId: string;
  readonly findingIds: readonly string[];
  readonly humanApproved: false;
}
/** Pure, deterministic admission from trusted runtime custody. No acquisition or model call.
 * The old context is retained verbatim; new derived IDs explicitly retain original lineage.
 */
export function admitResearchIntelligence(base: FrozenC3ViewContext, input: ResearchRun, sourceId: string,
  passageSha256: string, binding: { accountId: string; principal: string }): FrozenC3AccountContext {
  if (base.context.account.accountId !== binding.accountId || base.context.directResearch || !base.context.ownerDecisionSource || !base.context.custody.policyReceipt ||
      canonicalJson(base.context) !== base.canonicalJson || researchHash(base.canonicalJson) !== base.sha256) throw Error('Base intelligence context mismatch');
  const scope = validateResearchScope(input.scope, binding);
  const run = validateResearchRun(input, scope);
  if (run.state !== 'completed' || !run.snapshotId) throw Error('Completed exact source snapshot required');
  const source = run.sources.find(item => item.sourceId === sourceId);
  if (!source) throw Error('Selected source unavailable in snapshot');
  const passages = questionPassages(source, scope.question);
  const selected = passages.find(item => item.sha256 === passageSha256);
  if (!selected) throw Error('Selected exact passage unavailable');
  for (const passage of passages) if (canonicalJson(researchPassage(source.cleanText, passage.start, passage.end)) !== canonicalJson(passage)) throw Error('Passage custody mismatch');
  const entity = base.context.entities.find(item => item.entityId === source.entityId);
  const primary = base.context.entities.find(item => item.entityId === binding.accountId && item.kind === 'account');
  if (!entity || !primary || (entity.entityId === primary.entityId ? 'account' : 'related_entity') !== source.relationshipToAccount) throw Error('Trusted entity relationship mismatch');
  const request = snapshotAccountResearchRequest({ kind: 'atliera.account-intelligence-refresh-request', schemaVersion: '1', ...base.context.account, requestedAt: run.updatedAt });
  const id = researchIdentity([run.snapshotId, sourceId, passageSha256]).slice(0, 24);
  const shared = { accountId: binding.accountId, canonicalUrl: source.finalUrl, retrievedContentSha256: source.cleanTextSha256,
    authorizedBy: 'agent-proposed-direct-source-adapter', authorizedAt: run.updatedAt, scope: 'local_test_only' as const, authorizesPersistence: false as const };
  const custody: RetainedSourceCustody = { ...shared, custodyId: `custody_${id}`, retainedCorpusId: run.snapshotId,
    sourceClass: 'official_primary', title: `${source.publisher} — selected source report`, publisher: source.publisher,
    primaryEntityId: entity.entityId, retrievedAt: source.retrievedAt };
  // Generic documentary context, not an inferred commercial or change classification.
  const authorities: TaxonomyAdmissionAuthority[] = passages.map((passage, index) => ({ ...shared,
    authorizationId: `taxonomy_${id}_${index}`, custodyId: custody.custodyId, exactExcerptSha256: passage.sha256, taxonomy: 'identity_structure' }));
  const policy = snapshotAdmittedResearchPolicy({ kind: 'atliera.admitted-account-research-policy', schemaVersion: '2',
    policyId: `policy_${id}`, accountId: binding.accountId, primaryAccountEntity: primary,
    admittedEntities: entity.entityId === primary.entityId ? [primary] : [primary, entity],
    trustedOfficialHosts: scope.allowedHosts.map(hostname => ({ hostname, allowSubdomains: false, entityIds: [entity.entityId] })),
    sourceCustody: [custody], taxonomyAuthorities: authorities, authorizedAt: run.updatedAt,
    scope: 'local_test_only', authorizesPersistence: false, authorizesPrivateSources: false });
  const acquisition: DirectSourceAcquisition = { kind: 'direct-source', accountId: binding.accountId, principal: binding.principal, snapshotId: run.snapshotId,
    retainedSourceId: source.sourceId, retrievalId: `retrieval_${id}`, canonicalUrl: source.finalUrl,
    rawSha256: source.rawSha256, cleanTextSha256: source.cleanTextSha256 };
  const admitted = admitAccountResearch(request, createAccountResearchPlan(request), policy, [], [{
    retrievalId: acquisition.retrievalId, discoveredByQueryIds: [], entity, relatedEntities: [], canonicalUrl: source.finalUrl,
    title: custody.title, publisher: source.publisher, sourceClass: 'official_primary', publicationDate: null, eventDate: null,
    retrievedAt: source.retrievedAt, evidenceCurrentThrough: null, retrievalContentKind: 'bounded_clean_text_projection',
    retrievedText: source.cleanText, candidateExcerpts: passages.map(p => p.text), taxonomyCoverage: ['identity_structure'],
    taxonomyEvidence: [{ taxonomy: 'identity_structure', candidateExcerptIndexes: passages.map((_, index) => index) }], declaredConflictIds: [],
  }], [acquisition]);
  const fresh = { ...admitted.sources[0]!, fullBoundedCleanText: source.cleanText, custody, taxonomyAuthorities: authorities };
  if (fresh.untrustedInstructionsDetected) throw Error('Source instructions make this material ineligible');
  if (base.context.admittedSources.some(item => item.sourceId === fresh.sourceId)) throw Error('Source already admitted in base context');
  const sources = [...(base.context as C3AccountContext).admittedSources, fresh];
  const facts: IntelligenceStatement[] = fresh.excerpts.map((excerpt, index) => ({ statementId: `finding_${id}_${index}`,
    state: 'source-backed fact', text: `${source.publisher}: “${excerpt.exactExcerpt}”`, evidenceIds: [excerpt.evidenceId],
    entityIds: [entity.entityId], riskFlags: accountIntelligenceQualifiedFundingObserved(excerpt.exactExcerpt) ? ['stale_evidence', 'funding_status_ambiguity'] : ['stale_evidence'] }));
  const previous = (base.context as C3AccountContext).proposal;
  const flags = previous.riskConflictFlags.map(flag => ({ ...flag, statementIds: [...flag.statementIds] }));
  for (const flag of ['stale_evidence', 'funding_status_ambiguity'] as const) {
    const ids = facts.filter(fact => fact.riskFlags.includes(flag)).map(fact => fact.statementId);
    if (!ids.length) continue;
    const existing = flags.find(item => item.flag === flag);
    if (existing) { existing.statementIds.push(...ids); }
    else flags.push({ flag, statementIds: ids, needsReview: true, reason: 'Documentary source reports retain their qualifiers; retrieval establishes neither present availability nor purchasing authority.' });
  }
  const proposal = snapshotAccountIntelligenceProposal({ ...previous, establishedContext: [...previous.establishedContext, ...facts],
    sourceAndEntityBoundaries: [...previous.sourceAndEntityBoundaries, ...(!previous.sourceAndEntityBoundaries.some(item => item.entityId === entity.entityId) ? [{ entityId: entity.entityId, boundary: entity.relationshipToAccount }] : [])],
    riskConflictFlags: flags, researchCoverage: systemOwnedResearchCoverage(sources), materialGaps: systemOwnedMaterialGaps(sources), reviewStatus: 'needs_review' }, request, sources);
  const selectedEvidenceId = fresh.excerpts.find(item => item.exactExcerptSha256 === selected.sha256)!.evidenceId;
  const context: C3AccountContext = { ...(base.context as C3AccountContext), account: { ...base.context.account, requestedAt: run.updatedAt },
    admittedSources: sources, proposal, materialGaps: proposal.materialGaps,
    directResearch: { kind: 'validated-direct-source-proposal', baseContextCanonicalJson: base.canonicalJson, run,
      sourceId, passageSha256, acquisition, selectedEvidenceId, findingIds: facts.map(item => item.statementId), humanApproved: false },
    relevanceCandidates: [{ sourceId: fresh.sourceId, evidenceId: selectedEvidenceId, reasons: ['Explicitly selected fresh documentary evidence for this targeted proposal'] }, ...base.context.relevanceCandidates],
    rendererAnnotations: [...base.context.rendererAnnotations, { kind: 'freshness_recheck', sourceId: fresh.sourceId,
      evidenceIds: fresh.excerpts.map(item => item.evidenceId), text: 'New direct-source admission; agent-proposed, not owner approved. Publication/event/current-through dates remain unestablished. Dates in page text are not automatically publication dates. Conditional statements do not establish present service availability.' }],
  };
  const canonical = canonicalJson(context);
  return Object.freeze({ context: researchJson(context), canonicalJson: canonical, sha256: researchHash(canonical) });
}
/** Rebuild derived admission when saving/reopening. Checksums alone are insufficient. */
export function validateResearchIntelligence(context: FrozenC3ViewContext, principal?: string): void {
  const lineage = context.context.directResearch;
  if (!lineage) return;
  const baseContext = JSON.parse(lineage.baseContextCanonicalJson) as C3AccountContext;
  const base = { context: baseContext, canonicalJson: lineage.baseContextCanonicalJson, sha256: researchHash(lineage.baseContextCanonicalJson) };
  const expected = admitResearchIntelligence(base, lineage.run, lineage.sourceId, lineage.passageSha256,
    { accountId: context.context.account.accountId, principal: principal ?? lineage.run.principal });
  if (canonicalJson(context.context) !== expected.canonicalJson || context.canonicalJson !== expected.canonicalJson || context.sha256 !== expected.sha256) throw Error('Derived intelligence lineage mismatch');
}
