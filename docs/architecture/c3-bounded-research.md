# Account-scoped bounded source research

C3 Research can explicitly acquire and inspect retained official source pages through
`BoundedResearchExecution`. It does not establish current service availability, classify
findings, admit generation evidence, or approve source statements. Existing account
readings and saved briefs retain their original context. This implementation alone is
not C/D journey acceptance.

## Operator launch contract

The accepted two-account entrypoint is:

```sh
node dist/c3/atliera-c3.js serve-accounts [UTAH_RECORDING_DIRECTORY] \
  --research-config /absolute/private/research-config.json [--enable-research]
```

Without a config, every account reports unavailable. With a config but without
`--enable-research`, retained snapshots can be inspected but acquisition is disabled.
Both the launch flag and the account's explicit `enabled: true` are required to execute.
Loading pages, status, inspection, construction, and restart never acquire sources.
The existing model/provider configuration, recorded replay, work store and FedEx hold
are unchanged. This entrypoint does not add a paid model route.

The operator file is a JSON array, with at most one configuration per canonical
account. It must be an owned regular file, mode 0600, without hardlinks or symlink
ancestors, outside the repository, at most 32 KB. Each entry has exactly:

- `principal`, `accountId`: trusted runtime identities. If a work-store principal is
  configured, the research principal must match it.
- `enabled`: a boolean, never accepted from the browser.
- `validFrom`, `validUntil`: explicit UTC ISO timestamps, including milliseconds.
  Execution checks this window before start and before every actual exchange.
- `retentionRoot`: an existing owned directory, mode 0700, outside the repository,
  without symlink ancestors, dedicated to this principal/account/scope. It must not
  overlap a work store or another account's research retention root.
- `scope`: the existing strict `ResearchScope`: matching principal/account, precise
  `question`, `authorizationRef`, exact `allowedHosts`, exact `targets`, and `limits`.
  Each target declares `url`, `redirectUrls`, `publisher`, `entityId`, and
  `relationshipToAccount` (`account` or `related_entity`). No crawling, search or guessed
  URLs are added. Redirect permission names exact destinations, never wildcard hosts.

Limits remain `pages <= 6`, `attempts <= 6` per run (including redirects), `runs <= 2`
for the persistent scope, `responseBytes <= 262144`, `cleanTextChars <= 32000`, and
`timeoutMs <= 15000`, with positive integers required. The second run is an explicit
refresh, including recovery after an incomplete first attempt. Reservations survive
failure, cancellation and process death. Do not replace the retention root or alter
scope to replenish exhausted caps; reusing a root with different scope fails custody
validation. A changed authorization window cannot erase stored reservations.

`authorizationRef` is provenance, not executable authority. The parent/operator must
bind the actual grant, reviewed code and exact runtime config before enabling. This
file is a technical contract and grants no live source, paid, account or budget scope.
For the current finite proof, target selection remains with the parent; known historical
URL identifiers do not prove current source contents. No live config or private store
belongs in the public repository.

Programmatic runtimes use optional `C3AccountServiceOptions.research`, containing
`config`, an optional trusted `networkEnabled` callback, and the explicitly named
`testOnlyTransport` synthetic seam. Native production dependencies are used only when
that seam is absent. Research requires canonical account routing (`accounts` supplied).
`RunningC3Server.disableResearch(accountId)` permanently disables that account in this
process and aborts its active exchange. Shutdown does the same. A callback returning
false blocks subsequent dispatch; use `disableResearch` for immediate cancellation.
This remains a localhost operator service, not a multitenant authentication scheme.

## HTTP and custody

All actions are same-origin JSON POSTs under `/accounts/:accountId/api/research/`.
They use the existing host, session cookie, CSRF, origin, account and displayed-document
guards. URLs, paths, principals, sessions, enablement and approvals cannot be supplied
in bodies. Unknown body keys or noncanonical/query-suffixed API routes are refused.

| Action suffix | Exact body | Behavior |
| --- | --- | --- |
| `start` | `{}` | One initial reservation; repeated clicks/retries reuse it. |
| `status` | `{}` | Observe current browser run and account/principal snapshots. |
| `run` | `{runId}` | Inspect only this session's run. No dispatch. |
| `cancel` | `{runId}` | Cancel only this session's run; keep consumed reservations. |
| `refresh` | `{snapshotId}` | Latest snapshot only; persistent second-run cap and stable retry identity. |
| `recover` | `{}` | Existing C1 bookkeeping only; no acquisition or restored allowance. |
| `snapshot` | `{snapshotId}` | Reopen any bound historical snapshot after restart. |
| `source` | `{snapshotId, sourceId}` | Resolve original bound source custody and render inert full context. |
| `select` | `{snapshotId, sourceId, passageSha256}` | Validate latest snapshot and exact passage; return a D input identity, never generate. |

