# C2 closeout — PR #316 owner disposition: HOLD (bounded fix pass)

Date: 2026-09-04 · Decision owner: Andrew Lindeberg · Context: PR #316 "Close governed account-intelligence milestone", reviewed at head `b8e34ba` against the combined C2 owner content review surface (uncommitted 2026-08-30 draft, SHA-256 `894e02b402ac69b18e2a7ae28177ba00d133813176324e0cac4ad634fdae311a`). This record previously lived in the owner's project workspace; it is committed here so the repository audit trail carries the disposition itself, not only the fix pass that implements it.

## Decision

PR #316 is substantively sound; the reviewed head is **HOLD** pending a narrow documentation/audit fix pass. Three independent, isolated reviews (fresh-eyes content, naive-reader standalone comprehensibility, PR-contextual with repository access) found no evidentiary contradiction and no unsafe product effect. The gap is packaging and workflow legibility: no broad rewrite, no new research cycle, no evidence or lineage change.

## Merge gates

1. **Define the mixed-head limitation in plain language** in the review surface and retro: which FedEx inputs came from different heads, the resulting uncertainty, and that merging records the limitation rather than curing lineage.
2. **Reconcile the 4/4 provider budget explicitly.** Resolved at source by `FRESH_EXECUTION_RESULT.md`: the budget counts authorizations — one FedEx validated call, one University of Utah output rejected by deterministic validation, one final University of Utah validated call, and one earlier University of Utah operational reservation that failed before provider import (no model call executed). Per-account footers count selected-output calls only.
3. **Put the combined review surface inside the audit chain**: commit the exact surface the owner reviews and pin its SHA-256 externally in `CURRENT_STATUS.json` and the closeout retro (no self-referential hash). The two fresh per-account artifacts remain the authoritative frozen artifacts, byte-for-byte unchanged.
4. **Separate execution status from owner disposition**: C2 execution complete · owner disposition pending · C3 eligibility blocked pending an explicit Continue. "Shipped" records execution completeness only, never content approval.
5. **Verify the final exact head**: CI green on the integrated SHA and a fresh independent exact-diff PASS on that same SHA. Anything pending, stale, or differently bound remains HOLD.

## Additional review-surface corrections (no regeneration of frozen artifacts)

Self-containment layer (what Atliera is; C2/C3/owner; admitted/controller-authorized; budget notation; hash lines; Workshop; reply channel and the exact effect of Continue); "Exact support" relabeled "Related evidence context" in interpretation/question/action dialogs; first-person 10-K prose quoted and attributed; the headerless Responsible AI table-row excerpt annotated without inventing column labels; a numeric-tension note for one-third of $60M (≈$20.0M) vs the $19.6M H.B. 265 target vs the ≈$18.33M sum of listed reinvestment lines; the why-it-may-matter line surfaced on mobile; distinct accessible names on evidence controls; coverage boilerplate collapsed so gap rows dominate; CSP hashes kept valid.

## Note-and-carry (not blockers)

Frozen-artifact nits, carried without regeneration to preserve the hash freeze: a stray trailing quote in the "refined the FTE plan." excerpt; "Not established" publication/currency dates on the Redtail and UHAIV sources feeding the Utah thesis.

## Integration record

- The fix pass was first built as `738d05b` on `b8e34ba`; PR #316 meanwhile advanced to `d93c0f5` ("bind closeout review gates"), which replaced the six-question rubric with the canonical five bounded prompts (Useful, Grounded, Honest, Navigable, Worth continuing) and expanded the closeout safety gates. Independent review (asl_hermes_code) confirmed the fix-pass substance, held the `b8e34ba`-based patch as obsolete, and required semantic integration on the live head preserving the five-prompt contract and all newer gate assertions — no force-push.
- The integrated commit re-applies the fix pass on `d93c0f5`: the committed review surface renders the five bounded prompts in both account rubrics, the safety test retains every `d93c0f5` assertion and adds the status/disposition, ledger, and surface-pin assertions, and the surface lineage in `CURRENT_STATUS.json` records the reported prior five-prompt packet and the reviewed six-question draft with their roles and verification status.
- Gate 5 remains open until GitHub CI is green and an independent exact-diff PASS lands on the integrated SHA.

## Review provenance

Three isolated reviews run 2026-08-30 against the `894e02b4…e311a` draft. The PR-contextual review verified `fresh-university-of-utah.html` and `fresh-fedex.html` byte-for-byte against their cited SHA-256s and reconciled all load-bearing numbers against the closeout retro, `CURRENT_STATUS.json`, and `FRESH_EXECUTION_RESULT.md`. Independent verification of the fix pass (asl_hermes_code, 2026-09-04) ran full local CI (2,137 passing) on the reconstructed `b8e34ba`-based tree and validated wrapper CSP hashes, accessibility names, dialog behavior, frozen-artifact hashes, and the closed 4/4 ledger before holding the patch for re-basing.
