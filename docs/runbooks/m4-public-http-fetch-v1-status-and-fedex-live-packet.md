# M4 Evidence Acquisition v1 — Shipped Closeout

Status: M4 shipped upon merge of the closeout PR; Gate B attempts 1 and 2 permanently consumed; no current authority.

## Authority

- current_implementation_work_authorized: none
- current_effective_authorization: none
- live_acquisition_authorized: false
- retry_authorized: false
- provider_call_authorized: false
- graph_ingestion_authorized: false
- production_write_authorized: false
- deployment_authorized: false
- m5b_authorized: false
- readiness_claim: false
- next_recommended_work: separate explicit M5b decision

This runbook is a closeout record, not an execution packet. It does not authorize another DNS lookup, HTTP request, diagnostic, retry, provider call, graph write, deployment, H3 or M5b work.

## Canonical shipped implementation

- commit: `c1372acd14e09722c1e54646b85d89d3a0fd73f1`
- tree: `1eb28fcea7ced5ba2357bd32c35561a7cadc4918`
- target policy SHA-256: `a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a`
- capability descriptor SHA-256: `0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5`
- target: `sec_fedex_submissions`
- URL: `https://data.sec.gov/submissions/CIK0001048911.json`
- publisher: U.S. Securities and Exchange Commission
- content trust: `quoted_untrusted_public_source_content`

The shipped adapter remains exact-target, IPv4-only, zero-redirect and zero-retry. It pins `family: 4`, sets `autoSelectFamily: false`, validates one scalar lookup callback, returns one policy-approved address and permits at most one connection attempt. No production default or standing schedule can repeat the consumed live attempt.

## Attempt history

### Gate B attempt 1 — failed, consumed, preserved

Attempt 1 remains byte-identical and permanently consumed. Its outcome was `failed_no_evidence`: it recorded one DNS attempt, one lookup callback, one request/connection attempt, zero retries, live egress and the sanitized `transport_refused` result with zero response bytes. Its custody and Workshop artifacts remain zero-byte fail-closed tombstones.

Attempt 1 proved authority consumption, replay prevention, failure accounting and tombstone behavior. It did not prove successful acquisition, accepted status/MIME, exact-byte custody, extraction or visible evidence.

### Node 22 repair — merged before attempt 2

PR #287 repaired the custom lookup contract by pinning `family: 4`, disabling `autoSelectFamily`, validating the exact lookup shape and preserving one-address/one-connection/no-retry semantics. Local Node 22 loopback tests proved the repaired request options without public network access.

### Gate B attempt 2 — succeeded, consumed, no retry

Attempt 2 used a new authorization and new consumption identity:

- authorization ID: `auth_m4_sec_gate_b_attempt2_4d6faf2e4ef34cda89fea785b15fa2a1`
- consumption ID: `consume_m4_sec_gate_b_attempt2_336f9ca5d5c04612aa72916e2b7aebb9`
- HTTP status: `200`
- MIME: `application/json`
- response bytes: `160,901`
- response SHA-256: `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`
- DNS attempts: `1`
- lookup callbacks: `1`
- request attempts: `1`
- connection attempts: `1`
- redirects: `0`
- retries: `0`
- provider calls/private reads/graph writes/production writes/deployments: `0/0/0/0/0`
- retention until: `2026-08-13T18:41:11.277Z`

Both attempts are historical consumed authorities. Neither may be retried or reused.

## Visible Workshop artifact

The exact successful public rendering is committed at:

`fixtures/workshop/m4-sec-fedex-live-evidence-preview.html`

Its SHA-256 is `9e974aeb57c53a49ff75406ae4276b08b168613da2f03bbaa761859a2dc880eb` and its byte size is `2,181`.

The page visibly contains:

- **Air Courier Services** from `/sicDescription`;
- the exact SEC submissions URL and CIK `0001048911`;
- publisher **U.S. Securities and Exchange Commission**;
- response custody SHA-256 `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`;
- trust label **Quoted/untrusted public-source content — Unverified**;
- the caveat **Transport success does not verify source claims. No graph ingestion was performed.**

View it locally without regenerating or acquiring anything:

```bash
python3 -m http.server 4174 --bind 127.0.0.1 --directory fixtures/workshop
```

Then open `http://127.0.0.1:4174/m4-sec-fedex-live-evidence-preview.html`.

## Sanitized proof and privacy boundary

`fixtures/validation/m4-live-acquisition-success-proof.json` records the deterministic closeout facts. It contains only public result facts and private-artifact labels, modes, sizes and hashes. It contains no private paths or private state contents.

Local deterministic verification decoded custody without sending it to a model, proved exactly `160,901` bytes and the expected response hash, cross-checked authorization/consumption/execution/policy/descriptor/target/timestamps/paths, verified the Workshop facts, and rehashed the preserved failed attempt. It made no external or acquisition-target request; canonical CI used only existing deterministic local loopback transport tests. The raw User-Agent and mailbox occur nowhere in repository-bound or publishable artifacts.

The repository does not contain exact response bytes, base64 custody, private GO/consumption/execution-claim contents, private absolute server paths, or unstable resolved IP addresses.

## M4 completion and successor boundary

The closeout retro is `docs/reviews/m4-live-acquisition-closeout-retro.md`. Together with the exact Workshop artifact and sanitized proof, it closes M4 and makes the roadmap row shipped upon merge.

M4 proves one bounded acquisition and one honest evidence rendering. It does not prove the M5b end-to-end loop. The next recommended work is only a **separate explicit M5b decision**. Until that decision exists, implementation and effect authority remain none.
