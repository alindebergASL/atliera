# Local Bearer Auth Seam Status

Status: active

This runbook records the no-spend Gate 3 slice that adds a deny-by-default local bearer-token auth seam for the fake-mode Workshop serve surface.

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

- A pure local bearer-token auth helper with constant-time token comparison.
- `ATLIERA_LOCAL_BEARER_TOKEN` parsing through an injected env-record parameter rather than direct `process.env` reads in the auth module.
- Explicit local-development opt-out via `ATLIERA_LOCAL_AUTH_MODE=disabled-local-dev`.
- Fake-mode `/workshop` protection when auth is configured.
- Public shallow `/healthz` liveness while DB-aware health details are redacted until a valid bearer token is supplied.
- CLI startup behavior that requires a local bearer token unless the explicit local-development opt-out is set.
- Tests that missing/invalid tokens do not read the graph, do not call providers, do not write production data, and do not leak supplied or expected tokens in response bodies or startup output.
- `WWW-Authenticate: Bearer` on fake-mode Workshop 401 responses.
- Explicit length-mismatch coverage so short or long candidate tokens are rejected without throwing.

## Platform portability

This slice does not add AWS SDKs, OIDC, IAM, Cognito, Secrets Manager, SSM Parameter Store, sessions, users, or RBAC.

The auth contract is deliberately small: a local shared bearer token protects the fake-mode Workshop surface before deployment planning. Later lab/deployment slices may use AWS services pragmatically for secret storage or ingress integration, but those must stay behind config/adapter seams so product logic is not coupled to AWS.

## Health policy

- `/healthz` remains a shallow liveness route.
- When auth is configured and the request lacks a valid bearer token, `/healthz` returns liveness fields only and reports DB details as `redacted_without_auth`.
- A valid bearer token is required before `/healthz` exposes local durable DB status.
- `/workshop` requires a valid bearer token when the auth seam is enabled.

## What this does not prove

- No remote secret store is configured.
- No token rotation, multi-principal identity, sessions, OIDC, IAM, or RBAC exists.
- No TLS, reverse proxy, deployment target, or lab host supervision is configured.
- No production data or production endpoint has been protected.

## Remaining Gate 3 work

Gate 3 remains underbuilt after this slice. Local fake HTTP serving, local durable DB boot/migration, local backup/restore, and a local bearer auth seam now exist. Remaining work includes deployment planning, deployment-target healthcheck integration, lab host supervision, and a deliberate lab backup policy before meaningful lab data exists.

The next recommended scoped work is a no-spend deployment/lab-supervision planning and preflight contract, with any AWS service use kept behind portable adapter/config seams.

## Non-authorizations

This runbook does not approve provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, external tools/search/plugins/retrieval/MCP, lab deployment, production deployment, or readiness claims.
