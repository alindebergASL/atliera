# Live Product Preview Usefulness Remediation

Status: accepted no-spend remediation plan for the first live product preview.

This document applies `planLiveProductPreviewUsefulnessRemediation(...)` to the checked sanitized assessment for preview ref `live-product-preview-20260528a`.

The source assessment is `weak-but-valid` with reason code `insufficient_useful_lenses`: only the Signals lens was materially useful, while the required threshold is two useful Workshop lenses.

## Checked remediation plan

The checked public fixture is `fixtures/validation/live-product-preview-20260528a-remediation-plan.json`.

Plan markers:

- status: `needs-remediation`;
- source_classification: `weak-but-valid`;
- source_reason_codes: `insufficient_useful_lenses`;
- observed useful lenses: 1;
- required useful lenses: 2.

Remediation areas:

- prompt_contract;
- proposal_schema;
- workshop_lens_mapping;
- product_surface_expectations;
- fixture_coverage.

Allowed next actions are deterministic and no-spend only:

- no_spend_prompt_contract_revision;
- proposal_schema_revision;
- workshop_lens_mapping_review;
- product_surface_clarification;
- deterministic_fixture_update.

These actions are intended to make the next product-preview proposal shape elicit, preserve, and render Maps and Plays evidence when the source account supports them. They do not execute or approve a live rerun.

`live-product-preview-lens-diagnostic.md` now applies a narrower diagnostic before any prompt or schema remediation. For `live-product-preview-20260528a`, the diagnostic classifies the weakness as `structure-absent-account-limitation`: the sanitized graph-level evidence contains supported Signals structure but no supported Maps or Plays structure. That means current-account remediation stops here; Atliera must not pressure prompts or schemas to invent unsupported Maps or Plays content.

## Safety output markers

The remediation plan preserves:

- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- approves_live_provider_call: false;
- approves_provider_spend: false;
- approves_expansion_or_comparison: false.

The remediation plan also preserves:

- live_provider_call: false;
- provider_spend: false;
- production_writes: false;
- runtime_model_mode_integration: false;
- provider_or_model_comparison: false;
- corpus_expansion: false;
- product_preview_expansion: false;
- web_search_or_tools: false.

Blocked next actions:

- live_provider_rerun;
- provider_comparison;
- corpus_expansion;
- product_preview_expansion;
- launch_readiness_claim;
- product_readiness_claim;
- production_readiness_claim.

## Boundary interpretation

This remediation plan is no-spend and no-execution. It records no live rerun, no provider comparison, no corpus expansion, no product-preview expansion, no production write, no runtime/model-mode integration, no web search, no tool, and no plugin.

The next Atliera implementation step is not prompt/proposal/schema remediation for this account. `live-product-preview-lens-diagnostic.md` classifies the first live product preview as `structure-absent-account-limitation`, so current-account remediation stops unless a separate approval packet authorizes different validated data. The no-spend path that remains available is fixture-mode validation using the existing deterministic three-lane fixture. `live-product-preview-three-lane-approval.md` is the separate docs-only one-run approval packet for a screened account after that fixture-mode evidence; it does not reopen the first account and still requires a later sanitized status record before interpretation. Any broader `owl-alpha` product-preview validation batch remains a separate future approval decision and must preserve private evidence handling, sanitized status, no-readiness interpretation, and explicit scope.
