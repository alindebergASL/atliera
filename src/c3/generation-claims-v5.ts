/** V4 discourse checks. Citation integrity is deterministic; paraphrase entailment still needs
 * content review. An attribution is related context, never upgraded to direct semantic proof. */
const LIMIT = /\b(?:unknown|unclear|not established|not known|insufficient|remains? (?:open|to be learned|unverified)|cannot establish|(?:does|do) not establish)\b|^no supplied source establishes\b(?!\s+(?:only|not only|no longer)\b)/iu;
const TENTATIVE = /\b(?:may|might|could|suggests?|appears?|hypothesis|potential|possible|tentative(?:ly)?|worth (?:asking|clarifying|exploring)|to explore)\b/iu;
const ATTRIBUTION = /^(?:the\s+)?(?:cited\s+|supplied\s+|selected\s+)?(?:sources?|reports?|evidence)\s+(?:describe[sd]?|reports?|states?|says?|indicates?|identif(?:y|ies)|list[sd]?|names?)\b|^according to (?:the |a )?(?:cited |supplied )?(?:source|report)\b/iu;
const ACTION = /^(?:optional probe:\s*)?(?:(?:if|when)\b[^;.!?]*,\s*)?(?:(?:i|we)\s+(?:(?:would like|want|aim|hope)\s+to\s+|recommend\s+)|(?:i|we)(?:'|’)d\s+like\s+to\s+|(?:(?:the|a|an)\s+)?[\w’-]+\s+(?:can|could|should|would)\s+|my aim is to\s+|our aim is to\s+|let(?:'|’)s\s+)?(?:ask|learn|understand|explore|confirm|clarify|identify|discuss|consider|determine|agree|conclude|establish|validate|check|invite|distinguish|avoid|keep|use|focus|prioritize|start|end|close|test|recognize|find|decide|leave|make|do not assume)\b/iu;
const INQUIRY = /^(?:(?:could|would|can|should)\s+(?:we|you)\b|(?:which|what|whether|how|who|when)\b)|\b(?:can|could)\s+(?:clarify|confirm|explain|identify)\s+(?:whether|which|what|how)\b/iu;
// Status/commercial assertions need exact source support; mere 'may' or 'sources say' is not enough.
const STATUS = /\b(?:has|have|had|is|are|was|were|now|already|currently)\s+(?:(?:a|an|the|new|actively|successfully)\s+)*(?:launched|deployed|deploying|piloting|operational|live|complete[ds]?|replacing|purchasing|buying)\b|\b(?:launched|deployed|operates?)\s+(?:(?:a|an|the|new|replacement)\s+)*(?:pilot|system|platform|program)\b|\b(?:urgently needs?|binding constraint is|is (?:now )?the binding constraint)\b/iu;
const DEFINITE_PREDICATE = /\b(?:is|are|has|have|had|was|were|will|operates?|runs?|deployed|launched|needs?|requires?|owns?|leads?|manages?|remains?|approved|selected|purchased)\b/iu;
const ASSERTIVE_HEAD = String.raw`(?:the|this|that|it|they|we|you|[A-Z][\w’-]*)\s+(?:[\w’-]+\s+){0,5}(?:is|are|has|have|had|was|were|will|operates?|deployed|launched|needs?|requires?|owns?|leads?|manages?)\b`;
const CLAUSE_BOUNDARY = new RegExp(String.raw`\s*[;:]\s*|,\s*(?=which\s+(?:may|might|could|can|[A-Z]|the|this|it)\b)|\s+and\s+(?=(?:(?:this|it|that)\s+)?(?:may|might|could|can)\b)|\s*\b(?:but|however|yet|whereas|because|although|while)\b\s*|,\s*(?=${ASSERTIVE_HEAD})|,?\s+(?:and|so|since|which)\s+(?=${ASSERTIVE_HEAD})`, 'u');

function mainPredicate(clause: string): RegExpMatchArray | undefined {
  for (const match of clause.matchAll(new RegExp(DEFINITE_PREDICATE.source, 'giu'))) {
    // A participle immediately after an article modifies a noun ('the selected
    // plans'); it is not the finite predicate ('Harbor selected the plans').
    // Status and commercial presuppositions are still checked on the complete text.
    if (/^(?:deployed|launched|approved|selected|purchased)$/iu.test(match[0]) &&
        /\b(?:the|a|an)\s+$/iu.test(clause.slice(0, match.index))) continue;
    if (/^own$/iu.test(match[0]) && /(?:\b(?:my|our|your|their|its|his|her)|[\w]+(?:['’]s|s['’]))\s+$/iu
      .test(clause.slice(0, match.index))) continue;
    return match;
  }
  return undefined;
}

