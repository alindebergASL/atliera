# C2-01 — Fresh Retained Two-Account Execution Authorization

Status: **docs-only fresh retained two-account execution authorization; pre-execution checkpoint; not executed; not merged**

Authorization slug: `c2-fresh-retained-two-account-20260829`

This packet authorizes only the exact pending execution slice described below.
This checkpoint precedes execution: it **does not execute the live slice**, run
any provider or model call, retrieve any URL, regenerate any artifact, or write
any state. The machine-readable form is
[`fresh-execution-authorization.json`](fresh-execution-authorization.json).

## Why this packet exists

The governed foundation correction preserved in this directory corrected the
controller policy, custody, taxonomy, provider, and effect boundaries. That
**foundation correction alone did not authorize** fresh model execution. This is
a **separate** packet, and it now authorizes only the exact pending slice — no
more. It does not reopen research, comparison, runtime integration, deployment,
publication, customer action, or merge.

## Exact execution bounds

- Accounts: exactly `acc_university_of_utah` and `acc_fedex_corp`.
- Fixture corpus: `fixtures/account-intelligence/c2-01/broad-account-research-input.json`.
  No public URL retrieval in the initial run.
- Provider `openai-codex`; model `gpt-5.5`.
- Operation `graph.propose` through the injected C2
  `AccountIntelligenceProviderBoundary` / private out-of-repo wrapper.
- Calls: at most 4 provider calls cumulative; at most 2 calls per account; one
  initial call per account. A second (corrective) call per account is permitted
  only via `createAccountIntelligenceCorrectionBoundary`, and only after a typed
  `AccountIntelligenceProposalValidationRefusal` and an exact rejected-proposal
  SHA custody check.
- Per call: `maxOutputTokens` 4096; `maxCostUsd` 0.10; `temperature` 0;
  `store` false.
- Cost: cumulative approved max $0.40. Expected observed subscription cost is 0,
  but this packet makes no billing-enforcement claim.
- C2 local stream capture max 512000 UTF-8 bytes. Transmitted provider
  output-token ceiling is null. Provider-side output-token enforcement remains
  unestablished, and that is explicitly accepted as such.
- Conservative approved combined input-token ceiling 120000. The actual preflight
  input-token count must be recorded before execution and must **fail closed** if
  it exceeds the ceiling. It is not yet recorded in this checkpoint.
- Zero tools, plugins, search, retrieval, shell, or file actions are exposed to
  the provider. Zero hidden fallback or retry. No comparison run, no autonomous
  loop.
- Provider behavior, storage, tool, and network effects remain unestablished
  unless separately receipted; this packet does not claim otherwise.

## Decision tree

Per account, in order, stopping before any cap:

1. Preflight: record actual combined input tokens. If it exceeds 120000, fail
   closed and stop — do not call.
2. Initial call (call 1 of at most 2 for this account). Capture the C2 local
   stream within the 512000-byte ceiling.
3. Run typed deterministic validation on the returned proposal.
   - If validation accepts: this account is done. Do not spend the second call.
   - If validation emits a typed `AccountIntelligenceProposalValidationRefusal`:
     perform the exact rejected-proposal SHA custody check, then issue exactly
     one corrective call via `createAccountIntelligenceCorrectionBoundary`
     (call 2 of at most 2 for this account).
4. On any authority, identity, budget, or schema mismatch: stop immediately.

Stop on any authority/identity/budget/schema mismatch. Stop before the caps.

## Cumulative effect accounting

- The cumulative ceiling is 4 provider calls across both accounts (at most 2
  each) and $0.40 approved cumulative cost.
- Consumed attempts are tallied across the whole run and **consumed attempts are
  never reset**. A refusal-triggered corrective call still counts against both
  the per-account cap (2) and the cumulative cap (4).
- If both accounts each take an initial and a corrective call, all 4 cumulative
  calls are consumed and no further call is authorized under this packet.

## Evidence handling

- Private prompts, raw responses, raw payloads, request IDs, session IDs,
  credentials, and private paths stay **outside the repository**.
- Only sanitized proposal, receipt, lineage, render, and review evidence may be
  committed.

## Downstream, only after validated outputs

- Proposal/render regeneration and local Product/UX browser review are authorized
  only after validated outputs exist.
- Optional fresh public research is **not activated** by this packet. If the
  retained corpus proves insufficient, stop and create an exact
  host/URL/time/byte/retention addendum before any retrieval.

## Merge is not authorized here

This packet does not authorize merge. Later merge still requires the exact final
PR SHA, exact-head CI, exact-head independent reviews, and owner confirmation.
General authorization is not an unknown-future-SHA merge waiver.

## Not authorized by this packet

No Graph/database/persistence write, runtime integration, deployment,
publication, customer action, or merge occurs in the execution step. This
document is a pre-execution approval record only.
