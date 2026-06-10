# Lab Deployment Healthcheck Contract Status

Status: active

This runbook records the no-spend Gate 3 slice that adds a plan-only deployment-target healthcheck contract consuming the validated lab deployment target descriptor. It does not deploy, probe a remote lab host, or claim readiness.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_slice: 0
- deployment_executed_by_this_slice: false
- remote_lab_probe_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- readiness_claim_by_this_slice: false

## What exists

- `src/deployment/lab-healthcheck-contract.ts` derives a frozen `lab-deployment-healthcheck-plan` from a validated frozen lab deployment target descriptor snapshot.
- The plan captures the local `/healthz` contract as data:
  - `GET /healthz`
  - expected fake-mode healthcheck kind
  - no graph reads
  - zero provider calls
  - no production writes
  - no deployment or production readiness claim
- The contract includes explicit no-op boundaries:
  - remote probes are not allowed
  - deployment is not executed
  - provider calls are not allowed
  - graph ingestion is not allowed
  - production writes are not allowed
  - readiness claims are not allowed
- The evaluator checks in-process/local fake-mode HTTP responses and fails closed for malformed JSON, unexpected status/kind, graph reads, provider calls, production writes, or readiness claims. It returns a sanitized report and does not retain raw response bodies, headers, tokens, or unexpected response fields.
- The auth seam is represented only as sanitized plan metadata (`not-configured` or `bearer-required-without-token-material`); the healthcheck plan does not read, store, or print bearer token material.

## Validation coverage

`tests/deployment/lab-healthcheck-contract.test.ts` covers:

- frozen healthcheck plan derivation from a validated descriptor snapshot
- refusal of mutable/unvalidated descriptors
- no `process.env` reads while planning
- no token material in serialized plans or reports
- in-process fake-mode `/healthz` evaluation with bearer auth configured
- fail-closed evaluation for overclaiming healthcheck bodies

## Non-goals

- No lab or production deployment.
- No remote lab healthcheck probing.
- No AWS API/CLI calls or cloud provisioning.
- No provider/model calls or spend.
- No graph ingestion.
- No production writes.
- No supervision install or service generation.
- No cron/timer install or backup scheduling.
- No deployment, production, or launch readiness claim.

## Next recommended work

The no-spend Gate 3 deployment foundation now has descriptor, healthcheck, supervision, backup-policy, and execution-preflight contracts. The next step is a separate explicit operator decision about whether to authorize a bounded lab deployment/probe execution slice; without that fresh approval, current effective authorization remains none.
