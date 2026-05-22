# ADR 0002: Phase 1 edge primitives — no generic GraphEdge

Status: Accepted

Date: 2026-05-22

Supersedes: nothing
Refines: `docs/adr/0001-atliera-fresh-system.md`, §"Carry forward" item 1,
which lists `SourceDocument, EvidenceExcerpt, Claim, ClaimEvidence,
AccountObject, GraphEdge or equivalent relationship primitives, if still
useful after review`.

## Context

Atliera's evidence graph needs to express two kinds of relationships in
Phase 1:

1. A `Claim` is supported, contradicted, or contextualised by an
   `EvidenceExcerpt`.
2. An `AccountObject` (signal / stakeholder / play / etc.) is backed by
   one or more `Claim`s in a primary / supporting / context role.

The carry-forward list in ADR 0001 leaves open whether to model these as
a single generic `GraphEdge` table with `(source_id, target_id, kind)`
columns, or as typed edge records per relationship kind. PR #36 in the
legacy account-research system shipped both shapes at various points;
Hermes flagged the ambiguity on PR #2 of this repository.

## Decision

Phase 1 uses **typed edge records only**:

- `ClaimEvidence` — the only edge type between `Claim` and
  `EvidenceExcerpt`.
- `AccountObjectClaim` — the only edge type between `AccountObject` and
  `Claim`.

There is **no `GraphEdge` primitive** in Phase 1. There is no generic
`source_id` / `target_id` / `kind` table, no polymorphic edge type, and
no edge that crosses kinds outside the two pairings above.

The validator enforces this by checking, for every edge field, that the
referenced id uses the prefix of the expected record kind. A
well-formed but wrong-prefix id (e.g. an `AccountObject` id smuggled
into a `ClaimEvidence.claim_id` field) is flagged as a
`dangling_reference` hard failure even when the id otherwise exists in
the bundle.

## Rationale

1. **Validators stay specific.** Each edge type has its own integrity
   rules: `ClaimEvidence` participates in
   `verified_claim_without_evidence`; `AccountObjectClaim` participates
   in `verified_object_without_supporting_claim`. A generic edge table
   would force these rules to dispatch on `kind` strings, which is a
   common source of "this rule was skipped because the kind didn't
   match" bugs.

2. **The schema is the contract.** Typed edges make it impossible for a
   model proposal to invent a new relationship kind. A generic
   `GraphEdge` with a free-form `kind` column would let a model propose
   `kind: "explains"` or `kind: "summarises"` and have the row land in
   the database before any validator could reject it.

3. **Cross-kind smuggling is detectable.** Because the only valid
   relationships are `Claim ↔ EvidenceExcerpt` and `AccountObject ↔
   Claim`, the validator can reject any id that does not carry the
   expected prefix. With a generic edge table, the prefix check would
   have to live in a separate "edge kind registry" that drifts away
   from the schema.

4. **Lens views still share one graph.** Signals, Maps, and Plays all
   read from `AccountObject` + `Claim` + `EvidenceExcerpt`. They do
   not require additional edge kinds in Phase 1; the lens-output
   validator rejects unsupported model prose using only the existing
   primitives.

5. **Future phases can add typed edges without a schema migration to
   the existing tables.** Stakeholder-to-stakeholder relationships
   (Maps), play-to-claim chains (Plays), and change-detection edges
   (Signals) will each get their own typed primitive when the lens
   experience demands them. The decision to *not* add `GraphEdge` now
   keeps that door open without forcing a generic table to absorb
   semantically distinct relationships.

## Consequences

Benefits:

- One named edge primitive per relationship kind keeps validators
  declarative.
- Wrong-prefix references fail loudly rather than landing in a generic
  `kind` column.
- Adversarial fixtures can target each edge type by name.

Costs:

- Adding a new relationship kind requires a new typed primitive (schema
  parser, validator hook, fixture). This is intentional: every new
  edge kind gets a deliberate review rather than slipping in as a new
  row in a generic table.
- Aggregate "show me all edges from X" queries are not free — each
  edge type is its own collection. Phase 1 has no such query
  requirement, and Phase 2+ can add a derived view if needed.

## Carry forward

- Future phases that need additional relationship semantics (e.g.
  stakeholder-to-stakeholder for Maps, supersedes/contradicts chains
  for change detection) MUST introduce a new typed edge primitive
  rather than reaching for a generic `GraphEdge`. This ADR must be
  updated before any such change.
- The wrong-prefix detection in the validator is part of the Phase 1
  contract and MUST remain in place even if new edge primitives are
  added.
