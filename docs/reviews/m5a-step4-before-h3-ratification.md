# M5a Step 4 Before H3 Ratification

Status: operator-ratified sequencing decision

Date: 2026-07-10

Prepared against: `main` at `dc0381fb539df85ed1fa814ad0969d73d6b07d78`

Durable source of milestone status: `docs/strategy/roadmap.md`

## Decision provenance

The earlier **agent recommendation**, preserved as historical evidence in `docs/reviews/m3-retro.md` and developed into the plan merged through PR #277, was to implement H3 first and pair H1 with M5a. That recommendation was advisory; it was not operator ratification and did not itself authorize implementation or effects.

The **operator ratification** recorded here supersedes that recommendation for current sequencing. M5a is in progress because Steps 1–3 merged through PRs #278 (`6205c4a`), #279 (`d09ac17`), and #280 (`dc0381f`). M5a Step 4 is the next implementation slice and proceeds before H3 implementation unless a concrete Step-4 safety blocker emerges.

H3's plan is complete and merged, but H3 implementation is queued until after the M5a capstone and M5a retro unless that concrete blocker requires it. H1 is not a prerequisite for, or paired with, Step 4. The M5a retro will re-evaluate H1/H2/H3 implementation order from then-current evidence.

## Ratified rationale

The M5a shared helpers are already hardened across Steps 1–3. Cross-layer H3 consolidation immediately before the capstone enlarges the regression surface without proving more product value. This is a sequencing judgment, not a rejection of the H3 plan or its eventual safety value.

The product-track sequence remains **M3 → M5a → M4 → M5b**.

## Exact Step 4 implementation boundary

Step 4 may implement exactly one bounded path:

- step_4_valid_armings_consumed: 1
- step_4_recorded_curated_proposals_executed: 1
- step_4_durable_local_writes: 1
- step_4_durable_local_write_read_backs: 1
- step_4_workshop_artifacts_rendered: 1

No adjacent risk class enters the slice:

- step_4_provider_calls: 0
- step_4_system_side_acquisitions: 0
- step_4_private_evidence_reads: 0
- step_4_retries: 0
- step_4_production_writes: 0
- step_4_deployments: 0
- step_4_readiness_claims: 0

## Authority and effect boundary

This ratification authorizes implementation work for the bounded M5a Step 4 slice. It is not an execution approval and does not itself consume an arming, execute a proposal, perform a write or read-back, render an artifact, or execute any other effect. A valid one-shot arming and Step 4's deterministic checks remain required at the eventual execution boundary.

- implementation_work_authorized: M5a-step-4
- current_effective_authorization: none
- authorizes_flow_execution: false
- authorizes_durable_write_effect: false
- authorizes_provider_call: false
- authorizes_system_side_acquisition: false
- authorizes_private_evidence_read: false
- authorizes_retry: false
- retry_budget: 0
- retry_requires_new_approval: true
- authorizes_production_write: false
- authorizes_deployment: false
- authorizes_graph_ingestion: false
- decision_flow_executions_performed: 0
- decision_durable_writes_performed: 0
- decision_durable_read_backs_performed: 0
- decision_workshop_artifacts_rendered: 0
- readiness_claim: false
- production_readiness_claim: false
- product_readiness_claim: false
- launch_readiness_claim: false

## Doctrine fit

The decision follows **agent proposes → deterministic validation → human ratifies → durable graph**: the prior recommendation remains attributable to the agent, this record attributes the sequencing choice to operator ratification, tests lock the decision's load-bearing properties, and only a later valid Step 4 execution may create durable effects. MCP remains behind the orchestrator, and `SKILL.md` remains instruction-only; this decision adds no direct model capability or tool path.
