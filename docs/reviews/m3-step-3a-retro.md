# M3 Step 3a Retro (2026-06-15)

## Provenance header (standing format per `hermes-mcp-skills-direction-review-2026-06-12.md`)

- **Source:** M3 step 3a close-out (PR #271, merged as squash commit `91b7064` on `main`, head before merge `60f01f7`) and the operator's 2026-06-15 retro-ordering directive.
- **Channel:** chat-side, reports-only. Hermes's hardening pass and the subsequent verification packet were reported to chat; this entry is reasoned from that reported state plus the committed code on `main`.
- **Reported vs. inspected:** the trust-tier discipline, the eleven-path enumeration, the executor-side hardening, and the new system reminder confirmations from the post-merge `main` state were inspected against the committed code at `91b7064`. The pre-merge CI numbers (1,221 tests, GitHub CI SUCCESS on `60f01f7`) and Hermes's independent re-review verdict ("no must-fix findings") are as reported by the reviewer; this file does not independently re-run them. The gating instruction that 3b must not begin until this retro is committed is operator-direct.
- **Custody:** the five sections below are the operator's prescribed retro narrative ordering. Section 1 is the doctrinal headline; the executor-side hardening section follows; the proof-boundary framing replaces "proved the negative" with the snapshot-and-revalidate-at-entry property.
- **Forbidden-phrase convention for reviews:** this file uses no forbidden phrases. None of the five ADR-0003 phrases appears; the broken-form convention is not invoked.

## 1. Happy-path trust-tier correction — the headline

**Durable graph records now tell the truth about their own evidence status.** Before Hermes's fix, a legitimate write would have persisted records carrying `provenance_status: "verified"` inside a row whose row-level `trust_label` said `model-proposed-human-ratified-evidence-pending`. Two trust statements that disagreed. Anyone querying the durable graph after 3b lands would have rightly concluded those records were Verified, contradicting the admission story the row recorded.

This was a happy-path bug. It would have fired on every successful write. That makes it doctrinally worse than the adversarial-path issues in §2 — those bite only when something tries to break the system; this would have bitten when the system was working as designed. Restoring the trust-tier discipline before the first row was written is the substantive headline of step 3a.

The fix establishes a durable contract for the entire project, not just for 3a:

> **Row-level `trust_label` records how the row entered the durable store** — the admission path. In 3a's case: model-proposed and human-ratified, with evidence still pending.
>
> **Per-record `provenance_status` records what backs the graph record itself** — the evidence backing. In 3a's case: `source_document_only` (the records reference stored source text but have not been independently re-verified against fetched sources).
>
> **They may disagree only in the conservative direction.** A row admitted via human ratification may contain records whose per-record provenance is weaker than the admission path. The reverse is forbidden: a row may not contain records whose per-record provenance exceeds what its admission path supports.
>
> **M4 / M5b evidence re-verification may flip per-record `provenance_status` upward. M3 must not.** Step 3a is admission-by-ratification, not evidence verification. Verification — re-fetching sources, re-extracting excerpts, checking source content against claim spans — is what M4 (system-side acquisition) and M5b (end-to-end real run) are for.

The committed code at `91b7064` now enforces this in the durable bundle, and the happy-path test in `tests/workshop/proposal-durable-graph-write-execution.test.ts` asserts both directions: `row.trust_label === "model-proposed-human-ratified-evidence-pending"` and `row.bundle.claims.every((claim) => claim.provenance_status !== "verified")` and the same for `account_objects`.

## 2. Executor boundary hardening — the adversarial-path closures

Three real boundary-counterfeit bugs Hermes caught in his hardening pass, all of which lived on first-write paths where the executor code becomes load-bearing for the first time:

- **Idempotency-key suffix drift.** The executor originally accepted any `idempotency_key_shape` starting with `accountId:candidateId:`, trusting the suffix. The whole key is the unit of duplicate detection, so a changed suffix could mint a second key for the same logical write. The executor now requires the exact canonical suffix `:ratified-durable-write-v1`. Regression locked: a forged suffix refuses with no row written and no L0 marker.
- **Malformed `expires_at` reaching `getTime()` as `NaN`.** The arming module validates the timestamp at construction, but the executor was reading `arming.expires_at` and feeding it directly into `new Date(...).getTime() >= ...`. `NaN >= NaN` is `false`, which would have authorized writes under a corrupted arming. The executor now snapshots and revalidates `arming.expires_at` as canonical ISO at entry, before the comparison. Regression locked.
- **Proxy-backed artifact bypass via descriptor reflection.** The original snapshot path was getter-safe (`Object.getOwnPropertyDescriptors` does not invoke `get` traps) but it was not Proxy-safe: a Proxy can return faithful-looking descriptors while running arbitrary code in `getOwnPropertyDescriptor` and `ownKeys` traps. The executor now uses `util.types.isProxy` to reject Proxy-backed arming, contract, and approval-packet artifacts before any reflection runs. Regression locked: a Proxy-backed arming refuses before its traps fire.

In each case the lesson is the same one §3 generalizes: the *fact* of upstream construction does not guarantee that any individual field reaches the executor with its construction-time invariants intact. The executor must re-snapshot and revalidate every control-flow field at the trust boundary.

## 3. Proof boundary — stated honestly

> No known path flips the markers without a valid one-shot arming. The tested set is the **eleven adversarial paths now enumerated** (eight shipped in the original PR; three added by Hermes in the hardening pass). Because three of those paths were discovered after the original suite, the real generalizable safety property is not enumeration completeness; it is **snapshot-and-revalidate-at-entry for every control-flow field at the durable-write trust boundary.**

That is the honest claim. "Proved the negative" was overstated in the original PR description. The eleven-path enumeration is what we have; the discipline (snapshot+revalidate at entry, including Proxy refusal) is what we rely on to add the twelfth when we find it.

The eleven enumerated paths, for the audit trail:

1. arming kind invalid
2. arming lifecycle not armed
3. arming authorization marker missing
4. arming approval_id mismatch against packet
5. arming contract_artifact_id mismatch against contract
6. arming expired at call time
7. arming authorizes wrong candidate
8. arming already consumed against durable state
9. contract kind invalid / boundary broadened
10. graph bundle validation failed / materialization missing
11. durable DB unreachable / transaction aborted mid-write

The three Hermes additions live across these as: the **suffix-drift** path strengthens 4/5/6 by requiring exact-suffix idempotency; the **NaN-expiry** path strengthens 6 by re-snapshotting and revalidating the timestamp; the **Proxy-trap** path strengthens 1/2/3 by refusing accessor- and Proxy-backed artifacts before reflection.

## 4. Follow-up — H3 and the arming-module gap

Two items recorded here, both tracked back to the H-track once the M3 retro lifts the freeze:

- **`util.types.isProxy` becomes a mandatory requirement for the H3 consolidated snapshot primitive** (`src/safety/own-data-snapshot.ts`, currently frozen). It is not a nice-to-have; the executor-side Proxy bypass demonstrated that descriptor-snapshot discipline without `isProxy` is insufficient for trust-boundary inputs. PR #271 is the provenance citation.
- **The arming module's smaller-blast-radius Proxy exposure is recorded precisely.** The arming module (`src/workshop/proposal-durable-graph-write-operator-arming.ts`) still uses descriptor snapshot without `isProxy`. Its blast radius is smaller — it does not write to the durable store — and the executor-side write boundary is fully closed by the executor-entry snapshot+revalidate. A Proxy-backed arming therefore cannot reach the durable store via this stack. The gap is tracked for H3, with a possible small arming follow-up if the freeze lifts before H3 lands.

The npm audit baseline finding Hermes flagged at merge time is acknowledged and correctly scoped out of 3a. The H-track freeze still covers everything except M3 until 3b ships; a dedicated dependency-audit slice can be considered when the freeze lifts.

## 5. Reviewer provenance (standing format per PR #268)

- **Hermes:** inspected the tree directly. Spun up a worktree at the PR head, ran `npm ci`, the targeted suites, and full local CI on the final pushed head `60f01f7`. After the hardening amend, ran an independent re-review and returned no must-fix findings. **Inspected, not reported.**
- **Claude / Opus (this assistant):** the endorsements above are on **reported artifacts** — Hermes's diff summary, the test descriptions, and the doctrine implications. Wrote and shipped the original PR; did not independently re-run the post-amend test suite or fetch the post-amend tree before merge. Where this retro asserts a property of the code as it now stands on `main`, that assertion is on Hermes's report and on the committed code visible at `91b7064`, not on a fresh post-merge re-run of the full reject-path suite by this assistant.

This distinction is the same one the standing review-entry format names: a reviewer who inspects the tree is named as such; a reviewer who reasons over reported artifacts is named as such. Mixing the two would weaken the audit trail.

## What this retro gates

- **3b stays unstarted until this file is committed on `main`.** Per operator instruction.
- When 3b begins, it reads from `graph_snapshots.jsonl` and renders the ratified record under the `Unverified · Model-proposed · pending human review` decoration (per ADR 0003 §A2 / view-model `WORKSHOP_REVIEW_STATE_MODEL_PROPOSED`) using the per-record `provenance_status` written by 3a — which is `source_document_only`, not `verified`. The trust-tier discipline of §1 is now the durable contract 3b reads against.
- The H3 backlog gains the `isProxy` mandatory-requirement entry from §4 before the H-track freeze lifts.
