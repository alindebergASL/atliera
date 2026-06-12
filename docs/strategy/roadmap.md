# Atliera Roadmap (living)

Status: living document. This file is the **in-repo source of truth for the milestone chart**. Other documents — including ADR 0003 and the direction memo — reference this file and must not restate the chart. When milestone status changes, update this file in the same PR as the change.

Origin: the chart was first drawn in `docs/reviews/big-picture-review-2026-06-11.md`, committed verbatim as **frozen historical context**. Where that review and this file disagree, this file wins.

Boundary markers (this document authorizes nothing):

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_graph_ingestion: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Doctrine spine

Agent proposes → system validates → human ratifies → durable state. Every milestone below is measured by its distance to **the doctrine-loop proof (M5a)** and the **does-its-job-once milestone (M5b)**; every milestone must end with a named visible artifact plus the approval surface for its successor.

### Default sequence (burden of proof on reordering)

The default product-track sequence is:

**M3 → M5a (loop proof, curated public sources) → M4 (acquisition capstone) → M5b (does-its-job-once, system-acquired sources).**

Any reordering carries the burden of proof: the alternative must explicitly justify why the curated loop proof would not suffice as the doctrine-loop capstone, or why the M4 risk class is required before the durable ratification path closes. The earlier open decision (M4-before-M5 vs. curated-source M5) is resolved into this default; the reordering question remains open as *burden of proof on the challenger*. The substantive justification and the M5-wording drift this introduces are recorded in `docs/reviews/phase-0-retro-and-m5-drift.md`.

### H-track freeze

The entire H-track (H1–H5 and A3) is **frozen until M3 ships**. The freeze is lifted only at the M3 retro. The substantive justification is the sequencing risk recorded in `docs/reviews/hermes-mcp-skills-direction-review-2026-06-12.md` §7 and in the direction memo's *"M3 needs none of this and should not wait."* No H-track slice may begin or be planned for in detail while this freeze is in effect.

## P-track (product loop)

| Milestone | Status | Anchor |
| --- | --- | --- |
| **M1 — Proposal materialization contract** | ✅ shipped | `b328d72`; `src/validation/proposal-materialization.ts` |
| **M2 — Curated proposal renders in Workshop** (pending-review decoration on `unverified`) | ✅ shipped | `db24672`; `src/workshop/proposal-preview.ts` |
| **M3 — Ratification closes the doctrine loop** (human accept/reject as AuditEvent; first durable graph write of a ratified record; rejections preserved with reasons) | 🔶 in progress | `db86d0f`; `src/workshop/proposal-review-decision.ts`, `src/workshop/proposal-ratification-plan.ts` |
| **M2.5 — Prompt contracts → SKILL.md instruction packages** (execution affordances structurally stripped; loader rejection tests; `mode: "placeholder"` retired) | ⬜ not started; **H-track-frozen until M3 ships** | ADR 0003 A2; direction memo §6 |
| **M5a — Doctrine-loop proof, curated public sources** (curated public GraphBundle → model proposals → validation → human ratification → durable graph write → Workshop renders from durable state; visible artifact: a real-account-looking Workshop page rendered entirely from durable state without any system-acquisition path being exercised) | ⬜ not started | sequencing decision recorded in `docs/reviews/phase-0-retro-and-m5-drift.md` |
| **M4 — Evidence acquisition v1** (deterministic system-side fetcher as the first orchestrator-held MCP integration; allowlisted, sandboxed, provenance-tagged; adversarial injection corpus in definition of done; L0+L1 only; **its own capstone, its own visible artifact and retro — not co-shipped with any M5 milestone**) | ⬜ not started | ADR 0003 A1; direction memo §7 |
| **M5b — Does-its-job-once, system-acquired sources** (the original capstone framing carried forward from the frozen big-picture review: pick one real account → system fetches public sources via M4 → loop runs → Workshop renders durable state with honest trust labels; visible artifact: a shareable Workshop account page about a real company, every claim traceable to a stored source, every unverified item labeled) | ⬜ not started | originates as the frozen review's M5; see `phase-0-retro-and-m5-drift.md` §3 |
| **M6 — Identity + lab deployment** (Team/User/membership; auth in front of Workshop; lab target executed under existing deployment contracts; Gate 3 lands here, in service of M5b's artifact) | ⬜ not started | `docs/BLOCKERS.md` Gate 3 |
| **M7 — Gate 4 corpus + first external users** (launch-gate corpus on real accounts; quantitative bars evaluated honestly; first users admitted per the original gating plan) | ⬜ not started | `docs/BLOCKERS.md` Gate 4 |

Recurrence/change detection deliberately sits after M7.

## H-track (harness/kernel; parallel, never blocking the P-track; **FROZEN until M3 ships**)

| Slice | Status | Notes |
| --- | --- | --- |
| **Phase 0 — ADR 0003 + tripwire tests + forbidden-phrase lint + vocabulary in contributor docs + this roadmap** | ✅ shipped (`f2397fc`, PR #267) | Authority for this flip: merge commit, the four named green tests (`test_model_transport_flags_pinned_false`, `test_no_capability_descriptor_in_model_payload`, `test_no_third_party_skill_load_path`, `allowlist_remains_exactly_two_paths`), and the done-criteria mapping in `docs/reviews/phase-0-retro-and-m5-drift.md` §1.3 — not reviewer sign-off. |
| **H1 — Approvals as typed data** (lifecycle drafted → merged → operator-armed → consumed/expired; machine-checked counters; wraps capability descriptors by hash per ADR 0003 I-5) | ⬜ frozen until M3 ships | the first machine-checked approval should be M5a's |
| **H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension** | ⬜ frozen until M3 ships | first registered capability is a no-op echo server proving the choke point; lands between M3 retro and M4 |
| **H3 — Snapshot-primitive consolidation + negative-control automation** | ⬜ frozen until M3 ships | `src/safety/own-data-snapshot.ts`; every doc-contract test ships a violating fixture it must fail on |
| **H4 — Single guarded execution entrypoint** | ⬜ frozen until M3 ships | one chokepoint so future executions cannot skip a check |
| **H5 — Harness extraction assessment** | ⬜ frozen until M3 ships | a decision, not a commitment; post-M5b decision point |
| **A3 — Outward-facing read-only MCP server over the verified graph** | ⬜ frozen; spec-only deferred until post-M5b | ADR 0003 A3 |

## Open operator decisions (annotated, not resolved)

These are the operator's calls, recorded here so the chart carries them visibly. Per the direction memo §11:

1. **Fork vs. build** for the M4 fetch server — comparison with audit-cost estimates to be presented at H2 completion (after the M3 retro lifts the H-track freeze).
2. **Fetched-content legal posture** (robots.txt, takedown workflow, retention) — M4 must surface a concrete proposal; the decision is not Claude Code's to make.
3. **M4-before-M5 vs. curated-source M5** — **RESOLVED INTO DEFAULT SEQUENCE** (above). The default is M3 → M5a → M4 → M5b. The reordering question remains open as *burden of proof on the challenger*; revisit at the M3 retro.
4. **ADR numbering/title** — resolved: ADR 0003.
5. **A3 timing** — whether the outward server is M7-adjacent or later.

## Maintenance rules

- Status values: ✅ shipped · 🔶 in progress · ⬜ not started. Cite the merge commit or module path as the anchor when flipping a status.
- A milestone is not "shipped" without its named visible artifact and its successor's approval surface (the done-pattern).
- Documents must reference this chart, not copy it. Anything this repo's docs reference must live in-repo or be explicitly marked external-and-nonbinding (see `CONTRIBUTING.md`).
