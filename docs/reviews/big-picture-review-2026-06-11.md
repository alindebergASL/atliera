# Atliera — Big-Picture Review: Harness Gaps, Direction, and Milestones

**Date:** 2026-06-11
**Prepared against:** `origin/main` @ `db24672` (*feat: add public curated proposal Workshop preview*)
**Health:** CI **1,131 / 0** (typecheck, build, full suite, gate smoke — exit 0). Board: 0 open PRs / 0 open issues.
**Scope:** Strategy document. No code changed. Builds on the v2.1 direction memo; does not repeat its item-level detail.

---

## 0. The news first: the recommended pivot already happened

Since the v2.1 memo, two slices landed that execute its core recommendation almost exactly:

- **`b328d72` — public proposal materialization contract.** `src/validation/proposal-materialization.ts` (1,078 lines) + 649 lines of tests + status runbook + a committed public-curated input fixture. No provider call, no private-evidence read, no durable write — all markers verified in the status doc.
- **`db24672` — public curated proposal Workshop preview.** The materialized bundle renders through the real Workshop renderer. The trust-tier question was resolved the right way: `model_proposed_pending_human_review` is a **decoration on `unverified`**, not a sixth truth tier — the view-model code structurally prevents a Verified label from ever carrying a pending-review badge, and the decoration never upgrades trust. Committed artifacts include the rendered HTML and a sanitized preview report.

This matters beyond the features themselves: it demonstrates the project **can** redirect from harness-building to product-loop building inside its own safety discipline, in two slices, in one day. The recursion risk identified in the earlier memos is real but evidently escapable. The question this report answers is: what's the rest of the road?

---

## 1. What the harness actually is (name the asset)

Step back far enough and Atliera has built two things, only one of which was on the roadmap:

1. **The product:** an evidence-first account-intelligence graph + Workshop renderer (planned).
2. **A governance kernel for agentic execution** (emergent). Its primitives:
   - **Consumable approvals** — one-shot authorization packets with explicit consumption accounting (`approved_future_attempts` / `remaining`), operator-arming separate from merge.
   - **Sanitized status writers** — typed outcome records (blocked/exception/completed) with accounting invariants that make contradictory claims unrepresentable.
   - **Boundary markers as language** — `authorizes_*`, `*_performed`, `*_committed`, `retry_requires_new_approval` — a vocabulary every artifact must speak.
   - **Descriptor-snapshot input hardening** (17 src files) — hostile-Proxy-proof reads at every trust boundary.
   - **Fail-closed modes** + import-side-effect proofs + provider-SDK bans enforced by tests, not policy docs.
   - **Evidence custody rules** — raw/private evidence never enters the repo; only sanitized derivatives do.
   - **Route evidence recency** — executions gate on the freshness of their own validation evidence.
   - **Paper-trail discipline** — approval → status → assessment → remediation chains, indexed and classified (active / inert / consumed / superseded).

That second thing is rarer than the first. Most teams attempting agentic systems have nothing like it. It is simultaneously Atliera's moat (an evidence product whose provenance discipline is *mechanically enforced* is hard to fake) and its biggest cost center (76+ runbooks for one capability). The direction question in §4 is really about how to spend this asset.

---

## 2. What the harness is missing — the subsystem map

These are whole missing organs, verified against the tree, ordered by how much they block the product thesis. (Item-level improvements carried from v2.1 are folded into §3.)

### 2.1 Evidence acquisition — the largest functional hole
**There is no code anywhere that fetches, canonicalizes, hashes, or stores a real source document.** (The only `fetch`-adjacent matches in `src/` are the `fetched_at` schema fields.) Every SourceDocument that exists is hand-authored fixture text. This was Phase 4 of the original architecture plan and was never started.

