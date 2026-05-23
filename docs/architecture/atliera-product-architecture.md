# Atliera Fresh Architecture Plan

> **For Hermes:** This is a plan-first architecture artifact. Do not implement, deploy, or mutate production from this plan without a separate approved implementation/deployment task.

**Goal:** Define the clean-slate Atliera product architecture with Atliera Workshop, Agent, and Graph as the core product structure and Signals/Maps/Plays as launch lenses over the graph rather than premature hard-separated modules.

**Architecture:** Atliera is a new graph-first product, not a legacy report migration. It must boot from an empty database, run in any approved deployment location that satisfies the runtime requirements, and produce durable source/excerpt/claim/object records before any user-facing account intelligence is treated as verified. Legacy account-research reports remain external comparison artifacts only, while the reusable A.5-A.7 validation patterns and graph schemas carry forward deliberately.

**Tech Stack Assumption:** Next.js/Node app, process manager or container runtime, reverse proxy or platform ingress with HTTPS, configurable database backend, worker process for research jobs, provider/model configuration via environment/admin config, deterministic validation harness before paid model execution.

---

## 0. Product naming and module vocabulary

Canonical brand stack:

- Company/product: `Atliera`
- Registered public domain: `atliera.com`
- App: `app.atliera.com` or apex initially if simpler
- Fresh lab/staging: `lab.atliera.com`
- Core workspace: `Atliera Workshop`
- In-product capability: `Atliera Agent`
- Evidence/intelligence layer: `Atliera Graph`

Launch lens vocabulary:

- Research/change lens: `Signals`
- Stakeholder/account-structure lens: `Maps`
- Recommendation/action lens: `Plays`

Important framing decision:

- `Workshop`, `Agent`, and `Graph` are locked as the core product structure.
- `Signals`, `Maps`, and `Plays` should launch as lens-style views over one underlying Atliera Graph, not as hard-separated product modules with separate data paths or workflows.
- The module framing may become useful later for packaging/pricing, but first launch should keep one Workshop, one Graph, one Agent, and multiple views/lenses.

User-facing copy rule:

- In normal product copy, say `Atliera` by itself: "Ask Atliera", "Open Atliera", "Atliera found three new signals."
- `Atliera Agent`, `Atliera Workshop`, and `Atliera Graph` are useful for architecture, docs, enterprise trust explanations, and occasional disambiguation; users should feel like they interact with one product called Atliera.

Positioning:

> Atliera is an evidence-backed account intelligence workspace where agents turn fresh research into verified intelligence views: Signals, Maps, and Plays.

Hard naming constraints:

- Do not use `Account Atlas` as the public brand.
- Do not expose legacy `brief builder`, `reports`, or old `Canvas` naming as the new core product language.
- `Canvas` may remain only as an internal rendering/layout schema term if needed; user-facing workspace language is `Workshop`.
- Do not let Signals/Maps/Plays imply separate early code paths; they are views over shared graph intelligence unless a later architecture decision says otherwise.

---

## 1. Non-negotiable architecture principles

1. Fresh-system first
   - Atliera must operate from an empty DB.
   - No legacy report JSON is required to boot, research, render Workshop, or generate Maps/Signals/Plays.
   - No hidden fallback from graph objects to old report sections.

2. Evidence-backed trust model
   - Atliera Graph is the source of truth for verified intelligence.
   - A model may propose excerpts, claims, objects, maps, signals, and plays.
   - The system validates source IDs, excerpt spans/text, referential integrity, and provenance before accepting records.

3. Legacy reports are external comparison only
   - Hermes/browser QA may inspect the old server side-by-side with Atliera.
   - Legacy reports may generate human comparison notes.
   - Legacy prose must not become verified graph records unless independently supported by freshly fetched source evidence and accepted excerpts.

4. Lab before production
   - New EC2 can host a fresh Atliera lab/staging deployment first.
   - Production enablement requires explicit deploy approval and verification.
   - Graph-first writes start in lab/dev only.

5. Configurable providers/models
   - No hardcoded model IDs in core logic.
   - Provider/model IDs come from config/env/admin settings.
   - Paid/model mode requires explicit budget caps and human approval.

