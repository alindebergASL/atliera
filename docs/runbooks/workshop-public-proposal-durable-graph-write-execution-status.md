# Workshop Public Proposal Durable Graph-Write Execution Status

Status: active

This runbook records the durable-write executor, the second half of M3 step 3a per the operator directive of 2026-06-12 (sharpening 2026-06-14). The executor consumes a freshly-built operator arming, the contract it descends from, the materialization input fixture for the ratified candidate's record bodies, the dbRootDir of the local-durable-db root, and a per-call `now`. It produces a discriminated outcome that is exactly one of `refused`, `idempotent_no_op`, or `completed`.

**This is the slice where `graph_ingestion_performed` and `durable_writes_performed` first flip from false to true in the project's history.** Everything before this defined what would be written; this is what writes it. The graph of record stops being empty here.

Doctrine alignment (ADR 0003) — the mediation gate level is a property of an effect that occurred:

- A `completed` outcome stamps `mediation_gate_level: "L0"` on the outcome AND on the persisted graph_snapshots row. That is the L0 effect.
- An `idempotent_no_op` outcome carries `l0_effect_observed_on_this_call: false`. The L0 effect was the prior write; this no-op references that row's id and written_at, but does not re-claim L0 on this call.
- A `refused` outcome carries no `mediation_gate_level` field at all and `l0_effect_observed: false`. A refused write is not an L0 effect; nothing happened.

Single-transaction-or-noop semantics: before its current-state read and idempotency checks, the executor canonicalizes and inspects the local DB root, rejecting symlinked table paths, then attempts the same one-shot external lock used by the M5a writer and local DB overwrite-restore. It re-inspects while holding the lock. Filesystem aliases to one physical DB therefore resolve to one sentinel and one canonical I/O path. A busy lock reports `lock_busy`; other pre-transaction lock failures report `lock_unavailable` or `durable_db_unreachable`, never a mid-write abort. It holds that shared lock through temp-file creation and atomic rename, then releases best-effort without retry. Any failure during the build/validate/write path leaves the original file unchanged and removes the prepared temp file best-effort; cleanup failure after a completed rename does not reclassify the commit.

Operator-identity discipline: a single attributable ratifier id is recorded on the bundle's AuditEvent (`actor_type: "user"`, `actor_id` = arming.operator_identity). No roles, no sessions, no permissions are modeled. That scope is M6.

Artifacts:

- Source arming status: `docs/runbooks/workshop-public-proposal-durable-graph-write-operator-arming-status.md`
- Source contract status: `docs/runbooks/workshop-public-proposal-durable-graph-write-contract-status.md`
- Source approval packet fixture: `fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json`
- Source materialization input: `fixtures/validation/proposal-materialization-public-curated-20260611a-input.json`
- Implementation: `src/workshop/proposal-durable-graph-write-execution.ts`
- Shared writer lock: `src/db/graph-snapshot-write-lock.ts`
- Contract tests: `tests/workshop/proposal-durable-graph-write-execution.test.ts`
- Safety tests: `tests/safety/proposal-durable-graph-write-execution-contract.test.ts`

