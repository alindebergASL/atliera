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
npm run validate:fixture -- fixtures/graph/valid/workshop-three-lane.json
npm run gate:fixture -- fixtures/graph/valid/workshop-three-lane.json
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

## File-backed graph store

Phase 1.4 also includes a tiny file-backed graph store adapter for local JSON files only. It is not a database and it does not add app/runtime persistence. The store:

- loads GraphBundle JSON files from disk
- validates bundles before save by default
- writes atomically through temp-file + rename
- requires an explicit output root for saves
- rejects writes outside the output root, `.git` paths, repo working-tree paths by default, git-tracked files, symlink escapes, and implicit overwrites
- refuses saves in `validation`, `fixture`, and `fake` safe modes
- performs no network, provider, or DB work

CLI smoke commands:

```bash
npm run graph:load -- fixtures/graph/valid/minimal-pass.json
mkdir -p /tmp/atliera-graph-output
npm run graph:save-copy -- fixtures/graph/valid/minimal-pass.json /tmp/atliera-graph-output/copy.json --mode model --out-root /tmp/atliera-graph-output
```

`graph:save-copy` intentionally requires both an explicit mode and an explicit `--out-root`. Passing a safe mode such as `--mode fixture` is expected to fail because file-store writes go through the production-write guard. Existing output files are refused unless `--allow-overwrite` is passed.

## Local run artifact manifests

Phase 1.5 packages a local GraphBundle, its per-bundle quality-gate report, and a manifest into one explicit output-root directory. This is still local JSON file output only: no provider calls, no network, no database, and no app/runtime persistence.

CLI smoke command:

```bash
mkdir -p /tmp/atliera-run-output
npm run run:manifest -- fixtures/graph/valid/minimal-pass.json --mode model --out-root /tmp/atliera-run-output --run-slug fixture-valid-run
```

The manifest package contains:

- `graph-bundle.json`
- `quality-gate-report.json`
- `manifest.json`

`run:manifest` writes through the same path guard as the file-backed graph store. It requires `--out-root` and `--run-slug`, refuses safe-mode writes, refuses implicit overwrites, records the per-bundle quality-gate status in `manifest.json`, and uses relative artifact paths inside the manifest.

The v1 manifest also reserves stable future model-run fields so later provider phases can populate the same schema shape instead of forcing early consumers to handle a second manifest shape immediately:

- `model_run`: currently `provider`, `model`, `started_at`, and `completed_at` are `null`
- `cost_ledger`: currently `currency`, `total_cost`, `input_tokens`, and `output_tokens` are `null`
- `adapter_records`: currently an empty array

## Workshop shell smoke HTML

Phase 2.1 adds a deterministic static Workshop shell renderer. It renders a GraphBundle into an Atliera Workshop HTML page with Signals, Maps, and Plays lens panels from the same graph-derived view model. `fixtures/graph/valid/workshop-three-lane.json` is the richer preview fixture for seeing all three lanes populated at once.

CLI smoke command:

```bash
mkdir -p /tmp/atliera-workshop
npm run workshop:shell -- fixtures/graph/valid/minimal-pass.json --out-root /tmp/atliera-workshop --out-file acme-workshop.html
npm run workshop:shell -- fixtures/graph/valid/workshop-three-lane.json --out-root /tmp/atliera-workshop --out-file acme-workshop-three-lane.html
```

The output is local static HTML only. It does not call providers, read API keys, use the network, touch a database, or deploy. The shell is intentionally fixture/graph-backed: unsupported or inferred material must be visibly labeled, and verified-looking items must carry evidence/provenance metadata.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` on pull requests to `main`, pushes to `main`, and manual dispatch.

CI steps:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. `npm test`
5. `npm run gate:fixture:valid`
