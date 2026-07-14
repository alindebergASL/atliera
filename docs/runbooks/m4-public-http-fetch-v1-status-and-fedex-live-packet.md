# M4 Gate A, Gate B Attempt 1 Retro, and Future Gate B Packet

Status: `Gate A implemented`, `Gate B attempt 1 consumed`, `failed_no_evidence`, `transport repair proposed`, `unarmed`.

## Authority

- current_implementation_work_authorized: `none`
- historical_implementation_work_authorized: `Atliera-M4-Gate-A-only` (completed; no current authority)
- implementation_authority_after_completion: `none`
- current_effective_authorization: `none`
- live_acquisition_authorized: `false`
- production_default_live_acquisition: `false`
- requires_later_external_plain_data_GO: `true`
- gate_b_attempt_1_reviewed_adapter_commit: `d833619e45ea0307d5fe75cffc10bcb1b2de2c5f`
- future_reviewed_adapter_commit: `none` until a repair is independently approved and merged

This committed packet does not authorize live acquisition. Gate A reuses the H2/M4 registry, MCP lifecycle, mediation, audit, accounting, custody, and recorded-proof path. The shared descriptor honestly declares the exact-target public HTTPS ability, but the recorded authority remains `liveNetworkAuthorized: false`, the production singleton has no live transport, and current effective authorization is none. The separate Gate B factory requires an already consumed external one-shot GO and valid declared User-Agent; its MCP caller can pass only the ratified target reference. `npm run m4:public-http-fetch-proof:write` regenerates both deterministic fixtures with zero network: `fixtures/validation/m4-public-http-fetch-v1-recorded-proof.json` and `fixtures/workshop/m4-sec-fedex-submissions-evidence-preview.html`. They are explicitly recorded fixtures, not live-fetched evidence. The Workshop preview is not graph ingestion and labels its literal excerpt `Quoted/untrusted public-source content — Unverified`.

The machine-readable companion `fixtures/validation/m4-sec-gate-b-go-template.json` is deliberately invalid as a GO: it contains placeholders and `authorizesLiveAcquisition: false`.

## Gate B attempt 1 retro and repair boundary

Gate B attempt 1 used the exact merged commit above and permanently consumed its external GO, consumption record, and execution claim. It made one DNS attempt, one lookup callback, one request/connection attempt, and zero retries. The selected address was public under the pinned policy, live-network egress was truthfully counted as one, and the adapter returned the sanitized refusal `transport_refused` after receiving zero response bytes. The attempt receipt was persisted while custody and Workshop remained zero-byte fail-closed tombstones. User-Agent audit metadata contained only its approved hash, byte length, format result, and redaction marker.

Attempt 1 therefore proved exact authority binding and consumption, replay prevention, fail-closed output reservation, durable failure accounting, sanitized contact handling, and zero-retry behavior. It did **not** prove successful acquisition, HTTP status/MIME acceptance, exact-byte custody, extraction, or visible Workshop evidence. M4 remains incomplete.

The Node 22 root-cause regression is deterministic and local: with automatic-family selection enabled, `https.request` invokes a custom lookup with `all: true`; a legacy scalar `(address, family)` callback then fails before response headers. The repair pins `family: 4`, sets `autoSelectFamily: false`, validates the lookup hostname/options contract, and returns one scalar policy-approved IPv4. Local loopback TLS tests exercise the actual request options with one connection and no public DNS or Internet endpoint.

Sanitized failure telemetry uses only the stable allowlisted phases `lookup_contract`, `request_construction`, `tcp_connection`, `tls_handshake`, `response_headers`, `response_body_or_deadline`, `custody_finalization`, and `mediation_protocol`. Raw transport messages, stacks, contact data, and response bodies are not copied into this telemetry.

The transport repair does not change the canonical target policy, whose SHA-256 remains `a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a`. Adding the allowlisted failure phase to the capability output contract rotates the descriptor SHA-256 to `0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5`, the inert recorded-proof schedule authority SHA-256 to `9f43034fa44878514ee160a5fc626aa629ebe5a9155a97f3782eaa7216bef4f2`, and the recorded proof-packet SHA-256 to `f757adfa0386654a09e616fd7ddd5dd4d0cd8f019f74b97af82ae5aad555974c`. The regenerated proof fixture file SHA-256 is `f7bbe2dccf6accf9bdf84e8d545afdd48ebcb90e2cac549dda46988b2e46fd7d`; the Workshop fixture remains byte-identical at `a21963592e34335b466970d039383ca68f26994813b7d3a690342d8338d53c46`.

Attempt 1 is not retryable and none of its identities, paths, authority, or outputs may be reused. A future live attempt requires this repair to be independently approved and merged, followed by a completely new one-shot operator authorization with new identifiers and paths. This document and repair PR authorize no live request and create no new GO.

## Exact Gate B packet fields

