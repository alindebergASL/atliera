# Controlled 2b-expanded usefulness validation

Status: pre-run approval packet, docs-only. This packet does not execute the run.

This document is the approval and interpretation packet for one controlled 2b-expanded usefulness validation run after the usefulness contract and deterministic assessment helper have landed. It records scope, cost boundaries, corpus shape, provider route, and post-run interpretation before execution so the run cannot be expanded or reinterpreted around the outcome.

This packet is not a sanitized execution record. A later follow-up PR may record only sanitized status if the run is executed.

## Decision

Approve one bounded 2b-expanded live-provider validation slice using OpenRouter `owl-alpha` for `graph.propose` over a 3-5 account controlled corpus. This expands the first controlled 2b substrate path from one representative account to a tiny corpus selected under `controlled-corpus-usefulness-validation.md`, then classifies already-produced, already-sanitized account-level facts through `assessControlledCorpusUsefulness(...)`.

This is a usefulness-signal validation step, not a product-readiness or model-comparison step. It does not imply launch readiness, does not imply product readiness, does not establish broad model quality, does not establish production readiness, and does not establish multi-account corpus readiness.

## Approved run scope

Approved intended shape:

- validation name: controlled 2b-expanded usefulness validation;
- provider route: OpenRouter;
- model: `owl-alpha`;
- provider tier: free-tier, with no paid fallback;
- operation: `graph.propose`;
- call shape: one provider call per selected account;
- corpus shape: 3-5 account controlled corpus;
- required corpus roles: at least one representative account, one edge-case account, and one calibration account;
- optional corpus roles: up to two additional bounded accounts, only if they were selected before execution;
- corpus reference pattern: `external-corpus/controlled-2b-expanded/<run-slug>`;
- committed output: sanitized status only, after execution;
- private evidence: retained outside the repository;
- assessment path: `assessControlledCorpusUsefulness(...)` over already-produced, already-sanitized account-level facts;
- max run cost: $0.50 hard approval cap;
- expected observed provider cost: $0.00;
- cumulative 2b-expanded cap: $1.00 until a later approval packet changes it;
- no paid fallback;
- no automatic retry expansion.

The positive $0.50 max run cost exists because `atliera.model_activation_approval.v1` requires a positive max-cost gate. The expected provider charge remains $0.00 for the approved free-tier path. If the provider, wrapper, or ledger reports a nonzero charge that exceeds the approved remaining budget, the run must stop and preserve sanitized refusal/failure evidence rather than continuing.

## Corpus selection contract

Corpus selection is frozen before execution.

The selected corpus must satisfy the usefulness contract before any provider call:

1. Include at least one representative account with normal account-shaped evidence.
2. Include at least one edge-case account that is realistic but stresses sparse evidence, ambiguity, weak provenance, or conflicting evidence.
3. Include at least one calibration account with a pre-known expected usefulness or failure behavior from deterministic fixture or human-reviewed local evidence.
4. Include no more than two additional bounded accounts, and only when they add pre-declared behavior coverage without raising private-data sensitivity.
5. Reference the selected corpus through `external-corpus/controlled-2b-expanded/<run-slug>` without committing source content.

Post-run substitution is a validation failure. Accounts must not be added, removed, replaced, or relabeled after seeing live output.

## Explicit approval requirements

The run must have approval through `atliera.model_activation_approval.v1` before execution.

The approval record must identify, outside the repository:

- a safe approval id;
- approving operator;
- approval timestamp;
- provider `openrouter`;
- model `owl-alpha`;
- maximum run cost USD, matching this packet unless a later packet supersedes it;
- external corpus reference under `external-corpus/controlled-2b-expanded/`;
- budget-ledger evidence reference;
- per-account run evidence references;
- cleanup-outcome reference;
- cleanup commitment.

The request path must use providerName `openrouter`, model `owl-alpha`, and operation `graph.propose`, matching the approval scope. Missing model mode, provider, model, cost cap, corpus reference, or operator approval is a refusal.

## Pre-run checks

Before execution:

1. `npm run ci` must pass at the commit being validated.
2. The selected corpus roles and tie-break rationale must be documented privately before execution.
3. The approval corpus reference must begin with `external-corpus/controlled-2b-expanded/`.
4. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.
5. The wrapper must map Atliera-safe model id `owl-alpha` to the provider route internally.
6. Activation gates must pass before each provider call.
7. The estimated next cost and cumulative expected cost must fit under this packet's remaining budget.
8. Private evidence storage must already be available outside the repository.

