# C2 fresh retained two-account visual review

Status: **PASS for local human review; not approved account truth; not merged or deployed**

Validation/render head: `2b8a2962976d03ebc5b96756f76b30aadd22ba5d`

## Reviewed surfaces

- University of Utah: `fresh-university-of-utah.html`
- FedEx Corporation: `fresh-fedex.html`
- Desktop viewport: 1440 × 1100
- Narrow viewport: 390 × 844
- Evidence-on-demand interaction: University of Utah account-thesis evidence dialog

## Critical gates

- **PASS — answers first:** each page leads with account name, bounded thesis, established context, material change, still-open question, and one recommended next move.
- **PASS — evidence on demand:** evidence remains behind explicit 44 px triggers; the dialog shows related statement, exact support, publisher, entity, dates, source class, review state, and canonical URL.
- **PASS — one safe action:** exactly one primary action, `Review the support`; it does not save, send, publish, deploy, or prepare a meeting.
- **PASS — trust states:** `Needs review`, mixed-freshness/recheck language, proposed interpretation/action labels, unresolved-question treatment, and the non-durable footer remain visible.
- **PASS — narrow view:** no horizontal overflow at 390 px; hierarchy becomes a single reading column; decision content follows the evidence-backed sections without clipping.
- **PASS — target sizing:** tested Evidence and Close controls are 44 px high.
- **PASS — side effects:** no external resource request, local/session storage entry, database write, graph write, or persistence write was observed.

## Visual judgment

The regenerated pages preserve the Apple-calm editorial hierarchy and keep AI machinery backstage. The two dark decision cards remain visually distinct from established evidence, and mobile preserves reading order without flattening trust states. Longer FedEx copy increases page length but remains legible and contained.

## Evidence

- `screenshots/fresh/utah-1440x1100.png`
- `screenshots/fresh/utah-390x844.png`
- `screenshots/fresh/utah-evidence-open-1440x1100.png`
- `screenshots/fresh/fedex-1440x1100.png`
- `screenshots/fresh/fedex-390x844.png`
- `fresh-browser-interaction-proof.json`

## Boundary

This review accepts the local presentation for human review only. It does not approve either proposal as durable account truth, authorize customer use, establish provider storage/network behavior, cure the documented mixed provider-execution-head limitation, authorize merge, or authorize deployment.
