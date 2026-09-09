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

The [emission tests](../../tests/c3/c3-generation-emission.test.ts) use authored synthetic sources and complete candidates, not model recordings. Paired controls exercise supported prose and categorical usefulness, status upgrades, commercial presuppositions, independent assertions, quote/reference mismatch and missing/unknown citations through the real validator. Each mutation is tested in a complete candidate so fail-fast cannot hide another field's failure. Initial and revision paths retain exact raw bytes. Compatibility tests retain old notes, recovery and applied history. Synthetic success demonstrates these examples' deterministic compatibility only; it neither proves arbitrary paraphrase entailment nor predicts model adherence. Historical private replay and independent review remain controller work.

## Bounded prompt-capacity regression

The first v5 candidate repeated guidance around the shared claim contract and emission forms, consuming revision headroom. The capacity repair compacts only future v5 natural-language instruction prose in `draft.ts`. The shared claim-contract instructions, schema, full eligible context projection, revision serialization and validators are unchanged. No response, history or evidence is shortened, and the external prompt cap remains 180,000 bytes.

The emission suite now measures UTF-8 prompt bytes through `createC3ModelRequest`, `createGenerationRecord` and `createC3RevisionContext`, using the existing public `syntheticWorkshopContext` fixture and a 15-minute meeting. All three size controls failed before prose changes, then passed with a required saving of at least 6,000 bytes:

| Public synthetic control | Before bytes | After bytes | Saved bytes |
| --- | ---: | ---: | ---: |
| Initial | 28,416 | 22,353 | 6,063 |
| Ordinary revision | 32,533 | 26,470 | 6,063 |
| Larger revision sizing control | 38,499 | 32,436 | 6,063 |

The larger control appends 2,983 newlines to the authored synthetic candidate. JSON escaping adds 5,966 revision-prompt bytes; these are deliberate sizing bytes, not an accepted provider response or historical owner evidence. Assertions retain the entire canonical context and revision, including the prior draft and exact raw response/hash. These bounded fixtures protect prose headroom; they do not guarantee that every future revision fits.

External-and-nonbinding sanitized controller measurements reported a 173,111-byte initial prompt and 183,194 / 183,194 / 182,268-byte retained-owner revision prompts before compaction. Subtracting the fixed 6,063-byte prose saving projects 167,048 and 177,131 / 177,131 / 176,205 bytes respectively. These are arithmetic projections, not a rerun of private owner contexts. The controller must rerun exact owner capacity and independent specification/quality reviews on the final candidate before initial dispatch; previous reviews cover different bytes. Every actual future revision still needs its own actual-size preflight against the unchanged cap. This regression establishes neither future response adherence nor fresh-generation, customer or effect approval.
