# Durable adapter contracts

Status: Proposed

Atliera's runtime seams intentionally define interfaces before choosing production storage, queue, database, or provider implementations. This document defines the contract future durable adapters must satisfy before app-server, worker, provider, or deployment wiring depends on them.

This is a contract spec for implementers. A developer with no Atliera context should be able to read this document and understand what makes a future durable adapter compliant.

## Scope

In scope now:

- `ArtifactStore`
- `JobQueue`
- `GraphStore`
- cross-cutting durability, ordering, idempotency, failure, and observability expectations
- a forward reference for future `ModelProvider` contract work

Out of scope for the initial contract PR:

- implementing S3, filesystem, Postgres, Redis, SQS, or provider adapters
- app server or worker launch code
- concrete resource preflight probes or live reachability checks
- SDK imports, API key reads, client construction, network calls, or deployment scripts
- choosing an observability vendor

The first durable adapter implementation now begins with an SDK-neutral, S3-compatible `ArtifactStore` boundary. It still does not wire app/server/worker code, import an AWS SDK, read API keys/env, construct clients, or choose production buckets/endpoints.

This spec defines contracts. It does not prescribe specific implementations. The following are intentionally addressed in future PRs:

- app server and worker launch infrastructure
- additional durable adapter implementations for graph and queue storage
- concrete resource preflight probes alongside or after durable adapters
- deployment scripts, CI/CD wiring, and monitoring vendor selection

## Durability definition

For Atliera production-like environments, durable means that committed data survives:

- process restarts
- application redeploys
- ordinary host restarts
- machine failure, within the accepted deployment availability model

Durability also requires an operational recovery path, such as backups, replication, versioning, or managed-service recovery controls. A component is not production-durable merely because it writes bytes somewhere.

Examples that may satisfy the durable contract when configured correctly:

- AWS S3 or equivalent multi-AZ object storage
- Amazon S3 Files or another managed S3-backed filesystem when the adapter explicitly accepts the file-interface semantics, synchronization windows, recovery model, and operational limits
- Postgres with persistent storage, backups, and an explicit restore path
- managed queue services with persistence and dead-letter support
- replicated object stores with documented failure domains

Examples that do not satisfy production durability by default:

- in-memory adapters
- container scratch space or ephemeral filesystems
- default local filesystem paths on one EC2 host
- single-instance object stores without replication or backups
- a mounted object-store filesystem whose rename, listing, locking, or flush semantics are not documented and accepted

Atliera infrastructure currently lives on AWS and S3 is an available likely implementation target. That availability does not make the product contract AWS-specific. Runtime code must still depend on logical config and adapter interfaces, not hardcoded buckets, regions, EC2 paths, mount paths, endpoints, or account-specific infrastructure.

## Config preflight and resource preflight

Config preflight is pure. It validates selected runtime config before clients exist. It must not read env, open sockets, import providers, construct DB/queue/storage clients, or check live resource reachability.

Resource preflight is live. It checks whether configured resources are reachable and permissioned after concrete clients/adapters exist. The substrate defines a pure resource-preflight result/check shape, while concrete probes belong alongside or after durable adapters so they can use injected clients without sneaking client construction into the substrate.

The first concrete probe helper is `defineArtifactStorePreflightCheck({ store, probeKey })`. It accepts an already-composed `ArtifactStore`, writes and reads a caller-scoped text probe artifact, and returns stable sanitized pass/fail codes. It must not construct storage clients, read env, choose buckets/endpoints/credentials, or leak backend error details. Deployment wiring owns the probe key and cleanup/retention policy for probe objects.

`defineGraphStorePreflightCheck({ store, graphId, bundle, mode })` accepts an already-composed `VersionedGraphStore`, commits a caller-scoped probe graph with create-only optimistic concurrency, loads it back, verifies the revision and graph content match, and returns stable sanitized database-target pass/fail codes. It must not construct database clients, read env, choose tables/URLs/credentials, import DB SDKs, or leak backend error details. Deployment wiring owns the probe graph ID and cleanup/retention policy; a reused probe ID must surface as a conflict rather than overwrite existing graph state.

