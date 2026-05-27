# Controlled corpus usefulness validation

Status: proposed contract, no-spend only.

This document defines the next validation contract after the controlled 2b live-provider run. It is deliberately a no-spend planning and safety contract. It does not authorize provider calls, does not approve another live run, does not approve production writes, and does not approve runtime/model-mode integration. It does not imply launch readiness, does not imply product readiness, does not establish broad model quality, and does not establish multi-account corpus readiness.

## Decision

Before another live provider run, Atliera will define how a tiny controlled corpus is selected and how model-produced graph proposals are classified for usefulness. The controlled 2b milestone showed that one approved provider response traversed provider validation, AgentRun linkage, graph/quality packaging, manifest determinism, and bootstrap verification. The next risk is not substrate transport; it is post-hoc interpretation of output usefulness.

This contract separates substrate health from model-output usefulness so future runs can be interpreted consistently without model shopping, provider lock-in, or launch-readiness overclaiming.

## Corpus selection contract

The next corpus should be a 3-5 account controlled corpus, selected before execution and referenced through an out-of-repository corpus identifier if a later approval packet authorizes a live run.

Selection criteria:

1. Include at least one representative account with normal account-shape evidence and expected material account objects.
2. Include at least one edge-case account that is still realistic but stresses sparse evidence, ambiguous claims, conflicting evidence, or weak provenance.
3. Include at least one calibration account with known expected useful/weak/failure behavior from deterministic fixture or human-reviewed local evidence.
4. Prefer accounts that exercise Signals, Maps, and Plays usefulness without requiring new product UI, runtime wiring, or database work.
5. Exclude private source text, raw prompts, raw provider responses, private account identifiers, credentials, and private infrastructure details from committed docs.

Tie-break rule:

- If more accounts qualify than fit the 3-5 account limit, choose the smallest set that covers representative account behavior, edge-case account behavior, and calibration account behavior.
- If two candidate sets cover the same behavior, choose the set with clearer expected outcomes and lower private-data sensitivity.
- Do not choose or replace accounts after seeing live model output; post-run substitution is a validation failure.

## Usefulness classification rubric

Each account result should receive exactly one primary usefulness classification:

- useful: graph proposals include materially relevant, specific, provenance-backed account intelligence that can support at least one Signals, Maps, or Plays lens without manual rescue.
- weak-but-valid: output satisfies response contracts and provenance rules but is too generic, low-materiality, thin, or insufficiently specific for confident product use.
- zero-output: provider and validation substrate pass, but the model produces no usable excerpts, claims, or account objects.
- unsupported/invented: output includes unsupported claims, invented IDs, invented provenance, or account objects that are not grounded in accepted source evidence.
- contract failure: output cannot be accepted by response-contract, graph, quality, packaging, or bootstrap-verifier checks.

The primary classification should be accompanied by short non-sensitive reasons. Reasons may name categories and public fixture-style identifiers, but must not include raw source text, raw prompts, raw provider responses, credentials, private account names, private file paths, or private infrastructure details.

## Executable no-spend assessment helper

`src/validation/controlled-corpus-usefulness.ts` provides the deterministic local assessment helper for this contract. It classifies already-produced, already-sanitized account-level facts; it does not perform provider calls, does not authorize provider spend, does not read credentials, does not write production data, and does not integrate runtime/model mode.

The helper requires a 3-5 account corpus with at least one representative account, one edge-case account, and one calibration account. It rejects unsafe account references, negative output counts, malformed hard-invariant flags, malformed soft-quality flags, and corpus sets that do not satisfy the pre-locked selection shape.

The helper derives each account classification from:

- hard invariants: invented-ID safety, provenance presence, graph validation, and private-leakage absence;
- output counts: excerpts, claims, and account objects;
- soft quality signals: materiality, specificity, account usefulness, lens usefulness, and source fit.

The corpus summary preserves the worst per-account classification as the overall classification. A weak, zero-output, unsupported/invented, or contract-failure account cannot be hidden by averaging with useful accounts. The helper always reports `launch_readiness_claim: false`.

## Executable no-spend weakness diagnosis helper

`src/validation/controlled-corpus-weakness-diagnosis.ts` provides the deterministic controlled corpus weakness diagnosis helper for weak or worse controlled-corpus outcomes. `diagnoseControlledCorpusWeakness(...)` consumes the same already-produced, already-sanitized account-level facts as the usefulness helper, reuses the usefulness assessment, and explains why the result did not become fully useful. It is no-spend: it does not authorize provider calls, does not authorize provider spend, does not read credentials, does not write production data, and does not integrate runtime/model mode.

The diagnosis helper is for interpretation only. It sets `approves_expansion_or_comparison: false` and `launch_readiness_claim: false`; it does not approve comparison or expansion and does not imply launch readiness, product readiness, production readiness, broad model quality, or multi-account corpus readiness.