This is the deepest gap because the product thesis is *evidence-backed* intelligence — and the system currently has no way to acquire evidence. It also carries a doctrine subtlety worth fixing in writing before any code: **the model must stay tool-less; the *system* fetches.** A deterministic, allowlisted, rate-limited fetcher that stores raw text + content hash is a Signals-lens capability (exactly as the original architecture assigned it), not a model tool. Acquisition does not violate the no-tools/no-web doctrine if and only if that distinction is kept structural.

New risk class arriving with this subsystem (nobody has charted it yet): fetched real-world content brings **copyright/ToS/robots compliance, PII-in-sources, and takedown handling** into the evidence-custody story. The acquisition contract needs an evidence-acquisition policy the same way live proofs needed approval packets.

### 2.2 The real agent loop
`src/agent/prompt-contracts.ts` is still `mode: "placeholder"`. Every live proof so far has been a **single-shot synthetic `graph.propose`**. The actual research loop — discover sources → fetch → propose excerpts against stored text → propose claims → propose objects → validate each stage — has no orchestration. `AgentRun`/`RunArtifact` records exist as seams but nothing multi-step runs through them. Missing harness mechanics this will demand: **per-step budgets within a run, resumption after partial failure** (artifact preservation exists; resumption doesn't), and staged validation between steps.

### 2.3 Human ratification — the unbuilt third of the doctrine
"Agent proposes, system validates, **human ratifies**" — the first two have hundreds of files; ratification has zero. Now that proposals render with a pending-review badge (db24672), this is the *next natural slice*: a review affordance (accept / reject / edit / request re-research), recorded as an `AuditEvent` (`actor_type: user`, `event_type: claim.ratified`), with promotion rules (ratified + evidence-valid → eligible for durable write; rejection preserved with reason). Until this exists, the pending-review badge is a label with no door behind it.

### 2.4 Durable product state
A local durable DB with backup/restore just landed (Gate 3 slices), and versioned-store/DB-adapter seams have existed for months — but **the graph of record has never received a single record**. Everything renders from files and fixtures. M3's first ratified write (see §5) is the moment this stops being a seam.

### 2.5 Identity and tenancy
The architecture doc §3 specifies Team / User / TeamMembership / roles. **Zero code exists** (verified: no such types in `src/`). A bearer-token seam landed for the fake-mode server, which is the right primitive bottom rung, but ratification (2.3) needs at least a real user identity to attribute `actor_id`, and nothing beyond a single operator can touch the system before basic tenancy exists.

### 2.6 Recurrence and change detection
Signals' actual job — freshness/staleness tracking, change detection, re-research triggers — has no implementation. The only recency machinery in the codebase (route evidence recency) points at *provider routes*, not at *account evidence*. This is post-M5 work, but it's the difference between "a report generator" and "an intelligence system," so it belongs on the chart.

### 2.7 Meta-observability
Carried from v2.1, still open: an append-only sanitized **proof/run ledger** (today the answer to "how many attempts, which routes, what outcomes" lives across ~80 runbooks), and a **cumulative approved-budget vs observed-spend rollup**.

### 2.8 Harness-internal gaps (the kernel improving itself)
- **Approvals are prose validated by regex.** The most consequential internal gap. Approval packets are markdown; their invariants are enforced by contract tests doing pattern matching. The status writers already prove the better pattern: typed records with unrepresentable-invalid states. Approvals deserve the same: an `Approval` record type with a lifecycle (`drafted → merged → operator-armed → consumed | expired`), machine-checked consumption counters, and markdown as a *derived* rendering. This single change converts ~40 regex contract tests into schema checks and makes "is anything currently authorized?" a function call instead of a documentation question.
- **No single guarded execution entrypoint.** Each execution slice re-implements its own approval/preflight gating. One `executeApprovedSlice(approval, plan)` chokepoint would mean future executions *can't* skip a check.
- **Negative-control testing is manual.** Reviews in this project repeatedly ran "inject a violation, confirm the contract test fails" by hand. Automate it: every doc-contract test should ship with a violating fixture it must fail on — test the tests.
- **Approval aging** — route recency exists; unconsumed approvals don't expire. Extend the same pattern.

---

## 3. What can be improved in what exists (compressed)

Carried forward from v2.1, all still applicable, in priority order: (1) approvals-as-typed-data (§2.8 — promoted to a milestone-track item below); (2) factor the descriptor-snapshot primitive into `src/safety/own-data-snapshot.ts` with one pinned test suite (17 call sites today); (3) make `INDEX.md` enforcement-backed (safety test fails on unclassified runbooks); (4) consolidate the seven `model-only-*` proof siblings behind a module barrel + one overview doc; (5) proof ledger; (6) budget rollup; (7) module barrels for the growing `src/index.ts`. Explicit non-goals reaffirmed: no generic autonomous agent loop; no second provider until the first provider's output reaches durable ratified state.

---

## 4. Direction — the identity question, answered

The honest fork: Atliera is now (a) an account-intelligence product, and (b) a proven governance kernel that many teams building agentic systems would pay for on its own. Should (b) become a product?

**Recommendation: product-first; harness as moat; revisit harness productization only after M5.** Reasons:

- The kernel's credibility *derives from* the product. "We govern agentic evidence-handling safely" is provable today only because there's a real product loop being governed. Extracted now, it's a framework pitch without a flagship user.
- The kernel isn't done teaching. The next three subsystems (acquisition, agent loop, ratification) will each force kernel upgrades (acquisition policy, per-step budgets, identity-attributed audit events). Extract after those lessons, not before.
- The extraction cost is real but **stays cheap if §2.8's approvals-as-data lands first** — typed approvals + status writers + snapshot primitive + mode gates are naturally a package; prose runbooks are not.

So: chart toward the product loop closing, keep the kernel improvements on a parallel low-intensity track, and put "harness extraction assessment" *after* the end-to-end milestone — as a decision point, not a commitment.

---

## 5. The milestone chart

Two tracks. **P-track** (product loop) is the spine; **H-track** (harness/kernel) runs parallel at roughly one slice per P-milestone, never blocking. Gates from `BLOCKERS.md` map onto specific milestones instead of floating.

Done-criteria discipline (per Hermes, adopted project-wide): every milestone names its **visible artifact** and the approval surface for the *next* one — a milestone that doesn't set up its successor is not done.

### ✅ M1 — Proposal materialization contract *(shipped: `b328d72`)*
### ✅ M2 — Curated proposal renders in Workshop with pending-review decoration *(shipped: `db24672`)*

### M3 — Ratification closes the doctrine loop
A human can accept/reject a materialized proposal; the decision is an `AuditEvent` with a real `actor_id`; a ratified, evidence-valid record performs **the first durable graph write in project history** (local durable DB, mode-gated, with backup proof). Rejections persist with reasons.
*Visible artifact:* a Workshop view showing one ratified (now Verified-pathway) record and one rejected record with its reason — from durable state, not fixtures.
*Unlocks:* the durable store stops being a seam; `graph_ingestion_performed` flips for the first time, deliberately, behind ratification, exactly as the doctrine always intended.
*Needs:* minimal identity (a single named operator user is acceptable; full tenancy deferred to M6).

### M4 — Evidence acquisition v1 (Phase 4 revival)
Deterministic system-side fetcher: allowlisted domains, robots/ToS-respecting, rate-limited, stores raw text + content hash + retrieval metadata as SourceDocuments. **Model remains tool-less — structurally.** Ships with an evidence-acquisition policy runbook (the new custody class: copyright, PII-in-sources, takedown) and adversarial tests (disallowed domain, oversized doc, hash instability, redirect games).
*Visible artifact:* a real public web page about a real company stored as a SourceDocument and rendered as a source in Workshop's evidence drawer.
*Unlocks:* excerpt validation against *real* stored text — the validator finally meets reality.

### M5 — One real account, end-to-end ("Atliera does its job once")
The capstone: pick one real account → system fetches 3–5 public sources (M4) → model proposes excerpts/claims/objects against stored text under a fresh bounded approval (the live-proof machinery, now with real input) → validators disposition every record → human ratifies a subset (M3) → Workshop renders the account from durable state with honest trust labels.
*Visible artifact:* a shareable Workshop account page about a real company, every claim traceable to a stored source, every unverified item labeled.
*Unlocks:* Gate 4 metrics computed on real end-to-end output; the product demo exists; **the harness-extraction decision (§4) becomes answerable.** This is the milestone the entire repo has been building toward, and everything before it is now plumbed.

### M6 — Identity + lab deployment (Gate 3 lands here, in service of M5)
Basic Team/User/membership; auth in front of the Workshop server; the staged deployment wiring executed to a real `lab.atliera.com` under the existing deployment contracts — so the M5 artifact is *visitable*, not just screenshot-able.
*Visible artifact:* a second human logs into lab and reviews the M5 account.
*Note:* deployment work before M5 should be limited to what M5's demo needs — this is the explicit re-subordination of Gate 3 to the product loop.

### M7 — Gate 4 corpus + first external users
The launch-gate corpus re-selected with real accounts; M5's loop run across it; Gate 4's quantitative bars (accepted-excerpt rate ≥ 50%, zero-output < 10%, material-claim coverage ≥ 80%, two materially useful lenses per usable account) evaluated honestly; SLED-team users admitted per the original gating plan.
*This is where a launch-readiness claim becomes utterable for the first time.*

### H-track (parallel, one slice per P-milestone, in this order)
H1 approvals-as-typed-data (biggest kernel upgrade; do **before M5** so the M5 approval is the first machine-checked one) → H2 proof/run ledger + budget rollup → H3 snapshot-primitive consolidation + negative-control automation → H4 single guarded execution entrypoint → H5 (post-M5) harness extraction assessment.

### Recurrence (2.6) deliberately sits after M7 — change detection on accounts nobody uses yet is harness-for-harness's-sake.

---

## 6. Risks to chart against

| Risk | Status | Mitigation already in hand |
|---|---|---|
| Recursion (harness work masquerading as progress) | **Demonstrated escapable** (M1/M2 shipped product slices) — but it regrows whenever a milestone lacks a visible-artifact criterion | Hermes done-criteria, adopted in §5 |
| Solo-operator bus factor | High — one person is operator, approver, and reviewer-of-record | M6 identity + second reviewer; the paper trail already makes handover feasible |
| Single provider route (codex-auth / gpt-5.5) | Real but correctly deprioritized | Route catalog + recency gates exist; "no second provider before durable ratified output" stands |
| Evidence-custody scope growth at M4 (copyright/PII/takedown) | New, uncharted | Write the acquisition policy *as part of* M4, not after |
| Regex-prose approvals drifting from reality | Growing with runbook count (143+) | H1 approvals-as-data |
| CI growth (1,131 tests, full-suite-on-everything) | Comfortable now (~30s), watch at ~3–5k | Defer; consider test sharding at M7 |
| Workshop UX debt (static HTML, no framework decision since Phase 2) | Acceptable through M5's demo | Revisit *after* M5 user feedback, with real data informing the choice |

---

## 7. Bottom line

The harness is no longer the story — **M1/M2 proved the project can point it at the product.** What's missing is not more proving machinery; it's four organs the product needs to live: **ratification (M3), evidence acquisition (M4), the end-to-end run (M5), and a door other humans can walk through (M6).** The single most valuable internal upgrade is converting approvals from prose-plus-regex into typed, lifecycle-tracked records (H1) — it hardens every future milestone and is the keystone if the governance kernel is ever productized, a decision that should be made only after M5 exists.

Chart everything toward M5. It is the first moment Atliera will have *done the thing it is for* — one real account, evidence fetched by the system, claims proposed by the model, validated by the graph, ratified by a human, rendered honestly. Every slice between now and then should justify itself by its distance to that artifact.

*Report ends. No code modified.*
