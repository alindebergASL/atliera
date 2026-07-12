# M4 Public HTTP Fetch v1 Status and FedEx Live-Execution Packet

Status: `drafted`, `unarmed`, `non-executable`, `inert-approval`.

## Authority and implementation decision

- implementation_work_authorized: `M4-public-http-fetch-v1-first-party-no-live-execution`
- implementation_start_condition: `now, after H2 merge and verification`
- implementation_authority_after_completion: `none`
- current_effective_authorization: `none`
- server_selection: `minimal first-party MCP server; no third-party survey/fork`
- initial_demo_account: `FedEx`
- live_acquisition_authorized: `false`
- fedex_live_execution_blocked: `true — pending operator/legal decision or written permission`
- deployment_authorized: `false`
- requires_later_explicit_operator_GO: `true`

This implementation slice is complete only as a deterministic inert recorded-exchange proof. It makes no live Atliera fetch and creates no readiness, acquisition-success, milestone-shipped, or product-completion claim. The committed proof is `fixtures/validation/m4-public-http-fetch-v1-recorded-proof.json`; `npm run --silent m4:public-http-fetch-proof` regenerates it on stdout through the registry, MCP lifecycle, mediation, audit, and accounting path from immutable plain recorded bytes. No DNS or HTTP function is injectable on that proof surface. Exact response bytes cross the boundary as canonical base64 and are hashed from those decoded bytes; the separate UTF-8 display field is explicitly quoted untrusted content and is not claimed to be the exact-byte representation.

No live Node DNS/HTTPS adapter exists or is imported in this slice. Future live execution remains blocked until a separately reviewed adapter proves cancellable DNS teardown, exactly one pinned address and one connection attempt with no address-family autoselection, the zero-retry deadline, and deterministic response disposal on every refusal, cancellation, and overflow path. Recorded-only cancellation/overflow tests establish inert control-flow settlement; they make no claim about a socket lifecycle.

The canonical target policy is `src/capability/m4-target-policy.ts#M4_CANONICAL_TARGET_POLICY`, SHA-256 `34c0ebd3e8492ae7d9dcfae0a98798479bd8ea7664c89618f841ffb4e214b12c`. It binds the target identity and URL to every network/content/trust budget and to special-purpose-address policy version `m4-special-purpose-address-policy-v2-content-bound`, including the exact allowed and denied IPv4/IPv6 CIDR sets and classification rule derived by the runtime, pinned to the IANA IPv4 and IPv6 Special-Purpose Address Registry snapshots dated 2025-10-09 ([IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml), [IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml)).

## Drafted FedEx live target packet

The packet is deliberately unarmed and non-executable. The exact official candidates proposed for later operator review are:

1. **SELECTED:** `https://investors.fedex.com/company-overview/overview-of-company/default.aspx` — host `investors.fedex.com`
2. `https://investors.fedex.com/company-overview/overview-of-services/default.aspx` — host `investors.fedex.com`
3. `https://investors.fedex.com/financial-information/annual-reports/default.aspx` — host `investors.fedex.com`
4. `https://newsroom.fedex.com/media-requests-and-resources` — host `newsroom.fedex.com`
5. `https://newsroom.fedex.com/newsroom/global-english/report-highlights-fedex-global-economic-impact-as-company-drives-innovation` — host `newsroom.fedex.com`

Only candidate 1 is the ratified implementation allowlist entry, addressed by target reference `fedex_company_overview`; callers and model text cannot supply a URL. Candidates 2–5 are inert review material, not runtime allowlist entries.

Public operator reconnaissance captured 2026-07-11, outside Atliera and not acquisition evidence, observed:

- `investors.fedex.com/robots.txt`: `User-agent: *`, `Crawl-delay: 10`, `Allow: /`.
- `newsroom.fedex.com/robots.txt`: `User-agent: *`, `Allow: /`, `Disallow: /cms/`.
- The selected path was not disallowed. Robots is advisory and must be freshly rechecked before a later GO.
- Earlier reconnaissance of `www.fedex.com/en-us/about*` returned an access-denied/system-down page, so those URLs are intentionally not selected.

[FedEx Terms of Use](https://www.fedex.com/en-us/terms-of-use.html) review signals a separate unresolved access-policy issue: section 2 signals restrictions on non-authorized scripting used to obtain information, and section 6 signals copying/content-use restrictions. This packet records those signals without reaching a legal conclusion about whether or how they apply. FedEx live execution is explicitly blocked pending an operator/legal decision or written permission; no replacement target is selected here.

Official automation-compatible alternatives for later operator choice are recorded only as inert, unselected, non-allowlisted options:

- SEC EDGAR APIs/data — [SEC developer resources](https://www.sec.gov/about/developer-resources) and [fair-access guidance](https://www.sec.gov/about/developer-resources#fair-access).
- Federal Register API — [official API documentation](https://www.federalregister.gov/developers/documentation/api/v1) and [site policies](https://www.federalregister.gov/policy).
- U.S. Census Bureau APIs — [official API documentation](https://www.census.gov/data/developers.html) and [terms of service](https://www.census.gov/data/developers/about/terms-of-service.html).

Exact proposed execution policy: HTTPS only; effective port 443 only; redirect limit 0; timeout 10 seconds; body ceiling 1 MiB (1,048,576 bytes) enforced while streaming; accepted base MIME types exactly `text/html` and `text/plain` with normal charset parameters; retries 0; targets 1; L0 only. No login, cookies, credentials, authorization headers, private data, provider call, graph ingestion, production write, or deployment is permitted.

## Retention and takedown proposal — not ratified policy

For operator review, retain exact acquired bytes plus metadata and SHA-256 for 30 days after acquisition unless promoted into a separately governed durable source record. On a takedown request or robots/legal concern, quarantine the bytes and stop downstream use; preserve only minimal audit/hash metadata unless law or policy requires deletion. This paragraph is a proposal, not ratified policy.

## Later GO checklist

A later explicit operator GO must arm one live execution of the selected target, resolve the FedEx legal/permission block, freshly recheck robots and legal/takedown posture, ratify retention, confirm the unchanged descriptor hash and exact budgets, and independently rederive and match target-policy SHA-256 `34c0ebd3e8492ae7d9dcfae0a98798479bd8ea7664c89618f841ffb4e214b12c`. It must also verify the separately reviewed live-adapter properties above and preserve `current_effective_authorization: none` until that GO is recorded. This document itself cannot be executed and authorizes no schedule, recurrence, export, provider call, private read, graph write, production write, or deployment.
