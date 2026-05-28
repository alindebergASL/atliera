# Controlled 2b-expanded rerun approval

Status: pre-run docs-only approval packet. This packet authorizes exactly one bounded controlled 2b-expanded rerun after the no-spend diagnosis, remediation plan, prompt/proposal contract, and rerun request packet have landed. This PR does not execute the run.

## Decision

Approve exactly one limited live-provider rerun for the controlled 2b-expanded corpus using the remediated `graph.propose` prompt/proposal contract and the deterministic rerun request packet shape from `buildControlledCorpusRerunRequestPacket(...)`.

This approval is for a validation rerun only. It does not approve provider comparison, corpus expansion, production writes, runtime/model-mode integration, product-facing features, launch readiness, product readiness, production readiness, broad model quality, or multi-account corpus readiness.

## Prerequisites

The rerun may execute only after all of these prerequisites are true at the validated commit:

1. `npm run ci` passes.
2. PR #99's `src/agent/controlled-corpus-graph-propose-contract.ts` prompt/proposal contract is present and exports the remediated prompt/proposal contract.
3. PR #100's `src/validation/controlled-corpus-rerun-request-packet.ts` request-packet helper is present and can build a deterministic no-spend request packet.
4. The request packet preserves `approves_live_provider_call: false`, `approves_provider_spend: false`, `approves_expansion_or_comparison: false`, `launch_readiness_claim: false`, and `requires_separate_live_run_approval: true`.
5. The private selected corpus and per-account evidence references are already frozen outside the repository.
6. The live-run approval record exists outside the repository under `atliera.model_activation_approval.v1` before any provider call.

## Approved rerun scope

Approved intended shape:

- validation name: controlled 2b-expanded remediated rerun;
- approval type: docs-only pre-run packet;
- provider route: OpenRouter;
- public model id: `owl-alpha`;
- provider tier: free-tier, with no paid fallback;
- operation: `graph.propose`;
- prompt contract: `controlled_corpus_graph_propose_prompt.v1`;
- rerun request packet: `controlled_corpus_rerun_request_packet.v1`;
- call shape: exactly one provider call per selected role;
- selected role count: exactly three roles;
- selected roles: representative, edge-case, calibration;
- corpus reference pattern: `external-corpus/controlled-2b-expanded-rerun/<run-slug>`;
- maximum output tokens per account: no more than 700;
- temperature: 0;
- max run cost: $0.50 hard approval cap;
- expected observed provider cost: $0.00;
- committed output: sanitized status only, after execution;
- private evidence: retained outside the repository.

The positive $0.50 max run cost exists only to satisfy the positive-cost approval gate. The expected provider charge remains $0.00 for the approved free-tier path. If the provider, wrapper, or ledger reports a nonzero charge that exceeds the approved remaining budget, the rerun must stop and preserve sanitized refusal or failure evidence instead of continuing.

## Frozen request shape

The rerun must use the request preview built from `buildControlledCorpusRerunRequestPacket(...)` or an equivalent private invocation with the same public contract constraints:

- three role requests only: representative, edge-case, and calibration;
- one safe logical account ref per role;
- one safe private input graph reference per role, represented publicly only by a non-sensitive relative reference;
- no raw source text in committed files;
- no private account identifiers in committed files;
- no credentials, provider keys, wrapper logs, headers, private paths, or raw provider responses in committed files;
- deterministic idempotency keys derived from the safe packet id and role labels;
- request metadata that marks the request as a preview until live approval exists.

The rerun must not add, remove, replace, or relabel selected roles after seeing live output. Post-output substitution is a validation failure.

## Execution requirements

Before each provider call:

1. Activation gates must pass for provider `openrouter`, model `owl-alpha`, operation `graph.propose`, and the approved cost cap.
2. The approval record must be present through `atliera.model_activation_approval.v1` outside the repository.
3. The request must match the approved corpus reference prefix, selected roles, prompt schema version, token cap, and temperature.
4. The wrapper must read credentials outside Atliera source and must not receive secrets through committed config.
5. The estimated next cost and cumulative expected cost must fit under this approval packet's remaining budget.