## Cross-cutting contract requirements

### Logical addressing

Adapters expose logical identifiers, not deployment paths or URLs, unless the interface explicitly says otherwise.

- artifact references are logical keys
- queue names are logical identifiers
- graph references are graph IDs and versions

Adapter implementations may map those identifiers to buckets, tables, prefixes, streams, queues, or files internally, but those mappings must stay behind config and adapter boundaries.

### Failure handling

Durable adapters must surface operational failures as explicit errors or typed failure results. They must not silently downgrade to in-memory behavior, local files, fake providers, or no-op writes.

Expected durable failures include:

- not found
- permission denied
- invalid key/name/id
- conflict or version mismatch
- timeout
- retry exhaustion
- throttling or rate limiting
- dependency unavailable
- payload too large
- serialization or schema failure

Failure messages and logs must include enough context to diagnose the issue without leaking secrets, connection strings, credentials, signed URLs, tokens, or full sensitive payloads.

### Idempotency

Adapters and consumers must assume retries happen.

Operations should be idempotent where the interface can make that safe. Where idempotency requires a caller-supplied key, the interface or higher-level contract must say so explicitly.

Duplicate queue delivery is expected. Job consumers must be idempotent even if a development in-memory queue appears to deliver exactly once.

### Ordering

Atliera must not rely on global ordering across app servers, workers, queues, graph stores, and artifact stores.

Durable queue adapters must not promise FIFO ordering by default. Any stronger ordering guarantee must be adapter-specific, explicit, tested, and reflected in runtime config. Product logic should assume at-least-once delivery with possible duplicates and reordering.

Graph writes and reads may have stronger consistency than queues, but cross-process and replica behavior must be documented by the adapter.

### Observability

Durable adapters are operational failure points. Future implementations must emit structured observability signals without choosing a vendor in this contract.

Each adapter operation should support:

- correlation or request IDs supplied by the caller or runtime
- operation start, success, failure, retry, and timeout events
- duration measurement
- sanitized dependency identifiers, such as logical adapter name and operation name
- failure code/category suitable for metrics and alerting

Logs and metrics must not contain secrets, raw credentials, signed URLs, tokens, API keys, or full sensitive artifact/graph payloads.

## ArtifactStore contract

`ArtifactStore` stores and retrieves artifacts by logical keys. The current in-memory implementation is a deterministic test/dev adapter. It does not define production durability.

### Key semantics

Artifact keys are relative slash-delimited identifiers. They are not URLs, absolute paths, local filesystem paths, S3 URLs, S3 mount paths, or deployment-specific locations.

Implementations must reject unsafe keys before reads or writes, including:

- blank keys
- dot or empty segments
- traversal segments
- absolute paths
- backslashes
- URL-like strings
- implementation-specific reserved prefixes, if documented

### Write semantics

A successful write is committed only after the adapter can report that the artifact is durably stored according to its backend's contract.

Required behavior:

- `put(key, value)` with the same key and same value should be idempotent.
- `put(key, value1)` followed by `put(key, value2)` must have explicit adapter behavior: either overwrite with last-write-wins or reject with a conflict. The adapter must document which behavior it implements.
- Partial writes must not be observable as successful committed artifacts.
- Payload size limits must be documented and enforced with explicit errors.

### Read and not-found semantics

- Reading a missing key should return the interface's not-found shape rather than inventing an empty artifact.
- Permission failures must not be collapsed into not-found unless the adapter explicitly documents that security model.
- Reads after successful writes should be consistent for the writing process. Cross-process/listing visibility may depend on the backend and must be documented.

### Listing semantics

If a future ArtifactStore adds listing, the adapter must document:

- whether listing is strongly or eventually consistent
- whether ordering is guaranteed
- whether pagination can return duplicates or omit recently written keys
- whether prefixes are logical only or map to backend paths internally

