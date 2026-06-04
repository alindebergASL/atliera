# Runtime Model-Only Product-Preview Runtime Smoke Next-Slice Options Analysis

Status: no-spend options analysis. This document does not execute or approve a provider call.

source_status: runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status.md
source_usefulness_assessment: runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment.md
source_usefulness_status: pass
source_usefulness_classification: useful
source_provider_calls_executed_by_assessment: 0
source_useful_lenses: signals, maps, plays

This analysis consumes only committed sanitized status and usefulness facts. It does not read raw/private evidence, perform network access, call a provider, spend, ingest graph data, write to production, compare providers, or select a default model/runtime.

## Options considered

### Option A: six-slot runtime/model-mode product-preview approval

- option_ref: six-slot-runtime-model-mode-product-preview-approval
- selected: true
- selected_slice_is_docs_only: true
- recommended_next_slice: six-slot-runtime-model-mode-product-preview-approval
- rationale: the three-slot result is useful, but the evidence is still a tiny historical slice. A six-slot follow-up can test whether the same Signals/Maps/Plays shape survives a modestly broader public-safe role spread before any comparison or runtime/default decision.
- proposed_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control
- proposed_max_provider_calls: 6
- proposed_max_attempts: 1
- proposed_status_followup_required: true
- proposed_no_spend_usefulness_followup_required: true

### Option B: provider/model comparison approval

- option_ref: provider-model-comparison-approval
- selected: false
- why_not_provider_comparison_yet: three-slot signal is useful but still tiny
- boundary: a comparison now would risk interpreting a narrow product-surface smoke as a model-quality benchmark. A later comparison should use a separately reviewed approval packet after broader role coverage is checked.

### Option C: runtime/default model integration

- option_ref: runtime-default-model-integration
- selected: false
- why_not_runtime_defaulting_yet: no default model or runtime selection is authorized
- boundary: the current signal validates a bounded product-preview path, not a durable runtime selection, production default, graph-ingestion path, or readiness claim.

### Option D: Workshop/render-only hardening

- option_ref: workshop-render-hardening
- selected: false
- rationale: render guardrails remain important, but the current decision point is whether the model-only product-preview extraction shape survives modestly broader screened role coverage.

## Recommendation

Proceed with a separate docs-only six-slot expansion approval packet.

The recommended approval packet should authorize only a future bounded execution after merge, and should require:

- exactly six public-safe screened slot roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control
- max_provider_calls: 6
- max_attempts: 1
- approved_max_cost_usd: 6
- private source screening before each call
- stop rather than substitute if any required slot fails screening
- no retry without new approval
- no tools/search/plugins/online model variant/MCP/shell/file access/retrieval/session carryover
- no provider comparison
- no default model/runtime selection
- no graph ingestion
- no production writes/use
- no background orchestrator bypass
- sanitized status follow-up after any attempted provider request
- a later no-spend six-slot usefulness assessment before broader expansion, comparison, runtime integration, or readiness discussion

## Authorization state

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- authorizes_background_orchestrator_bypass: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- provider_lock_in: false
- requires_separate_approval_packet: true
- requires_separate_execution_after_merge: true

## Interpretation boundary

This options analysis is a decision aid only. It does not itself approve or execute the recommended slice. The next artifact must be a separate reviewed docs-only approval packet with safety tests and a no-provider-call planner check.
