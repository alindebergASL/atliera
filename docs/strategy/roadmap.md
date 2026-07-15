# Atliera Roadmap (living)

Status: living document. This file is the **in-repo source of truth for the milestone chart**. Other documents — including ADR 0003 and the direction memo — reference this file and must not restate the chart. When milestone status changes, update this file in the same PR as the change.

Origin: the chart was first drawn in `docs/reviews/big-picture-review-2026-06-11.md`, committed verbatim as **frozen historical context**. Where that review and this file disagree, this file wins.

Boundary markers (this document authorizes implementation work only; it executes and authorizes no effects):

- implementation_work_authorized: none
- implementation_start_condition: none
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

Latest completed operator decision recorded for this milestone:

- decision_implementation_work_authorized: `M5b-FedEx-system-acquired-source-pre-effect-capstone (Gate A; implementation complete; no effects)`
- decision_implementation_start_condition: `exact base commit 2f37a6b2b489e97b0bc7ebda5e01a1fe40fdd360 and tree 4f1c550744ddc5c25da4a67a1e2e97be10d03936`
- decision_current_effective_authorization: `none`
- server_selection: `minimal first-party MCP server; no third-party survey/fork`
- demonstration_account: `FedEx`
- live_acquisition_authorized: `false`
- deployment_authorized: `false`
- next_recommended_work: `separately authorize exact M5b private custody read/admission after Gate A review`

Attempt 2 consumed its separately granted one-shot live authority. Attempts 1 and 2 are both permanently consumed. M5b Gate A implementation is complete and unarmed; implementation authority and current effective authority are both again `none`.

## Doctrine spine

Agent proposes → system validates → human ratifies → durable state. Every milestone below is measured by its distance to **the doctrine-loop proof (M5a)** and the **does-its-job-once milestone (M5b)**; every milestone must end with a named visible artifact plus the approval surface for its successor.

### Default sequence (burden of proof on reordering)

The default product-track sequence is:

**M3 → M5a (loop proof, curated public sources) → M4 (acquisition capstone) → M5b (does-its-job-once, system-acquired sources).**

