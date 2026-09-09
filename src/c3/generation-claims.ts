/** V3 discourse checks. Citation integrity is deterministic; paraphrase entailment still needs
 * content review. An attribution is related context, never upgraded to direct semantic proof. */
const LIMIT = /\b(?:unknown|unclear|not established|not known|insufficient|remains? (?:open|to be learned|unverified)|cannot establish|(?:does|do) not establish)\b|^no supplied source establishes\b(?!\s+(?:only|not only|no longer)\b)/iu;
const TENTATIVE = /\b(?:may|might|could|suggests?|appears?|hypothesis|potential|possible|tentative(?:ly)?|worth (?:asking|clarifying|exploring)|to explore)\b/iu;
const ATTRIBUTION = /^(?:the\s+)?(?:cited\s+|supplied\s+|selected\s+)?(?:sources?|reports?|evidence)\s+(?:describe[sd]?|reports?|states?|says?|indicates?|identif(?:y|ies)|list[sd]?|names?)\b|^according to (?:the |a )?(?:cited |supplied )?(?:source|report)\b/iu;
const ACTION = /^(?:optional probe:\s*)?(?:(?:if|when)\b[^;.!?]*,\s*)?(?:(?:i|we)\s+(?:(?:would like|want|aim|hope)\s+to\s+|recommend\s+)|my aim is to\s+|our aim is to\s+|let(?:'|’)s\s+)?(?:ask|learn|understand|explore|confirm|clarify|identify|discuss|consider|determine|agree|conclude|establish|validate|check|invite|distinguish|avoid|keep|use|focus|prioritize|start|end|test|recognize|find|decide|leave|make|do not assume)\b/iu;
const INQUIRY = /^(?:(?:could|would|can|should)\s+(?:we|you)\b|(?:which|what|whether|how|who|when)\b)|\b(?:can|could)\s+(?:clarify|confirm|explain|identify)\s+(?:whether|which|what|how)\b/iu;
// Status/commercial assertions need exact source support; mere 'may' or 'sources say' is not enough.
const STATUS = /\b(?:has|have|had|is|are|was|were|now|already|currently)\s+(?:(?:a|an|the|new|actively|successfully)\s+)*(?:launched|deployed|deploying|piloting|operational|live|complete[ds]?|replacing|purchasing|buying)\b|\b(?:launched|deployed|operates?)\s+(?:(?:a|an|the|new|replacement)\s+)*(?:pilot|system|platform|program)\b|\b(?:urgently needs?|binding constraint is|is (?:now )?the binding constraint)\b/iu;
const DEFINITE_PREDICATE = /\b(?:is|are|has|have|had|was|were|will|operates?|runs?|deployed|launched|needs?|requires?|owns?|leads?|manages?|remains?|approved|selected|purchased)\b/iu;
const ASSERTIVE_HEAD = String.raw`(?:the|this|that|it|they|we|you|[A-Z][\w’-]*)\s+(?:[\w’-]+\s+){0,5}(?:is|are|has|have|had|was|were|will|operates?|deployed|launched|needs?|requires?|owns?|leads?|manages?)\b`;
const CLAUSE_BOUNDARY = new RegExp(String.raw`\s*[;:]\s*|,\s*(?=which\s+(?:may|might|could|can|[A-Z]|the|this|it)\b)|\s+and\s+(?=(?:(?:this|it|that)\s+)?(?:may|might|could|can)\b)|\s*\b(?:but|however|yet|whereas|because|although|while)\b\s*|,\s*(?=${ASSERTIVE_HEAD})|,?\s+(?:and|so|since|which)\s+(?=${ASSERTIVE_HEAD})`, 'u');

function units(value: string): string[] {
  // Split assertions even after lowercase sentences, colons, comma splices and conjunctions.
  // An optional-probe label carries no epistemic scope of its own.
  return value.replace(/\bOptional probe:\s*/gu, '').split(/(?<=[.!?])\s+/u)
    .flatMap(sentence => sentence.split(CLAUSE_BOUNDARY))
    .flatMap(clause => {
      const result: string[] = []; let start = 0;
      for (const match of clause.matchAll(new RegExp(String.raw`\s+that\s+(?=${ASSERTIVE_HEAD})`, 'gu'))) {
        const prefix = clause.slice(start, match.index);
        // Report/hypothesis complements inherit their governing predicate; relative
        // additions to a reported object do not automatically inherit its support.
        if (/(?:reports?|states?|says?|indicates?|suggests?|(?:is|are) (?:possible|unknown|unclear)|(?:may|might|could) be)\s*$/iu.test(prefix)) continue;
        result.push(prefix); start = match.index! + match[0].length;
      }
      result.push(clause.slice(start)); return result;
    })
    .map(clause => clause.trim()).filter(Boolean);
}

function maskExactQuotes(value: string, excerpts: readonly string[], path: string): string {
  // Double quotes are claimed verbatim source speech. Single quotes also serve apostrophes/labels.
  return value.replace(/"([^"\n]+)"|“([^”\n]+)”/gu, (_whole, straight: string | undefined, curly: string | undefined) => {
    const quote = straight ?? curly!;
    if (!excerpts.some(excerpt => excerpt.includes(quote))) throw new Error(`${path} quotation must match cited evidence exactly`);
    return 'quoted evidence';
  });
}

