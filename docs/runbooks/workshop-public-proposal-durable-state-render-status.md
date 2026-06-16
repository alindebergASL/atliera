# Workshop Public Proposal Durable State Render Status

Status: active

This runbook records the durable-state render slice — M3 step 3b per the operator GO of 2026-06-15. The slice closes M3 by rendering Workshop from the durable graph of record. It consumes the durable graph_snapshots.jsonl written by the 3a executor plus a human-review decision artifact, and produces a static HTML page whose markup is intentionally split into two visibly distinct sections: the durable graph records (read from the graph of record) and the review-decision rejections (recorded by the reviewer but NOT promoted into the graph).

This is the slice that makes the loop visible end-to-end. A real proposal, validated, ratified by one real operator identity, written once to the graph of record under the M3 admission tier (`model-proposed-human-ratified-evidence-pending`), is rendered back under the honest label — alongside the thing it rejected, framed clearly as not-in-graph.

Doctrine alignment (ADR 0003; M3 step 3a retro 2026-06-15):

- The reader is read-only. It performs no provider call, no graph-state mutation, no production write, and never decrements arming consumption counters. The 3b slice flips no markers; markers on the durable row were flipped by 3a, not by 3b.
- The reader treats every row at its trust boundary the same way the 3a executor treats arming artifacts: `util.types.isProxy` first, then own-data descriptor snapshot, then per-field validation. This is the second call site for the consolidated H3 primitive (frozen until the H-track unfreezes).
- Trust-tier discipline (retro §1): row-level `trust_label` records the admission path (`model-proposed-human-ratified-evidence-pending`); per-record `provenance_status` records the evidence backing (`source_document_only` for M3). They may disagree only conservatively. The reader refuses any row whose per-record provenance contradicts this by claiming `verified` — that flip is reserved for M4 / M5b.
- Static HTML only. HTTP wiring is deferred as an active decision, not a maybe-later: the slice's done-criterion is "Workshop renders from durable state," and a static HTML render meets it completely. Demo-convenience adjacency would expand a closing slice.
- The render shows the rejected decision alongside the ratified record because that proves the loop's discrimination, not just plumbing. A pipeline that only ever shows accepts cannot demonstrate that it refuses to promote.

Visible-distinction discipline (operator GO, 2026-06-15, Scope Guard A): the durable graph records and the review-decision rejections are rendered as two structurally different sections. They use different class names, different headers, different border treatments. The rejection cards never carry a `trust-pill` class, never carry a `durable-record-id` attribute, never use graph-record framing, and are explicitly labeled "Not in graph". A reader inspecting the rendered HTML can never conclude a rejection lives in the durable store.

Operator-identity discipline: the durable record cards attribute the ratification to the single operator identity recorded on the durable row (one string field). No roles, no sessions, no permissions. That scope remains M6.

Artifacts:

- Source durable-write executor status: `docs/runbooks/workshop-public-proposal-durable-graph-write-execution-status.md`
- Source M3 step 3a retro: `docs/reviews/m3-step-3a-retro.md`
- Source human-review decision artifact fixture: `fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json`
- Reader implementation: `src/workshop/durable-graph-snapshots-reader.ts`
- Render composition + HTML implementation: `src/workshop/durable-state-render.ts`
- Round-trip + visible-distinction tests: `tests/workshop/durable-state-render.test.ts`
- Safety contract tests (negative assertions): `tests/safety/proposal-durable-state-render-contract.test.ts`
- Demo render artifact (real 3a row + reject case): `fixtures/workshop/workshop-public-proposal-durable-state-render-demo.html`

Boundary markers:

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- authorizes_durable_write_execution: false
- durable_write_execution_performed: false
- durable_writes_performed: false
- production_writes: false
- readiness_claim: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes_by_this_slice: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- l0_effect_observed_by_this_slice: false

What exists:

- `readWorkshopPublicProposalDurableGraphSnapshots` reads `tables/graph_snapshots.jsonl` from a given local-durable-db rootDir and yields a frozen result carrying `rows: readonly DurableGraphSnapshotRow[]`, `refusals: readonly WorkshopProposalDurableSnapshotsReaderRefusal[]`, and the closed read-only doctrine markers (`provider_calls_made: 0`, `private_evidence_read: false`, `graph_ingestion_performed: false`, `durable_writes_performed: false`, `production_writes: false`, `readiness_claim: false`).
- Every row is descriptor-snapshotted with a `util.types.isProxy` guard fired BEFORE any descriptor reflection. The guard precedes reflection in source order; a regression test locks the ordering.
- The reader refuses any row whose `kind`, `schema_version`, attribution fields, `mediation_gate_level`, or `trust_label` does not match the M3 contract; whose bundle does not parse or validate; or — critically — whose `bundle.claims[].provenance_status` or `bundle.account_objects[].provenance_status` is `verified`. The trust-tier check fires before the full graph validator so the row-level invariant gets its own surfaced refusal code (`row_bundle_marks_record_verified`) in the audit trail.
- The reader DEEP-freezes the validated bundle before returning it. A top-level `Object.freeze` on the row is shallow and leaves the nested bundle, its arrays, and its records mutable — a caller could flip a per-record `provenance_status` to `verified` AFTER the read boundary validated it, defeating the trust-tier guarantee at exactly the point the render layer reads it. Deep-freezing seals the snapshot the reader vouched for so it is the snapshot the renderer sees.
- `composeDurableStateView` consumes the reader result + a `WorkshopProposalHumanReviewDecisionArtifact` (nullable) and produces a typed `DurableStateRenderView` with two top-level fields: `durable_graph_records` (one card per `bundle.account_objects[]` per row, carrying the row-level trust label decoration and the per-record provenance pill) and `review_decision_rejections` (one card per decision whose kind is `reject`, carrying `is_not_durable_graph_state: true`).
- `composeDurableStateView` descriptor-snapshots every input at the compose boundary before reading any field: the rows array, each row, the row's bundle, the bundle's account_objects array, and each account_object. This refuses an accessor-backed index on the rows array or on `account_objects[]`, and an accessor-backed inner field on the row or the account_object, BEFORE its getter fires. `isProxy` + `Array.isArray` is not sufficient: a plain non-Proxy array can still carry getter-backed indices. The render layer reads from the snapshot, not the input.
- `composeDurableStateView` re-asserts the trust-tier invariant at the render boundary as a fail-closed defense: after the snapshot, any durable record whose per-record `provenance_status` is `"verified"` is refused with `DurableStateRenderRefusal`. This is belt-and-suspenders for a FORGED reader result that never went through the reader's verified-refusal and deep-freeze; the render layer never emits a Verified-tier durable card.
- `composeDurableStateView` runs the human-review decision artifact through a render-side validator (`snapshotPlainOwnData` + `snapshotPlainArray`, the third call site of the executor/reader Proxy + descriptor-snapshot discipline) BEFORE rendering any rejection. It refuses a Proxy/accessor-backed artifact, decisions array (including accessor-backed indices on a plain non-Proxy array), or decision record; a wrong `kind` / `schema_version`; a non-`none` effective authorization; any broadened top-level or boundaries closed marker; and any `reject` decision carrying a non-null `graph_candidate_ref`, a non-false `promotion_performed`, or a verified `source_trust`. A refused input renders NO rejection card and is counted in `review_decision_refusals`; the HTML surfaces a refused-input notice.
- `renderDurableStateHtml` renders the view to a self-contained static HTML page with `<section class="durable-graph-records">` and `<section class="review-decisions">` styled as visibly different surfaces (solid green-tinted border vs dashed red-tinted border). Rejection cards never receive a `trust-pill`, never receive a `durable-record-id` attribute, and never use the durable-graph-record-card class.