function sharedNamedSubject(prefix: string, rest: string): boolean {
  // A conjunction inside a named subject precedes its shared plural predicate.
  // Only preserve this bounded nominal form, not a completed inquiry followed by
  // a second proposition. Work inside the governing inquiry, if there is one.
  const subject = prefix.split(/\b(?:whether|if|which|what|how|who|when)\s+/iu).at(-1)!.trim();
  const namedSubject = /(?<!\S)(?:[A-Z][\w’-]*(?:\s+|$))+(?:(?:plans?|sources?|reports?|excerpts?)\s*)?$/u.exec(subject);
  if (!namedSubject) return false;
  // The lead must itself be nominal, not merely lack a verb from our bounded
  // predicate list. This prevents 'participants support Cedar ... and Harbor
  // plans are operational' from borrowing the earlier inquiry's scope.
  const nominalLead = /^(?:(?:(?:(?:publication|event|current-through)(?:,\s*(?:and\s+)?|\s+and\s+|\s+))*dates|coverage limits)\s+(?:for|of)\s+)?(?:(?:the|a|an)\s+)?(?:(?:reported|planned|selected|cited|supplied)\s+)?$/iu;
  const sharedPredicate = /^(?:(?:the|a|an)\s+)?(?:[A-Z][\w’-]*\s+)+(?:(?:plans?|sources?|reports?|excerpts?)\s+)?(?:are|have)\b/u;
  return nominalLead.test(subject.slice(0, namedSubject.index)) && sharedPredicate.test(rest);
}

function sharedNegativeNominals(prefix: string, rest: string): boolean {
  // Only noun alternatives before a shared copula inherit this negative scope.
  // A complete left proposition or a multiword action on the right must split.
  const negative = /\b(?:without assuming|rather than assume)\s+/giu;
  const scope = [...prefix.matchAll(negative)].at(-1);
  if (!scope) return false;
  const left = prefix.slice(scope.index! + scope[0].length).trim();
  const predicate = mainPredicate(rest);
  if (!predicate || !/^(?:is|are)$/iu.test(predicate[0])) return false;
  const nominalList = (value: string): boolean => value.split(/,\s*(?:(?:and|or)\s+)?|\s+(?:and|or)\s+/u)
    .every(item => {
      const noun = item.trim();
      // Bare lexical heads (including gerund nouns) or proper-name sequences,
      // optionally determined; not arbitrary lowercase verb/adverb phrases.
      return !ACTION.test(noun) && !mainPredicate(noun) &&
        /^(?:(?:the|a|an)\s+)?(?:[a-z][\w’-]*|[A-Z][\w’-]*(?:\s+[A-Z][\w’-]*)*)$/u.test(noun);
    });
  return nominalList(left) && nominalList(rest.slice(0, predicate.index));
}

function splitClauses(sentence: string): string[] {
  const result: string[] = []; let start = 0;
  for (const match of sentence.matchAll(new RegExp(CLAUSE_BOUNDARY.source, 'gu'))) {
    const prefix = sentence.slice(start, match.index);
    const end = match.index! + match[0].length;
    if (match[0].trim() === 'and' && (sharedNamedSubject(prefix, sentence.slice(end)) ||
        sharedNegativeNominals(prefix, sentence.slice(end)))) continue;
    result.push(prefix); start = end;
  }
  result.push(sentence.slice(start));
  return result;
}

function units(value: string): string[] {
  // Split assertions even after lowercase sentences, colons, comma splices and conjunctions.
  // An optional-probe label carries no epistemic scope of its own.
  return value.replace(/\bOptional probe:\s*/gu, '').split(/(?<=[.!?])\s+/u)
    .flatMap(splitClauses)
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
  const predicate = mainPredicate(clause);
  if (!predicate || qualification < predicate.index!) return true;
  // A copular uncertainty predicate qualifies its own subject; a later modifier of
  // another noun ('owns the platform with unknown priorities') does not.
  return /^(?:is|are|was|were|remains?)\s+(?:(?:a|an|still)\s+)?(?:possible|potential|tentative|unknown|unclear|open|unverified|to be learned|not (?:established|known)|insufficient|worth (?:asking|clarifying|exploring))\b/iu
    .test(clause.slice(predicate.index));
}

// Scope is bounded by coordination, not by recognizing the next verb's spelling.
// Infinitives, participles and intervening adverbs therefore cannot carry an
// earlier inquiry into an affirmative complement. Preserve shared named nouns.
const COORDINATION_BOUNDARY = /,?\s+(?:and(?:\s+then)?|or|then)\s+/giu;

