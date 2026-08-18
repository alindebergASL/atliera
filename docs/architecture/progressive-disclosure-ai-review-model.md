# Progressive disclosure, AI, and human-review model

Status: **Accepted; effective on merge as the disclosure, AI, and human-review authority.**

Parent product decision: [`../strategy/calm-product-hard-pivot.md`](../strategy/calm-product-hard-pivot.md)

Ordinary experience contract: [`../strategy/calm-everyday-experience-contract.md`](../strategy/calm-everyday-experience-contract.md)

This document changes no trust, validation, authorization, persistence, or execution boundary. It specifies how one product reveals power without turning internal machinery into the ordinary experience.

## One product, three disclosure levels

Progressive disclosure is not a split between a simplified product and the real product. Level 1 is the primary Atliera product. Levels 2 and 3 deliberately reveal more of the same account state to users whose job and authorization require it.

### Level 1 — Everyday

The default-visible density budget is exactly one account thesis, one meaningful change, one implication, one recommended next move, one compact trust/freshness line, and no more than three secondary items total.

Show:

- concise account readout;
- why now;
- what changed;
- why it matters;
- at most a small capped secondary set of people, initiatives, tensions, opportunities, guardrails, or open questions;
- one recommended next move;
- quiet source-coverage, freshness, and attention summary;
- in C1, one truthful `View meeting plan` or `View evidence` action; from C3 onward, one `Prepare for…` action that launches the real minimal journey.

Use plain language. Hide raw control-plane terminology, evidence mechanics, scoring, provenance, and uncapped people/initiative/opportunity modules until deliberate exploration.

### Level 2 — Researcher or power user

Allow deliberate access to:

- claims and exact excerpts;
- source quality, coverage, and relevant dates;
- inference rationale;
- conflicts and alternative interpretations;
- freshness and staleness;
- confidence and scoring with their limitations;
- version and delta comparisons;
- deeper stakeholder, initiative, opportunity, and recommendation analysis.

Level 2 helps a user challenge or refine understanding. It does not expose credentials, arbitrary execution, or unrestricted audit machinery.

### Level 3 — Audit or developer

Allow deliberate, appropriately restricted access to:

- package and snapshot identities;
- internal IDs;
- hashes and byte spans;
- graph bindings;
- manifests and validation receipts;
- execution identities and replay records;
- authorization and effect boundaries;
- developer diagnostic output.

Level 3 is where the M5b Package Inspector belongs. It remains valuable for verification, audit, incident analysis, reproducibility, and development. It is not a customer-homepage template.

## Information mapping

| Information | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Account identity | Name, domain, concise readout | Identity alternatives and source coverage | Subject, team, account, and package identifiers |
| Meaningful change | Plain answer, date/status, why it matters | Claim, exact excerpts, alternatives, freshness | Evidence IDs, spans, bindings, hashes, manifests |
| Interpretation | What it means, clearly distinguished from fact | Rationale, confidence, assumptions, counter-evidence | Proposal/claim/object records and validation receipts |
| Recommendation | One recommended next move and guardrails | Competing plays, dependencies, sensitivity | Internal proposal IDs, topology, policy and package bindings |
| People/initiatives | Relevant prioritized summary | Full relationship/initiative analysis | Underlying records, edges, provenance, diagnostic payloads |
| Trust | Quiet coverage/freshness/attention line | Per-claim support, conflicts, source quality | Full custody, retention, validation, authorization, and execution detail |
| Lifecycle | Support/origin, review disposition, snapshot durability, audience approval, and delivery shown independently under the everyday contract | Decision history, rationale, affected material, and snapshot lineage | Ratification records, immutable receipts, replay and audit identities |
| Change over time | What changed since reviewed snapshot | Version comparison and affected conclusions | Snapshot/revision identities, canonical hashes, immutable history |
| AI participation | `AI-assisted` only when actual; otherwise accurate source such as `Prepared context` | Run purpose, synthesis boundaries, limitations | Provider/model/run/manifest records when authorized and retained |

## Evidence within two interactions

Any material Level 1 statement must support this path:

1. **Evidence view** — one interaction opens the statement, exact supporting excerpt or exact values, source identity, relevant date, and plain trust status.
2. **Source or technical detail** — an optional second interaction opens fuller source context or authorized Level 2/3 detail.

The interaction count excludes ordinary scrolling but includes links, disclosure controls, tab switches, or navigation. The path fails if the user must search a source register, copy an internal ID, open a product report, or understand a binding graph.

Simplifying language never allows Atliera to:

- call unsupported material source-backed;
- call unreviewed material reviewed;
- call a draft approved, published, saved, or durable;
- collapse freshness, factual support, human review, and publication into one badge;
- imply complete source custody when only bounded excerpts are present;
- imply AI synthesis when no AI synthesis occurred.

