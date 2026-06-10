# Atliera

Atliera is an evidence-backed account intelligence workspace.

This repository is the clean-slate Atliera product foundation for the registered `atliera.com` domain. Atliera is separate from the legacy account-research/report system: it should boot from an empty database and use legacy systems only as external comparison references.

Core architecture vocabulary:

- Atliera Workshop — the main human + agent workspace
- Atliera Agent — the app-bounded in-product intelligence capability
- Atliera Graph — the evidence/source/excerpt/claim/object truth layer
- Signals / Maps / Plays — launch lenses over the same graph, not separate early data pipelines

See `docs/architecture/atliera-product-architecture.md`, `docs/architecture/durable-adapter-contracts.md`, `docs/strategy/substrate-to-validation-transition.md`, `docs/safety/untrusted-input-snapshot-contract.md`, and `docs/adr/0001-atliera-fresh-system.md` for the initial architecture plan, current substrate-to-validation transition decision, and load-bearing snapshot-boundary safety contract.

## Current implementation surface

The current codebase now extends beyond the original Phase 1 graph foundation while still preserving a no-spend/default-closed posture:

- graph primitive types in `src/graph/types.ts`
- strict structural parsing in `src/graph/schema.ts`
- deterministic hard-invariant validation in `src/graph/validate.ts`
- no-spend fixture validation CLI in `src/cli/validate.ts`
- Workshop HTML rendering through the graph-derived Signals / Maps / Plays view model
- runtime composition seams for explicit adapter wiring rather than hidden infrastructure defaults
- database-backed queue and graph store seams behind injected clients and sanitized adapter contracts
- model route catalog, activation gates, and no-call/guarded proof harnesses that remain explicit, bounded, and inactive by default
- adversarial graph tests in `tests/graph/`
- safety tests in `tests/safety/`

The repository still does not claim launch readiness. The current no-spend Gate 3 foundation includes fake/local Workshop serving, local health, local durable DB boot/migration, local backup/restore, and a local bearer auth seam. The next recommended foundation-first product work is deployment planning and lab-supervision preflight, with any AWS service use kept behind portable adapter/config seams.

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

The quality gate consumes one or more GraphBundle JSON files, runs deterministic validation, computes per-bundle and aggregate launch-quality metrics, and emits `pass`, `borderline`, or `fail`. It exits `0` only for `pass`.

Quality gate checks include:

- hard validation failures
- invented ID failures
- zero-output incidents
- accepted excerpt rate
- verified/high-confidence claim evidence coverage

When multiple bundles are supplied, the gate also reports aggregate corpus metrics for total bundles, pass/borderline/fail counts, hard-failure bundles, zero-output incident rate, total graph records, and aggregate verified/high-confidence claim evidence coverage. The aggregate layer is deterministic and local-only; it does not by itself claim launch readiness.

`evaluateWorkshopLensUsefulness` is a deterministic review helper for the launch-lens layer. It consumes the graph-derived Workshop view model and requires at least two materially useful graph-backed lenses by default. A lens counts as useful only when it has at least one non-unsupported item with an accepted evidence packet. `summarizeWorkshopLensUsefulnessReviews` rolls those per-account reviews up across a corpus while preserving per-account failures and always reports `launch_readiness_claim: false`; human/product review and live-account selection still remain separate launch-readiness work.

`assessLaunchGateCorpusManifestFile("fixtures/gate-corpus/launch-v0.json")` ties the selected corpus manifest, per-entry validator/gate checks, aggregate quality-gate summary, usable-account lens-usefulness reviews, and explicit Gate 4 metrics into one deterministic local assessment object. The assessment validates safe fixture paths, reports expected-outcome mismatches separately from actual gate evidence, exposes usable-account zero-output rate, material-claim coverage, hard-invariant failures, and lens-usefulness failures, and also always reports `launch_readiness_claim: false`.

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

A selected deterministic launch-gate corpus manifest lives at `fixtures/gate-corpus/launch-v0.json`. It names the v0 usable-account, borderline-calibration, and adversarial-regression fixture set plus expected validator/gate outcomes. The manifest is an executable validation input and explicitly sets `launch_readiness_claim: false`; it documents the first selected corpus without claiming that live-account selection, lens-usefulness review, or launch readiness is complete.

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

