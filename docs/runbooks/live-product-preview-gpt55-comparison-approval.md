# Live Product Preview GPT-5.5 Comparison Approval

Status: pre-run docs-only approval packet. This PR does not execute provider calls, does not spend, and does not create raw model evidence. A later sanitized execution record must be committed separately if this comparison runs.

## Decision

This packet approves one bounded provider-quality comparison slice after the useful six-slot `owl-alpha` product-preview assessment and after the no-spend next-validation options analysis recommended a GPT-5.5 comparison packet.

The approved slice compares a GPT-5.5 route against the already-sanitized six-slot `owl-alpha` baseline shape under the same no-tools, no-plugins, no-web-search, no-production-write, and no-runtime-integration constraints.

This packet is not a standing approval. It does not authorize any provider call, retry set, corpus growth, model route, spend, or comparison beyond the exact comparison scope below.

## Prerequisite evidence

This approval depends on already-merged sanitized evidence and guardrails, not on a provider call inside this PR:

- `live-product-preview-six-slot-status.md` records the sanitized six-slot `owl-alpha` status for preview ref `live-product-preview-six-slot-20260601a`.
- `live-product-preview-six-slot-usefulness-assessment.md` records the no-spend usefulness assessment for that already-executed six-slot run.
- That assessment classified the six-slot run as `useful`, with graph-supported Signals, Maps, and Plays counts present across the executed slots.
- `live-product-preview-six-slot-next-validation-options.md` recommends a separate docs-only approval packet for a bounded GPT-5.5 provider-quality comparison using Codex authentication when feasible.
- The options analysis preserves `approves_live_provider_call: false`, `approves_provider_spend: false`, and `approves_provider_or_model_comparison: false`, so this packet is the separate review surface for the comparison.
- `owl-alpha-validation-framing.md` records that `owl-alpha` is a free validation route, not the production default, and that future provider comparisons require their own approval, budget, and sanitized evidence record.

## Approved route and request shape

- comparison name: `live-product-preview-gpt55-comparison-20260602a`
- baseline reference: `live-product-preview-six-slot-20260601a`
- baseline route: OpenRouter `owl-alpha`, already executed and already sanitized
- candidate route: GPT-5.5 through Codex authentication when feasible
- provider boundary: Atliera `ModelProvider` / external-command seam
- operation: `graph.propose`
- activation approval schema: `atliera.model_activation_approval.v1`
- corpus reference prefix: `external-corpus/live-product-preview-six-slot/`
- selected scope: exactly the same six screened slot roles as the baseline unless a pre-run source screen refuses a slot
- candidate provider calls: at most six, one per screened slot that passes the pre-call source-evidence screen
- baseline provider calls: zero new baseline calls under this packet; use only already-sanitized baseline status and already-retained private baseline evidence
- comparison calls: at most six candidate calls total
- max comparison cost: `$30.00`
- cumulative comparison cap: `$30.00`
- no paid fallback route
- private evidence outside the repository
- sanitized status follow-up after execution

The candidate route is not a launch model or production default. Codex authentication is preferred only to avoid introducing a separate credential path when feasible. It must not leak Codex credential material, session data, raw command transcripts with secrets, or provider-controlled private details into the repository.

## Screened source-evidence prerequisites

Before any candidate provider call:

1. The selected slot must match one of the already-approved six-slot roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, or sparse-control.
2. Representative, edge-case, and calibration slots must have source material expected to support at least two of Signals, Maps, and Plays.
3. The sparse-control slot must have enough source material to test refusal, low-evidence labeling, or empty-state rendering without pressuring the model to invent unsupported content.
4. Across the executed comparison slice, the private source-evidence screen must cover Signals, Maps, and Plays category markers unless the run stops before execution.
5. The source screen is a prerequisite only; it does not pre-write graph objects, claims, or Workshop items.
6. The screen records only sanitized category-presence markers and role labels, not raw source text, private account details, or account identifiers.
7. If a slot's source-evidence screen fails, that slot is skipped before the candidate provider call and the status follow-up records a sanitized pre-call refusal for that slot.
8. If fewer than four slots pass the pre-call screen, or if no representative slot passes, the comparison stops before candidate provider execution and requires a new or amended approval packet.
9. Skipped or failed slots do not create authority to substitute replacement accounts inside this packet.

## Explicitly not approved

This approval explicitly requires:

- no new `owl-alpha` baseline rerun;
- no `owl-alpha` reasoning rerun;
- no OpenRouter reasoning-parameter experiment;
- no Opus route;
- no additional GPT model route beyond GPT-5.5;
- no paid fallback;
- no production writes;
- no production deployment;
- no runtime/model-mode integration;
- no worker-loop or autonomous runtime execution;
- no customer-data access;
- no launch, product, or production readiness claim;
- no broad provider quality claim;
- no multi-account readiness claim;
- no standing corpus expansion beyond the same six screened slot roles;
- no unbounded product-preview expansion beyond this comparison slice;
- no default production-model selection.

## No tools, plugins, or live web retrieval

This comparison remains a bounded corpus/graph validation path, not a retrieval-enabled provider mode.

The requests must use:

- no online model variant;
- no web plugin;
- no server-side web-search tool;
- no tools or plugins of any kind;
- no external retrieval setting supplied by the provider wrapper.

Account-default plugins or search behaviors must be disabled or request-disabled for this slice. If web/search capability is desired later, it is a separate future approval surface because it changes spend, provenance, and evidence semantics.

## Codex-auth bridge requirements

If Codex authentication is used:

1. The bridge must remain outside committed source unless implemented as a credential-neutral adapter that contains no secrets, no user/session tokens, and no provider-specific private endpoints.
2. The bridge must expose only the Atliera `ModelProvider` request and response contract to Atliera code.
3. The bridge must not grant tools, shell access, web search, file access, or plugin access to the candidate model request.
4. The bridge must preserve the exact `graph.propose` prompt contract and reject markdown JSON fences in candidate output.
5. The bridge must capture raw request/response material only in private evidence storage outside the repository.
6. The sanitized follow-up must identify the candidate route as GPT-5.5 through Codex authentication when feasible, without publishing secret material or private session details.
7. If Codex authentication cannot be used safely, execution stops and the status follow-up records a sanitized blocker instead of switching credential paths inside this packet.

## Pre-run gate checklist

Before execution:

1. Activation gates must pass for the exact candidate route, operation, corpus reference prefix, cost cap, and at-most-six-call scope.
2. Credential readiness must pass without committing credentials or private provider details.
3. The selected account/corpus references must remain outside the repository and under the approved safe prefix.
4. The screened source-evidence prerequisites must pass for at least four slots, including at least one representative slot, before candidate calls.
5. Each request must not include tools, plugins, online variants, web search, or retrieval settings.
6. The estimated next cost and cumulative expected cost must fit under this packet's caps.
7. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.
8. Baseline comparison inputs must come from already-sanitized `owl-alpha` status and private retained evidence, not from a new baseline rerun.

## Success criteria

The execution follow-up may record a bounded provider-quality comparison signal only if all of the following are true:

- At least four screened candidate slots execute through the GPT-5.5 provider path under this packet.
- At least one representative slot executes through the candidate provider path.
- Activation gates pass for each executed candidate slot.
- Credential readiness passes without committing credentials.
- The source-evidence screen passes before each executed candidate call.
- Each executed candidate provider call returns a response accepted by the response contract.
- Each candidate cost ledger entry is succeeded and remains within the approved cap.
- Graph validation and quality gate pass for each produced candidate graph output.
- The deterministic full-pipeline package verifies for each executed candidate output.
- Bootstrap evidence verification passes for each sanitized candidate package.
- Workshop preview renders from each produced candidate graph.
- Sanitized candidate graph-supported lens counts are recorded for Signals, Maps, and Plays per executed slot and in aggregate.
- Candidate outputs are compared only against the already-approved six-slot `owl-alpha` baseline facts for the same role shape.
- Sparse-control outcomes are reported separately from representative, edge-case, and calibration outcomes.
- No sanitized validation metrics/status summary is treated as a renderable GraphBundle.
- No post-output substitution is used to create or improve any graph or Workshop preview.

## Failure modes and interpretation

The pre-run interpretation is locked before execution:

1. If the candidate slice produces stronger validated Workshop material than the baseline, the next step is not launch. The next step is a separate no-spend comparison usefulness assessment over already-sanitized facts.
2. If the candidate slice is similar to the baseline, the next step is prompt/contract review or cost-benefit analysis, not a production-model decision.
3. If the candidate slice is weaker than the baseline, the next step is route/adapter/prompt diagnosis before another live comparison.
4. If fewer than four slots pass source screening, no candidate provider calls are made and the status follow-up records sanitized pre-call refusal evidence.
5. If no representative slot passes source screening, no candidate provider calls are made and the status follow-up records sanitized pre-call refusal evidence.
6. If an individual source-evidence screen fails, skip that slot before provider execution; do not replace it inside this packet unless an amended approval names the replacement rule.
7. If validation, packaging, bootstrap verification, GraphBundle rendering, or non-GraphBundle rejection fails, the next step is targeted substrate or render-boundary revision against the concrete surfaced gap.
8. If provider refusal, outage, rate limit, credential failure, Codex-auth blocker, or routing failure prevents accepted output, preserve sanitized refusal evidence and repair or re-approve before retrying.

These outcomes must be recorded as historical facts from one approved comparison slice. They must not be generalized into broad provider quality, product readiness, launch readiness, production readiness, multi-account readiness, or default production-model selection.

## Private evidence and sanitized follow-up

Raw provider request/response material, credentials, wrapper logs, source account content, source-evidence screen details, account identifiers, Codex authentication details, and private evidence remain outside the repository. The repository may receive only a sanitized status follow-up after execution.

The sanitized status follow-up should include:

- commit under validation;
- comparison name;
- baseline reference;
- candidate route;
- operation;
- approved corpus reference prefix;
- per-slot screened source-evidence status using category-presence markers and role labels only;
- observed token counts and observed cost when non-sensitive;
- activation, credential, response-contract, cost-ledger, graph-validation, quality-gate, full-pipeline, bootstrap, and Workshop preview statuses;
- per-slot and aggregate candidate graph-supported lens counts for Signals, Maps, and Plays;
- sparse-control interpretation separated from representative, edge-case, and calibration interpretation;
- comparison interpretation against already-sanitized baseline facts only;
- explicit no-readiness and no-broad-quality conclusions.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in, not OpenAI lock-in, not a GPT-5.5 quality conclusion, not an `owl-alpha` quality conclusion, and not a permanent routing decision.

The same `ModelProvider` boundary must continue to support gateway and direct provider routes, including future direct Anthropic API, direct OpenAI API, and gateway implementations.

## Interpretation limits

This packet does not prove provider quality, does not prove launch readiness, does not prove product readiness, does not prove production readiness, and does not prove multi-account readiness. It only authorizes one bounded GPT-5.5 comparison approval surface and requires a later sanitized status record before any interpretation is made.
