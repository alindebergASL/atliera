# ADR 0003: System Capabilities over MCP; Skills as Instructions

Status: Accepted

Date: 2026-06-12

Deciders: operator (alindebergASL)

Extends: ADR 0001 (fresh system; carry-forward doctrine), ADR 0002 (typed edges), the boundary-marker and descriptor-snapshot patterns established across `src/model/` and pinned by `tests/safety/`, and the trust-tier rules (`model_proposed_pending_human_review` as a decoration on `unverified`, `src/workshop/view-model.ts`).

Directive source: `docs/strategy/mcp-and-skills-direction.md` (operator direction memo, 2026-06-12 — normative for rationale, threat model, phasing detail, and external citations; this ADR records the decision and the enforcement contract).

Milestone chart: this ADR deliberately does not restate the milestone chart. The in-repo source of truth is `docs/strategy/roadmap.md` (living). Historical origin: `docs/reviews/big-picture-review-2026-06-11.md` (frozen).

## Context

Industry standardization is settled fact: the Model Context Protocol (stable spec 2025-11-25; governance donated to the Agentic AI Foundation, a Linux Foundation directed fund, December 2025) and Agent Skills (open specification released 2025-12-18; 30+ adopting tools within a quarter). Each standard bundles a protocol/format we want with a default wiring we reject. The default MCP wiring hands tool descriptors to a model and lets next-token prediction choose invocations — the trust model Atliera's architecture explicitly rejects. The default skill usage bundles executable scripts — empirically where vulnerabilities concentrate (ecosystem-scale audit: 26.1% of 31,132 third-party skills carried at least one vulnerability; script-bundling skills 2.12× more likely).

Atliera's doctrine: agent proposes, system validates, human ratifies; model-transport tool flags pinned false; evidence custody depends on the model holding zero invocation authority.

## Decision

- **A1:** MCP as schema + transport for *system capabilities*; the harness's orchestrator is the **sole MCP client**. Capability implementations (the evidence fetcher first) are MCP servers. No tool descriptor, server name, or capability schema ever serializes into a model-bound payload.
- **A2:** SKILL.md as packaging for *model instructions* (prompt contracts); execution affordances structurally stripped (no `scripts/`, no executable files, no granting frontmatter); first-party, hash-pinned only; loaded only from the in-repo skills tree.
- **A3 (deferred):** a read-only MCP server over the verified graph, every response carrying trust-tier labels, every serve audited. Post-M5 decision point; exists as a one-page spec only until then.
- **R1 (permanent refusal):** the model-transport flags (`tools`, `web_search`, `plugins`, `mcp`, `retrieval`) stay pinned `"false"` forever; the injection seam continues to reject flips; no L3 invocation path may exist, with no approval format, budget setting, or emergency override that produces one.

## The mediation invariant

> Every model-initiated effect passes through typed validation, budget enforcement, and a defined mediation gate before any system action occurs.

Gate levels (a property of the invocation path, recorded on the execution record):

- **L0 — Deterministic.** Scheduled/system-event-triggered; zero model influence on whether, when, or against what.
- **L1 — Selection within ratified sets.** Model output selects which members of a human-ratified allowlist are acted on, and how many, within hard caps. The model cannot add members.
- **L2 — Model-proposed, human-ratified.** Novel targets/parameters execute only after a human ratifies the specific proposal, consuming a one-shot approval. L2 is impossible before the M3 ratification surface ships, and any L2 path requires its own ADR amendment, landing no earlier than after M5.
- **L3 — Model-proposed, auto-executed. Forbidden. Permanently.**

Model output MAY influence: proposal content; L1 selection; iteration cardinality strictly within budget caps. Model output MAY NOT influence: step order; gate level; retry triggering (deterministic policy with hard caps); registry contents; allowlist membership; approval state; budget values.

## Vocabulary (normative)

- **capability** = system-side, registry-entered, orchestrator-invoked.
- **skill** = instruction package (SKILL.md), model input only. NOTE: this is narrower than ecosystem usage, which permits bundled execution; in this repository it never does.
- **tool** = used only when referring to the pinned-false model-transport flags.

