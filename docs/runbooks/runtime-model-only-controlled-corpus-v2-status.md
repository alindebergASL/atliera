# Runtime Model-Only Controlled-Corpus V2 Execution Status

Status: completed for one approved v2 corrected controlled-corpus model-only harness run.

Approval packet: `runtime-model-only-controlled-corpus-v2-approval-packet.md` from PR #193.

The approval has now been consumed. A failed or completed run consumes this approval. No retry was performed. No further provider call is authorized by this status.

## Sanitized execution facts

- job_id: controlled-corpus-v2-run-20260604a
- route_ref: gpt-5.5-openai-codex-20260602a
- provider_ref: openai-codex
- model_label: gpt-5.5
- transport_kind: model-only-codex-auth
- corpus_ref: controlled-corpus/model-only-harness-smoke-v1
- prompt_contract_ref: prompts/controlled-corpus-model-only-v2
- output_contract_ref: src/model/model-only-controlled-corpus-v2-contract.ts
- status: completed
- reason_code: model_only_harness_v2_completed
- stable_error_code: none
- provider_calls_executed: 1
- transport_calls_observed_by_runner: 1
- accepted_output_received: true
- v2_contract_validated: true
- v2_account_ref_count: 3
- corpus_size: 3
- corpus_roles: representative, edge-case, calibration
- v2_counts.excerpts: 9
- v2_counts.claims: 7
- v2_counts.account_objects: 3
- input_tokens_observed: 410
- output_tokens_observed: 886
- observed_cost_usd: 0
- approved_max_cost_usd: 1

## Authorization state after execution

- authorizes_provider_call: false
- authorizes_retry: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

The v2 run completed and satisfied the stricter controlled-corpus v2 contract. This means the observed model output used canonical account references and passed the committed v2 provenance checks for the controlled corpus.

This status does not evaluate whether the output is useful. It records only that the bounded execution completed and the v2 output contract accepted the result.

The next safe step is a separate no-spend usefulness assessment over already-sanitized v2 facts. That assessment must not call a provider, must not access raw evidence, and must not authorize product preview, provider comparison, default model selection, production use, background orchestration, or graph ingestion.

## Evidence handling

Only sanitized execution facts are recorded here.

- raw_request_committed: false
- raw_response_committed: false
- raw_controlled_account_text_committed: false
- model_output_committed: false
- private_evidence_committed: false
- usefulness_evaluated: false

The raw prompt, controlled account text, provider request, provider response, model output text, provider metadata, and local execution diagnostics remain outside the repository. They are not included in this document, tests, commits, or pull request body.

## Non-claims

This status does not claim:

- provider quality
- model quality
- product readiness
- production readiness
- launch readiness
- default model selection
- provider lock-in
- product-preview approval
- provider-comparison approval
- graph-ingestion approval
- background-orchestrator approval
- retry approval
