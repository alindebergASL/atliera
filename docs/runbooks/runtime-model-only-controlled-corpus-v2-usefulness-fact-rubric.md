# Runtime Model-Only Controlled-Corpus V2 Usefulness Fact Rubric

Status: no-spend sanitized per-account fact-shape/rubric.

This rubric defines the repository-safe fact shape required before material usefulness can be assessed for a v2 controlled-corpus run. It does not execute a provider call, does not read raw provider output, and does not authorize product preview.

## Required per-account fact shape

Each account fact must contain exactly these public-safe fields:

- account_ref: canonical `acct-*` reference
- role: one of `representative`, `edge-case`, `calibration`
- output_counts:
  - excerpts
  - claims
  - account_objects
- hard_invariants:
  - v2_contract_validated
  - canonical_account_ref
  - no_invented_ids
  - all_claims_supported
  - all_account_objects_supported
  - no_private_leakage
- soft_quality:
  - materiality
  - specificity
  - account_usefulness
  - lens_usefulness
  - source_fit

The corpus fact set must include 3-5 accounts, exactly one `representative`, exactly one `edge-case`, exactly one `calibration`, and distinct canonical account refs.

## Classification

- `useful_bounded_signal`: every account passes all hard invariants and all soft quality checks.
- `weak_but_structurally_valid`: every account passes hard invariants, but one or more accounts fails a soft quality check.
- `hard_invariant_blocked`: one or more accounts fails a hard invariant.

A hard invariant blocker must not be hidden as weak usefulness. A weak result must not authorize product preview.

## Safety boundaries

- provider_calls_executed_by_assessment: 0
- provider_spend_by_assessment: false
- raw_or_model_output_read_by_assessment: false
- authorizes_product_preview_run: false
- authorizes_provider_call: false
- authorizes_default_model_selection: false
- launch_readiness_claim: false

## Forbidden public fact material

The public fact shape must not include raw account text, raw prompts, raw provider requests, raw provider responses, model output text, provider bodies, credentials, stack traces, private evidence paths, credential-bearing headers, key values, token values, endpoint details, or client handles.

## Next step after this rubric

The next step is to derive a sanitized per-account fact set from the already-completed private v2 evidence without making a provider call and without committing raw/model output. That derived status should be a separate docs/tests PR.
