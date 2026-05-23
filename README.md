# Atliera

Atliera is an evidence-backed account intelligence workspace.

This repository is the clean-slate Atliera product foundation for the registered `atliera.com` domain. Atliera is separate from the legacy account-research/report system: it should boot from an empty database and use legacy systems only as external comparison references.

Core architecture vocabulary:

- Atliera Workshop — the main human + agent workspace
- Atliera Agent — the app-bounded in-product intelligence capability
- Atliera Graph — the evidence/source/excerpt/claim/object truth layer
- Signals / Maps / Plays — launch lenses over the same graph, not separate early data pipelines

See `docs/architecture/atliera-product-architecture.md`, `docs/architecture/durable-adapter-contracts.md`, and `docs/adr/0001-atliera-fresh-system.md` for the initial architecture plan.

## Phase 1 graph foundation

The current codebase contains the Phase 1 Atliera Graph foundation:

- graph primitive types in `src/graph/types.ts`
- strict structural parsing in `src/graph/schema.ts`
- deterministic hard-invariant validation in `src/graph/validate.ts`
- no-spend fixture validation CLI in `src/cli/validate.ts`
- adversarial graph tests in `tests/graph/`
- safety tests in `tests/safety/`

Phase 1 intentionally does not include UI, database persistence, live source fetching, provider/model integration, deployment, or legacy data migration.

## Local verification

Use Node.js 22 or newer.

Install dependencies:

```bash
npm ci
```

Run the same verification bundle used by CI:

```bash
npm run ci
```

Equivalent explicit commands:

```bash
npm run typecheck
npm run build
npm test
```

Validate the canonical fixture through the no-spend fixture CLI:

```bash
npm run validate:fixture:valid
```

Run the Phase 1.2 quality gate against the canonical fixture:

```bash
npm run gate:fixture:valid
```

The quality gate consumes one or more GraphBundle JSON files, runs deterministic validation, computes launch-quality metrics, and emits `pass`, `borderline`, or `fail`. It exits `0` only for `pass`.

Quality gate checks include:

- hard validation failures
- invented ID failures
- zero-output incidents
- accepted excerpt rate
- verified/high-confidence claim evidence coverage

Generate the valid fixture JSON without validating it:

```bash
npm run fixture:valid-json
```

Use the checked-in fixture corpus:

```bash
npm run validate:fixture -- fixtures/graph/valid/minimal-pass.json
npm run gate:fixture -- fixtures/graph/valid/minimal-pass.json
npm run validate:fixture -- fixtures/graph/valid/workshop-three-lane.json
npm run gate:fixture -- fixtures/graph/valid/workshop-three-lane.json
npm run validate:fixture -- fixtures/graph/invalid/excerpt-span-mismatch.json
npm run gate:fixture -- fixtures/graph/valid/borderline-low-excerpt-rate.json
```

Corpus shortcuts:

```bash
npm run corpus:validate:valid
npm run corpus:gate:valid
npm run corpus:gate:all # expected to exit 1 because it includes invalid/borderline fixtures
```

The fixture corpus is intentionally deterministic JSON, not generated at test time. It gives future agents and humans concrete examples of pass, borderline, and fail graph/gate behavior.

Validate a local GraphBundle JSON file:

```bash
npm run validate:fixture -- path/to/bundle.json
```

or via stdin:

```bash
cat path/to/bundle.json | npm run validate:fixture -- -
```

Run the quality gate on one or more local GraphBundle JSON files:

```bash
npm run gate:fixture -- path/to/bundle.json another-bundle.json
```

or via stdin:

```bash
cat path/to/bundle.json | npm run gate:fixture -- -
```

The fixture/default validation path is deterministic and must not import provider SDKs, read provider API keys, or make network calls. Safety tests enforce this contract and also guard app/deploy-oriented files against hardcoded infrastructure locations such as production URLs, literal IP addresses, database URLs/paths, infrastructure host assignments, and Atliera server-local paths.

