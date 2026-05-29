# Live Product Preview Lens Diagnostic

Status: accepted no-spend diagnostic for the first live product-preview lens weakness.

This document applies `classifyLiveProductPreviewLensDiagnostic(...)` to sanitized aggregate graph and Workshop lens facts for preview ref `live-product-preview-20260528a`.

The purpose is to force a terminal decision before remediation drift. A weak lens result must not automatically turn into prompt or schema work. First, Atliera must determine whether Maps or Plays structure was present in the sanitized graph and failed to surface, or whether the one-account evidence simply did not contain Maps or Plays structure.

## Checked diagnostic fixtures

- Input: `fixtures/validation/live-product-preview-20260528a-lens-diagnostic-input.json`
- Report: `fixtures/validation/live-product-preview-20260528a-lens-diagnostic-report.json`

The checked input contains only sanitized aggregate counts:

- graph_supported_lens_item_counts: Signals 1, Maps 0, Plays 0;
- workshop_lens_item_counts: Signals 1, Maps 0, Plays 0;
- useful_lens_item_counts: Signals 1, Maps 0, Plays 0;
- useful_lenses: Signals only.

The checked report classifies the first live product preview as `structure-absent-account-limitation`, not as a mapping gap. The graph-level evidence basis is that sanitized supported graph objects existed only for Signals; there were no sanitized supported Maps or Plays objects for the Workshop mapping to surface. Its `terminal_next_action` is `stop_current_account_remediation`.

## Classification meanings

`structure-present-mapping-gap` means sanitized graph-level objects for Maps or Plays exist, but Workshop usefulness still does not surface those supported lens items. Terminal next action: `fix_workshop_lens_mapping_against_existing_outputs`. This is a one-PR deterministic mapping fix and fixture-mode validation path, not a live rerun path.

`structure-absent-account-limitation` means the one live account has no sanitized supported Maps or Plays structure. Terminal next action: `stop_current_account_remediation`. This terminates remediation for this account and prevents prompt or schema pressure to invent Maps or Plays content. The only no-spend follow-up is `use_existing_three_lane_fixture_for_mapping_validation`, using `fixtures/graph/valid/workshop-three-lane.json` because it already contains deterministic supported Signals, Maps, and Plays structure.

`insufficient-sanitized-evidence` means the checked diagnostic cannot make a lens decision because sanitized graph or output counts are absent. Terminal next action: `stop_until_sanitized_graph_lens_counts_exist`.

`contract-failure` means the validation chain did not pass. Terminal next action: `stop_until_contract_failure_is_fixed`.

## Exit criterion

A later live product-preview approval packet may only be considered after deterministic fixture mode demonstrates at least two materially useful Workshop lenses against supported existing outputs when the source account supports them. The criterion is recorded as `two_materially_useful_lenses_in_fixture_mode_against_supported_existing_outputs`.

That criterion is now used by `live-product-preview-three-lane-approval.md`, a docs-only one-run approval packet for a screened account whose private source-evidence screen is expected to support Signals plus at least one of Maps or Plays. The approval packet does not reopen current-account remediation and does not pressure prompts or schemas to invent unsupported content.

This criterion does not approve any live provider call by itself. It only defines the no-spend boundary for deciding whether a separate future approval packet is even worth drafting.

## Safety boundaries

The diagnostic preserves:

- launch_readiness_claim: false;
- product_readiness_claim: false;
- production_readiness_claim: false;
- approves_live_provider_call: false;
- approves_provider_spend: false;
- approves_expansion_or_comparison: false.

It also preserves:

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
- prompt_or_schema_pressure_for_unsupported_lens_content;
- launch_readiness_claim;
- product_readiness_claim;
- production_readiness_claim.

The diagnostic must not pressure the provider or prompt to invent Maps or Plays content when the source account supports only Signals. If Maps or Plays structure is absent, that is an account/evidence limitation, not a reason to weaken provenance or expand scope without a separate approval packet.
