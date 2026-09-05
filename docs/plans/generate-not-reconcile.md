# Generate, don't reconcile — v2: event-derived accounting and forward-only projections

Status: PROPOSED (v2, 2026-09-04; supersedes the v1 draft held by independent review). Tier: **2** — it defines how Tier 2 accounting facts are stated. Companion policy: `docs/strategy/governance-tiers.md` (v2).

## What v1 got wrong (corrections adopted from independent review)

1. **v1 named two canonical sources.** `execution-ledger.json` and `CURRENT_STATUS.json` cannot both be canonical under the state-every-fact-once principle — and the existing `execution-ledger.json` is a *historical* C2 ledger (its `providerExecution.calls` records 8, not the fresh package's accounting) that is hash-pinned in `artifact-manifest.json` and can never become a mutable current ledger. v1 declared canonical a document it had not read. Corrected below.
2. **v1 proposed a parallel footer renderer.** `src/account-intelligence/account-home.ts:204–225` already renders surface footers from effect-receipt fields. v2 extends that renderer and its source contract; it introduces no second mechanism.
3. **v1's migration retro-fitted a closed milestone.** C2's closeout retro is closed; rewriting it into a living projection would re-open settled records. v2 is **forward-only**: generated accounting starts at C3; C2 documents get consistency *checks*, not regeneration.
4. **v1 mis-tiered its own migration** ("each PR Tier 1" while touching Tier 2 status and markers). v2 tiers are computed by the classifier: the PRs below are Tier 2.

## Canonical model: immutable events in, derived status out

Facts flow one direction:

```
authorization reservation (immutable event)
  → pre-provider failure | executed (immutable event)
      → rejected | selected (immutable event)
          → zero-effect / effect receipt (immutable document)
              → COMPUTED current status (derived, never hand-written)
                  → generated factual projections (retro blocks, roadmap markers, surface footers)
```

- **Canonical layer** = the immutable authorization, result, and receipt documents (for C2's fresh package: `FRESH_EXECUTION_AUTHORIZATION.md`/`fresh-execution` records, `FRESH_EXECUTION_RESULT.md`'s machine-readable successor, and the effect receipts). One gap to close going forward: the failed pre-provider reservation exists today only in prose — from C3 on, **every reservation is an event record**, including ones that never reach a provider, so the authorization-vs-executed distinction is computable instead of narrated.
- **`CURRENT_STATUS.json` becomes derived**: computed from the event/receipt inputs by a deterministic script, plus the owner-decision records (disposition, eligibility) that are its only non-event inputs. It is no longer a second hand-written source.
- **Projections** render from derived status inside `<!-- generated:… -->` markers: living retro accounting blocks (C3 onward), roadmap machine-readable markers, and surface footers — via the *existing* account-home footer renderer, whose source contract is extended to read the event-derived fields.

## Enforcement

- `scripts/render-governed-blocks.ts` — deterministic, **pure in check mode** (reads inputs, writes nothing, exits non-zero on any mismatch); `--write` mode exists only for local development.
- `tests/safety/generated-blocks.test.ts` — runs check mode against the committed tree; asserts registered markers appear exactly once; denylists canonical value-literals appearing outside generated blocks in registered files.
- `tests/safety/accounting-consistency.test.ts` — the C2 backstop: verifies the *immutable* C2 inputs (authorization, fresh result, receipts) agree with the *frozen* C2 status and prose values as recorded — a consistency check over history, never a rewrite of it.

## Migration (forward-only; tiers computed, all Tier 2)

1. **Event model + derived status** — define the reservation/execution/disposition event records; add the status-derivation script; convert `CURRENT_STATUS.json` maintenance to derivation with the C2 values as the frozen initial state; add the consistency test.
2. **Roadmap markers** — move machine-readable marker lines into a generated block rendered from derived status; existing marker assertions become drift-proof.
3. **C3 surfaces** — C3 is the first surface whose footers and budget lines render from the event-derived contract via the extended account-home renderer. C2's frozen surfaces, manifests, ledgers, and closed retro remain byte-for-byte untouched.

## What this does not do

No change to what is recorded, authorized, or admitted; no relaxation of any validator, budget, or effect boundary; no regeneration or reclassification of any frozen artifact or closed retro; no new authority. It moves the statement of recorded facts from hands to derivation, so reviewers verify events once instead of reconciling restatements.
