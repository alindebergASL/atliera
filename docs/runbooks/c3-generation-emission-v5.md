# C3 future generation emission v5

V5 changes future prompt composition to use a small set of readable sentence forms under the existing v4 recognizer. It adds no response rewriting, JSON repair, provider execution, retry, admission rule or validation authority. This is a no-call implementation, not evidence of a successful fresh model response, readiness, human review or customer acceptance.

The forms use generic source-attribution leads, local tentative relevance, compact inquiries, separate organizational uncertainty assertions, source-led financial limits and conditional probes. Names, reported roles, technical source detail and relevance stay in the supported content with matching citations and remain visible in the thesis, opening and main questions. Owner content priorities and the requested outcome still guide selection. Forms are not canned account facts: every claim must remain faithful to the evidence, including source scope and unknown currentness.

New requests explicitly select generation contract `5`. Missing markers still mean `2`; explicit `2`, `3` and `4` reconstruct their own requests. The frozen v4 contract comes from `094b0ea1340b1fdf1fea57b92fdbff89708c6050`, with only the claims import redirected to its byte-identical frozen module. The pre-edit synthetic [v4 fixture](../../tests/fixtures/c3-v4-contract.json) captures initial/revised requests, outcomes, refusal and work-file bytes. Existing v2/v3 fixtures and frozen implementations remain unchanged. No historical response is reclassified by v5 prompt guidance.

Seven contract boundaries remain fixed:

1. Request schema and version-bound canonical identity, reconstruction and replay; no hash forgiveness.
2. Exact raw response, response hash, outcome, record identity and revision ancestry; no post-receipt repair.
3. Evidence eligibility, exact citation sets, quoted-excerpt equality and whole-field direct support.
4. Per-claim support categories and unchanged commercial, status and speech-act checks; attribution is not semantic entailment.
5. Source entity/role scope and temporal meaning; a meeting revision is not an account revision, and publication dates are not event dates.
6. Outcome/owner-priority selection, natural substantive anchors, exactly three main questions and one or two conditional probes for 15 minutes. These remain prompt obligations; the bounded validator does not certify all product-quality obligations.
7. Proposed/unreviewed content, notes/history/persistence and approval meanings, plus existing routing, models, budgets and effect permissions. This milestone grants no new effect or call authority.

The [emission tests](../../tests/c3/c3-generation-emission.test.ts) use authored synthetic sources and complete candidates, not model recordings. Paired controls exercise supported prose and categorical usefulness, status upgrades, commercial presuppositions, independent assertions, quote/reference mismatch and missing/unknown citations through the real validator. Each mutation is tested in a complete candidate so fail-fast cannot hide another field's failure. Initial and revision paths retain exact raw bytes. Compatibility tests retain old notes, recovery and applied history. Synthetic success demonstrates these examples' deterministic compatibility only; it neither proves arbitrary paraphrase entailment nor predicts model adherence. The [coherent-workspace partial status](../status/coherent-workspace-partial-20260909.md) records the controller-reported historical replay and fresh-generation limits separately.

## Closure: recognizer limits and preserved v5

Lexical tuning is closed for this sprint. The finite lexical recognizer has both false refusals and unsupported assertion acceptance gaps. The reviewer HOLD concerns consequential assertion-contract scope; it is not a request for more synonyms. A future assertion-contract decision must explain how claim boundaries, attribution and uncertainty scope are represented and checked against every displayed clause. Model-authored categories or spans alone do not establish that check, and no blanket natural-language entailment safety is claimed.

These are authored synthetic reproductions through complete INITIAL and REVISION validation, not copies of private provider responses:

| Failure class | Synthetic refusal / recognized control | Preserved limitation |
| --- | --- | --- |
| Action vocabulary | “Lead with the outcome participants name.” / “Ask which outcome participants name.” | The permitted non-presumptive action can still miss the finite action list. |
| personal attribution and relative-clause scope | “I saw institute sources describe planned platform work that Harbor was expected to manage.” / “The sources describe planned platform work.” | Changing only the prefix to “The sources describe” still refuses the separate relative clause. |
| dated hiring report, then applicability uncertainty | “A July 2026 hiring report describes a twelve-month staffing lead time. Current applicability is not established by the sources.” / the same limit after “The source describes a twelve-month staffing lead time.” | The dated report prefix is unrecognized; later uncertainty cannot qualify the preceding report. |
| Evidence-absence vocabulary | “No admitted excerpt establishes current ownership.” / “No supplied source establishes current ownership.” | Equivalent evidence-limit wording falls outside the recognized form. |

