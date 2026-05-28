# Workshop Runtime Preview Demo

Status: Accepted

Last updated: 2026-05-28

## Purpose

This runbook records the repo-safe demo path for the fake-mode Atliera Workshop runtime preview. It uses the checked graph fixture `fixtures/graph/valid/workshop-three-lane.json` and the checked sanitized report `fixtures/workshop/runtime-preview-demo-report.json`.

The demo proves that the product-facing Workshop preview can render a bounded graph snapshot through the runtime preview seam. The CLI injects `MODEL_PROVIDER=fake` and ignores ambient provider settings for this preview path. It does not approve live provider execution, does not approve provider spend, does not approve runtime/model-mode integration, does not approve production writes, and does not claim launch readiness or product readiness.

## Commands

Use `--silent` so stdout is machine-readable and does not include npm lifecycle noise.

Sanitized JSON report:

```bash
npm run --silent workshop:runtime-preview -- fixtures/graph/valid/workshop-three-lane.json
```

Stdout-only HTML preview:

```bash
npm run --silent workshop:runtime-preview:html -- fixtures/graph/valid/workshop-three-lane.json
```

## Checked report contract

`fixtures/workshop/runtime-preview-demo-report.json` is the checked sanitized report for the JSON command above. It is intentionally small and omits raw HTML, runtime objects, output paths, clients, stores, queues, model adapters, and any provider transport detail.

Expected stable boundary fields:

- `modelProvider: fake`
- `providerCallsMade: 0`
- `productionWrites: false`
- `serverStarted: false`
- `clientsConstructed: false`
- `graphSnapshotRead: true`
- `accountId: acc_acme_robotics`
- `totals.account_objects: 3`
- `totals.verified_objects: 3`
- `lensItemCounts.signals: 1`
- `lensItemCounts.maps: 1`
- `lensItemCounts.plays: 1`
- `lensEvidencePacketCounts.signals: 1`
- `lensEvidencePacketCounts.maps: 1`
- `lensEvidencePacketCounts.plays: 1`

## Interpretation limits

This runbook feeds the exit checklist in `docs/strategy/fake-mode-workshop-surface-exit-criteria.md` and the later `docs/runbooks/live-product-preview-approval.md` live product preview approval packet.

This is a deterministic fake-mode demo over a repo-safe fixture. It is useful as an operator smoke path and product-surface fixture, but it is not evidence that future provider output will have the same shape, coverage, quality, or completeness.

Any live-provider product preview requires a separate approval packet before execution and a later sanitized status record after execution.