6. Portable, scale-ready systems
   - Atliera must not hardcode production URLs, IP addresses, server locations, database hosts/paths, storage endpoints, queue endpoints, provider endpoints, callback URLs, or webhook URLs in app logic.
   - Runtime-specific values come from environment/config/secret management and can differ across dev, lab, staging, and production.
   - The first deployment may run small, but app, worker, database, queue, artifact storage, model providers, and ingress must retain a path to separate services and horizontal scale.
   - Local fixtures, `example.invalid` URLs, and temp-file stores are allowed only for deterministic tests/dev artifacts; they must not become production assumptions.
   - Hardcode behavior contracts and validation invariants, not infrastructure locations.

7. Safe agent boundary
   - Atliera Agent is an app feature, not a full shell agent on the production host.
   - It should operate through app APIs/jobs/validators, not arbitrary server shell access.

8. One graph, many lenses
   - Signals, Maps, and Plays are launch lenses over the same evidence graph.
   - They must share claim/evidence/object primitives and validators.
   - Architectural constraint: lenses may be added, renamed, hidden, or packaged differently, but lenses may not fork provenance logic, validators, research logic, data paths, source fetching, excerpt matching, model activation rules, or budget enforcement.

9. Agent proposes, system validates, human ratifies
   - The model proposes candidate evidence, claims, objects, maps, signals, and plays.
   - The system deterministically validates source/excerpt/claim/object integrity.
   - The human can ratify, reject, edit, or request re-research before content becomes presentable strategy.

---

## 2. Target deployment topology

Recommended starting topology is logical, not location-bound:

- Public marketing surface
  - domain/env-specific hostname decided by deployment config
  - may redirect to the app or host marketing pages
- Primary application surface
  - hostname comes from `APP_BASE_URL` / ingress config
- Lab/staging surface
  - hostname comes from environment-specific config
- External API surface
  - defer until there is a real external API split

Server/runtime shape:

- Any approved host/platform that satisfies Node/runtime, network, storage, and security requirements.
- Reverse proxy, platform ingress, or load balancer terminates HTTPS.
- App process binds to configured `HOST`/`PORT`; the binding must not assume a fixed IP, domain, or server path.
- Process names, container names, or service names are deployment config, not app logic. Suggested names may include:
  - `atliera-web`
  - `atliera-worker`
- Database backend is configured, not hardcoded:
  - dev/test may use local fixture stores or ephemeral databases
  - first small deployment may use a local DB only if explicitly selected by config
  - production path should support a separate managed or self-hosted Postgres-compatible database when scale requires it
- Durable artifact storage is configured, not hardcoded:
  - local filesystem is acceptable for dev/test/local run artifacts
  - production path should support external object storage or another durable artifact backend
- Queues/workers are configured, not hardcoded:
  - a simple local worker is acceptable first
  - production path should support separate worker instances and an external queue/backend when load requires it
- Secrets come from deployment-specific environment/secret management:
  - no secrets committed
  - no secrets embedded in docs/scripts/tests

Deployment principle:

- The EC2 host is runtime only.
- Hermes/control environment remains the operator/reviewer/QA workstation.
- Deploys happen by SSH from Hermes after review/merge/verification.

---

## 3. Fresh database/domain model

Minimum first-class records:

### Team/User/Auth

- `Team`
  - id, name, slug, created_at
- `User`
  - id, email, name, role, created_at
- `TeamMembership`
  - user_id, team_id, role: owner/admin/member/viewer

### Account workspace

- `Account`
  - id, team_id, name, domain, industry, status, created_at, updated_at
- `Workshop`
  - id, account_id, title, status, created_at, updated_at
- `WorkshopView`
  - id, workshop_id, view_type, layout_json, created_at, updated_at

### Atliera Graph evidence core

- `SourceDocument`
  - id
  - team_id
  - account_id
  - url
  - canonical_url
  - title
  - publisher
  - source_type
  - fetched_at
  - accessed_at
  - content_hash
  - raw_text_ref or raw_text
  - reliability
  - status: active/stale/unavailable/rejected