## Runtime config seam

Atliera runtime infrastructure is parsed through `parseAtlieraRuntimeConfig(env)` rather than hidden module-level defaults. The parser accepts explicit env input and returns a typed config object for:

- environment (`ATL_ENV`)
- public base URL (`APP_BASE_URL`)
- bind host/port (`HOST`, `PORT`)
- database location (`DATABASE_URL`)
- artifact storage (`ARTIFACT_STORE`)
- queue backend (`QUEUE_BACKEND`)
- model provider (`MODEL_PROVIDER`)

The seam intentionally does not read `process.env` at import time and does not invent production infrastructure defaults. Missing infrastructure fields remain `undefined` until an environment supplies them.

## Runtime preflight seam

Atliera production-like runtime launch should fail closed before any app server, worker, DB client, queue broker, artifact store, or model provider is created. `runRuntimePreflight` validates a parsed `AtlieraRuntimeConfig` for environment-level launch readiness without reading env, opening sockets, importing providers, or constructing clients.

Production and staging currently require explicit `APP_BASE_URL`, `DATABASE_URL`, `ARTIFACT_STORE`, `QUEUE_BACKEND`, and `MODEL_PROVIDER` values. Test-only adapter choices such as `memory` artifact/queue backends and the `fake` model provider are rejected for production-like environments. Non-production environments may remain partial so tests, local development, and lab fixtures do not invent hidden infrastructure defaults. `assertRuntimePreflightPasses` throws with failure codes for launch paths that want fail-fast behavior.

## Resource preflight shape

Atliera resource reachability checks flow through `runResourcePreflight(config, checks)` after pure config preflight passes and after concrete durable adapters/clients exist. This layer accepts explicit caller-supplied check functions, aggregates pass/fail/warn results, requires production-like checks for database, artifact store, queue backend, and model provider targets, and refuses to run live checks when config preflight has already failed.

`defineArtifactStorePreflightCheck({ store, probeKey })` is the first concrete probe helper. It receives an already-composed `ArtifactStore`, writes a caller-scoped text probe artifact, reads it back, verifies the content matches, and reports only stable pass/fail codes plus sanitized metadata. The caller owns the probe key, so deployment wiring should use a safe environment/run-scoped key such as `preflight/<run-id>/artifact-store.txt` and should account for backend retention/lifecycle cleanup.

`defineGraphStorePreflightCheck({ store, graphId, bundle, mode })` is the graph persistence probe helper. It receives an already-composed `VersionedGraphStore`, commits a caller-scoped probe graph with `expectedRevision: null`, loads it back, verifies the revision and graph content match, and reports sanitized database-target outcomes. The caller owns the probe graph ID and lifecycle policy; reused probe IDs fail as conflicts instead of overwriting existing graph state.

`defineJobQueuePreflightCheck({ queue, queueName })` is the queue backend probe helper. It receives an already-composed `JobQueue`, enqueues a deterministic caller-scoped probe job, dequeues the same logical queue, verifies the leased job state and payload, completes it, verifies the completed job is gone, and reports sanitized queue-backend outcomes. The caller owns the probe queue namespace and any retention/cleanup behavior required by the concrete backend. Deployment wiring must use a dedicated run-scoped probe queue, not a production work queue that may already contain real jobs, because the generic `JobQueue` contract intentionally exposes `dequeue(queueName)` rather than payload-filtered leasing.

The resource preflight shape and probe helpers do not read `process.env`, construct clients, import provider/storage/queue/DB SDKs, open sockets by themselves, or choose buckets/endpoints/credentials/tables. Any live I/O comes only from the explicit injected adapter supplied by launch/deploy wiring. Check results are sanitized so thrown errors and secret-like metadata keys cannot leak credentials into reports.

## Runtime launch boundaries