`defineModelProviderActivationPreflightCheck({ activation, credential })` is the model-provider readiness probe helper before any paid call. It evaluates the explicit model activation decision, refuses before touching credential checks when approval/budget gates fail, then runs a caller-supplied credential-presence check that returns only `present`, `missing`, or `invalid`. The helper does not read credentials, construct provider clients, import SDKs, estimate cost itself, call models, or expose credential names/values in reports; deployment wiring owns the actual secret lookup and real-provider adapter.

The resource preflight shape and probe helpers do not read `process.env`, construct clients, import provider/storage/queue/DB SDKs, open sockets by themselves, or choose buckets/endpoints/credentials/tables. Any live I/O comes only from the explicit injected adapter supplied by launch/deploy wiring. Check results are sanitized so thrown errors and secret-like metadata keys cannot leak credentials into reports.

## Runtime launch boundaries

Atliera app launch planning flows through `prepareRuntimeLaunch(runtime)` after runtime composition and before any app server, worker, DB client, queue broker, artifact store client, or model provider is started. The app launch boundary runs pure runtime config preflight and returns a launch report over the supplied runtime.

Atliera worker launch planning flows through `prepareWorkerRuntimeLaunch(runtime, options)` before any polling loop, dequeue, job execution, DB client, queue broker, artifact store client, or model provider call is started. Worker queues are logical queue names only, and unsafe URL/path/IP/host-like queue names are rejected before a worker loop can exist.

These seams do not read `process.env`, open sockets, construct clients, start HTTP servers, start polling loops, dequeue jobs, or execute jobs. Additional concrete resource reachability probes should continue to live beside durable adapter implementations and be supplied to the resource preflight shape explicitly.

## Model provider contract

Atliera model work flows through the pure `ModelProvider` contract before any real provider adapter, SDK import, API key, transport endpoint, or budgeted model mode is introduced. `ModelProviderRequest` carries only logical operation/model/input references, mode, prompt, idempotency key, bounded generation parameters, and string metadata. It intentionally excludes API keys, SDK clients, base URLs, transport handles, and provider-specific request objects.

`createModelProviderRequest` and `assertSafeModelProviderRequest` validate operation names, logical model ids, relative graph references, idempotency keys, output-token bounds, and temperature bounds before an implementation can run. `FakeModelProvider` is deterministic/no-spend for safe modes and still refuses `model` mode until a later explicit activation gate adds a real provider implementation.

The contract also encodes the legacy A.7 provider-safety lessons as hard requirements for future real-provider adapters: every paid call needs pre-call cost estimation checked against remaining cumulative budget; post-call cost records are reporting-only; invalid JSON and schema mismatches get at most one corrective retry before stage failure; hallucinated source IDs, excerpt/source-text mismatches, and unevidenced claims are rejected without retry; real activation requires explicit model mode, provider/model, max cost, out-of-repo corpus path, and operator approval with aggregated missing-gate refusal; missing/invalid credentials must refuse before calls without printing secret values; provider SDKs must be dynamically imported only inside activated real-provider paths; and fake/real providers must share the same `ModelProvider` boundary rather than parallel paths.

`validateModelProviderCompatibility({ provider, request, ... })` is the SDK-neutral validation harness for the first real-provider run. It evaluates approval/budget gates, refuses on missing/invalid credential status before calling the injected provider, performs exactly one provider call when gates pass, validates the response envelope, optionally checks returned graph-proposal buckets against a selected proposal prompt contract's allowed output record kinds, and returns a sanitized report plus a cost-ledger entry for succeeded/failed/refused outcomes. It validates envelope-level shape, identity, usage, cost accounting, and prompt-contract output compatibility when a proposal contract operation is supplied; deeper graph evidence correctness such as source-ID validity, excerpt text matching, and claim support still belongs to the graph validators and quality gate after provider output is materialized into graph proposals. The harness does not construct providers, read env, import SDKs, estimate cost itself, persist ledger rows, write artifacts, retry prompts, or expose prompts/provider errors/secret names in reports; launch/lab wiring owns the approved corpus, provider adapter, credential lookup, artifact persistence, and cleanup policy.

