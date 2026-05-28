# Opus Review Packet: Live Product Preview Remediation

Purpose: consultative, non-authoritative architecture and safety review for PR #116.

Please review the proposed Atliera no-spend remediation plan. Treat this as advisory only; repository tests, safety contracts, and the current user decision remain authoritative.

## Context

Recent state:

- PR #115 applied `assessLiveProductPreviewUsefulness(...)` to preview ref `live-product-preview-20260528a`.
- The sanitized result was `weak-but-valid` with `insufficient_useful_lenses`.
- The validation chain passed, output counts were nonzero, request surface stayed bounded, and Workshop side effects stayed bounded.
- The weak signal was product-surface coverage: only Signals was materially useful; Maps and Plays were not materially useful in the one-run preview.

PR #116 adds a deterministic no-spend remediation plan before any live rerun, provider comparison, corpus expansion, or product-preview expansion.

## Files to review

- `src/validation/live-product-preview-remediation-plan.ts`
- `tests/validation/live-product-preview-remediation-plan.test.ts`
- `tests/safety/live-product-preview-remediation-plan-contract.test.ts`
- `fixtures/validation/live-product-preview-20260528a-remediation-plan.json`
- `docs/runbooks/live-product-preview-usefulness-remediation.md`
- linked docs that reference the remediation runbook

## Intended behavior

`planLiveProductPreviewUsefulnessRemediation(...)` should:

- accept only a sanitized `weak-but-valid` live product-preview usefulness assessment;
- map `insufficient_useful_lenses` to bounded no-spend remediation areas;
- reject `useful`, `zero-output`, and `contract-failure` as the wrong entrypoint;
- reject unsafe refs, contradictory metrics, broadening safety flags, and hostile accessor-backed input;
- return only deterministic remediation labels;
- preserve all readiness and approval flags as false.

Expected remediation areas:

- prompt_contract;
- proposal_schema;
- workshop_lens_mapping;
- product_surface_expectations;
- fixture_coverage.

Expected allowed actions:

- no_spend_prompt_contract_revision;
- proposal_schema_revision;
- workshop_lens_mapping_review;
- product_surface_clarification;
- deterministic_fixture_update.

## Safety boundaries

The PR must not approve or perform:

- no provider call;
- no provider spend;
- no provider comparison;
- no corpus expansion;
- no product-preview expansion;
- no production write;
- no runtime/model-mode integration;
- no web search;
- no tools or plugins;
- no readiness claim.

## Questions for Opus

1. Is the remediation plan correctly sequenced before any broader `owl-alpha` validation batch?
2. Are the remediation areas sufficient for the observed `insufficient_useful_lenses` result?
3. Does the helper reject enough malformed or hostile sanitized inputs?
4. Does any wording accidentally imply readiness, model quality, expansion approval, comparison approval, or live rerun approval?
5. Is there a narrower or safer deterministic next slice before requesting another live product-preview approval packet?

Please return:

- blocking issues, if any;
- nonblocking suggestions, if any;
- a final advisory verdict.