function assertScopedStatus(clause: string, path: string): void {
  if (!STATUS.test(clause)) return;
  // Only an actual scope of uncertainty/inquiry, never a hedge about relevance, excuses status mention.
  const status = clause.search(STATUS);
  const before = clause.slice(0, status);
  if (/\b(?:whether|if)\b[^.!?;]*$/iu.test(before) || LIMIT.test(clause) &&
      /\b(?:unknown whether|not established whether|do not establish|does not establish)\b/iu.test(clause)) return;
  throw new Error(`${path} introduces an unsupported current-status or priority assertion`);
}

function scopesMainPredicate(clause: string, qualifier: RegExp): boolean {
  const qualification = clause.search(qualifier);
  if (qualification < 0) return false;
  const predicate = DEFINITE_PREDICATE.exec(clause);
  if (!predicate || qualification < predicate.index) return true;
  // A copular uncertainty predicate qualifies its own subject; a later modifier of
  // another noun ('owns the platform with unknown priorities') does not.
  return /^(?:is|are|was|were|remains?)\s+(?:(?:a|an|still)\s+)?(?:possible|potential|tentative|unknown|unclear|open|unverified|to be learned|not (?:established|known)|insufficient|worth (?:asking|clarifying|exploring))\b/iu
    .test(clause.slice(predicate.index));
}