- `EvidenceExcerpt`
  - id
  - source_document_id
  - text
  - normalized_text
  - locator_json
  - char_start
  - char_end
  - captured_at
  - validation_status: accepted/rejected
  - rejection_reason

- `Claim`
  - id
  - team_id
  - account_id
  - claim_type
  - text
  - normalized_subject
  - confidence
  - provenance_status: verified/source_document_only/unverified/unsupported/stale
  - status: active/stale/contradicted/rejected/superseded
  - created_by: model/user/system/import
  - created_at

- `ClaimEvidence`
  - claim_id
  - evidence_excerpt_id
  - relationship: supports/contradicts/context
  - rationale
  - confidence
  - created_at

- `AccountObject`
  - id
  - team_id
  - account_id
  - object_type: account_snapshot/signal/stakeholder/initiative/risk/open_question/play/recommendation
  - title
  - summary
  - payload_json
  - confidence
  - provenance_status
  - status
  - created_by
  - created_at
  - updated_at

- `AccountObjectClaim`
  - account_object_id
  - claim_id
  - relationship: primary/supporting/context

### Jobs/runs/audit

- `ResearchRun`
  - id, team_id, account_id, mode, provider, model, status, cost_cap_usd, observed_cost_usd, started_at, completed_at
- `RunArtifact`
  - id, research_run_id, artifact_type, path_or_json, created_at
- Local run manifest v1 reserves provider-era fields even before real adapters are implemented:
  - `model_run`: provider, model, started_at, completed_at; all null in local Phase 1 manifests
  - `cost_ledger`: currency, total_cost, input_tokens, output_tokens; all null in local Phase 1 manifests
  - `adapter_records`: empty array in local Phase 1 manifests; later phases append per-adapter-call records
- `AuditEvent`
  - id, team_id, actor_type, actor_id, event_type, target_type, target_id, payload_json, created_at

---

## 4. Product surfaces and launch lenses

The first launch architecture is not three isolated modules. It is one Workshop backed by one Graph, assisted by one Agent, with multiple lens-style views over the same graph objects. Signals, Maps, and Plays are allowed to have distinct UI affordances, but they must not have separate provenance rules, validators, or data pipelines.

### Atliera Workshop

Purpose:
- Main user surface where teams and Atliera work on account intelligence.

Owns:
- layout/view state
- user-facing organization of Signals/Maps/Plays lenses
- review/approval affordances
- notes and collaboration surfaces

Must not:
- be the canonical evidence ledger
- invent evidence semantics in UI-only edges
- fallback to legacy report sections

### Atliera Agent

Purpose:
- App-bounded assistant/capability that proposes, explains, and refines research outputs.

Owns:
- prompt contracts
- model adapter interface
- candidate excerpt/claim/object proposals
- gap analysis
- explanations and rationale

Must not:
- have arbitrary production shell access
- bypass validators
- write verified/high-confidence records without accepted evidence
- hardcode provider/model IDs

### Atliera Graph

Purpose:
- Durable evidence-backed source/excerpt/claim/object graph.

Owns:
- schemas
- validators
- referential integrity
- provenance status rules
- accepted/rejected evidence records
- object-to-claim links

Must not:
- depend on Workshop UI state
- depend on legacy report JSON

### Signals lens

Purpose:
- Data ingestion, source discovery, source fetching, change detection, and evidence capture.

Owns:
- source discovery jobs
- fetch/canonicalization
- SourceDocument creation
- raw text extraction/content hashing
- freshness/staleness tracking
- signal/change AccountObjects after validation

Must not:
- create verified claims without accepted excerpts
- treat web-search snippets as durable evidence unless fetched/stored

### Maps lens

Purpose:
- Stakeholder, relationship, influence, and account-structure mapping.

Owns:
- stakeholder AccountObjects
- relationship edges/view models
- buying committee hypotheses
- champion/blocker/risk labels when evidenced

Must distinguish:
- evidenced stakeholder facts
- inferred/hypothesized relationships
- user-entered notes

### Plays lens