Boundary markers (the executor's behavioral contract; what an outcome may carry depends on which kind it is):

- a `refused` outcome carries: outcome: refused; refusal_code (one of an enumerated set); l0_effect_observed: false; durable_write_performed: false; graph_ingestion_performed: false; and no mediation_gate_level field
- an `idempotent_no_op` outcome carries: outcome: idempotent_no_op; idempotency_key; idempotent_referenced_row_id; idempotent_referenced_row_written_at; l0_effect_observed_on_this_call: false; durable_write_performed_on_this_call: false; graph_ingestion_performed_on_this_call: false
- a `completed` outcome carries: outcome: completed; durable_record_id; idempotency_key; written_at; approval_id; contract_artifact_id; account_id; candidate_item_id; operator_identity; mediation_gate_level: L0; l0_effect_observed: true; durable_write_performed: true; graph_ingestion_performed: true; target_store: local-durable-db; bundle_record_counts

What exists:

- `executeWorkshopPublicProposalDurableGraphWrite` validates the arming against the approval packet and contract, the contract against its closed boundaries, the materialization input against the candidate, and the derived GraphBundle against the Atliera graph validator before any disk write. Arming/contract/approval-packet artifacts are own-data-snapshotted and Proxy-refused before field reads.
- Idempotency is keyed by the contract's canonical `accountId:candidateItemId:ratified-durable-write-v1` shape. The executor refuses suffix drift before touching the durable row path, then reads existing graph_snapshots rows and either: returns `idempotent_no_op` if a row with the same key exists; refuses `arming_already_consumed_against_durable_state` if a different row with the same `approval_id` exists; or appends a new row.
- M3, M5a, and local DB overwrite-restore serialize graph-snapshot read/check/replace sections through the shared exclusive-create lock beside the DB root. Lock acquisition is attempted once with no waiting or retry; M3 writes then go through temp-file + atomic rename and clean stale prepared temp state best-effort on failure. A pre-rename failure leaves the original graph file unchanged.
- The persisted graph_snapshots row carries `kind: "atliera-graph-snapshot-row"`, `schema_version: 1`, durable_record_id, idempotency_key, approval_id, contract_artifact_id, account_id, candidate_item_id, operator_identity, mediation_gate_level: L0, trust_label, written_at, and the full GraphBundle.
- Ratified graph records are not marked `verified`; durable claims and account objects remain `source_document_only` while the row-level trust label records `model-proposed-human-ratified-evidence-pending` until M4 / M5b evidence re-verification.
- The bundle inside the row contains the Workshop Graph primitives (sources, excerpts, claims, claim_evidence, account_objects, account_object_claims, research_runs, run_artifacts, audit_events) derived from the materialization input. The AuditEvent attributes the ratification to the single operator identity (actor_type: "user", actor_id: arming.operator_identity, event_type: "claim.ratified").

Refusal codes (the executor's enumerated reject-paths):

- arming_kind_invalid
- arming_lifecycle_not_armed
- arming_authorization_marker_missing
- arming_approval_id_mismatch_against_packet
- arming_contract_artifact_id_mismatch_against_contract
- arming_expired_at_call_time
- arming_authorizes_wrong_candidate
- arming_already_consumed_against_durable_state
- contract_kind_invalid
- contract_boundary_broadened
- materialization_input_missing_record
- graph_bundle_validation_failed
- durable_db_unreachable
- transaction_aborted_mid_write

Non-goals:

- No provider/model call, model comparison, web search, tool use, or spend.
- No private evidence read. The materialization input fixture is a committed public-curated artifact.
- No production write or production deployment.
- No readiness claim. The trust label stamped on the durable row is `model-proposed-human-ratified-evidence-pending` — not Verified. Evidence re-verification against fetched sources remains M4 / M5b.
- No automatic retry. The arming is one-shot; a second consumption requires a new approval packet + new arming.
- No role/session/permission modeling. M6 work.

Verification coverage:

`tests/workshop/proposal-durable-graph-write-execution.test.ts` proves:

- the happy path: a valid arming + valid contract + valid materialization input produces a completed outcome, exactly one row in graph_snapshots.jsonl, with `mediation_gate_level: "L0"` stamped on BOTH the outcome and the persisted row, and the bundle's AuditEvent attributes to the single operator identity
- direct-against-DB idempotency: calling the executor twice with the same arming, contract, and inputs yields one completed + one idempotent_no_op; the DB still contains exactly one row; the no-op outcome carries `l0_effect_observed_on_this_call: false`
- a busy shared M3/M5a writer lock refuses without changing graph_snapshots.jsonl
- accessor-backed and Proxy-backed hostile arming/contract artifacts are refused before marker flip; Proxy traps are not invoked
- malformed arming expiry and forged idempotency-key suffixes are refused with no row written
- arming kind invalid → refused, no row written, no L0 stamp
- arming whose approval_id does not match the packet → refused, markers stay false, no row written
- arming presented after expires_at → refused
- arming for contract artifact A used to authorize a write against a different contract → refused
- arming whose authorized candidate is not in the contract's write_operations → refused
- a second write attempt against an already-consumed arming → refused (arming is one-shot), DB still has one row
- mid-write transaction failure (unreachable DB) → no row written, durable_writes_performed false, sanitized refusal emitted
- refusals do NOT stamp a `mediation_gate_level` field — refused outcomes never claim an L0 event

`tests/safety/proposal-durable-graph-write-execution-contract.test.ts` proves:

- this status runbook records the executor boundaries in greppable form
- the runbook index lists this runbook exactly once and classifies it as `active`
- the implementation module imports only the durable-db / graph validator / arming-and-contract types it requires (no provider SDK, no process.env, no fetch)
- the runbook's refusal-code list matches the source module's enumeration
