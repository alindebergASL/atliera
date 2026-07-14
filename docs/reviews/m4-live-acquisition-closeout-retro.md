# M4 Live Acquisition Closeout Retro (2026-07-14)

## Decision and provenance

This closeout is based on the canonical implementation commit `c1372acd14e09722c1e54646b85d89d3a0fd73f1`, tree `1eb28fcea7ced5ba2357bd32c35561a7cadc4918`. Local deterministic verification recomputed the exact attempt-2 artifact hashes and modes, cross-checked authority and effect records, decoded custody without exposing it, and reproduced the `160,901`-byte response SHA-256 `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`. No external or acquisition-target DNS, HTTP, browser, curl, robots, diagnostic, provider, graph or deployment request was made. Canonical CI exercised only its existing deterministic local loopback transport tests.

M4 now satisfies both halves of the roadmap done-pattern:

1. **Named visible artifact:** `fixtures/workshop/m4-sec-fedex-live-evidence-preview.html`, byte-identical to the successful Workshop output at SHA-256 `9e974aeb57c53a49ff75406ae4276b08b168613da2f03bbaa761859a2dc880eb`.
2. **Bounded successor surface:** after this closeout merges, the only recommended next work is a separate explicit M5b decision. This closeout itself authorizes no M5b implementation or effect.

M4 becomes **shipped upon merge** of this closeout PR. It is not a readiness, deployment, graph-ingestion or end-to-end M5b claim.

## View the exact Workshop evidence

From a clean checkout of this PR, serve the already committed public rendering locally:

```bash
python3 -m http.server 4174 --bind 127.0.0.1 --directory fixtures/workshop
```

Then open:

`http://127.0.0.1:4174/m4-sec-fedex-live-evidence-preview.html`

No regeneration or acquisition is required to view it. The committed artifact is the exact public Workshop output verified during closeout.

## What the user sees

The page's **SEC evidence preview** shows one evidence segment grounded in the acquired SEC source:

- literal evidence: **Air Courier Services**;
- source field: `/sicDescription`;
- source URL: `https://data.sec.gov/submissions/CIK0001048911.json`;
- CIK: `0001048911`;
- publisher: **U.S. Securities and Exchange Commission**;
- response custody SHA-256: `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`;
- visible trust label: **Quoted/untrusted public-source content — Unverified**.

The page also states: **Transport success does not verify source claims. No graph ingestion was performed.**

## Attempt 1: truthful failure and permanent consumption

Gate B attempt 1 remains byte-identical and permanently consumed. It made one DNS attempt, one lookup callback, one request/connection attempt and zero retries, then ended `failed_no_evidence` with zero accepted response bytes. Its attempt receipt remains preserved and its custody and Workshop files remain truthful zero-byte tombstones.

Attempt 1 proved one-shot consumption, replay prevention, fail-closed accounting, sanitized failure handling and tombstone preservation. It did not prove HTTP acceptance, exact-byte custody, extraction or visible Workshop evidence. Nothing in this closeout rewrites or reuses that authority or those artifacts.

## Merged Node 22 repair

PR #287 merged the smallest transport correction before attempt 2. The repaired request pins IPv4 with `family: 4`, disables automatic-family racing with `autoSelectFamily: false`, validates the exact lookup contract, returns one policy-approved address, permits at most one connection, and keeps redirects and retries at zero. The canonical target policy stayed at SHA-256 `a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a`; the repaired capability descriptor is `0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5`.

## Attempt 2: successful bounded acquisition

The separately authorized attempt 2 was consumed once and completed successfully:

- authorization ID: `auth_m4_sec_gate_b_attempt2_4d6faf2e4ef34cda89fea785b15fa2a1`;
- consumption ID: `consume_m4_sec_gate_b_attempt2_336f9ca5d5c04612aa72916e2b7aebb9`;
- HTTP status: `200`;
- MIME: `application/json`;
- response bytes: `160,901`;
- response SHA-256: `ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d`;
- trust status: `quoted_untrusted_public_source_content`;
- DNS attempts: `1`;
- lookup callbacks: `1`;
- request attempts: `1`;
- connection attempts: `1`;
- redirects: `0`;
- retries: `0`.

The authority was valid when consumed and claimed. The sequence was authorization → consumption → execution claim → request start → fetch completion → execution completion. Retention ends at `2026-08-13T18:41:11.277Z`, thirty days after execution completion.

## Sanitized deterministic proof

`fixtures/validation/m4-live-acquisition-success-proof.json` records the exact public facts, private-artifact hashes/modes/sizes without private paths or contents, attempt-1 preservation, effect counts, and closed authority markers.

The closeout verifier proved locally that:

- every reported attempt-2 artifact hash, byte size and `0600` mode matches;
- the canonical commit, tree, target policy and descriptor recompute exactly;
- the GO, consumption, execution claim, receipt, custody, timestamps, target and paths agree;
- base64 custody decodes canonically to exactly `160,901` bytes with the stated response hash;
- the Workshop artifact is nonempty and contains the exact evidence, source context and unverified trust label above;
- attempt 1 remains byte-identical and permanently consumed;
- the raw User-Agent and mailbox occur zero times in repository-bound or publishable artifacts.

The proof does not commit exact response bytes, base64 custody, private state contents, private absolute paths, the raw User-Agent/contact, or a resolved IP address.

## What M4 proved

- Atliera can consume one exact operator authorization and perform one bounded system-side public acquisition through the reviewed registry, MCP lifecycle and L0 mediation boundary.
- The transport truthfully accounts for one DNS lookup, one request, at most one connection, no redirect and no retry.
- Exact response bytes can be held in private custody while a small public Workshop rendering exposes only a literal evidence segment, source context, response hash and conservative trust status.
- Transport success does not promote source content to verified fact and does not itself write graph state.
- Failure and success histories can coexist without rewriting the consumed failed attempt.

## What remains unproven

- M5b has not begun: no model proposal, fresh validation, human ratification, durable graph write or real-account Workshop loop used this acquired source.
- No provider/model call, private-evidence read, graph ingestion, production write, deployment, readiness claim or external-user value is established by M4.
- One SEC source and one literal excerpt do not establish broader source coverage or source truth.
- This closeout creates no standing acquisition authority and authorizes no repeat request.

## Five-question user evaluation guide

1. **Q1 — Useful:** Is “Air Courier Services” useful account context when shown with its exact SEC source?
2. **Q2 — Grounded:** Can the evidence segment be traced immediately to `/sicDescription`, the SEC URL, CIK and custody hash?
3. **Q3 — Honest:** Is the **Quoted/untrusted public-source content — Unverified** status unmistakable?
4. **Q4 — Navigable:** Is the small evidence preview easier to evaluate than raw custody JSON?
5. **Q5 — Worth continuing:** Is this acquisition result strong enough to justify a separate explicit M5b decision?

A “no” is a product finding, not authorization for more framework work or another acquisition.

## Authority boundary and next decision

- current_effective_authorization: none
- implementation_work_authorized: none
- authorizes_live_acquisition: false
- authorizes_retry: false
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- authorizes_production_write: false
- authorizes_deployment: false
- authorizes_h3: false
- authorizes_m5b: false
- readiness_claim: false
- next_recommended_work: separate explicit M5b decision

No acquisition, provider execution, graph write, deployment, H3 or M5b work may begin from this closeout. M5b requires its own explicit decision, scope and effect gates after this PR merges.