- Target reference: `sec_fedex_submissions`
- Exact URL: `https://data.sec.gov/submissions/CIK0001048911.json`
- Exact host: `data.sec.gov`
- Policy SHA-256: `a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a`
- FedEx identity: `FEDEX CORP`; CIK `0001048911`; SIC `4513` / canonical normalized `AIR COURIER SERVICES`; `FDX` / `NYSE` where present. Wire CIK accepts only the same official numeric identity as an integer or 1–10 decimal digits zero-padded to the exact canonical CIK. `sicDescription` uses ASCII-case normalization only for the hash-bound identity comparison while preserving and displaying the exact source literal.
- Official CIK basis: [SEC company lookup](https://www.sec.gov/cgi-bin/browse-edgar?CIK=FDX&action=getcompany).
- API basis: [SEC EDGAR application programming interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), which documents `data.sec.gov/submissions/CIK##########.json`, ten-digit CIKs, JSON submissions metadata, and no API key.
- Access basis: [Accessing EDGAR data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) and [SEC developer resources](https://www.sec.gov/about/developer-resources). Public EDGAR is free; scripted access must follow fair access, declare a User-Agent, and stay at or below 10 requests/second. This packet permits exactly one future request only if separately armed.
- Network budget: HTTPS only; effective port `443`; GET only; IPv4 only with request options `family: 4` and `autoSelectFamily: false`; all DNS candidates validated; one deterministic public address selected and pinned; one validated scalar lookup callback; one connection/request attempt; targets `1`; redirects `0`; retries `0`; total deadline `10,000 ms`; streaming body ceiling `1,048,576 bytes`; `Accept-Encoding: identity`; no cookies, credentials, auth, compression fallback, address-family fallback, or multi-address racing.
- MIME: exactly `application/json`, optionally one normal `charset=utf-8` parameter. Other, malformed, quoted, or duplicate parameters refuse.
- Trust: `quoted_untrusted_public_source_content`; `mayProvideInstructions: false`; `controlAuthority: none`; transport success never promotes trust.
- Retention/takedown proposal requiring Gate B ratification: retain exact bytes and custody for 30 days unless separately governed/promoted. For takedown or legal concern, quarantine and stop downstream use; retain minimum audit/hash unless deletion is required.
- One-shot contract: an external private JSON GO must name an authorization ID, authorization/validity timestamps, unique consumption ID, one fixed absolute consumption-record path whose filename ends in that ID, the SHA-256 and UTF-8 byte length of Andrew's exact approved SEC User-Agent, exact target/URL/CIK/policy hash, `authorizesLiveAcquisition: true`, and the reviewed 40-hex adapter commit. The operator command independently requires a clean checkout whose `HEAD` is that exact commit and compares the runtime User-Agent hash/length before consuming the GO. Exclusive file-and-directory-synced consumption records the same redacted User-Agent identity at the GO-bound path before DNS, and kernel construction then exclusively creates a sibling durable execution claim before any network dependency can run. Moving/copying the GO or constructing a second kernel cannot reset either identity; failure consumes the attempt and replay refuses.
- Expected Gate B outputs: a sanitized attempt receipt at `artifacts/m4-sec-gate-b/sec-fedex-submissions-attempt.json` for every invoked outcome, plus pre-reserved custody and Workshop paths at `artifacts/m4-sec-gate-b/sec-fedex-submissions-custody.json` and `artifacts/m4-sec-gate-b/sec-fedex-submissions-workshop.html`. All three names are exclusively reserved before GO consumption or network construction. On failure, the latter two remain zero-byte fail-closed tombstones rather than being unlinked through a racy pathname; the attempt receipt preserves execution/audit/accounting without evidence body bytes. Any tombstones require explicit operator inspection and removal before a separately authorized later attempt.
- Failure/rollback: destroy resolver/request/response/socket, durably persist the sanitized attempt receipt, truncate this attempt's evidence descriptors to zero, never unlink a possibly substituted pathname, do not retry, leave the one-shot consumed, keep production defaults unarmed, and require a new explicit authorization for any later attempt.

## SEC User-Agent requirement

Gate B requires `ATLIERA_M4_SEC_USER_AGENT` before the private GO is consumed and before dependencies or DNS/network are touched. Missing, malformed, non-printable, CRLF-bearing, implausible, or hash/byte-length-mismatched declared-bot values fail closed. The private GO, durable consumption record, and activation bind only the SHA-256 and UTF-8 byte length of Andrew's exact approved value; accepted configured bytes are sent exactly, and no raw contact string is committed or emitted in audit metadata.

Andrew must provide the exact final public string before Gate B. SEC’s `OrganizationOrApplication <MONITORED_PUBLIC_CONTACT_EMAIL>` shape is FORMAT ONLY; the placeholder is not an actual contact and must not be used as one. No personal or fabricated contact value is committed here.

The future command is `npm run m4:sec-gate-b-one-shot -- /private/path/to/go.json`; it requires the private GO and environment value. Do not run it during Gate A validation.

## M4 completion condition

M4 remains in progress until one separately authorized Gate B request succeeds, exact custody/provenance and the independently validated literal SEC excerpt are visible in Workshop with unverified trust, and the M4 retro lands. Gate A implementation authority returns to none now; no provider/model call, private read, graph write/ingestion, recurrence, production write, deployment, or readiness claim is authorized.
