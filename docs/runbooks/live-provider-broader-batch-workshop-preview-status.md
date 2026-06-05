# Live provider broader batch and non-production Workshop preview status

Status: completed bounded broader live batch and rendered a non-production Workshop preview from validated output

## Status metadata

- status_id: live-provider-broader-batch-workshop-preview-20260605a
- predecessor_status: live-provider-proof-verifier-runtime-harness-status
- route_ref: gpt-5.5-openai-codex-repeatability-20260604h
- provider_path: hermes-openai-codex-operator
- model_label: gpt-5.5
- source_scope: synthetic-only
- scope: steps 6 and 7 of the runtime model-only follow-up sequence

## Execution facts

- provider_api_requests_attempted: 2
- provider_calls_executed: 2
- rejected_generations: 1
- rejected_generation_reason: unsafe_text_shape_only
- successful_validated_generations: 1
- observed_cost_usd: 0
- successful_generation_total_tokens: 13483
- all_attempts_total_tokens: 27115

The first generation completed but failed the private sanitizer because it contained generic company-shaped text. No raw text from that failed generation is committed. A second bounded generation completed and passed strict JSON, same-account citation, per-account lens coverage, and boundary validation.

## Validated broader-batch counts

- account_count: 5
- excerpt_count: 10
- claim_count: 10
- account_object_count: 15
- signals_count: 5
- maps_count: 5
- plays_count: 5
- strict_json_ok: true
- citation_links_ok: true
- per_account_lens_coverage_ok: true
- graph_validation_ok: true
- graph_validation_hard_failures: 0
- graph_ingestion_performed: false
- production_writes_performed: false

## Non-production Workshop preview facts

- workshop_preview_rendered: true
- workshop_preview_source: validated_graphbundle_candidate
- workshop_preview_signals: 5
- workshop_preview_maps: 5
- workshop_preview_plays: 5
- workshop_preview_verified_objects: 15
- workshop_preview_provider_calls: 0
- workshop_preview_production_writes: false
- workshop_preview_non_production_only: true
- workshop_preview_html_bytes: 32973
- workshop_preview_screenshot_captured: true

The preview shows the existing graph-backed Workshop shell rendering five Signals, five Maps, and five Plays from the validated candidate bundle. The preview is an operator review artifact only; it is not graph ingestion, a production write, deployment, launch readiness, product readiness, provider-quality proof, provider comparison, default-model selection, or provider lock-in.

## Preview boundary label

The Workshop HTML shell now distinguishes the two non-production preview boundaries by label. The default preview keeps the `Fake-mode preview` boundary span (backward compatible). A preview produced for operator review of a validated GraphBundle candidate, like the one recorded above, can be rendered with the explicit validation label `Validation preview (non-production)` via `renderWorkshopHtml(viewModel, { previewMode: "validation" })`, or from the CLI with `tsx src/cli/workshop-shell.ts write ... --preview-mode validation`. Both modes keep the same `No provider calls` and `No production writes` boundary spans; the label only changes which non-production preview an operator is looking at. The CLI defaults to `--preview-mode fake` and rejects unknown, missing, or duplicate `--preview-mode` values.

## Repository safety

- raw_prompt_committed: false
- raw_provider_output_committed: false
- provider_payload_committed: false
- model_output_committed: false
- private_evidence_committed: false
- credential_material_committed: false
- request_identifier_committed: false
- private_paths_committed: false
- preview_html_committed: false
- preview_screenshot_committed: false

## Follow-up authorization markers

- authorizes_retry: false
- authorizes_future_provider_call: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- authorizes_deployment: false
- authorizes_web_search: false
- authorizes_tools: false
- authorizes_plugins: false
- authorizes_retrieval: false

- provider_call_requires_new_approval: true
- retry_requires_new_approval: true
- product_preview_expansion_requires_new_approval: true

## Usefulness assessment

A no-spend usefulness assessment of this preview is recorded in `live-provider-broader-batch-workshop-preview-usefulness-assessment.md`. That assessment consumes only the sanitized public facts above (workshop_preview_provider_calls: 0), classifies the preview as `useful`, and preserves `approves_expansion_or_comparison: false`. It does not authorize any future provider call, retry, or product-preview expansion.
