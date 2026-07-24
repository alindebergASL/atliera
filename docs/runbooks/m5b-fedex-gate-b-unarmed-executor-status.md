# M5b FedEx Gate B Unarmed Executor — Status

## Status

Historical/superseded status: this runbook records the former internal exact-purpose host Gate B core. The host-local v2-r3 result is frozen unqualified provenance only, host forensic qualification is closed, and no v2-r4 is authorized. M5b remains in progress through the repository-native product path in `docs/runbooks/m5b-repository-native-product-completion.md`; the host core is not an active acceptance or execution path. `current_effective_authorization` remains `none`.

The historical implementation session did not read the private custody artifact and did not invoke the core. Its source, public non-executable template, hashes, archive, and evidence are provenance only and are not present-tense authority. Future real source execution and human ratification must use the explicit repository-native decision boundary; control-plane recovery, archive qualification, V4 reconciliation, and further host qualification are closed for M5b.

## Exact bindings

- implementation base commit: `81661693bd0c858a4e0c9400ff68c28cb0b277f3`
- implementation base tree: `e40ff4b3d1a0c394145b9b63ddb5efeaab785a5e`
- reviewed executor identity: a future GO and the later reviewed arming wrapper must agree on the exact reviewed Gate B commit and tree; the wrapper must also literally pin the executable SHA-256/seal identity
- successful post-merge CI run: `29435522041`
- custody artifact SHA-256: `c368ea513220a207ef839b30dd527522a6a76304705c88d7243b64bb6f13eb1f`
- custody artifact bytes: `407195`
- decoded response bytes: `160901`
- response SHA-256: `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`
- policy, descriptor, source URL, CIK, acquisition timestamp, and original retention deadline: the exact production pins exported by `src/workshop/m5b-fedex-system-acquired-source.ts`
- maximum GO lifetime from `authorizedAt` through `validUntil`: `600000` ms
- latest permitted authorization expiry under the current retention decision: `2026-08-13T18:41:11.277Z`

## Unarmed approval surface

`fixtures/validation/m5b-fedex-gate-b-authorization-template.json` is intentionally non-executable: its kind is not the executable authorization kind, it contains placeholders, and it carries `templateOnly: true`. There is no committed current authorization artifact and no default authorization or custody path. The GO may supply only the exact future custody path; it cannot select replay storage or create trust. Its `validFrom` must be at or after `authorizedAt`, and its `validUntil` must be after `authorizedAt`, no more than ten minutes later, and no later than the retention deadline. A later reviewed arming wrapper must literally pin the approved GO's exact-byte SHA-256, reviewed executor commit/tree and executable SHA-256/seal identity, expected authorization/custody owners, and one trusted fixed artifact-independent replay-state root.

The core rejects a GO unless its exact bytes hash to the future wrapper's pin. Exact-byte copies and relocation are the same authority; reformatting, fresh IDs, an equivalent reconstruction, or a wrong future pin refuses before consumption. The GO schema has no replay-root field. The stable marker key derives from the pinned GO digest plus the immutable reviewed executor/executable and custody authority tuple, never GO IDs or a path.

The repository top level is derived from this module and Git and must match; it is not caller input. Runtime snapshots `HEAD` once, derives tree and base ancestry from that immutable SHA, requires a clean worktree and the pinned executable hash, and revalidates HEAD, cleanliness, executable bytes, and descriptor identity before both irreversible boundaries. Authorization and custody identities retain bigint device/inode values, include uid/gid/link count, require the expected owner and exactly one link, and are revalidated after descriptor open.

The trusted replay root must be canonical, repository-external, mode `0700`, expected-owner, descriptor-bound, and non-symlinked. Marker creation uses the validated Linux directory descriptor via `/proc/self/fd/<fd>/<name>` and syncs that same descriptor, so a rename/replacement cannot redirect creation to an unvalidated pathname. `O_EXCL` arbitrates real two-process concurrency. Receipts report `not_created`, `preexisting_replay`, `created_fail_closed`, or `durably_committed`; once exclusive create succeeds, write, marker-fsync, directory-fsync, or close failure remains terminal and is reported as consumed with zero custody reads. Trusted time is sampled initially, immediately before marker creation, and immediately before custody access. Every sample must be at or after `authorizedAt`, strictly less than ten minutes after it, inside `[validFrom, validUntil)`, and before the retention deadline; regression or any boundary violation refuses. A violation after consumption reports the consumed state and performs zero reads. The retry budget is zero.