Atliera app launch planning flows through `prepareRuntimeLaunch(runtime)` after runtime composition and before any app server, worker, DB client, queue broker, artifact store client, or model provider is started. The app launch boundary runs pure runtime config preflight and returns a launch report over the supplied runtime.

Atliera worker launch planning flows through `prepareWorkerRuntimeLaunch(runtime, options)` before any polling loop, dequeue, job execution, DB client, queue broker, artifact store client, or model provider call is started. Worker queues are logical queue names only, and unsafe URL/path/IP/host-like queue names are rejected before a worker loop can exist.

These seams do not read `process.env`, open sockets, construct clients, start HTTP servers, start polling loops, dequeue jobs, or execute jobs. Additional concrete resource reachability probes should continue to live beside durable adapter implementations and be supplied to the resource preflight shape explicitly.

## Model provider contract

Atliera model work flows through the pure `ModelProvider` contract before any real provider adapter, SDK import, API key, transport endpoint, or budgeted model mode is introduced. `ModelProviderRequest` carries only logical operation/model/input references, mode, prompt, idempotency key, bounded generation parameters, and string metadata. It intentionally excludes API keys, SDK clients, base URLs, transport handles, and provider-specific request objects.

`createModelProviderRequest` and `assertSafeModelProviderRequest` validate operation names, logical model ids, relative graph references, idempotency keys, output-token bounds, and temperature bounds before an implementation can run. `FakeModelProvider` is deterministic/no-spend for safe modes and still refuses `model` mode until a later explicit activation gate adds a real provider implementation.

The contract also encodes the legacy A.7 provider-safety lessons as hard requirements for future real-provider adapters: every paid call needs pre-call cost estimation checked against remaining budget; post-call cost records are reporting-only; invalid JSON and schema mismatches get at most one corrective retry before stage failure; hallucinated source IDs, excerpt/source-text mismatches, and unevidenced claims are rejected without retry; real activation requires explicit model mode, provider/model, max cost, out-of-repo corpus path, and operator approval with aggregated missing-gate refusal; missing/invalid credentials must refuse before calls without printing secret values; provider SDKs must be dynamically imported only inside activated real-provider paths; and fake/real providers must share the same `ModelProvider` boundary rather than parallel paths.

## Agent run records

Atliera agent orchestration is represented by pure `AgentRunRecord` objects before any polling loop, job execution, provider call, or database persistence exists. `createAgentRunRecord` validates a safe `agn_` run id, a referenced `run_` ResearchRun id, logical `art_` RunArtifact refs, safe relative graph/artifact references, lifecycle status, optional logical `job_` queue linkage, timestamps, and string metadata. `transitionAgentRunRecord` returns immutable lifecycle copies for allowed planned/queued/running/terminal transitions.

The AgentRun seam is intentionally record-only: it does not read `process.env`, enqueue jobs, call `ModelProvider`, write artifacts, construct clients, open sockets, choose tables/queues, or persist anything. Later app/worker wiring can persist these records and connect them to ResearchRun/RunArtifact rows without giving the model/provider path authority to bypass Graph validators or launch guards.

## Prompt contract placeholders

Atliera prompt contracts are pure placeholders in `PROMPT_CONTRACTS` for `propose.excerpts`, `propose.claims`, `propose.account_objects`, and `summarize.lens`. They reserve the required input references and allowed output record kinds for future model-backed orchestration while keeping `provider` and `model` null.

The prompt-contract seam is intentionally data-only: it does not read `process.env`, import provider SDKs, call models, open sockets, construct clients, persist records, enqueue jobs, or choose transport endpoints. Each contract encodes active safety requirements for later implementations: cite existing `source_document_id` context, do not invent source/excerpt/claim/object/relationship IDs, emit only allowed output record kinds, and route proposals through Graph validators plus the quality gate before persistence or display.

## Runtime composition seam

