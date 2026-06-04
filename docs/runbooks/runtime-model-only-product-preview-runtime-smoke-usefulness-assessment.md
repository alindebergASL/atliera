# Runtime Model-Only Product-Preview Runtime Smoke Usefulness Assessment

Status: applied deterministic no-spend assessment.

Source status: `runtime-model-only-product-preview-runtime-smoke-corrected-retry-status.md`.
Follow-up approval packet: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-approval-packet.md` records the later separate docs-only approval. The authorization markers below remain historical markers for this no-spend assessment record.
Assessment helper: `src/product-preview/runtime-smoke-usefulness-assessment.ts`.
Sanitized input fixture: `fixtures/validation/runtime-smoke-corrected-retry-usefulness-input.json`.
Sanitized assessment fixture: `fixtures/validation/runtime-smoke-corrected-retry-usefulness-assessment.json`.

This follow-up interprets the already-captured corrected runtime/model-mode smoke result. It does not execute a provider call, does not retry the smoke, does not perform provider/model comparison, does not ingest into the graph, does not render a Workshop runtime surface, does not write to production, and does not choose a default model.

The private derivation step inspected only the previously captured v2 output outside the repository and converted it into the sanitized projection committed here. The committed helper and fixtures contain only counts, public object-type categories, support-coverage counts, lens counts, stable refs, and false boundary markers. Raw prompt material, private account text, model output text, request/response bodies, provider metadata, credential material, wrapper logs, private evidence details, and local evidence paths are not committed.

## Assessment result

- assessment_ref: runtime-smoke-corrected-retry-usefulness-20260604e
- status_ref: runtime-model-only-product-preview-runtime-smoke-corrected-retry-20260604e
- source_status: completed
- source_provider_calls_executed: 1
- assessment_provider_calls_executed: 0
- status: pass
- usefulness_classification: useful
- useful_lens_count: 3
- useful_lenses: `signals`, `maps`, `plays`
- lens_counts: maps 1, signals 2, plays 1
- output counts: excerpts 4, claims 3, account_objects 4
- object_type_counts: account_snapshot 1, signal 1, risk 1, play 1
- support coverage: excerpt text presence 4/4, claim text presence 3/3, claim support 3/3, account-object summary presence 4/4, account-object support 4/4
- reasons: none
- recommends_next_step: separate-tiny-expansion-approval-packet

## Why this is useful

The corrected runtime smoke produced a lens-complete public v2 shape for the calibration slot:

- `maps` coverage from the account snapshot category
- `signals` coverage from signal/risk categories
- `plays` coverage from the play category

It also met the deterministic support thresholds used by the no-spend assessment:

- at least 3 public-safe excerpts
- at least 2 public-safe claims
- at least 3 public-safe account objects
- all committed support-coverage counts matched the public output counts
- no assessment boundary broadened

This is useful as a bounded historical product-surface signal. It means the captured one-slot runtime/model-mode output was not merely schema-valid; it had enough public v2 structure and lens coverage to inform the next reviewed decision.

## Authorization state after assessment

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_product_preview_expansion: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_graph_ingestion: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- launch_readiness_claim: false
- product_readiness_claim: false
- production_readiness_claim: false
- provider_lock_in: false

## Safety boundary

- provider_call_by_assessment: false
- provider_spend_by_assessment: false
- network_access_by_assessment: false
- graph_ingestion: false
- production_writes: false
- runtime_model_mode_integration: false
- provider_or_model_comparison: false
- default_model_selection: false
- product_preview_expansion: false
- readiness_claim: false
- raw_or_model_output_committed: false
- private_evidence_committed: false
- prompt_material_committed: false
- credentials_committed: false

## Decision implication

The safe next move is to draft a separate docs-only tiny expansion approval packet if the user wants the next live slice. This assessment does not approve that expansion and does not request another provider call by itself. The approval packet would need to name the exact slots, call cap, cost cap, source-screening prerequisites, no-tools/no-search/no-paid-fallback boundaries, status follow-up requirements, and the same no-readiness/no-default-model/no-graph-ingestion disclaimers.
