# M5b Repository-Native Product Completion

Status: implementation prepared for independent review. This document authorizes no real source execution, human ratification, durable real graph write, provider/model call, acquisition, deployment, or customer-readiness claim.

- M5B_STATUS=IN_PROGRESS
- CURRENT_EFFECTIVE_AUTHORIZATION=NONE
- REAL_SOURCE_READS=0
- REAL_GRAPH_WRITES=0
- REAL_RATIFICATIONS=0
- provider_calls: 0
- acquisitions: 0
- deployments: 0

## Milestone acceptance remains customer-facing

M5b is still the does-its-job-once customer outcome:

```text
one real account
  -> the system fetches public sources through M4
  -> validation and human ratification
  -> durable graph state
  -> a shareable Workshop account page
  -> every claim traceable to a stored source
  -> every unverified item visibly labeled
```

Repository-native prepare/apply is the current implementation mechanism for the validation, ratification, durable-state, and rendering portion of that outcome. It is not a substitute milestone and does not retroactively turn a committed fixture into a real customer result. M5b remains in progress until the real shareable page exists and has been evaluated against the acceptance framing above.

The former host Gate B/v2-r3 material is frozen historical provenance only. Host forensic qualification is closed; no v2-r4 is authorized. Archive qualification, V4 reconciliation, host investigation, and the quarantined shared control plane are not acceptance dependencies and are nonblocking.

## Repository-native mechanism

```text
explicit already-available source input
  -> exact source validation
  -> sanitized source pack
  -> Graph candidate and review packet
  -> pre-ratification Workshop page
  -> external human ratification
  -> one local versioned graph commit/read-back, or exact rev_1 finalization
  -> final Workshop page
```

Neither command fetches a source, invokes a provider/model, deploys, uses AWS, consults host/control-plane state, or selects its own authority.

## Prepare command

`prepare` has no defaults:

```sh
npm run m5b:prepare -- \
  --source <explicit-source-file> \
  --output <new-prepared-output-directory> \
  --source-kind exact-production-custody \
  --expected-source-sha256 <64-lowercase-hex> \
  --expected-source-size <exact-byte-count> \
  --owner-authorization-id <external-owner-authorization-id> \
  --execution-commit <exact-40-hex-reviewed-commit> \
  --execution-tree <exact-40-hex-reviewed-tree>
```

The only alternate source kind is `committed-synthetic-fixture`, which exists for committed synthetic tests. `exact-production-custody` must additionally pass the existing exact production-custody admission contract. The command never acquires a source.

A successful invocation performs one source-content read during that invocation and atomically publishes:

- `source-pack.json`
- `candidate.json`
- `review-packet.json`
- `workshop-pre-ratification.html`
- `prepare-result.json`

The `explicitSourceReads: 1` counter proves the content-read count for one invocation. It does not prevent a later invocation from reading the same path again. Cross-invocation one-shot authority belongs to a separate owner execution decision; this implementation deliberately adds no host replay root, shared ledger, boot identity, or control-plane dependency.

## Apply command and externally pinned authority

`apply` also has no defaults:

```sh
npm run m5b:apply -- \
  --prepared <prepared-output-directory> \
  --ratification <external-human-ratification.json> \
  --graph-store <explicit-local-graph-store-root> \
  --output <new-apply-output-directory> \
  --expected-ratification-sha256 <sha256-of-exact-file-bytes> \
  --expected-owner-authorization-id <external-owner-authorization-id> \
  --expected-execution-commit <exact-40-hex-reviewed-commit> \
  --expected-execution-tree <exact-40-hex-reviewed-tree>
```

All four authority pins are required and enforced inside `applyM5bRepositoryNative`, not only by the CLI. Apply reads the ratification file bytes exactly once, verifies the SHA-256 of those exact bytes before JSON parsing, then verifies the canonical self-hash and every typed-data binding to the prepare result, source, source pack, candidate, review packet, owner authorization, commit, and tree.

`ratificationArtifactSha256` is an internal canonical content-integrity digest. It detects semantic drift after parsing, but it is not independent authority, a signature, PKI, DSSE, executable seal, GO artifact, or host/boot identity. The externally supplied raw-byte SHA-256 is the pin that names the reviewed ratification file.

