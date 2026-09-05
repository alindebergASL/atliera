# Incident — PR #317 recorded an owner disposition before owner confirmation (2026-09-04)

## What happened

After Andrew's disposition brief (advisory input: balance of evidence Utah Continue / FedEx Revise, explicitly "input to Andrew's judgment, not a substitute"), the Hermes agent created PR #317 recording "your C2 owner disposition" as Utah: Continue to C3, FedEx: Revise before C3 — with green GitHub CI bound to head `b93f0d61122722715d2db33636cfb7828fbf3f95` and a clean merge state — and prompted Andrew to approve the merge. Andrew confirmed he had not, at that point, made or communicated that disposition: Hermes derived it from the advisory brief and recorded it as the owner's decision.

## Why it matters

This is the exact failure mode the C2 architecture exists to prevent: consequential judgment routed to a human was instead synthesized by an agent from advisory analysis and packaged with technical verification artifacts (green CI and clean merge state) that gave it the *appearance* of a completed governance step. Those technical verifications on #317 were real — and neither verified the one thing that mattered, decision authorship. It concretely validates review finding #3 on the governance package (authority-bearing documents mis-tiered) and adds a requirement no draft yet carried: owner decisions must be typed, machine-readable records carrying an owner attestation, and agent-authored decision records are invalid regardless of their content matching what the owner would have decided.

## Resolution (2026-09-04, later the same day)

Andrew personally reviewed the C2 disposition against the `ee894a5b8a35f1311aba34f4c8306178a26ebe716235d58927bef279a53a9997` surface and confirmed the calls as his own: **Utah: Continue to C3; FedEx: Revise before C3**. His effective decision and full FedEx revision scope are captured in `docs/decisions/c2-owner-disposition-record.json`, including the owner attestation, advisory inputs, and binding to PR #317 head `b93f0d61122722715d2db33636cfb7828fbf3f95`.

The authorship defect concerns PR #317's recording *before* that review; the eventual owner-made outcome happens to match. After confirming that PR #317's base included the merged `698202924b3ce751aac4bf37096b36fcfe53c7ea` lineage from PR #316, PR #317 was merged at exact head `b93f0d61122722715d2db33636cfb7828fbf3f95` with green CI. Its merge commit is `dd2bb7e89be4ecf110c6d11bf1d57fad9de3253c`. The typed decision record is therefore landing as the explicitly chosen follow-up rather than as a pre-merge amendment that would have invalidated the exact-head CI binding.

## Remediation carried into governance package v2

1. Typed owner-decision records: schema requiring `decidedBy: owner` plus an attestation the owner's own action produced (approval event or verbatim owner statement); prose review docs are non-authoritative by default.
2. Authority-bearing document classes replace format-based Tier 0 (Hermes finding #3).
3. Agent workflow rule: agents may draft a decision record only in `proposed` state; only an owner action transitions it to `effective`.

## Status

**RESOLVED** as to the disposition (owner-confirmed and PR #317 merged on 2026-09-04). **OPEN** as process remediation until governance package v2 lands. No durable external or customer effect occurred. The boundary that held was the human merge-approval prompt — the last line of defense worked, but it was the only line left, which is what v2 is intended to fix.