Purpose:
- Sales recommendations and action planning.

Owns:
- recommended actions
- outreach angles
- discovery questions
- risk mitigation plays
- expansion/renewal/displacement plays

Must link:
- each play to supporting claims and evidence
- unsupported ideas as suggestions, not verified intelligence

---

## 5. Legacy disposition and carry-forward decisions

Atliera is clean-slate, but not memoryless. The A.5-A.7 work contains reusable architecture that should be carried forward deliberately, while legacy-specific migration code stays behind.

### Carry forward into Atliera

1. Validation infrastructure from A.5-A.7
   - model adapter pattern
   - explicit fixture/fake/model modes
   - pre-call budget enforcement
   - activation flag discipline
   - adversarial tests for provider activation and budget failures
   - import-side-effect tests proving no provider SDK import/env read/network call in safe modes
   - artifact preservation on failed or partial runs
   - evidence excerpt validation and span/text matching
   - aggregate validation reporting

2. Evidence graph schema from PR #36
   - SourceDocument
   - EvidenceExcerpt
   - Claim
   - ClaimEvidence
   - AccountObject
   - GraphEdge or equivalent relationship primitives, if still useful after review

3. Review-cycle playbook
   - schema-first fixture mode before provider mode
   - hard invariants separated from soft quality thresholds
   - paid/model runs only after explicit human approval
   - paired review discipline: spec compliance and code quality

### Leave with the legacy system

1. Legacy brief JSON handling
   - fromBriefJson mapper
   - brief_json compatibility adapters
   - dual-render UI
   - briefParity logic
   - backfill report machinery

2. Legacy production app/server assumptions
   - old routes, old report rendering, old Canvas compatibility shims
   - old DB shape as a runtime dependency
   - old report JSON as a hidden fallback or seed source

### Boundary rule

Carry forward patterns, schemas, tests, and safety discipline. Do not carry forward legacy adapters, migration tooling, or runtime dependencies. If code is copied, it must be renamed/refactored so Atliera concepts are primary and legacy coupling is impossible to accidentally preserve.

---

## 6. Validation gates

### Hard invariants

Any graph-first run fails if any occur:

- schema parse failure
- invented `SourceDocument` IDs
- invented `EvidenceExcerpt` IDs
- dangling claim/evidence/object references
- accepted excerpt text not found in stored source text after deterministic normalization
- `verified` or high-confidence claim without accepted supporting excerpt
- object marked verified without linked verified/supporting claim
- production write during validation mode
- provider/model call outside explicit model mode
- model mode without cost cap/provider/model/run approval
- observed or projected cost exceeding budget

### Quality thresholds

Separate from hard safety. Use pass/borderline/fail bands.

Initial suggested bands for small lab corpus:

Pass:
- all hard invariants pass
- each account with usable fetched source material has at least one accepted excerpt
- each account produces at least one useful AccountObject in a relevant category
- dropped excerpt reasons are explainable and not dominated by avoidable formatting/span mismatch

Borderline:
- all hard invariants pass
- one account has low/zero useful objects due to source scarcity or known prompt/span issue
- proceed only with documented fix or targeted rerun

Fail:
- any hard invariant failure
- graph output is technically valid but mostly empty/useless
- verifier rejects most proposed excerpts for preventable normalized mismatch/offset issues

---

## 7. Implementation phases

### Phase 0 — Architecture/ADR only

Goal:
- Commit a durable plan/ADR in the chosen repo before coding.

Deliverables:
- `docs/adr/0001-atliera-fresh-system.md`
- `docs/architecture/atliera-product-architecture.md`
- `docs/architecture/provenance-and-validation.md`
- `docs/BLOCKERS.md`

Out of scope:
- migrations
- UI implementation
- server deploy
- paid provider calls

### Phase 1 — Atliera Graph foundation: schema, validators, and adversarial tests

Goal:
- Build evidence graph schemas, DB foundation, deterministic validators, adversarial tests for both schema and validators, and empty-DB bootstrap. Validation lands with schema rather than as a later retrofit.