`runFullPipelineValidationPackage` and `npm run validation:full-pipeline -- <bundle.json> --provider-report <provider-report.json> --out-root <dir> --run-slug <slug> --now <iso>` provide the deterministic follow-up packaging path after a provider-validation report already exists. This helper takes sanitized provider-validation evidence, creates a validated `AgentRunRecord`, runs graph validation and the quality gate through the local run-manifest writer, persists the graph bundle, quality report, provider-validation report, AgentRun record, and manifest under one explicit output root, and emits a compact pass/fail summary with relative artifact paths. It fails closed unless provider evidence has a successful cost-ledger status and passed validation checks. It still performs no live provider calls, credential reads, network access, database writes, deployment, or Hermes Agent runtime/configuration changes.

## Model activation approval and budget gates

`createModelActivationApproval`, `createModelCostLedgerEntry`, and `evaluateModelActivationGates` formalize the first approval/budget gate before any real provider adapter exists. Approval records are explicit data objects with approver, timestamp, provider, model, maximum USD budget, out-of-repo corpus scope, cleanup commitment, approval provenance reference, budget-ledger artifact reference, run-evidence artifact reference, and cleanup-outcome artifact reference.

Cost ledger entries reserve the minimum audit fields for future real calls: provider, model, account reference, prompt stage, input/output tokens, estimated and observed USD cost, status, retry count, error, and timestamp. `evaluateModelActivationGates` aggregates missing activation gates before refusal and refuses before a call when cumulative observed spend plus the next estimate would exceed the approval cap. These seams are pure and local only: they do not read `process.env`, import provider SDKs, call providers, open sockets, persist records, or choose artifact/storage locations.

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

## Local durable DB boot and backup

`initializeLocalDurableDb` and `inspectLocalDurableDb` define the first local durable DB boot/migration contract. The default implementation is a deterministic local file-backed schema manifest with logical table files for graph snapshots, job queue rows, and schema migrations. It is intentionally local-only, no-network, and provider-neutral: it does not choose a database service, import a DB SDK, read deployment config, or claim lab/production readiness.

`backupLocalDurableDb` and `restoreLocalDurableDbBackup` add a local backup/restore round-trip for that contract. Backups are versioned, schema-stamped JSON artifacts with per-table SHA-256 checksums. Restore writes into an empty target by default and refuses non-empty targets unless `--allow-overwrite` is explicit.

CLI smoke commands:

```bash
npm run --silent db:local:init -- --root <local-db-dir> --now 2026-06-09T00:00:00.000Z
npm run --silent db:local:inspect -- --root <local-db-dir>
npm run --silent db:local:backup -- --root <local-db-dir> --out <backup.json> --now 2026-06-09T00:02:00.000Z
npm run --silent db:local:restore -- --backup <backup.json> --target-root <restored-db-dir>
```

AWS infrastructure such as EC2-attached storage, RDS-compatible databases, or managed backup services may be useful in later lab/deployment slices, but they must be selected through deployment config/adapters. Product logic should continue to depend on the portable boot/migration, backup/restore, and adapter contracts rather than AWS-specific assumptions.

## Local bearer auth seam

`parseLocalBearerAuthConfig` and `authorizeBearerTokenRequest` define the first local auth seam for the fake-mode Workshop server. The seam is intentionally small: a configured local bearer token protects `/workshop`, and `/healthz` remains a shallow liveness route while DB-aware health details are redacted unless a valid bearer token is supplied.

The fake-mode Workshop server CLI now requires `ATLIERA_LOCAL_BEARER_TOKEN` unless an operator explicitly sets `ATLIERA_LOCAL_AUTH_MODE=disabled-local-dev` for local development. The auth helper accepts an injected env-record parameter, does not read `process.env`, does not construct provider clients, does not call external identity services, and does not claim lab or production readiness.

