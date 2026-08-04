# Disposable SQLite subject-graph revision transaction

This PR adds a lab-only consumer boundary for an exact
`SubjectGraphRevisionIntent` and one disposable file-backed SQLite adapter. The
intent is a commit description, not write authority. Its canonical hashes are
unkeyed self-integrity identities; they do not establish authenticated origin,
human approval, ratification, or production authority.

The adapter is intentionally unreachable from product/runtime composition. It
is not exported by `src/index.ts`, imported by a CLI or runtime module, or wired
to a package script. Focused tests deep-import it directly. It does not replace
`VersionedGraphStore`, either existing versioned-store adapter, or the
historical Workshop JSONL writer.

The same deep-imported lab adapter exposes a read-only `readCurrent` restart
boundary. It takes the structured identity and exact lab permit, opens the
existing database read-only, and validates the current graph, success receipt,
and replay row as one linked read-back. This is the only state handoff intended
for the immediate Workshop proof; it does not re-submit an intent or admit a
write.

## Lab admission and validation

Every consume call requires the exact fixture/test-only permit. The permit is
effect admission only for disposable isolated SQLite; it explicitly says that
authenticated human approval, ratification, production authority, real-account
effects, providers, network, MCP, deployment, and M5a/M5b flows are not allowed.
It is not approval or ratification.

Before opening or creating a database, the adapter:

- snapshots the permit and intent through the strict own-data JSON boundary;
- requires an absolute direct-child database path under a canonical,
  caller-declared isolated directory beneath the canonical OS temporary root;
- rejects non-temporary paths, `:memory:`, symlink database files, and unsafe
  existing files;
- checks exact intent/review kind, version, fields, closed non-authorizing
  markers, canonical SHA-256 spellings, and representable revision tokens;
- recomputes the canonical intent core and review-handoff digests;
- requires the exact repository-owned candidate quality-gate policy identity;
- hydrates and revalidates the proposed candidate, recomputes its digest, and
  binds its team/account subject to the four-column graph identity;
- cross-matches identity, predecessor, snapshot, transition, quality-gate, and
  replay references between the intent and review handoff; and
- measures the actual UTF-8 bytes of canonical snapshot and prospective receipt
  JSON, including JSON escaping overhead.

This boundary consumes the commit description itself; it does not receive or
rehydrate the original proposal envelope, transition, or application options.
Their unkeyed digest fields therefore remain audit identities, not proof of
source or transformation custody. A later composition that needs that stronger
claim must supply and rehydrate those exact artifacts rather than infer it from
this receipt.

The snapshot JSON ceiling is 256 KiB and the receipt JSON ceiling is 16 KiB.
SQLite `CHECK(length(CAST(value AS BLOB)))` constraints enforce the same encoded
byte limits as defense in depth. Existing strict-JSON limits remain unchanged.

## Atomic state and commit truth

SQLite uses BINARY text equality across the composite
`team_id/account_id/subject_id/purpose` primary key; identity is never delimiter
concatenation or a hash. Foreign keys are enabled, extension loading is
disabled, tables are `STRICT`, WAL is enabled, and lock waiting is bounded.

`BEGIN IMMEDIATE` protects one atomic unit that compares both current revision
and canonical snapshot digest, writes the exact canonical successor snapshot,
consumes the replay key bound to the intent digest, and writes an immutable
success receipt/audit row. `COMMIT` returning successfully is the effect point:
graph, replay, and success audit commit together or not at all. SQLite supplies
`operational_committed_at` inside the transaction as canonical whole-second
UTC. That value is operational metadata only, not evidence that the earlier
`reviewed_at` was trusted.

An exact retry finds the durable replay binding and returns the original
persisted success receipt without applying again. A replay key bound to another
intent is refused without a graph write. If `COMMIT` throws before its outcome
is acknowledged, recovery uses a separate read-only connection so it cannot
mistake the writer connection's uncommitted rows for durable state. A successful
commit followed by verification failure remains explicitly committed-aware.

The result union keeps these cases separate:

- `committed`: a new commit, directly acknowledged or recovered from durable
  replay and receipt state;
- `already_committed`: no new application and the original persisted receipt;
- `conflicted`: deterministic revision/snapshot CAS conflict; its receipt is
  returned but not persisted;
- `refused`: deterministic malformed-input, path/permit, storage, or replay
  collision refusal; its receipt is returned but not persisted;
- `dependency_failed`: no transaction began or rollback is proven complete;
- `committed_readback_failed`: commit is known successful but verification did
  not complete, with a recovery identity; and
- `indeterminate`: the commit outcome could not be established after an
  independent recovery probe.

Read-back separately returns `found`, `not_found`, a pre-open `refused`, or a
sanitized `dependency_failed`. `found` includes the owned, frozen current
candidate and the exact success receipt that installed it. Persisted replay
identity columns are cross-checked against both the receipt and graph identity;
corrupt links fail closed rather than becoming Workshop state.

Errors and results omit database paths, SQL text, payload text, and underlying
or injected error messages. Refusal/conflict receipts are deterministic but are
not falsely described as durable audit. Crashes before the transaction boundary
do not produce a durable refusal audit.

## Deliberate limitations

- Only disposable SQLite files inside isolated OS temporary directories are
  supported. There is no production or real-account backend.
- Node 22's built-in `node:sqlite` API is experimental. It is pinned-toolchain
  lab technology, not a production-backend selection.
- Revision CAS and monotonicity protect ordinary writes in this database only.
  They do not protect against database restore, file replacement, privileged
  operators, external rollback, or infrastructure compromise.
- Pre-open path checks are a lab containment measure, not a hardened defense
  against a privileged actor racing filesystem replacement.
- No repair or override authority exists.
- No provider, MCP, network acquisition, deployment, production, real-account,
  Workshop presentation, synthetic Workshop, M5a, or M5b flow is present.
