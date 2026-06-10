# Atliera Blockers and Phase Gates

This file tracks gates that must be satisfied before Atliera moves from architecture to implementation, lab, and launch.

## Current gate status

| Gate | Status | Current interpretation |
| --- | --- | --- |
| Gate 0 | complete | Architecture, ADR, product vocabulary, provenance, and fresh-system separation docs exist. |
| Gate 1 | complete | Graph schemas, validators, fixtures, adversarial tests, and no-provider fixture/fake-mode guards exist. |
| Gate 2 | validated-boundary | Model/provider activation has explicit approval, budget, route catalog, preflight, and no-call/guarded proof machinery, but current effective authorization is none. |
| Gate 3 | underbuilt | Local fake HTTP serving, local `/healthz`, local durable DB boot/migration, local backup/restore round-trip, a local bearer auth seam, a plan-only lab deployment descriptor, a plan-only deployment-target healthcheck contract, a plan-only lab host supervision contract, a plan-only lab backup policy contract, a plan-only lab deployment execution preflight contract, an inert bounded lab deployment execution approval packet, bounded lab deployment slice A execution status, bounded lab slice B backup/restore proof status, and no-side-effect Gate 3 status reconciliation now exist. Slice A started the fake-mode lab service, ran `/healthz` plus optional `/workshop`, and stopped the service. Slice B used disposable lab data to create a lab-local backup artifact, restore into scratch, verify round-trip integrity, and remove restore scratch. Gate 3 still needs persistent deployment and readiness work under a fresh explicit operator decision before further lab expansion or any readiness claim. |
| Gate 4 | fixture-only | Launch-quality machinery exists for deterministic fixtures and gate corpus assessment only; no launch-ready claim is made. |

Current strategic reading: validation/proof machinery has outpaced the bootable product surface. The fake-mode Workshop HTTP seam, local durable DB boot contract, local backup/restore round-trip, local bearer auth seam, plan-only lab deployment descriptor, plan-only deployment-target healthcheck contract, plan-only lab host supervision contract, plan-only lab backup policy contract, plan-only lab deployment execution preflight contract, inert bounded lab deployment execution approval packet, bounded lab deployment slice A executed status, bounded lab slice B backup/restore proof status, and no-side-effect Gate 3 status reconciliation are now in place as Gate 3 foundations. The next recommended work: explicit operator decision for the next scoped Gate 3 slice before any further lab expansion, scheduler/backend wiring, process-manager install, nginx/TLS/DNS work, provider/model operation, graph ingestion, production write, or readiness claim.

## Gate 0: Architecture docs land

Required before implementation:

- ADR for fresh Atliera system exists.
- Product architecture doc exists.
- Provenance/validation doc exists.
- Legacy carry-forward vs leave-behind split is explicit.
- Signals/Maps/Plays are framed as graph-backed lenses, not separate early modules.

## Gate 1: Graph foundation before real model/provider work

Required before real provider calls:

- SourceDocument/EvidenceExcerpt/Claim/ClaimEvidence/AccountObject schemas exist.
- Deterministic validators exist alongside the schemas, not as a later retrofit.
- Adversarial tests cover both schema validity and validator rejection behavior.
- Fixture-mode hard invariant tests pass.
- Import-side-effect tests prove no provider SDK import, env read, or network call in fixture/fake modes.
- Model mode fails closed until explicitly activated.

## Gate 2: Model/provider activation

Required before any paid/model run:

- Human approval is recorded.
- Provider and model IDs are explicit/configurable.
- Cost projection is documented.
- Per-run budget cap is set.
- Pre-call budget enforcement exists.
- Fake adapter dry-run passes.
- Adversarial activation/budget tests pass.

## Gate 3: Lab deployment

Required before deploying to the configured lab target/domain:

- App boots from empty DB: local durable boot/migration contract exists; deployment-target DB boot remains future work.
- Build/test pass from exact commit.
- No legacy report JSON runtime dependency.
- nginx/PM2/Certbot deployment plan has a plan-only descriptor contract, execution preflight contract, inert bounded execution approval packet, slice A execution status, slice B backup/restore proof status, and no-side-effect Gate 3 reconciliation; persistent deployment wiring, nginx/PM2/Certbot install, and domain/TLS work remain future work.
- Healthcheck route exists locally; plan-only deployment-target healthcheck contract exists; bounded slice A ran the approved lab `/healthz` probe and stopped afterward; persistent remote probing and concrete deployment wiring remain future work.
- Lab host supervision contract exists as portable plan-only data; bounded slice A started and stopped the fake-mode service under a shell-supervised run only; service install and concrete process-manager wiring remain future work.
- Backup path/script exists locally before meaningful data is created; plan-only lab backup policy contract exists; bounded slice B created a lab-local disposable backup artifact, restored it into scratch, verified round-trip integrity, and removed restore scratch; scheduler installation, remote backup backend wiring, and meaningful-data restore proof remain future work.
- Execution preflight contract exists as portable plan-only data; any further deployment, remote probe, service start, backup/restore execution, scheduler/backend wiring, or readiness claim requires separate explicit operator approval.

## Gate 4: Launch quality

Required before broader use beyond the initial user:

- Deliberate gate corpus is documented.
- Zero hard invariant failures.
- Zero false-verified claims/objects/lens items.
- Zero invented source/excerpt/claim/object IDs.
- Zero accepted paraphrases treated as excerpts.
- Zero unbudgeted/default-path model calls.
- Accepted excerpt rate >= 50% on proposed excerpts for accounts with usable source material.
- Zero-output incidents < 10% of gate-corpus accounts with usable source material.
- Material-claim coverage >= 80% for verified/high-confidence claims.
- Useful end-to-end output for usable gate accounts.
- Signals/Maps/Plays render from shared graph-backed objects and do not fork validators, research logic, provenance logic, or data paths.
- Unsupported/inferred material is visibly labeled.
- Legacy comparison protocol has been run externally where relevant.

### Gate 4 enforcement status

The current validator and quality gate enforce per-bundle invariants and thresholds, the quality gate emits deterministic aggregate corpus metrics when multiple GraphBundles are supplied, `fixtures/gate-corpus/launch-v0.json` documents the selected deterministic v0 launch-gate corpus with executable expected validator/gate outcomes, `evaluateWorkshopLensUsefulness` provides a deterministic first-pass review for whether graph-backed Signals / Maps / Plays are materially useful, and `assessLaunchGateCorpusManifestFile` ties those pieces into one local assessment object with explicit usable-account Gate 4 metrics. This v0 corpus/review/assessment path is still fixture-only and explicitly does not claim live launch readiness.

`docs/strategy/first-validation-cycle-exit.md` records the first validation cycle exit assessment. It preserves no launch readiness and chooses no-spend methodology codification followed by a narrow product-facing fake-mode runtime slice; it does not approve runtime/model-mode integration, provider comparison, corpus expansion, production writes, or additional live provider calls.

Before launch-readiness assessment, Atliera still needs live or expanded-corpus review artifacts that finalize and approve:

- minimum usable gate-account count and corpus selection criteria
- zero-output incident rate across usable gate-corpus accounts
- material-claim coverage across verified/high-confidence claims
- lens usefulness across Signals / Maps / Plays
- hard-invariant pass/fail across the selected usable accounts

See `docs/architecture/atliera-product-architecture.md#launch-readiness-gating-layers`.

## Explicit non-goals for first launch

- Legacy brief_json import as a runtime path.
- dual-render old/new UI.
- production graph-first writes from external triggers.
- broad multi-user collaboration beyond basic team/user boundaries.
- advanced workflow automation.
- full resident autonomous shell agent on the production host.
