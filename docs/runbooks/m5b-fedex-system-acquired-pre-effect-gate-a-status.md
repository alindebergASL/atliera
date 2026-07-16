# M5b FedEx System-Acquired Source Pre-Effect — Gate A Status

Status: historical Gate A record; superseded for current accounting by the unarmed Gate B scope

This runbook records the implemented M5b Gate A candidate for the eventual page “FedEx — source-backed account snapshot.” It is substantive runtime code plus deterministic review artifacts, not a plan and not a shipped M5b loop. It authorizes and performs no private custody read, provider/model call, acquisition, graph ingestion, durable write, deployment, recurrence, identity work, or production effect.

Boundary markers after completion:

- implementation_work_authorized: none
- current_effective_authorization: none
- authorizes_private_custody_read: false
- authorizes_provider_call: false
- authorizes_acquisition: false
- authorizes_graph_ingestion: false
- authorizes_durable_write: false
- authorizes_deployment: false
- authorizes_retry: false
- private_reads: 0
- provider_calls: 0
- acquisitions: 0
- graph_writes: 0
- deployments: 0
- external_product_effects: 0
- retries: 0
- local_deterministic_fixture_outputs_written: 3 (historical Gate A only)
- independently_verified_objects: 0
- readiness_claim: false
- shipped_claim: false
- next_private_read_gate_authorized: false
- pr_289_approval_on_then_current_exact_head_required: false (satisfied historically)
- pr_289_merge_required: false (satisfied historically)
- successful_post_merge_ci_required: false (satisfied by run 29435522041)
- resulting_merge_commit_sha_and_tree_binding_required: false (base fixed below; future reviewed executor identity is separate)
- exact_custody_artifact_identity_required: true
- separately_supplied_private_path_required: true
- execution_before_2026-08-13T18:41:11.277Z_required_unless_separately_ratified_bounded_retention_exists: true

## Implemented narrow path

`src/workshop/m5b-fedex-system-acquired-source.ts` pins the exact M4 custody artifact SHA-256, decoded response size and SHA-256, M4 target-policy and capability-descriptor SHA-256 values, source URL, CIK, acquired timestamp, and original custody retention deadline. The future production admission wrapper accepts only caller-supplied bytes. It has no path parameter or default path and performs no file read. Before copying custody or decoding base64 it enforces named custody and encoded-body ceilings. Every hostile object boundary enforces own-property, primitive leaf/property, per-string UTF-8, cumulative canonical UTF-8, recursion-depth, cycle, array-size, and total-node ceilings; own names are counted before descriptor reflection, and accessors are rejected without reading values. The wrapper checks the outer custody SHA-256 before UTF-8 decoding or parsing, validates the exact M4 custody/acquisition/execution envelope, reuses the unchanged `extractM4SecEvidence` validator, verifies body hash and size, and strictly decodes the response. Alternate synthetic pins always remain non-production.

The bounded extractor preserves exact literals for `/name`, `/cik`, `/tickers`, `/exchanges`, `/sic`, and `/sicDescription`. Production-admitted extraction is internal and token-gated; no exported options or boolean can self-assert it. The only public raw-response extractor is narrowly fixture-only and always emits `exactProductionCustodyAdmissionCompleted: false`, origin `simulated-fixture`, source type `simulated_fixture_sec_submissions_bounded_projection`, and the exact synthetic/committed-public fixture notice. The exact strings `system-acquired-public` and `system_acquired_sec_submissions_bounded_projection` are reserved for the production-admitted path. Sanitized pack construction accepts only bounded source objects issued by these internal extraction paths. The extractor records CIK display padding and aligned ticker/exchange selection as explicit transformations. Optional filing metadata is emitted only when all four `filings.recent` arrays are own-data arrays of equal length, every filing date is canonical, and the newest date is unique. Any mismatch, invalid date, duplicate newest date, or other ambiguity omits the filing row.

The sanitized source-pack schema is canonical-JSON hashed and may carry serialized production-admission evidence as content identity only. Those public constants and their hash are not authority. The committed fixture has `productionAdmissionEvidence: null` together with its synthetic classification and `exactProductionCustodyAdmissionCompleted: false`. The pack contains no raw response, encoded response, private path, contact, resolved IP address, or credential. `src/workshop/m5b-fedex-review-composition.ts` cleanly imports the source and candidate boundaries: packet construction receives the actual candidate, rebuilds and verifies it against the exact pack, and derives `candidateContentSha256`; packet verification, review-draft application, retention-draft handling, rendering, and future composition all receive and reverify that candidate. Arbitrary digests and rehashed or semantically counterfeit bundles refuse.

