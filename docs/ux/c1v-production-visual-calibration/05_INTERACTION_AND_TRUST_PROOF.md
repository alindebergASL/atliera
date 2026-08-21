# Interaction and trust proof

## Browser matrix

The authoritative machine-readable record is `browser-interaction-proof.json`. Both coded directions were exercised in a real local Chromium session at:

- 1440×1100 desktop;
- 1280×900 laptop;
- 768×900 tablet;
- 640×900 200%-zoom equivalent;
- 390×844 mobile;
- 320×844 narrow/400%-reflow equivalent.

For every scenario in both directions:

- document `scrollWidth` equals `clientWidth`;
- the primary action is fully inside the initial viewport;
- every visible button measures at least 44px high;
- the compact trust state remains rendered;
- statement-level evidence actions remain visible;
- no destructive clipping or horizontal overflow occurs.

## Functional states

Each direction provides and captures:

1. no-plan default;
2. no-plan evidence open;
3. admitted-plan default;
4. existing admitted plan open;
5. desktop drawer;
6. mobile sheet;
7. mobile admitted-plan state;
8. visible keyboard focus;
9. Close and Escape behavior;
10. reduced-motion behavior.

The no-plan primary opens the exact meaningful-change evidence. The plan primary opens only the admitted plan, with three numbered question blocks and the combined close criterion.

## Evidence disclosure

Every evidence surface retains:

- consequential statement;
- exact admitted excerpt;
- source identity and publisher;
- source-date uncertainty and retrieval context;
- what the evidence supports;
- what it does not establish;
- content type;
- independent review disposition;
- freshness state;
- durability/snapshot state;
- audience approval state;
- delivery state.

Exact support and evidence-plus-assumptions use visibly different glyph/color treatments, including on mobile.

## Keyboard behavior

Native modal dialogs provide containment. On open, Close receives focus. The visible Close button and native Escape both close the disclosure and return focus asynchronously to the connected invoking control. Focus-ring screenshots and short GIF captures are stored per direction.

## Reduced motion

Motion is restricted to a short explanatory drawer/sheet entrance under `prefers-reduced-motion: no-preference`. The reduce query collapses animation and transition durations to effectively zero. Captured reduced-motion states and the CSS contract provide proof.

## Security and zero-effect proof

The active prototypes use local CSS and one local runtime only. CSP denies all by default and allows only same-origin local script/style. There are:

- no Fetch/XHR/beacon/WebSocket calls;
- no form submission;
- no local/session storage, cookies, IndexedDB, cache, or service worker;
- no external assets, fonts, analytics, runtime code, URLs, or navigation;
- no unsafe HTML sinks, `eval`, or dynamic function construction;
- no account/source/provider/database/Graph effects.

The runtime hostile-text self-test assigns an injection-shaped string with `textContent` to a detached node and verifies that no element is created. Canonical URLs are not activated; the fixture truthfully states that a source link is unavailable.

## Interpretation

This is browser/agent calibration over static synthetic content. It proves coded behavior and bounded safety; it does not establish customer usability, customer readiness, or the zero-training user gate.
