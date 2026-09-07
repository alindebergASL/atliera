# Slice A engineering research and repair contract

Agent-authored engineering note. The user requested: “Start Slice A and do a bit of research to make it effective.” Execution follows the [standing development policy](../strategy/standing-development-policy.md). This note does not authorize product effects, customer-data acquisition, live model generation, deployment, approval, or durability.

## Research: external and nonbinding

These six external primary sources inform implementation and tests; they do not govern Atliera or replace repository requirements. Retrieved 2026-09-07. This is engineering research, not a product research run.

1. [RFC 9110, If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): “An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false.” Apply the principle as an atomic application-level precondition inside the existing in-memory service. Missing/stale expectations do not mean “use latest”; comparison precedes mutation and asynchronous work. No new persistence or HTTP abstraction is required.
2. [MDN, sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage): “If the page has an `opener`, the `sessionStorage` is initially a copy of the opener's `sessionStorage` object.” “However, they are still separate and changes to one do not affect the other.” Browser recovery is per-tab, not shared authority. Cache the original saved baseline; never rebase old typing onto a new server note merely because the generation ID is unchanged.
3. [MDN, Document.open](https://developer.mozilla.org/en-US/docs/Web/API/Document/open): “All event listeners currently registered on the document, nodes inside the document, or the document's window are removed.” Native unload handling alone is not a sufficient internal-transition guard. Use an explicit dirty-edit preflight before revision/discard effects and replacement; keep this a bounded repair rather than a new routing framework.
4. [WHATWG HTML parser](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inbody): the textarea parsing rule ignores an immediately following U+000A LINE FEED. Render a deliberate sentinel line feed so a user's leading newline survives parsing. Verify actual browser save → reload → no-change save and clear, not only an HTML substring assertion.
5. [W3C, Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html): focus order must preserve meaning and operability. After a successful page replacement, deliberately focus the new heading and orient the viewport; do not interfere with ordinary evidence-fragment navigation. Verify keyboard focus and mobile geometry in Chromium.
6. [OWASP, LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html): “Pattern-based filters do not reliably catch indirect injection in untrusted content;” “A guardrail LLM is itself an LLM and is itself susceptible to prompt injection.” Known hostile-source eligibility must constrain both the model-facing evidence projection and candidate support references. A bounded deterministic assertion guard is not a semantic-truth oracle or a complete prompt-injection defense.

## Bounded acceptance cases

- **CS-01:** stale global-note save/revision rejects without replacing current note; successful acknowledgement preserves newer unsent typing.
- **CS-02:** stale section-note recovery cannot silently adopt a newer server baseline; recoverable old text remains visible for deliberate handling.
- **CS-03:** generation binds the displayed draft and pending revision, including explicit absence; unseen revisions are not consumed.
- **CS-04:** cancel belongs to the initiating operation; idle, stale, late, and cancel-before-generate requests cannot affect unrelated work or replace its form.
- **CS-05:** leading newlines survive global notes, section notes, and planning editors; reload/no-change/clear behave correctly.
- **CS-06:** canceled departure preserves unsaved edits and avoids hidden revision/discard effects, including unavailable browser storage and in-flight saves.
- **SEC-01:** known hostile-instruction sources are not eligible brief support or model evidence; original research/raw-response identity remains unchanged and inspectable.
- **SEC-02:** tested signed-contract, purchase, and implementation presuppositions refuse; safe inquiry and valid synthetic candidates still work. No claim of arbitrary semantic safety.
- **AE-06/A11Y-05:** local replay reports local cancellation; external execution retains uncertainty about remote completion/billing.
- **AE-07/A11Y-01:** successful route replacement begins at the heading with meaningful focus, including mobile.

The original dogfood reports contain duplicate observations across personas. These are ten repair items, not a claim that every broader-audit observation is a distinct bug. Decision-to-actions work, overall evidence density, persistence, live generation, and other audit items remain outside this slice.
