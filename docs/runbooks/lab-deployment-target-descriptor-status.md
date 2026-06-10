# Lab Deployment Target Descriptor Status

Status: active

This runbook records the no-spend Gate 3 slice that adds a plan-only lab deployment target descriptor contract. It turns the deployment plan into a typed, validated, frozen snapshot that later healthcheck, supervision, and backup-policy slices can consume without deploying anything in this PR.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed: 0
- provider_spend: false
- authorizes_provider_call: false
- authorizes_graph_ingestion: false
- authorizes_production_use: false
- authorizes_default_model_selection: false
- launch_readiness_claim: false
- product_readiness_claim: false
- production_readiness_claim: false

## What exists now

- `src/deployment/lab-deployment-target.ts` defines and validates a versioned lab deployment target descriptor.
- `fixtures/deployment/lab-target.example.json` is a checked-in placeholder descriptor with config references only.
- The descriptor covers:
  - exact `schemaVersion: "1"`; unknown versions reject so future migrations are deliberate
  - lab-only environment
  - fake runtime mode
  - infrastructure provider/region/host references
  - local HTTP bind/port and `/healthz` / `/workshop` paths
  - plan-only host supervision mode
  - local scheduled backup-policy parameters
  - explicit false boundary markers for deployment, provider calls, production writes, and readiness claims
- The validator returns a cloned, deeply frozen snapshot and rejects accessors, unknown keys, prototype-pollution-shaped keys, invalid paths, invalid retention values, secret-shaped config references, and broadened boundary flags.

## Plan-only lab topology

The current placeholder topology is intentionally small:

1. A future lab host runs the fake-mode Workshop server behind separately approved ingress/reverse-proxy wiring.
2. The application binds locally (`127.0.0.1`) and exposes `/healthz` plus `/workshop`.
3. A future supervision slice may derive or validate systemd-style expectations from the descriptor, but this PR does not generate or install a unit.
4. A future healthcheck slice may consume the descriptor to probe a local process, but this PR does not probe a remote host.
5. A future backup-policy slice may bind descriptor retention/schedule fields to the local DB backup/restore contract, but this PR does not schedule backups or prove restore on a deployment target.

## Portability rule

The descriptor is the adapter seam. AWS infrastructure may be useful for the lab later, but product logic must treat provider, region, host, and base URL values as config references. No AWS SDK imports, API calls, ARNs, credentials, or hardcoded lab endpoints are part of this contract.

## What this does not prove

- No deployment was performed.
- No AWS API, AWS CLI, or cloud provisioning command was run.
- No remote healthcheck was probed.
- No nginx, PM2, Certbot, or systemd unit was generated or installed.
- No backup schedule was installed.
- No deployment-target restore proof exists yet.
- No lab, production, product, or launch readiness is claimed.

## Next recommended work

Use this descriptor as the input for the next small Gate 3 slice: deployment-target healthcheck integration. That follow-up should remain local/no-spend by consuming the descriptor and proving a healthcheck harness against an explicitly launched local fake-mode server before any remote lab target is touched.

This runbook does not approve provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, external tools/search/plugins/retrieval/MCP, lab deployment, production deployment, or readiness claims.
