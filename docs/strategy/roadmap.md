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

Agent proposes → system validates → human ratifies → durable state. Every milestone below is measured by its distance to **M5** (one real account, end to end), and every milestone must end with a named visible artifact plus the approval surface for its successor.

## P-track (product loop)

| Milestone | Status | Anchor |
| --- | --- | --- |
| **M1 — Proposal materialization contract** | ✅ shipped | `b328d72`; `src/validation/proposal-materialization.ts` |
| **M2 — Curated proposal renders in Workshop** (pending-review decoration on `unverified`) | ✅ shipped | `db24672`; `src/workshop/proposal-preview.ts` |
| **M3 — Ratification closes the doctrine loop** (human accept/reject as AuditEvent; first durable graph write of a ratified record; rejections preserved with reasons) | 🔶 in progress | `db86d0f`; `src/workshop/proposal-review-decision.ts`, `src/workshop/proposal-ratification-plan.ts` |
| **M2.5 — Prompt contracts → SKILL.md instruction packages** (execution affordances structurally stripped; loader rejection tests; `mode: "placeholder"` retired) | ⬜ not started | ADR 0003 A2; direction memo §6 |
| **M4 — Evidence acquisition v1** (deterministic system-side fetcher as the first orchestrator-held MCP integration; allowlisted, sandboxed, provenance-tagged; adversarial injection corpus in definition of done; L0+L1 only) | ⬜ not started | ADR 0003 A1; direction memo §7 |
| **M5 — One real account, end to end** (system-acquired sources → model proposals → validation → human ratification → Workshop renders from durable state) | ⬜ not started | the capstone; everything is measured against it |
| **M6 — Identity + lab deployment** (Team/User/membership; auth in front of Workshop; lab target executed under existing deployment contracts; Gate 3 lands here, in service of M5's artifact) | ⬜ not started | `docs/BLOCKERS.md` Gate 3 |
| **M7 — Gate 4 corpus + first external users** (launch-gate corpus on real accounts; quantitative bars evaluated honestly; first users admitted per the original gating plan) | ⬜ not started | `docs/BLOCKERS.md` Gate 4 |

Recurrence/change detection deliberately sits after M7.

## H-track (harness/kernel; parallel, never blocking the P-track)

| Slice | Status | Notes |
| --- | --- | --- |
| **Phase 0 — ADR 0003 + tripwire tests + forbidden-phrase lint + vocabulary in contributor docs + this roadmap** | 🔶 this slice | direction memo §7 Phase 0, plus operator scope addition of 2026-06-12 |
| **H1 — Approvals as typed data** (lifecycle drafted → merged → operator-armed → consumed/expired; machine-checked counters; wraps capability descriptors by hash per ADR 0003 I-5) | ⬜ before M5 | the M5 approval should be the first machine-checked one |
| **H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension** | ⬜ between M3 and M4 | first registered capability is a no-op echo server proving the choke point |
| **H3 — Snapshot-primitive consolidation + negative-control automation** | ⬜ opportunistic | `src/safety/own-data-snapshot.ts`; every doc-contract test ships a violating fixture it must fail on |
| **H4 — Single guarded execution entrypoint** | ⬜ opportunistic | one chokepoint so future executions cannot skip a check |
| **H5 — Harness extraction assessment** | ⬜ post-M5 decision point | a decision, not a commitment |
| **A3 — Outward-facing read-only MCP server over the verified graph** | ⬜ deferred; spec-only until post-M5 | ADR 0003 A3 |

## Open operator decisions (annotated, not resolved)

These are the operator's calls, recorded here so the chart carries them visibly. Per the direction memo §11:

1. **Fork vs. build** for the M4 fetch server — comparison with audit-cost estimates to be presented at H2 completion.
2. **Fetched-content legal posture** (robots.txt, takedown workflow, retention) — M4 must surface a concrete proposal; the decision is not Claude Code's to make.
3. **M4-before-M5 vs. curated-source M5 — OPEN.** This chart currently shows M4 → M5 (evidence acquisition before the end-to-end capstone). The live alternative: run M5 end to end on hand-curated public sources and defer M4's new risk class (fetched-content injection, copyright/PII/takedown custody) until after the capstone proof. It turns on whether evidence acquisition is part of "the job" or an input to it. **To be flagged at the M3 retro; this roadmap deliberately does not resolve it.**
4. **ADR numbering/title** — resolved: ADR 0003, this slice.
5. **A3 timing** — whether the outward server is M7-adjacent or later.

## Maintenance rules

- Status values: ✅ shipped · 🔶 in progress · ⬜ not started. Cite the merge commit or module path as the anchor when flipping a status.
- A milestone is not "shipped" without its named visible artifact and its successor's approval surface (the done-pattern).
- Documents must reference this chart, not copy it. Anything this repo's docs reference must live in-repo or be explicitly marked external-and-nonbinding (see `CONTRIBUTING.md`).
