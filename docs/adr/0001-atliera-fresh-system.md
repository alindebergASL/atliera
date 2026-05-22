# ADR 0001: Atliera Fresh System

Status: Accepted

Date: 2026-05-22

## Context

Atliera.com is registered and becomes the clean-slate product direction after the account-research/Atlas exploration. This ADR establishes Atliera as a fresh-deployment product that supersedes the legacy account-research system for future product work.

The legacy account-research application continues to operate at its existing location, providing historical access to legacy briefs and the legacy Canvas. New product development happens in Atliera; the legacy system serves as historical reference and external comparison material only. It contains useful evidence-graph and validation work, but it is also tied to generated reports, `brief_json`, migration/backfill tooling, and old Canvas/report surfaces. Atliera needs a clean product foundation without carrying those runtime dependencies forward.

## Decision

Build Atliera as a fresh graph-first product in this repository.

Core product structure:

- Atliera Workshop: the user-facing human + agent workspace.
- Atliera Agent: the app-bounded in-product intelligence capability.
- Atliera Graph: the durable evidence/source/excerpt/claim/object truth layer.

Launch lenses:

- Signals: research/change lens.
- Maps: stakeholder/account-structure lens.
- Plays: recommendations/action lens.

Signals, Maps, and Plays are not separate early modules or separate data pipelines. They are lens-style views over one shared Atliera Graph. They may become product/package modules later only after a separate architecture decision. See `docs/architecture/atliera-product-architecture.md` for the explicit list of logic that lenses may not fork.

The core thesis is:

> Evidence is first-class. The agent proposes; the system validates; the human ratifies.

## Alternatives considered

1. Migrate legacy briefs into Atliera as historical data.
   - Rejected because legacy briefs are tightly coupled to `brief_json`, generated-report assumptions, migration/backfill tooling, and old UI semantics.
   - Direct migration would make legacy report structure part of Atliera's foundation and would weaken the fresh-system principle.

2. Evolve the legacy account-research app in place.
   - Rejected because dual-paradigm code would accumulate complexity: graph-first Atliera surfaces would keep negotiating with legacy brief/report paths.
   - The legacy paths would shape new development even when the product goal is no longer legacy report generation.

3. Fresh deployment with no legacy runtime data.
   - Accepted because clean architecture is more durable than incremental migration.
   - Legacy reports still have value, but they serve that value better as external comparison material than as Atliera's data source.

## Consequences

Benefits:

- Atliera can boot from an empty database.
- Legacy report JSON is not required for boot, research, rendering, or generation.
- New graph-first records must use validated source/excerpt/claim/object provenance before being treated as verified.
- A.5-A.7 validation patterns and graph schemas can be carried forward deliberately without preserving legacy runtime coupling.
- Legacy adapters and migration tooling stay behind.

Costs and trade-offs:

- The existing production briefs and any user-curated content in them are not directly available inside Atliera. Users who need that content must continue using the legacy system or accept that Atliera starts fresh per account.
- The validation infrastructure from A.5-A.7 must be re-implemented in Atliera rather than imported wholesale. The safety patterns carry forward, but the actual code lift is non-trivial.
- The legacy comparison protocol requires operational effort. Hermes/browser QA compares old reports against Atliera output externally rather than relying on automated in-app migration tooling.
- Atliera launches with no historical data baseline. Initial quality measurement is against fresh research runs and an explicit gate corpus, not against legacy data loaded into Atliera.
- Fresh deployment increases early setup work: new repository conventions, empty-DB boot path, lab deployment, and quality gates must all be established before product iteration accelerates.

## Carry forward

Carry forward into Atliera:

- SourceDocument, EvidenceExcerpt, Claim, ClaimEvidence, AccountObject, and relationship/edge primitives after review. The evidence graph schema carries forward as a conceptual blueprint, not as copy-pasted legacy code; Atliera should re-implement it fresh against its own data model, naming, module boundaries, and chosen DB.
- Model adapter pattern. A.5-A.7 validation infrastructure also carries forward as patterns and safety properties, not as a literal import of the legacy directory structure, file names, or test organization.
- Fixture/fake/model mode separation.
- Pre-call budget enforcement.
- Activation flag discipline.
- Import-side-effect tests that prove no provider SDK import, API key read, or network call in safe modes.
- Adversarial tests for provider activation, budget exhaustion, malformed model output, and invented IDs.
- Evidence excerpt validation and span/text matching.
- Artifact preservation for failed/partial runs.
- Review-cycle playbook accumulated through A.6/A.7 retrospectives, including CLI hygiene, tests that assert named properties rather than only success codes, aggregate visibility, verifier reruns as authoritative evidence, adversarial input testing, classification handles empty cases, and end-to-end integration assertions.

## Leave behind

Leave with the legacy system:

- `brief_json` compatibility logic.
- `fromBriefJson` mapper.
- `briefParity` logic.
- dual-render UI.
- backfill reports/migration-only paths.
- old report routes/rendering/Canvas compatibility shims.
- any old DB shape as runtime dependency.

## First deployment posture

- Lab first: `lab.atliera.com` on the new EC2.
- Production/app domain later: `app.atliera.com` when quality gates pass.
- Hermes remains the remote operator/reviewer/QA workstation.
- The EC2 host remains runtime only; no full resident autonomous shell agent on production.