After each provider call:

1. Validate the response through the existing provider response contract.
2. Preserve sanitized provider-validation evidence privately.
3. Package accepted sanitized reports through the deterministic full-pipeline helper.
4. Verify packages using the bootstrap evidence verifier.
5. Convert already-produced, already-sanitized account-level facts into `assessControlledCorpusUsefulness(...)` input.
6. Commit only sanitized status in a later follow-up PR.

No post-validation rereads: after execution, interpretation must use packaged sanitized evidence and already-produced, already-sanitized account-level facts. Do not reread raw source text, prompts, provider responses, wrapper logs, headers, private paths, or credential-bearing materials to reinterpret the result.

## Hard out of scope

This approval does not allow:

- more than one controlled rerun;
- more than the three selected role calls;
- paid fallback;
- automatic retry expansion;
- provider or model comparison;
- corpus expansion beyond representative, edge-case, and calibration roles;
- Anthropic, GPT-5.5, Sonnet, Opus, OpenAI, or other comparison runs;
- production writes;
- runtime/model-mode integration;
- app, worker, database, queue, deployment, or production runtime wiring;
- launch-readiness, product-readiness, production-readiness, broad-model-quality, or multi-account corpus-readiness claims;
- committing source corpus text, prompts, raw provider responses, headers, credential details, account-specific private identifiers, private paths, or wrapper logs.

## Pre-locked interpretation

After execution, choose exactly one interpretation branch before opening follow-up work:

1. If all three accounts are useful and hard invariants hold, record a useful tiny-corpus signal and plan a separately approved next validation or comparison step; do not claim readiness.
2. If any result is weak-but-valid, inspect the rubric, prompts, proposal layer, and evidence policy; do not claim readiness.
3. If any result is zero-output, stop and repair proposal generation or provider-boundary behavior before expanding.
4. If any result is unsupported/invented, stop and repair grounding, provenance, source policy, or graph proposal quality before expanding.
5. If any result is contract failure, stop and repair the surfaced substrate, validation, packaging, or bootstrap-verifier gap before comparison.
6. If operational provider failure prevents accepted output, preserve sanitized refusal evidence and repair the provider-boundary or operational issue before retrying under a new approval packet if needed.

The corpus summary must preserve the worst per-account classification. A useful average cannot hide a weak, zero-output, unsupported/invented, or contract-failure account.

## Provider portability

This approval preserves provider portability. It is not OpenRouter lock-in and is not an `owl-alpha` quality conclusion. OpenRouter remains the approved route only for this one bounded rerun because it matches the previous controlled 2b-expanded evidence path and the current private wrapper setup.

Future separately approved validation or comparison runs may use gateway routes or direct provider APIs such as the Anthropic API and OpenAI API behind the same `ModelProvider` boundary. Switching among gateway and direct provider routes must not require product-logic rewrites.

## Sanitized follow-up record

A later status PR may record only non-sensitive facts:

- commit SHA validated;
- provider route and public model id;
- operation `graph.propose`;
- prompt schema version and rerun request packet schema version;
- approval presence, not approval contents;
- corpus reference safe prefix, not source content;
- selected role labels, not private account identifiers;
- activation, response-contract, cost-ledger, packaging, and bootstrap-verifier status;
- observed token counts and observed cost;
- usefulness classification counts;
- worst-case corpus classification;
- no production writes;
- no runtime/model-mode integration;
- no readiness or broad-quality claim.

## Separate execution follow-up

The separate sanitized execution follow-up is recorded in `docs/runbooks/controlled-2b-expanded-rerun-status.md`. The approval PR was docs-only and did not execute the run. The status follow-up records the validated commit, provider route, public model id, prompt schema, request-packet schema, role labels, token counts, observed cost, activation/response/cost/packaging/bootstrap status, usefulness classification counts, and preserved no-readiness/no-broad-quality boundaries.