Deliverables:
- Team/User/Account minimal scaffolding
- SourceDocument/EvidenceExcerpt/Claim/ClaimEvidence/AccountObject schemas
- validator library
- fixture-mode graph validation CLI
- no provider imports/API key reads in fixture mode
- tests proving app/data layer boots with empty DB

Verification:
- `npm test`
- `npm run build`
- fresh SQLite DB initialization test
- fixture tests for each hard invariant
- import-side-effect tests proving fixture mode makes no model/network calls
- validator report artifact

### Phase 2 — Atliera Workshop UI shell

Goal:
- Establish clean Atliera app shell and Workshop/lens vocabulary without implementing full agentic research.

Deliverables:
- Atliera naming in app config/UI shell
- Workshop shell
- Graph-backed placeholder/fixture views for Signals, Maps, and Plays lenses
- Evidence drawer/provenance status visual language
- no legacy report dependency

Implementation note:
- Phase 2.1 starts with a static, fixture-backed Workshop shell renderer before choosing a full app framework. This locks graph-to-lens/trust semantics without adding DB/auth/deploy/provider scope.

Verification:
- `npm test`
- `npm run build`
- browser smoke test for empty and fixture accounts

### Phase 3 — Atliera Agent integration foundation

Goal:
- Add app-bounded agent orchestration interfaces while staying deterministic/fake by default.

Deliverables:
- narrow `ModelAdapter` interface with fake/deterministic implementation only
- Agent run orchestration records that can reference ResearchRun/RunArtifact
  - first seam is pure record construction/status transition only: no persistence, queue polling, job execution, provider call, SDK import, env read, network call, or validator bypass
- prompt-contract placeholders for proposing excerpts, claims, objects, and lens summaries
  - pure data-only contracts with provider/model null; no SDK import, env read, client construction, network call, persistence, queue mutation, or prompt execution
  - active safety requirements: cite existing source context, do not invent graph record or relationship IDs, emit only allowed output kinds, and pass through Graph validators plus quality gate
- explicit activation flags that fail closed for real provider mode
- no real provider SDK imports, API-key reads, network calls, or paid calls

Verification:
- fake adapter tests
- model-mode refusal test exits nonzero until explicitly implemented
- import-side-effect tests prove no provider SDK import/env read/network call
- Agent proposals cannot bypass Graph validators

### Phase 4 — First research run / Signals ingestion foundation

Goal:
- Fetch/canonicalize/store source documents safely.

Deliverables:
- source discovery/fetch interface
- SourceDocument creation
- content hashing
- raw text extraction
- deterministic excerpt matching helper

Verification:
- local fixture source docs
- hash stability tests
- excerpt span acceptance/rejection tests

### Phase 5 — Real model adapter and budgeted provider mode

Goal:
- Add explicit, budgeted model mode after fixture validators are boring.

Deliverables:
- narrow `ModelAdapter` interface
- fake deterministic adapter for tests
- real provider adapter behind explicit flags
- pre-call budget enforcement
- artifact preservation on failure/budget exhaustion

Verification:
- adversarial refusal tests
- no SDK import/env read before activation flags
- budget-exhaustion tests
- fake adapter dry-run
- paid run only with explicit human approval

### Phase 6 — Workshop MVP with useful lenses

Goal:
- Render accepted graph objects into a useful workspace.

Deliverables:
- account workspace overview
- Signals panel
- Maps panel
- Plays panel
- Evidence drawer
- provenance/status labels

Verification:
- graph objects render from empty/fresh DB seeded fixtures
- unsupported/unverified objects are visibly labeled
- no legacy report fallback

### Phase 7 — Fresh EC2 lab deployment

Goal:
- Deploy lab Atliera to new EC2 with nginx/Certbot/PM2.

Deliverables:
- `lab.atliera.com` DNS to EC2
- nginx config
- Certbot cert
- PM2 `atliera-web` and `atliera-worker`
- server-local env and DB paths
- healthcheck route
- backup script

Verification:
- exact commit deployed
- PM2 status
- nginx config pass
- HTTPS route checks
- healthcheck route
- worker status
- browser QA
- no legacy DB/report dependency

