# Substrate to Validation Transition

Status: Accepted

Last updated: 2026-05-27

## Decision

Atliera is moving from open-ended substrate construction to explicit validation of the substrate that already exists.

The next phase should test the current contracts, seams, and safety gates against concrete implementations and real dependency behavior before adding more broad substrate. Additional substrate PRs are still allowed when they directly unblock validation, but they should be justified as closing a specific validation blocker rather than continuing foundation work by default.

## Why this checkpoint exists

The repository now has enough substrate that more abstraction has diminishing marginal value unless the existing abstractions are exercised.

The previous phase intentionally built small, reviewable seams before deployment, provider calls, app runtime execution, or production persistence. That discipline created strong boundaries, but it also creates a risk: contracts can become theoretical if concrete implementations do not validate them soon enough.

This checkpoint makes the phase transition explicit:

- stop adding substrate merely because another boundary can be described;
- validate the load-bearing substrate through concrete implementation;
- revise contracts only when validation exposes real gaps;
- preserve the small-PR and fail-closed safety discipline while shifting the main question from "what must future implementations guarantee?" to "does the implementation satisfy the contract under real constraints?".

This decision document does not itself authorize provider calls, deployment, production persistence, worker execution, migrations, or production data access. Those require later explicit PRs and gates.

## Substrate already built

### Evidence and Workshop foundation

Atliera has a deterministic evidence graph foundation:

- graph primitives for source documents, evidence excerpts, claims, claim evidence, and account objects;
- strict schema parsing and hard-invariant validation;
- deterministic quality gate metrics;
- checked-in fixture corpus covering pass, borderline, and fail behavior;
- graph-backed Workshop shell and three-lane preview over Signals, Maps, and Plays;
- graph-derived evidence packets with provenance visibility.

### Portability and launch guardrails

Atliera has portability and launch-readiness guardrails:

- no hardcoded infrastructure literals in app/deploy-oriented paths;
- typed runtime configuration from explicit env input;
- production/staging preflight that fails closed when required infrastructure choices are missing;
- production/staging rejection of test-only memory/fake adapters;
- app and worker launch boundaries that do not start servers, loops, clients, or provider calls.

### Runtime and durable adapter substrate

Atliera has implementation-neutral runtime contracts and adapter boundaries:

- `ArtifactStore` seam;
- SDK-neutral S3-compatible `ArtifactStore` adapter boundary;
- artifact-store resource preflight probe;
- `JobQueue` seam;
- SDK-neutral database-backed `JobQueue` adapter boundary;
- job-queue resource preflight probe;
- `VersionedGraphStore` seam with optimistic concurrency;
- graph-store resource preflight probe;
- SDK-neutral database-backed `VersionedGraphStore` adapter boundary;
- runtime composition seam;
- resource preflight shape.

### Model and agent substrate

Atliera has model and agent contracts that remain no-spend by default:

- pure `ModelProvider` contract;
- deterministic fake model provider/adapter behavior for safe modes;
- fail-closed model mode until real activation exists;
- no provider SDK imports, API-key reads, network calls, or provider calls in default paths;
- pure `AgentRunRecord` lifecycle seam;
- prompt-contract placeholders for excerpt, claim, account-object, and lens-summary proposals.

## Validation-mode objective

Validation mode should answer whether the substrate works under concrete conditions.

The validation phase is successful only if concrete implementations demonstrate that:

1. runtime dependencies can be configured without hardcoded deployment assumptions;
2. durable adapters satisfy their contracts against real or realistically mocked backends;
3. model/provider execution can be activated only with explicit authorization and budget controls;
4. provider outputs can flow through AgentRun records, graph validation, quality gates, and artifact storage without bypassing provenance or safety checks;
5. discovered contract gaps are captured as targeted revisions, not ad hoc implementation exceptions.

## Transition trigger

The transition to validation mode begins after PR #37, the prompt-contract placeholder seam.

At that point, broad substrate is considered sufficient for the first validation cycle. The default next PR type changes from "add another contract/seam" to one of:

- a strategic or safety gate needed before validation;
- a concrete implementation that validates an existing contract;
- a targeted contract revision driven by validation findings.

## Substrate limit

Do not add more general substrate PRs before the first validation cycle unless the PR closes a named blocker in this document.

