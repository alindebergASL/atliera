# Live Product Preview Six-Slot Approval

Status: pre-run docs-only approval packet. This PR does not execute the slice. A later sanitized execution record must be committed separately if the slice runs. The later sanitized execution record is `live-product-preview-six-slot-status.md`.

## Decision

This packet approves one bounded `owl-alpha` product-preview validation slice after the useful broader-batch assessment in `live-product-preview-broader-batch-usefulness-assessment.md` and after the Workshop fixture/render guardrails that distinguish renderable GraphBundles from sanitized validation metrics.

The approved slice is exactly six screened account slots, at most six `graph.propose` provider calls, and one Workshop preview render per produced and validated graph. It is a product-surface validation slice only. It checks whether the graph-backed Signals/Maps/Plays path that was useful for the prior three-slot batch remains useful across a slightly broader screened set without changing provider route, retrieval mode, runtime mode, production writes, or readiness posture.

This packet is not a standing approval. It does not authorize any slice, batch, retry set, model route, provider comparison, or corpus growth beyond the exact six-slot scope below.

## Prerequisite evidence

This approval depends on already-merged sanitized evidence and guardrails, not on a provider call inside this PR:

- `live-product-preview-broader-batch-status.md` records the sanitized status for preview ref `live-product-preview-broader-batch-20260529b`.
- `live-product-preview-broader-batch-usefulness-assessment.md` records the no-spend usefulness assessment for that already-executed broader batch.
- That assessment classified the batch as `useful`, with graph-backed Signals, Maps, and Plays material across the representative, edge-case, and calibration roles.
- The assessment keeps `approves_expansion_or_comparison: false`, so this approval packet is the separate review surface for the next bounded validation slice.
- `fixture-smoke-report.json` and `fixture-smoke.ts` provide deterministic render-fixture smoke reporting with `generated_from: "graph_bundle_fixture"`, `provider_calls_made: 0`, `production_writes: false`, and `readiness: false`.
- `non-graph-rejection.test.ts` preserves shape-based refusal of sanitized metrics/status summaries such as `preview_ref`, `output_counts`, and `workshop_surface` when a GraphBundle is required.
- `owl-alpha-validation-framing.md` records that `owl-alpha` is not artificially limited by spend, while safety, provenance, quality, role coverage, usefulness value, private evidence, and sanitized status gates remain active.

## Approved route and request shape

- provider route: OpenRouter
- public model id: `owl-alpha`
- provider tier: free-tier
- operation: `graph.propose`
- activation approval schema: `atliera.model_activation_approval.v1`
- corpus reference prefix: `external-corpus/live-product-preview-six-slot/`
- selected scope: exactly six screened account slots
- provider calls: at most six, one per screened account that passes the pre-call source-evidence screen
- Workshop renders: at most six, one render from each produced and validated graph
- expected observed provider cost: `$0.00`
- max slice cost: `$3.00`
- cumulative six-slot product-preview cap: `$3.00`
- no paid fallback
- private evidence outside the repository
- sanitized status follow-up after execution

The model id is not a launch model or production default. The wrapper may map it internally to the provider's OpenRouter model id, but repository docs and reports should keep only sanitized public identifiers.

## Screened source-evidence prerequisites

The private account selection step must be completed before execution and recorded only as sanitized pass/fail markers in the later status follow-up.

The slice must contain exactly six screened account slots:

1. two representative accounts expected to support Signals, Maps, and Plays;
2. two edge-case accounts expected to stress sparse, ambiguous, or uneven Maps/Plays evidence without encouraging invention;
3. one calibration account expected to support at least two Workshop lenses with clear provenance;
4. one sparse-control account expected to test visibly bounded empty or low-evidence states without treating absence as failure.

Before any provider call for an account:

1. Representative, edge-case, and calibration slots must have source material expected to support at least two of Signals, Maps, and Plays.
2. The sparse-control slot must have enough source material to test refusal, low-evidence labeling, or empty-state rendering without pressuring the model to invent unsupported content.
3. Across the selected slice, the private source-evidence screen must cover Signals, Maps, and Plays category markers.
4. The source screen is a prerequisite only; it does not pre-write graph objects, claims, or Workshop items.
5. The screen records only sanitized category-presence markers and role labels, not raw source text, private account details, or account identifiers.
6. If an account's source-evidence screen fails, that account is skipped before the provider call and the status follow-up records a sanitized pre-call refusal for that slot.
7. If fewer than four account slots pass the pre-call screen, or if no representative slot passes, the slice stops before provider execution and requires a new or amended approval packet. Skipped or failed slots do not create authority to substitute replacement accounts inside this packet.

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
- no standing corpus expansion beyond the six screened account slots;
- no unbounded product-preview expansion beyond this slice.

## No tools, plugins, or live web retrieval

This slice remains a bounded corpus/graph validation path, not a retrieval-enabled provider mode.

The requests must use:

- no `:online` model variant;
- no OpenRouter `web` plugin;
- no `openrouter:web_search` server tool;
- no tools or plugins of any kind.

OpenRouter account-default plugins must be disabled or request-disabled for this slice. If OpenRouter web/search capability is desired later, it is a separate future approval surface because it changes spend, provenance, and evidence semantics.

## Pre-run gate checklist

Before execution:

1. Activation gates must pass for the exact provider route, model id, operation, corpus reference prefix, cost cap, and at-most-six-call scope.
2. Credential readiness must pass without committing credentials or private provider details.
3. The selected account/corpus references must remain outside the repository and under the approved safe prefix.
4. The screened source-evidence prerequisites must pass for at least four account slots, including at least one representative slot, before any provider calls.
5. Each request must not include tools, plugins, `:online`, web search, or retrieval settings.
6. The estimated next cost and cumulative expected cost must fit under this packet's caps.
7. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.

## Success criteria

The execution follow-up may record a useful six-slot product-surface signal only if all of the following are true:

- At least four screened account slots execute through the provider path under this packet.
- At least one representative slot executes through the provider path.
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
- Sparse-control outcomes are reported separately from representative, edge-case, and calibration outcomes.
- No sanitized validation metrics/status summary is treated as a renderable GraphBundle.
- No post-output substitution is used to create or improve any graph or Workshop preview.

## Failure modes and interpretation

The pre-run interpretation is locked before execution:

1. If the slice produces useful, validated Workshop material for at least four executed accounts, the next step is not launch. The next step is a separate no-spend six-slot usefulness assessment over already-sanitized facts.
2. If fewer than four account slots pass source screening, no provider calls are made and the status follow-up records sanitized pre-call refusal evidence.
3. If no representative slot passes source screening, no provider calls are made and the status follow-up records sanitized pre-call refusal evidence.
4. If an individual source-evidence screen fails, skip that slot before provider execution; do not replace it inside this packet unless an amended approval names the replacement rule.
5. If source screens pass but Maps or Plays are structure-absent at graph level, the next step is proposal-extraction review before another live run.
6. If supported Maps or Plays graph structure exists but Workshop usefulness fails to surface it, the next step is deterministic Workshop mapping remediation against existing output, not a live rerun by default.
7. If validation, packaging, bootstrap verification, GraphBundle rendering, or non-GraphBundle rejection fails, the next step is targeted substrate or render-boundary revision against the concrete surfaced gap.
8. If provider refusal, outage, rate limit, or routing failure prevents accepted output, preserve sanitized refusal evidence and repair or re-approve before retrying.

These outcomes must be recorded as historical facts from one approved slice. They must not be generalized into provider quality, product readiness, launch readiness, production readiness, or multi-account readiness.

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
- sparse-control interpretation separated from representative, edge-case, and calibration interpretation;
- explicit no-readiness and no-quality conclusions.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in, not an `owl-alpha` quality conclusion, and not a permanent routing decision. Future paid or premium provider/model comparison must have its own approval packet, spend cap, corpus reference, private evidence handling, and sanitized status record.

The same `ModelProvider` boundary must continue to support gateway and direct provider routes, including future direct Anthropic API and OpenAI API implementations.

## Interpretation limits

This packet does not prove provider quality, does not prove launch readiness, does not prove product readiness, does not prove production readiness, and does not prove multi-account readiness. It only authorizes one bounded six-slot `owl-alpha` product-preview validation slice and requires a later sanitized status record before any interpretation is made.
