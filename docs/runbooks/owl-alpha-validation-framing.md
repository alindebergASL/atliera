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

If the usefulness gate says the output is weak, zero-output, or contract-failing, the next step remains diagnosis or remediation before broader validation.