The returned receipt contains stable refusal codes and counters only; it never returns the authorization path, custody path, replay path, raw or encoded custody bytes, contact/User-Agent data, credentials, or resolved IPs.

## Deterministic outputs and trust

A future authorized success would produce in memory:

1. a production-admitted sanitized source pack through the existing exact production wrapper;
2. a validated FedEx graph candidate;
3. an unratified review packet;
4. production-derived prewrite Workshop HTML; and
5. a sanitized execution receipt.

No output is promoted to verified. Source trust remains `source-backed-not-independently-verified`, independently verified objects remain zero, and the review state remains `unratified-draft`. The executor performs no provider/model call, acquisition, network operation, graph/DB read, graph/DB write, deployment, AWS action, or output-file write.

The fixture-only generator is a separate path and cannot parse or consume a private authorization. It deterministically writes exactly five explicitly named committed synthetic outputs: source pack, candidate, review packet, Workshop HTML, and sanitized synthetic receipt. Those outputs preserve simulated-fixture provenance, no production admission, no private read, unratified review state, unverified objects, and zero external/product effects.

## Adversarial proof

`tests/workshop/m5b-fedex-gate-b-unarmed-executor.test.ts` covers:

- absence of a public route, production wrapper, default path, replay-root GO field, or executable public template;
- exact-byte copy/relocation equivalence and refusal of fresh-ID, reformatted, reconstructed, wrong-pin, or caller-replay-root GOs;
- canonical repository derivation, immutable HEAD/tree/ancestry snapshotting, dirty/tampered executable refusal, and HEAD movement between checks;
- authorization/custody mode, owner, one-link, regular-file, repository-containment, symlink, descriptor-drift, real-hardlink, and above-`2^53` device/inode behavior;
- descriptor-relative creation under deterministic directory rename/replacement and a true two-process consumption race;
- distinct preexisting, post-create, durable, and not-created receipt states, including write, marker-fsync, and directory-fsync failure after exclusive creation;
- initial/pre-consumption/pre-read trusted-time sampling, regression refusal, expiry before consumption, and expiry between consumption and custody read;
- fixed ten-minute GO lifetime preflight plus stale initial, pre-marker, and post-consumption/pre-read refusal;
- durable consumption before the read, a one-read ceiling, zero retry, thrown-read accounting, and short-read accounting;
- path, custody-byte/base64, contact, credential, and resolved-IP sanitization;
- deterministic committed-fixture generation with unratified and unverified trust; and
- byte equality for every one of the five committed artifacts plus section-scoped contradiction refusal; and
- zero network, provider/model, acquisition, graph/DB, deployment, AWS, and external/product effects.

## Present boundary and successor

- PR #289 Gate A: merged.
- M5b: in progress, not shipped.
- Gate B internal core: complete as an unarmed candidate; not exported publicly and not executed against private custody.
- `current_effective_authorization`: `none`.
- private reads: `0`.
- product provider/model calls: `0`.
- acquisitions: `0`.
- graph/DB reads and writes: `0`.
- deployments and AWS actions: `0`.
- retries: `0`.
- external/product effects: `0`.
- local synthetic outputs written by the scoped generator: `5`.

The only possible successor is a separately reviewed arming slice with a fresh explicit GO authorizing the exact external private artifact under the full binding and deadline contract. That wrapper must add literal pins and the fixed replay root; it must not treat the GO as replay-root selection or trust creation. Human ratification, durable graph write/read-back, provider/model execution, another acquisition, generalized H4 work, deployment, recurrence, identity, and launch claims remain separate and unauthorized.
