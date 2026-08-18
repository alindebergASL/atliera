# Calm everyday experience contract

Status: **Owner-directed; proposed in-repository ordinary-experience authority pending merge.**

Parent decision: [`calm-product-hard-pivot.md`](calm-product-hard-pivot.md)

This contract defines Level 1 of one Atliera product. It is not a beginner mode, a simplified skin over the Package Inspector, or implementation authority.

## Experience promise

A competent first-time user should understand an account, why it matters now, and the recommended next move with little or no training.

> **Answers first. Evidence on demand. Machinery by invitation.**

The product should feel as though Atliera performed substantial work in the background. The user should spend attention on business meaning and judgment, not on manually processing excerpts or learning internal object models.

## Primary users and jobs

The long-term ordinary experience serves people preparing for account decisions and conversations, including account leaders, sellers, executives, strategists, customer-success leaders, and domain specialists.

The **initial implementation and zero-training acceptance persona** is narrower: a competent B2B account lead or seller who owns account understanding and must prepare for a 15-minute executive customer conversation. This persona is the first Account Home and `Prepare for…` design target. Executives consuming a briefing, customer-success leaders, strategists, and domain specialists are later or separate evaluation cohorts; their results must not be mixed into the initial 5–8-user pass rate.

Their core jobs are:

1. Understand an account quickly.
2. See why the account matters now.
3. Recognize meaningful changes, tensions, people, initiatives, and opportunities.
4. Decide the next useful move.
5. Prepare for a specific audience and outcome.
6. Trust the result without studying the machinery.
7. Return later to see what changed.
8. Share or approve a reproducible output when authorized.

Core journeys must not require configuration, report building, ontology knowledge, object administration, or Atliera-specific training.

## First minute

Within 60 seconds of the Account Workspace becoming usable, a first-time user must be able to answer:

- Who is this account?
- Why does it matter now?
- What meaningfully changed?
- Who and what matter?
- What should I do next?

The first screen should contain, in this order:

1. account identity and one-sentence readout;
2. why now / what changed;
3. why it matters;
4. one recommended next move;
5. a quiet trust and freshness line;
6. the obvious `Prepare for…` action;
7. only then, additional relevant people, initiatives, opportunities, tensions, and open questions.

Evidence, audit language, source registers, internal classifications, and package mechanics must not displace those answers above the fold.

## Account Workspace contract

### Account readout

Show a concise, prioritized understanding of the account rather than a collection of independent objects. It should distinguish fact, interpretation, and recommendation without making the user parse internal taxonomies.

Required content when supported:

- a one-sentence account thesis;
- why the account matters now;
- the most meaningful change;
- relevant people and stakeholders;
- important initiatives and priorities;
- tensions, constraints, or decision landscape;
- opportunities and guardrails;
- the recommended next move;
- open questions that materially affect the recommendation.

Hide any module whose content is empty, irrelevant, duplicative, unsupported, or below the presentation threshold. Do not render empty columns, placeholder cards, or disabled future features.

### Quiet trust line

The default trust summary should answer, in plain language:

- how much of the important readout is source-backed;
- how current the evidence is;
- whether conflicts, gaps, or stale material need attention;
- whether the output is draft or reviewed.

Example shape:

> Source-backed across 5 sources · Current through June 25 · 2 items need review

The exact values must be derived honestly. The line must not compress materially distinct states into a false assurance.

### One primary action

The ordinary screen has one obvious primary action: `Prepare for…`.

Secondary actions may include `Update`, `Monitor`, or `Share` only when they are implemented and relevant. No control may claim to save, accept, ratify, publish, apply, persist, monitor, or share unless that action actually occurs and its resulting state is visible.

## `Prepare for…`

The preparation journey asks for only two required inputs:

1. **Who is this for?**
2. **What outcome do you want?**

Provide sensible editable defaults for:

- date and time;
- scope;
- evidence cutoff;
- output format;
- duration;
- internal versus shareable posture.

Do not require the user to select internal records, configure a report, choose an ontology, understand Signals/Maps/Plays, or manually bind evidence.

The prepared output should include, where relevant:

- executive thesis;
- recommended first move;
- account tensions and decision landscape;
- relevant stakeholders;
- opportunities and guardrails;
- open questions;
- meeting objective;
- ordered questions, why each is asked, desired learning, and follow-up signals;
- one overall close criterion;
- evidence available within two interactions.

If Atliera lacks sufficient current information, say so before presenting a confident plan and route the specific exception for review.

## Review by exception

Ordinary users do not review every excerpt or internal object. Atliera asks for judgment only when it matters.

Surface an exception when there is:

- conflicting evidence;
- stale or materially incomplete evidence;
- unsupported or consequential inference;
- an alternative interpretation that changes the recommended move;
- a commercially sensitive recommendation;
- a correction that affects reviewed understanding;
- durable ratification;
- publication, outbound action, or external commitment.

Each exception should state:

1. what needs judgment;
2. why it matters;
3. the smallest useful evidence set;
4. the available truthful decisions;
5. what each decision will and will not do.

A decision control must not be shown unless it changes a real, inspectable state. Local browser decoration is not acceptance, ratification, or persistence.

## Briefing and export

A reviewed snapshot may project into an interactive briefing, document, deck, proposal, RFI, RFx, or other audience-specific output.

All projections must:

- derive from the same frozen snapshot;
- preserve the distinction between source-backed information and interpretation;
- carry a concise status/freshness summary;
- preserve exact evidence links;
- avoid exposing raw control-plane detail by default;
- make draft, reviewed, approved, shared, and published states unambiguous;
- never claim publication, sharing, approval, or persistence before it occurs.

The external and nonbinding Stanford CIO briefing named by the owner is the quality reference for audience-specific output, but no exact Stanford/CIO artifact exists in the verified repository. This contract therefore adopts the owner-stated qualities without claiming visual or byte-level inspection of that artifact.

## Monitor and update

Monitoring is an ordinary workflow only when a real monitoring capability exists.

The Account Workspace should then show:

- what changed since the last reviewed snapshot;
- whether the change affects the account thesis or next move;
- new, stale, contradicted, or resolved material;
- the smallest exception set requiring attention;
- a clear path to prepare a new output from updated state.

Later evidence creates a delta for future understanding. It must not silently rewrite an earlier reviewed briefing, approval, or publication. Historical snapshots remain reproducible.

## Required states

### Loading

- Preserve the account and task context.
- Use calm progress language tied to meaningful stages, not internal pipeline names.
- Do not imply AI research, source retrieval, or synthesis before it actually begins.
- Do not expose raw job IDs, provider routes, queues, manifests, or retries.
- If the expected wait is material, let the user leave and return without losing the task.

### Partial

- Show useful supported answers that are ready.
- State what is missing and whether it could change the recommendation.
- Do not fill gaps with generic prose or unsupported confidence.
- Keep `Prepare for…` available only if the partial state is sufficient for the requested outcome; otherwise route the precise exception.

### Empty

- Explain the smallest next step, usually entering an organization or allowing approved research.
- Do not render empty modules, lens columns, dashboards, or setup checklists.
- Do not blame the user for missing configuration when Atliera can choose sensible defaults.

### Stale

- Show `Current through <date>` in plain language.
- Explain what may have changed and whether the next move is affected.
- Offer `Update` only when update is implemented and authorized.
- Never present a stale answer as current because a package itself is internally valid.

### Conflict

- Present the competing interpretations in business language.
- Show the evidence and dates needed to resolve the conflict.
- Explain how each interpretation affects the recommendation.
- Deterministic rules may close only a narrowly defined identity, duplicate, parsing, or exact-data error that does not require business interpretation.
- Approved research may gather more evidence but may not silently choose a consequential interpretation.
- Keep any conflict that could change account meaning, prioritization, or recommendation as a human-review exception.

### Error

- Preserve completed work and user inputs.
- State what failed in plain language and what remains usable.
- Offer a truthful retry only when a retry is actually available and authorized.
- Never expose credentials, raw provider responses, stack traces, package internals, or control-plane identifiers.

## Canonical customer-visible lifecycle