A proposed substrate PR must answer all of these questions in its PR body:

1. Which concrete validation target does this unblock?
2. Why can the validation target not proceed with the existing substrate?
3. What active future guarantee does this PR add?
4. How will the guarantee be validated by implementation rather than only described?

If those questions cannot be answered, defer the substrate PR until after the first validation cycle.

## First validation cycle

The first validation cycle should be small and ordered.

### Step 1: Formalize approval and cumulative budget controls

Before any real provider call, Atliera needs an explicit authorization and budget gate.

This PR should define, at minimum:

- what constitutes operator approval;
- how approval is referenced from run records;
- the minimum approval fields: approver, timestamp, provider, model, maximum cost, corpus/scope, cleanup commitment, and approval reference;
- where the approval record, budget ledger, run evidence, and post-run cleanup/retention outcome are recorded;
- cumulative budget tracking across runs, not only per-call or per-run checks;
- refusal behavior when cumulative spend would exceed the approved cap;
- run authorization provenance that records who approved what and why.

This is still allowed before implementation validation because it closes a concrete blocker for real provider activation.

### Step 2: Validate durable storage through S3-compatible artifact storage

The first implementation validation target should be the S3-compatible `ArtifactStore` path, using either a real S3-compatible backend or a high-fidelity emulator with documented behavioral limits. A shallow in-memory fake is not sufficient for this validation step. `validateS3ArtifactStoreCompatibility` provides the SDK-neutral harness for that validation while leaving backend/client construction and cleanup to lab/deploy wiring. `FilesystemS3CompatibilityClient` supplies a deterministic local filesystem-backed emulator for CI/lab validation when no real S3-compatible backend is available, but it must be reported with its emulator limits and must not be treated as proof of provider-specific S3 behavior. `docs/runbooks/lab-s3-artifact-validation.md` defines the lab-only operator checklist for moving from filesystem smoke evidence to a real S3-compatible backend without creating production infrastructure or hardcoding bucket/endpoint/credential values. Amazon S3 Files, described in AWS's April 7, 2026 launch note, [Launching S3 Files, making S3 buckets accessible as file systems](https://aws.amazon.com/blogs/aws/launching-s3-files-making-s3-buckets-accessible-as-file-systems/), should be treated as a separate validation candidate for AWS deployment because it exposes S3 buckets through a managed file-system interface; that path must document S3 synchronization windows, NFS close-to-open behavior, POSIX UID/GID permission mapping through object metadata, IAM/encryption assumptions, and any divergence from direct S3 object API semantics.

This validates:

- bucket/prefix/key mapping;
- max-payload enforcement;
- missing-object behavior;
- sanitized backend errors;
- observer events;
- resource preflight write/read behavior;
- configuration flow without hardcoded bucket, region, endpoint, account, host, mount path, or credential assumptions.

The implementation should report any mismatch between the durable adapter contract and actual S3-compatible behavior. Real gaps should become small follow-up contract revisions or implementation notes.

Current status: the lab validation path has reached a real AWS S3 object API with a temporary lab bucket, passed all `s3_compatible_object_api` checks, and cleaned up the probe objects and temporary bucket. The run also exposed a real AWS CLI parsing gap for empty `--metadata` shorthand values; that gap is tracked as a targeted client/test fix rather than a reason to reopen broad substrate hardening. With that fix accepted, the S3 durable-artifact validation blocker is satisfied for direct object API semantics and the next validation step is the tightly budgeted model-provider run.

### Step 3: Validate model provider execution with a minimal paid corpus

After approval/budget controls and durable artifact validation are in place, run the first real provider validation with a tiny, explicitly approved corpus and low spend cap.

This validates:

- `ModelProvider` request/response shape;
- activation gates;
- credential refusal and provider import discipline;
- pre-call cost estimation;
- post-call cost ledger entries;
- provider response metadata capture;
- AgentRun record linkage;
- prompt-contract output compatibility;
- graph validators and quality gate behavior on model-produced proposals;
- artifact persistence of run evidence and reports.

