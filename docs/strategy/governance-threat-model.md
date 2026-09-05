# Governance threat model — what the v2.3 controls do and do not defend against

Status: PROPOSED (2026-09-05, revised v2.3.2), ships with governance v2.3.2. Tier 2 (it defines the assurance boundary the ceremony check claims). Read this before citing any governance check as assurance.

## Why this document exists

Three consecutive adoption reviews found real defects, and the last one found a class of finding the earlier ones did not: not "this control is broken" but "this control cannot work as designed without infrastructure that does not exist yet." Those findings are correct and they are not going to be closed by another revision of the same shape. Writing the boundary down converts an open-ended hardening loop into a stated position with named re-entry conditions — which is what a threat model is for.

**Atliera is in development. It has never shipped, has no external users, and produces zero durable, outbound, deployment, or customer effects.** Every governance control in this package protects *development-time evidence integrity*. None of them currently protects a production system, because there is not one.

## The adversary this package defends against

**In scope: the honest-but-fallible author, including agents.** Every failure this project has actually experienced belongs here:

- An agent derived an owner disposition from an advisory brief and packaged it with real CI and a real independent PASS (the PR #317 incident). Nothing was forged; an inference was recorded as a decision.
- A classifier "fix" unfroze every historically-registered artifact while its tests confirmed only the half the author had just changed (v2.1 P0-1).
- A frozen artifact could be renamed out of its own identity because the rename parser kept only the target (v2.2 P0-2).
- A registry could be deleted and take its frozen set with it (v2.2 P0-1).
- A verifier implemented v1 semantics against a v2 schema, so valid evidence failed and legacy-shaped evidence passed (v2.2 P0-3).

These are mistakes, drift, and inference-laundering — not attacks. They are also, empirically, what actually happens here. The v2.3 controls address them: fail-closed registries, both rename identities classified, schema-v2-only authority, receipts derived from the committed declaration, computed tiers, append-only decision records with agent authorship confined to `proposed`.

## The adversary this package does NOT defend against

**Out of scope for now: an author with write access who deliberately fabricates self-consistent evidence.** Concretely, all of these remain possible today:

1. **Forged ratification.** `verify-ceremony.ts` validates that a decision record is internally consistent and schema-v2 shaped. It does not resolve the claimed GitHub event, so a hand-written envelope naming a plausible reviewer, URL, and event id passes. *Closing it requires:* live GitHub API resolution of the event against an owner allowlist, repository, head SHA, and approval state.
2. **Unverified proposal digest.** The schema defines `proposalDigest` and the verifier enforces that the envelope's digest equals the record's, but the canonicalization is not normative and nothing recomputes the digest from the decision text. A self-consistent pair of wrong digests passes. *Closing it requires:* a normative canonicalization spec plus a recompute-and-compare validator.
3. **Exact-head ratification circularity.** An approval of head H0 cannot be committed into H0 — committing it creates H1. Today the record is committed as a follow-up and its `boundSha` points at the reviewed head, which means the evidence for H0 lives in a commit no one attested. *Closing it requires:* resolving approvals live from the forge rather than committing them into the tree.
4. **Content-free supersession.** Any non-deleted file under `docs/supersessions/` clears a frozen mutation, including an empty one. *Closing it requires:* a typed supersession record validating predecessor path/hash and successor path/hash.
5. **Branch-controlled verifier.** The workflow runs `verify-ceremony.ts` from the PR branch, so a PR can weaken the check that judges it. *Closing it requires:* running the verifier from protected `main` or an independently pinned action.
6. **Underpriced authorized de-escalation.** Acknowledging a Tier-3 rule lowering can leave the map change priced at Tier 2. *Closing it requires:* inheriting the current tier of every affected rule.

## Why deferring these is the right call today

Each of these is a *forgery* control: it defends against someone with commit access choosing to lie in a machine-checkable way. The repository has one human with commit access, who is the owner whose authority the controls protect, and the agents acting on his behalf whose failure mode — demonstrated repeatedly — is inference and drift, not fabrication. The in-scope controls catch that failure mode. The out-of-scope controls would catch a threat that does not presently exist, at a cost measured in the very thing that is scarce: cycles that have not yet gone to C3, the first slice a real seller would touch.

The honest accounting: three review rounds have produced steadily smaller defects (design → implementation → integration seams) while the product has produced zero new user-facing capability. Continuing to harden governance ahead of the risk it governs is itself a project risk, and it is the one currently materializing.

## Re-entry triggers — when the deferred class becomes mandatory

Close the deferred items **before** any of the following, not after:

- **Any Tier 3 effect becomes real**: the first durable write, publication, outbound send, deployment, or customer-visible action **occurring after this policy is activated**. Items 1, 2, 3, and 5 are prerequisites for the first Tier 3 adoption, because from that point ceremony evidence gates something that actually happens.
  *Prospective by construction (v2.3.1).* Triggers are evaluated from the moment the v2 policy is activated by an owner decision — not against history. Exactly one pre-activation decision exists and is exempt by name: the 2026-09-04 C2 owner disposition (`docs/decisions/c2-owner-disposition-record.json`, SHA-256 `b67cca34…160b`), ratified under v1 semantics before this schema existed. It is a **historical fact recorded in the repository**, not a machine-checkable authority path: the C2 milestone it governed is closed, and no future check needs to re-validate it. (v2.3.2 removed the `grandfathered` mechanism outright after it produced a bypass in each of its two revisions — a feature with no users generating its own defects.) The v2.3 wording read as though that historical ratification had already fired the trigger, which would have made the deferral self-cancelling on arrival; that was a drafting defect, not a change of position. **The first ratification of a NEW v2 decision does not itself fire any trigger** — ratification is the policy working, not an effect. The trigger is a real Tier 3 *effect*.
- **A second person or a non-owner-controlled agent gains commit access.** The "one honest owner" assumption is the load-bearing premise of this deferral; it expires the moment it stops being true. Items 1, 3, and 5 close first.
- **External users or customer data enter the system** (C5 identity, C6 first-user gate). All six, plus whatever the C5/C6 gates add.
- **Any governance evidence is cited outside the project** — to a customer, a partner, an auditor, or in security review. Evidence offered as assurance to a third party must actually be verifiable.
- **A frozen artifact is superseded for the first time** after activation. Item 4 closes before the first real supersession, not after.

Until one of those triggers fires, `verify-ceremony.ts` reports its assurance scope in every result (`internal consistency of committed evidence; live event resolution deferred`), and no one — reviewer, agent, or owner — may cite a green ceremony check as forgery-resistant assurance.

## Standing limitations (unchanged, restated)

Guard weakening is author-declared; a path classifier cannot semantically detect a weakened assertion. Mitigations: the wrapper flags deletions in `tests/safety/` for named reviewer attention, and undeclared weakening voids verification status like any false declaration.

## Review disposition

This document is the deliverable for the deferred half of the v2.2 review. A reviewer who disagrees with the deferral should say which trigger has already fired, or which in-scope failure the deferral leaves unaddressed — not re-report the deferred items as new findings.