Any reordering carries the burden of proof: the alternative must explicitly justify why the curated loop proof would not suffice as the doctrine-loop capstone, or why the M4 risk class is required before the durable ratification path closes. The earlier open decision (M4-before-M5 vs. curated-source M5) is resolved into this default. The M3 retro (`docs/reviews/m3-retro.md`, PR #275 §4) closed the reordering question for the M3-to-M5a step on this burden; it remains reopenable at a future retro under the same *burden of proof on the challenger* framing. The substantive justification and the M5-wording drift this introduces are recorded in `docs/reviews/phase-0-retro-and-m5-drift.md`.

### H-track sequencing after the freeze

The entire H-track (H1–H5 and A3) was **frozen until M3 ships**. **The freeze was lifted at the M3 retro (`docs/reviews/m3-retro.md`, PR #275).** H3's plan is complete and merged through PR #277, but implementation remains unstarted and not next-up. The M5a closeout selected the separate H2 no-network capability-registry/mediation/echo proof; its working proof is now implemented and H2 shipped at `691555292b43a37f4f5ec5bba43978ffcc177a0f` (PR #284). M4 reused that boundary for the exact SEC FedEx submissions target, survived a truthful consumed failure, merged the Node 22 repair in PR #287, and then completed one separately authorized successful acquisition. H1 remains unstarted and not next-up; H4, H5, A3, outward MCP, identity and recurrence remain deferred.

### M5a shipped: visible capstone and bounded successor approval

The operator ratified M5a Step 4 before H3 implementation unless a concrete safety blocker emerged; that historical sequencing decision is recorded in `docs/reviews/m5a-step4-before-h3-ratification.md`. The bounded fixture capstone is implemented through PR #282 and rendered at `fixtures/workshop/m5a-curated-proposal-flow-capstone.html`. The product findings, viewing instructions, five-question evaluation guide and successor decision are recorded in `docs/reviews/m5a-product-closeout-retro.md`.

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

M5a is **shipped** because both halves of the done-pattern now exist: the named visible capstone and a bounded successor approval surface. H2 subsequently shipped at PR #284, and M4 has now completed one separately authorized acquisition and its own visible closeout. `implementation_work_authorized` and `current_effective_authorization` are again both `none`. No repeated acquisition, repeated M5a product slice or durable effect, provider call, private-evidence read, production effect, deployment, M5b provider execution, or readiness claim is authorized.

### M5b Gate A in progress: FedEx pre-write review candidate

M5b Gate A now has a complete unarmed pre-effect path at `src/workshop/m5b-fedex-system-acquired-source.ts` and `src/workshop/m5b-fedex-prewrite-workshop.ts`. Its visible review artifact is `fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html`; the machine source pack and human-review packet are under `fixtures/validation/m5b-fedex-system-acquired-*.json`. The committed demo is explicitly a synthetic/committed-public pre-effect fixture with empty filing arrays. It does not claim exact private custody admission and is refused by the production-only future-composition boundary.

The production wrapper is pinned to the exact M4 custody/response/policy/descriptor/source/timestamp/retention identities and accepts caller-supplied bytes only. After exact validation, its sanitized pack records canonical-hash-bound serialized admission evidence that can survive human review and later-process JSON reload without object-identity state. Exact production admission remains blocked on a separately authorized private custody read. Human proposal dispositions, source retention beyond the original deadline, any optional provider call, future one-shot durable write, acquisition, and deployment are separate later gates. M5b is **🔶 in progress, not shipped**. Private reads, provider calls, graph writes, acquisitions, deployments and effects in Gate A are all 0.

## P-track (product loop)

| Milestone | Status | Anchor |
| --- | --- | --- |
| **M1 — Proposal materialization contract** | ✅ shipped | `b328d72`; `src/validation/proposal-materialization.ts` |
| **M2 — Curated proposal renders in Workshop** (pending-review decoration on `unverified`) | ✅ shipped | `db24672`; `src/workshop/proposal-preview.ts` |
| **M3 — Ratification closes the doctrine loop** (human accept/reject as AuditEvent; first durable graph write of a ratified record; rejections preserved with reasons) | ✅ shipped | `b2b7a09` (PR #274 M3 step 3b); preceded by `91b7064` (PR #271 M3 step 3a). Gate: `docs/reviews/m3-retro.md`, PR #275 |
| **M2.5 — Prompt contracts → SKILL.md instruction packages** (execution affordances structurally stripped; loader rejection tests; `mode: "placeholder"` retired) | ⬜ not started | ADR 0003 A2; direction memo §6. M2.5 is not currently authorized; any later slice requires a new explicit operator decision. |
| **M5a — Doctrine-loop proof, curated public sources** (curated public GraphBundle → recorded proposal fixtures grounded in curated sources → validation → human ratification → durable graph write → Workshop renders from durable state; visible artifact: a real-account-looking Workshop page rendered entirely from durable state without any system-acquisition path being exercised) | ✅ shipped | Steps 1–3 merged through PRs #278 (`6205c4a`), #279 (`d09ac17`), and #280 (`dc0381f`); Step 4 merged through PR #282 (`9661468`). Proposals were fixture-curated, not model-generated. Visible artifact: `fixtures/workshop/m5a-curated-proposal-flow-capstone.html`. Closeout, drift boundary and successor approval surface: `docs/reviews/m5a-product-closeout-retro.md`. |
| **M4 — Evidence acquisition v1** (deterministic system-side fetcher as the first orchestrator-held MCP integration; allowlisted, sandboxed, provenance-tagged; L0 only in this slice; **its own capstone, visible artifact and retro — not co-shipped with M5**) | ✅ shipped upon closeout merge | Canonical implementation `c1372acd14e09722c1e54646b85d89d3a0fd73f1`, tree `1eb28fcea7ced5ba2357bd32c35561a7cadc4918`. Attempt 1 remains a truthful permanently consumed `failed_no_evidence` record; PR #287 merged the Node 22 repair; separately authorized attempt 2 succeeded once with HTTP 200, `application/json`, 160,901 bytes, one DNS/request/connection attempt, zero redirects and zero retries. Visible artifact: `fixtures/workshop/m4-sec-fedex-live-evidence-preview.html`; sanitized proof: `fixtures/validation/m4-live-acquisition-success-proof.json`; retro: `docs/reviews/m4-live-acquisition-closeout-retro.md`. `current_effective_authorization: none`; no repeat acquisition, M5b, graph, provider, deployment or readiness authority. |
| **M5b — Does-its-job-once, system-acquired sources** (the original capstone framing carried forward from the frozen big-picture review: pick one real account → system fetches public sources via M4 → loop runs → Workshop renders durable state with honest trust labels; visible artifact: a shareable Workshop account page about a real company, every claim traceable to a stored source, every unverified item labeled) | 🔶 in progress — Gate A pre-effect, not shipped | FedEx byte-only future custody admission, canonical-hash-bound serialized admission evidence, bounded source pack, individual review packet, valid unverified GraphBundle candidate and visible pre-write artifact are implemented at `fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html`. The demo is explicitly synthetic/committed-public with null admission evidence and cannot enter future durable-write composition. Exact production admission awaits a separately authorized private custody read; provider, retention, write, acquisition and deployment gates remain closed. |
| **M6 — Identity + lab deployment** (Team/User/membership; auth in front of Workshop; lab target executed under existing deployment contracts; Gate 3 lands here, in service of M5b's artifact) | ⬜ not started | `docs/BLOCKERS.md` Gate 3 |
| **M7 — Gate 4 corpus + first external users** (launch-gate corpus on real accounts; quantitative bars evaluated honestly; first users admitted per the original gating plan) | ⬜ not started | `docs/BLOCKERS.md` Gate 4 |

Recurrence/change detection deliberately sits after M7.

## H-track (harness/kernel; parallel, never blocking the P-track; **freeze lifted at M3 retro, PR #275**)

| Slice | Status | Notes |
| --- | --- | --- |
| **Phase 0 — ADR 0003 + tripwire tests + forbidden-phrase lint + vocabulary in contributor docs + this roadmap** | ✅ shipped (`f2397fc`, PR #267) | Authority for this flip: merge commit, the four named green tests (`test_model_transport_flags_pinned_false`, `test_no_capability_descriptor_in_model_payload`, `test_no_third_party_skill_load_path`, `allowlist_remains_exactly_two_paths`), and the done-criteria mapping in `docs/reviews/phase-0-retro-and-m5-drift.md` §1.3 — not reviewer sign-off. |
| **H1 — Approvals as typed data** (lifecycle drafted → merged → operator-armed → consumed/expired; machine-checked counters; wraps capability descriptors by hash per ADR 0003 I-5) | ⬜ not started; not next-up | The M5a closeout selected the separate H2 no-network kernel proof; no standalone H1 slice is authorized. |
| **H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension** | ✅ shipped | Merged at `691555292b43a37f4f5ec5bba43978ffcc177a0f` (PR #284). `fixtures/validation/h2-echo-mediation-proof.json` preserves the first registered inert echo, one `CapabilityExecution`, one `AuditEvent`, and one accounting increment with zero retries and zero network/acquisition/provider/private/filesystem/environment/database/subprocess/production/deployment effects; I-3, I-4, I-5, I-10 and I-11 remain executable. M4 reuses the boundary as the reviewed second entry without changing H2 semantics. |
| **H3 — Snapshot-primitive consolidation + negative-control automation** | ⬜ implementation not started; plan complete/merged; not next-up | Plan merged through PR #277 (`a879c11`). The M5a closeout selects the separate H2 no-network kernel proof instead; H3 remains future work and is not implementation authority for the acquisition path. |
| **H4 — Single guarded execution entrypoint** | ⬜ not started; not next-up | One chokepoint so future executions cannot skip a check. Any future H4 work requires a separate explicit operator decision; the current next recommendation is only a separate M5b decision. |
| **H5 — Harness extraction assessment** | ⬜ not started; post-M5b decision point | a decision, not a commitment |
| **A3 — Outward-facing read-only MCP server over the verified graph** | ⬜ spec-only, deferred until post-M5b | ADR 0003 A3 (not changed by M3 retro freeze lift) |

## Operator decisions ledger (annotated; resolved items kept for audit trail)

These are the operator's calls, recorded here so the chart carries them visibly. Items remain on this ledger even after they are resolved, partly closed, or closed-for-the-current-step-and-reopenable-later, so the disposition trail is auditable in one place. Per the direction memo §11:

1. **Fork vs. build** for the M4 fetch server — **RESOLVED: minimal first-party MCP server; no third-party survey/fork.** The implementation decision was `M4-public-http-fetch-v1-first-party-no-live-execution`. One later separately authorized live attempt completed successfully and its authority is consumed; any future live execution requires a new explicit decision.
2. **Fetched-content legal posture** (robots.txt, takedown workflow, retention) — **RESOLVED FOR THE CONSUMED M4 ATTEMPT:** 30-day retention; quarantine and stop downstream use on takedown/legal concern; retain the minimum audit hash unless deletion is required. Any future acquisition requires a new decision rather than inheriting this consumed authority.
3. **M4-before-M5 vs. curated-source M5** — **RESOLVED INTO DEFAULT SEQUENCE** (above). The default is M3 → M5a → M4 → M5b. The M3 retro (PR #275 §4) revisited the reordering question and **closed it for the M3-to-M5a step**: the doctrine loop is real on curated sources at `b2b7a09`, M5a scales it, M4 introduces a distinct acquisition risk class better landed against an already-closed loop. The reordering question remains reopenable at a future retro under the standing *burden of proof on the challenger* framing.
4. **ADR numbering/title** — resolved: ADR 0003.
5. **A3 timing** — whether the outward server is M7-adjacent or later.
6. **M5a Step 4 vs. H3 implementation** — **RESOLVED: STEP 4 FIRST.** Steps 1–3 are merged through PRs #278–#280 and Step 4 through PR #282 (`9661468`). The required capstone retro is now `docs/reviews/m5a-product-closeout-retro.md`; H3 remains unstarted and not next-up.
7. **Post-M5a product direction** — **RESOLVED THROUGH M5b GATE A: H2 NO-NETWORK ECHO PROOF → THIN M4 `public_http_fetch_v1` → M5b FEDEX UNARMED PRE-EFFECT REVIEW.** H2 shipped at PR #284. M4 completed one bounded acquisition and its visible closeout; both attempt authorities are permanently consumed. M5b Gate A now supplies the unarmed review surface without reading private custody. The next possible step is only a separately authorized exact private custody read/admission. Provider/model execution and every later effect remain separately gated.

## Maintenance rules

- Status values: ✅ shipped · 🔶 in progress · ⬜ not started. Cite the merge commit or module path as the anchor when flipping a status.
- A milestone is not "shipped" without its named visible artifact and its successor's approval surface (the done-pattern).
- Completion of an implementation slice restores `implementation_work_authorized` to `none` unless the same milestone closeout records a new explicit operator decision for a narrowly bounded successor implementation. Effect authority remains `none` until its separately named checkpoint.
- Documents must reference this chart, not copy it. Anything this repo's docs reference must live in-repo or be explicitly marked external-and-nonbinding (see `CONTRIBUTING.md`).