### Phase 8 — External legacy comparison protocol

Goal:
- Compare Atliera output against old reports without code coupling.

Deliverables:
- `docs/qa/legacy-comparison-protocol.md`
- manual/Hermes comparison report template

Comparison categories:
- recovered themes
- new findings
- missing potentially valuable legacy insights
- unsupported/outdated legacy claims
- evidence quality delta
- Workshop usefulness delta

Hard rule:
- Comparison may trigger targeted re-research, not automatic legacy import.

---

## 8. Launch quality threshold

First launch is not defined by having pages render. It is defined by Atliera producing useful, evidence-backed intelligence on a small gate corpus.

Initial gate users:

1. User alone
2. User's SLED team
3. Broader users only after quality and operational checks pass

Multi-tenancy:

- Build team/account/user boundaries from the start, even if there is one tenant initially.
- Do not require a future re-architecture to support a second team.

Gate corpus expectations:

- Use a deliberate account set that includes easy, medium, and hard research cases.
- Include accounts with public web material, weak/non-URL source pressure, stakeholder ambiguity, and sales-play ambiguity.
- Document the corpus selection before running paid/model validation.

Launch pass criteria:

- zero hard invariant failures
- zero false-verified claims, objects, map items, signals, or plays
- no verified/high-confidence claim without accepted evidence
- no invented source/excerpt/claim/object/edge references
- zero accepted paraphrases treated as excerpts
- zero unbudgeted/default-path model calls
- accepted excerpt rate >= 50% on proposed excerpts for accounts with usable source material
- zero-output incidents < 10% of gate-corpus accounts with usable source material
- material-claim coverage >= 80% for verified/high-confidence claims
- useful end-to-end research output for each launch gate account with usable source material
- every usable gate account produces at least one useful graph-backed AccountObject
- at least two launch lenses are materially useful for each usable gate account where source material supports them
- Signals, Maps, and Plays lenses all render from the same graph-backed account objects and do not fork validation/research/provenance/data paths
- unsupported or inferred material visibly labeled
- old legacy reports used only for external comparison, not runtime data

Recommended initial quality bands:

- Pass: all hard invariants pass; all gate accounts produce at least one useful graph-backed object; at least two lens views are materially useful per account where source material supports them.
- Borderline: all hard invariants pass, but one gate account has sparse output or one lens is weak; proceed only with documented fix/rerun decision.
- Fail: any hard invariant failure, most output unsupported, zero-output for a usable account, or evidence labels are misleading.

### Launch readiness gating layers

Launch readiness is not satisfied by one successful fixture, one passing GraphBundle, or pages rendering. It requires gates at multiple layers. Per-bundle gates are necessary but not sufficient: a bundle can pass while the corpus still fails due to sparse output, weak lens usefulness, or too many zero-output accounts.

| Gate | Threshold / rule | Enforcement layer | Target phase | Status |
| --- | --- | --- | --- | --- |
| Per-bundle hard invariants | Zero invented IDs; zero false-verified records; accepted excerpts must match source text/spans; verified lens items must trace to verified graph records | Graph validator | Phase 1+ | Implemented for local GraphBundle validation |
| Per-bundle quality thresholds | Accepted excerpt rate >= 50%; verified/high-confidence claim evidence coverage = 100%; invented ID failures = 0; zero-output bundle fails | Quality gate runner | Phase 1+; integrated into local run artifacts in Phase 1.5+ | Runner implemented; local manifest integration implemented |
| Aggregate corpus thresholds | Zero-output incidents < 10% of usable gate-corpus accounts; aggregate material-claim coverage meets launch threshold | Aggregate report layer over multiple run manifests | Phase 4+ | Not implemented |
| Lens usefulness thresholds | At least two launch lenses materially useful per usable gate account where source material supports them | Aggregate report plus human/product review | Phase 6+ | Not implemented |
| Launch gate corpus hard-invariant pass | All hard invariants pass across the selected launch gate corpus of at least N accounts | Aggregate report layer over selected gate corpus | Phase 6+ | Not implemented; N and corpus selection criteria must be set before launch-readiness assessment |
| Model/runtime safety | Zero default-path provider calls; budgeted/model mode only after explicit approval; no production writes from validation/fixture modes | Safety tests, runtime mode guards, CI, review checklist | Phase 1+; expanded before model mode | Partially implemented; model-mode activation tests still pending |

