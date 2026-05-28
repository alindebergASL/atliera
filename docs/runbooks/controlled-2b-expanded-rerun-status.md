# Controlled 2b-expanded rerun sanitized status

Status: sanitized execution follow-up. This document records the separate execution authorized by `controlled-2b-expanded-rerun-approval.md`. The approval PR was docs-only and did not execute the run.

## Sanitized execution record

The controlled 2b-expanded remediated rerun executed at commit `66a8b6f` using OpenRouter `owl-alpha` for `graph.propose`. The run used the `controlled_corpus_graph_propose_prompt.v1` prompt/proposal contract and the `controlled_corpus_rerun_request_packet.v1` request-packet shape.

Execution shape:

- provider route: OpenRouter;
- public model id: `owl-alpha`;
- operation: `graph.propose`;
- prompt schema version: `controlled_corpus_graph_propose_prompt.v1`;
- rerun request packet schema version: `controlled_corpus_rerun_request_packet.v1`;
- approval presence: `atliera.model_activation_approval.v1` was present outside the repository before the provider calls;
- corpus reference safe prefix: `external-corpus/controlled-2b-expanded-rerun/`;
- selected role count: exactly three roles;
- selected roles: representative, edge-case, calibration;
- call shape: one provider call per selected role;
- temperature: 0;
- maximum output tokens per account: 700;
- max run cost approval cap: $0.50;
- expected observed provider cost: $0.00;
- observed provider cost: $0.00;
- estimated ledger cost: $0.03;
- total input tokens: 2381;
- total output tokens: 1122;
- production writes: none;
- runtime/model-mode integration: none.

Checks passed for each selected role:

- activation gates;
- credential status;
- provider call;
- response contract;
- cost ledger;
- full-pipeline packaging;
- bootstrap evidence verifier.

Each role produced a deterministic full-pipeline package and a role-scoped manifest hash in private sanitized evidence. The committed record does not include source text, private account identifiers, approval contents, credential details, private paths, wrapper logs, prompts, headers, or provider response bodies.

`assessControlledCorpusUsefulness(...)` classified the already-produced, already-sanitized account-level facts as useful overall. Classification counts: useful 3, weak-but-valid 0, zero-output 0, unsupported/invented 0, contract failure 0. The assessment preserved `launch_readiness_claim: false`.

The selected pre-locked interpretation branch is: useful tiny-corpus signal. This means the next step may be a separately approved validation or comparison planning step, not a launch-readiness claim.

## Boundaries preserved

This status record does not approve provider comparison, model comparison, corpus expansion, production writes, runtime/model-mode integration, app/worker/database/queue/deployment work, paid fallback, or automatic retry expansion.

This result does not imply launch readiness, does not imply product readiness, does not establish production readiness, does not establish broad model quality, and does not establish multi-account corpus readiness.

Provider portability remains intact. This is not OpenRouter lock-in and is not an `owl-alpha` quality conclusion. Future separately approved validation or comparison runs may use gateway routes or direct provider APIs such as the Anthropic API and OpenAI API behind the same `ModelProvider` boundary.