CLI smoke examples:

```bash
ATLIERA_LOCAL_BEARER_TOKEN=<token> npm run --silent workshop:serve:fake
curl -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/workshop
```

Later lab/deployment work may use AWS services such as SSM Parameter Store, Secrets Manager, Cognito, IAM, or ingress-level auth pragmatically, but those choices must stay behind deployment config/adapters. Product logic should continue to depend on the portable auth seam rather than AWS-specific identity assumptions.

## Artifact store seam

Atliera artifacts should be addressable through implementation-neutral keys before product logic depends on any deployment-specific storage location. `ArtifactStore` defines a minimal text-artifact interface and `InMemoryArtifactStore` provides deterministic test/dev behavior without binding product logic to a local filesystem, bucket, queue, or server.

`S3ArtifactStore` is the first durable-adapter boundary. It is S3-compatible but SDK-neutral: callers inject a small object-storage client, bucket, optional logical prefix, and optional max payload size. The adapter does not read `process.env`, import an AWS SDK, construct clients, open sockets by itself, or hardcode buckets, regions, endpoints, accounts, hosts, or mount paths. It maps logical artifact keys to backend object keys internally and returns only the logical artifact key to product code.

Artifact keys are relative slash-delimited identifiers, not URLs or absolute paths. Unsafe keys with traversal, empty segments, URL schemes, or backslashes are rejected before reads or writes. The S3-compatible adapter also validates bucket/prefix config, rejects oversized payloads before writing when `maxPayloadBytes` is configured, preserves missing objects as `undefined`, emits sanitized best-effort operation lifecycle events through an optional observer, and wraps backend failures with stable sanitized operation context so secret-bearing dependency errors do not leak.

`validateS3ArtifactStoreCompatibility({ client, bucket, prefix, probeId })` is the first validation harness for exercising the S3-compatible path against an injected real client or high-fidelity emulator wrapper. It performs deterministic probe checks for text roundtrip, missing-object not-found behavior, last-write-wins overwrite behavior, prefix isolation, and max-payload refusal. The harness returns only stable sanitized check names/codes, explicitly marks `contract: "s3_compatible_object_api"` with `provider_binding: "none"`, and does not construct clients, read env, import storage SDKs, open sockets itself, choose infrastructure, clean up probe objects, or expose bucket/prefix/backend error details. Lab/deploy wiring owns the real/emulator client, probe bucket/prefix choice, run-scoped `probeId`, object retention, and cleanup policy.

`FilesystemS3CompatibilityClient` is a local validation client for that harness. It implements the injected S3-compatible client interface on top of an explicit private filesystem root, persists each object as one atomically-renamed JSON file containing body/content type/metadata, and rejects traversal/symlink escape attempts before writing outside the object root. It is intended for deterministic lab/CI validation when a real S3-compatible backend is unavailable and assumes the configured root is not writable by untrusted local users. The local CLI smoke path is `npm run s3:compatibility:filesystem -- --root-dir <private-absolute-dir> --bucket <safe-bucket> --prefix <safe-prefix> --probe-id <safe-probe-id>`; it emits a sanitized JSON report with an explicit filesystem-emulator limitation. It still does not prove provider-specific behavior such as IAM, endpoint signing, bucket lifecycle, consistency, object-lock, multipart upload, or network failure semantics; a real S3-compatible backend validation run remains required before treating the durable artifact path as production-ready. Use `docs/runbooks/lab-s3-artifact-validation.md` as the lab-only operator checklist before creating or using any real bucket.

