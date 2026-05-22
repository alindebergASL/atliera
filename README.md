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

Generate the valid fixture JSON without validating it:

```bash
npm run fixture:valid-json
```

Validate any GraphBundle JSON file manually:

```bash
npm run validate:fixture -- path/to/bundle.json
```

or via stdin:

```bash
cat path/to/bundle.json | npm run validate:fixture -- -
```

The fixture/default validation path is deterministic and must not import provider SDKs, read provider API keys, or make network calls. The safety tests enforce this contract.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pull requests to `main`, pushes to `main`, and manual dispatch.

CI steps:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm test`
