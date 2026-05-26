# Substrate to Validation Transition

Status: Accepted

Last updated: 2026-05-23

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

Current preparation status: Atliera now has a provider-neutral external command seam for the first lab validation run. This keeps provider SDK imports, API-key reads, and provider-specific request construction outside the default source tree while letting the existing validation harness enforce activation gates, timeout behavior, sanitized failures, response-contract checks, and cost-ledger production around the real call boundary. See `docs/runbooks/lab-model-provider-validation.md`.

This is a validation run, not product launch. It should be designed to preserve partial artifacts and expose contract gaps rather than optimize for impressive output.

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
3. `feat(provider)`: first real provider integration behind explicit approval, cumulative budget, and tiny-corpus validation gates. Next.
4. `docs(methodology)` or `fix(substrate)`: codify proven methodology if validation is clean, or revise contracts if validation exposes gaps.
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
