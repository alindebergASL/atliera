# Atliera Roadmap (living)

Status: living document. This file is the **in-repo source of truth for the milestone chart**. Other documents — including ADR 0003 and the direction memo — reference this file and must not restate the chart. When milestone status changes, update this file in the same PR as the change.

Origin: the chart was first drawn in `docs/reviews/big-picture-review-2026-06-11.md`, committed verbatim as **frozen historical context**. Where that review and this file disagree, this file wins.

Boundary markers (this document authorizes implementation work only; it executes and authorizes no effects):

- implementation_work_authorized: none
- current_effective_authorization: none
- authorizes_flow_execution: false
- authorizes_durable_write_effect: false
- authorizes_provider_call: false
- authorizes_system_side_acquisition: false
- authorizes_private_evidence_read: false
- authorizes_retry: false
- authorizes_production_write: false
- authorizes_deployment: false
- authorizes_graph_ingestion: false
- readiness_claim: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Doctrine spine

Agent proposes → system validates → human ratifies → durable state. Every milestone below is measured by its distance to **the doctrine-loop proof (M5a)** and the **does-its-job-once milestone (M5b)**; every milestone must end with a named visible artifact plus the approval surface for its successor.

### Default sequence (burden of proof on reordering)

The default product-track sequence is:

**M3 → M5a (loop proof, curated public sources) → M4 (acquisition capstone) → M5b (does-its-job-once, system-acquired sources).**

