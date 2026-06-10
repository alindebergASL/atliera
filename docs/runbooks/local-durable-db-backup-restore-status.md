# Local Durable DB Backup/Restore Status

Status: active

This runbook records the no-spend Gate 3 foundation slice that adds local backup and restore round-trip behavior for Atliera's local durable DB boot contract.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- default_model_selection_executed_by_this_slice: false
- deployment_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false

## What this slice adds

- A local backup artifact for initialized local durable DB roots.
- A schema-stamped backup payload with `backupVersion`, `sourceSchemaVersion`, source manifest, table payloads, and per-table SHA-256 checksums.
- Restore into an empty target root.
- Fail-closed restore refusal for non-empty targets unless an explicit overwrite flag is supplied.
- Checksum validation before restore.
- Guarded overwrite behavior: explicit overwrite only removes an existing target after the backup validates and the target already inspects as an initialized Atliera local durable DB root. Symlink target roots and arbitrary non-DB directories are refused.
- Machine-readable CLI commands:
  - `npm run --silent db:local:backup -- --root <dir> --out <backup.json> [--now <iso>]`
  - `npm run --silent db:local:restore -- --backup <backup.json> --target-root <dir> [--allow-overwrite]`

## Platform portability

This slice is local-only and file-backed. It does not select AWS, S3, RDS, EBS, EFS, S3 Files, or any other managed service as the product database or backup backend.

Because the contract is explicit and schema-stamped, later lab/deployment slices may use AWS infrastructure pragmatically behind adapter/config seams. Examples include EC2-attached storage, RDS-compatible databases, or managed backup services, but those choices must remain deployment wiring decisions rather than product-logic lock-in.

## What this does not prove

- No remote backup path is configured.
- No retention, encryption, IAM, object lock, lifecycle, or disaster-recovery policy is claimed.
- No lab host supervision is configured.
- No deployment target has been booted from backup.
- No production data has been created, backed up, or restored.

## Remaining Gate 3 work

Gate 3 remains underbuilt after this slice. The local fake HTTP seam, local DB boot, and local backup/restore round-trip now exist. Remaining work includes authentication, deployment wiring, deployment-target healthcheck integration, lab host supervision, and a deliberate lab backup policy before meaningful lab data exists.

The next recommended scoped work is auth and deployment/lab supervision planning, with any AWS service use kept behind portable adapter/config seams.

## Non-authorizations

This runbook does not approve provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, external tools/search/plugins/retrieval/MCP, lab deployment, production deployment, or readiness claims.
