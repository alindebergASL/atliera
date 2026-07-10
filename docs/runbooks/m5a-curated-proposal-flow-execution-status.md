# M5a Curated Proposal Flow Execution Status

Status: active

This runbook records the implemented, tightly bounded M5a Step 4 curated-flow capstone. It is an implementation record for one committed proposal input, not standing execution authority and not a generic M5a approval framework. It authorizes no repeat or successor slice and makes no production, deployment, launch, shipping, or readiness claim.

The executor consumes one valid Step-3 arming over its matching Step-2 packet and Step-1 contract. Steps 1–3 bind structural identity, counts, and chronology; their current canonical IDs do **not** contain a proposal-content digest, and Step 4 does not pretend otherwise. Step 4 independently binds this capstone to the exact committed input with the exported SHA-256 pin `M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256`, calculated over deterministic key-sorted canonical JSON of the already own-data-snapshotted materialization input. Any different digest refuses before preflight, lock acquisition, or durable effects.

## Implemented path

The stage order is exactly `materialize` → `validate` → `ratify` → `durable_write` → `render`.

Executor entry recursively snapshots the contract, packet, arming, materialization input, and execution options with the shipped M5a own-data helpers. It independently runs the shipped Step-1, Step-2, and Step-3 verifiers and uses snapshot-backed locals afterward. Proxy, accessor, symbol, unsafe-key, custom-prototype, over-bounds, and unknown-key counterfeits fail closed. Before canonical JSON construction or hashing, every primitive string value and every object key is measured without constructing a proportional encoded copy: `Buffer.byteLength` checks raw UTF-8, and a direct code-unit scan measures the exact JSON-escaped UTF-8 contribution including surrounding quotes. One string may contribute at most 64 KiB and all strings in the complete snapshot may contribute at most 1 MiB. Either breach returns a deterministic pre-effect refusal before preflight, local-DB inspection, lock acquisition, L0, or any durable effect.

The pinned input is materialized through `materializeProposalForValidation`. Step 4 refuses materialization rejection, invalid graph validation, identity/count/origin mismatch, or trust-boundary broadening. Ratification changes proposed excerpts to `accepted` and proposal-derived claims/account objects to `source_document_only` under `model-proposed-human-ratified-evidence-pending`; it never marks a record `verified`. The full fixture digest is recorded in the ratification run-artifact payload and in every committed Step-4 outcome.

Before acquiring any writer lock, a pure evaluation helper builds the Workshop view model and durable-curated HTML. Success uses typed lens/card/trust state plus exact renderer-owned markup:

- `<span class="curated-pill">Curated public source</span>`
- `data-curated-provenance="hand-curated-public"`

It does not use arbitrary `Verified` or label substrings, so those words in valid titles, summaries, claims, or source text neither fail nor spoof coverage. The same helper is run after commit against the bundle returned by `readWorkshopPublicProposalDurableGraphSnapshots`; preflight HTML is never reused as read-back evidence.

## Local DB and shared transaction boundary

Before opening the graph transaction, Step 4 calls `inspectLocalDurableDb` and requires `ok: true`, `databaseStatus: initialized`, and `productionWrites: false`. This is narrowly an inspection of the Atliera local durable DB manifest/table contract. A merely compatible JSONL directory without that manifest refuses.

M3, M5a, and local durable DB overwrite-restore now use the same small graph-snapshot writer-lock helper and the same sentinel beside the DB root. The helper realpath-canonicalizes an existing root (or the existing parent plus an absent restore leaf), and each operation uses that canonical root for both locking and I/O, so filesystem aliases cannot create distinct sentinels for one physical DB. Local DB inspection rejects a symlinked `tables` directory or table file. Keeping the sentinel outside the replaceable root prevents restore from deleting its own lock. Each writer attempts atomic exclusive creation exactly once, never waits or retries, and holds the lock across current-state read/check and replacement. A lock-handle close failure releases best-effort and fails closed before transaction entry. Lock cleanup after the transaction is best-effort; cleanup failure cannot reclassify a completed commit. M5a re-inspects the local DB while holding this lock before reading or writing rows.

While holding the shared lock, Step 4 validates every current JSONL row through the shipped durable reader, refuses malformed state, refuses duplicate existing `durable_record_id` values, refuses a consumed one-shot key, and refuses collision with its derived record ID. The canonical record ID is `m5a-flow:<40 lowercase SHA-256 hex>`, derived from the verified stable one-shot key and fixture digest, so it is stable across execution timestamps and distinct across distinct packet authorization keys.

The one-shot key is written as the row `idempotency_key`; authorization consumption and the business effect therefore become visible in the same rename. Replay refuses rather than reporting idempotent success. Pre-rename failure leaves the original JSONL unchanged.

## Effect-aware outcomes

`refused` is strictly pre-effect: no `mediation_gate_level`, no durable write/read-back/render claim, zero provider/fresh/acquisition/private/retry/production counts, and readiness false.

`completed` means the row committed, the actual row read back uniquely and matched the full canonical committed row (including authorization, attribution, trust, timestamp, and bundle), and read-back view/render criteria passed. It carries the canonical durable record ID, stable one-shot key, fixture digest, authorization/operator attribution, `mediation_gate_level: L0`, and truthful write/read/render markers.

`committed_unrendered` means rename already committed but a later read-back, unique-row, view-model, render, or success-criterion step failed. It is never represented as a no-effect refusal. It carries the durable record ID, one-shot key, fixture digest, operator plus contract/packet/arming attribution, `mediation_gate_level: L0`, `l0_effect_observed: true`, `durable_write_performed: true`, explicit read-back/render attempted/succeeded flags, and a sanitized enumerated failure code. Its provider/fresh/acquisition/private/retry/production counts remain zero and readiness remains false.

## Product artifact and regressions

`scripts/generate-m5a-curated-proposal-flow-capstone.mts` initializes a disposable local DB, builds the real Steps 1–3 artifacts, executes Step 4, and regenerates `fixtures/workshop/m5a-curated-proposal-flow-capstone.html`. Existing renderer calls without durable-curated mode remain byte-identical to explicit fake mode.

Focused coverage includes exact-content digest drift with unchanged IDs/counts/timestamps; source/claim/object text containing trust/curated-label words; Step-1/2/3 verification; replay and expiry; local-DB manifest refusal; malformed and duplicate durable state; canonical/authorization-distinct record identity; shared M3/M5a lock contention; exclusive-temp failure; durable reader/render behavior; and default renderer byte compatibility.

## Preserved boundaries

- provider/model calls and fresh calls: 0
- system-side acquisition: 0
- private evidence reads: 0
- retries: 0
- production writes or deployment: 0
- HTTP/provider wiring: none
- readiness claim: false
- generic M5a approval framework: not introduced
- roles, sessions, permissions, H3 implementation, and M4 work: not introduced

Artifacts:

- `src/workshop/m5a-curated-proposal-flow-execution.ts`
- `src/db/graph-snapshot-write-lock.ts`
- `src/workshop/proposal-durable-graph-write-execution.ts`
- `src/workshop/render-html.ts`
- `tests/workshop/m5a-curated-proposal-flow-execution.test.ts`
- `tests/safety/m5a-curated-proposal-flow-execution.test.ts`
- `tests/workshop/proposal-durable-graph-write-execution.test.ts`
- `fixtures/validation/m5a-curated-proposal-flow-capstone-20260710a-input.json`
- `fixtures/workshop/m5a-curated-proposal-flow-capstone.html`
- `scripts/generate-m5a-curated-proposal-flow-capstone.mts`