export function assertC3ClaimSupport(value: string, category: 'direct_support' | 'cautious_inference' | 'recommendation' | 'open_question' | 'unknown',
  excerpts: readonly string[], path: string): void {
  if (category === 'direct_support') return; // Whole-field exactness is checked by the enclosing validator.
  const masked = maskExactQuotes(value, excerpts, path);
  const claims = units(masked);
  if (category === 'unknown' && !claims.some(clause => scopesMainPredicate(clause, LIMIT))) {
    throw new Error(`${path} unknown must explicitly identify an unknown or limit`);
  }
  for (const clause of claims) {
    assertScopedStatus(clause, path);
    const attributed = excerpts.length > 0 && ATTRIBUTION.test(clause);
    const tentative = scopesMainPredicate(clause, TENTATIVE);
    const limited = scopesMainPredicate(clause, LIMIT);
    const action = ACTION.test(clause);
    const inquiry = INQUIRY.test(clause) || /^(?:testing|asking|learning|confirming|clarifying|exploring)\s+(?:whether|which|what|how|who)\b/iu.test(clause) || /^(?:for|given|with)\b[^;.!?]*,\s*(?:which|what|who|how)\b/iu.test(clause);
    const quoted = clause === 'quoted evidence' || /^(?:(?:the )?(?:source|report) (?:says|states|reports):?\s*)?quoted evidence[.!]?$/iu.test(clause);
    if (category === 'cautious_inference') {
      if (!attributed && !tentative && !limited && !action && !inquiry && !quoted) {
        throw new Error(`${path} cautious_inference requires scoped caution, source attribution, or an invitation in each claim`);
      }
    } else if (category === 'unknown') {
      if (!limited && !action && !inquiry && !attributed && !quoted) {
        throw new Error(`${path} unknown must explicitly identify a limit in each asserted claim`);
      }
    } else if (category === 'recommendation' && (attributed || quoted) && !action && !inquiry) {
      throw new Error(`${path} recommendation must be an action, not a source report; use related-context framing`);
    } else if (!action && !inquiry && !limited && !attributed && !quoted && DEFINITE_PREDICATE.test(clause)) {
      throw new Error(`${path} ${category} must not assert an unqualified account fact`);
    }
    // A contextual prefix is not caution over a later account proposition.
    if (/^(?:as|for)\s+(?:possible|potential|tentative)\s+[^,]+,/iu.test(clause)) {
      const claim = clause.slice(clause.indexOf(',') + 1);
      if (DEFINITE_PREDICATE.test(claim) && !ATTRIBUTION.test(claim.trim()) && !TENTATIVE.test(claim)) {
        throw new Error(`${path} contextual hedge does not qualify the account claim`);
      }
    }
  }
}

export const C3_CLAIM_CONTRACT_INSTRUCTIONS = [
  'GENERATION CONTRACT 3 — applies identically to initial and revised output. Select supportCategory by the actual claims, not by section style. Each independent assertion needs its own support or uncertainty; a hedge, citation, invitation, or unknown elsewhere does not qualify it.',
  'direct_support: the entire text equals one cited exactExcerpt byte-for-byte. Quotation marks inside any other category claim verbatim source wording and must copy a contiguous part of a cited exactExcerpt exactly. Do not invent quotes or cite unrelated evidence.',
  'cautious_inference: related-evidence framing, not direct semantic proof. Each claim must be a locally tentative implication, an explicitly source-attributed report faithful to the cited excerpt, an evidence limit, or a non-presumptive invitation/action. Keep reported plans, roles, dates and entity boundaries as reported; source attribution does not establish current status. A natural source-backed opening can combine an attributed planned role with an invitation to confirm relevance without putting a hedge in every sentence.',
  'recommendation: an action or invitation to consider. It must not assert an account condition to justify that action. unknown: identify the actual evidence limit; do not append an unrelated positive assertion. open_question: an actual question and learning goal, with no assumed incident, purchase, current status, priority or dependency. A question mark does not undo a factual presupposition.',
  'Positive examples (use only with genuinely matching cited evidence): cautious_inference: "The source describes planned platform work; could we explore whether that still matters to your chosen outcome?"; "This planned work may be a useful topic to confirm." recommendation: "Ask which outcome matters now and whether any next step is useful." unknown: "Current ownership is not established by the source." direct_support: copy one exactExcerpt as the entire text, without a paraphrase or conversational addition.',
  'Negative examples, including in revisions: "This may matter. The rollout is complete."; "Ask about priorities because the account has launched a pilot."; "Ownership is unknown; the account urgently needs a replacement."; "The sources report an approved purchasing budget." These are unsupported assertions even if another clause is tentative or cites a source. High-risk incidents, vendor relationships, approvals and commercial availability still require whole-field direct_support. Never repair these by merely adding a hedge or changing their category.',
  'Revision instructions change the proposed meeting plan only. Apply the same support rules to every retained and changed claim. A revised meeting draft is not a new account-research revision and does not by itself establish change_against_prior_revision.',
].join('\n\n');
