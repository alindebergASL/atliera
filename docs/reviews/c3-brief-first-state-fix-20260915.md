# Brief-first reopen freshness correction

## Scope and authority

This is a narrow continuation of the brief-first implementation under the
[standing development policy](../strategy/standing-development-policy.md).
Andrew answered **“Yes”** to the explicit question: “May I proceed with the narrow
fix, its regression test, and targeted verification through the normal merge
gates? This would extend your review-only approval to implementation—not
deployment.” This does not authorize deployment, new acquisition, product
generation, historical mutation, or customer acceptance. The build proposal in
`ceremony.json` remains agent-proposed; this is not a fabricated ratification.

## Defect and correction

Reopening restored the saved work version. A same-session sequence of saved A,
unsaved B, reopen A, then unsaved C could reuse B's work version. A stale tab
showing B then successfully exported or saved C, or overwrote C with stale B.
Storage version, document, record, account and context identities did not change.

The service now assigns a working version greater than both the session's current
version and the restored version on every successful reopen. Existing
version-checked export, Keep and Save paths therefore reject the old identity.
The saved-state marker is set to that new working version because the displayed
content still matches durable saved content. Reopen itself does not write or
migrate the saved snapshot. Renderers, styles and browser scripts are unchanged.

## Regression evidence and release gates

The new regression in `tests/c3/c3-brief-first.test.ts` exercises the exact
A → B → A → C sequence, all three stale operations, fresh export/Save, immutable
record preservation, legacy saved content, repeated saved reopens, and restart.
An existing revision/rebind test now explicitly rejects the pre-reopen identity
before successfully rebinding with the freshly read identity; its historical
content assertions remain intact.

The new regression was run against the previous source head
`fc00ac6a5aa5e8176aadc618476a829c58e57e23`: export, Save and Keep all incorrectly
returned 200 instead of 409. This is a genuine negative control, not a synthetic
claimed failure. A separate actual-Chromium regression also detects wrong-content
Copy on the previous bundle. New-head desktop/mobile checks must reject stale
Copy/download/Save/Keep while preserving current-tab exports, durable Save,
repeated reopen and restart. Full canonical CI, same-context independent delta
review with an explicit overall verdict, and exact-head browser evidence are
required before normal merge. No protection bypass is permitted.

The completed nine-image GLM-5.3-Flash visual assessment may be reused only with
verified equality of the UI files. It reports no material visual blocker, not
customer acceptance or proof of runtime persistence. The code-change writer was
GLM-5.3 on the coding subscription; Hermes recovered the partial service change
and integrated the regression. The existing independent Astra technical context
is retained for targeted verification rather than starting a broader review.

Raw outputs and exact-head release records are attached to
[PR #349](https://github.com/alindebergASL/atliera/pull/349)
(**external and nonbinding** as governance authority). Private fixtures and model
logs remain outside the repository. The original retained-source bytes and the
accepted reference brief must remain unchanged. The private preview is not
updated by this correction.
