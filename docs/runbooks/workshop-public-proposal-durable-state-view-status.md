# Workshop Public Proposal Durable State View Status

Status: active M3 step 3b status for the read-only durable-state Workshop rendering path.

This runbook records the first read path from local durable graph state into the standard Workshop view model and static HTML renderer. It is intentionally read-only: it reads `tables/graph_snapshots.jsonl` rows from the local durable DB, validates and snapshots each row at the trust boundary, projects the contained `GraphBundle` through the existing Workshop view model, and renders a visible static Workshop artifact.

Boundary markers:

- current_effective_authorization: none
- provider_calls_executed_by_this_status: 0
- provider_spend_by_this_status: false
- durable_writes_performed_by_this_status: false
- graph_ingestion_performed_by_this_status: false
- production_writes: false
- launch_readiness_claim: false
- product_readiness_claim: false
- default_model_selection_claim: false
- h_track_work_performed: false

## What changed

M3 step 3a wrote the first controlled durable graph row under an operator arming. Step 3b adds the read side:

- `src/workshop/durable-graph-snapshots-reader.ts` reads local durable DB `tables/graph_snapshots.jsonl` rows.
- `src/workshop/durable-state-view-model.ts` bridges validated durable rows into the existing `buildWorkshopViewModel` / `renderWorkshopHtml` surface.
- `src/workshop/render-html.ts` can optionally render a separate rejected-proposals audit panel.

The rejected-proposals panel is not graph state. It is sourced from the disposable human-review decision artifact only as review/audit context and renders explicit copy: `Rejected proposal — not written to durable graph.`

## Trust-tier rendering contract

M3 ratification is admission-by-ratification, not evidence verification. Durable rows from this slice can carry row-level `trust_label: model-proposed-human-ratified-evidence-pending` while contained records remain backed by `provenance_status: source_document_only`.

The 3b Workshop projection is intentionally conservative:

- the visible card renders with the Unverified trust pill;
- the visible card carries the `Model-proposed · pending human review` decoration;
- `source_document_only` records never render as a Verified pill;
- no marker is flipped in durable state;
- no durable row is rewritten;
- M4/M5b evidence re-verification remains the later path that may upgrade per-record evidence status.

## Snapshot and refusal boundary

The durable-state reader follows the M3 step 3a retro rule: safety rests on snapshot-and-revalidate-at-entry, not on enumeration completeness.

At the row boundary it refuses:

- Proxy-backed rows before descriptor reflection or value reads;
- accessor-backed rows before getter values are invoked;
- symbol keys, unsafe keys, non-enumerable keys, and unexpected row keys;
- malformed row identifiers/timestamps;
- rows whose embedded `GraphBundle` fails parse or validation.

## Verification

Targeted verification for this slice:

- `node --import tsx --test tests/workshop/durable-state-view-model.test.ts tests/safety/durable-state-view-model-contract.test.ts`
- `node --import tsx --test tests/workshop/proposal-preview.test.ts`
- `npm run typecheck`
- `npm run ci`

Expected coverage:

- 3a writes a row and 3b reads the actual local durable DB row.
- The renderer shows Unverified plus the model-proposed pending-human-review badge.
- A rejected reason is visible when the human-review decision artifact includes one.
- Rejected proposals are rendered as non-graph review/audit context.
- `source_document_only` durable records never render as Verified.
- Proxy-backed rows and accessor-backed rows are refused without invoking traps/getters.

## Non-authorization

This status does not authorize provider calls, private evidence reads, further graph ingestion, durable writes, production writes, deployment, HTTP wiring, model comparison, H-track work, or any readiness claim. The fake-mode HTTP server remains out of scope for this slice; the visible artifact is static HTML.
