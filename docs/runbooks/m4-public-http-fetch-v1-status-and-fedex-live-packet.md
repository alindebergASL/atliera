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
- deployment_authorized: `false`
- requires_later_explicit_operator_GO: `true`

This implementation slice is complete only as a deterministic recorded/injected proof. It makes no live Atliera fetch and creates no readiness, acquisition-success, milestone-shipped, or product-completion claim. The committed proof is `fixtures/validation/m4-public-http-fetch-v1-recorded-proof.json`; `npm run --silent m4:public-http-fetch-proof` regenerates it on stdout through the real registry, MCP lifecycle, mediation, audit, and accounting path with injected DNS and a recorded byte stream. Exact response bytes cross the boundary as canonical base64 and are hashed from those decoded bytes; the separate UTF-8 display field is explicitly quoted untrusted content and is not claimed to be the exact-byte representation.

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

Exact proposed execution policy: HTTPS only; effective port 443 only; redirect limit 0; timeout 10 seconds; body ceiling 1 MiB (1,048,576 bytes) enforced while streaming; accepted base MIME types exactly `text/html` and `text/plain` with normal charset parameters; retries 0; targets 1; L0 only. No login, cookies, credentials, authorization headers, private data, provider call, graph ingestion, production write, or deployment is permitted.

## Retention and takedown proposal — not ratified policy

For operator review, retain exact acquired bytes plus metadata and SHA-256 for 30 days after acquisition unless promoted into a separately governed durable source record. On a takedown request or robots/legal concern, quarantine the bytes and stop downstream use; preserve only minimal audit/hash metadata unless law or policy requires deletion. This paragraph is a proposal, not ratified policy.

## Later GO checklist

A later explicit operator GO must arm one live execution of the selected target, freshly recheck robots and legal/takedown posture, ratify retention, confirm the unchanged descriptor hash and exact budgets, and preserve `current_effective_authorization: none` until that GO is recorded. This document itself cannot be executed and authorizes no schedule, recurrence, export, provider call, private read, graph write, production write, or deployment.