## Present-state AI participation

Repository evidence at `origin/main` `debe88d80d0f92c9d5103eacd24168eba76e886d` shows a **gated-zero-default** product runtime:

- `docs/architecture/agentic-ai-usage-baseline.md` records zero default-path provider calls, no autonomous tool loop, no app/worker route invoking normal model generation, and no runtime/model-mode integration.
- `src/runtime/workshop-preview.ts` and the fake-mode Workshop path deterministically project existing graph state and report zero provider calls and zero production writes.
- `PROMPT_CONTRACTS`, `AgentRunRecord`, provider interfaces, activation gates, and validation harnesses are future-facing or bounded validation seams; their presence does not prove a running product agent.
- `src/workshop/m5b-product-review-prepare.ts` renders account answers, proposal narratives, caveats, meeting plans, and account names from strict request data. It labels those fields as request-supplied and performs no provider call.
- Synthetic M5b tests use `tests/fixtures/m5b-product-review-synthetic.ts`; fixture-authored content is not AI-generated account understanding.
- Historical bounded provider validation records prove only their named approved slices, not ordinary product AI behavior.

Therefore the current customer-facing truth is:

- validated or source-backed data may be projected deterministically;
- some interpretation and recommendation content is request-supplied or fixture-authored;
- the ordinary runtime does not yet perform background AI research and synthesis;
- current surfaces must not say or imply that Atliera AI created an account thesis unless a future approved run actually did so and retained the required evidence.

## Intended AI-background model

When separately implemented, approved, and evidenced, Atliera should perform these tasks in the background:

- source discovery and approved retrieval;
- extraction and canonicalization;
- deduplication and entity resolution;
- exact excerpt proposal;
- comparison and contradiction detection;
- claim and account-object proposal;
- synthesis and prioritization;
- freshness checks;
- change detection;
- stakeholder, initiative, opportunity, and recommendation analysis;
- audience-specific briefing preparation.

AI output remains untrusted proposal input. It cannot bypass deterministic validation, evidence admission, trust labeling, authorization, or immutable snapshot rules. Scheduled recurrence and automated change detection remain post-M7/C6; C2 may perform only one bounded approved run over admitted inputs.

## Required C2 Background Intelligence / AI Proposal proof

Broad customer-product acceptance requires a named C2 vertical slice after the deterministic Account Home. It must:

- execute an actual governed model/provider call under explicit provider, model, budget, run, and retry authority;
- consume admitted source-grounded research or synthesis input rather than treating request prose or fixtures as product intelligence;
- retain source → excerpt → claim/proposal lineage and exact execution identity;
- label every model result as untrusted and proposed;
- pass deterministic schema, reference, excerpt, and support validation;
- route every consequential conflict or commercially sensitive inference to human judgment;
- perform no direct ratification, durable truth write, publication, send, or outbound effect.

Acceptance requires at least one genuinely model-produced account thesis, meaningful change, implication, or recommended next move grounded in admitted evidence. Replaying text supplied in the request, fixture, or expected output does not satisfy C2.

## Automatic, proposed, judged, and authorized work

### Automatic when implemented and approved

The system may automatically perform bounded, reversible, non-consequential work such as:

- deterministic parsing and validation;
- duplicate detection;
- source/claim linkage checks;
- freshness calculation;
- conflict detection;
- ranking under a reviewed policy;
- safe projection of already admitted state;
- preparation of proposed summaries and recommendations;
- identification of exceptions requiring judgment.

Automatic operation must remain inside the active source, provider, budget, data, and runtime authority.

### Remains proposed

Until the relevant trust rules are satisfied, these remain visibly proposed:

- AI-written account thesis;
- inferred stakeholder role or relationship;
- causal interpretation;
- opportunity or risk assessment;
- recommendation or outreach angle;
- meeting plan;
- correction that changes reviewed understanding;
- output intended for an external audience.

A deterministic validator can prove shape, references, exact excerpts, and policy thresholds. It cannot by itself prove commercial wisdom, complete truth, currentness beyond available evidence, or suitability for external use.

### Requires human judgment

Request human attention by exception for:

- conflicting evidence that changes account meaning;
- stale or materially incomplete coverage;
- unsupported or consequential inference;
- commercially sensitive recommendations;
- ambiguous corrections;
- a recommendation whose alternatives materially differ;
- approval of reviewed understanding;
- external-audience fitness.

The user reviews the smallest affected material, not every underlying object.

### Requires explicit authorization

These remain separate consequential boundaries:

- source acquisition or private-custody access;
- provider/model execution and spend;
- graph or database write;
- durable ratification;
- immutable snapshot publication;
- send, share, export to an external system, or outbound action;
- external commitment;
- deployment or production mutation;
- retry where authority is single-use or effects may already have occurred.

