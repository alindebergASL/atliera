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

Any graph-first run fails if any occur. These are Atliera's carried-forward A.7 safety properties and should be tested with adversarial fixtures before real provider mode is enabled:

- schema parse failure
- invented SourceDocument IDs
- invented EvidenceExcerpt IDs
- invented Claim, ClaimEvidence, AccountObject, or edge IDs
- dangling claim/evidence/object/edge references
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