Current product logic must not require listing consistency until the interface explicitly defines it.

### AWS/S3 note

`S3ArtifactStore` is Atliera's first durable adapter boundary. It is S3-compatible but intentionally SDK-neutral: the adapter receives a small injected client plus explicit bucket/prefix/payload config, and therefore does not import an AWS SDK, read credentials, construct clients, open sockets by itself, or choose production infrastructure.

The first S3-compatible validation harness is `validateS3ArtifactStoreCompatibility({ client, bucket, prefix, probeId })`. It exercises an injected real client or high-fidelity emulator wrapper through the `S3ArtifactStore` boundary and reports deterministic sanitized results for text roundtrip, missing-object not-found behavior, last-write-wins overwrite behavior, prefix isolation, and max-payload refusal. Its report explicitly marks `contract: "s3_compatible_object_api"` and `provider_binding: "none"` so validation evidence names the portable object API contract rather than implying an AWS-only binding. The harness is not deployment wiring: it does not import storage SDKs, read env, construct clients, open sockets itself, choose buckets/endpoints/regions/credentials, clean up probe objects, or decide retention. The caller owns a run-scoped probe namespace, backend/client construction, emulator fidelity notes, retention, and cleanup policy.

`FilesystemS3CompatibilityClient` is the first local compatibility client for the harness. It is filesystem-backed rather than in-memory, persists each object as one atomically-renamed JSON file containing body/content type/metadata, rejects traversal/symlink escapes, and assumes its private validation root is not writable by untrusted local users. Its documented limit is important: it validates Atliera's injected-client boundary and artifact-key behavior in deterministic CI/lab runs, but it does not validate cloud-provider behavior such as IAM/signing, endpoint networking, bucket policy, lifecycle/retention, eventual consistency, multipart behavior, or object-lock semantics.

`AwsCliS3CompatibilityClient` is lab-only real-backend validation wiring, not app/server/worker storage wiring. It may exercise an operator-approved S3-compatible backend through `aws s3api`, but only with explicit bucket, prefix, probe ID, approval reference, and region or endpoint inputs supplied outside product code. Architecture-level evidence boundaries match the runbook and CLI contract: emitted evidence records `operator_approval_ref_present` and `operator_cleanup_required`, does not emit raw approval references, raw backend errors, local paths, signed URLs, credentials, or bucket/endpoint values, and does not make the artifact path production-ready. The no-bucket `check-aws-cli` tooling preflight must preserve `validation_scope: "tooling_preflight_no_bucket_access"` and `object_lifecycle: "not_applicable_no_bucket_access"` because it does not touch a bucket or create objects. The AWS CLI wiring must continue to use argv-style process execution without shell interpolation, bounded operation timeouts, guarded evidence-output paths, and the existing injected-client harness so backend/client construction remains outside `S3ArtifactStore`. Operators may override the bounded default timeout only through `--aws-timeout-ms <250-300000>`, and timeout failures must stay sanitized without echoing raw timeout values or process signals.

The adapter uses logical keys at the product boundary and maps them to backend object keys internally. Bucket, prefix, region, credentials, endpoint, and retry behavior remain runtime/client concerns outside the product contract. The implementation documents last-write-wins object replacement semantics through ordinary object-store `putObject` behavior; callers that require conflict detection need a future versioned interface change. Its optional observer emits sanitized start/success/failure events with operation, logical key, duration, and stable failure category only; it must not expose payloads, credentials, signed URLs, or backend object keys. Observer callbacks are best-effort telemetry and must not change storage outcomes if they fail.