Refusal codes (the reader's enumerated reject-paths):

- durable_db_unreachable
- row_proxy_backed
- row_not_plain_own_data
- row_symbol_keyed
- row_unsafe_key
- row_kind_invalid
- row_schema_version_invalid
- row_field_missing_or_malformed
- row_mediation_gate_level_invalid
- row_trust_label_invalid
- row_bundle_invalid
- row_bundle_marks_record_verified

The reader does not enforce a row-level `target_store` and carries no such refusal code: the 3a row does not stamp `target_store` (it lives on the executor outcome, pinned to local-durable-db) and the row `kind` is the sufficient discriminator. If a future row-shape slice stamps `target_store` on the row, that enforcement and its refusal code land there.

The render-side decision-artifact validator (`composeDurableStateView`) refuses, on its own paths: a Proxy- or accessor-backed decision artifact, decisions array, or decision record; a wrong `kind` / `schema_version`; any broadened top-level or boundaries closed marker; a non-`none` effective authorization; and any `reject` decision that carries a non-null `graph_candidate_ref`, a non-false `promotion_performed`, or a verified `source_trust`. A refused decision input renders NO rejection card; the render surfaces a count of refused inputs.

Non-goals:

- No provider/model call, web search, tool use, or spend.
- No private evidence read. The reader reads the durable store, not the source corpus.
- No durable graph write, graph ingestion, production write, deployment, or readiness claim. The reader is read-only.
- No HTTP server wiring. Static HTML only; HTTP is an explicit deferred decision (operator GO 2026-06-15).
- No role/session/permission modeling. M6 work.
- No corpus expansion or launch-gate change. The demo render artifact is a render-coverage artifact only.

Verification coverage:

`tests/workshop/durable-state-render.test.ts` proves:

- the full round trip on a real local-durable-db: a 3a write into a tmp DB, read back by the 3b reader, composed with a decision artifact that contains both an accept (matching the ratified row) and a reject (synthetic), and rendered to HTML
- the rendered HTML contains both `class="durable-graph-records"` and `class="review-decisions"`; never reuses lens-grid or lens-panel framing
- the rendered HTML contains the M3 admission decoration "Model-proposed · human-ratified · evidence pending"
- the rendered HTML contains the rejection card framing "Not in graph" and the `review-decision-rejection-card` class
- the reader on an uninitialized DB refuses with `durable_db_unreachable` and yields zero rows

`tests/safety/proposal-durable-state-render-contract.test.ts` proves the negatives explicitly (Scope Guard B):

- render NEVER displays the `trust-verified` CSS class for an M3 row; render NEVER emits a `>Verified<` per-record badge; the per-record pill text is `Source-backed`
- a rejection card NEVER includes `trust-pill`, `trust-verified`, `trust-source_document_only`, `durable-record-id`, `trust-label-decoration`, or `durable-graph-record-card`; it IS explicitly labeled "Not in graph" and carries `data-not-in-durable-graph="true"`
- the reader refuses a row whose per-record `provenance_status` is `verified` with `row_bundle_marks_record_verified` BEFORE rendering; the trust-tier check fires before the full graph validator
- the reader module source contains `nodeUtilTypes.isProxy` and defines `"row_proxy_backed"`, and the `isProxy` guard precedes `getOwnPropertyDescriptors` in source order
- the reader refuses rows whose `kind`, `mediation_gate_level`, or `trust_label` are not the M3 contract values
- the reader and render modules do not import provider SDKs, do not read `process.env`, do not import network modules; the render module performs no I/O at all
- the reader result carries the closed doctrine markers `provider_calls_made: 0`, `private_evidence_read: false`, `graph_ingestion_performed: false`, `durable_writes_performed: false`, `production_writes: false`, `readiness_claim: false`
- the reader DEEP-freezes the validated bundle: a post-read attempt to flip a per-record `provenance_status` to `verified` does not succeed, and the render still emits no `trust-verified`
- a FORGED reader result carrying a verified durable record, or a Proxy-backed row, is refused at `composeDurableStateView` with `DurableStateRenderRefusal` and never rendered
- the render-side decision-artifact validator refuses, dynamically (not by source-text inspection): a Proxy/accessor-backed decision artifact, decisions array, and decision record (the hostile getter never fires); a wrong `kind`/`schema_version`; a broadened closed boundary marker; and a `reject` decision carrying a non-null `graph_candidate_ref`. A well-formed reject still renders normally.
- an accessor-backed INDEX on `decisionArtifact.decisions` (a plain non-Proxy array with a getter installed on `"0"`) is refused at the `snapshotPlainArray` boundary; the index getter never fires
- a forged reader result with a getter-backed nested durable record field (`provenance_status`, `operator_identity`, etc.) or with an accessor-backed index on `bundle.account_objects` is refused at the compose-side `snapshotPlainOwnData` / `snapshotPlainArray` boundary; those getters never fire

Trust-tier discipline boundary statement (carried from M3 step 3a retro §1):

> Row-level `trust_label` records how the row entered the durable store — the admission path. In 3a's case: model-proposed and human-ratified, with evidence still pending.
>
> Per-record `provenance_status` records what backs the graph record itself — the evidence backing. In 3a's case: `source_document_only`.
>
> They may disagree only in the conservative direction. M4 / M5b may flip per-record `provenance_status` upward. M3 must not.

The reader enforces this contract at the read boundary so the render layer never sees a Verified-marked record in a pending row. The renderer surfaces both pieces — the row-level decoration and the per-record pill — so the visible artifact tells the truth about its own evidence status.

What this slice gates:

- M3 closes when this slice merges. The roadmap row flips to ✅.
- The real M3 retro follows. Whether the H-track freeze lifts and the M4-vs-M5a sequencing decision is taken on that retro, not in this slice.
- The H3 consolidated snapshot primitive will absorb this reader's `isProxy + descriptor snapshot` discipline as a mandatory requirement (per M3 step 3a retro §4). 3b is the second call site that justifies the consolidation.
