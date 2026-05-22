// ID format and prefix rules for Atliera Graph records.
//
// Every record kind gets a stable prefix so a stray reference is
// recognisable as that kind. Validators use the prefix list to detect
// references that target a different kind than the field expects.

export const ID_PREFIXES = {
  source_document: "src",
  evidence_excerpt: "exc",
  claim: "clm",
  claim_evidence: "cev",
  account_object: "obj",
  account_object_claim: "oclm",
  research_run: "run",
  run_artifact: "art",
  audit_event: "aud",
} as const;

export type RecordKind = keyof typeof ID_PREFIXES;

// IDs look like `<prefix>_<token>` where token is lowercase
// alphanumerics + dashes/underscores. The format check is intentionally
// strict so that obviously hallucinated identifiers (whitespace,
// punctuation, free-form prose) fail loudly.
const ID_PATTERN = /^[a-z]+_[a-z0-9][a-z0-9_-]{0,63}$/;

export function isWellFormedId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}

export function idPrefix(id: string): string | null {
  const i = id.indexOf("_");
  if (i <= 0) return null;
  return id.slice(0, i);
}

export function idHasPrefix(id: string, kind: RecordKind): boolean {
  return isWellFormedId(id) && idPrefix(id) === ID_PREFIXES[kind];
}
