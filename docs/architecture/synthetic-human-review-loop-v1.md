# Synthetic human-review loop V1

## Decision

Atliera has one internal, disposable lab composition for proving this exact path:

`fixture proposal -> pending proposal Workshop -> verified local-lab bearer decision bound to one exact disposable SQLite target -> accepted-only transaction at that target -> fresh restart read-back -> exact-current ratified Workshop`

The composition lives in `src/workshop/synthetic-human-review-loop.ts`. It is not exported from the product barrel and has no CLI, route, package command, deployment wiring, production identity provider, or production backend selection.

This slice reuses the existing authority and transaction chain. It hydrates the exact `ProposalEnvelope`, `CandidateDelta`, `CandidateTransition`, and `SubjectGraphRevisionIntent`; calls `authorizeBearerTokenRequest`; uses `PINNED_DURABLE_WRITE_TRUST_LABEL`; and delegates its only graph transaction and post-transaction read-back to `executeSyntheticTransactionWorkshopProof`. The PR #303 disposable SQLite replay key remains the only durable one-shot namespace. The decision replay identity is an audit binding only and is never stored as another replay record.

Before authentication or decision handling, `renderSyntheticHumanReviewPendingProposal` provides the pure pending step. It accepts only those five exact pipeline artifacts, rehydrates the same fixture chain, builds the existing Workshop view model directly from the proposed candidate, and performs no auth, database, permit, transaction, provider, MCP, network, or production operation. Its pending labels are not storage-current or ratified labels.

## Bounded authentication claim

A host creates an opaque verifier with a pinned actor, session, lab-only assurance, issuance and expiry timestamps, existing local bearer configuration, and a deterministic trusted lab clock. Verification also receives the exact disposable `database_path` and `isolated_temporary_directory`. Each path is strictly snapshotted and required to be in normalized absolute form. A versioned canonical SHA-256 value, with an explicit disposable-target domain and both normalized fields, binds the decision to that target. Only this digest—not either raw path—is exposed in the artifact. The verifier object and each successful auth context are registered in module-private `WeakMap`s. They carry no enumerable credential or authority fields. A caller-created object such as `{ authenticated: true }`, even with a plausible actor, assurance, target digest, or self-hash, is not registered and is rejected at the effect boundary.

The decision request has exactly two own-data fields: `decision` and bounded `reason`. It cannot supply actor identity, auth state, assurance, timestamps, session identity, target identity, bearer material, or a self-hash. The existing bearer helper checks the credential. Missing, invalid, and `disabled-local-dev` auth are refusals for this slice. The trusted clock is checked at verification and again immediately before effect. Effect time must satisfy `reviewed_at <= effect_time < expires_at` (and cannot precede `issued_at`); a clock that regresses even one millisecond before the verifier-recorded review time is refused before database preflight.

The assurance wording is deliberately narrow: `verified-local-lab-bearer-only`. It is not production identity or authentication.

## Decision artifact

Successful verification deterministically creates a deeply frozen canonical artifact with its own SHA-256 integrity digest. The digest is explicitly non-authoritative. The supplied intent remains the validated pending proposal/prewrite intent and is never consumed directly. For acceptance, the coordinator uses `createSubjectGraphRevisionIntent` to derive a second transaction intent. Its existing-schema review handoff preserves every pipeline, predecessor, quality, and replay binding while replacing review attribution with a safe deterministic auth-context reference, trusted review time, and exact decision reason. The review and intent authority blocks remain non-authorizing. The artifact binds:

- exact team, account, subject, and purpose identity;
- envelope SHA-256;
- delta SHA-256 and complete delta;
- transition SHA-256 and complete transition;
- the complete pending intent plus its intent and review-handoff SHA-256 values;
- the complete decision-bound transaction intent/review handoff plus their SHA-256 values for acceptance (null for rejection);
- candidate SHA-256;
- predecessor revision and base snapshot digest;
- complete quality-policy identity and complete quality report;
- decision and bounded reason;
- verifier-pinned actor, lab assurance, auth-context identity, session identity, and the digest-only exact disposable SQLite target;
- issued, reviewed, and expiry timestamps;
- the existing transaction replay key and a non-durable decision replay identity.

At effect time, the supplied database options are snapshotted once and their target digest must equal the opaque context's verifier-issued digest before any preflight read or transaction consume. Every supplied pipeline artifact is then hydrated and rederived again. The decision-bound transaction intent is rebuilt from the opaque auth context and the exact pending pipeline. Because the auth-context identity includes the target digest and is used by the review handoff's safe `reviewer_ref`, the resulting intent/review-handoff identity persisted by PR #303 also carries the target binding without changing PR #303's schema. The decision artifact is snapshotted with strict JSON discipline, its digest is recalculated, and its complete canonical value is compared with that freshly rebuilt artifact. Only the derived transaction intent is passed to PR #304/PR #303. The durable receipt therefore binds the verified decision and exact target through the persisted transaction-intent and review-handoff digests. A different actor, auth context, review time, reason, or target over the same SQLite replay key produces a different intent and cannot borrow the first receipt's ratification. Substitution, self-rehashed target mutation, hostile proxies/accessors, symbols, extra keys, or cross-identity reuse fail before graph mutation.

