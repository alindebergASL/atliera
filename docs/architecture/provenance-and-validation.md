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
2. The system stores source text, metadata, and content hashes.
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

## Hard invariants

Any graph-first run fails if any occur:

- schema parse failure
- invented SourceDocument IDs
- invented EvidenceExcerpt IDs
- dangling claim/evidence/object references
- accepted excerpt text not found in stored source text after deterministic normalization
- verified or high-confidence claim without accepted supporting excerpt
- object marked verified without linked verified/supporting claim
- production write during validation mode
- provider/model call outside explicit model mode
- model mode without cost cap/provider/model/run approval
- projected or observed budget violation

## Model/provider safety gates

- Fixture mode is deterministic and no-spend.
- Fake adapter mode is deterministic and no-network.
- Model mode is explicit, final-validation-only at first, and budget-capped.
- Provider SDK imports and API key reads must happen only after activation flags and budget checks pass.
- Budget enforcement is pre-call and conservative.
- Provider responses are untrusted proposals, not accepted evidence.

## Quality thresholds

Hard invariant pass is necessary but not sufficient. Launch quality also requires useful account intelligence on a deliberate gate corpus:

- useful graph-backed output for accounts with usable source material
- low zero-output rate
- accepted excerpt coverage high enough that Workshop is not mostly unsupported summaries
- Signals, Maps, and Plays lenses all render from shared graph-backed AccountObjects
- unsupported/inferred material visibly labeled

## Legacy comparison protocol

Legacy reports may be inspected externally by Hermes/browser QA to compare:

- recovered themes
- missed but valuable legacy insights
- unsupported/outdated legacy claims
- new findings
- evidence quality delta
- Workshop usefulness delta

Comparison may trigger targeted re-research. It must not automatically import or verify legacy prose.
