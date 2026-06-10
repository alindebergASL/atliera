# Lab Backup Policy Contract Status

Status: active

This runbook records the no-spend Gate 3 slice that adds a plan-only lab backup policy contract consuming the validated lab deployment target descriptor and the local durable DB backup/restore contract. It does not execute a backup, restore data, install a scheduler, write remote backup artifacts, deploy, probe a lab host, or claim readiness.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- backup_execution_executed_by_this_slice: false
- restore_execution_executed_by_this_slice: false
- scheduler_install_executed_by_this_slice: false
- remote_backup_write_executed_by_this_slice: false
- deployment_executed_by_this_slice: false
- remote_lab_probe_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- deployment_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

## What exists

- `src/deployment/lab-backup-policy-contract.ts` derives a frozen `lab-backup-policy-plan` from a validated frozen lab deployment target descriptor.
- The plan consumes local durable DB backup/restore contract facts as data:
  - current local durable DB schema version
  - expected backup report kind and `created` backup status
  - expected restore report kind and `restored` restore status
  - checksum validation requirement
  - explicit overwrite requirement for non-empty restore targets
- The plan carries only config-reference names for the local DB root, backup artifact, restore proof target, and schedule. It rejects endpoint-shaped or credential-shaped references.
- The plan records retention bounds, schedule intent, and restore-proof expectations as portable data only.
- The helper refuses mutable or unvalidated deployment descriptors, descriptors with broadened no-deploy/no-readiness boundaries, or descriptors whose backup policy no longer preserves local scheduled restore-proof semantics.
- The plan does not read `process.env`, does not read token material, and does not generate cron entries, systemd timers, cloud storage writes, backup commands, restore commands, or host-specific instructions.

## Validation coverage

`tests/deployment/lab-backup-policy-contract.test.ts` covers:

- frozen portable backup policy plan derivation from the descriptor and local backup/restore contract references
- refusal of mutable/unvalidated descriptor inputs
- refusal of forged frozen descriptors with unsafe target IDs, accessor-backed backup policy values, or accessor-backed boundary values
- fail-closed handling when descriptor boundaries are broadened
- fail-closed handling when backup policy retention, schedule, or restore-proof semantics are broadened
- rejection of endpoint-shaped or credential-shaped config references
- no `process.env` reads while planning
- no token-shaped data or literal endpoints in serialized backup policy plans

## Non-goals

- No lab or production deployment.
- No backup or restore execution.
- No cron, timer, scheduler, systemd, or process-manager install.
- No remote backup path write.
- No AWS API/CLI calls or cloud provisioning.
- No provider/model calls or spend.
- No graph ingestion.
- No production writes.
- No remote lab host probing.
- No deployment, production, product, or launch readiness claim.

## Next recommended work

The Gate 3 deployment foundation now has descriptor, healthcheck, supervision, backup-policy, execution-preflight, inert bounded execution approval-packet artifacts, slice A execution status, slice B backup/restore proof status, and no-side-effect Gate 3 reconciliation. The next step requires an explicit operator decision for the next scoped Gate 3 slice before any further lab expansion, scheduler/backend wiring, process-manager installation, nginx/TLS/DNS work, provider/model operation, graph ingestion, production write, or readiness claim. Current effective authorization remains none.