Weak-but-valid diagnosis codes are intentionally bounded and non-sensitive:

- `low_materiality`: the output is accepted but not material enough for account understanding or action.
- `low_specificity`: the output is accepted but too generic for this account.
- `missing_account_objects`: accepted account-object output is absent or account usefulness failed.
- `missing_lens_usefulness`: the output cannot safely support a Signals, Maps, or Plays lens.
- `insufficient_evidence_density`: accepted excerpt/claim/object density is too thin for confident use.
- `rubric_threshold_gap`: materiality or specificity thresholds need inspection before changing prompts or rerunning.
- `proposal_layer_underproduction`: the proposal layer underproduced account objects or lens-usable structure.
- `evidence_policy_gap`: source-fit or evidence-policy handling needs inspection.
- `non_weak_blocker`: a zero-output, unsupported/invented, or contract-failure account is present and must not be hidden as a weak-only rubric issue.

The next required action labels are also non-execution labels: `inspect_rubric`, `inspect_prompts`, `inspect_proposal_layer`, and `inspect_evidence_policy`. They direct a no-spend review path before another approval packet. They do not authorize provider calls or provider spend.

## Hard invariants

A run cannot be classified as useful if any hard invariant fails:

- no invented IDs;
- provenance required for material claims and account objects;
- graph validates through existing graph validators;
- no private leakage in committed docs, manifests, summaries, or PR bodies;
- response-contract and provider-validation status remain distinct from AgentRun orchestration status;
- packaging and bootstrap verification must fail closed if sanitized evidence is incomplete, inconsistent, or unsafe;
- no production writes;
- no runtime/model-mode integration;
- no launch-readiness, product-readiness, production-readiness, broad-model-quality, or multi-account corpus readiness claim.

## Soft quality signals

Soft quality signals guide interpretation only after hard invariants pass:

- materiality: the proposed intelligence matters for account understanding or action.
- specificity: the output is precise enough to distinguish this account from a generic template.
- account usefulness: the result would help a human understand the account without inspecting raw private evidence.
- lens usefulness: at least one Signals, Maps, or Plays lens can use the output without pretending unsupported material is verified.
- source fit: the output respects the available source evidence instead of filling gaps with plausible but unsupported narrative.

Soft quality signals do not override hard invariant failures. A polished but unsupported answer is unsupported/invented, not useful.

## Pre-locked decision tree

Future post-run interpretation should use this pre-locked decision tree:

1. If substrate still passes but weak output dominates, the next step is prompt, proposal-layer, source-policy, or excerpt-acceptance improvement; do not reopen broad substrate work by default.
2. If substrate failure occurs in provider validation, response contract, graph validation, packaging, or bootstrap verification, the next step is targeted substrate repair against the specific surfaced gap.
3. If useful output on the tiny corpus appears while hard invariants hold, the next step is a separately approved broader validation batch or comparison run, not a launch-readiness claim.
4. If operational provider failure occurs before accepted output, the next step is provider-boundary or operational repair while preserving sanitized refusal evidence.
5. If unsupported/invented output appears, the next step is source-grounding and proposal-quality repair before expanding the corpus.

## Provider and model portability

This contract is not an OpenRouter lock-in contract and is not an `owl-alpha` quality conclusion. It preserves provider portability across gateway providers and direct provider APIs.

Future live runs require separate approval and may choose among:

- OpenRouter routes when a gateway is useful for controlled validation;
- direct provider APIs such as the Anthropic API or OpenAI API;
- other provider/model options that satisfy the same `ModelProvider` boundary.

Switching among gateway and direct provider routes must not require product-logic rewrites. A future comparison run must have its own approval packet, spend cap, corpus reference, private evidence handling, and sanitized milestone record.

## Explicitly out of scope

This contract does not authorize:

- another live provider run;
- provider spend;
- paid fallback;
- broad corpus expansion;
- production writes;
- app, worker, database, queue, deployment, or runtime/model-mode integration;
- model-quality comparison across providers;
- launch readiness;
- product readiness;
- production readiness;
- broad model quality;
- multi-account corpus readiness.

## Relationship to controlled 2b

Controlled 2b proved that one approved live-provider evidence packet could traverse the current substrate path. This document defines the no-spend usefulness rubric needed before deciding whether the next separately approved run should be a 2b-expanded tiny corpus repeatability check or a 2c model/provider comparison.

`controlled-2b-expanded-usefulness-validation.md` is the next approved execution packet for controlled 2b-expanded usefulness validation after this contract. It uses `assessControlledCorpusUsefulness(...)` to classify already-produced sanitized account-level facts for a bounded 3-5 account corpus while preserving the no launch-readiness, no product-readiness, and no broad-model-quality boundaries.

The result of this document alone is a safer interpretation contract, not an execution record and not an approval to spend.
