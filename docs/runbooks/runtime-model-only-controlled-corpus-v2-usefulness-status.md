# Runtime Model-Only Controlled-Corpus V2 Usefulness Status

Status: no-spend v2 usefulness-readiness assessment.

Source status: `runtime-model-only-controlled-corpus-v2-status.md`.

This assessment uses only sanitized v2 status facts. It does not read raw provider output, does not read model output text, and does not execute a provider call.

## Assessment execution

- provider_calls_executed_by_assessment: 0
- provider_spend_by_assessment: false
- assessment_status: structural_pass_usefulness_deferred

## Sanitized facts considered

- v2_contract_validated: true
- v2_account_ref_count: 3
- v2_counts.excerpts: 9
- v2_counts.claims: 7
- v2_counts.account_objects: 3
- prior_run_status: completed
- prior_provider_calls_executed: 1
- prior_usefulness_evaluated: false

## Interpretation

The v2 corrected run removed the hard structural blocker observed in the prior v1 run. The sanitized status facts now show:

- canonical account references were accepted by the committed v2 validator
- the controlled corpus covered three account references
- the output included excerpts, claims, and account_objects
- the v2 status recorded no raw/private evidence committed

hard_blockers_remaining: false

However, the public sanitized status does not include enough per-account materiality, specificity, lens-usefulness, or source-fit facts to score material usefulness without reading raw/model output or inventing evidence.

material_usefulness_evaluated: false

Therefore this assessment does not recommend product-preview approval yet.

product-preview approval recommended: false

next step: no-spend sanitized per-account usefulness rubric

That next step should define a repository-safe public fact shape that can be derived from private evidence without committing raw account text or model output. Only after such sanitized per-account facts exist should a separate usefulness assessment decide whether a product-preview approval packet is justified.

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

## Non-claims

- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

This status is a narrow structural interpretation of sanitized v2 facts only. It is not a model-quality result, not a product-readiness result, and not authorization for another provider run.