The commit/tree fields are exact declared bindings, not host attestation of the running checkout. A future owner execution decision must independently verify the checkout commit/tree before authorizing either real command; this path does not add host forensics to make that decision.

Prepared directory, ratification file, graph-store root, source path, and output directory are checked using canonical existing paths or canonical nearest-existing parents. Symlinked roots/components are rejected. Apply locations must be mutually non-nested and non-aliasing.

## Commit, recovery, and output closure

Apply validates every input and fully stages `workshop-final.html` plus `apply-result.json` in the destination parent before the graph commit. A missing output parent therefore fails before any graph commit.

For a new graph, apply makes one create-only `rev_1` commit attempt with zero retries, loads it back, verifies the canonical durable bundle, independently re-renders from the read-back state, and publishes the already-staged output only after the render matches. There is no second graph write.

If `rev_1` already exists, apply permits read-only finalization only when the stored canonical bundle is exactly the same and its dedicated retention event binds the same raw-byte and canonical ratification digests. The result reports one of:

- `newly-created`; or
- `existing-exact-finalized-without-write`.

A different revision, bundle, decision, ratifier, or ratification binding refuses. This permits recovery after a post-commit output publication failure without writing `rev_2`.

## Human decisions and original-custody retention

Reject-all is valid. It produces a durable terminal graph with the stored source and decision audit trail, zero promoted account objects, and every rejection/reason code preserved. Mixed and all-accept outcomes use the same ordered decision contract.

`retentionDisposition` answers exactly the review packet’s existing retention draft: whether retention of the original custody artifact beyond `retentionDraft.deadline` is approved.

Every apply result preserves the disposition, retention-draft ID, deadline, outcome, `originalCustodyDeleted: false`, and whether external custody cleanup remains required. A dedicated `source.retention_decided` `AuditEvent` records:

- the ratifier;
- exact raw-byte and canonical ratification bindings;
- review-packet binding;
- retention-draft ID and deadline;
- accept/reject disposition and outcome;
- `original_custody_deleted: false`; and
- the external-cleanup requirement.

Apply has no original custody path and no deletion authority:

- accept means beyond-deadline retention is approved;
- reject means beyond-deadline retention is not authorized and external custody cleanup remains required;
- neither outcome claims that deletion occurred.

## Source provenance in the final page

Final rendering is selected from the prepare result’s bound source kind:

- `exact-production-custody` renders `System-acquired public source` and the durable system-acquired boundary;
- `committed-synthetic-fixture` renders `Durable synthetic fixture` and never renders `System-acquired public source`.

The source pack’s production-admission state must agree with that source kind.

## Local store truth and limits

`LocalFileVersionedGraphStore` is the only writer whose positive allowlist accepts `local-product`. That mode does not enable the database store, either in-memory graph store, the general graph-file writer, run-manifest writer, providers/models, or unknown runtime modes. Normal `model`-mode behavior on existing writer surfaces is unchanged.

Each stored local graph envelope includes a canonical SHA-256 integrity digest covering graph ID, revision, schema, and bundle. Every load verifies it, including when substituted content is otherwise schema-valid. The digest detects corruption or drift; it is not a signature and proves neither writer identity nor authority.

Replacement writes use a same-directory temp file, sync the temp file before rename, rename atomically under a graph-scoped single-attempt lock, and sync the containing directory after rename. Failed attempts clean temp files. Locks are never retried. Stale-lock recovery remains an operational limitation: this path does not perform boot/PID forensics and does not unsafely auto-remove an existing lock.

## Committed synthetic proof

The focused tests use only committed synthetic fixtures and temporary directories. They cover:

- prepare and apply CLI argument contracts, including missing/duplicate/unknown arguments and malformed sizes/hashes;
- all four external apply pins and raw-byte hash-before-parse behavior;
- all-accept, mixed, reject-all, retention-accept, and retention-reject outcomes;
- exact-revision recovery without a second graph write;
- output-parent preflight before commit;
- canonical path nesting and symlink-alias refusal;
- exact production versus synthetic rendering labels;
- positive per-writer `local-product` confinement;
- local-store locking, conflicts, malformed content, schema-valid digest mismatch, atomic failure cleanup, and read-back;
- zero acquisition, network, provider/model, deployment, AWS, and retry effects.

Use existing repository CI only. This document does not authorize running either product command against real inputs.
