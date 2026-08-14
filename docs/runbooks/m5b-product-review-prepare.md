# M5b generic product-review prepare

Status: additive current product route with dormant exact-source controls. No committed artifact authorizes a live acquisition or retained-custody read, and this runbook authorizes no ratification, apply, graph/database write, provider call, network call, deployment, or outbound action.

This path recovers the product-review package in the current repository schema without changing the historical FedEx package or the existing `m5b:prepare` / `m5b:apply` behavior. It is the preferred current product route. The older FedEx-specific completion path and validators are preserved byte/behavior-compatible historical/reference behavior, not the preferred route. The generic path has no permanent FedEx-specific product branch.

## Pre-effect boundary

`m5b:product-review:prepare` admits one exact-byte-pinned schema-v2 JSON request and two to four separately pinned local UTF-8 source files. Schema v1 remains historical review material and is not accepted by the current prepare command. The request supplies:

- the account/team identity, five plain-language customer answers, an exact material-evidence binding for “What meaningfully changed?”, source facts, analysis, and recommendations;
- a stable ID, title, absolute local path, source kind, content encoding, outer byte size/SHA-256, decoded byte size/SHA-256, canonical credential-free and query-free HTTPS URL, acquisition timestamp, evidence-current-through value or `null`, publisher, and source type for every source;
- exact evidence quotes, each required to occur once across the admitted sources and typed as `account_identity`, `account_context`, or `material_change`;
- explicit Signal, Map, and draft-meeting-brief Play proposals, with dependencies and visible caveats;
- caller-provided execution commit/tree, owner authorization ID, and an exact 64-hex `supersededPackageResultSha256`;
- the exact explanation: `Supersession preserves the old package bytes and producer identity; it does not rewrite historical provenance.`

The request must keep `currentEffectiveAuthorization: none`, `ratificationStatus: unratified`, `armingStatus: unarmed`, and `applyEligibility: false`. Source-fact titles and summaries use the same exact `Source states: …` attribution. Analysis and recommendations cite supporting proposal IDs and evidence. The safe-next answer and recommendation task use the fixed non-executable description `Prepare and review a draft targeted-meeting brief; keep it internal, editable, and unsent.`

The evidence role is an exact-reviewed assertion, not independent semantic verification. The current contract nevertheless refuses a package unless it has a complete product chain:

1. at least one `material_change` exact excerpt containing a recognized strong change/event marker; identity and static-context phrases, plus weak planning/reporting language alone, do not qualify;
2. a source-fact Signal bound to that excerpt, with no identity/context-only source fact occupying the Signal slot;
3. the “What meaningfully changed?” answer bound to the same material evidence carried by the chain;
4. a Map analysis that directly depends on the material-change Signal and carries its evidence; and
5. every Play recommendation directly depending on a qualifying Map analysis and carrying that same evidence.

Evidence roles survive into the sanitized source pack and review packet, their transformation hashes, the rendered Workshop and meeting brief, and each candidate account object's payload. The role makes the producer's material-change assertion explicit and reviewable instead of letting an unlabeled identity or context excerpt silently occupy the product chain. The validator uses a finite, account-neutral vocabulary of strong change/event markers; it rejects static identity/context and weak reporting/planning text, but it does not infer business materiality. A genuine change phrased without a recognized marker fails closed and requires a more explicit exact excerpt. A reviewer must still assess whether a quote labeled `material_change` describes a useful account event.

All-synthetic requests remain valid for deterministic tests. If any admitted request source is production custody, every `material_change` binding must also come from production custody; a mixed request cannot use synthetic material evidence to qualify a nominally real package.

Preparation preflights every path, size, ID, and binding before reading evidence. It reads the request once and each physical evidence source once, refuses symlinks, hardlinks, path overlap, tamper, invalid UTF-8, ambiguous evidence, unsafe URLs, or hostile input shapes, and publishes through a new same-parent staging directory. The destination must not exist.