Current status: Atliera now has a provider-neutral external command seam for lab validation and has completed the first provider-boundary validation against OpenRouter `owl-alpha` for the `graph.propose` operation at commit `6e67b11`. The private evidence remains outside the repository. Sanitized checks show activation gates, credential status, provider call, response contract, and cost ledger all passed, with observed cost: $0. This validates the first real provider boundary and response-contract path, but it does not imply launch readiness, product readiness, multi-account quality readiness, production provider readiness, or full AgentRun-to-artifact pipeline validation.

The next validation step should either codify the completed first-cycle lessons or run a second tiny approved validation that exercises more of the full pipeline: external command provider, response contract, AgentRun/evidence record, graph validation, quality gate, and artifact persistence. The deterministic full-pipeline package helper now provides the no-spend local bridge for that path: sanitized provider-validation evidence plus a GraphBundle can be packaged into AgentRun evidence, graph/quality reports, and a guarded local run manifest before any additional live provider call is approved.

Current status: EC2 bootstrap validation has now reproduced that no-spend full-pipeline package on an operator-approved lab EC2 host from a fresh clone of commit `f862bbf`. The clean host ran `npm ci`, `npm run ci` with 402 tests across 63 suites, and deterministic packaging of the sanitized OpenRouter `owl-alpha` provider-validation report. The deterministic manifest hash was `cc9b26b50b12031368a9399fcdd9d949af90f8dd8e21c2b8628a9a9ff4b3eaab`, matching the local package hash and the remote rerun hash. Packaging safety flags remained no live provider call, no network, and no credential read. Remote commands should prefer the operator-approved DNS name over a raw IP command string so local execution supervisors do not route a benign lab copy step through a manual approval prompt. This milestone records substrate portability and repeatability, but it does not imply production readiness, launch readiness, or product-quality readiness.

Current status: the sanitized execution record for controlled 2b live-provider validation executed at commit `a5e4c0f` with OpenRouter `owl-alpha` for `graph.propose`, one representative account, and a single provider call. Approval was present through the activation record, the corpus reference used the `external-corpus/controlled-2b/` prefix, and private evidence stayed outside the repository. Activation gates, credential status, provider call, response contract, cost ledger, full-pipeline packaging, and the bootstrap evidence verifier all passed. The run recorded input tokens 177, output tokens 34, observed cost: $0, no production writes, and no runtime/model-mode integration. The deterministic full-pipeline manifest hash was `9c7153776340cc36c20f275612ab2b369d7e5dddb5ec89dd164c1032e883e19e`, matching the rerun hash. This records that this approved live-provider evidence traversed the existing provider-validation, AgentRun, graph/quality, manifest, and bootstrap-verifier path without new substrate surface. It does not imply launch readiness, does not imply product readiness, does not establish broad model quality, does not establish production readiness, and does not establish multi-account corpus readiness.

Current status: `docs/runbooks/controlled-corpus-usefulness-validation.md` now defines the controlled corpus usefulness validation contract as the no-spend next step before another live provider run. It locks a 3-5 account selection rule, usefulness classifications, hard invariants, soft quality signals, and a pre-locked decision tree without authorizing provider calls, spend, production writes, runtime/model-mode integration, provider lock-in, or launch/product readiness claims. It preserves provider portability across gateway routes and future separately approved direct provider routes such as the Anthropic API and OpenAI API.

Current status: `src/validation/controlled-corpus-usefulness.ts` now makes that contract executable as a deterministic no-spend assessment helper. It classifies sanitized account-level facts, requires the 3-5 account corpus shape with representative, edge-case, and calibration coverage, rejects unsafe or malformed inputs, preserves the worst per-account classification in the corpus summary, and always reports no live provider call, no provider spend, no production writes, no runtime/model-mode integration, and no launch-readiness claim.

Current status: `docs/runbooks/controlled-2b-expanded-usefulness-validation.md` is the next controlled 2b-expanded usefulness validation approval packet. It keeps the next live slice bounded to OpenRouter `owl-alpha`, a frozen 3-5 account corpus, and `assessControlledCorpusUsefulness(...)` over already-produced sanitized facts; it preserves provider portability and does not establish launch readiness, product readiness, broad model quality, or multi-account corpus readiness.

