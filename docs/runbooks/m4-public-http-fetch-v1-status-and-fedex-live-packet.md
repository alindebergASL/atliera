# M4 Gate A SEC FedEx Status and Inert Gate B Packet

Status: `Gate A implemented`, `unarmed`, `Gate B executable only after external one-shot GO`, `inert-approval`.

## Authority

- implementation_work_authorized: `Atliera-M4-Gate-A-only`
- implementation_authority_after_completion: `none`
- current_effective_authorization: `none`
- live_acquisition_authorized: `false`
- production_default_live_acquisition: `false`
- requires_later_external_plain_data_GO: `true`
- reviewed_adapter_commit: `<GATE_B_REVIEWED_ADAPTER_COMMIT_AFTER_MERGE>`

This committed packet does not authorize live acquisition. Gate A reuses the H2/M4 registry, MCP lifecycle, mediation, audit, accounting, custody, and recorded-proof path. The shared descriptor honestly declares the exact-target public HTTPS ability, but the recorded authority remains `liveNetworkAuthorized: false`, the production singleton has no live transport, and current effective authorization is none. The separate Gate B factory requires an already consumed external one-shot GO and valid declared User-Agent; its MCP caller can pass only the ratified target reference. `npm run m4:public-http-fetch-proof:write` regenerates both deterministic fixtures with zero network: `fixtures/validation/m4-public-http-fetch-v1-recorded-proof.json` and `fixtures/workshop/m4-sec-fedex-submissions-evidence-preview.html`. They are explicitly recorded fixtures, not live-fetched evidence. The Workshop preview is not graph ingestion and labels its literal excerpt `Quoted/untrusted public-source content — Unverified`.

The machine-readable companion `fixtures/validation/m4-sec-gate-b-go-template.json` is deliberately invalid as a GO: it contains placeholders and `authorizesLiveAcquisition: false`.

## Exact Gate B packet fields

- Target reference: `sec_fedex_submissions`
- Exact URL: `https://data.sec.gov/submissions/CIK0001048911.json`
- Exact host: `data.sec.gov`
- Policy SHA-256: `a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a`
- FedEx identity: `FEDEX CORP`; CIK `0001048911`; SIC `4513` / canonical normalized `AIR COURIER SERVICES`; `FDX` / `NYSE` where present. Wire CIK accepts only the same official numeric identity as an integer or 1–10 decimal digits zero-padded to the exact canonical CIK. `sicDescription` uses ASCII-case normalization only for the hash-bound identity comparison while preserving and displaying the exact source literal.
- Official CIK basis: [SEC company lookup](https://www.sec.gov/cgi-bin/browse-edgar?CIK=FDX&action=getcompany).
- API basis: [SEC EDGAR application programming interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), which documents `data.sec.gov/submissions/CIK##########.json`, ten-digit CIKs, JSON submissions metadata, and no API key.
- Access basis: [Accessing EDGAR data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) and [SEC developer resources](https://www.sec.gov/about/developer-resources). Public EDGAR is free; scripted access must follow fair access, declare a User-Agent, and stay at or below 10 requests/second. This packet permits exactly one future request only if separately armed.
- Network budget: HTTPS only; effective port `443`; GET only; IPv4 only; all DNS candidates validated; one deterministic public address selected and pinned; one lookup callback; one connection/request attempt; targets `1`; redirects `0`; retries `0`; total deadline `10,000 ms`; streaming body ceiling `1,048,576 bytes`; `Accept-Encoding: identity`; no cookies, credentials, auth, compression fallback, or address-family fallback.
- MIME: exactly `application/json`, optionally one normal `charset=utf-8` parameter. Other, malformed, quoted, or duplicate parameters refuse.
- Trust: `quoted_untrusted_public_source_content`; `mayProvideInstructions: false`; `controlAuthority: none`; transport success never promotes trust.
- Retention/takedown proposal requiring Gate B ratification: retain exact bytes and custody for 30 days unless separately governed/promoted. For takedown or legal concern, quarantine and stop downstream use; retain minimum audit/hash unless deletion is required.
- One-shot contract: an external private JSON GO must name an authorization ID, authorization/validity timestamps, unique consumption ID, one fixed absolute consumption-record path whose filename ends in that ID, exact target/URL/CIK/policy hash, `authorizesLiveAcquisition: true`, and the reviewed 40-hex adapter commit. The operator command independently requires a clean checkout whose `HEAD` is that exact commit before consuming the GO. Exclusive file-and-directory-synced consumption is written at the GO-bound path before DNS, so moving or copying the GO cannot reset its identity; failure consumes the attempt and replay refuses.
- Expected Gate B outputs: `artifacts/m4-sec-gate-b/sec-fedex-submissions-custody.json` and `artifacts/m4-sec-gate-b/sec-fedex-submissions-workshop.html`.
- Failure/rollback: destroy resolver/request/response/socket, write no evidence output, do not retry, leave the one-shot consumed, keep production defaults unarmed, and require a new explicit authorization for any later attempt.

## SEC User-Agent requirement

Gate B requires `ATLIERA_M4_SEC_USER_AGENT` before the private GO is consumed and before dependencies or DNS/network are touched. Missing, malformed, non-printable, CRLF-bearing, or implausible declared-bot values fail closed. Accepted configured bytes are sent exactly; audit metadata stores only a redacted shape, byte length, and SHA-256.

Andrew must provide the exact final public string before Gate B. SEC’s `OrganizationOrApplication <MONITORED_PUBLIC_CONTACT_EMAIL>` shape is FORMAT ONLY; the placeholder is not an actual contact and must not be used as one. No personal or fabricated contact value is committed here.

The future command is `npm run m4:sec-gate-b-one-shot -- /private/path/to/go.json`; it requires the private GO and environment value. Do not run it during Gate A validation.

## M4 completion condition

M4 remains in progress until one separately authorized Gate B request succeeds, exact custody/provenance and the independently validated literal SEC excerpt are visible in Workshop with unverified trust, and the M4 retro lands. Gate A implementation authority returns to none now; no provider/model call, private read, graph write/ingestion, recurrence, production write, deployment, or readiness claim is authorized.