Amazon S3 Files is a concrete AWS option for exposing general-purpose S3 buckets as a managed file system on AWS compute; see AWS's April 7, 2026 launch note, [Launching S3 Files, making S3 buckets accessible as file systems](https://aws.amazon.com/blogs/aws/launching-s3-files-making-s3-buckets-accessible-as-file-systems/). It is relevant to Atliera because it can make agentic/file-based tools and ML-style workloads operate directly over S3-resident data without a separate copy. It should be incorporated as an explicit deployment/validation candidate, not as a reason to leak mount paths into product contracts: Atliera artifact keys remain logical, runtime config chooses whether the durable adapter talks to S3 through object APIs or through an S3 Files mount, and validation must record which semantics are being tested. For an S3 Files-backed adapter, the validation report must document NFS close-to-open behavior, S3 synchronization windows, UID/GID/POSIX permission mapping through object metadata, encryption/IAM assumptions, and whether Atliera accepts file-operation behavior that differs from ordinary S3 `putObject`/`getObject` calls.

An S3-mounted filesystem can be operationally useful, but it must not be treated as ordinary POSIX storage unless the mount layer's rename, flush, listing, locking, and failure semantics are documented and accepted. If implemented, an S3-mount-backed adapter must state which guarantees come from S3 and which come from the mount layer.

## JobQueue contract

`JobQueue` coordinates background work through logical queues. The current in-memory implementation is deterministic test/dev behavior. It does not define production queue semantics.

`DatabaseJobQueue` is the first SDK-neutral database adapter boundary behind `JobQueue`. It accepts an injected database client and logical table identifier, then maps enqueue, lease, complete, and get operations to that client without importing DB SDKs, reading env, constructing clients, opening sockets, choosing tables/URLs/hosts/credentials, or wiring app/worker/deploy code. Its lease boundary is one atomic `leaseNextJob` client operation that must claim a queued row and return it as leased; visibility timeouts, retry scheduling, dead-letter behavior, migrations, indexing, max payload-size enforcement, and transaction/isolation choices remain explicit responsibilities of the injected client/runtime wiring. The adapter rejects non-strict JSON-value payloads before client access so enqueue serialization cannot silently drop or coerce payload fields. Backend failures and observability events must remain sanitized.

`defineJobQueuePreflightCheck` is the resource-preflight probe for an already-composed `JobQueue`. It performs a deterministic enqueue/dequeue/complete/read-back cycle through the injected queue and returns stable sanitized queue-backend outcomes. It must not choose a backend, construct a queue client, read env, open sockets, or wire worker polling; probe queue namespaces and backend cleanup/retention remain deployment-wiring responsibilities. Runtime/deploy wiring must use a dedicated run-scoped probe queue rather than a real work queue, because the generic `JobQueue` contract leases the next available job by queue name and does not support payload-filtered probe leasing.

### Delivery semantics

Durable JobQueue adapters should assume at-least-once delivery unless they explicitly document a different guarantee.

Required behavior:

- duplicate delivery is possible
- consumers must be idempotent
- queue implementations must support explicit completion or acknowledgement
- claimed jobs must become visible again, fail, or move to a dead-letter path if not completed within the adapter's visibility/lease rules
- enqueue should be idempotent only when the producer supplies an idempotency key or equivalent dedupe identifier

Exactly-once delivery is not a baseline Atliera contract.

### Ordering semantics

No global FIFO guarantee exists by default.

Implementations may provide stronger ordering, such as FIFO queues or single-producer ordering, but product logic must not depend on ordering unless:

- the runtime config selects an adapter with that documented guarantee
- tests cover the ordering-dependent behavior
- the worker contract states the tradeoff explicitly

### Payload and metadata

Adapters must document:

- max message size
- serialization format
- required job ID/idempotency metadata
- lease or visibility timeout behavior
- retry count or attempt metadata
- dead-letter policy

Large payloads should be stored as artifacts and referenced by logical artifact keys rather than embedded directly in queue messages.

### Failure modes

Expected queue failures include:

- enqueue rejected because payload is too large
- duplicate idempotency key conflict or dedupe hit
- lease timeout
- completion of an unknown or already-completed job
- dependency timeout/unavailable
- throttling or rate limiting
- permission denied

Adapters must expose these as diagnosable failures rather than silent drops.

## GraphStore contract

