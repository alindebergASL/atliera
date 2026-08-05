# Synthetic transaction Workshop proof

This lab-only proof composes one fixture-bound path:

`ProposalEnvelope` → `CandidateDelta` → `CandidateTransition` →
`SubjectGraphRevisionIntent` → disposable SQLite transaction → fresh read-back
→ Workshop.

The implementation is `src/workshop/synthetic-transaction-workshop-proof.ts`.
It is deliberately absent from `src/index.ts`, runtime composition, CLI and
package scripts. Tests deep-import it directly. It uses no provider, network,
MCP, deployment, real account or production boundary.

## Composition and authority

The composition rehydrates the exact fixture-bound proposal envelope, supplied
delta, transition and intent using their existing repository constructors. It
also requires the supplied delta to be the exact delta embedded in the
rederived transition. No parallel proposal, transition, intent, policy or
result shape is introduced.

Before reading any supplied field, the composition rejects proxies and takes
one descriptor-only snapshot of the exact six enumerable own data fields at
the root. It separately applies the same plain-object, no-accessor boundary to
the exact database option fields and freezes that local database identity.
Both the writer and fresh reader are constructed only from those captured path
values, so a getter cannot direct the transaction and read-back to different
databases. The optional test-only fault plan belongs only to the writer and is
never copied to the reader.

`SubjectGraphRevisionIntent` remains a non-authorizing commit description. The
only effect admission is the existing exact
`DisposableSqliteSubjectGraphRevisionLabPermit`, created inside the composition
and accepted by the unchanged
`DisposableSqliteSubjectGraphRevisionTransaction`. All effects remain in a
caller-declared, isolated temporary directory below the OS temporary root.

After `consume`, the composition constructs a new adapter instance without the
writer's optional fault plan. Its `readCurrent` call opens a fresh read-only
connection and verifies the graph, installed success receipt and replay link.
Workshop is built only when that independent read returns `found`.

## Presentation truth

The default page makes four questions primary:

- Maps: what is known in current durable state;
- Signals: what changed durably in this transaction;
- Evidence: why candidate validation accepted the change, without claiming
  authenticated human approval; and
- Plays: exactly one safe transaction-aware next action.

The page plainly labels `committed`, `already committed`, `conflicted` or
`refused`. It also labels every rendered graph item with its existing trust
state. Revision tokens, snapshot and intent hashes, policy identity, persisted
and attempt receipts, conflict/refusal detail and operational commit time live
inside a closed `<details>` element. SQLite time is presented only as
operational metadata.

Committed and exact-retry views may identify changed Signals only when the
attempt context binds fully to its receipt and that receipt is also the current
durable receipt: graph, revision, snapshot, intent, receipt digest and
operational commit time must agree. Those are separate claims. After a valid
successor advances the graph, an exact historical retry still truthfully
reports `already committed` with its historical receipt, while Workshop says
the retry changed nothing, identifies the later verified revision as current,
and renders only that current read-back. It does not attribute current Signals,
Evidence or candidate policy to the historical retry. The same rule applies if
a successful commit is overtaken by a newer verified revision before the fresh
read-back.

Conflict and refusal views never project attempted candidate content: they say
that no durable change occurred and render only the independently verified
current state. If current read-back is absent, refused or failed—or if the
transaction result is dependency-failed, read-back-failed or indeterminate—the
composition returns no Workshop projection.

## Deliberate limits

This proof adds no authenticated approval, ratification, production write
authority, external anti-rollback, repair or override. It does not generalize
the transaction into a workflow or event system and does not alter the PR #303
adapter, permit, validation, catalog or result taxonomy. SQLite operational
time means receipts differ across independent databases; rendering is
deterministic for a given verified read-back and contains no ambient time,
network or provider input.