Synthetic fixtures remain explicitly classified and repeatable. A production `m4_public_http_fetch_custody_v1` source represents pre-existing retained custody: the ordinary CLI call has no authority handle and refuses before opening retained custody bytes. The programmatic prepare surface requires an opaque, armed one-shot retained-read attempt bound to the request commit/tree, exact M4 policy hash, retained source IDs, URLs, outer and decoded hashes and byte sizes, plus the SHA-256 identity of the exact normalized real ledger root. It exclusively creates and fsyncs a mode-`0600` consumption record below that mode-`0700` root before the first retained evidence byte is read. The stable namespace excludes GO formatting and output paths but includes the ledger-root identity. Copying or reformatting the GO, changing the output directory, or reconstructing the ledger/attempt objects for the same root therefore hits the same durable collision; copying the GO and expected authority to another root fails before an attempt exists. A refused byte identity, receipt, or later prepare step remains consumed. An `exact_sec_archive_custody_v1` source instead proves its already-consumed one-shot acquisition by matching the receipt to the exact intact record in a separately supplied opaque acquisition-ledger handle; reading that newly acquired custody during preparation does not consume or claim a second retained-custody-read authority.

The ledger refuses a non-canonical or substituted root, replay/collision, partial record, symlink, hardlink, record substitution, malformed time, wrong commit/tree/policy/source binding, or the inert template. File and containing directory are fsynced. `evidenceSourceReads`, `syntheticSourceReads`, `retainedCustodyReads`, and `retainedCustodyReadAuthorityConsumptions` make the prepare accounting explicit. `retainedCustodyReads` counts retained production M4 custody only. Acquisition remains separate and is still counted as zero by prepare.

`contentEncoding: raw_utf8` is synthetic-only and requires outer and decoded identities to be identical. A synthetic `m4_public_http_fetch_custody_v1` fixture remains explicit and its complete small fixture shape is exact-key checked. Production M4 custody is accepted only after the full relevant shipped receipt is validated by the account-neutral M4 envelope admission seam: target policy, capability descriptor, adapter/activation/consumption identity, requested/final URL, response bytes/hash, trust and custody claims, capability execution, accounting, extraction, and outer custody hash. `contentEncoding: exact_sec_archive_custody_v1` similarly validates the full generic exact-archive receipt, including a recomputed acquisition ledger namespace and record hash. Caller labels alone cannot promote fixture bytes to production classification.

The sanitized source pack binds an explicit provenance object for every source. Production provenance includes the target-policy hash, capability and adapter identities, acquisition authority/consumption and implementation identities, exact URL, response byte count/hash, and outer custody hash. Retained M4 provenance additionally includes the separate retained-read authority/consumption, commit/tree, ledger namespace, and ledger-record hash; exact archive provenance keeps those retained-read fields explicitly `null`. The full source is still omitted; only bounded exact excerpts proceed.

No complete source file is copied into the package. The current validated candidate stores only the bounded exact excerpts for each source. Each candidate source records its raw origin hash, excerpt-only stored hash, and deterministic transformation-manifest hash; the sanitized source pack separately records original and stored character spans.

## Exact invocation shape

All paths are normalized absolute paths. `--source` is repeated exactly once for each manifest source and must use the manifest's exact `source-id=local-path` binding.

```sh
npm run m5b:product-review:prepare -- \
  --request /absolute/path/product-review-request.json \
  --expected-request-sha256 <64-lowercase-hex> \
  --expected-request-size <positive-byte-count> \
  --source src_account_product=/absolute/path/product.html \
  --source src_account_metrics=/absolute/path/metrics.json \
  --source src_account_notes=/absolute/path/notes.txt \
  --output /absolute/path/new-prepared-package
```

The fixed output inventory is:

- `sanitized-source-pack.json`
- `candidate.json`
- `review-packet.json`
- `workshop-pre-ratification.html`
- `meeting-brief.md`
- `prepare-result.json`

`prepare-result.json` byte-hashes the other five files. The source pack, current validated candidate, review packet, Workshop page, and meeting brief form a forward hash chain bound to the exact request bytes/canonical data, every outer/decoded/stored source identity, execution commit/tree, owner authorization, and superseded result hash.

The package builder and renderers are internal deterministic stages of the prepare path, not independent provenance authenticators. Both formatters require the complete serialized source-pack/candidate/review-packet triad. Shared admission fully rehydrates the validated candidate, recomputes its SHA-256, validates the packet and source-pack schemas and topology, and cross-checks the candidate subject, exact private-builder record shape, mirrored graph-source identities and excerpt text, and embedded package/source-pack bindings. Those checks establish package self-consistency and reject cross-artifact drift or non-builder candidate semantics even when the affected candidate and packet self-hashes are recomputed. They still cannot prove excerpt membership in omitted original source bytes, distinguish a coherently fabricated triad from trusted preparation, or authenticate caller-fabricated production custody. Only `prepareM5bProductReview` performs that stronger check against admitted source bytes and opaque effect-ledger state. Product copy therefore calls exact excerpts **package-attributed**, not independently source-proven. Self-consistent rehashing is not a trusted provenance root; external review must pin the exact prepare result and, when execution provenance matters, its immutable execution receipt.