Run identity includes the runtime browser session. Historical snapshots intentionally
bind account/principal independently of browser sessions, so a fresh browser after
restart can inspect source bytes. Status can disclose historical snapshots but cannot
cancel another session's run. An interrupted run appears as interrupted on read;
explicit recovery appends the existing safe bookkeeping receipt. Old receipt bytes
remain unchanged. Corrupted stores fail validation instead of being repaired.

Source bodies remain exact base64 bytes in private C1 receipts, with SHA-256 checks.
The guarded source API can return these bytes as JSON; there is no raw HTML download
or navigable source-body route. JSON is no-store, `nosniff`, and `application/json`.
All source-derived HTML in the panel is escaped. Full retained clean text includes
extraction/truncation limits. Retrieval time is distinct from publication, event and
current-through dates; unestablished dates remain unknown. Exact passage positions
are zero-based JavaScript UTF-16 indices into the hashed clean text, end-exclusive;
passage hashes are SHA-256 of UTF-8 text. Question-term matching is deterministic
navigation, not relevance admission, inference or verified findings. Unmatched pages
report that limitation instead of displaying invented answers.

Refresh comparison is the C1 raw-body comparison: changed, unchanged, added, removed
or unavailable capture observations. With an unchanged exact target scope, an absent
failed capture is `unavailable`, not `removed`; the UI must not imply a removed service.
No reading, note, proposal, workContext, Apply or Save changes as a side effect.
The client updates only the research panel and uses the existing guarded request
helper; dirty document forms and the accepted account switch behavior are preserved.

## Native boundary and verification

`research-native-https.ts` is the only new outbound-import boundary. It constructs no
resolver or socket on import/factory creation. At dispatch, A and AAAA are resolved
with bounded resolver attempts; the C1 wrapper rejects the whole answer if any address
is nonpublic. Resolution receives the enclosing abort signal. The exchange performs
one HTTPS GET, pinned lookup, fixed port 443, URL-hostname SNI and certificate identity
verification, and checks the actual authorized TLS socket address. There is no proxy
configuration, credential/cookie header, automatic redirect, retry or decompression.
It bounds streaming bytes and total time, rejects encoded responses, incomplete or
length-mismatched bodies, and destroys resources on failure or cancellation. Redirects
are returned as one hop for C1's exact-destination/cumulative-attempt policy.

Synthetic DNS and deterministic request events exercise the wrapper and the same socket
state machine without external requests. Host-local proof is executable separately:

```sh
node --import tsx tests/c3/c3-research-native.host.ts
```

That test creates an ephemeral synthetic certificate and loopback TLS server, exercises
matching and mismatching TLS identity, connected-address mismatch, oversized/truncated
streams, abort/deadline, redirect and encoding behavior. `EPERM` is a failure, not a pass.
It is not public DNS or live-source evidence. Handler integration can additionally run
with `C3_TEST_REAL_HTTP=1`; its source transport remains synthetic.

## Narrow D dependency

`select` returns `accountId`, trusted `principal`, `snapshotId`, `sourceId`,
`rawSha256`, `cleanTextSha256`, and the exact `passage` (`text`, `start`, `end`,
`sha256`, `cleanTextSha256`), plus `acquisition: direct-source`, `findingId: null`,
and `generationEligible: false`. No classified finding exists yet. The selection
must be re-resolved and checked against current account/principal custody and the
latest snapshot at any future targeted-brief transition; historical sources remain
inspectable but cannot silently become the current selection.

Remaining D implementation is a narrow exact-source admission/context adapter:

1. Consume the retained snapshot/source/passage identities and trusted entity attribution,
   plus an explicit account research request/policy and genuine direct-URL lineage.
   Preserve raw bytes and retrieval identity; keep unknown dates and `not_assessed`
   eligibility until independently assessed. Source text is untrusted evidence input.
2. Reuse `admitAccountResearch`, source-custody/taxonomy validation and
   `snapshotAccountIntelligenceProposal` for classified supported statements, inference,
   declared conflicts and unknowns. Require exact evidence references for proposed
   findings; never create fake findings or search histories to satisfy a wrapper.
   `executeAccountIntelligenceRefresh` currently requires a nonempty *search* query
   history after excluding `owner_authorized_exact_url`. Exact-URL acquisition has no
   such search. D needs an explicitly typed direct-source lineage path through that
   narrow orchestration/receipt seam, with all existing admission checks preserved.
3. Produce a separately frozen, validated C3 context for a new explicit targeted brief,
   retaining source/snapshot identity. Reuse existing initial generation, independent
   verification, revision proposal, explicit Apply, notes and durable Save. Never
   replace `session.workContext` of an existing or reopened historical brief with latest
   research. No second generator/document store is needed.
4. Before any paid call, the parent must finish the current-grant binding and accounting
   reconciliation against the existing ledger baseline and unresolved reservations.
   Preserve the approved route and old closed deadlines/bridges; this research module
   neither extends nor bypasses them. Actual bounded acquisition, paid brief/optional
   useful revision, validation and restart/reopen proof remain separate C/D acceptance.
