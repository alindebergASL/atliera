# Runtime Model-Only Product-Preview Next Validation Options

Status: no-spend options packet. This document does not execute or approve a provider call.

Input assessment: `runtime-model-only-product-preview-retry-usefulness-assessment.md`.
Completed retry status: `runtime-model-only-product-preview-retry-status.md`.

The retry produced a useful bounded transport and public-contract signal. The next validation work can proceed along three lanes, all still provider-neutral and non-readiness-claiming.

## Lane 3A — product-preview expansion

- lane_id: 3A_product_preview_expansion
- purpose: test whether the completed single-slot product-preview contract signal holds across a tiny screened-account set
- proposed_next_live_slice: tiny_multi_slot_product_preview
- proposed_screened_account_slots: 3
- proposed_max_provider_calls: 3
- proposed_max_cost_usd: 3
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- runtime_surface: app-owned-model-only-harness
- corpus_ref: product-preview/tiny-screened-three-slot-v1
- prompt_contract_ref: prompts/product-preview-model-only-v1
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts

Required boundaries for this lane:

- private source screening before each call
- stop rather than substitute if a slot fails screening
- no tools, web search, plugins, MCP, shell, file access, retrieval, production writes, or graph ingestion
- raw/source/model/provider evidence remains private
- sanitized status follow-up required
- no retry beyond the approved call count

## Lane 3B — no-spend provider comparison

- lane_id: 3B_no_spend_provider_comparison
- purpose: compare already-sanitized GPT-5.5 retry facts against prior sanitized Owl Alpha or baseline preview facts
- provider_calls_authorized: 0
- provider_spend_authorized: false
- comparison_mode: deterministic_sanitized_facts_only
- default_model_selection_claim: false
- provider_lock_in: false

This lane should run before any formal provider/model selection claim. It may compare public-safe counts, contract validation status, useful-lens availability when present, and safety boundaries. It must not read raw provider output or private account evidence.

## Lane 3C — runtime integration hardening

- lane_id: 3C_runtime_integration_hardening
- purpose: harden the app-owned harness and product/runtime boundaries before background orchestration or graph ingestion
- provider_calls_authorized: 0
- provider_spend_authorized: false
- graph_ingestion_authorized: false
- background_orchestrator_authorized: false
- production_writes_authorized: false

Suggested no-spend work:

- make sanitized status rendering reusable and fail-closed
- add descriptor-snapshot/no-reread regressions around status inputs
- add a dry-run CLI wrapper for product-preview harness jobs that reports planned request metadata without provider access
- require a separate live approval before any runtime/model-mode smoke, graph ingestion, or background orchestrator path

## Recommendation

- recommended_next_lane: 3A_product_preview_expansion
- recommendation_reason: the retry proved the model-only transport and v2 public contract for one screened slot; the next highest-signal live slice is a tiny screened multi-slot expansion while keeping 3B and 3C as no-spend follow-ups
- requires_separate_approval_packet: true
- approval_packet_should_be_docs_only: true

## Authorization state

- authorizes_provider_call: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_runtime_model_mode_integration: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false

This options packet does not itself approve any provider call, comparison, default model selection, runtime integration, graph ingestion, production use, or background orchestration.
