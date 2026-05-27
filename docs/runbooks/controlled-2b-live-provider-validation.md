# Controlled 2b live-provider validation

This document is the pre-run approval and interpretation packet for Atliera's controlled 2b live-provider validation slice. It deliberately records the scope before execution so post-run interpretation cannot be rebuilt around the outcome.

Status: proposed approval packet, not an execution record.

## Decision

Move to 2b now, tightly bounded, before designing a larger live corpus review contract.

The first 2b run will use OpenRouter `owl-alpha` because it is a free-tier foundational model with a 1M token context window and has already been used for Atliera provider-boundary validation. This is a deliberate provider neutrality test: OpenRouter is the abstraction layer for the first substrate-path validation, so the run exercises Atliera's neutral `ModelProvider` boundary rather than optimizing the first live path around a single direct provider. Model quality comparison is out of scope for this first run; Anthropic provider comparison is out of scope; GPT-5.5 provider comparison is out of scope. Those comparisons can happen after the substrate is proven on one tiny controlled path.

This selection does not establish a production default, does not establish a quality preference, does not establish a provider commitment, and does not establish a launch model. The intent is model flexibility: `owl-alpha` is the first free substrate-path probe, while later separately approved runs may compare Claude Sonnet through OpenRouter, Claude Opus through OpenRouter, GPT-5.5 through OpenRouter, DeepSeek-style models, direct provider integrations, or other provider/model options without changing Atliera's product architecture.

## Run scope

Approved intended shape:

- validation name: controlled 2b live-provider validation;
- provider: OpenRouter;
- model: `owl-alpha`;
- provider tier: free-tier, with no paid fallback;
- operation: `graph.propose`;
- call shape: single provider call;
- corpus shape: one representative account;
- corpus reference pattern: `external-corpus/controlled-2b/<run-slug>`;
- account selection: typical account-shaped fixture, not an edge case and not a multi-account corpus;
- output destination: private evidence outside the repository;
- committed output: sanitized summary only, after execution;
- max run cost: $0.10 hard approval cap;
- expected observed provider cost: $0.00;
- cumulative 2b cap: $1.00 until a later approval changes it.

The positive $0.10 cap exists because `atliera.model_activation_approval.v1` requires a positive max-cost gate. The run still has no paid fallback. If the wrapper, provider, or ledger reports a nonzero cost that would exceed the approved remaining budget, the activation gates or post-run analysis must treat that as a validation finding rather than silently continuing.

## Explicit approval requirements

The run must have approval through `atliera.model_activation_approval.v1` before execution.

The approval record must identify, outside the repository:

- a safe approval id;
- the approving operator;
- the approval timestamp;
- provider `openrouter`;
- model `owl-alpha`;
- maximum run cost USD, matching this packet unless a new packet supersedes it;
- external corpus reference under `external-corpus/controlled-2b/`;
- budget-ledger evidence reference;
- run-evidence reference;
- cleanup-outcome reference;
- cleanup commitment.

The run must also evaluate the existing activation gates before the provider call. Missing model mode, provider, model, max cost, out-of-repo corpus reference, or operator approval is a refusal, not a reason to bypass the gate.

## Hard out of scope

The first controlled 2b run must not include:

- model quality comparison across providers;
- Anthropic, GPT-5.5, or other model comparison;
- no broad corpus expansion;
- multi-account validation;
- production writes;
- runtime/model-mode integration;
- app, worker, database, queue, or deployment wiring;
- launch-readiness or product-readiness claims;
- committing raw provider evidence, source corpus text, prompts, responses, headers, credential details, account-specific private identifiers, or private filesystem locations.

## Pre-run checks

Before execution:

1. `npm run ci` must pass at the commit being validated.
2. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.
3. The wrapper must map Atliera-safe model id `owl-alpha` to the provider's OpenRouter model id internally.
4. The request must use `providerName` `openrouter` and model `owl-alpha`, matching the approval scope.
5. The approval's corpus reference must begin with `external-corpus/controlled-2b/`.
6. The estimated next cost must fit under the remaining approved budget.
7. The selected account must be documented privately as representative and must not be chosen retroactively.
8. Private evidence storage must already be available outside the repository.

## Planned comparison sequence

The first 2b run is not a standing approval for comparison runs. The intended sequence is:

1. 2b first run: `owl-alpha` through OpenRouter, using the free-tier foundational model path to validate provider neutrality and substrate packaging.
2. 2c future run: Claude Sonnet through OpenRouter, if 2b shows the substrate path works and a separate approval packet authorizes the spend/scope.
3. 2d future run: GPT-5.5 through OpenRouter, if a separate approval packet authorizes that comparison.
4. Later quality assessment: compare model usefulness across approved runs only after each run has its own approval, spend cap, private evidence, and sanitized milestone.

