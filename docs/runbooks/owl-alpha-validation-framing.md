# Owl Alpha Validation Framing

Status: accepted validation framing for OpenRouter `owl-alpha`.

## Decision

OpenRouter `owl-alpha` is treated as a no-cost validation route for Atliera planning.

Operational framing markers:

- provider route: OpenRouter;
- public model id: `owl-alpha`;
- cost-limited: false;
- sample-limited-by-cost: false;
- safety_provenance_quality_gates: required;
- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- provider_or_model_comparison: separate approval;
- paid_or_premium_models: spend-gated.

The consequence is that `owl-alpha` validation should not be artificially limited by spend; in short, it is not artificially limited by spend. Broader validation can be appropriate when it answers a real product, provenance, repeatability, or rubric question.

## What remains gated

The relaxed cost framing does not relax the safety or evidence framing.

Every `owl-alpha` live validation batch still needs an explicit scope and must preserve:

- private evidence handling;
- sanitized status record after execution;
- no hidden web search;
- no tools or plugins unless explicitly approved;
- no production writes;
- no production deployment;
- no customer-data access unless separately approved;
- no runtime/model-mode integration unless separately approved;
- no launch, product, or production readiness claim;
- no broad provider or model quality claim from one batch;
- no provider/model comparison unless separately approved.

The batch size should be chosen for validation value, not for spend avoidance. Examples of valid sizing reasons include role coverage, edge-case coverage, repeatability, source diversity, output-quality diagnosis, and Workshop usefulness measurement.

## Paid or premium model contrast

Paid or premium models remain spend-gated. Opus 4.8, direct Anthropic API routes, OpenAI API routes, and other non-free or premium validation routes need a separate approval packet with a spend cap, corpus scope, private evidence plan, and sanitized status record.

The intended sequence is:

1. Use `owl-alpha` for broad no-cost iteration over prompts, corpus shape, wrapper behavior, evidence packaging, and usefulness rubrics.
2. Use paid or premium models such as Opus 4.8 for focused high-signal validation or comparison only after the `owl-alpha` path has shaken out avoidable substrate and prompt/rubric issues.
3. Keep gateway and direct provider routes behind the same provider-neutral Atliera seams.

This is not OpenRouter lock-in. The provider boundary must continue to support gateway routes and future direct Anthropic API and OpenAI API implementations without product-logic rewrites.

## Relationship to the live product preview gate

`live-product-preview-usefulness-gate.md` remains the no-spend interpretation gate over already-produced, already-sanitized product-preview facts. It does not authorize provider calls itself.

If the usefulness gate says the product preview is useful, the next approval packet may request a broader `owl-alpha` product-preview validation batch without treating cost as the limiting factor. That later packet still needs explicit scope, private evidence handling, sanitized status, and all safety/provenance/quality gates above.

For the immediate post-fake-mode handoff, `live-product-preview-three-lane-approval.md` is the screened-account one-run approval packet. It remains `owl-alpha`/OpenRouter-scoped, but its size is still one provider call because the purpose is validating a richer Signals/Maps/Plays source path before any broader batch. The later sanitized execution record is `live-product-preview-three-lane-status.md`, and its no-spend applied usefulness assessment is `live-product-preview-three-lane-usefulness-assessment.md`.

The applied three-lane assessment classifies preview ref `live-product-preview-three-lane-20260529a` as `useful`, with graph-backed Signals, Maps, and Plays lens material. It keeps `approves_expansion_or_comparison: false`; the separate broader-batch approval packet is `live-product-preview-broader-batch-approval.md`, and the later sanitized broader-batch status is `live-product-preview-broader-batch-status.md`.

The applied broader-batch assessment classifies preview ref `live-product-preview-broader-batch-20260529b` as `useful`, with graph-backed Signals, Maps, and Plays material across the representative, edge-case, and calibration roles. It keeps `approves_expansion_or_comparison: false`; the separate next bounded approval packet is `live-product-preview-six-slot-approval.md`. The applied six-slot assessment classifies preview ref `live-product-preview-six-slot-20260601a` as `useful`, and the applied no-spend options analysis is `live-product-preview-six-slot-next-validation-options.md`; it recommends a bounded GPT-5.5 provider-quality comparison approval packet using Codex authentication when feasible, without authorizing provider calls, spend, comparison, expansion, or readiness by itself. The separate comparison approval packet is `live-product-preview-gpt55-comparison-approval.md`; it is not an `owl-alpha` rerun, not an OpenRouter reasoning-parameter experiment, and not a production-model selection.

The applied first-preview assessment is `live-product-preview-usefulness-assessment.md`. It classified preview ref `live-product-preview-20260528a` as `weak-but-valid`, so the first-preview path remains no-spend remediation before broader validation.

The remediation plan is `live-product-preview-usefulness-remediation.md`. It keeps live reruns, provider comparison, corpus expansion, product-preview expansion, and readiness claims blocked while planning prompt/proposal/lens/product-surface/fixture work.

If the usefulness gate says the output is weak, zero-output, or contract-failing, the next step remains diagnosis or remediation before broader validation.
