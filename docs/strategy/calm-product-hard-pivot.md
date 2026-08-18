# Atliera calm product hard pivot

Status: **Owner-authoritative decision; proposed in-repository authority pending merge.**

Decision date: 2026-08-18

Owner decision: `ATLIERA_CALM_PRODUCT_HARD_PIVOT_DOCUMENTATION_SLICE_01`

## Governing rule

> **Answers first. Evidence on demand. Machinery by invitation.**

Atliera is a calm, AI-native account-intelligence product that a competent first-time user can use with little or no training. The ordinary experience is the primary product, not a simplified beginner mode. Researcher, power-user, audit, and developer capabilities are progressively disclosed only when deliberately requested.

The owner decision is binding for future customer-product direction. This tracked artifact becomes the in-repository authority when merged. It does not authorize implementation, provider calls, research, data access, persistence, ratification, publication, deployment, or any other operational effect.

Boundary markers:

- implementation_work_authorized: none
- implementation_start_condition: none
- current_effective_authorization: none
- provider_calls_authorized: false
- source_acquisition_authorized: false
- private_custody_access_authorized: false
- graph_or_database_writes_authorized: false
- ratification_or_publication_authorized: false
- deployment_authorized: false
- readiness_claim: false

## Verified repository baseline

The documentation slice began from a fresh isolated worktree at:

- `origin/main`: `debe88d80d0f92c9d5103eacd24168eba76e886d`
- tree: `cf76732101b39a9b9f7828aac533932ba3fe5d79`
- open pull requests at inspection: none

PR #311, [feat(m5b): structure meeting brief discovery plan](https://github.com/alindebergASL/atliera/pull/311), exists and is merged:

- base at merge: `57425bb4f0e4d828788f902a38286260301dda82`
- feature head: `973ed86a2b3d9c9c802213bf08de112d73a4c0bf`
- feature tree: `cf76732101b39a9b9f7828aac533932ba3fe5d79`
- squash merge on `main`: `debe88d80d0f92c9d5103eacd24168eba76e886d`

The identities supplied as a trace lead therefore match the merged renderer change. This documentation decision is an independent successor based on the merged main tree. It neither alters nor reopens PR #311, and it does not delete or weaken its package-integrity work.

### Current dense renderer provenance

Repository inspection identifies the current dense M5b account-review artifact as a static prepare output, not the repository's generic fake-mode HTTP Workshop route:

| Responsibility | Repository evidence |
| --- | --- |
| Strict request and meeting-plan contract | `src/workshop/m5b-product-review-contract.ts` |
| Source-pack, review-packet, and proposal package shapes | `src/workshop/m5b-product-review-package.ts` |
| Detached package self-consistency admission | `src/workshop/m5b-product-review-package-admission.ts` |
| Markdown brief and dense HTML renderer | `src/workshop/m5b-product-review-prepare.ts` (`renderM5bProductReviewMeetingBrief` and `renderM5bProductReviewWorkshopHtml`) |
| Prepare CLI | `src/cli/m5b-product-review.ts`, exposed as `m5b:product-review:prepare` in `package.json` |
| Synthetic request/source fixture | `tests/fixtures/m5b-product-review-synthetic.ts` |
| Contract, prepare, rendering, hostile-input, and package-admission tests | `tests/workshop/m5b-product-review-contract.test.ts`, `tests/workshop/m5b-product-review-prepare.test.ts`, `tests/workshop/m5b-product-review-page.test.ts`, and `tests/cli/m5b-product-review-cli.test.ts` |
| Canonical mechanism runbook | `docs/runbooks/m5b-product-review-prepare.md` |
| Generated outputs | `sanitized-source-pack.json`, `candidate.json`, `review-packet.json`, `workshop-pre-ratification.html`, `meeting-brief.md`, and `prepare-result.json` |

The repository's `/workshop` fake-mode route is a separate graph-derived surface implemented through `src/runtime/fake-mode-workshop-server.ts`; it does not route the M5b static artifact. No repository HTTP route was found that serves `workshop-pre-ratification.html`. A screenshot or externally served artifact is not committed in the repository, so the repository can corroborate the renderer code and PR/tree identity but cannot authenticate the exact screenshot bytes or external serving route.

## Product correction