The Workshop controls are local browser draft state only. Accept/Reject is not saved, serialized, submitted, or treated as ratification. The sole CTA lands on an inline account-specific draft brief containing all five customer answers and the material-change Signal → Map analysis → Play chain with its fact/analysis/recommendation and trust labels. The page has no submit/apply/persist action and no write authority.

All six generated files are immutable outputs of the exact prepare implementation. A wrapper may return a separate immutable execution receipt for prerequisite acquisition or retained-custody-read effects, but it must not post-process the Workshop, meeting brief, or JSON package. The zero counts rendered inside the package are explicitly scoped to the prepare command itself; they do not erase separately authorized prerequisite effects.

## Acquisition and supersession

Prepare does not acquire sources. A generic exact-SEC-archive policy factory derives the canonical target URL only from a strict target reference, numeric CIK, 18-digit accession without dashes, and primary-document basename. Product source commits no permanent archive target instance or hash. The policy binds canonical HTTPS, `www.sec.gov`, the exact `/Archives/edgar/data/{numeric CIK}/{18-digit accession without dashes}/{primary-document basename}` path, fixed GET/IPv4, one DNS attempt, one pinned public address/connection/request, zero redirects/retries, identity encoding, a 10-second total deadline, a 1 MiB body bound, and `text/html` with only optional UTF-8 charset. Credentials, ports, query, fragment, percent encoding, encoded separators, traversal, and path drift are refused.

The exact-target core remains in `m4-sec-live-adapter.ts`, the repository's existing confined `node:dns`/`node:https` import surface. Policy data alone cannot call it. `acquireM5bExactSecArchive` accepts and strictly validates the injected policy, derives its canonical SHA-256, then consumes and rechecks an opaque exact GO bound to that policy, source URL, and ledger-root identity; only then may it touch injected transport dependencies or construct Node dependencies. Success returns exact response base64/bytes/hash, a strict UTF-8 quoted copy, untrusted-source semantics, complete acquisition/activation accounting, serialized custody bytes, and the outer custody SHA-256. Failure or refusal after consumption remains consumed. There is no CLI, scheduler, production wiring, enabled GO, or committed contact value for this adapter.

The strict schema and factory live in `src/capability/exact-sec-archive-target-policy.ts`; each reviewed input produces its own derived policy hash. `fixtures/validation/m5b-product-effect-authority-template.json` is the only committed authority template for these operations; it selects neither a ledger-root hash nor a target-policy hash, and both acquisition and retained-custody read are explicitly unarmed, unauthorized, and budgeted for zero effects. It cannot validate as a GO. No SEC content was fetched to implement or test this slice; tests use synthetic injected transports and sanitized custody.

Supersession creates a new package linked to the old result hash. It preserves the old package's exact bytes and producer identity and never regenerates, edits, or re-labels historical artifacts. The older package remains immutable provenance.

## Owner disposition is non-executable

`m5b-product-review-disposition.ts` provides a typed exact-package-bound owner disposition template and validator. Both entry points first admit the complete serialized source-pack, candidate, and review-packet triad through the same current-v2 shape, hash, cross-artifact binding, proposal-semantics, evidence-topology, and safe-boundary checks used for presentation; a packet self-hash alone is not sufficient. This admission proves only internal triad self-consistency. It does not authenticate omitted request/source bytes or caller-asserted custody provenance, so external review must still pin the exact prepare result and any applicable immutable execution receipt. The disposition requires one ordered `accept` or `reject` for every proposal and binds package ID, request hashes, source-pack hash, candidate hash, review-packet hash, and owner authorization ID. It contains no ratifier identity/time because it is not ratified. Hard constants state that it is non-executable, unratified, unarmed, unsaved by the Workshop, ineligible as apply input, and authorizes no ratification, apply, graph/database/provider/network write, or deployment.

There is intentionally no `m5b:product-review:apply` command, graph-store integration, provider/runtime wiring, or deployment path. The existing historical `m5b:apply` command is unchanged, accepts only its established legacy package contract, and does not import or accept the new disposition artifact. Any future ratification or effectful step requires a separate design and explicit authorization.
