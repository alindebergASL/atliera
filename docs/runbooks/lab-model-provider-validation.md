# Lab model-provider validation runbook

This runbook covers the first real model-provider validation after the durable artifact-store validation gate. It is intentionally narrow: one explicitly approved lab run, one tiny corpus, one low budget cap, sanitized evidence only, and no production writes.

## Current implementation status

Atliera has a provider-neutral validation harness and an `ExternalCommandModelProvider` seam for the first real provider run.

The seam:

- accepts only an explicit command configured by the lab operator;
- sends the already-built `ModelProviderRequest` as JSON on stdin;
- expects a `ModelProviderResponse` JSON object on stdout;
- applies a bounded timeout and stdout byte cap;
- does not inherit the parent process environment by default;
- allows parent environment inheritance only through an explicit lab-only opt-in;
- returns stable sanitized errors for command failure, timeout, and invalid response JSON;
- does not statically import provider SDK packages;
- does not read provider API keys itself;
- does not estimate cost itself;
- does not persist provider artifacts itself.

Provider SDK import, API-key reads, request construction for the specific provider, and any provider-side cleanup remain outside the default Atliera source tree and must live in the explicit lab command/wrapper used for the approved run.

## Preconditions

Before any paid/provider call:

1. `npm run ci` passes from the exact commit being validated.
2. The real-provider command/wrapper exists outside the repo or in a clearly excluded lab-only location.
3. The command reads one JSON request from stdin and writes one JSON response to stdout.
4. The command does not print credentials, raw provider errors, raw prompts, or response bodies to stderr/stdout except the final response JSON.
5. A tiny external corpus exists outside the repo.
6. A human approval record exists outside the repo and includes:
   - approval id
   - approver
   - provider id
   - model id
   - maximum run cost in USD
   - external corpus reference
   - budget-ledger reference
   - run-evidence reference
   - cleanup-outcome reference
   - cleanup commitment
7. Provider credentials are available only to the external command/wrapper, not committed and not passed through Atliera output. Prefer wrapper-owned credential lookup. If the wrapper absolutely needs ambient environment inheritance, use that explicit lab-only opt-in only for the approved run and never commit the setting with real credentials.
8. The budget cap is deliberately tiny for the first run.

## Recommended first-run shape

Use a single-account, no-production-write corpus with a very small source fixture. The first run should target only the provider boundary and response contract, not quality or product usefulness.

Recommended defaults:

- stage: `provider_validation`
- mode: `model`
- max output tokens: 128-256
- temperature: 0
- estimated cost cap: no more than a few cents
- corpus: one external JSON/JSONL fixture with harmless source text
- output: empty or minimal graph proposal is acceptable if it satisfies the contract

## Sanitized evidence to keep

Keep evidence outside the repo by default. If any summary lands in repo docs, it must be sanitized and should include only:

- provider id and model id if they are non-secret and intentionally public;
- approval reference presence, not secret contents;
- corpus reference presence, not source contents if sensitive;
- validation check names and pass/fail status;
- estimated and observed cost numbers;
- token counts if non-sensitive;
- cleanup outcome status;
- exact commit SHA validated.

Never include:

- API keys, account ids, org ids, tokens, or credential names;
- raw prompts if they include sensitive source material;
- raw provider responses if they include sensitive source material;
- provider request/response headers;
- stack traces from provider wrappers;
- private filesystem paths unless explicitly approved for lab evidence.

## Failure handling

If the run fails before the provider call:

- preserve the sanitized validation report;
- record the failed gate code;
- do not retry until the missing approval, budget, corpus, or credential state is fixed.

If the provider command fails or times out:

- treat it as a provider-boundary failure, not a reason to weaken activation gates;
- preserve sanitized evidence only;
- check wrapper logs locally without committing them;
- open a targeted PR only if Atliera's provider-neutral contract or command seam needs a fix.

If response-contract validation fails:

- do not retry broad prompts by default;
- classify whether the failure is schema, provider/model mismatch, cost/usage mismatch, or prompt-contract output mismatch;
- fix the wrapper or provider prompt outside the repo unless the neutral contract is wrong.

## Current sanitized lab evidence status

The first provider-boundary validation ran through the external command seam against OpenRouter `owl-alpha` for the `graph.propose` operation at commit `6e67b11`. The private evidence remains outside the repository, and the committed summary intentionally records only sanitized status.

Sanitized result classification:

- provider: OpenRouter;
- model: `owl-alpha`;
- operation: `graph.propose`;
- validation scope: first provider-boundary validation;
- evidence location: private evidence retained outside the repository;
- observed cost: $0.

Checks passed:

- activation gates;
- credential status;
- provider call;
- response contract;
- cost ledger entry.

This result satisfies the first real provider boundary and response-contract validation gate. It does not imply launch readiness, product readiness, broad quality acceptance, multi-account corpus readiness, production provider readiness, or full AgentRun-to-artifact pipeline validation. A follow-up validation slice should exercise more of the full pipeline before product-facing runtime work depends on real provider output.

## Exit criteria

The first real provider validation gate is satisfied only when:

- activation gates pass under explicit human approval;
- credential status is present without leaking credential material;
- exactly the approved provider/model boundary is called;
- pre-call estimated cost is under the approved remaining budget;
- response contract validation passes, or fails safely with sanitized evidence;
- a cost ledger entry is produced for success, failure, or refusal;
- cleanup outcome is recorded;
- CI still passes after any targeted fix PR.

Passing this gate does not imply launch readiness, production provider readiness, broad quality acceptance, multi-account corpus readiness, or budget policy completeness beyond the approved lab validation run.
