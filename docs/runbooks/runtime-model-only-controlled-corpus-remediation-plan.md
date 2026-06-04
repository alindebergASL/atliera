# Runtime Model-Only Controlled-Corpus Remediation Plan

Status: no-spend remediation plan.

Source usefulness status: `runtime-model-only-controlled-corpus-usefulness-status.md`.

This plan responds to the no-spend usefulness assessment result:

- overall_classification: unsupported/invented
- failing area: representative slot provenance-support gap
- secondary symptom: entity-label split

No provider call is authorized by this remediation plan. This is a no-spend contract remediation before any retry.

## Diagnosis

- root diagnosis: output-contract weakness
  - The strict top-level object contract was sufficient to prove `excerpts`, `claims`, and `account_objects` arrays exist, but it did not require every `account_object` to carry nonempty support links.
- root diagnosis: prompt-contract weakness
  - The prompt requested support where possible, but did not make account-object provenance mandatory or fail-closed.
- root diagnosis: account-label normalization weakness
  - The model could use one account label form for excerpts/claims and another for account_objects. That weakens deterministic slot-level validation even when the labels are public-safe and refer to the same synthetic account.

## Required remediation before any corrected run

Implement or ratify a no-call contract correction that does the following:

1. require every account_object to include nonempty supporting_excerpt_ids.
2. require supporting_excerpt_ids to resolve to known excerpt ids.
3. require a canonical account_ref on excerpts, claims, and account_objects.
4. reject display-name-only account labels in the validation path.
5. reject account_objects without provenance.
6. keep display names, if any, as non-authoritative text only.
7. preserve exact top-level output keys: `excerpts`, `claims`, `account_objects`.
8. preserve array-only values for all three top-level keys.
9. preserve no tools, no web, no files, no retrieval, no plugins, no MCP, and no session carryover.

The next implementation step should be a fake-mode regression before live retry. The fake-mode regression should demonstrate that a representative-slot account_object without support is rejected and that canonical account_ref mismatches cannot pass. A separate approval packet before any corrected run is required after the remediation contract is merged.

## Recommended sequence

1. No-call contract-remediation PR.
2. Fake-mode harness/validator tests for account-object support and canonical account_ref consistency.
3. Docs/tests-only corrected-run approval packet, if the fake-mode remediation passes.
4. Exactly one corrected controlled-corpus run, only after approval.
5. Separate sanitized status PR.
6. Separate no-spend usefulness assessment.

Do not proceed directly to product-preview approval, provider comparison, default model selection, background orchestrator enablement, graph ingestion, or production use.

- product-preview approval recommended: false
- provider comparison recommended: false
- default model selection recommended: false
- background orchestrator enablement recommended: false
- graph ingestion recommended: false
- production use recommended: false

## Private evidence policy

The remediation plan records only public-safe categories and sanitized counts. It does not commit raw controlled account text, raw prompts, raw provider requests, raw provider responses, model output, provider bodies, credentials, stack traces, or private evidence paths.

## Non-authorizing markers

- authorizes_provider_call: false
- authorizes_retry: false
- authorizes_corrected_run: false
- authorizes_product_preview_run: false
- authorizes_provider_comparison: false
- authorizes_default_model_selection: false
- authorizes_background_orchestrator_bypass: false
- authorizes_production_use: false
- authorizes_graph_ingestion: false
- default_model_selection_claim: false
- provider_lock_in: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false