Aggregate launch readiness must be evaluated only after multiple usable gate accounts have been processed through the same manifest/report pipeline. Until the aggregate report layer exists, quality-gate `pass` means only that a single GraphBundle passed its local gates.

---

## 9. Deployment readiness checklist

Before deploy:

- Target environment selected:
  - dev, lab, staging, or production
  - hostname and ingress configured outside app code
- Access verified by Hermes/control environment or approved operator workflow
- Network policy/firewall/security group allows only required ingress and egress
- Runtime baseline installed or provisioned:
  - Node LTS or approved container/runtime platform
  - process manager, orchestrator, or platform service definition
  - reverse proxy, platform ingress, or load balancer with HTTPS
- App and worker services configured through environment/config:
  - `APP_BASE_URL`
  - `HOST`
  - `PORT`
  - database connection/config
  - artifact storage backend/config
  - queue/backend config if jobs are enabled
  - provider/model config if model mode is enabled
- Durable data locations/backends selected explicitly:
  - database backend is not implied by code
  - artifact storage backend is not implied by code
  - backup/restore path documented for the selected backend
- Secrets strategy chosen:
  - environment file, platform secrets, or secret manager
  - no secrets committed
  - no secrets embedded in docs/scripts/tests
- Backup/restore and rollback scripts/process documented before nontrivial data use

Do not install a resident full autonomous shell agent on the production Atliera host yet.

---

## 10. Claude Code / implementation handoff notes

Recommended first Claude Code task is PLAN ONLY:

- inspect selected repo/workspace
- create architecture docs/ADRs above
- do not implement migrations or UI
- do not deploy
- do not call providers
- do not read production secrets
- preserve fresh-system/no-legacy constraints
- report branch, commit, file paths, and open tradeoffs

Implementation PRs should be sequenced after the architecture PR is reviewed.

---

## 11. Immediate decisions needed

1. Repo strategy
   - A: new GitHub repo for Atliera
   - B: lab repo fork/current account-research-hermes-lab renamed/rebranded
   - C: new branch in current account-research repo, later split

Recommendation: A. Create a fresh GitHub repo named `atliera`. Use the legacy/lab repos as reference sources for patterns and schemas only. Avoid keeping Atliera inside the legacy production repo if the goal is a clean public product.

2. First domain target
   - A: `lab.atliera.com` first
   - B: `app.atliera.com` first
   - C: apex `atliera.com` first

Recommendation: `lab.atliera.com` first for buildout, then `app.atliera.com`.

3. Persistence strategy
   - A: local/ephemeral DB for dev and lab only
   - B: Postgres-compatible production database from day one
   - C: configurable persistence interface first, with adapters selected by environment

Recommendation: C. Keep persistence behind explicit interfaces/config. Local or SQLite-style storage can be useful for dev/lab speed, but product logic must not assume a single local DB file. Production should have a clean path to a separate Postgres-compatible database, external backups, and multiple app/worker instances.

4. What codebase to start from
   - A: clean Next.js starter
   - B: extract useful pieces from lab repo
   - C: clone current app and remove legacy

Recommendation: B if lab repo has useful graph validation code; A if legacy coupling is too high. Avoid C unless tightly controlled.

---

## 12. Definition of done for this architecture step

This plan is complete when:

- Atliera naming and module vocabulary are accepted.
- Fresh-system/no-legacy critical path is explicit.
- Evidence graph model is documented.
- Workshop/Agent/Graph boundaries are documented, and Signals/Maps/Plays are explicitly framed as graph-backed launch lenses rather than separate early modules.
- A.5-A.7 carry-forward vs leave-behind decisions are documented.
- Validation hard invariants and quality thresholds are documented.
- EC2 lab deployment topology is documented.
- A plan-only Claude Code prompt can be issued to create repo docs/ADRs.
