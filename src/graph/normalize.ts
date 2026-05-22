// Deterministic text normalisation for excerpt-vs-source matching.
//
// The normaliser is intentionally conservative: it folds whitespace and
// case, removes a small set of typographic quotes/dashes, and trims. It
// does NOT remove punctuation, stem words, or do any semantic rewriting,
// because paraphrases must remain detectably different from literal
// excerpts.

const QUOTE_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "′": "'",
  "″": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  " ": " ",
};

export function normalizeText(input: string): string {
  let out = "";
  for (const ch of input) {
    out += QUOTE_MAP[ch] ?? ch;
  }
  return out
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sourceContainsExcerpt(
  sourceText: string,
  excerptText: string,
): boolean {
  const src = normalizeText(sourceText);
  const exc = normalizeText(excerptText);
  if (exc.length === 0) return false;
  return src.includes(exc);
}