Forbidden phrases — these must not appear in code, comments, docs, or commit messages (enforced by `tests/safety/forbidden-phrases.test.ts`, whose allowlist is fixed to the direction memo and this ADR; allowlist additions require operator sign-off):

- "the agent's fetcher tool"
- "give the model access to"
- "let the model call"
- "the model's MCP"
- "skill execution"

## Invariants and enforcement

Each invariant is bound to a named CI test. Phase 0 lands I-1, I-2, and the I-9 loader-path tripwire plus the forbidden-phrase lint; the remaining tests land with the phases that introduce their subject matter (see `docs/strategy/roadmap.md`) and their names are reserved now.

| Invariant | Test (normative name) | Lands |
| --- | --- | --- |
| I-1 Model-transport flags pinned `"false"`; seam rejects flips | `test_model_transport_flags_pinned_false` | Phase 0 (reaffirms existing behavior) |
| I-2 No capability schema/descriptor in any model-bound payload | `test_no_capability_descriptor_in_model_payload` | Phase 0 (tripwire) |
| I-3 MCP client import/topology isolation from model transport | `test_mcp_client_import_isolation` | H2 |
| I-4 No invocation without consumed approval or approved schedule | `test_capability_invocation_requires_consumed_approval_or_schedule` | H2 |
| I-5 Descriptor hash pinned at approval; live hash must match at invocation | `test_descriptor_hash_match_at_invocation` | H2 |
| I-6 Fetch targets in ratified allowlist; enforced at orchestrator and network layer | `test_fetch_target_in_ratified_allowlist` | M4 |
| I-7 Fetched content provenance-tagged, enters model context as untrusted quoted material | `test_fetched_content_provenance_tagged` | M4 |
| I-8 Skill packages carry no execution affordances; loader rejects | `test_skill_package_rejects_execution_affordances` | M2.5 |
| I-9 Skills first-party and hash-pinned; no third-party load path | `test_skill_hash_pinned_first_party`, `test_no_third_party_skill_load_path` | M2.5; loader-path tripwire in Phase 0 |
| I-10 Retry budgets deterministic, hard-capped, part of the approval | `test_retry_budget_enforced` | H2 |
| I-11 Every capability invocation emits audit + accounting at the choke point | `test_capability_invocation_emits_audit_and_accounting` | H2 |
| I-12 Approval lifecycle never simplified to MCP-level authorization | (review-enforced; no single test) | standing |

A red on any of these is a doctrine breach, not a flake.

## Consequences

Benefits:

- M4 becomes integration-and-hardening rather than invention; a single client choke point is where budgets and audit events live.
- Schema convergence: typed descriptors with JSON Schema I/O match what the validators already want.
- Legibility: "we speak MCP; the harness holds the client" explains the architecture in one sentence.
- Outward interop option (A3) preserved without commitment.

Costs and standing obligations:

- Fork audits for any third-party server code (fork into our org, pin the commit, diff-audit updates, never auto-track upstream).
- Sandbox upkeep; network-layer egress enforcement independent of orchestrator policy.
- An adversarial injection corpus for fetched content, owned as part of M4's definition of done.
- The temptation gradient: once an MCP client exists, exposing it to the model is a configuration change, not a refactor. Mitigated structurally — I-2's payload tripwire, I-3's isolation, the forbidden-phrase lint, and this ADR naming the failure mode.

Reversibility: the Capability Registry and Mediation Gate are ours; servers behind the client can be replaced by in-process implementations behind the same registry interface without touching proposals, validators, approvals, or contracts. Full retreat costs transport plumbing, not kernel rearchitecture.

Spec pinning: implement against MCP 2025-11-25 stable. Do not chase release candidates; revisit after GA via the registry's version field, behind descriptor-hash pinning.

## Deferred

- A3 one-page outward-server spec (post-M5 decision; see the direction memo §7, Phase A3).
- Any L2 invocation path (post-M5; own ADR amendment).
- Spec upgrade past 2025-11-25 (post-GA review).
- Process-level (out-of-process) client isolation if the runtime's process model does not yet allow it; the import-graph assertion is the floor (I-3).