`GraphStore` is the durable evidence graph boundary. Current in-memory and local-file behavior is useful for deterministic tests and local fixtures, but production graph storage requires explicit durability, consistency, and concurrency semantics.

### Versioned interface seam

`VersionedGraphStore` is the first graph-store contract seam for database-backed persistence. It does not choose a database or deployment topology. It defines the product-facing behavior future durable adapters must preserve:

- graph IDs are logical slash-delimited identifiers, not URLs, DB paths, bucket paths, hostnames, or infrastructure addresses
- `load(graphId)` returns the current bundle plus a revision token, or the interface not-found shape
- `commit(graphId, bundle, { expectedRevision })` validates the graph bundle before committing
- `expectedRevision: null` means create-only and must conflict if the graph already exists
- a non-null `expectedRevision` must match the currently stored revision or the commit fails with a conflict
- successful commits return the new revision and must be read-your-writes visible through the same store
- returned bundles must not let callers mutate stored state through object references

The current `InMemoryVersionedGraphStore` is test/dev behavior only. It demonstrates the optimistic-concurrency contract without reading env, constructing clients, importing DB/storage SDKs, opening sockets, or picking a production database. A future durable adapter may use a database row version, transaction ID, etag, or equivalent token as long as stale writers cannot silently overwrite newer graph state.

`DatabaseVersionedGraphStore` is the first SDK-neutral database adapter boundary behind `VersionedGraphStore`. It accepts an injected database client and logical table identifier, then maps create-only commits to conditional inserts and expected-revision commits to conditional updates. The adapter must not read env, import a DB SDK, construct clients, choose URLs/hosts/credentials, or wire launch/deploy code. Its atomic commit boundary is one whole serialized `GraphBundle` row per conditional client operation: an insert for an existing graph returns the current revision, and an update whose expected revision no longer matches returns the current revision or not-found shape instead of overwriting. Backend failures and observability events must remain sanitized.

### Atomicity

A graph commit must be atomic at the chosen commit boundary. The adapter must document that boundary.

Examples of acceptable commit boundaries:

- a whole `GraphBundle` replaces the prior bundle atomically
- a transaction writes a set of graph records atomically
- an append-only event transaction commits one graph mutation atomically

Partial graph commits must not be reported as successful.

### Consistency

Baseline expectation:

- reads through the same GraphStore process should observe that process's prior successful writes
- writes through the primary durable store should be strongly consistent at the commit boundary
- cross-process, read-replica, cache, or eventually consistent behavior must be documented by the adapter

Product logic must not assume read-replica freshness unless the adapter contract says it is guaranteed.

### Concurrency

Durable GraphStore implementations should support optimistic concurrency or an equivalent conflict-detection mechanism.

A writer should be able to say which version, revision, or etag it expects. If the stored graph changed before commit, the write should fail with a conflict rather than silently overwrite another writer's update.

If a future implementation intentionally uses last-write-wins, that must be documented as a product-level tradeoff and reviewed before production use.

### Migrations and schema versions

Graph schema migrations are human-reviewed deployment operations, not automatic background magic.

Adapters must document:

- supported graph schema versions
- migration ordering requirements
- rollback limitations
- backup expectations before destructive migrations

Migration scripts should be idempotent only when intentionally designed that way. The contract must not assume arbitrary migrations can safely be retried.

### Failure modes

Expected graph failures include:

- schema validation failure
- version conflict
- transaction conflict/deadlock
- dependency timeout/unavailable
- permission denied
- migration/version mismatch
- serialization failure
- payload too large

Adapters must surface these failures clearly and preserve enough context for operators to diagnose without leaking sensitive graph payloads.

## ModelProvider validation boundary

The detailed `ModelProvider` contract now exists before any provider SDK import, API key read, or live model call. Provider selection is a configuration choice, not an architectural commitment. Atliera's preferred product posture is provider-neutral: direct provider integrations and multi-provider gateways such as OpenRouter must both satisfy the same `ModelProvider` boundary instead of shaping product logic around one vendor. OpenRouter may be used as an SDK-neutral abstraction layer for early validation and later model comparison, but it is not itself a product lock-in; direct provider integrations remain possible when cost, latency, customer policy, compliance, or reliability justify them.