Current status: controlled 2b-expanded usefulness validation executed at commit `355c84e` with OpenRouter `owl-alpha` for `graph.propose`, a frozen 3-account controlled corpus, and one provider call per selected account. The selected roles were representative, edge-case, and calibration, the corpus reference used `external-corpus/controlled-2b-expanded/`, and private evidence remained outside the repository. Activation gates, credential status, provider call, response contract, cost ledger, full-pipeline packaging, and bootstrap evidence verifier passed for each selected account. The run recorded input tokens 374, output tokens 305, observed cost: $0, no production writes, and no runtime/model-mode integration. Deterministic full-pipeline manifest hashes were `18be752143b01a5246205f8d4fcd7e3073a20894c9a1798a2010512ecf0f55ab`, `f25c9f98190a05b7ea020be84ffd397203291c07feb91abd703a402e566f90b6`, and `a11e073a6140c9283303119a466dcd51fe4bc3f51bf8430ca98fa7d93d0713ad`. `assessControlledCorpusUsefulness(...)` classified sanitized account-level facts as weak-but-valid overall, with classification counts: weak-but-valid 3, zero-output 0, unsupported/invented 0, contract failure 0, and `launch_readiness_claim: false`. The selected pre-locked interpretation branch is weak-but-valid: inspect the rubric, prompts, proposal layer, and evidence policy before comparison or expansion; do not claim readiness. `src/validation/controlled-corpus-weakness-diagnosis.ts` now adds the no-spend controlled corpus weakness diagnosis helper for that path. `diagnoseControlledCorpusWeakness(...)` consumes already-produced, already-sanitized account-level facts, buckets weak outcomes into `low_materiality`, `low_specificity`, `missing_account_objects`, `missing_lens_usefulness`, `insufficient_evidence_density`, `rubric_threshold_gap`, `proposal_layer_underproduction`, `evidence_policy_gap`, and `non_weak_blocker`, and returns `inspect_rubric`, `inspect_prompts`, `inspect_proposal_layer`, and `inspect_evidence_policy` as no-execution follow-up labels while preserving `approves_expansion_or_comparison: false` and `launch_readiness_claim: false`. The diagnosis does not authorize provider calls, does not authorize provider spend, does not approve comparison or expansion, does not imply launch readiness, and does not establish broad model quality. `src/validation/controlled-corpus-remediation-plan.ts` now adds the no-spend controlled corpus weakness remediation helper for the next step before another live run, comparison, or expansion. `planControlledCorpusWeaknessRemediation(...)` consumes the already-produced weakness diagnosis, maps it to remediation areas `prompt_contract`, `proposal_schema`, `evidence_policy`, `rubric_thresholds`, `fixture_coverage`, and `substrate_contract`, allows only no-execution labels `no_spend_prompt_contract_revision`, `proposal_schema_revision`, `rubric_clarification`, `evidence_policy_clarification`, `deterministic_fixture_update`, and `fix_hard_substrate_or_contract_blocker`, and blocks `live_provider_rerun`, `provider_comparison`, `corpus_expansion`, `launch_readiness_claim`, and `product_readiness_claim`. It preserves `approves_live_provider_call: false`, `approves_provider_spend: false`, `approves_expansion_or_comparison: false`, and `launch_readiness_claim: false`. The remediation plan does not authorize provider calls, does not authorize provider spend, does not approve comparison or expansion, does not approve a rerun, and does not imply launch readiness, product readiness, production readiness, broad model quality, or multi-account corpus readiness. No post-validation rereads were used: interpretation used packaged sanitized evidence and already-produced sanitized account-level facts. Full-pipeline packaging used private normalized copies to satisfy the current `run_` research-run identifier contract without retrying provider calls. This result does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account corpus readiness. Provider portability remains intact, including future separately approved direct provider routes such as the Anthropic API and OpenAI API. `src/agent/controlled-corpus-graph-propose-contract.ts` now adds the no-spend prompt/proposal contract remediation step before another live run. `buildControlledCorpusGraphProposePromptContract(...)` defines a role-specific strict JSON `graph.propose` shape for `excerpts`, `claims`, `account_objects`, and `lens_summaries` so the next approved execution can target accepted account-object and lens-usable structure instead of prose-only summaries; it does not authorize provider calls, provider spend, comparison, expansion, reruns, or readiness claims. `src/validation/controlled-corpus-rerun-request-packet.ts` now adds the controlled corpus rerun request packet step after the prompt/proposal contract and before any live rerun: `buildControlledCorpusRerunRequestPacket(...)` pins the prompt/proposal contract version, preserves the representative/edge-case/calibration role set, and produces a no-spend request preview that requires a separate approval packet before provider execution.

