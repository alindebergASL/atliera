# Atliera

Atliera is an evidence-backed account intelligence workspace.

This repository is the clean-slate Atliera product foundation for the registered `atliera.com` domain. Atliera is separate from the legacy account-research/report system: it should boot from an empty database and use legacy systems only as external comparison references.

Core architecture vocabulary:

- Atliera Workshop — the main human + agent workspace
- Atliera Agent — the app-bounded in-product intelligence capability
- Atliera Graph — the evidence/source/excerpt/claim/object truth layer
- Signals / Maps / Plays — launch lenses over the same graph, not separate early data pipelines

See `docs/architecture/atliera-product-architecture.md` and `docs/adr/0001-atliera-fresh-system.md` for the initial architecture plan.

## Phase 1 graph foundation

The current codebase contains the Phase 1 Atliera Graph foundation:

- graph primitive types in `src/graph/types.ts`
- strict structural parsing in `src/graph/schema.ts`
- deterministic hard-invariant validation in `src/graph/validate.ts`
- no-spend fixture validation CLI in `src/cli/validate.ts`
- adversarial graph tests in `tests/graph/`
- safety tests in `tests/safety/`

Phase 1 intentionally does not include UI, database persistence, live source fetching, provider/model integration, deployment, or legacy data migration.

## Local verification

Use Node.js 22 or newer.

Install dependencies:

```bash
npm ci
```

Run the same verification bundle used by CI:

```bash
npm run ci
```

Equivalent explicit commands:

```bash
npm run typecheck
npm run build
npm test
```

Validate the canonical fixture through the no-spend fixture CLI:

```bash
npm run validate:fixture:valid
```

Run the Phase 1.2 quality gate against the canonical fixture:

```bash
npm run gate:fixture:valid
```

The quality gate consumes one or more GraphBundle JSON files, runs deterministic validation, computes launch-quality metrics, and emits `pass`, `borderline`, or `fail`. It exits `0` only for `pass`.

Quality gate checks include:

- hard validation failures
- invented ID failures
- zero-output incidents
- accepted excerpt rate
- verified/high-confidence claim evidence coverage

Generate the valid fixture JSON without validating it:

```bash
npm run fixture:valid-json
```

Use the checked-in fixture corpus:

```bash
npm run validate:fixture -- fixtures/graph/valid/minimal-pass.json
npm run gate:fixture -- fixtures/graph/valid/minimal-pass.json
npm run validate:fixture -- fixtures/graph/invalid/excerpt-span-mismatch.json
npm run gate:fixture -- fixtures/graph/valid/borderline-low-excerpt-rate.json
```

Corpus shortcuts:

```bash
npm run corpus:validate:valid
npm run corpus:gate:valid
npm run corpus:gate:all # expected to exit 1 because it includes invalid/borderline fixtures
```

The fixture corpus is intentionally deterministic JSON, not generated at test time. It gives future agents and humans concrete examples of pass, borderline, and fail graph/gate behavior.

Validate a local GraphBundle JSON file:

```bash
npm run validate:fixture -- path/to/bundle.json
```

or via stdin:

```bash
cat path/to/bundle.json | npm run validate:fixture -- -
```

Run the quality gate on one or more local GraphBundle JSON files:

```bash
npm run gate:fixture -- path/to/bundle.json another-bundle.json
```

or via stdin:

```bash
cat path/to/bundle.json | npm run gate:fixture -- -
```

The fixture/default validation path is deterministic and must not import provider SDKs, read provider API keys, or make network calls. The safety tests enforce this contract.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pull requests to `main`, pushes to `main`, and manual dispatch.

CI steps:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm test`
5. `npm run gate:fixture:valid`