`AwsCliS3CompatibilityClient` is the first lab-only real-backend validation wiring. Before touching a bucket, operators can run `npm run s3:compatibility:check-aws-cli --silent` to emit a sanitized no-bucket tooling preflight that only verifies the `aws` executable responds to `--version` within a short timeout with credential-bearing environment stripped from the child process; add `--out-root <private-evidence-dir> --out-file <relative-report.json>` when the preflight pass/blocker should be preserved as a guarded sanitized artifact. The preflight marks `validation_scope: "tooling_preflight_no_bucket_access"` and `object_lifecycle: "not_applicable_no_bucket_access"` because it does not touch a bucket or create objects. It does not check credentials, bucket access, endpoint signing, or object-storage semantics. The real validation CLI also requires an explicit `--approval-ref` before it will touch a bucket and reports only that an operator approval reference was present, not the reference value. The real validation path shells out to the operator's installed `aws s3api` CLI with explicit bucket, prefix, probe id, approval reference, and region or endpoint inputs, then passes that injected client through the same compatibility harness with a bounded 10-second AWS CLI operation timeout. Timeout failures must stay sanitized and must not echo raw timeout values or process signals. The smoke path is `npm run s3:compatibility:aws-cli -- --bucket <lab-bucket> --prefix <lab-prefix> --probe-id <run-probe-id> --approval-ref <private-approval-ref> --region <region>` or `--endpoint-url <endpoint>` for compatible providers; add `--aws-timeout-ms <250-300000>` only when the operator needs to override the default per-operation timeout, add `--out-root <private-evidence-dir> --out-file <relative-report.json>` when an operator-selected sanitized evidence artifact should be written, and add `--allow-overwrite` only when replacing an existing evidence file is intentional; `--allow-overwrite` is rejected without paired `--out-root` and `--out-file` evidence-output flags. It emits sanitized JSON evidence and returns non-zero on failed checks; evidence uses `operator_approval_ref_present` rather than the approval reference value and must not emit raw approval references, raw backend errors, local paths, or credential-bearing details. It does not install AWS tooling, create buckets, choose credentials, read env in product code, import AWS SDKs, clean up objects automatically, or make this path production-ready without the lab runbook approval/IAM/cleanup steps.

Amazon S3 Files is a relevant AWS deployment option because it exposes S3 buckets as managed file systems for EC2/ECS/EKS/Lambda-style compute; see AWS's April 7, 2026 launch note, [Launching S3 Files, making S3 buckets accessible as file systems](https://aws.amazon.com/blogs/aws/launching-s3-files-making-s3-buckets-accessible-as-file-systems/). Atliera should incorporate it as a validation candidate for file-interface workflows, but product code should still depend on logical artifact keys rather than mount paths. Any S3 Files-backed adapter needs explicit validation notes for S3 sync timing, NFS close-to-open behavior, POSIX UID/GID metadata, encryption/IAM assumptions, and divergences from direct S3 object API behavior.

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

The manifest package always contains:

- `graph-bundle.json`
- `quality-gate-report.json`
- `manifest.json`

When the programmatic writer receives a sanitized `ModelProviderValidationReport`, the package also contains:

- `model-provider-validation-report.json`

When the programmatic writer also receives a validated `AgentRunRecord`, the package contains:

- `agent-run-record.json`

Only pass reports produced by the sanitized provider-validation pathway into the writer. `writeRunArtifactManifest` persists the supplied validation report and derives summaries from its stable IDs/status codes; it does not parse raw provider responses or scrub arbitrary caller-supplied payloads. `AgentRunRecord` inputs are revalidated through the pure AgentRun record seam before persistence.

`run:manifest` writes through the same path guard as the file-backed graph store. It requires `--out-root` and `--run-slug`, refuses safe-mode writes, refuses implicit overwrites, records the per-bundle quality-gate status in `manifest.json`, and uses relative artifact paths inside the manifest.

The v1 manifest keeps stable model-run evidence fields so provider validation phases can use the same schema shape without requiring consumers to parse raw provider responses:

- `model_run`: records provider/model plus operation/idempotency/status when provider-validation evidence is present; otherwise these placeholders remain `null`
- `cost_ledger`: records USD observed/estimated cost, tokens, status, and stable error code from the model cost-ledger entry when present; otherwise the placeholder cost fields remain `null`
- `adapter_records`: records a sanitized `model_provider` adapter summary when validation evidence is present; otherwise an empty array
- `agent_run`: records the AgentRun id/status/operation/input graph ref plus the relative `agent-run-record.json` path when AgentRun linkage is present; otherwise `null`

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