Any reordering carries the burden of proof: the alternative must explicitly justify why the curated loop proof would not suffice as the doctrine-loop capstone, or why the M4 risk class is required before the durable ratification path closes. The earlier open decision (M4-before-M5 vs. curated-source M5) is resolved into this default. The M3 retro (`docs/reviews/m3-retro.md`, PR #275 §4) closed the reordering question for the M3-to-M5a step on this burden; it remains reopenable at a future retro under the same *burden of proof on the challenger* framing. The substantive justification and the M5-wording drift this introduces are recorded in `docs/reviews/phase-0-retro-and-m5-drift.md`.

### H-track sequencing after the freeze

The entire H-track (H1–H5 and A3) was **frozen until M3 ships**. **The freeze was lifted at the M3 retro (`docs/reviews/m3-retro.md`, PR #275).** That retro's H3-first and H1-with-M5a recommendations remain frozen historical evidence in that file; they were superseded for Step-4 sequencing by the operator ratification in `docs/reviews/m5a-step4-before-h3-ratification.md`. H3's plan is complete and merged through PR #277, and Step 4 is implemented through PR #282. H3 implementation remains unstarted and requires a new explicit operator decision after the M5a capstone retro. H1 was not a prerequisite for, or paired with, M5a Step 4. The M5a retro must re-evaluate the H1/H2/H3 implementation order against then-current evidence; no H-track implementation slice is currently authorized, and H4, H5, and A3 remain not next-up.

### M5a Step 4 implementation record and closed successor gate

The operator ratified M5a Step 4 before H3 implementation unless a concrete safety blocker emerges; that historical sequencing decision is recorded in `docs/reviews/m5a-step4-before-h3-ratification.md`. The bounded fixture capstone is implemented through PR #282. This is an implementation record, not standing authority to repeat the flow or begin a successor slice.

Step 4's implemented boundary is exactly:

- step_4_valid_armings_consumed: 1
- step_4_recorded_curated_proposals_executed: 1
- step_4_durable_local_writes: 1
- step_4_durable_local_write_read_backs: 1
- step_4_workshop_artifacts_rendered: 1

The slice remains closed to every adjacent risk class:

- step_4_provider_calls: 0
- step_4_system_side_acquisitions: 0
- step_4_private_evidence_reads: 0
- step_4_retries: 0
- step_4_production_writes: 0
- step_4_deployments: 0
- step_4_readiness_claims: 0

M5a remains **in progress** pending its capstone retro and successor approval surface. `implementation_work_authorized` has returned to `none`, `current_effective_authorization` remains `none`, and a new explicit operator decision for any later slice is required. This roadmap update authorizes no repeated flow execution, H3 or M4 implementation, provider call, acquisition, private-evidence read, deployment, production write, or readiness claim.

## P-track (product loop)

| Milestone | Status | Anchor |
| --- | --- | --- |
| **M1 — Proposal materialization contract** | ✅ shipped | `b328d72`; `src/validation/proposal-materialization.ts` |
| **M2 — Curated proposal renders in Workshop** (pending-review decoration on `unverified`) | ✅ shipped | `db24672`; `src/workshop/proposal-preview.ts` |
| **M3 — Ratification closes the doctrine loop** (human accept/reject as AuditEvent; first durable graph write of a ratified record; rejections preserved with reasons) | ✅ shipped | `b2b7a09` (PR #274 M3 step 3b); preceded by `91b7064` (PR #271 M3 step 3a). Gate: `docs/reviews/m3-retro.md`, PR #275 |
| **M2.5 — Prompt contracts → SKILL.md instruction packages** (execution affordances structurally stripped; loader rejection tests; `mode: "placeholder"` retired) | ⬜ not started | ADR 0003 A2; direction memo §6. M2.5 is not currently authorized; any later slice requires a new explicit operator decision. |
| **M5a — Doctrine-loop proof, curated public sources** (curated public GraphBundle → model proposals → validation → human ratification → durable graph write → Workshop renders from durable state; visible artifact: a real-account-looking Workshop page rendered entirely from durable state without any system-acquisition path being exercised) | 🔶 in progress | Steps 1–3 merged through PRs #278 (`6205c4a`), #279 (`d09ac17`), and #280 (`dc0381f`); the Step-3 baseline is `dc0381fb539df85ed1fa814ad0969d73d6b07d78`. Step 4 implemented through PR #282; M5a remains in progress pending its capstone retro and successor approval surface. |
| **M4 — Evidence acquisition v1** (deterministic system-side fetcher as the first orchestrator-held MCP integration; allowlisted, sandboxed, provenance-tagged; adversarial injection corpus in definition of done; L0+L1 only; **its own capstone, its own visible artifact and retro — not co-shipped with any M5 milestone**) | ⬜ not started | ADR 0003 A1; direction memo §7 |
| **M5b — Does-its-job-once, system-acquired sources** (the original capstone framing carried forward from the frozen big-picture review: pick one real account → system fetches public sources via M4 → loop runs → Workshop renders durable state with honest trust labels; visible artifact: a shareable Workshop account page about a real company, every claim traceable to a stored source, every unverified item labeled) | ⬜ not started | originates as the frozen review's M5; see `phase-0-retro-and-m5-drift.md` §3 |
| **M6 — Identity + lab deployment** (Team/User/membership; auth in front of Workshop; lab target executed under existing deployment contracts; Gate 3 lands here, in service of M5b's artifact) | ⬜ not started | `docs/BLOCKERS.md` Gate 3 |
| **M7 — Gate 4 corpus + first external users** (launch-gate corpus on real accounts; quantitative bars evaluated honestly; first users admitted per the original gating plan) | ⬜ not started | `docs/BLOCKERS.md` Gate 4 |

Recurrence/change detection deliberately sits after M7.

## H-track (harness/kernel; parallel, never blocking the P-track; **freeze lifted at M3 retro, PR #275**)

| Slice | Status | Notes |
| --- | --- | --- |
| **Phase 0 — ADR 0003 + tripwire tests + forbidden-phrase lint + vocabulary in contributor docs + this roadmap** | ✅ shipped (`f2397fc`, PR #267) | Authority for this flip: merge commit, the four named green tests (`test_model_transport_flags_pinned_false`, `test_no_capability_descriptor_in_model_payload`, `test_no_third_party_skill_load_path`, `allowlist_remains_exactly_two_paths`), and the done-criteria mapping in `docs/reviews/phase-0-retro-and-m5-drift.md` §1.3 — not reviewer sign-off. |
| **H1 — Approvals as typed data** (lifecycle drafted → merged → operator-armed → consumed/expired; machine-checked counters; wraps capability descriptors by hash per ADR 0003 I-5) | ⬜ not started; post-M5a-retro sequencing review | Not a prerequisite for or paired with M5a Step 4. The earlier pairing recommendation is superseded; H1's order relative to H2/H3 must be re-evaluated at the M5a retro and requires a new explicit operator decision. |
| **H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension** | ⬜ not started; post-M5a-retro sequencing review | First registered capability remains a no-op echo server proving the choke point. Its implementation order must be re-evaluated at the M5a retro without reordering the P-track. |
| **H3 — Snapshot-primitive consolidation + negative-control automation** | ⬜ implementation not started; plan complete/merged | Plan merged through PR #277 (`a879c11`). Step 4 is implemented; H3 remains unstarted pending the M5a capstone retro and a new explicit operator decision. The plan is evidence for an eventual cross-layer migration, not implementation authority. |
| **H4 — Single guarded execution entrypoint** | ⬜ not started; queued behind H2 | one chokepoint so future executions cannot skip a check |
| **H5 — Harness extraction assessment** | ⬜ not started; post-M5b decision point | a decision, not a commitment |
| **A3 — Outward-facing read-only MCP server over the verified graph** | ⬜ spec-only, deferred until post-M5b | ADR 0003 A3 (not changed by M3 retro freeze lift) |

## Operator decisions ledger (annotated; resolved items kept for audit trail)

These are the operator's calls, recorded here so the chart carries them visibly. Items remain on this ledger even after they are resolved, partly closed, or closed-for-the-current-step-and-reopenable-later, so the disposition trail is auditable in one place. Per the direction memo §11:

1. **Fork vs. build** for the M4 fetch server — comparison with audit-cost estimates remains required before an M4 fetch-server choice. The old H3 → H1 → H2 implementation queue is superseded; the M5a retro must re-evaluate H-track order without changing the product-track sequence.
2. **Fetched-content legal posture** (robots.txt, takedown workflow, retention) — M4 must surface a concrete proposal; the decision is not Claude Code's to make.
3. **M4-before-M5 vs. curated-source M5** — **RESOLVED INTO DEFAULT SEQUENCE** (above). The default is M3 → M5a → M4 → M5b. The M3 retro (PR #275 §4) revisited the reordering question and **closed it for the M3-to-M5a step**: the doctrine loop is real on curated sources at `b2b7a09`, M5a scales it, M4 introduces a distinct acquisition risk class better landed against an already-closed loop. The reordering question remains reopenable at a future retro under the standing *burden of proof on the challenger* framing.
4. **ADR numbering/title** — resolved: ADR 0003.
5. **A3 timing** — whether the outward server is M7-adjacent or later.
6. **M5a Step 4 vs. H3 implementation** — **RESOLVED: STEP 4 FIRST.** Steps 1–3 are merged and Step 4 is implemented through PR #282. H3 remains unstarted; the M5a capstone retro and a new explicit operator decision are required before H3 or any other successor implementation slice. See `docs/reviews/m5a-step4-before-h3-ratification.md`.

## Maintenance rules

- Status values: ✅ shipped · 🔶 in progress · ⬜ not started. Cite the merge commit or module path as the anchor when flipping a status.
- A milestone is not "shipped" without its named visible artifact and its successor's approval surface (the done-pattern).
- Completion of an implementation slice restores `implementation_work_authorized` to `none`; any later slice requires a new explicit operator decision recorded in the living roadmap and runbook index.
- Documents must reference this chart, not copy it. Anything this repo's docs reference must live in-repo or be explicitly marked external-and-nonbinding (see `CONTRIBUTING.md`).
