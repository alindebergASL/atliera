# Governance trust boundary — v3

Status: PROPOSED (2026-09-05). This document describes the bounded live-ceremony trust boundary. It does not authorize adoption or any effect.

## Protected-base enforcement

The workflow judges each pull request with the classifier, wrapper, ceremony verifier, tier map, decision schema, and identity allowlist from the protected base. Candidate changes to those files cannot alter the judgment of the same candidate. There is no bootstrap exception or administrator bypass. A governance repair can therefore remain blocked until an authentic independent adoption action establishes it as the protected base; this is an intentional consequence of enforcing the existing rules against the repair itself.

The candidate supplies only the diff, candidate governance map data for comparison, its effect declaration, immutable/frozen registries, and proposed decisions. The protected map still prices the change. Candidate map lowering/removal is refused without exception; the candidate cannot supply a live approval or review attestation. GitHub reviews are fetched by the protected workflow and checked against the exact candidate head.

## Authority boundary

A proposed decision states an exact decision, scope, and purpose. Its digest is recomputed from those fields. A matching GitHub approval must:

- identify an allowlisted owner account with a stable GitHub user id and `OWNER` association;
- be an `APPROVED` review of the exact candidate head;
- repeat the exact decision, scope, purpose, and proposal digest; and
- expose an immutable GitHub review id, URL, and timestamp.

Review events are reduced by pinned stable principal id in timestamp-and-event-id order. A later change request or dismissal clears that principal's earlier grants; a later approval can resubmit only the exact proposal it binds. Duplicate event ids, malformed chronology, identity tuple mismatches, and shared owner/reviewer ids fail closed. Missing identity evidence fails closed. A Tier-3 candidate also needs a distinct pinned technical reviewer and event. No genuine independently verified technical reviewer is currently available, so the protected list is intentionally empty and real Tier 3 remains on HOLD. No self-consistent candidate-only record can satisfy either requirement.

GitHub proves which account performed an action, not which human held the keyboard. An agent action using an owner's credential remains an agent act and is prohibited from qualifying, but this verifier cannot distinguish it from direct owner use. Credential custody and the owner's direct performance of the review are therefore the remaining operational identity trust root. This limitation must accompany any citation of a green ceremony result.

## Build, effect, and receipt separation

Build permission authorizes review and merge of bounded code; it does not authorize running an effect. When the committed effect declaration asserts an effect axis, a separate effect-permission proposal must name exactly those axes and receive its own matching external owner approval. Post-effect receipts describe what actually happened and can exist only after execution. They belong in a later audit projection and are not preconditions for merging code.

Provider execution and private-data handling keep their Tier-2 floors. Network/outbound, recurrence, durable write, identity/authorization, deployment, and customer effects keep Tier-3 floors. A false declaration voids the verification result.

## Offline presentation boundary

Pure offline presentation may live under `presentation/` at Tier 1. Evidence admission, lineage, generation/provider code, and effects remain under their existing Tier-2-or-higher paths. The classifier still takes the maximum across every matching rule and every declared effect, unknown paths remain Tier 3, and an effect declaration escalates presentation code normally. Tests enforce these examples; renderer corrections are outside this repair.

## Historical records

Frozen artifacts and historical v1/v2 decisions remain immutable. A separate historical validator may inspect their old shape, but its output is not accepted as live authority. New external events may later be projected into append-only audit records; that projection never becomes the approval source for the candidate it describes.

## Remaining bounded limitations

Guard weakening is author-declared and reviewed. Frozen supersession records are still validated only at their existing structural level. These limitations do not create a candidate-only approval path and are not expanded into a general anti-forgery framework here.
