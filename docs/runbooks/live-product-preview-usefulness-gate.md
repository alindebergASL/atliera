# Live Product Preview Usefulness Gate

Status: accepted no-spend assessment gate before any product-preview expansion.

## Purpose

`assessLiveProductPreviewUsefulness(...)` classifies already-produced, already-sanitized one-run live product preview facts after `live-product-preview-status.md`.

The gate exists because the first live product preview proved only that one approved provider response traversed the provider-validation, graph/quality, manifest/bootstrap, and Workshop preview path. It did not decide that the Workshop output is useful enough to expand.

## Scope

The helper consumes sanitized facts only:

- preview ref;
- account count;
- provider calls executed;
- sanitized output counts;
- validation-chain statuses;
- request-surface markers for tools, plugins, online mode, and web search;
- Workshop side-effect markers;
- useful Workshop lens counts and lens labels.

It does not consume raw provider request or response material, source account text, credentials, wrapper logs, private evidence, or provider-specific hidden details.

## Classifications

The helper returns `preview_usefulness_classification` as one of:

- `useful` when the one-run validation chain passes, the request surface stays bounded, the Workshop side-effect boundary holds, output facts are present, and at least two Workshop lenses are materially useful;
- `weak-but-valid` when the validation chain passes but graph output is underproduced or fewer than two Workshop lenses are useful;
- `zero-output` when the validation chain passes but the sanitized output counts are all zero;
- `contract-failure` when validation-chain status, request-surface scope, Workshop side-effect boundary, or input-shape requirements fail.

A useful classification is only a bounded historical product-surface signal. It is not launch readiness and not approval for expansion.

## Safety outputs

Every result preserves:

- `launch_readiness_claim: false`;
- `product_readiness_claim: false`;
- `production_readiness_claim: false`;
- `approves_expansion_or_comparison: false`.

Every result also reports safety fields as false for live provider call, provider spend, production writes, runtime/model-mode integration, provider or model comparison, corpus expansion, product-preview expansion, and web search or tools.

## Explicit non-authorization

This is a no-spend gate. It makes no provider calls, authorizes no provider calls, and records no provider spend.

This gate allows no production writes, no runtime/model-mode integration, no provider comparison, no corpus expansion, no product-preview expansion, no web search, and no tools or plugins.

Any future product-preview expansion, provider comparison, corpus expansion, paid fallback, runtime/model-mode integration, production write, deployment, or web-search/tool capability still requires a separate approval packet with its own scope, spend cap, private evidence plan, and sanitized status record.

## Next-step interpretation

`live-product-preview-usefulness-assessment.md` records the applied no-spend result for preview ref `live-product-preview-20260528a`: `weak-but-valid`, with `insufficient_useful_lenses` because only one materially useful Workshop lens was present. That assessment keeps `approves_expansion_or_comparison: false`.

`live-product-preview-three-lane-usefulness-assessment.md` records the applied no-spend result for preview ref `live-product-preview-three-lane-20260529a`: `useful`, with graph-backed Signals, Maps, and Plays lens material. That assessment also keeps `approves_expansion_or_comparison: false` and does not request another provider call. The separate docs-only approval packet for the bounded broader batch is `live-product-preview-broader-batch-approval.md`; its sanitized execution status is `live-product-preview-broader-batch-status.md`.

`live-product-preview-usefulness-remediation.md` records the next no-spend remediation plan. It maps `insufficient_useful_lenses` to prompt contract, proposal schema, Workshop lens mapping, product-surface expectation, and fixture-coverage work while keeping live reruns, provider comparison, corpus expansion, product-preview expansion, and readiness claims blocked.

`owl-alpha-validation-framing.md` records the current OpenRouter `owl-alpha` planning rule: cost-limited: false, sample-limited-by-cost: false. For `owl-alpha`, a later product-preview expansion packet should choose batch size for safety, provenance, quality, role coverage, and usefulness value, not because spend forces a tiny sample.

- If `useful`, the next step may be a separate approval packet for a bounded product-preview expansion. It is not launch.
- If `weak-but-valid`, the next step is no-spend prompt, rubric, lens, or product-surface remediation before expansion.
- If `zero-output`, the next step is provider-output or prompt/proposal diagnosis before expansion.
- If `contract-failure`, the next step is targeted substrate or safety-boundary repair.