Support, review, durability, audience approval, and delivery are independent dimensions. A single badge must never collapse them.

| Dimension | Internal state | Level 1 language | What it does not imply |
| --- | --- | --- | --- |
| Origin/support | unsupported, source-backed, interpreted | `Not yet supported`, `Source-backed`, `Draft interpretation` | Human review, freshness, durability, or approval |
| Review disposition | draft, needs review, reviewed | `Draft`, `Needs review`, `Reviewed` | Durable ratification, snapshot freeze, audience approval, or delivery |
| Durability/ratification | ephemeral, ratified immutable snapshot | `Not yet saved as a snapshot`, `Reviewed snapshot` | Audience approval, sharing, publication, or currentness after the cutoff |
| Audience approval | not approved, approved for named audience/use | `Not approved`, `Approved for <audience/use>` | Delivery or publication |
| Delivery | not shared, shared, published | `Not shared`, `Shared`, `Published` | Broader approval or currentness beyond the exact delivered snapshot |

Rules:

- `Reviewed` alone means that a human review disposition exists for the exact content; it does not mean ratified or durable.
- Internal `Ratified` maps to `Reviewed snapshot`, not bare `Reviewed`.
- Snapshot approval may occur only after the content is reviewed and durably frozen under the applicable authority.
- `Approved` always names the audience or use when ambiguity is possible.
- `Shared` and `Published` appear only after the corresponding effect completed and was recorded.
- When two dimensions matter, show both compactly, for example `Reviewed · Not yet saved as a snapshot` or `Approved for CIO briefing · Not shared`.

## Plain-language vocabulary

Level 1 uses business language. Internal terms may remain in the data model and deliberate expert surfaces.

| Internal term | Everyday language |
| --- | --- |
| Signal | What changed |
| Map | Account landscape / What it means |
| Play | Recommended next move |
| Pending | Needs review |
| Ratified | Reviewed snapshot |
| Evidence current through | Current through |
| Package-attributed only | Attributed in this package (expert view; not a Level 1 source-backed claim) |
| Authenticated/admitted source custody plus accepted exact support | Source-backed |
| Unsupported | Not yet supported |
| Contradicted | Sources disagree |
| Proposal | Draft interpretation / Draft recommendation |
| Graph snapshot | Account snapshot; `Reviewed snapshot` only when the separate review and ratification states are true |
| Delta | What changed since the snapshot |

Plain language must not weaken semantics. `Source-backed` may be used only when the relevant source-authentication/custody admission and accepted exact-support contracts are both satisfied. Package self-consistency or package attribution alone is insufficient. `Reviewed` must not imply factual verification, durable ratification, snapshot approval, publication, or currentness beyond the state actually established.

## Information prohibited from default screens

Do not show these on Level 1 unless the user deliberately opens an expert surface:

- package identities or package hashes;
- internal record IDs;
- graph IDs, bindings, or edge identifiers;
- byte spans, offsets, or transformation manifests;
- request/canonical/execution hashes;
- execution identities or replay keys;
- acquisition, provider, database, graph, deployment, and effect counters;
- authority-state machine terminology;
- raw custody or retention machinery;
- proposal taxonomy;
- validation-kernel terminology;
- source-by-source Accept/Reject controls;
- repeated legalistic trust warnings;
- provider, model, prompt, queue, or adapter configuration;
- disabled controls or roadmap placeholders.

## Evidence within two interactions

For any important Level 1 statement:

1. the first interaction opens a readable evidence view with the claim, exact excerpt or exact values, source identity, relevant date, and plain trust status;
2. the second interaction may open deeper source context or authorized technical detail.

The user must retain account context and return position. The path must not require navigating a source register, searching by internal ID, or understanding bindings.

## Experience acceptance

This contract is not satisfied by an attractive mockup, technically valid renderer, passing screenshot, or product-team walkthrough. Representative first-time users must pass [`zero-training-product-acceptance-gate.md`](../qa/zero-training-product-acceptance-gate.md).

## Non-authorization

This contract does not authorize product implementation, research, provider use, persistence, ratification, publication, deployment, or external action.
