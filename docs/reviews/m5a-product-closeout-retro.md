# M5a Product Closeout Retro (2026-07-10)

## Decision and provenance

The operator has ended the fixture-hardening cycle and accepted the technical doctrine loop as proven. M5a Step 4 merged through PR #282 as squash commit `9661468b309e6698f54f9d9df33932496b22a584`; its post-merge `main` CI passed. This closeout inspects that committed tree and its generated artifact rather than treating a test count as the product result.

M5a now satisfies the roadmap done-pattern:

1. **Named visible artifact:** `fixtures/workshop/m5a-curated-proposal-flow-capstone.html`.
2. **Successor approval surface:** after this closeout merges and receives independent verification, implementation may proceed only as minimum H2 mediation immediately used by thin M4 `public_http_fetch_v1`. Live acquisition remains a separate one-GO effect checkpoint.

M5a is therefore **shipped**, not merely test-complete.

## View the capstone

From a clean checkout at or after `9661468b309e6698f54f9d9df33932496b22a584`, serve the already committed artifact:

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory fixtures/workshop
```

Andrew can then open:

`http://127.0.0.1:4173/m5a-curated-proposal-flow-capstone.html`

If the checkout is on a remote machine, keep the server bound to `127.0.0.1` and forward local port 4173 over SSH; then use the same browser URL.

Optional local reproduction check (not a live acquisition, production effect or newly authorized product-flow repetition):

```bash
npm ci
npm run workshop:m5a-capstone
```

That deterministic developer/CI check rebuilds the same committed HTML from the bounded fixture flow; it is not needed merely to view the artifact.

## What the user sees

The page presents a fictional Northstar Logistics account as a local durable curated preview: **2 sources**, **3 accepted evidence excerpts**, **3 claims** and **3 Workshop cards**, with one populated card in each lens.

| Lens and card | Recorded claim | Accepted evidence excerpt | Visible source |
| --- | --- | --- | --- |
| **Signals:** “Regional fulfillment capacity expanded” | “Northstar Logistics opened two regional fulfillment centers in June 2026.” | “Northstar Logistics opened two regional fulfillment centers in June 2026.” | “Northstar expands its regional fulfillment network” — Northstar Logistics · high reliability |
| **Maps:** “Network operations leader identified” | “Maya Chen is Northstar's vice president of network operations.” | “Northstar also named Maya Chen vice president of network operations.” | “Northstar expands its regional fulfillment network” — Northstar Logistics · high reliability |
| **Plays:** “Prepare for a healthcare lane planning session” | “Northstar plans quarterly healthcare lane planning sessions beginning in August 2026.” | “Northstar will offer healthcare shippers a quarterly lane planning session beginning in August 2026.” | “Northstar introduces healthcare lane planning sessions” — Northstar Logistics · high reliability |

The Signals and Maps cards intentionally reuse the same visible source while grounding distinct claims in distinct accepted excerpts; the Plays card uses the second source.

The page also shows:

- visible trust and provenance labels: **Source-backed**, **Curated public source**, **medium confidence**, **accepted excerpt**, and source reliability;
- an honest summary of **0 verified objects**, plus **No provider calls** and **No production writes**.

The useful product result is not the existence of JSON. A reviewer can scan an account-level Workshop, open each evidence drawer, and trace every card through claim → excerpt → source.

## What M5a proved

- The doctrine loop can consume and validate bounded recorded proposal fixtures grounded in curated sources, produce human-ratified durable graph state and render a visible Workshop result.
- Signals, Maps and Plays can all be populated from one coherent account bundle.
- The rendered surface can preserve provenance and trust without promoting source-document-only records to verified facts.
- Durable read-back, not a pre-write preview, supplies the final Workshop artifact.
- The successor can focus on replacing fictional curated inputs with acquired public evidence rather than reopening the doctrine loop.

## What remains unproven

- The two source URLs use `example.invalid`; no Atliera HTTP acquisition occurred.
- The page concerns fictional Northstar Logistics, not a real account.
- No DNS, redirect, SSRF, MIME, timeout, compression, robots, retention or prompt-injection acquisition boundary has yet been exercised.
- No real public `SourceDocument` has yet been fetched and stored through Atliera.
- No provider/model call produced the proposals; provider/model execution remains unauthorized.
- No live acquisition, production write, deployment, readiness or external-user value is established.

## Five-question user evaluation guide

1. **Q1 — Useful:** Does each card tell Andrew something that could change account preparation or a customer conversation?
2. **Q2 — Grounded:** Can Andrew open the evidence and understand which excerpt and source support the card?
3. **Q3 — Honest:** Are curated, source-backed and not-verified states obvious without reading implementation notes?
4. **Q4 — Navigable:** Can Andrew scan Signals, Maps and Plays and find the relevant evidence without hunting through raw JSON?
5. **Q5 — Worth continuing:** Would replacing these fictional sources with real FedEx public evidence make this page worth revisiting?

A “no” is a product finding, not a request for another generalized safety framework.

## Ratified next bounded direction

The product sequence is now:

**minimum H2 → thin M4 `public_http_fetch_v1` → real-account M5b**.

The next substantive implementation should keep the mediation boundary no larger than required for one orchestrator-only HTTPS fetch capability and immediately produce a human-visible acquisition receipt or source preview. If ADR 0003 needs an inert no-op proof, it belongs inside that same PR rather than becoming a milestone.

FedEx is the default real demonstration account. Read-only public reconnaissance may select 3–5 exact public URLs, but it is target selection—not an Atliera acquisition result. Before any live Atliera fetch, one compact packet must state the exact URLs/hosts, redirect policy, time and byte budgets, accepted content types, zero retries, storage/retention behavior, legal/robots observations, and no-login/no-private-data/no-provider-call boundaries. Stop there for one explicit operator GO.

Within the next three substantive PRs after this closeout, Atliera must fetch real public evidence and make it visible. Within five, it should render a traceable real-account Workshop. Missing either bound means stop and report rabbit-holing.

## Authority boundary

This closeout authorizes implementation only after it merges and is independently verified. It authorizes no live effect:

- current_effective_authorization: none
- authorizes_system_side_acquisition: false
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_production_write: false
- authorizes_deployment: false
- authorizes_m5b_provider_execution: false
- readiness_claim: false

No standalone H1, H3, H4, H5, outward MCP, provider comparison, deployment, identity or recurrence work is next-up. Live `public_http_fetch_v1` execution remains blocked until the compact approval packet receives one explicit operator GO.