Atliera runtime wiring should flow through explicit dependency composition before any app server, worker, DB, queue broker, object store, or provider is selected. `createAtlieraRuntime` assembles a runtime from supplied config and service adapters; `createInMemoryAtlieraRuntime` is a named deterministic test/dev composition using only in-memory adapters.

The composition seam does not read `process.env`, create network clients, choose production infrastructure defaults, or hide deployment assumptions. `createInMemoryAtlieraRuntime` fails closed for staging/production so test/dev adapters cannot masquerade as production. Production wiring must pass explicit config and concrete adapters through this seam in a later PR.

## Job queue seam

Atliera background work should target a logical queue interface before any production queue backend is chosen. `JobQueue` defines a minimal enqueue/dequeue/complete interface and `InMemoryJobQueue` provides deterministic test/dev behavior without binding product logic to Redis, a database table, one process, or one server.

`DatabaseJobQueue` is the first database-backed adapter boundary for the job queue contract. It is SDK-neutral: callers inject a small database client plus a logical table identifier, and the adapter maps enqueue/dequeue/complete/get operations to that client. The lease boundary is one atomic client `leaseNextJob` operation that must claim and return a queued row as leased; the adapter itself does not pick a visibility timeout, retry policy, dead-letter policy, max payload size, database URL, host, credential, SDK, or migration shape. It validates logical queue names, table names, generated job IDs, and strict JSON-value payloads before client access, wraps backend failures with stable sanitized errors, and emits best-effort sanitized operation events.

Queue names are logical identifiers, not URLs, paths, IP addresses, host:port strings, or broker addresses. Unsafe queue names are rejected before enqueue/dequeue.

## Artifact store seam

Atliera artifacts should be addressable through implementation-neutral keys before product logic depends on any deployment-specific storage location. `ArtifactStore` defines a minimal text-artifact interface and `InMemoryArtifactStore` provides deterministic test/dev behavior without binding product logic to a local filesystem, bucket, queue, or server.

`S3ArtifactStore` is the first durable-adapter boundary. It is S3-compatible but SDK-neutral: callers inject a small object-storage client, bucket, optional logical prefix, and optional max payload size. The adapter does not read `process.env`, import an AWS SDK, construct clients, open sockets by itself, or hardcode buckets, regions, endpoints, accounts, hosts, or mount paths. It maps logical artifact keys to backend object keys internally and returns only the logical artifact key to product code.

Artifact keys are relative slash-delimited identifiers, not URLs or absolute paths. Unsafe keys with traversal, empty segments, URL schemes, or backslashes are rejected before reads or writes. The S3-compatible adapter also validates bucket/prefix config, rejects oversized payloads before writing when `maxPayloadBytes` is configured, preserves missing objects as `undefined`, emits sanitized best-effort operation lifecycle events through an optional observer, and wraps backend failures with stable sanitized operation context so secret-bearing dependency errors do not leak.

## Versioned graph store seam

The core evidence/workshop graph path now has a versioned persistence contract before product code depends on a database. `VersionedGraphStore` addresses graphs by logical graph IDs and returns revision tokens with each committed snapshot. Writers must supply `expectedRevision`, using `null` only for graph creation. If another writer commits first, the store raises `GraphStoreConflictError` instead of silently overwriting.

`InMemoryVersionedGraphStore` is deterministic test/dev behavior, not production durability. It still enforces the contract shape: safe logical graph IDs, schema validation before commit, safe-mode write refusal, defensive copies, read-your-writes behavior, and no env reads, SDK imports, client construction, network calls, deployment paths, DB URLs, or infrastructure addresses.

`DatabaseVersionedGraphStore` is the first database-backed adapter boundary for the versioned graph contract. It is SDK-neutral: callers inject a small database client plus a logical table identifier, and the adapter performs create-only inserts or expected-revision conditional updates through that client. The atomic commit boundary is one whole serialized `GraphBundle` row per conditional client operation. The adapter does not read `process.env`, import a DB SDK, construct clients, open sockets by itself, choose database URLs/hosts/tables, or wire app/server/worker launch code. It validates graph IDs and bundles before writes, returns defensive copies, preserves missing rows as `undefined`, emits sanitized best-effort operation events, and wraps backend failures without leaking connection strings, table internals, credentials, tokens, or graph payloads.

