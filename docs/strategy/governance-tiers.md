# Governance tiers v3 — risk-priced verification policy

Status: PROPOSED (v3, 2026-09-05). It carries no authority until an independently identifiable external owner review approves its exact candidate head and explicit proposal. Routed by the protected base, not by its own proposed pricing. Companions: `governance-tiers.json`, `governance-trust.json`, `decision-proposal.schema.json`, the historical `decision-record.schema.json`, the classifier/verifier, and focused behavioral tests.

## 1. Principle

Verification cost is priced to effect blast radius, and the price is **computed, not chosen**. A change's tier derives from (a) path-based conservative minimums and (b) a declared effect vector; the final tier is the maximum risk represented anywhere in the change. Prose never overrides the computed tier downward. This policy relaxes nothing where evidence is admitted or effects occur.

## 2. Effect vector

Every PR carries a machine-readable effect declaration as a committed root `change-risk.json` at the PR head — one channel, head-bound and immutable with the commit it describes. (PR-body declarations are not accepted: body text is mutable after review and unbound to a SHA.) All eight axes below are required as explicit booleans; a missing or partial declaration fails the check. Paths establish minimums; the vector and diff escalate; the classifier derives the tier.

```json
{
  "privateData": false,
  "providerExecution": false,
  "networkOrOutbound": false,
  "retryOrRecurrence": false,
  "durableWrite": false,
  "identityOrAuthorization": false,
  "deployment": false,
  "customerEffect": false
}
```

Axis → minimum tier: `providerExecution` and `privateData` → Tier 2; `networkOrOutbound`, `retryOrRecurrence`, `durableWrite`, `identityOrAuthorization`, `deployment`, `customerEffect` → Tier 3. **Provider execution is distinct from outbound effects**: a governed, budgeted provider/model call under the admission regime is Tier 2; customer-facing sends, publication, webhook/API effects, and any other external action are Tier 3. A false declaration discovered later voids the change's verification status and is itself an incident.

`change-risk.json` is priced **Tier 0** in the map, deliberately: a required declaration that escalated its own carrier would price every PR at Tier 3 and collapse the tier distinctions. When `main` moves and the declaration conflicts, the PR re-states it against the new head — the declaration describes the change, not the base.

## 3. Tiers and required ceremony

- **Tier 0 — descriptive prose.** Non-authoritative narrative only (§5). PR review + green CI.
- **Tier 1 — offline zero-effect product surfaces and fixtures.** CI + targeted safety tests + hash pin where pinned + one review. Pure presentation code lives under `presentation/`; it may not admit evidence, call providers, write durably, perform network operations, or produce customer effects. Any declared effect still escalates it.
- **Tier 2 — evidence, generation, and governance pricing.** Explicit budgeted authorization, per-call ledger, deterministic validation, lineage recording, canonical accounting per `generate-not-reconcile.md`. Includes this policy, its map, its classifier, and weakening of any test that guards a Tier 2 subject.
- **Tier 3 — effects.** Durable writes, ratification, outbound/customer actions, publication, deployment, identity/authorization changes, monitoring/recurrence/automation, infrastructure and CI workflow changes that can produce any of these. Full ceremony: exact-decision owner authorization naming the effect, external SHA-bound review attestation (§7), green CI on the exact head, effect receipts, authority markers.

## 4. Classification rules (implemented in the classifier, tested adversarially)

1. **Per-file tier** = max(all matching path-prefix minimums, declared-effect axis minimums). **Maximum across every matching prefix** — never first-match. Duplicate prefixes in the map are a load error.
2. **PR tier** = maximum per-file tier.
3. **Unmapped paths fail closed — always Tier 3.** An effect declaration can only raise a tier, never lower one; an all-false declaration on an unmapped path changes nothing. The remedy for an over-priced unmapped path is mapping it, which is itself a Tier 2 map change. (v2.1: the v2 all-false floor was removed after independent review showed it functioned as a bypass lever on unknown Tier-3-capable paths.)
4. **Guard inheritance**: a change that weakens a test, validator, or marker guarding a subject inherits the guarded subject's tier (adding assertions is Tier 1). Known limitation, stated plainly: weakening is declared by the author (`guardWeakening` in the declaration) — the classifier cannot semantically detect it. Two mitigations back the self-report: the CI wrapper flags any PR that *deletes* lines in `tests/safety/` for explicit reviewer attention, and confirming or refuting a guard-weakening declaration is a named duty of the PR's reviewer. An undeclared weakening discovered later voids the change's verification status, like any false declaration.
5. **De-escalation** (lowering or removing any rule minimum, axis minimum, or frozen registry) is detected mechanically by comparing candidate map data with the protected pricing map. Every detected lowering or removal is an explicit **HOLD** (exit 4). No candidate-authored acknowledgement or administrator bypass is consumed. There is no current live need for de-escalation; a future lowering requires a separately authorized gate designed and adopted before that candidate, not an exception embedded in the candidate being judged. Escalation may land at any tier.
6. **Frozen artifacts — hard refusal, not tiering.** Files listed in the frozen registries (artifact manifests and pinned-hash records) may not be edited, deleted, renamed, or re-hashed; the classifier reports any such change as a **violation** (CI fails), permissible only when the same change set **includes** the supersession record file under the supersession prefix — naming a record path in the declaration without committing the record is still a violation. Supersede, never rewrite.

## 5. Document authority classes