The contract carries forward Atliera/account-research lessons around:

- budget precheck before every call
- retry only after rechecking budget
- cost reporting and cumulative spend tracking
- rate-limit handling
- circuit breaker state
- refusal and credential handling
- adversarial response validation
- deterministic fake provider only in non-production-like environments

`validateModelProviderCompatibility({ provider, request, ... })` is the SDK-neutral validation harness for the first real provider run. It accepts an already-composed `ModelProvider`, explicit activation context, explicit credential status, and caller-owned run/corpus references; it must not construct provider clients, import SDKs, read env, perform secret lookup, estimate cost itself, retry prompts, or persist ledger rows. It refuses before the provider call when activation or credential gates fail, performs one injected provider call when gates pass, validates envelope-level shape/identity/usage/cost accounting, and returns sanitized evidence plus a `ModelCostLedgerEntry` for succeeded, failed, or refused outcomes. Deeper graph evidence correctness remains a graph-validator/quality-gate responsibility after output materialization.

Provider-specific adapters remain separate implementation/deployment work. Real-provider validation must supply a tiny approved corpus, low spend cap, credential lookup, artifact persistence, and cleanup policy through launch/lab wiring rather than through this harness.

## Contract versioning and evolution

The contracts in this document are v1, the initial durable adapter contract version declared on 2026-05-23. Future versions may add or change contract requirements, but contract changes must be reviewed with the same discipline as initial contract creation.

Additive changes are acceptable within v1 when they do not break existing compliant implementations. Examples include:

- new optional interface methods
- new optional fields in adapter operations or reports
- new observability signal types with documented defaults
- clarifying language for existing requirements
- additional examples that do not change required behavior

Breaking changes require a new contract version. Examples include:

- removing methods or fields
- changing the semantic meaning of existing methods
- tightening requirements on existing implementations
- changing failure-mode contracts
- making previously optional behavior mandatory

When breaking changes are needed:

1. Create a new versioned contract document or clearly versioned section, such as `durable-adapter-contracts-v2.md`.
2. Announce a deprecation period with an explicit timeline.
3. Document existing v1-compliant implementations and assess their migration impact.
4. Publish migration guidance before v1 deprecation begins.
5. Keep v1 compliance expectations available for at least one major Atliera release after deprecation is announced.

Implementations declaring v1 compliance must continue to satisfy the v1 contract until they explicitly migrate to a newer contract version. Contract revisions must not silently redefine what an existing adapter compliance claim means.

## Compliance checklist for future durable adapters

A durable adapter PR should answer all of these before merge:

- Which interface contract does it implement?
- Which backend does it use, and which config keys select it?
- Which durability guarantee does it provide?
- Which ordering guarantee does it not provide?
- What are the idempotency rules?
- What are the consistency/read-after-write rules?
- What are the max payload/message/artifact sizes?
- What retry, timeout, throttling, and not-found behavior does it expose?
- How does it avoid leaking deployment paths, URLs, or credentials into product logic?
- What structured log events and metrics does it emit?
- How are correlation IDs propagated?
- What tests prove contract compliance and representative failure behavior?
- What is explicitly still unsupported?

## Current follow-up sequence

After the first SDK-neutral S3-compatible `ArtifactStore` boundary, injected artifact-store resource probe, `VersionedGraphStore` seam, injected graph-store resource probe, and SDK-neutral database-backed graph-store adapter boundary:

1. Keep app/server/worker wiring separate from adapter implementation PRs.
2. Add a concrete database client binding only in explicit deployment/runtime wiring, after choosing the runtime database and migration approach.
3. Add job-queue durable implementation only after graph persistence is far enough to support the core evidence/workshop path.
4. Add real provider SDK work only after explicit provider activation, budget, credential, and adversarial-response contracts remain satisfied.
