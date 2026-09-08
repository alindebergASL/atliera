# C3 integrated design: Account → Prepare → Brief → Refine

Implements the [issue #327 direction](https://github.com/alindebergASL/atliera/issues/327) in the shared C3 application, not a standalone concept. This is the product direction and repeatable local walkthrough; the implementation PR carries the exact candidate, technical review and hosted-check identities. A passing design or technical review is not customer acceptance.

## Design decisions

- **Understanding before administration.** Compact account identity, editorial serif insight, readable sans-serif supporting text, warm surfaces and one plum **Prepare for…** action. Useful uncertainty stays with the action; evidence and secondary planning are deliberate disclosures rather than equally weighted cards. System fonts add no third-party font requests.
- **An informed composer.** Audience and intended outcome are the primary free-text decisions. Date and duration live under **More options**, with the selected defaults summarized. A concise account insight and up to three source anchors accompany preparation; mobile collapses the context instead of placing a long evidence list before the task.
- **A working meeting document.** Audience/outcome, situation, opening, ordered questions and close lead. Rationale and optional probes are secondary; untouched sections do not repeat empty-note placeholders. The 15-minute contract remains three main questions. Historical model output is not shortened or repaired to improve presentation.
- **Evidence in context.** A citation opens a native modal: desktop side panel, narrow-screen focused overlay. It shows the selected exact excerpt, publisher, available date information, source link and direct-support versus related-context meaning. Deeper retained-source inspection and the full evidence collection remain separate. Escape/close return focus and reading position; underlying page controls are excluded while the modal is open.
- **Continuous refinement.** **Add a note** retains a separate annotation; **Revise brief** stages and executes the existing revision operation in one user action when setup is unchanged. The working surface and editor nodes remain in place. Comparison describes computed changes, not invented model reasoning. Existing operation, record and pending-revision identities remain authoritative; stale editing uses text-CAS, not monotonic or ABA-proof versioning.
- **Honest secondary worksheets.** Strategy and Next steps remain manually editable proposed/template work, not generated account strategy, assigned tasks or approved facts. Kept session edits survive reload while the server lives; the UI warns that restart ends the session.

## Run the actual application

Use Node 22, install the locked dependencies with `npm ci` if needed, and run `npm run build` from the repository root. In separate terminals:

```sh
env -u C3_MODEL_COMMAND C3_PORT=4392 node dist/c3/atliera-c3.js serve acc_university_of_utah
env -u C3_MODEL_COMMAND C3_PORT=4393 node dist/c3/atliera-c3.js serve acc_university_of_missouri
```

Open the chosen loopback origin on that machine. For a remote development host, forward only the required loopback port, for example `ssh -N -L 4393:127.0.0.1:4393 <authorized-host>`, then open `http://127.0.0.1:4393` locally. These are two distinct account sessions, not an in-app account switcher or deployment. Stop each foreground process with Ctrl-C. No product model command is configured by this guide.

For the already-retained Utah recording package, use the [existing recorded-mode contract](../runbooks/c3-local-working-journey.md):

```sh
env -u C3_MODEL_COMMAND C3_PORT=4394 node dist/c3/atliera-c3.js serve-recorded <existing-recordings-directory>
```

This accepts exact recorded requests only. Use the package's original audience/outcome and exact correction; arbitrary edits are truthfully refused, not sent to a provider. The operator handoff supplies the existing local package location separately; raw requests/responses are not committed here. This command grants no authority to acquire new recordings.

### Walkthrough and mode limits

1. **Both real accounts:** read the insight, choose Prepare, inspect the carried context and evidence. Use Strategy or Next steps to author a manual proposal, keep it, reload, reopen, try no-change and cancel. Leave unknown owner/date unassigned.
2. **Recorded Utah:** prepare the exact retained meeting request; read the brief, open a contextual citation and dismiss it; add an Opening annotation, submit the exact recorded correction once, inspect computed changes, and reload. The verified final historical pair has three main questions in both versions. The in-app recorded label is consequential, not decorative.
3. **Unavailable modes:** ordinary Utah has a disabled generation provider unless separately configured; Missouri deliberately offers manual templates and refuses generation/replay before provider access. Neither route implies arbitrary live generation. Synthetic sparse/conflict/failure fixtures support regression testing, not public-account facts or model-quality evidence.

Utah/Missouri source and excerpt bytes are unchanged by this design. Missouri's retained extracted snapshots are not raw HTML or proof of original-source completeness. Acquisition time is not publication time or currentness; campus and system attribution remain distinct. Notes do not rewrite source quotations or historical raw responses.

## Verification and delivery record

Before candidate packaging, the integrator verified the real built application with the same account content at **1440×900, 1280×800, 390×844 and 320×844**:

- Both-account Account/Prepare/manual worksheet journeys, including evidence, keep/no-change/cancel/reload, and unknown owner/date semantics.
- Actual recorded Utah initial → evidence → annotation → one-action revision → reload, preserving editor nodes and original request/raw-response hashes. Native-modal keyboard activation, dismissal, focus/scroll return and background-page exclusion passed. Native browser chrome remains reachable; no browser-chrome focus-trap claim is made.
- Supporting synthetic state/race probes cover newer typing, malformed or mismatched acknowledgements, stale recovery, stage/active cancellation, failure/retry and dirty history. Failed acknowledgements never masquerade as acknowledged saved notes.
- No page errors or horizontal document overflow in the successful matrices. Doubled computed text was tested; this is not an actual browser-chrome zoom or screen-reader certification. Native multi-select labels can clip inside their contained control; full evidence remains separately accessible.

Same-account Utah desktop/mobile screenshots and a real short Utah recorded-browser walkthrough (preparation, evidence, note and refinement; no narration or live AI) are retained with the operator handoff. They and detailed test/browser/reviewer logs are **external-and-nonbinding** execution evidence, not repository authority. The handoff must supply accessible file paths or attachments and a verified, time-bounded loopback preview. Documentation alone is not delivery or a completed merge.

Fresh independent GPT-6 Astra contexts performed sequential product/spec and quality/security/content review of the implementation and running application. Earlier Refine review exposed stale-cache recovery and acknowledgement-record identity defects; regression tests, fixes, independent re-verification and browser probes closed them. Reviewers reported their actual bounded coverage; same-family agent review is not human approval. Final complete-tree typecheck/build/full-suite/fixture gates, independent final-delta review, exact-head hosted checks, ordinary merge and merged-main checks remain required before reporting release. Test totals and immutable identities belong in that checked handoff rather than becoming a brittle guide baseline.

```text
customer_acceptance: not_established
authorizes_live_product_generation: false
authorizes_retrieval: false
authorizes_durable_product_writes: false
authorizes_deployment: false
authorizes_sharing_or_approval: false
```

Current session-only work is not durable workspace memory. This slice does not add C4 persistence, sharing, content approval, outreach, new product research or provider/spend-route activation. Those are separate consequential decisions, not implied follow-on work. Discretionary aesthetic polish does not reopen a verified bounded design milestone.