## Hard out of scope

This packet must not include:

- paid fallback;
- automatic retry expansion;
- production writes;
- runtime/model-mode integration;
- app, worker, database, queue, deployment, or production runtime wiring;
- model-quality comparison across providers;
- Anthropic, GPT-5.5, Sonnet, Opus, OpenAI, or other comparison runs;
- broad corpus expansion outside the selected 3-5 account controlled corpus;
- launch-readiness, product-readiness, production-readiness, broad-model-quality, or multi-account corpus-readiness claims;
- committing source corpus text, prompts, raw provider responses, headers, credential details, account-specific private identifiers, private paths, or wrapper logs.

## Execution path

The run should use existing substrate only:

1. Build one approved `ModelProviderRequest` per selected account for `graph.propose`.
2. Call the OpenRouter wrapper through `ExternalCommandModelProvider`.
3. Validate each result through `validateModelProviderCompatibility`.
4. Preserve sanitized provider-validation reports privately.
5. Package successful sanitized reports through the deterministic full-pipeline helper.
6. Verify packages using the bootstrap evidence verifier.
7. Convert accepted, sanitized account-level facts into `assessControlledCorpusUsefulness(...)` input.
8. Commit only sanitized status in a later follow-up PR.

No post-validation rereads: after execution, interpretation must use the packaged sanitized evidence and the already-produced, already-sanitized account-level facts. Do not reread raw source text, prompts, provider responses, wrapper logs, headers, private paths, or credential-bearing materials to reinterpret the result.

## Success criteria

The run succeeds as a bounded validation step only if all of the following hold:

- activation gates pass under explicit approval for each selected account;
- provider calls complete within the approved budget;
- response contract checks pass or produce safely classified refusal/failure reports;
- cost ledger entries are produced with provider, model, token counts, observed cost, status, and timestamp;
- full-pipeline packaging accepts the sanitized provider-validation reports;
- bootstrap evidence verifier accepts the resulting packages;
- `assessControlledCorpusUsefulness(...)` returns a corpus summary with `launch_readiness_claim: false`;
- sanitized status can be committed without private evidence leakage;
- no production writes occur;
- no runtime/model-mode integration occurs;
- the status explicitly preserves the no-readiness and no-broad-quality boundaries.

## Pre-locked interpretation

After execution, choose one branch before opening follow-up work:

1. If all useful and hard invariants hold, the next step is comparison planning or another separately approved validation packet, not a launch-readiness claim.
2. If any result is weak-but-valid, inspect the rubric, prompts, proposal layer, and evidence policy; do not claim readiness.
3. If any result is zero-output, stop and repair proposal generation or provider-boundary behavior before expanding.
4. If any result is unsupported/invented, stop and repair grounding, provenance, source policy, or graph proposal quality before expanding.
5. If any result is contract failure, stop and repair the surfaced substrate, validation, packaging, or bootstrap-verifier gap before comparison.
6. If operational provider failure prevents accepted output, preserve sanitized refusal evidence and repair the provider-boundary or operational issue before retrying under a new approval packet if needed.

The corpus summary must preserve the worst per-account classification. A useful average cannot hide a weak, zero-output, unsupported/invented, or contract-failure account.

## Provider portability

This packet preserves provider portability. It is not OpenRouter lock-in and is not an `owl-alpha` quality conclusion.

OpenRouter remains the approved route only for this bounded 2b-expanded slice. Future separately approved validation or comparison runs may use gateway routes or direct provider APIs such as the Anthropic API and OpenAI API behind the same `ModelProvider` boundary. Switching among gateway and direct provider routes must not require product-logic rewrites.

A future comparison run requires separate approval, separate spend cap, separate corpus reference, private evidence handling, and a sanitized milestone record. Model-quality comparison is out of scope for this packet.

## Sanitized follow-up record after execution

A later status PR may record:

- commit SHA validated;
- provider and public model id;
- operation `graph.propose`;
- approval presence, not approval contents;
- corpus reference presence and safe prefix, not source content;
- selected account roles, not private account identifiers;
- observed cost and token counts if non-sensitive;
- check names and pass/fail/refusal status;
- full-pipeline and bootstrap-verifier status;
- controlled corpus usefulness classification counts;
- the selected pre-locked interpretation branch.

A later status PR must not record private evidence, source text, prompts, raw provider responses, headers, credentials, account identifiers, private paths, raw wrapper logs, launch readiness, product readiness, production readiness, broad model quality, or multi-account corpus readiness.
