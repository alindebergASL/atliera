# ADR 0001: Atliera Fresh System

Status: Proposed

Date: 2026-05-22

## Context

Atliera.com is registered and becomes the clean-slate product direction after the account-research/Atlas exploration. This ADR establishes Atliera as a fresh-deployment product that supersedes the legacy account-research system for future product work. The legacy account-research application remains historical context and an external comparison reference only: it contains useful evidence-graph and validation work, but it is also tied to generated reports, `brief_json`, migration/backfill tooling, and old Canvas/report surfaces. Atliera needs a clean product foundation without carrying those runtime dependencies forward.

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

Signals, Maps, and Plays are not separate early modules or separate data pipelines. They are lens-style views over one shared Atliera Graph. They may become product/package modules later only after a separate architecture decision.

The core thesis is:

> Evidence is first-class. The agent proposes; the system validates; the human ratifies.

## Consequences

- Atliera must boot from an empty database.
- Legacy report JSON is not required for boot, research, rendering, or generation.
- Legacy account-research reports may be used only as external comparison artifacts.
- New graph-first records must use validated source/excerpt/claim/object provenance before being treated as verified.
- A.5-A.7 validation patterns and graph schemas should be carried forward deliberately.
- Legacy adapters and migration tooling must stay behind.

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