Individual proposal and retention selections are pure, hash-bound, explicitly `unratified-draft`, and `satisfiesFutureArming: false`. They are not human decisions or ratification artifacts. Partial drafts stay unarmed. Duplicate, missing-shape, unknown, counterfeit-packet, counterfeit-hash, counterfeit-candidate, and counterfeit-boundary inputs refuse. Caller-mintable hashes authorize neither retention nor a future private read, provider call, arming, or durable write. A later genuine external ratification artifact remains required.

## Visible candidate

`src/workshop/m5b-fedex-review-composition.ts` builds a parsed and validated GraphBundle with one SourceDocument, two required unverified system-created claims, two Maps account objects, proposed excerpts, and zero independently verified objects. Candidate payload origins and source types are conditional on the verified pack. A clean uniquely newest filing row may add one metadata-only Signal and one claim; the candidate never exceeds four excerpts, three claims, or three account objects. “Air Courier Services” is visibly scoped to the SEC SIC label and is not presented as a comprehensive description of FedEx’s current business.

The renderer escapes all content. It emits a link only for credential-free HTTP(S) URLs and adds `rel="noreferrer noopener"`; unsafe URLs remain text. The committed demo deliberately uses empty filing arrays, so Signals and Plays both render honest empty states. Its fixture labels say “Simulated SEC fixture source” and “Fixture source SHA-256”; they never say “System-acquired SEC source” or “Production response SHA-256.”

Visible artifact:

- `fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html`

Machine review artifacts:

- `fixtures/validation/m5b-fedex-system-acquired-demo-source-pack.json`
- `fixtures/validation/m5b-fedex-system-acquired-review-packet.json`

Committed generator input and command:

- `fixtures/validation/m5b-fedex-system-acquired-demo-source.json`
- `npm run workshop:m5b-fedex-prewrite`

The generator reads only that fixed committed input and writes only the source pack, review packet, and HTML paths above. It imports no network, provider, private-read, or durable-write module.

## Optional model and future effect seams

The optional model proposal contract is inert: model-only transport; the complete verified sanitized source pack as the exact input; an independently checked exact source-pack hash binding; at most one future call; zero retries; provider and model null; all capabilities false; provider-call authority false; calls performed zero. Its validator rejects a missing, mismatched, rehashed-counterfeit, or non-canonical embedded pack. A filing Signal or restrained filing Play must cite exactly and uniquely `exc_fedex_latest_filing_metadata`; duplicates, identity-only, classification-only, mixed, invented, and empty citations refuse, as does both-item output. No model call was executed.

Future composition does not trust serialized admission content. It requires caller-supplied exact custody `Uint8Array` bytes, invokes the exact production byte-admission wrapper, rebuilds the production source pack from the admitted bytes, requires canonical exact equality to the supplied pack, and reverifies the actual candidate, packet, and review/retention draft. The complete hostile relabel + public-evidence insertion + rehash + candidate + packet + draft rebuild refuses when supplied fixture bytes. No path, host state, key, secret, signature, or process-local identity substitutes for admission. Even a positive byte-admitted composition would remain plain frozen, unarmed data with `humanRatificationSatisfied: false`, `eligibleForFutureArming: false`, and a later external ratification artifact required; review/retention draft hashes cannot satisfy future arming.

## Remaining blocker and next gate

Historical successor reconciliation: PR #289 was approved and merged, and successful post-merge CI is now a pinned input to the separate unarmed Gate B implementation recorded in `docs/runbooks/m5b-fedex-gate-b-unarmed-executor-status.md`. Those satisfied implementation prerequisites are not present-tense authority. No private read is currently authorized. A future read requires a fresh explicit external private one-shot GO carrying the exact path and all identity/deadline bindings, with a fixed maximum lifetime of ten minutes (`600000` ms). This Gate A slice supplies no genuine external ratification artifact, so review and retention outputs remain inert drafts. M5b remains 🔶 in progress, Gate B unarmed, and not shipped.

For historical regression context only, the superseded Gate A blocker said the “next possible private-read gate is not authorized” and required “approval of PR #289 on its then-current exact head,” “successful post-merge CI,” “the resulting merge commit SHA and tree,” and “the exact custody artifact identity plus a separately supplied private path,” with execution before `2026-08-13T18:41:11.277Z` unless a separately ratified bounded retention decision existed. Those implementation prerequisites are satisfied; none is reusable execution authority.

Historical Gate A counters only: private reads 0; product provider calls 0; acquisitions 0; graph/durable writes 0; deployments 0; retries 0; external/product effects 0. The Gate A deterministic generator historically wrote exactly 3 local fixture outputs. Active Gate B accounting is separate and records exactly 5 synthetic outputs.
