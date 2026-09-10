import type { C3GenerationRecord } from './generation-contract.ts';

/** Presentation only. Never changes acceptance, retained bytes or historical outcomes. */
export function generationRefusalNotice(record: C3GenerationRecord): string {
  const kind = record.refusal && 'failureKind' in record.refusal ? record.refusal.failureKind : undefined;
  const label = kind === 'structural' ? 'Draft format rejected' :
    kind === 'verifier_format' ? 'Evidence-check format rejected' :
    kind === 'semantic_refusal' ? 'Evidence check refused this proposal' :
    kind === 'verifier_transport' ? 'Evidence-check transport failed' : 'Candidate refused';
  return `${label}. ${record.refusal?.message ?? 'The candidate was not accepted.'} Original retained without repair.`;
}