No UI control or AI plan is authority. Authorization must be established by the applicable typed and authenticated boundary, and effects must be accounted honestly.

## Deterministic validation boundary

The existing trust architecture remains authoritative:

- source text and source identity are distinct from extracted excerpts;
- excerpts must match admitted stored source text/spans under the applicable rules;
- claims and objects must use valid references;
- verified or high-confidence intelligence requires accepted support;
- proposal self-hashes are integrity identities, not authentication or ratification;
- provider responses, request-supplied content, and fixtures are untrusted inputs;
- every customer/expert renderer must contextually escape untrusted text, reject unsafe URLs and active markup, and preserve the existing hostile-input/rendering defenses; progressive disclosure never relaxes input or output safety;
- package self-consistency is not source-custody authentication;
- human review, quality assessment, durability, currentness, and publication are distinct states;
- immutable prior artifacts are not rewritten by a successor package or snapshot.

See `provenance-and-validation.md`, `durable-adapter-contracts.md`, and the applicable runbooks for the exact current implementation boundaries.

## Exception-review propagation

The following is a required future behavior, not a present capability claim. At the verified baseline:

- candidate deltas append records and reject duplicate identities rather than performing semantic edits;
- the versioned graph store exposes current state, not a complete product history reader;
- package supersession binds a predecessor digest and preserves old bytes by contract but does not prove predecessor possession by itself;
- typed correction/tombstone/dependency-invalidation edges and automatic downstream recomputation do not yet exist;
- generic M5b ratification/apply and durable correction propagation are absent.

A future correction or exception must propagate without rewriting history:

1. Identify the affected claim, interpretation, recommendation, and output dependencies.
2. Preserve the prior source, evidence, proposal, review, snapshot, and output identities.
3. Create a new proposed correction or delta with its supporting and contradicting evidence.
4. Re-run deterministic validation on the complete affected candidate state.
5. Ask for human judgment only on the material changed by the correction.
6. Require explicit authorization before durable ratification or publication.
7. Freeze a new reproducible snapshot if approved.
8. Render future outputs from the new snapshot.
9. Keep prior briefings and publications reproducible from their original snapshots, visibly superseded where applicable but never silently rewritten.

A later source may change current understanding. It does not retroactively change what was known, reviewed, or published at an earlier time.

## Trust language without semantic loss

| Precise internal state | Permitted ordinary language | Required limitation |
| --- | --- | --- |
| Authenticated/admitted source custody and accepted exact support exist for the statement | Source-backed | Package attribution or self-consistency alone is insufficient; does not imply completeness, currentness, or human review unless separately true |
| Human review recorded for the exact understanding | Reviewed | Does not imply publication, source truth, or quality pass unless separately true |
| Conflicting support exists | Sources disagree | Show the consequential alternatives |
| Evidence cutoff is known | Current through `<date>` | Do not imply current after that date |
| Content is proposed/request-supplied/fixture-authored | Draft interpretation / Prepared context | Do not attribute it to AI or sources as fact |
| Immutable reviewed snapshot exists | Reviewed snapshot | Do not imply later evidence has been incorporated |
| Technical package is internally self-consistent | Package check passed (Level 3 only) | Does not authenticate custody or authorize use |

## Subject, tenant, and route boundary

Progressive disclosure is not access control. Every customer-accessible account surface must authenticate the user and authorize the exact team/account subject before reading or rendering account data. Internal IDs, URL obscurity, a bearer token without subject/role binding, or an `Internal` label are insufficient.

The current local bearer seam proves deny-by-default token handling for a fake-mode route; it is not a role/tenant authorization system. Because the recommended first Account Home slice excludes identity and deployment, it must remain a repository-safe local/test projection over fixture or otherwise already-authorized local input. It must not add or deploy a customer route. A later route requires a separately approved identity/subject-scope slice with cross-team/account denial tests before any data read.

Level 2 and Level 3 also require deliberate role authorization. The Package Inspector must never be reachable merely because a user can guess a path.

## Current renderer classification

The M5b `workshop-pre-ratification.html` surface is Level 3 Package Inspector / Audit View material even when it contains readable account sections. The generated `meeting-brief.md` is likewise an internal pre-ratification review artifact, not the baseline for future audience briefings rendered from an authorized reviewed snapshot. Their package labels, proposal content, IDs, source register, hashes, and effect boundaries are diagnostic/review truth, not Level 1 product information architecture.

Retaining that surface is required. Using it as the customer UX baseline is prohibited by the parent decision. `Internal` labeling or a hard-to-find URL is not authorization: until a role-based internal access boundary exists, a customer build/route/navigation must not expose the inspector.

## Non-authorization

This model authorizes no implementation, provider call, source operation, graph/database write, ratification, publication, deployment, or external effect.