A file's format does not determine its authority. Prose under `docs/` is **non-authoritative by default**: it may describe, explain, and record history, but no prose statement changes status, eligibility, or authorization. Anything that *does* change what an operator may believe is allowed exists as a typed machine-readable record:

- **Descriptive** (retros' narrative, plans, ADR discussion, architecture notes): Tier 0.
- **Status/eligibility-changing** (dispositions, gate states, roadmap markers, CURRENT_STATUS fields): Tier 2, machine-readable, and — where the change is an owner decision — attested per §6.
- **Authorization-bearing** (provider budgets, effect authorizations): Tier 2 (provider) or Tier 3 (effects), machine-readable, owner-attested.

## 6. Proposed decisions and external authority

The candidate contains only schema-v3 `proposed` records. A proposal states its decision, scope, purpose, and a recomputed digest; it has no `boundSha`, ratification envelope, or authority. The protected workflow fetches the actual GitHub review event and requires it to bind the exact candidate head and repeat the proposal's exact decision, scope, purpose, and digest.

Build permission and effect permission are separate proposals. A Tier-2 code/evidence change needs build permission. A change declaring effects additionally needs an effect-permission proposal naming exactly those axes. A post-effect receipt is evidence produced only after an effect and is never a prerequisite for merging code that might later perform it; it belongs in a later audit projection.

**Agents may author proposals only.** The trust root is the protected `governance-trust.json` principal configuration plus GitHub's immutable review identity fields. Each principal pins a login, positive stable GitHub user id, and `User` type. Missing or mismatched identity evidence fails closed. The current technical-reviewer list is empty because no genuine independently verified reviewer identity is available, so real Tier 3 remains on HOLD. An agent action performed with an owner's credential is still an agent act and does not qualify, although GitHub cannot technically distinguish human use from delegated use of the same credential; preserving that credential boundary is an operational owner responsibility.

Historical v1/v2 records remain immutable historical evidence. The historical validator can inspect them, but its result is deliberately disconnected from live authority acceptance.

Proposal URI fields use strict absolute RFC3986 ASCII spelling: spaces, incomplete or non-hex percent escapes, and raw non-ASCII characters are refused rather than normalized. Proposal and review timestamps use a deliberately narrow RFC3339 subset with real calendar dates, seconds `00`–`59`, optional fractional seconds, and `Z` or numeric offsets. Leap seconds are outside this validator's supported subset. The shape-only historical validator shares that explicit runtime limitation; existing compatible historical records remain immutable and gain no live authority from validation.

## 7. Review binding (external attestations)

Binding review authority lives **outside the branch it judges**: a GitHub review or check run keyed to an immutable commit SHA. An in-repository review document is a historical record — it may state which SHA it examined, but committing it moves the head, so it can never be an exact-head attestation of its own branch. A review whose attested SHA is not the commit under decision is advisory only. Gate decisions cite the external attestation (reviewer, SHA, verdict), not a committed prose file.

## 8. CI wiring — two separate checks

Classification and ceremony are **distinct required checks**, and conflating them was a real defect in v2.1:

1. **`classify`** — `scripts/classify-pr.sh` reads the change set from `git diff --name-status -z <base>...HEAD` (NUL-delimited, so deletions are distinguishable and odd filenames are safe), loads the committed declaration, prices the PR with the protected map, independently loads the candidate map only as comparison data, and refuses frozen-artifact mutation or candidate rule lowering/removal. Exit codes propagate verbatim: `2` frozen violation, `3` declaration invalid, `4` candidate de-escalation HOLD, `5` invalid map or unsafe registry entry. **This check is classification only.** A green result means "the tier is N and nothing frozen was touched or de-escalated" — never "tier N's requirements were met".
2. **`ceremony`** — protected-base `verify-ceremony.ts`, schema, and identity policy consume candidate proposals plus reviews fetched from GitHub. Tier 2 requires a matching owner approval. Tier 3 retains a separate independently identified technical review; declared effects also require their own matching effect permission. Receipts are recorded after effects, outside candidate self-attestation. Exit `6` when evidence is missing or stale.

**Assurance scope (v3).** Candidate-only evidence cannot satisfy ceremony. The workflow resolves actual GitHub reviews, validates pinned principal login/id/type tuples, orders approvals and change requests by submission timestamp and event id, checks exact-head and explicit proposal bindings, and recomputes the proposal digest. `pulls.listReviews` exposes a dismissed review's original submission time but no dismissal-action time, so any relevant trusted-principal `DISMISSED` snapshot produces a conservative HOLD instead of a guessed chronology. Ordinary comments neither grant nor revoke authority. Review edits and dismissals trigger reevaluation. Its unavoidable trust limit is credential provenance: GitHub identifies the account, not whether its human owner or a delegated agent operated the credential.

Both jobs check out the **immutable PR head SHA**, never GitHub's synthetic merge commit, and fetch the pinned base separately for comparison. Every attestation in this system binds to the exact reviewed SHA; classifying a synthetic merge would bind the ceremony to a commit no one reviewed.

The workflow, classifier, verifier, schema, tier map, and identity policy are all read from the protected base when judging a PR. There is no bootstrap exception or administrator bypass. Consequently this repair PR is expected to remain blocked under the previously adopted verifier until an authentic independent adoption action establishes the new protected base; subsequent PRs are judged by these bytes.

## 9. Non-goals

No reduction of any Tier 2/3 requirement; no authorization of any call or effect; no retroactive application to closed milestones; no regeneration or reclassification of any frozen artifact.
