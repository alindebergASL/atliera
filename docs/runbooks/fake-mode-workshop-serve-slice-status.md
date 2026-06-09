# Fake-mode Workshop Serve Slice Status

Status: active

This runbook records the no-spend Gate 3 product slice that adds a local/fake HTTP serving seam for Atliera Workshop.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- graph_ingestion_executed_by_this_slice: false
- production_writes_executed_by_this_slice: false
- default_model_selection_executed_by_this_slice: false

## What this slice adds

- `/healthz` returns a sanitized fake-mode healthcheck from an empty runtime without reading graph state.
- `/workshop` renders Atliera Workshop HTML from the supplied graph snapshot using the existing graph-derived Signals / Maps / Plays renderer.
- The CLI script mounts the same route handler as a local Node HTTP server for local or lab smoke checks.
- `npm run workshop:serve:fake -- [--bundle <graph-bundle.json>]` provides a local CLI wrapper around the same server seam.

## Fail-closed conditions

The server refuses to serve Workshop HTML before reading graph state unless all of these are true:

- environment is `development`, `test`, or `lab`
- `MODEL_PROVIDER=fake`
- `ARTIFACT_STORE=memory`
- `QUEUE_BACKEND=memory`
- no constructed model provider client is supplied to the runtime
- runtime preflight passes

Production-like environments, non-fake model providers, durable adapter selections, supplied model-provider clients, and failed runtime preflight all return sanitized JSON failures before graph reads.

## Product-surface review

This is a real bootable local HTTP seam, not only a static HTML writer. It is still deliberately narrow:

- Healthcheck proves a fake/local app route can boot from empty in-memory state.
- Workshop route proves the product surface can render the shared graph-backed Signals / Maps / Plays lanes over fixture evidence.
- The surface remains useful for product review because it can be opened as HTML from a local server, but it does not yet include authentication, durable database migrations, backup/restore, deployment wiring, or lab host supervision.

## Remaining Gate 3 work

Gate 3 remains underbuilt after this slice. Remaining work includes durable DB boot/migrations, deployment plan, healthcheck integration in the deploy target, backup path before meaningful data exists, and operator runbook for lab hosting.

## Non-authorizations

This runbook does not approve provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, external tools/search/plugins/retrieval/MCP, production deployment, or readiness claims.
