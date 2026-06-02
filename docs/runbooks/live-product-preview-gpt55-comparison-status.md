# Live Product Preview GPT-5.5 Comparison Status

Status: sanitized successful bounded comparison status.

This document records the execution follow-up for the approved bounded GPT-5.5 comparison slice. The run executed privately and this repository receives only sanitized status facts.

## Scope

- comparison name: `live-product-preview-gpt55-comparison-20260602a`
- approval packet: `docs/runbooks/live-product-preview-gpt55-comparison-approval.md`
- validated_commit: `1c6f8d8eccc4f1809bd7ac5b3834fedde3619255`
- baseline reference: `live-product-preview-six-slot-20260601a`
- baseline route: `owl-alpha`
- candidate route: `openai-codex`
- candidate model: `gpt-5.5`
- operation: `graph.propose`
- provider boundary: `ExternalCommandModelProvider`
- corpus reference prefix: `external-corpus/live-product-preview-six-slot/live-product-preview-gpt55-comparison-20260602a`
- selected roles: representative, representative, edge-case, edge-case, calibration, sparse-control
- provider_calls_approved: 6
- provider_calls_executed: 6
- ok_slot_count: 6

## Pre-call source screen

- source_evidence_screen: passed
- source_evidence_screen_passed_count: 6
- signals_category_present: true
- maps_category_present: true
- plays_category_present: true
- private_source_text_committed: false
- prewrote_graph_objects: false
- replacement_accounts_used: false

## Candidate validation summary

Each executed candidate slot recorded:

- activation_gates: pass
- credential_status: pass
- provider_call: pass
- response_contract: pass
- cost_ledger_entry: pass
- ledger_status: succeeded
- packaging_ok: pass
- full_pipeline_quality_gate_status: pass
- bootstrap_ok: pass
- workshop_preview_ok: pass
- workshop_provider_calls_made: 0
- workshop_production_writes: false
- graph_build_failure: none

Aggregate candidate output:

- output_counts: excerpts=18, claims=18, account_objects=18
- graph_supported_lens_item_counts: signals=6, maps=6, plays=6
- lens_evidence_packet_counts: signals=6, maps=6, plays=6
- tokens: input=5929, output=4630
- observed_cost_usd: 0
- estimated_cost_usd: 0.06

## Bounded comparison interpretation

This is a bounded comparison signal: GPT-5.5 produced six accepted candidate graph outputs across the same six screened role shapes, and each rendered with graph-supported Signals, Maps, and Plays under the existing validation, packaging, bootstrap, and Workshop preview gates.

The sparse-control slot is reported as part of the approved role set, not as proof that sparse real-world accounts are broadly solved.

This is not a launch-readiness, product-readiness, production-readiness, broad model-quality, or default-model-selection claim. It does not select GPT-5.5 as a production default and does not deprecate `owl-alpha` as a validation route.

## Safety and evidence boundaries

- raw_request_committed: false
- raw_response_committed: false
- raw_evidence_committed: false
- private_wrapper_committed: false
- private_runner_committed: false
- credentials_committed: false
- provider_body_committed: false
- provider_transcript_committed: false
- private_source_text_committed: false
- private_account_details_committed: false
- private_paths_committed: false
- production_writes: false
- runtime_model_mode_integration: false
- web_search_requested: false
- tools_or_plugins_requested: false
- online_model_variant_requested: false
- paid_fallback_used: false
- no_post_output_substitution_used: true
- corpus_expansion_beyond_approved_slots: false

## Non-readiness markers

- launch_readiness_claim: false
- product_readiness_claim: false
- production_readiness_claim: false
- default_production_model_selection: false
- broad_model_quality_claim: false
- multi_account_readiness_claim: false
- provider_lock_in: false

## Next step

next step: separate no-spend comparison usefulness assessment over these already-sanitized facts. That assessment should compare candidate and baseline usefulness without making provider calls, without reading raw private evidence into the repository, and without converting this bounded status into readiness or model-selection claims.
