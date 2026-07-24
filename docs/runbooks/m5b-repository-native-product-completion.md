# M5b Repository-Native Product Completion

Status: implementation prepared for independent review; no real source execution, human ratification, durable real graph write, provider call, acquisition, deployment, or GO is authorized by this document.

- current_effective_authorization: none
- real_source_reads: 0
- real_graph_durable_writes: 0
- provider_calls: 0
- acquisitions: 0
- deployments: 0

## Product boundary

The active M5b path is repository-native:

```text
explicit source input
  -> exact source validation
  -> sanitized source pack
  -> Graph candidate and review packet
  -> pre-ratification Workshop page
  -> external human ratification
  -> one local versioned graph write and read-back
  -> final Workshop page rendered from durable state
```

The host-local v2-r3 archive is frozen unqualified provenance only. Host forensic qualification is closed. Archive qualification, control-plane recovery, V4 reconciliation, global worktree investigation, evidence packaging, and a v2-r4 candidate are outside this product path. The quarantined shared control plane is nonblocking and is never consulted.

## Commands

`prepare` has no defaults. Every location and identity is explicit:

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

The only alternate source kind is `committed-synthetic-fixture`; it exists for committed tests and carries the existing fixture trust label. `exact-production-custody` additionally must pass the existing M5b exact production-custody admission contract. The command never acquires a source.

A successful prepare atomically publishes a new directory containing:

- `source-pack.json`
- `candidate.json`
- `review-packet.json`
- `workshop-pre-ratification.html`
- `prepare-result.json`

`prepare-result.json` binds the exact source size/hash, source pack, candidate, review packet, owner authorization, commit, tree, output identities, and zero-effect accounting.

`apply` also has no defaults:

```sh
npm run m5b:apply -- \
  --prepared <prepared-output-directory> \
  --ratification <external-human-ratification.json> \
  --graph-store <explicit-local-graph-store-root> \
  --output <new-apply-output-directory>
```

Apply requires lexically disjoint prepared, ratification, graph-store, and output locations. It rereads and rehashes all prepared artifacts, validates the source pack/candidate/review packet, validates the ratification artifact and every binding, commits one `rev_1` graph through `VersionedGraphStore`, reads the graph back, compares its canonical hash, and renders `workshop-final.html` from the read-back bundle. A graph-scoped create-only first revision and exact graph ID make replay fail closed without a second write. There are zero retries.

## External human-ratification artifact

The artifact is external typed data, not something either command can create or infer. It must contain exactly:

- kind `m5b-repository-native-human-ratification`, schema version `1`;
- prepare-result, source, source-pack, candidate, and review-packet hashes/sizes;
- the same owner-authorization ID and exact execution commit/tree;
- ratifier ID and canonical UTC ratification time;
- an explicit retention disposition;
- one ordered accept/reject decision and sanitized reason code for every review-packet proposal; accepted and rejected decisions are preserved as `AuditEvent` records;
- `currentEffectiveAuthorization: one-shot-local-durable-graph-write`;
- exactly one authorized durable local write, zero retries, and explicit false values for provider, acquisition, network, and deployment authority;
- `ratificationArtifactSha256`, computed over the canonical content without that hash field using `verifyM5bRepositoryNativeRatificationArtifactHash`.

A content hash detects drift; it is not a signature and does not prove who made the human decision.

## Future owner decisions still required

No decision below exists yet.

1. **Real prepare/source-read decision.** Supply and authorize one explicit source path, exact source kind, SHA-256, byte size, new prepared-output path, owner-authorization ID, and exact independently reviewed execution commit/tree. The decision must authorize exactly one prepare source read and no acquisition, network, provider/model, deployment, graph write, retry, or control-plane use.
2. **Human ratification and apply decision.** After reviewing the exact prepared Workshop page, candidate, and review packet, an identified human must supply the fully bound artifact above, including every proposal disposition and retention disposition. A separate owner execution decision must name that artifact by exact SHA-256, the prepared directory, explicit local graph-store root, new apply-output directory, and the same commit/tree; it may authorize exactly one local durable graph write/read-back/render and zero retries.

Creating the first decision does not imply the second. Preparing artifacts does not ratify them. Human ratification does not authorize acquisition, providers, deployment, AWS, or any further graph write.

## Security tradeoff

The former host executor bound boot identity, inode ownership, worktree registries, archive seals, and a host replay root. Those properties protected a particular host execution package but are not portable product requirements. The curated M3 executor is likewise bound to its own proposal artifacts and JSONL snapshot contract; this path reuses its accept/reject semantics, `source_document_only` trust treatment, rejection preservation, and `AuditEvent` records without pretending M5b inputs are M3 curated proposals.

The repository-native equivalent instead binds explicit source bytes, owner authorization, exact Git commit/tree declarations, prepared artifact hashes, external human decisions, and one local versioned graph ID. The `local-product` runtime mode permits only the already-guarded local versioned-store write path; it does not activate providers and is deliberately absent from default safe modes.

Two limits remain explicit:

- The command content-binds caller-supplied commit/tree values but does not host-attest the running checkout. The future owner must independently verify the checkout commit/tree before authorizing execution.
- The local JSON graph store uses a graph-scoped single-attempt lock and atomic file replacement, not a distributed transaction or multi-host lock.

These are reviewable product-level boundaries rather than host-forensic claims.

## Committed proof

`tests/workshop/m5b-repository-native.test.ts` uses only committed synthetic fixtures to prove:

- exact source admission and prepared artifact production;
- candidate/review and human-ratification binding;
- one durable local write plus read-back;
- final Workshop rendering from durable state;
- source, prepared-artifact, and ratification tamper refusal;
- replay refusal at revision `rev_1`;
- zero acquisition, network, provider, deployment, and retry effects.

Use existing repository CI only:

```sh
npm ci
npm run ci
```
