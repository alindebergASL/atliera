# Lab Deployment Plan

Status: Gate 3 lab deployment descriptor and slice status reference.

Current effective authorization: none.

This document defines the first lab deployment plan shape for Atliera. It is paired with the validated descriptor contract in `src/deployment/lab-deployment-target.ts`, the deployment-target healthcheck contract in `src/deployment/lab-healthcheck-contract.ts`, the lab host supervision contract in `src/deployment/lab-supervision-contract.ts`, the lab backup policy contract in `src/deployment/lab-backup-policy-contract.ts`, the lab deployment execution preflight contract in `src/deployment/lab-deployment-execution-preflight.ts`, the inert bounded lab deployment execution approval packet in `docs/runbooks/lab-bounded-deployment-execution-approval-packet.md`, the bounded lab deployment slice A execution status in `docs/runbooks/lab-bounded-deployment-slice-a-execution-status.md`, the bounded lab deployment slice B backup/restore status in `docs/runbooks/lab-bounded-deployment-slice-b-backup-restore-status.md`, the Gate 3 status reconciliation in `docs/runbooks/lab-gate3-status-reconciliation.md`, and the placeholder fixture at `fixtures/deployment/lab-target.example.json`. Slice A executed only the approved fake-mode package/start/`/healthz`/optional `/workshop` smoke and stopped afterward. Slice B executed only the approved disposable local durable DB backup/restore proof and removed restore scratch. Gate 3 reconciliation completed without side effects. No further lab expansion is approved.

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

6. Bounded lab deployment slice A execution:
   - approved only decision items 1 and 2 from the approval packet
   - packaged the exact approved commit, prepared it on the single lab target, started fake-mode Workshop service, ran `/healthz`, ran the optional `/workshop` shallow smoke, and stopped afterward
   - recorded sanitized evidence only; no resolved host/IP/URL/credential/private path values are committed
   - current status: execution status exists in `docs/runbooks/lab-bounded-deployment-slice-a-execution-status.md`

7. Bounded lab deployment slice B backup/restore proof:
   - approved only decision item 3 from the approval packet after slice A completed
   - created a lab-local backup artifact from disposable local durable DB data, restored it into scratch, inspected the restored DB, verified round-trip integrity markers, and removed restore scratch
   - recorded sanitized evidence only; no resolved host/IP/URL/credential/private path values are committed
   - current status: backup/restore status exists in `docs/runbooks/lab-bounded-deployment-slice-b-backup-restore-status.md`

8. Gate 3 status reconciliation:
   - no-side-effect documentation/test reconciliation after slice A and slice B single-use approvals were consumed
   - clarified what remains before any persistent deployment wiring, scheduler/backend wiring, process-manager installation, nginx/TLS/DNS work, provider/model operation, graph ingestion, production write, or readiness claim
   - does not choose, approve, or execute a next implementation slice
   - current status: reconciliation exists in `docs/runbooks/lab-gate3-status-reconciliation.md`

9. Next scoped Gate 3 slice:
   - requires an explicit operator decision before any further lab expansion or implementation work
   - candidate scopes may include persistent deployment wiring plan, deployment-target empty-DB boot proof plan, process-manager/nginx/TLS/DNS readiness plan, or Gate 3 to Gate 4 sequencing review
   - current status: unapproved

## Current unapproved non-goals

- No production deployment; no additional lab deployment beyond completed slice A and slice B proof.
- No additional service start beyond completed slice A.
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