The current dense M5b renderer is **not accepted as Atliera's customer UX baseline**. It is correctly understood as engineering verification and package inspection. It should be retained and explicitly classified as an internal **Package Inspector / Audit View / developer diagnostic**.

The following are useful in that restricted surface but prohibited as the ordinary product experience:

- repeated proposal cards;
- source-by-source Accept/Reject controls;
- controls whose selections are local browser state and do not persist or ratify;
- repeated `request-supplied` labels;
- package, admission, authorization, and effect-boundary terminology;
- raw IDs, hashes, byte spans, bindings, execution identities, and effect counts;
- repeated warnings and legalistic trust language;
- evidence mechanics before account meaning;
- no concise synthesized account understanding or prioritized next action.

This is a product-layer correction, not a finding that the underlying work was wasted or wrong. Exact provenance, validation, authorization, immutable history, reproducibility, security boundaries, and the PR #311 meeting-plan commitment remain load-bearing. The correction is that the machinery supports the experience; it is not the experience.

### What stops, remains, and begins

| Stops | Remains | Begins |
| --- | --- | --- |
| Polishing the M5b Package Inspector into the default customer product | Atliera Graph and the Source → Excerpt → Claim/Proposal → Reviewed Understanding chain | A calm Account Workspace as the default product surface |
| Treating every internal object as default-screen content | Deterministic validation and exact provenance | Answer-first account understanding and a prioritized next action |
| Asking ordinary users to learn package, graph, proposal, custody, authorization, or execution terminology | Bounded authorization and explicit effect gates | Evidence within two deliberate interactions |
| Configuration-first or report-builder-first journeys | Immutable historical snapshots and reproducible outputs | `Prepare for…` as the ordinary primary action |
| Dead, decorative, or non-persisting controls that look consequential | Researcher and audit depth on deliberate access | Human review by exception rather than excerpt-by-excerpt processing |
| Calling fixture-authored or request-supplied prose AI synthesis | Honest origin, trust, and freshness semantics | Background AI research and synthesis only where actually implemented and approved |

## Product identity and stack

Atliera is an evolution of the Account Brief Builder concept without restoring `brief builder` as public product vocabulary or reintroducing legacy report/runtime dependencies.

The intended stack is:

1. **Calm everyday Account Workspace**
   - immediate account understanding;
   - why the account matters now;
   - meaningful changes;
   - important initiatives, people, priorities, tensions, and opportunities;
   - one recommended next move;
   - simple update, monitor, prepare, and share workflows.
2. **Trusted persistent intelligence layer**
   - Source → Excerpt → Claim/Proposal → Reviewed Understanding;
   - exact provenance;
   - freshness and contradiction handling;
   - deterministic validation;
   - bounded authorization;
   - immutable history and reproducible snapshots;
   - reusable account state across users, meetings, and outputs.
3. **Audience-specific outputs**
   - executive thesis;
   - recommended first move;
   - account tensions and decision landscape;
   - relevant stakeholders;
   - opportunities, guardrails, and open questions;
   - meeting plan;
   - exact evidence available within two interactions.

The Account Brief Builder is a reference for the everyday workspace, not a runtime dependency or customer-facing name. The Stanford CIO briefing is a reference for output quality. Neither exact artifact is present in this repository at the verified main tree: repository search found only the architecture prohibition on exposing legacy `brief builder` naming and found no Stanford/CIO briefing artifact. The exact artifacts are therefore **external and nonbinding** under `CONTRIBUTING.md`; the owner-codified product qualities in this decision govern. This documentation records the references and intended qualities but does not claim to have inspected their exact bytes, layout, provenance, or current availability.

The nearest repository-managed output references are `fixtures/workshop/targeted-ciso-meeting-brief-v1.html`, `fixtures/workshop/targeted-proposal-rfx-brief-v1.html`, and their renderer `src/workshop/targeted-brief.ts`. They are synthetic targeted-output examples with useful progressive evidence disclosure. They are not substitutes for the unavailable Account Brief Builder or Stanford CIO artifacts, and they do not define the everyday Account Workspace.

## Binding product requirements

Future customer-product work must satisfy all of the following:

