# Live Product Preview Approval

Status: pre-run docs-only approval packet. This PR does not execute the run.

## Decision

This packet approves exactly one controlled live-provider product preview after the fake-mode Workshop surface exit criteria in `../strategy/fake-mode-workshop-surface-exit-criteria.md`.

The approved preview is one representative account, one `graph.propose` provider call, and one Workshop preview render from the produced graph. It is a validation/product-surface bridge only: it checks whether a single live-provider graph proposal can flow through Atliera's existing provider-validation, graph validation, quality gate, manifest/bootstrap evidence path, and Workshop preview surface.

## Approved route and request shape

- provider route: OpenRouter
- public model id: `owl-alpha`
- provider tier: free-tier
- operation: `graph.propose`
- activation approval schema: `atliera.model_activation_approval.v1`
- corpus reference prefix: `external-corpus/live-product-preview/`
- selected scope: one representative account
- provider calls: exactly one
- Workshop renders: exactly one render from the validated graph output
- expected observed provider cost: `$0.00`
- max run cost: `$0.50`
- cumulative product-preview cap: `$0.50`
- no paid fallback
- private evidence outside the repository
- sanitized status follow-up after execution

The model id is not a launch model or production default. It is a safe logical model id for this bounded validation route. The wrapper may map it internally to the provider's OpenRouter model id, but repository docs and reports should keep only sanitized public identifiers.

## Explicitly not approved

This approval does not allow:

- no provider comparison;
- no corpus expansion;
- no more than one account;
- no more than one provider call;
- no paid fallback;
- no production writes;
- no production deployment;
- no runtime/model-mode integration;
- no worker-loop or autonomous runtime execution;
- no customer-data access;
- no launch, product, or production readiness claim;
- no broad provider quality claim;
- no multi-account readiness claim.

## No tools, plugins, or live web retrieval

This run is intentionally a bounded corpus/graph validation path, not a retrieval-enabled provider mode.

The request must use:

- no `:online` model variant;
- no OpenRouter `web` plugin;
- no `openrouter:web_search` server tool;
- no tools or plugins of any kind.

OpenRouter account-default plugins must be disabled or request-disabled for this run. If OpenRouter web/search capability is desired later, it is a separate future approval surface because it changes spend, provenance, and evidence semantics.

OpenRouter web/search capability is a separate future approval surface; it is not part of this approved run.

## Pre-run gate checklist

Before execution:

1. Activation gates must pass for the exact provider route, model id, operation, corpus reference prefix, cost cap, and one-call scope.
2. Credential readiness must pass without committing credentials or private provider details.
3. The input account/corpus reference must remain outside the repository and under the approved safe prefix.
4. The request must not include tools, plugins, `:online`, web search, or retrieval settings.
5. The estimated next cost and cumulative expected cost must fit under this packet's caps.
6. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.

## Success criteria

The execution follow-up may record success only if all of the following are true:

- Activation gates must pass.
- Credential readiness must pass.
- The provider call returns a response accepted by the response contract; response contract must pass.
- The cost ledger entry must be succeeded and remain within the approved cap.
- Graph validation and quality gate must pass for the produced graph output.
- The deterministic full-pipeline package must verify.
- The bootstrap evidence verifier must verify the sanitized package.
- Workshop preview must render from the produced graph.
- The sanitized status follow-up records the provider route, public model id, observed token counts, observed cost, validation status, packaging status, bootstrap status, and Workshop preview status.
- No post-output substitution is used to create or improve the graph or Workshop preview.

## Failure modes and interpretation

The pre-run interpretation is locked before execution:

1. If provider integration and product preview both pass, the next step is not launch. The next step is a separate controlled-corpus or product-preview expansion contract.
2. If the substrate passes but Workshop usefulness is weak, the next step is product-surface/rubric/prompt diagnosis without expanding the corpus by default.
3. If validation, packaging, or bootstrap verification fails, the next step is targeted substrate revision against the concrete surfaced gap.
4. If activation or credential failure occurs before the call, the next step is operational/provider-boundary repair with sanitized refusal evidence.
5. If provider refusal, outage, rate limit, or routing failure prevents accepted output, preserve sanitized refusal evidence and repair or re-approve before retrying.

These outcomes must be recorded as historical facts from one approved run. They must not be generalized into provider quality, product readiness, launch readiness, or multi-account readiness.

## Private evidence and sanitized follow-up

Raw provider request/response material, credentials, wrapper logs, source account content, and private evidence remain outside the repository. The repository may receive only a sanitized status follow-up after execution.

The sanitized status follow-up should include:

- commit under validation;
- provider route;
- public model id;
- operation;
- approved corpus reference prefix;
- observed token counts when non-sensitive and observed cost when non-sensitive;
- activation, credential, response-contract, cost-ledger, graph-validation, quality-gate, full-pipeline, bootstrap, and Workshop preview statuses;
- explicit no-readiness and no-quality conclusions.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a permanent routing decision.

The same `ModelProvider` boundary must continue to support gateway and direct provider routes, including future direct Anthropic API and OpenAI API implementations. A future provider/model comparison must have its own approval packet, spend cap, corpus reference, private evidence handling, and sanitized status record.
