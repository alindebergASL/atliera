# Local Durable DB Boot Status

Status: active

This runbook records the no-spend Gate 3 foundation slice that adds a local durable DB boot and migration contract for Atliera.

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

- A local durable DB manifest and schema-version contract rooted at an operator-supplied directory.
- A first migration, `001_local_durable_boot`, that creates local durable table files for the existing graph-store and job-queue adapter seams.
- Idempotent init behavior: rerunning init on a current local DB reports no newly applied migrations.
- Fail-closed partial-state behavior: init refuses to clobber existing local table state when the schema manifest is missing or broken.
- Inspection behavior that distinguishes absent, initialized, migration-required, and migration-failed local DB states.
- Machine-readable CLI commands:
  - `npm run --silent db:local:init -- --root <dir> [--now <iso>]`
  - `npm run --silent db:local:inspect -- --root <dir>`
- Optional `/healthz` local durable DB fields for the fake-mode Workshop server when an operator supplies a local DB root.

## Platform portability

This slice deliberately uses a local file-backed boot contract as the first durable DB shape because it is deterministic, dependency-light, and no-network. It does not select a product database provider.

Durability is limited to local filesystem persistence and the current migration creates empty table files plus an atomically renamed manifest. This is enough for a boot/migration contract and later backup/restore tests, but it is not a claim about crash-consistent row appends, multi-process concurrency, managed database behavior, or lab deployment readiness.

The boundary fields such as `providerCallsMade: 0`, `productionWrites: false`, and `platformLockIn: false` are structural invariants of this code path, backed by tests and static scans. They are not evidence from a live deployment.

The same migration/boot boundary is intended to remain portable. Later lab or deployment slices may map the contract to AWS infrastructure such as EC2-attached storage, RDS-compatible databases, or AWS backup services when explicitly selected by deployment config, but product logic must remain behind adapter/config seams rather than becoming AWS-specific.

## Healthcheck interpretation

The fake-mode `/healthz` route can now report local durable DB fields:

- `localDurableDbConfigured`
- `localDurableDbOk`
- `localDurableDbStatus`
- `localDurableDbFailureCodes`
- `deploymentReadinessClaim: false`
- `productionReadinessClaim: false`

These fields are local truth reports only. They do not claim lab deployment readiness or production readiness.

## Remaining Gate 3 work

Gate 3 remains underbuilt after this slice. Remaining work includes backup/restore round-trip, authentication, deployment plan, healthcheck integration in an approved deployment target, and lab host supervision.

The next recommended scoped PR is a local DB backup/restore round-trip over this boot contract.

## Non-authorizations

This runbook does not approve provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, external tools/search/plugins/retrieval/MCP, lab deployment, production deployment, or readiness claims.
