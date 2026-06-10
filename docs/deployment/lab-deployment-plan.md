# Lab Deployment Plan

Status: plan-only Gate 3 deployment descriptor reference.

Current effective authorization: none.

This document defines the first lab deployment plan shape for Atliera without deploying it. It is paired with the validated descriptor contract in `src/deployment/lab-deployment-target.ts`, the deployment-target healthcheck contract in `src/deployment/lab-healthcheck-contract.ts`, the lab host supervision contract in `src/deployment/lab-supervision-contract.ts`, the lab backup policy contract in `src/deployment/lab-backup-policy-contract.ts`, the lab deployment execution preflight contract in `src/deployment/lab-deployment-execution-preflight.ts`, the inert bounded lab deployment execution approval packet in `docs/runbooks/lab-bounded-deployment-execution-approval-packet.md`, and the placeholder fixture at `fixtures/deployment/lab-target.example.json`. The approval packet does not authorize deployment, probing, service start, backup/restore execution, or readiness claims.

## Goals

- Keep lab/deployment choices explicit and reviewable before any host changes.
- Provide one descriptor shape that later local healthcheck, supervision, and backup-policy slices can consume.
- Preserve provider portability: AWS infrastructure may be used pragmatically later, but only as config/adapter values behind this seam.
- Preserve the current no-spend/no-deploy boundary.

## Current target shape

The current descriptor is limited to:

- `schemaVersion: "1"` exact-match descriptor version; unknown versions reject until a deliberate migration is added
- `environment: "lab"`
- `runtimeMode: "fake"`
- local bind host reference (for example `ATL_LAB_BIND_HOST`), not a checked-in host/IP literal
- `/healthz` for liveness and `/workshop` for the product surface
- plan-only `systemd-plan` supervision marker
- local scheduled backup policy parameters
- boundary flags that must remain false for deployment execution, provider calls, production writes, and readiness claims

Concrete hostnames, ports, regions, and base URLs are represented as config references such as `ATL_LAB_HOST` and `ATL_LAB_BASE_URL`. The checked-in example deliberately contains no private host/IP/credential values.

## Intended follow-up sequence

1. Deployment-target healthcheck integration:
   - consumes the frozen descriptor snapshot
   - derives a plan-only `/healthz` expectation contract
   - evaluates in-process/local fake-mode responses only
   - does not probe a remote lab host

2. Lab host supervision dry-run:
   - consumes the frozen descriptor snapshot and frozen healthcheck plan
   - derives portable service/process/healthcheck/restart/graceful-stop expectations locally
   - does not install or start services
   - current status: contract exists in `docs/runbooks/lab-host-supervision-contract-status.md`

3. Lab backup policy validation:
   - consumes the frozen descriptor snapshot
   - validates retention/schedule fields against the local DB backup/restore contract
   - carries source/artifact/restore-proof refs as config-reference names only
   - does not install cron/timers or write remote backups
   - current status: contract exists in `docs/runbooks/lab-backup-policy-contract-status.md`

4. Lab deployment execution preflight:
   - consumes the frozen descriptor, healthcheck, supervision, and backup-policy plans
   - cross-checks target IDs plus HTTP/process refs before any later execution decision
   - records current effective authorization as none
   - does not deploy, probe, start services, execute backups/restores, or claim readiness
   - current status: contract exists in `docs/runbooks/lab-deployment-execution-preflight-status.md`

5. Bounded lab deployment execution approval packet:
   - names the concrete future bounded execution scope using config refs and placeholders only
   - records single lab target, exact approved commit, fake runtime mode, supervised service start, `/healthz` probe, optional `/workshop` shallow smoke, rollback/teardown, stop conditions, and sanitized evidence requirements
   - keeps current effective authorization as none
   - does not authorize deployment, probing, service start, backup/restore execution, or readiness claims
   - current status: packet exists in `docs/runbooks/lab-bounded-deployment-execution-approval-packet.md`

6. Separately approved lab deployment/probe go/no-go decision:
   - only after the approval packet is merged and reviewed
   - requires explicit operator authorization at execution time against an exact commit and named config refs

## Explicit non-goals in this slice

- No lab or production deployment.
- No service start.
- No AWS API/CLI calls or cloud provisioning.
- No provider/model calls or spend.
- No graph ingestion.
- No production writes.
- No remote host healthcheck probing.
- No nginx, PM2, Certbot, or systemd install.
- No backup schedule install.
- No readiness claim.

## Portability guidance

The descriptor may carry provider-flavored config references later, but product code must not branch on AWS-specific assumptions. Values such as provider name, region reference, host reference, and public base URL reference are opaque config fields. Any cloud-specific implementation belongs in a deployment adapter or operator runbook, not in core product logic.
