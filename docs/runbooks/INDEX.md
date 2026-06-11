# Runbook Authority Index

Status: no-spend documentation authority ledger.

This index is the human-facing authority map for `docs/runbooks/`. It does not supersede executable tests, approval packets, or source code; it tells reviewers which runbooks are current references, consumed history, superseded history, or inert approval scaffolding.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_index: 0
- provider_spend_by_this_index: false
- next recommended work: explicit operator decision for the next scoped Gate 3 slice

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