function assertActionComplement(clause: string, path: string): void {
  const governingAction = ACTION.exec(clause);
  if (!governingAction) return;
  const complements: string[] = []; let start = 0;
  for (const boundary of clause.matchAll(COORDINATION_BOUNDARY)) {
    if (boundary.index! < governingAction[0].length) continue;
    const end = boundary.index! + boundary[0].length;
    const prefix = clause.slice(start, boundary.index);
    if (sharedNamedSubject(prefix, clause.slice(end)) ||
        /^,?\s*(?:and|or)\s*$/iu.test(boundary[0]) && sharedNegativeNominals(prefix, clause.slice(end))) continue;
    complements.push(prefix); start = end;
  }
  complements.push(clause.slice(start));
  for (const complement of complements) {
    // Both current status and ordinary predicates use the same local scope.
    assertScopedStatus(complement, path);
    assertSingleActionComplement(complement, governingAction[0], path);
  }
}

function assertSingleActionComplement(complement: string, governingAction: string, path: string): void {
  const localAction = ACTION.exec(complement.trim());
  const action = localAction?.[0] ?? '';
  if (localAction) complement = complement.trim().slice(localAction[0].length);
  const predicate = mainPredicate(complement);
  if (!predicate) return;
  // An inquiry licenses its own unresolved proposition. An affirmative complement
  // ('confirm [that] Harbor owns...') does not become supported just by being asked.
  if (/\b(?:whether|if|which|what|how|who|when)\b/iu.test(complement.slice(0, predicate.index))) return;
  if (/\b(?:without assuming|rather than assume)\b/iu.test(complement.slice(0, predicate.index)) ||
      /\bdo not assume$/iu.test(action)) return;
  // A proposed conclusion of no follow-up is a meeting outcome, not an account fact.
  if (/\b(?:agree|conclude|close|leave|end)\b/iu.test(action || governingAction) &&
      /^is\s+(?:warranted|useful|needed)[.!]?$/iu.test(complement.slice(predicate.index)) &&
      /\b(?:that\s+)?no follow-up\s+$/iu.test(complement.slice(0, predicate.index))) return;
  throw new Error(`${path} action must not embed an unqualified account assertion`);
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
    assertActionComplement(clause, path);
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
  'GENERATION CONTRACT 4 — applies identically to initial and revised output. Select supportCategory by the actual claims, not by section style. Each independent assertion needs its own support or uncertainty; a hedge, citation, invitation, or unknown elsewhere does not qualify it.',
  'Invitations may use a first-person contraction or an actor with a modal, followed by a learning or verification action. Keep coordinated plan/source names inside their governing inquiry or shared date-limit predicate. A close may propose a useful next step or a conclusion of no follow-up. These actions do not license affirmative account assertions in their complements: ask whether a condition holds, rather than instructing someone to confirm it as fact.',
  'direct_support: the entire text equals one cited exactExcerpt byte-for-byte. Quotation marks inside any other category claim verbatim source wording and must copy a contiguous part of a cited exactExcerpt exactly. Do not invent quotes or cite unrelated evidence.',
  'cautious_inference: related-evidence framing, not direct semantic proof. Each claim must be a locally tentative implication, an explicitly source-attributed report faithful to the cited excerpt, an evidence limit, or a non-presumptive invitation/action. Keep reported plans, roles, dates and entity boundaries as reported; source attribution does not establish current status. A natural source-backed opening can combine an attributed planned role with an invitation to confirm relevance without putting a hedge in every sentence.',
  'recommendation: an action or invitation to consider. It must not assert an account condition to justify that action. unknown: identify the actual evidence limit; do not append an unrelated positive assertion. open_question: an actual question and learning goal, with no assumed incident, purchase, current status, priority or dependency. A question mark does not undo a factual presupposition.',
  'Positive examples (use only with genuinely matching cited evidence): cautious_inference: "The source describes planned platform work; could we explore whether that still matters to your chosen outcome?"; "This planned work may be a useful topic to confirm." recommendation: "Ask which outcome matters now and whether any next step is useful." unknown: "Current ownership is not established by the source." direct_support: copy one exactExcerpt as the entire text, without a paraphrase or conversational addition.',
  'Negative examples, including in revisions: "This may matter. The rollout is complete."; "Ask about priorities because the account has launched a pilot."; "Ownership is unknown; the account urgently needs a replacement."; "The sources report an approved purchasing budget." These are unsupported assertions even if another clause is tentative or cites a source. High-risk incidents, vendor relationships, approvals and commercial availability still require whole-field direct_support. Never repair these by merely adding a hedge or changing their category.',
  'Revision instructions change the proposed meeting plan only. Apply the same support rules to every retained and changed claim. A revised meeting draft is not a new account-research revision and does not by itself establish change_against_prior_revision.',
].join('\n\n');
