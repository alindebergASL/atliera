# Lab Host Supervision Contract Status

Status: active

This runbook records the no-spend Gate 3 slice that adds a plan-only lab host supervision contract consuming the validated lab deployment target descriptor and deployment-target healthcheck plan. It does not install, start, deploy, probe a remote lab host, or claim readiness.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_slice: 0
- deployment_executed_by_this_slice: false
- supervision_install_executed_by_this_slice: false
- service_start_executed_by_this_slice: false
- remote_lab_probe_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- readiness_claim_by_this_slice: false

## What exists

- `src/deployment/lab-supervision-contract.ts` derives a frozen `lab-host-supervision-plan` from validated frozen deployment descriptor and healthcheck plan snapshots.
- The supervision plan is portable data only:
  - service name from the descriptor snapshot
  - fake runtime process refs for bind host, port, and public base URL config references
  - `GET /healthz` healthcheck cadence and failure threshold expectations
  - restart/backoff and graceful-stop semantics
  - explicit boundaries that install, start, remote probing, provider calls, graph ingestion, production writes, and readiness claims are not allowed
- The helper refuses mutable or unvalidated deployment descriptors, mutable or unvalidated healthcheck plans, mismatched target IDs, or healthcheck plans whose no-deploy boundaries have been broadened.
- The plan does not read `process.env`, does not read token material, and does not generate service files, timers, process-manager config, or host-specific commands.

## Validation coverage

`tests/deployment/lab-supervision-contract.test.ts` covers:

- frozen portable supervision plan derivation from descriptor and healthcheck snapshots
- refusal of mutable/unvalidated descriptor inputs
- refusal of mutable/unvalidated healthcheck inputs
- refusal of mismatched descriptor/healthcheck target IDs or HTTP refs
- fail-closed handling when descriptor or healthcheck plan-only boundaries are broadened
- no `process.env` reads while planning
- no token-shaped data in serialized supervision plans

## Non-goals

- No lab or production deployment.
- No service install or service start.
- No remote lab healthcheck probing.
- No AWS API/CLI calls or cloud provisioning.
- No provider/model calls or spend.
- No graph ingestion.
- No production writes.
- No cron/timer install or backup scheduling.
- No deployment, production, product, or launch readiness claim.

## Next recommended work

The no-spend Gate 3 foundation now has descriptor, healthcheck, supervision, and backup-policy contracts. The next step is a separately approved lab deployment wiring/execution decision: either continue with another no-deploy wiring contract, or explicitly authorize a bounded lab deployment/probe slice with fresh operator approval.
