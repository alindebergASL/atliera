# C3 local working journey

This slice runs Account Home → Prepare for… → proposed meeting draft over the existing admitted C2 context. It is local-only, session-memory only, and does not approve, share, send, persist, fetch sources, or create Graph data. Utah is enabled by its recorded C2 disposition. FedEx remains held at **Revise before C3**.

## Build and launch

```sh
npm run typecheck
npm run build
npm run start:c3
```

The service binds only to `127.0.0.1` (default `http://127.0.0.1:4317`). `/` always owns Account Home, `/?prepare=1` owns the preserved preparation form, and `/?draft=1` owns the current session draft. A successful generation updates browser history to the draft URL before replacing the rendered document, so reload returns to that draft; Account Home and Prepare expose an explicit reopen link while one exists. Back/Forward between those routes reloads the URL-owned view, while native navigation to and through `#evidence-*` fragments remains in the current document so an unsaved correction note is not discarded. Submitted form state and drafts remain in server memory only while the same cookie and server process survive. The HttpOnly, SameSite Strict, path-root session cookie has a deterministic name derived from the bound port so two local C3 services on `127.0.0.1` do not overwrite each other's cookie; this browser-state namespace is not security isolation. Prepare also keeps the latest unsubmitted form fields in a per-tab browser cache scoped to the account and live server-session identity, so an offline error or cancellation can recover later edits on reload in that tab. Accepted generation and revision clear that cache. A new server session cannot use the prior entry, and stale session entries are removed when storage is available. The page explicitly reports whether this browser permits the cache; when storage is unavailable, it warns that unsubmitted edits cannot be promised across reload. No generated output, correction note, review state, or approval is stored there. A server restart loses the session and the draft URL returns a clear no-draft message with the preserved/default form rather than implying durable storage. With no operator provider configured, Account Home and Prepare work and generation fails truthfully as disabled.

To configure generation, set `C3_MODEL_COMMAND` to one executable path before launch:

```sh
C3_MODEL_COMMAND=/absolute/path/to/controller-owned-wrapper npm run start:c3
```

The server spawns that executable without a shell and passes exactly one final argument: a mode-`0600` JSON request-file path. The wrapper reads that request and writes only the raw model candidate bytes to stdout. The server passes a minimal runtime environment, not inherited credential variables; a wrapper that needs provider credentials must read its own operator-private credential file. Explicit non-secret environment additions are available only through the programmatic provider constructor.

The server allows one command generation at a time, enforces a 120-second timeout, an 8 MiB request bound and a 256 KiB stdout bound, and keeps the slot and private request file until owned process cleanup completes. Cancel, timeout, output overflow, and shutdown send TERM to the owned process group, escalate to KILL after a bounded grace, await the direct child and group cleanup, and hold the provider if cleanup cannot be confirmed. Output bytes are decoded once as fatal UTF-8 with a leading BOM preserved as U+FEFF; strict JSON then refuses that BOM-bearing candidate without transforming its raw identity or hash. Invalid UTF-8 bytes are likewise refused without repair. HTTP JSON bodies also use fatal UTF-8 and return `400` on malformed bytes. Local process cleanup does not prove that an already-dispatched remote request or billing stopped. It never accepts a command or file path from HTTP. Provider reservations, receipts, pricing, and unknown remote billed-work accounting remain controller-owned outside this repository.

Optional server configuration:

```sh
C3_PORT=4317 C3_MODEL_COMMAND=/absolute/path/to/wrapper npm run start:c3
```

## Controller evaluation and replay

All output paths below are operator-owned and should be empty directories outside the repository. Canonical ancestors are checked and existing output files are never overwritten (including symlinks). Use a fresh output directory for each run. Recorded response decoding is fatal UTF-8 and preserves a BOM, so online and offline refusal/identity semantics agree.

The full-context adapter binds the retained funding row to its retained header when present. Three-year plan figures still do not establish remaining purchasing funds, allowable vendor spend, or buying intent. Updating a derived annotation or meeting prompt changes request identity; old recordings remain historical and must never be relabeled as calls under the new input.

```sh
npm run c3:load-context -- acc_university_of_utah /absolute/external/eval/context
npm run c3:emit-model-request -- acc_university_of_utah "CISO" "Understand priorities and agree a useful next step" 2026-09-12 /absolute/external/eval/ciso
```

Run the controller-owned bounded provider wrapper with `/absolute/external/eval/ciso/model-request.json`; retain its stdout verbatim as `/absolute/external/eval/ciso/raw-response.txt`. Then validate and render without hand-editing:

```sh
npm run c3:render-recorded-draft -- acc_university_of_utah /absolute/external/eval/ciso/model-request.json /absolute/external/eval/ciso/raw-response.txt /absolute/external/eval/ciso/replay
```

The replay command re-derives the exact request/prompt identity and compares reconstructed draft/refusal content, not only IDs and hashes. A malformed, extra-field, unsupported, or otherwise invalid candidate produces a typed `refused` generation record retaining the raw response and a refusal page; it is never repaired, reclassified, or coerced. A successful record remains deeply frozen, `proposed_unreviewed`, and `durablySaved: false`.

Repeat `emit-model-request` with `"CIO and engineering leaders"` against the same account to evaluate audience prioritization with identical source facts.

## Human review hook

The draft page exposes selected evidence, exact excerpts, source/date context, specific warnings, and a bounded session-only correction note. Every direct-support-permitted slot renders its exact source bytes as a blockquote with nearby source title and publisher; inference and recommendations remain ordinary proposed prose. Compact contextual citation names identify the section or question and source title, with 44px link targets and wrapping for narrow screens. “Keep note” and “Request revision” send the displayed record ID with the current textarea bytes. Missing, stale, or generation-in-progress identity returns `409` before note, audience, draft, revision, or unrelated-generation state can change. A valid revision carries the exact prior raw response and derived draft identity into a versioned next request, discards the reviewed draft, and returns to the preserved two-decision form. This correction context does not mutate or ratify account truth. Neither action is authenticated approval, C4 persistence, or durable truth. Qualified content review and representative seller testing remain separate gates; automated behavior checks cannot satisfy them.

The deterministic support contract distinguishes whole-field verbatim source facts, cautious inference, recommendations, open questions, and explicit unknowns across objective, thesis, opening, questions/learning, risks, and close. It refuses known high-risk unsupported incident/commercial constructions and keeps whole-draft human review mandatory. This bounded representation and tripwire layer is not a universal semantic-truth certificate.

## Focused verification

```sh
node --import tsx --test tests/c3/c3-journey.test.ts tests/c3/c3-service.test.ts tests/c3/c3-form-recovery.test.ts
npm run typecheck
npm run build
```

The service test uses the real Node HTTP request handler through an unbound test seam because some controlled workspaces prohibit opening loopback sockets. The controller should additionally launch the built artifact and verify `/healthz`, Account Home, generation, cancellation, and responsive browser behavior in an environment that permits loopback binding.
