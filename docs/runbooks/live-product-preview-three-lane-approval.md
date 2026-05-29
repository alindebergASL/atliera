# Live Product Preview Three-Lane Approval

Status: pre-run docs-only approval packet. This PR does not execute the run.

## Decision

This packet approves exactly one controlled live-provider product preview after the fake-mode Workshop surface exit criteria in `../strategy/fake-mode-workshop-surface-exit-criteria.md` and after the first live-preview lens diagnostic in `live-product-preview-lens-diagnostic.md` stopped current-account remediation.

The approved preview is one screened account, one `graph.propose` provider call, and one Workshop preview render from the produced graph. It is a product-surface validation bridge only: it checks whether a single live-provider graph proposal for a source account screened for richer lens evidence can flow through Atliera's existing provider-validation, graph validation, quality gate, manifest/bootstrap evidence path, and Workshop preview surface.

This packet does not reopen current-account remediation for `live-product-preview-20260528a`. It does not pressure prompts or schemas to invent unsupported Maps or Plays content for that first account. The first account remains closed as a graph-level `structure-absent-account-limitation` case unless a separate future artifact proves a proposal-extraction issue against private source evidence.

## Prerequisite evidence

This approval depends on already-merged deterministic fake-mode evidence, not on a new provider call inside this PR:

- `fixtures/workshop/runtime-preview-demo-report.json` is the checked sanitized three-lane fake-mode preview report.
- The checked report records `lensItemCounts` for Signals, Maps, and Plays.
- The checked report records `lensEvidencePacketCounts` for Signals, Maps, and Plays.
- The exit criterion `two_materially_useful_lenses_in_fixture_mode_against_supported_existing_outputs` is satisfied by the deterministic three-lane fixture path.
- `live-product-preview-lens-diagnostic.md` records why the first live account should not be remediated into Maps or Plays.

## Approved route and request shape

- provider route: OpenRouter
- public model id: `owl-alpha`
- provider tier: free-tier
- operation: `graph.propose`
- activation approval schema: `atliera.model_activation_approval.v1`
- corpus reference prefix: `external-corpus/live-product-preview-three-lane/`
- selected scope: one screened account
- provider calls: exactly one
- Workshop renders: exactly one render from the validated graph output
- expected observed provider cost: `$0.00`
- max run cost: `$0.50`
- cumulative three-lane product-preview cap: `$0.50`
- no paid fallback
- private evidence outside the repository
- sanitized status follow-up after execution

The model id is not a launch model or production default. It is a safe logical model id for this bounded validation route. The wrapper may map it internally to the provider's OpenRouter model id, but repository docs and reports should keep only sanitized public identifiers.

## Screened source-evidence prerequisites

The private source-account selection step must be completed before execution and recorded only as sanitized pass/fail markers in the later status follow-up.

The selected account must pass these screened source-evidence prerequisites before any provider call:

1. The account has source material expected to support Signals plus at least one of Maps or Plays.
2. The source screen is a prerequisite only; it does not pre-write graph objects, claims, or Workshop items.
3. The proposal-extraction screen records only sanitized category-presence markers, not raw source text or private account details.
4. If the source-evidence screen fails, execution stops before the provider call and the status follow-up records a sanitized pre-call refusal.
5. If the source screen passes but the live graph is still structure-absent at graph level for Maps and Plays, the post-run interpretation is proposal-extraction review, not prompt pressure to invent unsupported content.

## Explicitly not approved

This approval does not allow:

- no provider comparison;
- no broad corpus expansion;
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

## Pre-run gate checklist

Before execution:

1. Activation gates must pass for the exact provider route, model id, operation, corpus reference prefix, cost cap, and one-call scope.
2. Credential readiness must pass without committing credentials or private provider details.
3. The screened account/corpus reference must remain outside the repository and under the approved safe prefix.
4. The screened source-evidence prerequisites must pass before the provider call.
5. The request must not include tools, plugins, `:online`, web search, or retrieval settings.
6. The estimated next cost and cumulative expected cost must fit under this packet's caps.
7. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.

## Success criteria

The execution follow-up may record success only if all of the following are true:

- Activation gates must pass.
- Credential readiness must pass.
- The source-evidence screen must pass before the provider call.
- The provider call returns a response accepted by the response contract; response contract must pass.
- The cost ledger entry must be succeeded and remain within the approved cap.
- Graph validation and quality gate must pass for the produced graph output.
- The deterministic full-pipeline package must verify.
- The bootstrap evidence verifier must verify the sanitized package.
- Workshop preview must render from the produced graph.
- Sanitized graph-supported lens counts must be recorded for Signals, Maps, and Plays.
- The sanitized status follow-up records the provider route, public model id, observed token counts, observed cost, validation status, packaging status, bootstrap status, Workshop preview status, and source-evidence screen status.
- No post-output substitution is used to create or improve the graph or Workshop preview.

## Failure modes and interpretation

The pre-run interpretation is locked before execution:

1. If provider integration and product preview both pass, the next step is not launch. The next step is a separate no-spend usefulness assessment over already-sanitized facts, with any further expansion requiring a new approval packet.
2. If the source-evidence screen fails, no provider call is made; record sanitized refusal evidence and select a different screened account only under a new or amended approval packet.
3. If the source screen passes but Maps and Plays are still structure-absent at graph level, the next step is proposal-extraction review before another live run. Do not pressure prompts or schemas to invent unsupported Maps or Plays.
4. If supported Maps or Plays graph structure exists but Workshop usefulness fails to surface it, the next step is deterministic Workshop mapping remediation against existing output, not a live rerun by default.
5. If validation, packaging, or bootstrap verification fails, the next step is targeted substrate revision against the concrete surfaced gap.
6. If activation or credential failure occurs before the call, the next step is operational/provider-boundary repair with sanitized refusal evidence.
7. If provider refusal, outage, rate limit, or routing failure prevents accepted output, preserve sanitized refusal evidence and repair or re-approve before retrying.

These outcomes must be recorded as historical facts from one approved run. They must not be generalized into provider quality, product readiness, launch readiness, production readiness, or multi-account readiness.

## Private evidence and sanitized follow-up

Raw provider request/response material, credentials, wrapper logs, source account content, source-evidence screen details, and private evidence remain outside the repository. The repository may receive only a sanitized status follow-up after execution.

The sanitized status follow-up should include:

- commit under validation;
- provider route;
- public model id;
- operation;
- approved corpus reference prefix;
- screened source-evidence status using category-presence markers only;
- observed token counts when non-sensitive and observed cost when non-sensitive;
- activation, credential, response-contract, cost-ledger, graph-validation, quality-gate, full-pipeline, bootstrap, and Workshop preview statuses;
- graph-supported lens counts for Signals, Maps, and Plays;
- explicit no-readiness and no-quality conclusions.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a permanent routing decision. Future `owl-alpha` validation planning is clarified in `owl-alpha-validation-framing.md`: cost-limited: false and sample-limited-by-cost: false, while safety, provenance, quality, private evidence, no-tools/no-web-search, no production writes, and no readiness gates remain active.

The same `ModelProvider` boundary must continue to support gateway and direct provider routes, including future direct Anthropic API and OpenAI API implementations. A future provider/model comparison must have its own approval packet, spend cap, corpus reference, private evidence handling, and sanitized status record.

## Interpretation limits

This packet does not prove provider quality, does not prove launch readiness, does not prove product readiness, does not prove production readiness, and does not prove multi-account readiness. It only authorizes one bounded, screened, live-provider product-preview validation run and requires a later sanitized status record before any interpretation is made.
