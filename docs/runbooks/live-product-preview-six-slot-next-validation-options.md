# Six-Slot Product Preview Next Validation Options

Status: no-spend option analysis after the useful six-slot product-preview assessment.

This document evaluates next validation options using only already-produced, already-sanitized facts from `live-product-preview-six-slot-status.md` and `live-product-preview-six-slot-usefulness-assessment.md`.

This document does not execute a provider call, does not approve provider spend, does not approve provider/model comparison, does not approve corpus expansion, does not approve runtime/model-mode integration, does not approve production writes, and does not imply launch readiness, product readiness, production readiness, broad model quality, or multi-account readiness.

## Inputs

Sanitized facts used:

- six-slot status: `live-product-preview-six-slot-status.md`;
- six-slot usefulness assessment: `live-product-preview-six-slot-usefulness-assessment.md`;
- preview_ref: `live-product-preview-six-slot-20260601a`;
- provider route already exercised: OpenRouter `owl-alpha`;
- operation already exercised: `graph.propose`;
- account_count: 6;
- provider_calls_executed: 6;
- ok_slot_count: 6;
- output counts: excerpts 18, claims 18, account_objects 18;
- graph-supported lens counts: Signals 6, Maps 6, Plays 6;
- useful_lens_count: 3;
- preview_usefulness_classification: `useful`;
- request surface already preserved: no tools, no plugins, no online model variant, no web search;
- production writes: false;
- runtime/model-mode integration: false.

The already-sanitized facts are sufficient to choose the next review surface. They are not sufficient to claim production quality or launch readiness.

## Option A — Stop and harden the current Owl Alpha path

Classification: `safe-but-low-learning`.

This option would add more local guardrails, fixtures, or documentation without a new provider run.

Pros:

- no spend;
- lowest operational risk;
- keeps focus on deterministic substrate.

Cons:

- does not answer whether `owl-alpha` output quality is good relative to production-grade model routes;
- may over-optimize around a free validation model before measuring production-grade behavior;
- does not improve confidence in model-choice boundaries.

Decision: not recommended as the immediate next validation step unless a specific blocker appears.

## Option B — Bounded GPT-5.5 provider-quality comparison approval packet

Classification: `recommended-next-approval-packet`.

This option would create a separate docs-only approval packet for a small GPT-5.5 comparison slice against the already-exercised six-slot product-preview shape. The approval packet would be reviewed and merged before any GPT-5.5 call.

Required approval-packet properties:

- model route: GPT-5.5 through Codex authentication when feasible;
- provider boundary: the same provider-neutral Atliera `ModelProvider` / external-command seam;
- exact slot scope: the already-approved six public-safe slot roles unless amended by review;
- maximum calls: explicitly capped before execution;
- max cost: explicit positive spend cap before execution;
- evidence: raw request/response material and wrapper logs retained outside the repository;
- repository follow-up: sanitized status PR only after execution;
- no tools, no plugins, no web search, and no online model variant;
- no production writes;
- no runtime/model-mode integration;
- no launch, product, or production readiness claim;
- no automatic corpus expansion;
- no default production-model selection.

Why recommended:

- the six-slot `owl-alpha` path is now useful enough to justify comparing quality rather than expanding more free-model volume;
- GPT-5.5 is the likely production-grade OpenAI-family candidate already aligned with the user's planning direction;
- using Codex authentication avoids introducing a separate credential path when feasible, while still preserving Atliera's provider-neutral product boundary;
- the result would answer a concrete quality question: whether a production-grade route materially improves graph proposal quality over the free validation route under the same no-tools/no-search constraints.

Decision: recommended next step, but only as a future separate docs-only approval PR. This option analysis does not authorize the GPT-5.5 calls.

## Option C — Bounded Opus provider-quality comparison approval packet

Classification: `reasonable-later-approval-packet`.

This option would create a separate approval packet for an Opus comparison slice.

Pros:

- strong consultative and reasoning baseline;
- useful as a cross-family quality comparator.

Cons:

- likely higher spend and credential handling complexity;
- can be sequenced after the GPT-5.5/Codex-auth path if GPT-5.5 is the nearer production candidate;
- still needs the same strict no-tools/no-search/private-evidence/sanitized-status boundaries.

Decision: reasonable later, not the immediate recommendation.

## Option D — Expand the Owl Alpha corpus

Classification: `premature-expansion`.

This option would run more `owl-alpha` slots beyond the six-slot slice.

Pros:

- free route can cheaply test more role/corpus diversity;
- useful if the next question is prompt/corpus robustness rather than model quality.

Cons:

- the current six-slot slice already classified as useful;
- more free-model volume does not answer whether production-grade output quality is materially better;
- could create false confidence in a model not intended as production default.

Decision: reject as the immediate next step. Any future corpus expansion needs a separate approval packet.

## Option E — Move toward runtime/product integration

Classification: `premature-integration`.

This option would begin runtime/model-mode integration or production-like product wiring.

Pros:

- moves toward product surface realism.

Cons:

- the current evidence is validation evidence, not production-readiness evidence;
- no provider-quality comparison has been approved or run;
- runtime/model-mode integration has remained explicitly false throughout the validation path.

Decision: reject for now. Runtime/product integration needs later readiness-specific gates and a separate approval surface.

## Recommendation

Recommended next action: create a separate docs-only approval packet for a bounded GPT-5.5 provider-quality comparison slice using Codex authentication when feasible.

The future approval packet should compare GPT-5.5 against the already-sanitized six-slot `owl-alpha` baseline under the same explicit constraints: no tools, no plugins, no online variant, no web search, no production writes, no runtime/model-mode integration, private raw evidence outside the repository, sanitized status follow-up, and no readiness or broad provider-quality claims.

## Safety markers

This option analysis preserves:

- approves_live_provider_call: false;
- approves_provider_spend: false;
- approves_provider_or_model_comparison: false;
- approves_corpus_expansion: false;
- approves_product_preview_expansion: false;
- approves_runtime_model_mode_integration: false;
- approves_production_writes: false;
- web_search_or_tools: false;
- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- broad_provider_quality_claim: false;
- openrouter_lock_in: false;
- codex_auth_secret_material_committed: false.

If a later GPT-5.5 approval packet is created, it must remain a new review surface and must not inherit approval from this options document.
