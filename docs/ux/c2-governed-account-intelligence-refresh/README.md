# C2-01 — Governed Account Intelligence Refresh

Status: **foundation correction plus a separate fresh-execution authorization for the exact pending slice; not yet executed; historical proposal/render evidence superseded; draft; non-durable; not deployed**

This directory preserves the historical C2-01 vertical-slice artifacts and the corrected deterministic foundation inputs. It does **not** prove a current exact-head model-to-render vertical slice; that slice is now authorized (see below) but not yet executed.

## Current foundation

The current foundation establishes:

1. ordinary account requests are snapshotted as untrusted data and cannot authorize trusted hosts or entities;
2. a separate local/test-only research policy snapshots the canonical entity catalog, trusted-host rules, retained source custody, and exact excerpt-level taxonomy authorizations;
3. admission requires exact account, entity-definition, canonical-URL, content-hash, publisher/title, retrieval-time, source-class, and taxonomy/excerpt matches;
4. system-owned coverage is derived only from controller-authorized admitted excerpt bindings;
5. model proposals remain untrusted schema-v2 data and cannot upgrade coverage or material gaps;
6. provider boundary configuration is snapshotted, while provider behavior and storage/tool/network effects remain external and unestablished unless separately receipted;
7. retained query/source records are not represented as executed external acquisition effects.

The current broad retained corpus admits:

- University of Utah: 10 sources, 33 exact excerpts, 9/10 excerpt-supported taxonomy categories; `procurement` remains a gap.
- FedEx Corporation: 9 sources, 30 exact excerpts, 9/10 excerpt-supported taxonomy categories; `gaps_contradictions` remains a gap.

## Superseded historical artifacts

The five-source Utah and four-source FedEx proposals, admitted-source snapshots, effect receipts, HTML, screenshots, execution ledgers, and model-artifact lineage are preserved byte-for-byte as historical review evidence. They use proposal schema v1 and predate the corrected controller policy, custody, taxonomy, provider, and effect boundaries.

They are therefore:

- **superseded and non-current**;
- not proof of the corrected exact-head vertical slice;
- not eligible for silent grandfathering through proposal schema v2;
- not themselves the authorization for fresh model execution or final rendering — that authorization comes only from the separate packet below, for the exact pending slice.

See `FOUNDATION_STATUS.json` for the machine-readable boundary. The manifests carry the same superseded/non-current status.

## Fresh retained two-account execution (separate packet)

A separate, docs-only approval packet now authorizes only the exact pending
execution slice. The foundation correction alone did not authorize execution;
this packet does, within hard caps, and this checkpoint precedes any execution.

- Authorization slug: `c2-fresh-retained-two-account-20260829`.
- Packet: [`FRESH_EXECUTION_AUTHORIZATION.md`](FRESH_EXECUTION_AUTHORIZATION.md);
  machine-readable form: [`fresh-execution-authorization.json`](fresh-execution-authorization.json).
- It authorizes only the exact pending slice: accounts `acc_university_of_utah`
  and `acc_fedex_corp`, the retained `broad-account-research-input.json` corpus,
  provider `openai-codex`, model `gpt-5.5`, operation `graph.propose`, at most 4
  cumulative provider calls (at most 2 per account, the second only after a typed
  validation refusal), `maxOutputTokens` 4096 and `maxCostUsd` 0.10 per call, and
  $0.40 cumulative approved cost — with no tools, fallback, comparison, retrieval,
  or research.
- It does not activate fresh public research, and it does not authorize merge.
  See the packet for the full decision tree and cumulative accounting.

## What remains incomplete

The authorized slice has not yet been executed. Broad proposals, the final broad
Account Home renderer, regenerated visual proof, Product/UX review, user
readiness, meeting preparation, merge readiness, deployment, publication, and
customer action remain incomplete. Everything beyond the exact pending slice
above remains unauthorized.

## Reviewer navigation

- `fixtures/account-intelligence/c2-01/retained-research-input.json` — corrected five/four-source retained inputs with policy v2.
- `fixtures/account-intelligence/c2-01/broad-account-research-input.json` — corrected broad retained inputs and truthful recorded-effect labels.
- `src/account-intelligence/` — request, policy, custody, admission, proposal, provider, effect, and view boundaries.
- `tests/account-intelligence/` — focused deterministic and adversarial coverage.
- `FOUNDATION_STATUS.json` — current-versus-historical artifact boundary and the fresh-execution authorization block.
- `FRESH_EXECUTION_AUTHORIZATION.md` and `fresh-execution-authorization.json` — the separate docs-only packet authorizing the exact pending slice.
- `artifact-manifest.json`, `visual-artifact-manifest.json`, and `SHA256SUMS` — integrity records; historical artifact hashes are preserved.

## Explicit boundary

The foundation correction by itself authorizes nothing beyond the corrected
deterministic inputs. The separate packet
(`c2-fresh-retained-two-account-20260829`) authorizes only the exact pending
execution slice — the two named accounts, the retained corpus, provider
`openai-codex`, model `gpt-5.5`, `graph.propose`, and at most 4 capped calls —
and nothing else. Proposal/render regeneration and Product/UX review are
authorized only after validated outputs exist. Fresh public research, broadened
scope, Graph/database/persistence writes, runtime integration, deployment,
publication, customer effects, and merge remain unauthorized.