The existing intent, review handoff, disposable permit, and PR #303 receipt remain truthfully non-authorizing: their `authenticated_human_approval` and `ratification` claims remain false. The opaque verified decision is a separate lab effect gate. Acceptance means human ratification of this exact synthetic proposal for one disposable durable-storage attempt only. It does not mean a quality pass, factual or source verification, production approval, or permission for another effect.

## Transaction and presentation truth

The bounded fixture is required to remain `Borderline`, with `quality_gate.ok=false`, zero accepted excerpts, accepted-excerpt rate `0`, and threshold `0.5`.

| State | Transaction truth | Workshop truth |
| --- | --- | --- |
| Pending proposal | No auth, database, permit, transaction, or effect | Shows `Unverified`, `Model-proposed · pending human review`, all proposal lanes, and proposed evidence without storage-current or ratification claims |
| Exact accept | One PR #303 consume; PR #304 creates a new adapter/read-only connection for restart read-back | Shows `Model-proposed · human-ratified · evidence pending` only when current storage is exactly bound to the decision |
| Exact replay | Existing durable replay returns `already_committed`; no second revision | Says no second write or graph revision |
| Reject | No preflight, consume, intent consumption, or graph revision | Claims neither ratification nor durable application |
| Auth refusal/expiry/forgery | No database or graph open | Claims neither ratification nor durable application |
| Target mismatch or regressed effect clock | Refused before preflight; no database creation or consume | Claims neither ratification nor durable application and exposes no raw database path |
| Conflict | Stale revision/digest returns conflict; no new revision | Does not lend the decision's ratification or quality result to storage-current state |
| Corrupt existing preflight | Fresh read fails before `consume` | Dependency failure; no current approval claim |
| Post-commit read uncertainty | Preserves the transaction's committed/indeterminate truth | Does not misstate this as no commit and renders no ratified/current content |
| Historical/overtaken | Earlier replay receipt remains valid while a later revision is current | Later storage-current lanes remain storage-only/no-decision-attribution and expose their own unverified proposed evidence as pending human review; they receive no borrowed ratification, currentness, quality, actor, or reason |

Only after the non-regressing clock and exact-target digest checks does the accepted effect use a fresh PR #303 adapter for a read-only preflight. A brand-new guarded disposable path has no SQLite file yet, so the read-only adapter reports an open dependency failure; bootstrap may continue only if that path still does not exist. If a database file exists, any refused, busy, malformed, unreadable, or corrupt preflight blocks `consume`. The transaction adapter repeats its own disposable-path guard and durable validation at the effect boundary.

All Workshop HTML escapes actor, reason, identifiers, and graph content; uses responsive wrapping without horizontal overflow; presents exactly one safe next action; and reports provider calls `0`, MCP invocations `0`, product/network operations `0`, and production effects `0`. No bearer token, token hash, secret, or credential material is copied into artifacts, results, HTML, SQLite values, logs, or error messages.

## Deliberate limitations

This is a synthetic fixture proof only. The in-memory opaque context registry does not survive process restart; durable identity/session infrastructure is intentionally not chosen. There is no production authentication, authorization service, approval workflow, approval store, new replay table, retry service, network call, provider call, or production graph effect. A production design requires a separate reviewed decision about identity, session durability, revocation, audit retention, and backend ownership.

## Frozen M5b and operator-arming reconciliation

The frozen M5b review/ratification and repository-native prepare/apply work is reused as precedent, not invoked or modified. In particular, this coordinator follows its exact-binding discipline, raw/canonical identity separation, one-shot behavior, closed adjacent effects, and `human-ratified/evidence-pending` trust doctrine.

`applyM5bRepositoryNative` is deliberately not called. It targets `LocalFileVersionedGraphStore` and persists reject-all terminal revisions. Those semantics conflict with this slice's guarded disposable SQLite target and its requirement that rejection create no graph revision. Calling it would falsely conflate two stores and two terminal-state contracts.

The older M3 operator-arming work is reused only through its exported `ARMED_LIFECYCLE_STATE` constant and established `single-armed-durable-write-attempt`, maximum-attempt-one, retry-zero, and new-decision-required vocabulary. Its JSONL durable-write executor is not called because it belongs to the incompatible M3 storage/execution contract.

The new coordinator is the smallest lab-only bridge between verified local bearer review and the existing PR #303/PR #304 disposable transaction proof. It changes no frozen M5b artifact, adds no parallel approval store or replay namespace, and makes no claim that literal M5b execution or admission occurred.
