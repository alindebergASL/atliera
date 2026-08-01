# Atliera Provenance and Validation Architecture

## Thesis

Atliera is evidence-first account intelligence.

- Atliera Agent proposes.
- Atliera Graph validates and stores.
- Humans ratify, edit, reject, or request re-research.
- Atliera Workshop renders graph-backed intelligence and clearly labels unsupported or inferred material.

## Trust model

Atliera should not rely on “LLM with citations” as the trust model. The target is an auditable evidence graph:

1. The system fetches/canonicalizes source documents.
2. The system stores source text, metadata, and distinct origin/stored/transformation identities.
3. The model may propose excerpts and claims using bounded source context.
4. The system validates excerpt text/spans against stored source content.
5. The system validates all claim/evidence/object references.
6. Verified/high-confidence intelligence requires accepted evidence.
7. UI lenses render graph-backed records and provenance status.

## Core records

- SourceDocument
- EvidenceExcerpt
- Claim
- ClaimEvidence
- AccountObject
- AccountObjectClaim
- ResearchRun
- RunArtifact
- AuditEvent

## Serializable validation-to-render boundary

Generic Workshop projection accepts only the versioned `ValidatedCandidate`
envelope: an authoritative `SubjectScope` plus a recursively frozen,
plain-JSON `GraphBundle` snapshot. Candidate construction snapshots own data
before strict parsing and semantic validation; hydration repeats those checks
after JSON serialization, and Workshop hydrates again at use time. A raw or
mutable `GraphBundle` is therefore not render authority. This boundary does
not claim durable revision or store-read semantics. It does re-run the shared
source-integrity invariants before the graph may render.

## Source identity and stored-content integrity

Canonical `SourceDocument` records carry exactly three SHA-256 identity
fields. Digests are bare lowercase 64-hex values because each field name
already identifies the algorithm:

- `origin_content_sha256` identifies the acquired/origin bytes.
- `stored_content_sha256` identifies the exact UTF-8 bytes of `raw_text`.
- `transformation_manifest_sha256` may be null when origin and stored
  identities are equal, and is required when they differ.

Accepted `raw_text` must be a Unicode scalar-value sequence: lone UTF-16 high
or low surrogates are rejected before hashing, while valid supplementary-plane
pairs are preserved. Shared validation recomputes only
`stored_content_sha256`, using the exact UTF-8 encoding of that accepted string
without Unicode, whitespace, newline, or other normalization. It never
normalizes or calls `toWellFormed`. Accepted excerpt spans are then checked
against that same stored string. The origin and transformation-manifest fields preserve
distinct identities for custody and review binding; their bytes are not
claimed as locally verified when the origin object or external manifest is
not present at this boundary.

The canonical exact-key parser does not accept the former `content_hash`
field. `LocalFileVersionedGraphStore` alone has a historical schema-v2 read
adapter: it first verifies the original v2 envelope digest. Any v2 row carrying
one or more sources then requires migration review, because even a
self-consistent `content_hash` cannot prove whether it identifies origin bytes
or transformed stored bytes. Otherwise-valid source-free v2 rows may continue
through the isolated adapter. Canonical store writes use envelope schema v3
and never emit the legacy field.

The active M5b projection derives acquired, projected-text, and transformation
manifest identities deterministically from its verified source pack and
projected `raw_text`. Its candidate/review envelopes and repository-native
approval chain use new schema versions, producing new candidate and review
identities. Historical schema-v2 candidate/review artifacts remain read-only
records and cannot authorize canonical projection or commit.

Customer-visible free-form prose whose underlying provenance remains
`verified` is labeled exactly `Reviewed · source-backed`. The label describes
the evidence review honestly without presenting the prose itself as an
independently verified fact; conservative, contested, unsupported, stale, and
pending-review states retain their existing labels and behavior.

## Hard invariants

Any graph-first run fails if any occur. These are Atliera's carried-forward A.7 safety properties and should be tested with adversarial fixtures before real provider mode is enabled:

- schema parse failure
- invalid source-integrity digest syntax
- source `raw_text` containing an unpaired UTF-16 surrogate
- stored source digest mismatch against exact UTF-8 `raw_text` bytes
- distinct origin/stored identities without a transformation-manifest identity
- invented SourceDocument IDs
- invented EvidenceExcerpt IDs
- invented Claim, ClaimEvidence, AccountObject, or edge IDs
- dangling claim/evidence/object/edge references
- unsupported, unresolved, or cross-kind AuditEvent targets; graph audit targets are closed to the nine local record kinds plus the shape-bound M5a `proposal_set` and M5b `account_object_candidate` / `source_custody_retention_draft` compatibility kinds
- accepted excerpt text not found in stored source text after deterministic normalization
- accepted paraphrase treated as an excerpt rather than being rejected or stored as an unsupported proposal
- verified or high-confidence claim without accepted supporting excerpt
- false-verified claim, object, map item, signal, or play
- object marked verified without linked verified/supporting claim
- UI lens renders unsupported model prose as verified graph output
- production write during validation mode
- automatic model/provider call from default app paths, fixture mode, fake mode, import time, test setup, or validation-only commands
- provider/model call outside explicit model mode
- model mode without cost cap/provider/model/run approval
- projected or observed budget violation
- provider SDK import, API key read, or network call before explicit activation gates pass

`Capability` and `CapabilityExecution` audits remain in capability proof/result envelopes, not GraphBundles. They are intentionally excluded from the graph audit-target taxonomy until GraphBundle gains a locally resolvable capability record kind; there is no generic external-target escape hatch.

## Model/provider safety gates

- Fixture mode is deterministic and no-spend.
- Fake adapter mode is deterministic and no-network.
- Model mode is explicit, final-validation-only at first, and budget-capped.
- Provider SDK imports and API key reads must happen only after activation flags and budget checks pass.
- Budget enforcement is pre-call and conservative.
- Provider responses are untrusted proposals, not accepted evidence.

## Quality thresholds

Hard invariant pass is necessary but not sufficient. Launch quality also requires useful account intelligence on a deliberate gate corpus. Initial quantitative targets, carried forward from the A.7 discipline and revisable only after a documented internal validation run, are:

- 100% hard invariant pass rate: zero false-verified outputs, zero invented IDs, zero dangling references, zero accepted paraphrases, zero unbudgeted/default-path model calls
- accepted excerpt rate >= 50% on proposed excerpts for accounts with usable source material
- zero-output incidents < 10% of gate-corpus accounts with usable source material
- material-claim coverage >= 80%: at least 80% of material verified/high-confidence claims must have accepted supporting evidence
- every usable gate account produces at least one useful graph-backed AccountObject
- at least two launch lenses are materially useful for each usable gate account; all three lenses must render from the same graph where applicable
- unsupported/inferred material is visibly labeled and never styled as verified

Qualitative review still matters, but numbers prevent launch-quality arguments from becoming subjective.

## Legacy comparison protocol

Legacy reports may be inspected externally by Hermes/browser QA to compare:

- recovered themes
- missed but valuable legacy insights
- unsupported/outdated legacy claims
- new findings
- evidence quality delta
- Workshop usefulness delta

Comparison may trigger targeted re-research. It must not automatically import or verify legacy prose.
