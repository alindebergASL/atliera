# Phase 0 Retro and M5 Wording Drift

## Provenance header

- **Source:** Phase 0 close-out (PR #267, merged `f2397fc`) and the M5-wording-drift diff requested by the operator on 2026-06-12.
- **Channel:** chat-side, reports-only. Verification packet referenced below was produced from the local repo at `f2397fc`.
- **Reported vs. inspected:** the M5-wording diff in §3 was inspected directly against the committed text of `docs/reviews/big-picture-review-2026-06-11.md` and `docs/strategy/roadmap.md` at HEAD of the PR carrying this file. The done-criteria mapping in §2 was inspected against `docs/strategy/mcp-and-skills-direction.md` §7 and ADR 0003. The CI numbers cited are as reported by the reviewer; the PR for this change also re-runs them as part of its own verification packet.

## 1. Phase 0 close-out

### 1.1 What shipped (per `f2397fc`)
- ADR 0003 — system capabilities over MCP; skills as instructions.
- Three tripwire tests: `test_model_transport_flags_pinned_false`, `test_no_capability_descriptor_in_model_payload`, `test_no_third_party_skill_load_path`.
- Forbidden-phrase lint (`tests/safety/forbidden-phrases.test.ts`) with the fixed two-path allowlist (memo + ADR) plus an `allowlist_remains_exactly_two_paths` companion test.
- `CONTRIBUTING.md` with the normative vocabulary section and the reference rule.
- `docs/strategy/roadmap.md` as the in-repo source of truth for the milestone chart.
- `docs/reviews/big-picture-review-2026-06-11.md` committed verbatim as frozen historical context.

### 1.2 Status flip authority
The roadmap flip from 🔶 to ✅ on Phase 0 is authorized by:

| Authority | Evidence |
| --- | --- |
| Merge commit on `main` | `f2397fc` (PR #267) |
| Green tests by name | `test_model_transport_flags_pinned_false`, `test_no_capability_descriptor_in_model_payload`, `test_no_third_party_skill_load_path`, and `allowlist_remains_exactly_two_paths` — all named in ADR 0003's invariant table |
| Full CI | 1,161 / 0 (135 suites) at `f2397fc`; GitHub CI on PR #267 SUCCESS |
| Done-criteria mapping (memo §7 Phase 0) | see §1.3 below |

Reviewer sign-off is **not** an authority on this flip; reviewer notes are recorded in `docs/reviews/hermes-mcp-skills-direction-review-2026-06-12.md` but the flip stands on the merge + named tests + done-criteria mapping. (The verification packet for the PR carrying this retro re-runs the same checks; if any disagreement surfaces at that time, this file is updated in the same PR.)

### 1.3 Done-criteria mapping (memo §7 Phase 0)
The memo's Phase 0 done-criteria are: ADR merged; tripwire tests green and wired into the suite; forbidden-phrase lint in CI; vocabulary section in contributor docs; an approval surface for the successor named.

| Criterion | Artifact at `f2397fc` |
| --- | --- |
| ADR merged | `docs/adr/0003-system-capabilities-over-mcp-skills-as-instructions.md` (Accepted) |
| Tripwire tests green and wired | three test files in `tests/safety/` named in §1.2; pass alongside the 1,161-test suite |
| Forbidden-phrase lint in CI | `tests/safety/forbidden-phrases.test.ts` with the fixed two-path allowlist |
| Vocabulary section in contributor docs | `CONTRIBUTING.md` §"Vocabulary (normative — ADR 0003)" |
| Successor approval surface named | ADR 0003 §"Invariants and enforcement" and `roadmap.md` H-track name H2 (registry + execution records, between M3 and M4) and its preconditions |

Each row is satisfied at `f2397fc`. The flip is unblocked.

## 2. Roadmap rule additions (recorded here for the audit trail; see `roadmap.md` for the live text)

Two rules adopted in the same PR as this retro:

1. **Default sequence:** M3 → M5a (loop proof, curated public sources) → M4 (own capstone) → M5b (does-its-job-once, system-acquired sources). Any reordering carries the burden of proof — the alternative must explicitly justify why the curated loop proof would *not* suffice as the doctrine-loop capstone, or why the M4 risk class is required before the durable ratification path closes. The roadmap's open-decision entry for M4-before-M5 vs. curated-source-M5 is resolved into this default; the reordering question remains open as "burden of proof on the challenger."
2. **H-track freeze:** the entire H-track (H1–H5 and A3) is frozen until M3 ships. The freeze is lifted only at the M3 retro. The substantive justification is the sequencing risk named in the reviewer notes and acknowledged in the direction memo's "M3 needs none of this and should not wait."

## 3. M5 wording drift against the frozen big-picture review

The frozen review's M5 paragraph reads (inspected against `docs/reviews/big-picture-review-2026-06-11.md`):

> **M5 — One real account, end-to-end ("Atliera does its job once")**
> The capstone: pick one real account → system fetches 3–5 public sources (M4) → model proposes excerpts/claims/objects against stored text under a fresh bounded approval (the live-proof machinery, now with real input) → validators disposition every record → human ratifies a subset (M3) → Workshop renders the account from durable state with honest trust labels.
> *Visible artifact:* a shareable Workshop account page about a real company, every claim traceable to a stored source, every unverified item labeled.

The roadmap's prior M5 row read:

> **M5 — One real account, end to end** (system-acquired sources → model proposals → validation → human ratification → Workshop renders from durable state)

### 3.1 Drift before this PR
The two texts were directionally aligned: both placed system-acquired sources inside M5, both invoked M4 as the upstream. The frozen review names a "shareable Workshop account page" as the visible artifact; the prior roadmap row did not name a visible artifact at all. **Minor drift:** the visible artifact wording fell out of the chart on its move into the table form.

### 3.2 Drift introduced by this PR
The roadmap now splits M5 into **M5a (loop proof, curated public sources)** and **M5b (does-its-job-once, system-acquired)**, with M4 reasserted as its own capstone between them. This is a **deliberate divergence** from the frozen review, not an accidental one. The frozen review treated M5 as a single capstone with system-acquired sources baked in; this PR ratifies a sequencing change that:

- assigns the **doctrine-loop proof** to M5a using curated public sources (the loop runs in full, but the acquisition surface is held out),
- assigns the **acquisition capstone** to M4 (its own visible artifact, its own success/failure verdict, its own retro),
- assigns the **"does-its-job-once" milestone** — the original M5 framing — to M5b, after M4 closes.

The substantive driver is the sequencing risk recorded in §2 above and `hermes-…-review-2026-06-12.md` §8: coupling the doctrine-loop proof to the new M4 risk class at the same moment robs each milestone of an isolable failure mode and risks letting M4 scope-creep delay the loop proof indefinitely. Splitting them gives each capstone its own definition of done.

### 3.3 Frozen review treatment
The frozen review remains frozen — it is historical context, not a living chart. The drift is recorded here so that any future reader following a citation from the frozen review to the live chart understands that the M5 milestone the frozen review describes is **what the live chart now calls M5b**, that the frozen review's M5 visible artifact ("shareable Workshop account page about a real company") is **carried forward to M5b**, and that **M5a is new** and reflects the loop-proof-first decision recorded here.

If the reordering challenge of §2 ever succeeds and the default sequence collapses back into a single M5, this file is the audit trail that explains the round trip.

## 4. Open items rolled forward to the M3 retro

- Whether the burden of proof on reordering (§2.1) was challenged during M3 and, if so, the outcome.
- Whether the H-track freeze (§2.2) should lift in full, in part (e.g., H1 approvals-as-data only), or remain in place for another milestone.
- Whether M5a's "curated public sources" set should be authored before or during M5a's execution slice, and whether it carries its own custody/legal review beyond what the public-curated proposal fixtures already established.