1. Useful immediately.
2. Explainable in two interactions.
3. Powerful when deliberately requested.
4. Little or no training for core account and preparation journeys.
5. Account meaning and a recommended action appear before evidence mechanics.
6. AI performs approved research, extraction, deduplication, comparison, synthesis, ranking, freshness checks, and change detection in the background where those capabilities actually exist.
7. Atliera never implies AI synthesis occurred when content was fixture-authored, request-supplied, user-entered, or deterministically projected.
8. Human attention is requested by exception for conflicting, stale, materially incomplete, unsupported, consequential, commercially sensitive, durable, published, outbound, or externally committing content.
9. Exact evidence remains reachable within two interactions.
10. Raw control-plane detail appears only in deliberate researcher, audit, or developer surfaces.
11. No visible control claims to save, accept, ratify, publish, apply, or persist unless it actually does so.
12. Default screens prioritize the answer instead of exposing every contributing object.
13. Trust semantics remain honest even in plain language.
14. One obvious primary action appears on each ordinary screen.
15. Irrelevant and empty modules remain hidden.
16. Core workflows require no configuration, report building, ontology knowledge, or administration.
17. The product must not become Salesforce-like: dense, configuration-first, object-centric, terminology-heavy, or dependent on days of training.

## Golden everyday journey

The default journey is:

1. The user enters an organization name or domain.
2. The user may optionally state an objective.
3. Atliera performs only approved research and synthesis in the background.
4. The Account Workspace answers:
   - Who is this account?
   - Why does it matter now?
   - What meaningfully changed?
   - Who and what matter?
   - What should I do next?
5. A quiet trust line summarizes source coverage, freshness, and attention items.
6. The obvious primary action is `Prepare for…`.
7. Preparation requires only:
   - Who is this for?
   - What outcome do you want?
8. Date, scope, evidence cutoff, and output formats receive sensible editable defaults.
9. Atliera prepares the audience-specific output.
10. The user reviews only material requiring judgment.
11. Authorized approval freezes a reproducible snapshot.
12. Interactive briefing, document, deck, proposal, or RFx output renders from that snapshot.
13. Later evidence creates a delta for future outputs without rewriting historical snapshots.

The detailed ordinary-experience contract is `calm-everyday-experience-contract.md`. Progressive disclosure, AI participation, exception review, and snapshot propagation are specified in `../architecture/progressive-disclosure-ai-review-model.md`. First-time usability gates are specified in `../qa/zero-training-product-acceptance-gate.md`.

## Bounded implementation sequence

This sequence is a recommendation, not implementation authority:

1. **Reclassify and isolate the current renderer**
   - retain the M5b renderer unchanged as internal Package Inspector / Audit View / test artifact;
   - prevent it from being used as the customer baseline;
   - preserve package and trust behavior.
2. **Calm read-only Account Home**
   - project existing admitted/validated data into an answer-first Level 1 surface;
   - hide empty modules and raw machinery;
   - show one quiet trust line and evidence on demand;
   - add no provider, persistence, schema, authority, acquisition, deployment, or identity scope.
3. **Prepare Meeting**
   - add `Prepare for…` with only audience and desired outcome required;
   - keep other inputs defaulted and editable;
   - generate a meeting-oriented output from the same snapshot.
4. **Exception review and immutable briefing snapshot**
   - collect only conflicts, stale or unsupported material, sensitive recommendations, and publication decisions;
   - freeze authorized outputs without rewriting prior snapshots.
5. **Monitoring and delta**
   - surface what changed since the reviewed snapshot;
   - keep historical outputs reproducible.
6. **Researcher and audit surfaces**
   - progressively expose claim/source quality, alternatives, manifests, hashes, receipts, and execution boundaries to authorized users.
7. **Additional projections**
   - CIO, CISO, engineering, procurement, proposal, RFI, and RFP outputs over the same reviewed account state.

### Exactly one recommended first code slice

After this documentation PR is reviewed and only after separate owner approval, implement one **calm read-only Account Home over existing admitted/validated data**, while retaining the current dense M5b renderer behind an explicit internal Package Inspector boundary.

The slice should be projection-only:

- no provider/model calls;
- no source acquisition or custody reads;
- no new schema, database, graph write, ratification, authorization, identity, or deployment path;
- because identity/tenant authorization is outside the slice, the Account Home remains a repository-safe local/test projection over fixture or otherwise already-authorized local input; it must not add or deploy a customer route;
- no fake AI claims for request-supplied or fixture-authored material;
- one important change with the strongest truthful origin/support label the admitted input allows, concise account meaning, one clearly labeled draft next move, one quiet trust line, and evidence within two interactions; `Source-backed` is permitted only when authenticated/admitted source custody and accepted exact support both exist, otherwise the slice must use the weaker truthful label and cannot claim customer acceptance;
- one obvious, functional `Prepare for…` action that opens the already-admitted structured meeting plan when present; it must not imply that new preparation, AI generation, saving, or persistence occurred;
- the first-slice acceptance scenario must contain an admitted plan; when no plan is admitted, hide the action, show an honest preparation-unavailable state, and do not claim the stage-1 product gate passed;
- no Accept/Reject/save/publish/apply controls;
- no customer navigation, customer route, or customer build may expose the Package Inspector; because identity/roles are outside this slice, the inspector remains available only as a separate local/test artifact or separately operated internal surface until role-based authorization exists—an obscure URL or an `Internal` label is not an access boundary;
- responsive and accessible at the existing desktop/tablet/mobile gates;
- explicit absence handling when admitted data cannot support a module.

Do not begin the interactive `Prepare Meeting` input/generation workflow, monitoring, durable approval, or expert surfaces in that slice. The read-only action above may reveal an already-admitted plan only.

Stage 1 is not a broad-customer-UX acceptance claim. It must pass the applicable read-only subset of the zero-training gate—60-second account/why-now/next-move understanding, 15-second `Prepare for…` discovery, two-interaction evidence, honest origin/state, no raw audit exposure, and no dead controls. The full preparation-completion, exception, approval, and monitoring scenarios remain HOLD until their corresponding stages exist, and the complete 5–8-user gate must pass before broad customer UX is accepted.

## Authority and supersession map

| Artifact | Prospective authority after this decision |
| --- | --- |
| `../adr/0004-calm-product-surface-and-internal-package-inspector.md` | Canonical decision record; becomes in-repository prospective product authority when merged |
| This document | Authoritative product identity, principles, sequence, and customer-direction correction |
| `calm-everyday-experience-contract.md` | Authoritative Level 1 experience and ordinary journey contract |
| `../architecture/progressive-disclosure-ai-review-model.md` | Authoritative disclosure, AI/human review, correction, and trust-presentation model |
| `../qa/zero-training-product-acceptance-gate.md` | Authoritative first-time-user acceptance gate |
| `roadmap.md` | Continues as milestone/status authority; its customer-facing interpretation is constrained by this pivot |
| `../architecture/atliera-product-architecture.md` and ADR 0001 | Remain authoritative for the fresh system, Graph, validation, portability, and core boundaries; `Workshop/Signals/Maps/Plays` naming is internal or expert language where Level 1 plain language replaces it |
| `../architecture/provenance-and-validation.md` | Remains authoritative for provenance, validation, and immutable trust boundaries |
| `../architecture/agentic-ai-usage-baseline.md` | Remains authoritative for present-state AI participation until later implementation evidence changes it |
| `../architecture/synthetic-human-review-loop-v1.md` | Remains a scoped synthetic lab proof, not the customer review journey |
| `fake-mode-workshop-surface-exit-criteria.md` and product-preview records | Remain scoped implementation/validation evidence, not customer UX acceptance |
| `../runbooks/m5b-product-review-prepare.md` | Remains the preferred current generic package-generation mechanism; its HTML is an internal inspector, not the customer product baseline |
| M5a/M5b approval, execution, package, and audit records | Remain immutable historical/scoped evidence; they are neither deleted nor relabeled as wasted work |
| Account Brief Builder and Stanford CIO briefing references | Owner-supplied external references; exact artifacts unavailable in-repo and therefore not claimed as inspected |

Where earlier documentation implies that the dense Workshop, three lens columns, proposal-review grid, or package page is itself the intended ordinary customer experience, this decision supersedes that implication prospectively. Historical claims about what code did, what validation proved, what effects occurred, and what authority was absent remain accurate in their original scope.

## Non-authorization

This document does not authorize the first code slice or any other implementation. It changes no application code, style, fixture, schema, database, graph, source, provider, trust boundary, deployment, or external state. A later implementation requires a separate explicit owner decision after this documentation PR is reviewed.
