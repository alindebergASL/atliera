# Runtime Model-Only Controlled-Corpus V2 Derived Usefulness Facts

Status: no-spend sanitized per-account v2 usefulness fact derivation.

Source status: `runtime-model-only-controlled-corpus-v2-status.md`.
Rubric: `runtime-model-only-controlled-corpus-v2-usefulness-fact-rubric.md`.

This status records public-safe per-account usefulness facts derived from the already-completed v2 controlled-corpus run. The derivation did not execute a provider call and this document does not commit raw account text, raw prompts, raw requests, raw responses, provider bodies, model output text, credentials, stack traces, or private evidence details.

## Derivation execution

- provider_calls_executed_by_derivation: 0
- provider_spend_by_derivation: false
- raw_or_model_output_committed: false
- facts_status: derived

## Assessment summary

- assessment_status: pass
- overall_classification: useful_bounded_signal
- total_accounts: 3
- useful_accounts: 3
- weak_accounts: 0
- hard_blocked_accounts: 0
- excerpts: 9
- claims: 7
- account_objects: 3

## Sanitized per-account facts

### acct-representative

- role: representative
- output_counts.excerpts: 3
- output_counts.claims: 2
- output_counts.account_objects: 1
- hard_invariants.v2_contract_validated: true
- hard_invariants.canonical_account_ref: true
- hard_invariants.no_invented_ids: true
- hard_invariants.all_claims_supported: true
- hard_invariants.all_account_objects_supported: true
- hard_invariants.no_private_leakage: true
- soft_quality.materiality: true
- soft_quality.specificity: true
- soft_quality.account_usefulness: true
- soft_quality.lens_usefulness: true
- soft_quality.source_fit: true

### acct-edge-case

- role: edge-case
- output_counts.excerpts: 3
- output_counts.claims: 2
- output_counts.account_objects: 1
- hard_invariants.v2_contract_validated: true
- hard_invariants.canonical_account_ref: true
- hard_invariants.no_invented_ids: true
- hard_invariants.all_claims_supported: true
- hard_invariants.all_account_objects_supported: true
- hard_invariants.no_private_leakage: true
- soft_quality.materiality: true
- soft_quality.specificity: true
- soft_quality.account_usefulness: true
- soft_quality.lens_usefulness: true
- soft_quality.source_fit: true

### acct-calibration

- role: calibration
- output_counts.excerpts: 3
- output_counts.claims: 3
- output_counts.account_objects: 1
- hard_invariants.v2_contract_validated: true
- hard_invariants.canonical_account_ref: true
- hard_invariants.no_invented_ids: true
- hard_invariants.all_claims_supported: true
- hard_invariants.all_account_objects_supported: true
- hard_invariants.no_private_leakage: true
- soft_quality.materiality: true
- soft_quality.specificity: true
- soft_quality.account_usefulness: true
- soft_quality.lens_usefulness: true
- soft_quality.source_fit: true

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

product-preview approval recommended: false

next step: separate docs-only product-preview approval packet decision

This derived status is a bounded usefulness signal for the completed controlled-corpus v2 run. It does not itself authorize a product-preview run or any other provider call. If the project proceeds, the next action should be a separate docs-only approval packet decision with explicit scope, cost cap, corpus, status-follow-up, and non-readiness boundaries.

## Non-claims

- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
