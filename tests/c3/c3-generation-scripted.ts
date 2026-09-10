import type { C3VerificationRequest } from '../../src/c3/generation-contract.ts';

/** Scripted transport fixture only. It does NOT evaluate whether text follows from evidence. */
export function scriptedFullCoverage(check: C3VerificationRequest): string {
  if (check.schemaVersion !== '1' && check.schemaVersion !== '2') throw new Error('Unknown scripted verification schema');
  const fields = JSON.parse(check.prompt.split('DISPLAY FIELDS\n')[1]!.split('\n\nCOMPLETE ORIGINAL')[0]!);
  return JSON.stringify({ kind: 'atliera.c3.evidence-verification', schemaVersion: check.schemaVersion,
    contextSha256: check.contextSha256, modelRequestSha256: check.modelRequestSha256, rawResponseSha256: check.rawResponseSha256,
    findings: fields.map((field: any) => ({ ...field, ...(check.schemaVersion === '1' ? { start: 0, end: field.text.length } : {}), kind: 'non_assertion',
      entityScope: 'Fixture only', dateScope: 'Fixture only', modality: 'Fixture only', verdict: 'supported', reason: 'Scripted plumbing fixture; no semantic judgment.' })) });
}
