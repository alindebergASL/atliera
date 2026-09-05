# Governance tiers v2.3 — risk-priced verification policy

Status: PROPOSED (v2.3, 2026-09-05; supersedes the v1 draft held by independent review, ZIP `43ed052f…cde73`). Enters force only by an explicit owner decision recorded as a typed decision record (§6). Routed as a **Tier 2 change** — this policy prices verification, and changing verification pricing is never a documentation edit. Companions: `governance-tiers.json` (machine-readable), `scripts/classify-change-risk.ts` (classifier), `tests/safety/governance-tier-classifier.test.ts` (adversarial enforcement tests), `docs/plans/generate-not-reconcile.md` (v2).

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
- **Tier 1 — offline zero-effect product surfaces and fixtures.** CI + targeted safety tests + hash pin where pinned + one review.
- **Tier 2 — evidence, generation, and governance pricing.** Explicit budgeted authorization, per-call ledger, deterministic validation, lineage recording, canonical accounting per `generate-not-reconcile.md`. Includes this policy, its map, its classifier, and weakening of any test that guards a Tier 2 subject.
- **Tier 3 — effects.** Durable writes, ratification, outbound/customer actions, publication, deployment, identity/authorization changes, monitoring/recurrence/automation, infrastructure and CI workflow changes that can produce any of these. Full ceremony: exact-decision owner authorization naming the effect, external SHA-bound review attestation (§7), green CI on the exact head, effect receipts, authority markers.

## 4. Classification rules (implemented in the classifier, tested adversarially)

1. **Per-file tier** = max(all matching path-prefix minimums, declared-effect axis minimums). **Maximum across every matching prefix** — never first-match. Duplicate prefixes in the map are a load error.
2. **PR tier** = maximum per-file tier.
3. **Unmapped paths fail closed — always Tier 3.** An effect declaration can only raise a tier, never lower one; an all-false declaration on an unmapped path changes nothing. The remedy for an over-priced unmapped path is mapping it, which is itself a Tier 2 map change. (v2.1: the v2 all-false floor was removed after independent review showed it functioned as a bypass lever on unknown Tier-3-capable paths.)
4. **Guard inheritance**: a change that weakens a test, validator, or marker guarding a subject inherits the guarded subject's tier (adding assertions is Tier 1). Known limitation, stated plainly: weakening is declared by the author (`guardWeakening` in the declaration) — the classifier cannot semantically detect it. Two mitigations back the self-report: the CI wrapper flags any PR that *deletes* lines in `tests/safety/` for explicit reviewer attention, and confirming or refuting a guard-weakening declaration is a named duty of the PR's reviewer. An undeclared weakening discovered later voids the change's verification status, like any false declaration.
5. **De-escalation** (lowering or removing any rule minimum, axis minimum, or frozen registry) is detected mechanically by comparing the base branch's map with the PR's. It is priced at **the current tier of the affected rule, never below Tier 2**, and blocks the check (exit 4) until an owner acknowledgement at `docs/decisions/deescalation-ack.json` — a ratified, owner-attested decision record that names each detected de-escalation by kind and subject — accompanies it. A proposed-but-unratified record does not authorize; neither does one naming a different subject. Escalation may land at any tier.
6. **Frozen artifacts — hard refusal, not tiering.** Files listed in the frozen registries (artifact manifests and pinned-hash records) may not be edited, deleted, renamed, or re-hashed; the classifier reports any such change as a **violation** (CI fails), permissible only when the same change set **includes** the supersession record file under the supersession prefix — naming a record path in the declaration without committing the record is still a violation. Supersede, never rewrite.

## 5. Document authority classes

A file's format does not determine its authority. Prose under `docs/` is **non-authoritative by default**: it may describe, explain, and record history, but no prose statement changes status, eligibility, or authorization. Anything that *does* change what an operator may believe is allowed exists as a typed machine-readable record:

- **Descriptive** (retros' narrative, plans, ADR discussion, architecture notes): Tier 0.
- **Status/eligibility-changing** (dispositions, gate states, roadmap markers, CURRENT_STATUS fields): Tier 2, machine-readable, and — where the change is an owner decision — attested per §6.
- **Authorization-bearing** (provider budgets, effect authorizations): Tier 2 (provider) or Tier 3 (effects), machine-readable, owner-attested.

## 6. Owner decision records (v2.2: externally ratified, append-only)

An owner decision exists **only** as a typed record conforming to `decision-record.schema.json` v2. v1 permitted a schema-valid record whose owner identity and attestation were self-asserted free text — that validated a snapshot, not authority. v2 requires a **ratification envelope**: a verified external event (a GitHub merge or review approval under the owner's own identity) carrying an immutable event URL and id, the owner identity, the **proposal digest** (SHA-256 over the canonicalized decision text), and the **subject SHA** — with the envelope's digest and SHA required to equal the record's own. Because ratification binds the digest, the decision text cannot change after ratification without invalidating the envelope.

Records are **append-only**: `proposed` (authored by anyone, including an agent; confers no authority) → `ratified` (envelope attached; the only authoritative state) → `superseded` (replaced by a later record through explicit `supersedes`/`supersededBy` linkage). A record is never edited in place, and `proposed` records may not carry a ratification envelope at all.

**Agents may author records only in `proposed`.** A decision record derived from advisory analysis, however faithful, carries no authority until ratified. Advisory briefs, recommendations, and "balance of evidence" conclusions are never dispositions.

Decisions made before v2 — notably the 2026-09-04 C2 disposition, ratified under v1 semantics — are carried forward with an explicit `grandfathered` block naming the original record. They keep their historical authority and are **not** retroactively reinterpreted; new decisions may not use that field.

## 7. Review binding (external attestations)

Binding review authority lives **outside the branch it judges**: a GitHub review or check run keyed to an immutable commit SHA. An in-repository review document is a historical record — it may state which SHA it examined, but committing it moves the head, so it can never be an exact-head attestation of its own branch. A review whose attested SHA is not the commit under decision is advisory only. Gate decisions cite the external attestation (reviewer, SHA, verdict), not a committed prose file.

## 8. CI wiring — two separate checks

Classification and ceremony are **distinct required checks**, and conflating them was a real defect in v2.1:

1. **`classify`** — `scripts/classify-pr.sh` reads the change set from `git diff --name-status -z <base>...HEAD` (NUL-delimited, so deletions are distinguishable and odd filenames are safe), loads the committed declaration, computes the tier, and refuses frozen-artifact mutation. Exit codes propagate verbatim: `2` frozen violation, `3` declaration/ack invalid, `4` unauthorized de-escalation, `5` invalid map or unsafe registry entry. **This check is classification only.** A green result means "the tier is N and nothing frozen was touched" — never "tier N's requirements were met".
2. **`ceremony`** — `scripts/verify-ceremony.ts` takes the computed tier and the exact head SHA and validates the evidence that tier requires: a ratified, owner-attested decision record bound to that SHA (Tier 2+), plus an external SHA-bound review attestation with a PASS verdict and, where the declaration asserts effects, an effect receipt (Tier 3). Exit `6` when evidence is missing.

**Assurance scope (v2.3, bounded deliberately).** The ceremony check verifies the *internal consistency of committed evidence*: schema-v2 shape, exact 40-hex SHA equality, cross-field digest/subject equality, and receipts demanded by the committed declaration. It does **not** resolve the claimed GitHub event live, validate owner identity against an allowlist, or recompute the proposal digest from a normative canonicalization — so it does not defend against an author with write access who fabricates self-consistent evidence. That class is deferred with named re-entry triggers in `governance-threat-model.md`, which must be read before any green ceremony result is cited as assurance. Every verifier result carries this scope in its output.

Both jobs check out the **immutable PR head SHA**, never GitHub's synthetic merge commit, and fetch the pinned base separately for comparison. Every attestation in this system binds to the exact reviewed SHA; classifying a synthetic merge would bind the ceremony to a commit no one reviewed.

**Adoption routing (v2.2 correction).** PR tier is the maximum across files, and `.github/workflows/` is Tier 3 — so a Tier-3 workflow cannot "ride" inside a Tier-2 PR, as v2.1 proposed. Adoption is therefore **two PRs**: (1) policy, map, schema, classifier, ceremony verifier, and tests — Tier 2; (2) the workflow bootstrap that activates enforcement — Tier 3, with its own owner authorization and external SHA-bound attestation. The order matters: the enforcing machinery must exist and be reviewable before the check that runs it is armed.

## 9. Non-goals

No reduction of any Tier 2/3 requirement; no authorization of any call or effect; no retroactive application to closed milestones; no regeneration or reclassification of any frozen artifact.
