# Controlled 2b-expanded usefulness validation

Status: pre-run docs-only approval packet with sanitized execution record appended. The original docs-only approval packet does not execute the run; this later status update records the separate execution. This packet authorized the run but did not execute it inside the PR that created the approval.

## Sanitized execution record

The controlled 2b-expanded usefulness validation executed at commit `355c84e` using OpenRouter `owl-alpha` for `graph.propose` over a frozen 3-account controlled corpus. The selected roles were representative, edge-case, and calibration. The corpus reference used the `external-corpus/controlled-2b-expanded/` prefix, and private evidence stayed outside the repository.

Execution shape:

- provider route: OpenRouter;
- model: `owl-alpha`;
- operation: `graph.propose`;
- corpus shape: 3-account controlled corpus;
- selected roles: representative, edge-case, calibration;
- call shape: one provider call per selected account;
- approval: present through `atliera.model_activation_approval.v1`;
- observed cost: $0;
- total input tokens: 374;
- total output tokens: 305;
- production writes: no production writes;
- runtime wiring: no runtime/model-mode integration.

Checks passed for each selected account:

- activation gates;
- credential status;
- provider call;
- response contract;
- cost ledger;
- full-pipeline packaging;
- bootstrap evidence verifier.

Deterministic full-pipeline manifest hashes:

- representative account package: `18be752143b01a5246205f8d4fcd7e3073a20894c9a1798a2010512ecf0f55ab`;
- edge-case account package: `f25c9f98190a05b7ea020be84ffd397203291c07feb91abd703a402e566f90b6`;
- calibration account package: `a11e073a6140c9283303119a466dcd51fe4bc3f51bf8430ca98fa7d93d0713ad`.

The sanitized account-level facts were classified with `assessControlledCorpusUsefulness(...)`. Classification counts: weak-but-valid 3, zero-output 0, unsupported/invented 0, contract failure 0. The overall corpus classification was weak-but-valid because provider validation and packaging passed, while the sanitized output counts did not include accepted account objects or lens-usable claims. The assessment preserved `launch_readiness_claim: false`.

The selected pre-locked interpretation branch is: weak-but-valid. Inspect rubric, prompts, proposal layer, and evidence policy before comparison or expansion; do not claim readiness.

`src/validation/controlled-corpus-weakness-diagnosis.ts` now provides the deterministic no-spend controlled corpus weakness diagnosis helper for this weak-but-valid follow-up path. `diagnoseControlledCorpusWeakness(...)` consumes already-produced, already-sanitized account-level facts and buckets weakness into `low_materiality`, `low_specificity`, `missing_account_objects`, `missing_lens_usefulness`, `insufficient_evidence_density`, `rubric_threshold_gap`, `proposal_layer_underproduction`, `evidence_policy_gap`, and `non_weak_blocker`. The helper returns next action labels `inspect_rubric`, `inspect_prompts`, `inspect_proposal_layer`, and `inspect_evidence_policy`, while preserving `approves_expansion_or_comparison: false` and `launch_readiness_claim: false`. This diagnosis is not a new execution record, does not authorize provider calls, does not authorize provider spend, does not approve comparison or expansion, does not imply launch readiness, and does not establish broad model quality.

No post-validation rereads: interpretation used packaged sanitized evidence and already-produced sanitized account-level facts. Raw source text, prompts, provider responses, wrapper logs, headers, private paths, and credential-bearing materials were not reread to reinterpret the result.

Full-pipeline packaging used private normalized copies of the successful provider-validation reports to satisfy the current `run_` research-run identifier contract. That normalization changed only sanitized identifier shape for packaging compatibility, did not change provider/model/operation/check/cost/token status, and happened without retrying provider calls.

This result does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account corpus readiness. Provider portability remains intact: this is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and future separately approved direct provider routes such as the Anthropic API and OpenAI API remain first-class options behind the same `ModelProvider` boundary.

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
