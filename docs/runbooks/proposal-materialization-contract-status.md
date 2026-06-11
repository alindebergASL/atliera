# Proposal Materialization Contract Status

Status: active

This runbook records the no-spend slice that adds a no-call, no-private-evidence-read, no-durable-write proposal-materialization contract. `materializeProposalForValidation` consumes committed hand-curated public proposal-like records plus public-source context only and materializes them into a disposable validation artifact carrying a GraphBundle candidate checked by the existing deterministic Graph validator. It deliberately targets Direction B — the public/hand-curated Workshop artifact path — first; it does not read, render, or materialize private fresh-route proof output, and it does not perform or authorize graph ingestion. "Ingestion" stays reserved for a future ratification-gated durable graph write that this slice does not implement.

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- production_writes: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

## What exists

- `src/validation/proposal-materialization.ts` exposes `materializeProposalForValidation`, a pure deterministic function over snapshot-validated input. It accepts only `origin: hand-curated-public` context, enforces committed public-shaped fixture boundaries, and refuses every other origin fail-closed; it does not prove real-world public provenance beyond the accepted committed/public-shaped source record.
- The materializer validates public-shaped sources through a plain own-data snapshot before the existing `parseSourceDocument` schema surface, consumes only the parsed snapshots, and rejects accessor-backed records, missing provenance, non-public URL shapes, or team/account context mismatches.
- Per-record dispositions record `accepted`/`rejected` with safe reason codes only (for example `missing_source_provenance`, `unknown_source_document_id`, `excerpt_text_not_found_in_source`, `proposal_supplied_trust_status_disallowed`); rejected records never echo unsafe input values.
- The accepted records form a GraphBundle candidate inside the disposable artifact, checked by the existing deterministic `validateGraphBundle` surface in validation mode; the embedded research-run record is fixture-mode with a null provider, a null model, and zero cost.
- The artifact is deeply frozen, marked `disposable: true`, and carries unbroadened boundary markers (`current_effective_authorization: none`; provider call, private-evidence read, graph ingestion, durable write, production write, and readiness flags all false/zero).
- `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json` is a hand-curated, public-shaped input fixture; it is not private proof output and not a sanitized metric summary.

## Trust visual-language decision

This slice commits the trust visual language for materialized proposal-derived content:

- Reuse the existing truth-status vocabulary: claims and account objects stay `unverified`; excerpts stay `proposed`. No sixth truth-status tier is added.
- Decorate, do not promote: the artifact carries an explicit `model_proposed_pending_human_review` review state (also recorded on each materialized account object) so the Workshop can render a model-proposed/pending-human-review treatment on top of the existing unverified status.
- Materialized proposal-derived records cannot be marked `verified` or `source_document_only`: proposal records supplying their own trust status are rejected fail-closed, proposal-supplied high confidence is capped at medium, and `assertProposalDerivedRecordsUnverified` throws if any materialized record escapes those constraints.

## Next visible Workshop artifact

The next slice's expected visible Workshop artifact is named by this contract and embedded in every artifact it produces:

- Name: `workshop-public-curated-proposal-preview`
- Scope: a deterministic fake-mode Workshop HTML preview rendered from the accepted public-curated bundle candidate of one proposal set, showing the unverified plus model-proposed/pending-human-review treatment.
- Approval surface: `docs/runbooks/workshop-public-curated-proposal-preview-approval-packet.md`, an explicit operator approval packet that must exist and be approved before that preview slice runs. This status runbook does not create or approve that packet.

## Later approval required for private fresh-route proof output

Private fresh-route proof output is out of scope for this contract and for the named next Workshop artifact. Before any private fresh-route proof output is read, rendered, or materialized, a separate explicit fresh private-evidence-handling approval is required, covering how that evidence is read, sanitized, displayed, and retained. The materializer enforces this boundary today by refusing every non-public origin fail-closed.

## Validation coverage

`tests/validation/proposal-materialization.test.ts` covers:

- happy-path materialization from the committed public fixture with a passing deterministic Graph validator report
- unbroadened provider/private/durable/ingestion authorization markers on every artifact
- refusal of private fresh-route proof origins with a message naming the later approval
- fail-closed source provenance handling with safe reason codes and downstream cascade rejection
- refusal of proposal records that supply their own trust status, and the impossibility of verified/source-backed marking
- confidence capping, deep-frozen artifacts, and the named next Workshop artifact plus approval surface

`tests/safety/proposal-materialization-contract.test.ts` pins this runbook, the runbook index row, and the source-module boundary markers.

## Non-goals

- No provider/model calls or spend.
- No network access and no live source fetching.
- No private-evidence reads; private fresh-route proof output is not consumed or referenced.
- No durable writes, no graph ingestion, and no production writes; the artifact is disposable.
- No Workshop rendering in this slice; the preview is the named next slice behind its own approval surface.
- No deployment, production, product, or launch readiness claim.

## Next recommended work

Produce the named `workshop-public-curated-proposal-preview` slice: draft its approval packet, and on explicit operator approval render the accepted public-curated bundle candidate through the existing deterministic fake-mode Workshop renderer with the committed trust visual language. Current effective authorization remains none; this runbook does not approve that slice.
