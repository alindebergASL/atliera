# Fake-Mode Workshop Surface Exit Criteria

Status: Accepted

Last updated: 2026-05-28

## Purpose

This document defines the fake-mode Workshop surface exit criteria for the product-facing preview phase described in `product-facing-fake-mode-runtime-scope.md` and exercised by `../runbooks/workshop-runtime-preview-demo.md`.

The exit decision is deliberately narrow: the fake-mode Workshop surface is sufficient to request, but not execute, a separate one-run live-provider product-preview approval packet. This document does not approve live provider execution, does not approve provider spend, does not approve production writes, does not approve provider comparison or corpus expansion, does not approve runtime/model-mode integration, does not claim launch readiness, and does not claim product readiness.

## Required evidence already present

The exit criteria rely on the current deterministic fake-mode surface and its checked evidence:

- `tests/workshop/render-html-edge-cases.test.ts` covers sparse and low-trust Workshop HTML rendering behavior.
- `tests/cli/runtime-workshop-preview-demo-report.test.ts` regenerates the deterministic preview report and compares it with the checked file.
- `fixtures/workshop/runtime-preview-demo-report.json` is the checked sanitized runtime Workshop preview report.
- `docs/runbooks/workshop-runtime-preview-demo.md` records the exact repo-safe demo commands and interpretation limits.

## Exit checklist

The fake-mode Workshop surface exits this phase only when every gate below remains true.

### 1. Product surface coverage

- Signals, Maps, and Plays render from graph-backed data.
- The checked report records `lensItemCounts` as `signals: 1`, `maps: 1`, and `plays: 1`.
- The checked report records `lensEvidencePacketCounts` as `signals: 1`, `maps: 1`, and `plays: 1`.
- Empty and sparse graph states render visibly rather than pretending intelligence exists.
- Unsupported, unverified, stale, and source-document-only objects are visibly labeled.
- Accepted evidence packets are shown only when accepted support exists.
- Unsupported objects remain visibly bounded and are not described as verified.

### 2. Safety and rendering boundaries

- Graph text is HTML-escaped before rendering.
- Unsafe source URLs are omitted instead of becoming clickable links.
- Unknown or missing publishers are handled safely.
- No raw runtime object is returned from product-facing preview/report helpers.
- No raw HTML appears in JSON reports.
- No output paths are emitted from the no-write preview commands.
- Checked reports omit clients, stores, queues, model adapters, provider transports, and private evidence.

### 3. Runtime and no-spend boundaries

- `MODEL_PROVIDER=fake` is required for the preview path.
- `providerCallsMade: 0` is preserved.
- `productionWrites: false` is preserved.
- `serverStarted: false` is preserved.
- `clientsConstructed: false` is preserved.
- Hostile ambient provider environment is ignored by the CLI, which injects deterministic fake-mode preview config.
- Fake-mode gates happen before graph reads when preflight or provider-mode checks fail.
- Product-facing report helpers remain stdout-only or return sanitized data; they do not write graph state or artifacts.

### 4. Demo and report evidence

- A checked demo report exists at `fixtures/workshop/runtime-preview-demo-report.json`.
- The checked report sync test regenerates and compares deterministic output.
- The exact JSON demo command remains:

```bash
npm run --silent workshop:runtime-preview -- fixtures/graph/valid/workshop-three-lane.json
```

- The exact stdout-only HTML demo command remains:

```bash
npm run --silent workshop:runtime-preview:html -- fixtures/graph/valid/workshop-three-lane.json
```

### 5. Verification discipline

- Targeted tests for the touched surface pass.
- Full `npm run ci` passes before merge.
- A staged-diff static scan checks for private evidence leakage and obvious unsafe code patterns.
- Independent review passes for changes that alter this exit decision, product-facing safety wording, approval posture, or runtime/report boundaries.

## Interpretation limits

Passing these exit criteria means only that the deterministic fake-mode Workshop surface is ready to ask for the next approval artifact.

It does not prove provider quality, does not prove multi-account readiness, does not prove paid-budget enforcement, and does not prove launch, product, or production readiness. It also does not prove that future gateway or direct-provider responses will match the deterministic fixture shape.

## Next artifact after exit

The first historical live-preview artifact is `../runbooks/live-product-preview-approval.md`, with sanitized execution follow-up in `../runbooks/live-product-preview-status.md` as a no-readiness status record. That first run is already consumed and should not be treated as a standing approval.

The next artifact after this three-lane fake-mode exit is `../runbooks/live-product-preview-three-lane-approval.md`, a separate docs-only approval packet for one screened live-provider product preview. It identifies the provider/model, the screened tiny account or corpus scope, the budget cap, the private evidence handling, the success/failure interpretation, and the pre-run decision tree. The later sanitized execution record is `../runbooks/live-product-preview-three-lane-status.md`.

The live product preview approval packet must continue to prohibit provider comparison, broad corpus expansion, production writes, production deployment, paid fallback, tools/plugins/search, and launch/product/production readiness claims for this run. Any future paid fallback or tool/search capability remains a separate approval surface with its own scope, spend, provenance, private-evidence, and sanitized-status plan.
