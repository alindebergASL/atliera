# ADR 0004: Calm product surface and internal Package Inspector

Status: Proposed for merge — owner decision is authoritative; this ADR becomes the in-repository prospective product authority when merged.

Date: 2026-08-18

Owner decision: `ATLIERA_CALM_PRODUCT_HARD_PIVOT_DOCUMENTATION_SLICE_01`

## Context

Atliera's graph, evidence, proposal, validation, authorization, and durable-state work has produced strong internal verification surfaces. The current M5b account-review renderer exposes much of that machinery directly: proposal grids, source registers, local Accept/Reject decoration, request-supplied labels, package identities, hashes, bindings, effect boundaries, and repeated trust language.

That surface is useful for package inspection and development. It is not accepted as the ordinary customer-product baseline.

ADR 0001 correctly established a fresh graph-first Atliera system, one evidence-backed product, no legacy runtime dependency, and the doctrine that the agent proposes, the system validates, and a human ratifies. Its references to Workshop and Signals/Maps/Plays as the visible product structure predate the owner-directed calm-product correction.

The current repository also records that default product/runtime AI participation is effectively zero. M5b interpretation, recommendation, customer-answer, and meeting-plan prose is request-supplied or fixture-authored unless a separately evidenced provider run says otherwise. A future AI-native experience must not misrepresent that present state.

## Decision

Atliera's governing product rule is:

> **Answers first. Evidence on demand. Machinery by invitation.**

Atliera will have one progressively disclosed product:

1. **Everyday Account Workspace** — the primary product, calm and useful with little or no training.
2. **Researcher/power-user depth** — claims, exact excerpts, rationale, conflicts, freshness, alternatives, versions, and deltas on deliberate access.
3. **Audit/developer depth** — packages, internal IDs, hashes, byte spans, bindings, manifests, receipts, execution identities, and authorization/effect boundaries under appropriate restriction.

The ordinary product shows account meaning, why now, what changed, who and what matter, and one recommended next move before evidence mechanics. Its primary action is `Prepare for…`. Important evidence is reachable within two interactions.

The existing dense M5b `workshop-pre-ratification.html` renderer is reclassified as an internal **Package Inspector / Audit View / developer diagnostic**. It remains supported for its scoped verification role. It will not be polished into or presented as the default customer experience.

Signals, Maps, Plays, Workshop, Agent, and Graph remain useful internal architecture and expert-surface concepts. Level 1 uses plain business language and does not require users to know those terms.

No customer-facing control may claim to save, accept, ratify, publish, apply, persist, monitor, or share unless it actually performs that effect and exposes the resulting state truthfully.

## Product stack

1. Calm Account Workspace derived from the Account Brief Builder concept.
2. Trusted persistent Source → Excerpt → Claim/Proposal → Reviewed Understanding layer.
3. Audience-specific outputs at the owner-described quality of the Stanford CIO briefing.

The Account Brief Builder and Stanford CIO briefing are owner-supplied **external and nonbinding** reference artifacts under `CONTRIBUTING.md`. No exact artifact for either is committed at the verified repository tree. They are references, not inspected repository inputs, runtime dependencies, or restored public product names. The owner-codified qualities in this ADR and its linked contracts govern.

## Consequences

### Preserved

- fresh-system and no-legacy-runtime principles;
- Atliera Graph and evidence-backed records;
- exact provenance and freshness distinctions;
- deterministic validation;
- proposal-versus-reviewed distinctions;
- bounded authorization and explicit consequential-effect gates;
- immutable history and reproducible snapshots;
- security and custody boundaries;
- the current Package Inspector and historical implementation evidence.

### Superseded prospectively

This ADR supersedes only customer-facing information-architecture implications that make any of the following the ordinary product baseline:

- three simultaneous Signals/Maps/Plays panels;
- every graph/proposal object visible by default;
- evidence-first interpreted as screen order rather than trust architecture;
- dense proposal review as the normal account journey;
- the M5b package page as the final customer Account Workspace;
- Workshop/Graph/package vocabulary as required user knowledge.

It does not rewrite historical statements about implemented code, tests, approvals, effects, or artifact identities.

### Required acceptance

Representative first-time-user testing is a product gate. Visual polish, deterministic validity, and screenshot review are insufficient.

### Implementation posture

This ADR authorizes no implementation. The exactly one recommended first code slice after explicit owner approval is a calm read-only Account Home projected from existing admitted/validated data, with the Package Inspector retained behind an explicit internal boundary. The slice must include a functional `Prepare for…` action that reveals only an already-admitted meeting plan and does not claim new generation, saving, or persistence. Because identity and roles are outside that slice, the Package Inspector must be absent from customer navigation, customer routes, and the customer build and remain only a separate local/test artifact or separately operated internal surface until role-based authorization exists; labeling or obscurity is not an access boundary. Existing targeted CISO and proposal/RFx brief fixtures may provide useful disclosure/layout patterns, but an audience-specific `/brief` route would skip the primary Account Workspace journey and is therefore not selected as the first pivot slice.

## Detailed authorities

- Product pivot, verified baseline, sequence, and supersession: [`../strategy/calm-product-hard-pivot.md`](../strategy/calm-product-hard-pivot.md)
- Ordinary experience: [`../strategy/calm-everyday-experience-contract.md`](../strategy/calm-everyday-experience-contract.md)
- Progressive disclosure and AI/human review: [`../architecture/progressive-disclosure-ai-review-model.md`](../architecture/progressive-disclosure-ai-review-model.md)
- Zero-training acceptance: [`../qa/zero-training-product-acceptance-gate.md`](../qa/zero-training-product-acceptance-gate.md)

## Non-authorization

This ADR changes no code, renderer, style, fixture, schema, database, graph, source, provider, trust boundary, deployment, or external state. It does not authorize the recommended implementation slice.
