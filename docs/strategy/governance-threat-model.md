# Governance trust boundary — v3

Status: candidate transition (2026-09-06) under [standing development policy](standing-development-policy.md). This describes the candidate check, not completed adoption or new effect authority.

## Protected-base enforcement

The workflow judges each pull request with the classifier, wrapper, ceremony verifier, tier map, decision schema, and identity allowlist from the protected base. Candidate changes to those files cannot alter the judgment of the same candidate. No candidate-provided bootstrap exception or administrator bypass is consumed. The current user explicitly authorized the supported one-time adoption procedure documented in `standing-development-policy.md`; that procedure retains technical checks and independent review, records the obsolete ceremony failure honestly, and restores the requirement after adoption. It is not a general candidate-selectable exception.

The candidate supplies only the diff, candidate governance map data for comparison, its effect declaration, immutable/frozen registries, and proposed decisions. The protected map still prices the change. Candidate map lowering/removal is refused without exception; the candidate cannot supply a live approval or review attestation. GitHub reviews are fetched by the protected workflow and checked against the exact candidate head.

## Authority boundary

A proposed decision states an exact decision, scope, and purpose. Its digest is recomputed from those fields. Development already within authorized scope needs no new per-step human approval. Tier-2/3 builds instead require an externally published `COMMENTED` independent technical report, bound to the exact head and proposal. The existing owner account or an optional pinned technical-reviewer account may publish it. An agent report names its actual actor/model, distinct implementation and review execution contexts, evidence URI, coverage and verdict. Fresh same-family Astra review contexts are valid; they are not human approval or another model family. Missing or invalid report fields fail closed.

For a declared **effect permission**, a matching GitHub approval must:

- identify an allowlisted owner account with a stable GitHub user id and `OWNER` association;
- be an `APPROVED` review of the exact candidate head;
- repeat the exact decision, scope, purpose, and proposal digest; and
- expose an immutable GitHub review id, URL, and timestamp.

Review events are reduced by pinned stable publisher id in submission-timestamp-and-event-id order. A later change request clears that publisher's earlier grants; a later matching report supersedes its previous report (including a FAIL replacing PASS), and a later effect approval resubmits only the proposal it binds. The current `pulls.listReviews` snapshot does not expose dismissal time: a relevant trusted-principal `DISMISSED` record therefore produces a conservative HOLD, regardless of array order. Ordinary comments do nothing. Only explicitly marked technical `COMMENTED` reports count for builds; they cannot authorize effects. Duplicate event ids, malformed chronology, identity tuple mismatches and duplicate principals in configuration fail closed. No new identity enrollment or human account is required for technical review. No self-consistent candidate-only record satisfies the external evidence requirement.

Decision reference URIs must already be legal absolute RFC3986 ASCII spellings; the verifier does not repair spaces, bad percent escapes, or raw non-ASCII characters through WHATWG normalization. Timestamps use the documented non-leap-second RFC3339 subset with seconds `00`–`59`, optional fractional seconds, and `Z` or numeric offsets. The shape-only historical validator has the same explicit runtime limitation while remaining disconnected from live authority.

GitHub proves which account published a review, not which human held the keyboard, whether an independent context executed, or whether linked evidence supports the verdict. Technical actor/model/context/coverage fields are attributed claims, not authenticated execution. The integrator must inspect actual reports and evidence; the checker does not fetch linked contents or judge semantic quality. An agent using owner credentials must identify itself honestly; publishing an agent technical report is allowed, impersonating human approval is not. Effect approval retains its operational credential-custody and owner-action boundary. These limits accompany every green ceremony claim.

## Build, effect, and receipt separation

Standing build authority permits implementation, testing, independent review, fixes and merge of already authorized bounded code without routine human checkpoints; it does not authorize running an effect. When the committed effect declaration asserts an effect axis, a separate effect-permission proposal must name exactly those axes and receive its own matching external owner approval. Post-effect receipts describe what actually happened and can exist only after execution. They belong in a later audit projection and are not preconditions for merging code. Budget caps and ledgers remain unchanged.

Provider execution and private-data handling keep their Tier-2 floors. Network/outbound, recurrence, durable write, identity/authorization, deployment, and customer effects keep Tier-3 floors. A false declaration voids the verification result.

## Offline presentation boundary

Pure offline presentation may live under `presentation/` at Tier 1. Evidence admission, lineage, generation/provider code, and effects remain under their existing Tier-2-or-higher paths. The classifier still takes the maximum across every matching rule and every declared effect, unknown paths remain Tier 3, and an effect declaration escalates presentation code normally. Tests enforce these examples; renderer corrections are outside this repair.

## Historical records

Frozen artifacts and historical v1/v2 decisions remain immutable. A separate historical validator may inspect their old shape, but its output is not accepted as live authority. New external events may later be projected into append-only audit records; that projection never becomes the approval source for the candidate it describes.

## Remaining bounded limitations

Guard weakening is author-declared and reviewed. Frozen supersession records are still validated only at their existing structural level. These limitations do not create a candidate-only approval path and are not expanded into a general anti-forgery framework here.