**KNOWN LIMITATION — unsupported recommendation acceptance:** “Harbor controls Cedar.” passes full initial and revision validation as `recommendation`, despite lacking support in the synthetic evidence. The predicate is outside the finite definite-predicate list. Its deterministic `succeeded` outcome is a characterization of the gap, not safe successful support. **KNOWN LIMITATION — attribution is not entailment:** the unrelated “The sources describe a lunar observatory.” also passes these full synthetic paths. Recognized ownership, affirmative action-complement, current-status, commercial, fabricated-quotation and altered-direct-excerpt negative controls remain refused; they do not generalize into a semantic safety guarantee.

The tests pin the current v5 request/validation source SHA-256 bytes in `draft.ts` and `generation-claims.ts` at source revision `0c18437abdff24432882394773d10012169ad381`. Before a real successor changes semantics, explicitly preserve/version v5; merely refreshing those pins is not preservation. No source-module copies or v6 implementation are added here. Synthetic accepted and refused records retain exact raw text, hashes, reconstructed record identity and revision ancestry; tampered raw text and outcomes are rejected. Historical outcomes/raw remain unchanged, including historical refusals. Versions 2/3/4/5 retain their existing behavior.

No more paid debugging, new model/version, claim rewrite, hedge insertion, source fabrication or v6 redesign is accepted in this sprint. Any future private UI preview is limited to recorded replay with no provider fallback, pending independent specification review then quality review, exact checked merge, backup and release readback. It is NOT yet merged/deployed. No new effects are authorized by this document; the parent retains the release decision.

## Bounded prompt-capacity regression

The first v5 candidate repeated guidance around the shared claim contract and emission forms, consuming revision headroom. The capacity repair compacts only future v5 natural-language instruction prose in `draft.ts`. The shared claim-contract instructions, schema, full eligible context projection, revision serialization and validators are unchanged. No response, history or evidence is shortened, and the external prompt cap remains 180,000 bytes.

The emission suite now measures UTF-8 prompt bytes through `createC3ModelRequest`, `createGenerationRecord` and `createC3RevisionContext`, using the existing public `syntheticWorkshopContext` fixture and a 15-minute meeting. All three size controls failed before prose changes, then passed with a required saving of at least 6,000 bytes:

| Public synthetic control | Before bytes | After bytes | Saved bytes |
| --- | ---: | ---: | ---: |
| Initial | 28,416 | 22,353 | 6,063 |
| Ordinary revision | 32,533 | 26,470 | 6,063 |
| Larger revision sizing control | 38,499 | 32,436 | 6,063 |

The larger control appends 2,983 newlines to the authored synthetic candidate. JSON escaping adds 5,966 revision-prompt bytes; these are deliberate sizing bytes, not an accepted provider response or historical owner evidence. Assertions retain the entire canonical context and revision, including the prior draft and exact raw response/hash. These bounded fixtures protect prose headroom; they do not guarantee that every future revision fits.

External-and-nonbinding sanitized controller measurements reported a 173,111-byte initial prompt and 183,194 / 183,194 / 182,268-byte retained-owner revision prompts before compaction. Subtracting the fixed 6,063-byte prose saving projects 167,048 and 177,131 / 177,131 / 176,205 bytes respectively. These were arithmetic projections at the capacity-repair boundary. Subsequent external-and-nonbinding controller evidence reports those exact post-compaction sizes and passing specification/quality reviews on implementation revision `0c18437abdff24432882394773d10012169ad381`; this closure writer did not rerun private owner contexts. The subsequent fresh initial was nevertheless refused, as the partial status records. Every actual future revision still needs its own actual-size preflight against the unchanged cap. This regression establishes neither future response adherence nor fresh-generation, customer or effect approval.