Current status: `docs/runbooks/controlled-2b-expanded-rerun-approval.md` is now the controlled 2b-expanded rerun approval packet after the no-spend request-packet gate. It approves exactly one bounded remediated rerun using the controlled corpus rerun request packet and remediated `graph.propose` prompt/proposal contract, while keeping execution in a later status PR and preserving no comparison, no corpus expansion, no production writes, no runtime/model-mode integration, no readiness, and no broad model-quality claims.

### Step 4: Revise or codify

After the first durable adapter and first provider validation, choose one of two follow-up paths:

- If validation is clean, codify the methodology and transition learnings in an Atliera engineering-practice document.
- If validation reveals contract gaps, open targeted substrate revision PRs that cite the validation evidence.

## Out of scope until after the first validation cycle

Do not start these by default before the first validation cycle completes:

- broad new substrate unrelated to a named validation blocker;
- production app deployment;
- product-facing real provider features;
- autonomous worker loops that execute real provider jobs;
- migrations for a production database schema;
- UI polish beyond deterministic validation surfaces;
- multi-provider abstraction expansion;
- large methodology codification that freezes patterns before validation teaches what matters.

## Required review posture

Use local CI and Hermes review for routine docs and implementation mechanics.

Use external/consultant review for:

- this strategic transition decision;
- first real provider integration planning;
- post-validation substrate revisions if validation exposes architectural gaps.

External review is consultative, not authoritative. Merge decisions remain based on live repo state, local verification, GitHub CI, and accepted project constraints.

## Next 3-5 PR sequence

Recommended order after this decision PR:

1. `docs/runtime`: formalize approval mechanism and cumulative budget tracking. Complete.
2. `feat(adapters)`: validate S3-compatible `ArtifactStore` implementation/resource behavior against a real or realistically mocked backend. Complete for direct real AWS S3 object API semantics after the targeted empty-metadata CLI fix lands.
3. `feat(provider)`: first real provider integration behind explicit approval, cumulative budget, and tiny-corpus validation gates. Complete for first provider-boundary validation; full AgentRun-to-artifact pipeline validation remains next if product execution is the chosen follow-up.
4. `docs(methodology)` or `fix(substrate)`: codify proven methodology if validation is clean, run the next concrete validation slice if more pipeline evidence is needed, or revise contracts if validation exposes gaps.
5. Begin product-facing app/runtime work only after validation evidence shows the substrate can carry real execution safely.

## Validation mode entry and exit criteria

### Entry criteria

Atliera has entered validation mode when this document is accepted and merged.

### Exit criteria for the first validation cycle

Atliera exits the first validation cycle when:

- approval and cumulative budget controls are formalized;
- at least one durable adapter has been validated through concrete implementation;
- at least one real provider validation run has executed under explicit approval and budget caps, or has failed safely with preserved evidence;
- any discovered contract gaps are recorded as follow-up PRs or issues;
- the project explicitly chooses methodology codification, substrate revision, or product-facing runtime work as the next phase.

Current status: `docs/runbooks/controlled-2b-expanded-rerun-status.md` now records the separate sanitized execution follow-up for the controlled 2b-expanded remediated rerun at commit `66a8b6f`. The rerun used OpenRouter `owl-alpha` for `graph.propose`, the remediated prompt schema `controlled_corpus_graph_propose_prompt.v1`, the request-packet schema `controlled_corpus_rerun_request_packet.v1`, exactly three selected role labels, and one provider call per role. Activation gates, credential status, provider call, response contract, cost ledger, full-pipeline packaging, and bootstrap evidence verification passed for each role. The run recorded input tokens 2381, output tokens 1122, observed cost $0.00, no production writes, and no runtime/model-mode integration. `assessControlledCorpusUsefulness(...)` classified the sanitized role facts as useful overall with useful 3, weak-but-valid 0, zero-output 0, unsupported/invented 0, contract failure 0, and `launch_readiness_claim: false`. This is a useful tiny-corpus signal only; it does not imply launch readiness, product readiness, production readiness, broad model quality, multi-account corpus readiness, provider comparison, corpus expansion, or provider lock-in.
