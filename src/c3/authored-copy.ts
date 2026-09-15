/** User-authored meeting copy: an OPTIONAL value object beside immutable generation records.
 *  Authored copy is never model output, never an approval, and never rewrites stored history. */

import type { FrozenC3ViewContext } from './view-context.ts';

export interface AuthoredQuestion {
  readonly question: string;
  readonly probe?: string;
}

export interface AuthoredMeetingCopy {
  /** Always 'user-authored'; there is deliberately no approved bit. */
  readonly provenance: 'user-authored';
  /** Record this copy was authored against; retained for explicit review after a revision. */
  readonly priorRecordId: string;
  readonly title: string;
  readonly audience: string;
  /** Human phrase like '15 minutes'; display-only, not a meeting request field. */
  readonly duration: string;
  readonly purpose: string;
  readonly facts: readonly string[];
  readonly interpretation: string;
  readonly opening: string;
  readonly questions: readonly AuthoredQuestion[];
  readonly close: string;
  readonly uncertainty: string;
  /** Evidence IDs from the work context only; never fabricated. */
  readonly selectedEvidenceRefs: readonly string[];
}

const LINE = (value: unknown, path: string, max: number, min = 1): string => {
  if (typeof value !== 'string' || value.length < min || value.length > max || value.trim() !== value ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || /[\r\n]/u.test(value)) throw Error(`${path} must be bounded single-line text`);
  return value;
};
const BLOCK = (value: unknown, path: string, max: number, min = 3): string => {
  if (typeof value !== 'string' || value.length < min || value.length > max || value.trim() !== value ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw Error(`${path} must be bounded safe text`);
  return value;
};

/** Exact permitted keys and bounded types; evidence refs must exist in the work context. */
export function validateAuthoredMeetingCopy(value: unknown, context: FrozenC3ViewContext, currentRecordId: string): AuthoredMeetingCopy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Authored copy must be an object');
  const root = value as Record<string, unknown>;
  const keys = Object.keys(root).sort().join(',');
  if (keys !== 'audience,close,duration,facts,interpretation,opening,priorRecordId,provenance,purpose,questions,selectedEvidenceRefs,title,uncertainty') {
    throw Error('Authored copy has unexpected or missing fields');
  }
  if (root.provenance !== 'user-authored') throw Error('Authored copy must declare provenance user-authored');
  if (root.priorRecordId !== currentRecordId) throw Error('Authored copy is bound to a different generation record');
  if (!/^c3_[a-f0-9]{24}$/u.test(String(root.priorRecordId))) throw Error('Authored copy record binding is invalid');
  const facts = root.facts;
  if (!Array.isArray(facts) || facts.length > 3) throw Error('Authored copy permits up to three facts');
  const questions = root.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 3) throw Error('Authored copy needs one to three questions');
  const known = new Set(context.context.admittedSources.flatMap(source => source.excerpts.map(excerpt => excerpt.evidenceId)));
  const refs = root.selectedEvidenceRefs;
  if (!Array.isArray(refs) || refs.length > 12 || new Set(refs).size !== refs.length ||
    refs.some(id => typeof id !== 'string' || !known.has(id))) throw Error('Authored copy selected evidence must be retained in this work context');
  const copy: AuthoredMeetingCopy = {
    provenance: 'user-authored',
    priorRecordId: root.priorRecordId,
    title: LINE(root.title, 'authoredCopy.title', 160),
    audience: LINE(root.audience, 'authoredCopy.audience', 160),
    duration: LINE(root.duration, 'authoredCopy.duration', 40),
    purpose: BLOCK(root.purpose, 'authoredCopy.purpose', 1200),
    facts: facts.map((item, index) => BLOCK(item, `authoredCopy.facts[${String(index)}]`, 1200)),
    interpretation: BLOCK(root.interpretation, 'authoredCopy.interpretation', 1200),
    opening: BLOCK(root.opening, 'authoredCopy.opening', 1200),
    questions: questions.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error(`authoredCopy.questions[${String(index)}] must be an object`);
      const question = item as Record<string, unknown>;
      const questionKeys = Object.keys(question).sort().join(',');
      if (questionKeys !== 'probe,question' && questionKeys !== 'question') throw Error(`authoredCopy.questions[${String(index)}] has unexpected fields`);
      return { question: BLOCK(question.question, `authoredCopy.questions[${String(index)}].question`, 600),
        ...(question.probe !== undefined ? { probe: BLOCK(question.probe, `authoredCopy.questions[${String(index)}].probe`, 600) } : {}) };
    }),
    close: BLOCK(root.close, 'authoredCopy.close', 1200),
    uncertainty: BLOCK(root.uncertainty, 'authoredCopy.uncertainty', 1200),
    selectedEvidenceRefs: [...refs] as readonly string[],
  };
  return copy;
}

export function sameAuthoredCopy(left: unknown, right: unknown): boolean {
  return canonicalish(left) === canonicalish(right);
}
function canonicalish(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : item);
}