Each future comparison run requires separate approval. This packet approves only the first controlled 2b run.

## OpenRouter operational failure modes

OpenRouter adds a routing layer. The 2b run should classify these as expected operational failure modes, not automatically as Atliera substrate failures:

- OpenRouter outage;
- OpenRouter rate limit;
- upstream provider outage or refusal surfaced through OpenRouter;
- routing layer mismatch or model availability change;
- free-tier quota, daily cap, or output-format constraint;
- request-size or context-window limit despite the advertised free-tier capacity.

If one of these occurs, preserve sanitized refusal/failure evidence and map the result through the post-run decision tree. Do not weaken activation gates, retry broadly, or switch models inside this approval packet.

## Execution path

The run should use the existing architecture without new contract surface:

1. Build one approved `ModelProviderRequest` for `graph.propose`.
2. Call the external OpenRouter wrapper through `ExternalCommandModelProvider`.
3. Validate the result through `validateModelProviderCompatibility`.
4. Preserve the sanitized provider-validation report privately.
5. Package the sanitized successful report through the deterministic full-pipeline helper.
6. Verify the package using the bootstrap evidence verifier.
7. Commit only a sanitized milestone summary after execution.

Package output through the existing full-pipeline and bootstrap evidence verifier path. If the full-pipeline helper or bootstrap evidence verifier cannot accept the 2b evidence without modification, that is a validation result and should be classified as an evidence packaging failure or substrate gap before adding new surface.

## Success criteria

The run succeeds only if all of the following hold:

- activation gates pass under explicit approval;
- provider call completes within the approved budget;
- response contract validation passes or produces a safely classified refusal/failure report;
- cost ledger entry is produced with provider, model, token counts, observed cost, status, and timestamp;
- full-pipeline packaging accepts the sanitized provider-validation report;
- bootstrap evidence verifier accepts the resulting package;
- sanitized summary can be committed without private evidence leakage;
- no production writes occur;
- no runtime/model-mode integration occurs;
- the summary explicitly states that the result does not imply launch readiness and does not imply product readiness.

A zero-output or low-quality result may still prove the substrate path works. It must be classified separately from provider integration and evidence packaging.

## Failure modes to distinguish

Provider integration failure:
- the call does not complete;
- credentials, routing, rate limits, wrapper execution, provider availability, or activation gates block the call;
- next work is operational/provider-boundary repair, not prompt-quality tuning.

Output quality failure:
- the call completes and validates as provider evidence, but produces zero useful or low-usefulness account output;
- next work is proposal-layer, prompt, source-policy, or excerpt-acceptance improvement.

Validation pipeline failure:
- the call completes and returns output, but validators reject the shape in a way not anticipated by the current contracts;
- next work is a targeted validator/contract repair based on the concrete mismatch.

Evidence packaging failure:
- provider validation succeeds, but full-pipeline packaging or the bootstrap evidence verifier rejects the sanitized evidence package;
- next work is targeted substrate revision against the specific packaging/verifier gap.

## Post-run decision tree

After the run, classify the outcome before opening follow-up work:

1. If provider integration, validation, full-pipeline packaging, and bootstrap evidence verifier all pass with usable output, the next step is an expanded corpus contract and a slightly broader validation batch.
2. If the substrate path passes but output usefulness is weak or zero, the next step is model-output quality work, not more substrate expansion.
3. If validation or packaging fails, the next step is targeted substrate revision against the specific surfaced gap.
4. If activation or credentials fail before the call, the next step is operational/provider-boundary repair, preserving the sanitized refusal evidence.

The decision tree is part of the approval packet so the post-run interpretation is deliberate rather than retroactive.

## Sanitized milestone record after execution

The post-run PR may record:

- commit SHA validated;
- provider and public model id;
- operation `graph.propose`;
- approval presence, not approval contents;
- corpus reference presence and safe prefix, not source content;
- observed cost and token counts if non-sensitive;
- check names and pass/fail/refusal status;
- full-pipeline and bootstrap-verifier status;
- cleanup outcome status;
- the selected post-run decision-tree branch.

The post-run PR must not record:

- credentials, tokens, account ids, org ids, private account names, private endpoint details, source corpus text, prompts, raw provider responses, headers, private paths, or raw wrapper logs;
- any claim that a single 2b run proves launch readiness, product readiness, production readiness, broad model quality, or multi-account corpus readiness.