## File-backed graph store

Phase 1.4 also includes a tiny file-backed graph store adapter for local JSON files only. It is not a database and it does not add app/runtime persistence. The store:

- loads GraphBundle JSON files from disk
- validates bundles before save by default
- writes atomically through temp-file + rename
- requires an explicit output root for saves
- rejects writes outside the output root, `.git` paths, repo working-tree paths by default, git-tracked files, symlink escapes, and implicit overwrites
- refuses saves in `validation`, `fixture`, and `fake` safe modes
- performs no network, provider, or DB work

CLI smoke commands:

```bash
npm run graph:load -- fixtures/graph/valid/minimal-pass.json
mkdir -p /tmp/atliera-graph-output
npm run graph:save-copy -- fixtures/graph/valid/minimal-pass.json /tmp/atliera-graph-output/copy.json --mode model --out-root /tmp/atliera-graph-output
```

`graph:save-copy` intentionally requires both an explicit mode and an explicit `--out-root`. Passing a safe mode such as `--mode fixture` is expected to fail because file-store writes go through the production-write guard. Existing output files are refused unless `--allow-overwrite` is passed.

## Local run artifact manifests

Phase 1.5 packages a local GraphBundle, its per-bundle quality-gate report, and a manifest into one explicit output-root directory. This is still local JSON file output only: no provider calls, no network, no database, and no app/runtime persistence.

CLI smoke command:

```bash
mkdir -p /tmp/atliera-run-output
npm run run:manifest -- fixtures/graph/valid/minimal-pass.json --mode model --out-root /tmp/atliera-run-output --run-slug fixture-valid-run
```

The manifest package contains:

- `graph-bundle.json`
- `quality-gate-report.json`
- `manifest.json`

`run:manifest` writes through the same path guard as the file-backed graph store. It requires `--out-root` and `--run-slug`, refuses safe-mode writes, refuses implicit overwrites, records the per-bundle quality-gate status in `manifest.json`, and uses relative artifact paths inside the manifest.

The v1 manifest also reserves stable future model-run fields so later provider phases can populate the same schema shape instead of forcing early consumers to handle a second manifest shape immediately:

- `model_run`: currently `provider`, `model`, `started_at`, and `completed_at` are `null`
- `cost_ledger`: currently `currency`, `total_cost`, `input_tokens`, and `output_tokens` are `null`
- `adapter_records`: currently an empty array

## Workshop shell smoke HTML

Phase 2.1 adds a deterministic static Workshop shell renderer. It renders a GraphBundle into an Atliera Workshop HTML page with Signals, Maps, and Plays lens panels from the same graph-derived view model. `fixtures/graph/valid/workshop-three-lane.json` is the richer preview fixture for seeing all three lanes populated at once.

CLI smoke command:

```bash
mkdir -p /tmp/atliera-workshop
npm run workshop:shell -- fixtures/graph/valid/minimal-pass.json --out-root /tmp/atliera-workshop --out-file acme-workshop.html
npm run workshop:shell -- fixtures/graph/valid/workshop-three-lane.json --out-root /tmp/atliera-workshop --out-file acme-workshop-three-lane.html
```

The output is local static HTML only. It does not call providers, read API keys, use the network, touch a database, or deploy. The shell is intentionally fixture/graph-backed: unsupported or inferred material must be visibly labeled, and verified-looking items must carry evidence/provenance metadata. Each card includes a deterministic evidence packet drawer that shows supporting claim text, accepted excerpt text, and source metadata directly from the GraphBundle.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pull requests to `main`, pushes to `main`, and manual dispatch.

CI steps:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm test`
5. `npm run gate:fixture:valid`
