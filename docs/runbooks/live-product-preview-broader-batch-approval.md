# Live Product Preview Broader Batch Approval

Status: pre-run docs-only approval packet. This PR does not execute the batch. The later sanitized execution record is `live-product-preview-broader-batch-status.md`.

## Decision

This packet approves one bounded `owl-alpha` product-preview validation batch after the useful three-lane assessment in `live-product-preview-three-lane-usefulness-assessment.md`.

The approved batch is exactly three screened account slots, at most three `graph.propose` provider calls, and one Workshop preview render per produced and validated graph. It is a product-surface validation batch only. It checks whether the screened Signals/Maps/Plays path that worked for one account remains useful across a tiny set of screened accounts without changing provider route, retrieval mode, runtime mode, production writes, or readiness posture.

This packet is not a standing approval. It does not authorize any batch beyond this one and does not authorize retries outside the failure-mode rules below.

## Prerequisite evidence

This approval depends on already-merged sanitized evidence, not on a provider call inside this PR:

- `live-product-preview-three-lane-status.md` records the screened one-account three-lane execution status.
- `live-product-preview-three-lane-usefulness-assessment.md` records the no-spend usefulness assessment for preview ref `live-product-preview-three-lane-20260529a`.
- That assessment classified the preview as `useful` with graph-backed Signals, Maps, and Plays lens material.
- The assessment keeps `approves_expansion_or_comparison: false`, so this approval packet is the separate review surface for the next bounded validation batch.
- `owl-alpha-validation-framing.md` records that `owl-alpha` is not cost-limited, while safety, provenance, quality, role coverage, usefulness value, private evidence, and sanitized status gates remain active.

## Approved route and request shape

- provider route: OpenRouter
- public model id: `owl-alpha`
- provider tier: free-tier
- operation: `graph.propose`
- activation approval schema: `atliera.model_activation_approval.v1`
- corpus reference prefix: `external-corpus/live-product-preview-broader-batch/`
- selected scope: exactly three screened account slots
- provider calls: at most three, one per screened account that passes the pre-call source-evidence screen
- Workshop renders: at most three, one render from each produced and validated graph
- expected observed provider cost: `$0.00`
- max batch cost: `$1.50`
- cumulative broader-batch product-preview cap: `$1.50`
- no paid fallback
- private evidence outside the repository
- sanitized status follow-up after execution

The model id is not a launch model or production default. The wrapper may map it internally to the provider's OpenRouter model id, but repository docs and reports should keep only sanitized public identifiers.

## Screened source-evidence prerequisites

The private account selection step must be completed before execution and recorded only as sanitized pass/fail markers in the later status follow-up.

The batch must contain exactly three screened account slots:

1. one representative account expected to support Signals, Maps, and Plays;
2. one edge-case account expected to stress sparse or ambiguous Maps/Plays evidence without encouraging invention;
3. one calibration account expected to support at least two Workshop lenses with clear provenance.

Before any provider call for an account:

1. The account must have source material expected to support at least two of Signals, Maps, and Plays.
2. Across the selected batch, the private source-evidence screen must cover Signals, Maps, and Plays category markers.
3. The source screen is a prerequisite only; it does not pre-write graph objects, claims, or Workshop items.
4. The screen records only sanitized category-presence markers and role labels, not raw source text, private account details, or account identifiers.
5. If an account's source-evidence screen fails, that account is skipped before the provider call and the status follow-up records a sanitized pre-call refusal for that slot.
6. If fewer than two account slots pass the pre-call screen, the batch stops before provider execution and requires a new or amended approval packet. Skipped or failed slots do not create authority to substitute replacement accounts inside this packet.

## Explicitly not approved

This approval explicitly requires:

- no provider comparison;
- no multi-provider comparison;
- no paid fallback;
- no production writes;
- no production deployment;
- no runtime/model-mode integration;
- no worker-loop or autonomous runtime execution;
- no customer-data access;
- no launch, product, or production readiness claim;
- no broad provider quality claim;
- no multi-account readiness claim;
- no standing corpus expansion beyond the three screened account slots;
- no unbounded product-preview expansion beyond this batch.

## No tools, plugins, or live web retrieval

This batch remains a bounded corpus/graph validation path, not a retrieval-enabled provider mode.

The requests must use:

- no `:online` model variant;
- no OpenRouter `web` plugin;
- no `openrouter:web_search` server tool;
- no tools or plugins of any kind.

OpenRouter account-default plugins must be disabled or request-disabled for this batch. If OpenRouter web/search capability is desired later, it is a separate future approval surface because it changes spend, provenance, and evidence semantics.

## Pre-run gate checklist

Before execution:

1. Activation gates must pass for the exact provider route, model id, operation, corpus reference prefix, cost cap, and at-most-three-call scope.
2. Credential readiness must pass without committing credentials or private provider details.
3. The selected account/corpus references must remain outside the repository and under the approved safe prefix.
4. The screened source-evidence prerequisites must pass for at least two account slots before any provider calls.
5. Each request must not include tools, plugins, `:online`, web search, or retrieval settings.
6. The estimated next cost and cumulative expected cost must fit under this packet's caps.
7. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.

## Success criteria

The execution follow-up may record a useful batch signal only if all of the following are true:

- At least two screened account slots execute through the provider path under this packet.
- Activation gates pass for each executed account.
- Credential readiness passes without committing credentials.
- The source-evidence screen passes before each executed provider call.
- Each executed provider call returns a response accepted by the response contract.
- Each cost ledger entry is succeeded and remains within the approved cap.
- Graph validation and quality gate pass for each produced graph output.
- The deterministic full-pipeline package verifies for each executed output.
- Bootstrap evidence verification passes for each sanitized package.
- Workshop preview renders from each produced graph.
- Sanitized graph-supported lens counts are recorded for Signals, Maps, and Plays per executed account and in aggregate.
- The sanitized status follow-up records provider route, public model id, observed token counts, observed cost, validation status, packaging status, bootstrap status, Workshop preview status, source-evidence screen status, and per-slot outcome.
- No post-output substitution is used to create or improve any graph or Workshop preview.

## Failure modes and interpretation

The pre-run interpretation is locked before execution:

1. If the batch produces useful, validated Workshop material for at least two executed accounts, the next step is not launch. The next step is a separate no-spend batch usefulness assessment over already-sanitized facts.
2. If fewer than two account slots pass source screening, no provider calls are made and the status follow-up records sanitized pre-call refusal evidence.
3. If an individual source-evidence screen fails, skip that slot before provider execution; do not replace it inside this packet unless an amended approval names the replacement rule.
4. If source screens pass but Maps or Plays are structure-absent at graph level, the next step is proposal-extraction review before another live run.
5. If supported Maps or Plays graph structure exists but Workshop usefulness fails to surface it, the next step is deterministic Workshop mapping remediation against existing output, not a live rerun by default.
6. If validation, packaging, or bootstrap verification fails, the next step is targeted substrate revision against the concrete surfaced gap.
7. If provider refusal, outage, rate limit, or routing failure prevents accepted output, preserve sanitized refusal evidence and repair or re-approve before retrying.

These outcomes must be recorded as historical facts from one approved batch. They must not be generalized into provider quality, product readiness, launch readiness, production readiness, or multi-account readiness.

## Private evidence and sanitized follow-up

Raw provider request/response material, credentials, wrapper logs, source account content, source-evidence screen details, account identifiers, and private evidence remain outside the repository. The repository may receive only a sanitized status follow-up after execution.

The sanitized status follow-up should include:

- commit under validation;
- provider route;
- public model id;
- operation;
- approved corpus reference prefix;
- per-slot screened source-evidence status using category-presence markers and role labels only;
- observed token counts and observed cost when non-sensitive;
- activation, credential, response-contract, cost-ledger, graph-validation, quality-gate, full-pipeline, bootstrap, and Workshop preview statuses;
- per-slot and aggregate graph-supported lens counts for Signals, Maps, and Plays;
- explicit no-readiness and no-quality conclusions.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a permanent routing decision. Future paid or premium provider/model comparison must have its own approval packet, spend cap, corpus reference, private evidence handling, and sanitized status record.

The same `ModelProvider` boundary must continue to support gateway and direct provider routes, including future direct Anthropic API and OpenAI API implementations.

## Interpretation limits

This packet does not prove provider quality, does not prove launch readiness, does not prove product readiness, does not prove production readiness, and does not prove multi-account readiness. It only authorizes one bounded three-slot `owl-alpha` product-preview validation batch and requires a later sanitized status record before any interpretation is made.
