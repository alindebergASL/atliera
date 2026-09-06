# Account Intel and Workshop local preview

Account Intel is the overall account home. Workshop uses the same injected context for meeting, strategy and account next steps briefs. Each kind keeps independent work within the running server session.

## Run

From the repository root, with dependencies installed:

```sh
npm ci
npm run preview:account-workshop
```

Open `http://127.0.0.1:4321`. Stop with Ctrl-C. The loopback preview uses [authored synthetic fixtures](../../tests/fixtures/c3-workshop.ts), never provider configuration or private research. Its meeting candidates and correction are **hand-authored test data, not model recordings**. Expand the compact preview status for provenance and session limits; the existing “recorded” controls exercise exact request matching.

Run one variant at a time after stopping the prior server:

```sh
npm run preview:account-workshop -- --cedar
npm run preview:account-workshop -- --sparse
npm run preview:account-workshop -- --conflict
npm run preview:account-workshop -- --failure
```

Harbor Transit and Cedar Works share the same code path. Sparse mode supplies no admitted sources; conflict mode has an unresolved conflict; failure mode rejects meeting work. No variant changes the existing recorded provider.

## Try it

1. Inspect Account Intel: the overall context precedes open gaps. Expand full account context for developments/priorities and stakeholders/relationships, or raw gap details for exact technical wording. Evidence links open exact excerpts and dates. The context request date does not establish freshness. Proposal content stays proposed. Open Workshop; Meeting draft navigation appears after a draft exists.
2. In Meeting, replay the supplied exact setup. Inspect an Evidence link and use its return link. Edit setup and submit to see exact-match refusal with the previous draft preserved. “Use recorded request” restores the supplied inputs.
3. In Strategy, open “Edit brief setup” to set audience/outcome and edit direction, options/tradeoffs and decision/validation in place. In Next steps, set its independent audience/outcome and edit actions, owners/dependencies and completion/follow-up. Exact proposed account context and evidence links sit beside the sections on desktop and above them on mobile; full details remain expandable. These are planning prompts, not AI conclusions. Setup changes preserve authored sections.
4. Switch kinds, return to Account Intel, use Back, reload and reopen. Saved session work remains independent. Unsubmitted planning edits recover in the same tab when session storage is available. Older cached versions are shown for copying without overwriting current saved content.
5. In a meeting section, open “Note or correction” and keep a user note while retaining the brief. Clear and save to remove it; save identical text for no-change. Cancel restores saved text. Section edits never invoke generation.
6. In Draft review, use the exact supplied correction and request/replay its revision. While pending, the previous draft is read-only. Cancel stops work; explicitly discard the pending revision to return to the previous draft. Arbitrary corrections have no matching response. Try Cancel during the synthetic 800 ms delay, or restart in failure mode.

## Boundaries

Drafts, notes and planning edits live in server memory scoped to its browser cookie. Restarting the server or starting a new browser session loses them. Unsubmitted recovery uses tab session storage scoped to account/server session; the UI reports storage failure. Stale notes/versions are refused to prevent overwrites from old tabs. Copy important text before ending the session. No durable save, sharing, approval, assignment, scheduling, graph write or new research is available.

Section notes leave meeting raw responses and exact request/revision identity unchanged. Plans and notes never update Account Intel. Excerpts are distinct from proposed interpretations and user plans. Source dates do not establish present status or change against a prior revision. Synthetic testing is not customer intelligence or real-user acceptance.

## Verify

Run heavy checks serially:

```sh
node --import tsx --test tests/c3/*.test.ts
npm run ci
```

With the normal synthetic server running and Playwright Python/Chromium installed:

```sh
python scripts/check-account-workshop.py --output /tmp/atliera-workshop-browser
```

The browser runner covers three kinds, refresh/back/reopen, evidence return, notes, cancellation, mismatch and synthetic revision. It captures 1440×1100, 1024×900 and 390×844 screenshots and measures document overflow, text size and keyboard focus. Inspect screenshots for readability and action reachability. Use `--context-only` with alternate account/sparse/conflict variants. Localhost binding and Chromium must be permitted; a blocked run is not a passing browser review.
