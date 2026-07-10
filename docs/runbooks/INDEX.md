# Runbook Authority Index

Status: no-spend documentation authority ledger.

This index is the human-facing authority map for `docs/runbooks/`. It does not supersede executable tests, approval packets, or source code; it tells reviewers which runbooks are current references, consumed history, superseded history, or inert approval scaffolding.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_index: 0
- provider_spend_by_this_index: false
- next recommended work: no authority is implied by this index; require an explicit operator decision for any later slice

No runbook entry in this index authorizes provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, or readiness claims.

Status vocabulary:

- `active`: current reference for no-spend product, safety, or boundary work.
- `inert-approval`: merged or drafted approval scaffolding that is not effective by itself.
- `consumed`: historical approval/status/assessment already used to produce later artifacts.
- `superseded`: historical material replaced by a named later document.

| Runbook | Status | Authority note |
| --- | --- | --- |
| `codex-auth-model-only-transport-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `codex-auth-model-provider-bridge-gate.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `controlled-2b-expanded-rerun-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `controlled-2b-expanded-rerun-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `controlled-2b-expanded-usefulness-validation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `controlled-2b-live-provider-validation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `controlled-corpus-usefulness-validation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `fake-mode-workshop-serve-slice-status.md` | active | Current no-spend fake/local HTTP Workshop serve slice; Gate 3 remains underbuilt after this slice. |
| `local-durable-db-boot-status.md` | active | Current local durable DB boot/migration contract; it is no-spend and does not claim deployment readiness. |
| `local-durable-db-backup-restore-status.md` | active | Current local backup/restore round-trip for the local durable DB contract; it is no-spend and does not claim deployment readiness. |
| `local-bearer-auth-seam-status.md` | active | Current local bearer-token auth seam for fake-mode Workshop serving; it is no-spend and does not claim deployment readiness. |
| `lab-deployment-target-descriptor-status.md` | active | Current plan-only lab deployment descriptor contract; it is no-spend and does not claim deployment readiness. |
| `lab-deployment-healthcheck-contract-status.md` | active | Current plan-only deployment-target healthcheck contract; it is local/in-process only and does not claim deployment readiness. |
| `lab-host-supervision-contract-status.md` | active | Current plan-only lab host supervision contract; it is portable data only and does not claim deployment readiness. |
| `lab-backup-policy-contract-status.md` | active | Current plan-only lab backup policy contract; it is portable data only and does not execute backups or claim deployment readiness. |
| `lab-deployment-execution-preflight-status.md` | active | Current plan-only lab deployment execution preflight contract; it records no authorization and does not execute deployment or probing. |
| `lab-bounded-deployment-execution-approval-packet.md` | inert-approval | Concrete bounded lab deployment/probe execution approval packet; slice A and slice B approvals were consumed by their execution-status runbooks. |
| `lab-bounded-deployment-slice-a-execution-status.md` | active | Current sanitized status for approved bounded lab slice A execution; service was stopped after `/healthz` and `/workshop` probes and no readiness is claimed. |
| `lab-bounded-deployment-slice-b-backup-restore-status.md` | active | Current sanitized status for approved bounded lab slice B backup/restore proof; disposable data round-tripped and no readiness is claimed. |
| `lab-gate3-status-reconciliation.md` | active | Current no-side-effect Gate 3 reconciliation after slice A and slice B approvals were consumed; it does not authorize further lab expansion or readiness claims. |
| `hermes-gpt55-model-only-live-smoke-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `hermes-gpt55-model-only-transport-direction.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `hermes-gpt55-provider-validation-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `hermes-gpt55-streaming-shape-diagnostic-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `lab-ec2-bootstrap-validation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `lab-model-provider-validation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `lab-s3-artifact-validation.md` | active | Current lab-only durable artifact validation runbook; approval still required before real backend use. |
| `live-product-preview-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-broader-batch-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-broader-batch-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-broader-batch-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-gpt55-comparison-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-gpt55-comparison-preflight-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-gpt55-comparison-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-gpt55-comparison-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-gpt55-operator-smoke-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-lens-diagnostic.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-six-slot-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-six-slot-next-validation-options.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-six-slot-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-six-slot-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-three-lane-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-three-lane-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-three-lane-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-product-preview-usefulness-gate.md` | active | Current deterministic usefulness-gate reference for preview evidence. |
| `live-product-preview-usefulness-remediation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-provider-broader-batch-workshop-preview-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-provider-broader-batch-workshop-preview-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `live-provider-proof-verifier-runtime-harness-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `model-only-codex-auth-live-transport-proof.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `model-only-harness-design.md` | active | Current model boundary/harness design reference. |
| `owl-alpha-validation-framing.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `proposal-materialization-contract-status.md` | active | Current no-call, no-private-evidence-read, no-durable-write proposal-materialization contract targeting the public hand-curated Workshop artifact path; it names `workshop-public-curated-proposal-preview` as the next visible Workshop artifact and authorizes nothing. |
| `workshop-public-curated-proposal-preview-approval-packet.md` | consumed | Historical approval for the committed public-fixture validation-preview Workshop artifact only; it authorized no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim. |
| `workshop-public-curated-proposal-preview-status.md` | active | Current status for the committed public-curated proposal Workshop preview artifact; it preserves current_effective_authorization: none and records no provider/private/durable/ingestion/production/readiness authorization. |
| `workshop-public-proposal-human-review-decision-status.md` | active | Current disposable human-review decision contract for visible public proposal preview items; it authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim. |
| `workshop-public-proposal-ratification-plan-status.md` | active | Current no-call reviewed-candidate ratification plan over accepted public proposal candidate refs; it remains plan-only and authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim. |
| `workshop-public-proposal-durable-graph-write-contract-status.md` | active | Current no-call public proposal durable graph-write contract over the reviewed-candidate ratification plan; it defines the typed shape of the eventual durable graph-write operation and of the future approval packet that would arm one such write, and authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim. |
| `workshop-public-proposal-durable-graph-write-approval-packet-status.md` | active | Current no-call public proposal durable graph-write approval packet over the durable graph-write contract; it is always drafted and unarmed, defines the operator-arming surface without performing it, and authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim. |
| `workshop-public-proposal-durable-graph-write-operator-arming-status.md` | active | Current operator-arming artifact over the durable-write approval packet; it authorizes a single one-shot durable-write attempt by flipping authorizes_durable_write_execution true on this artifact only, records one attributable ratifier identity (no roles, sessions, or permissions modeled), and performs no durable write, graph ingestion, production write, or readiness claim. |
| `workshop-public-proposal-durable-graph-write-execution-status.md` | active | Current M3 durable-write executor over the operator arming; it is the slice where graph_ingestion_performed and durable_writes_performed first flip from false to true, stamps mediation_gate_level: L0 only on completed outcomes (refusals carry no L0 marker; idempotent no-ops reference the prior write's L0 without re-claiming it), and shares the one-attempt external graph-snapshot writer lock with M5a and local DB overwrite-restore while preserving its established idempotency and outcome behavior. |
| `workshop-public-proposal-durable-state-render-status.md` | active | Current durable-state render slice over the durable graph_snapshots and the human-review decision artifact; it closes M3 by rendering Workshop from the graph of record under the M3 admission tier (model-proposed-human-ratified-evidence-pending) in a section visibly distinct from the review-decision rejections (recorded but not promoted into the graph), is read-only with no provider call / no graph mutation / no production write, refuses any row whose per-record provenance_status is verified at the read boundary (trust-tier discipline), and authorizes no readiness claim. |
| `own-data-snapshot-h3-slice-plan-status.md` | active | Current H3 slice plan for consolidating the util.types.isProxy + own-data descriptor-snapshot + (selectively) deep-freeze discipline from three independent call sites (executor PR #271 / 91b7064, reader PR #274 / b2b7a09, render-side composer PR #274 / b2b7a09 with the three hardening rounds 5ed3762 → f281ac0 → 1150dc7 → f895fb4) into src/safety/own-data-snapshot.ts; plan-only with no source module and no runtime behavior introduced by this slice; states the union-never-intersection refusal-code rule, surfaces twelve per-site equivalence questions for operator ratification, and gates the implementation slice behind both operator ratification and the live M5a-vs-M4 sequencing decision. |
| `m5a-curated-proposal-flow-contract-status.md` | active | Current M5a step 1 no-call typed contract for the curated-source proposal flow end-to-end (materialize → validate → ratify → durable write → render), grounded in the existing committed hand-curated-public materialization input; runtime-verifies exact closed shapes, bounded arrays, chronology, and an account-distinct canonical contract ID; ratifies Path 1 and preserves trust-tier discipline; carries L0 only as a prospective approval-policy pin and authorizes no provider call, graph mutation, durable write, readiness claim, or flow execution. |
| `m5a-curated-proposal-flow-approval-packet-status.md` | active | Current M5a step 2 drafted-and-unarmed approval packet over the step-1 contract, with recorded-proposal write/render scope, positive trust-tier pins, and contract/proposal/account binding; independently runtime-verifies exact keys, bounded strict arrays, chronology, and an account- and expiry-distinct canonical packet digest; C1-C26 plus current build-side and canonical-ID regressions target approval-state counterfeit; carries L0 only as a prospective policy pin and performs no provider call, graph mutation, durable write, arming, readiness claim, or flow execution. |
| `m5a-curated-proposal-flow-operator-arming-status.md` | active | Current M5a step 3 operator-arming shape over the verified step-2 packet and step-1 contract; no concrete committed arming instance exists and the module creates one only from explicit operator input; performs no flow execution, durable write, render, provider call, acquisition, private read, production write, readiness claim, consumption record, or mediation_gate_level stamp; independently verifies an event-specific arming ID and a stable one_shot_consumption_key, and requires Step 4 execution-time expiry plus atomic key consumption in the same durable transaction with replay refusal. |
| `m5a-curated-proposal-flow-execution-status.md` | active | Current fixture-bound M5a Step 4 capstone, not a generic approval framework: conservative per-string and cumulative budgets cover the exact JSON-escaped UTF-8 contribution of every snapshotted string value and object key before canonical JSON construction or hashing; an exported canonical-JSON SHA-256 pin binds the exact committed proposal input independently of Steps 1–3 IDs; pure preflight precedes initialized-local-DB validation and the shared M3/M5a/overwrite-restore writer lock; canonical authorization-distinct row identity and replay/duplicate checks precede commit; full committed-row identity is verified on read-back; and any post-rename failure is an L0 `committed_unrendered` effect rather than a refusal. Provider/fresh/acquisition/private/retry/production counts remain zero, readiness is false, and this entry authorizes neither a repeat nor a later slice. |
| `runtime-model-gpt55-smoke-approval.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-gpt55-smoke-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-remediation-plan.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-usefulness-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-v2-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-v2-derived-usefulness-facts.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-v2-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-v2-usefulness-fact-rubric.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-controlled-corpus-v2-usefulness-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-lab-runtime-live-proof-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-lab-runtime-live-proof-interpretation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-lab-runtime-live-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-proof-approval-packet.md` | superseded | Superseded by later one-call/parameter-compatible/output-contract approval packets. |
| `runtime-model-only-live-proof-approval.md` | superseded | Superseded by later parameter-compatible, output-contract, and guarded route approval packets. |
| `runtime-model-only-live-proof-corrected-retry-approval-packet.md` | superseded | Superseded by later parameter-compatible/output-contract approval packets. |
| `runtime-model-only-live-proof-execution-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-proof-one-call-approval-packet.md` | superseded | Superseded by later parameter-compatible/output-contract approval packets. |
| `runtime-model-only-live-proof-output-contract-approval-packet.md` | superseded | Superseded by later runtime-model-only lab runtime proof packets. |
| `runtime-model-only-live-proof-output-contract-compatibility.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-proof-parameter-compatible-approval-packet.md` | superseded | Superseded by runtime-model-only-live-proof-output-contract-approval-packet.md. |
| `runtime-model-only-live-proof-status-writer.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-provider-moderate-proof-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-provider-moderate-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-transport-harness.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-live-transport-injection-seam.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-multi-route-no-call-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-next-validation-options.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-post-comparison-decision.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-post-tiny-expansion-next-steps.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-retry-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-retry-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-retry-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-hardening.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-corrected-retry-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-corrected-retry-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-decision.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-gpt55-repeatability-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-next-slice-options-analysis.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-post-six-slot-next-validation-options.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-remediation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-runtime-smoke-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-sanitized-provider-comparison.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-tiny-expansion-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-tiny-expansion-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-tiny-expansion-usefulness-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-preview-transport-remediation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-product-vertical-slice-deterministic-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-proof-preflight.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-proof-promotion-boundary.md` | active | Current promotion-boundary reference for model-only proof artifacts. |
| `runtime-model-only-remediated-route-chain-no-call-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-approval-packet.md` | superseded | Superseded by fresh/remediated tiny proof packets and later guarded route-chain packet. |
| `runtime-model-only-tiny-live-runtime-proof-contract-remediation.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-fresh-approval-packet.md` | superseded | Superseded by runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md and later guarded route-chain packet. |
| `runtime-model-only-tiny-live-runtime-proof-fresh-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-remediated-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-live-runtime-proof-transport-remediation-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-runtime-integration-no-call-smoke-approval-packet.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-tiny-runtime-integration-no-call-smoke-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-only-transport-proof.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-model-route-recency-revalidation-contract.md` | active | Current route recency/revalidation contract; no run is authorized by it. |
| `runtime-route-chain-no-call-hardening-status.md` | active | Current route-chain no-call hardening boundary that #248 depends on. |
| `runtime-route-fresh-lab-proof-approval-packet.md` | superseded | Superseded by runtime-route-guarded-lab-proof-approval-packet.md for any future exact-route guarded lab proof discussion. |
| `runtime-route-fresh-lab-proof-status.md` | consumed | Historical validation, approval, status, or assessment record retained for provenance; it is not current authorization. |
| `runtime-route-fresh-lab-proof-usefulness-assessment.md` | active | Current route-proofing frontier assessment; says proofing is enough and product/Gate 3-4 work should resume. |
| `runtime-route-guarded-lab-proof-approval-packet.md` | inert-approval | Merged but inert guarded lab proof approval packet; current effective authorization remains none until a separate explicit operator execution instruction is given. |
| `runtime-route-recency-enforcement-status.md` | active | Current no-call route recency enforcement status. |
| `workshop-runtime-preview-demo.md` | active | Current deterministic fake-mode Workshop preview demo reference. |

Maintenance rule: any PR adding a runbook must add exactly one row here and must preserve `current_effective_authorization: none` unless a separate explicit approval process says otherwise.
