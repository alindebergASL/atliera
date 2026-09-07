# C3 proposed next step

From the repository root, use Node 22 and build the local application:

```sh
npm run typecheck
npm run build
C3_PORT=4331 env -u C3_MODEL_COMMAND node dist/c3/atliera-c3.js serve acc_university_of_missouri
```

In a separate terminal:

```sh
C3_PORT=4332 env -u C3_MODEL_COMMAND node dist/c3/atliera-c3.js serve acc_university_of_utah
```

Open Missouri at `http://127.0.0.1:4331` and Utah at `http://127.0.0.1:4332`. These are separate account sessions using the same context projection and planning interface; there is no account switcher. Existing inputs and provenance are described in [the curated preview guide](c3-curated-preview.md).

In Strategy, keep your decision/validation text, then follow **Shape a proposed next step**. The current strategy text is available under **Strategy suggestion** as a separate user/template-authored suggestion, not an accepted decision. Opening this link saves nothing and leaves any existing proposal untouched. Author the concern and action explicitly; optionally name a proposed owner, real YYYY-MM-DD target date, question/blocker, and retained evidence. The shared Next steps screen puts **Author or edit proposed next step** before optional readback and strategy details. The editor opens by default; **Kept proposal details** starts collapsed, with blank owner/date shown there as Unassigned. Owner always uses a compact, resizable textarea so new and recovered multiline text stays intact; date uses a text input. Evidence choices use unique **Evidence N** labels and a short excerpt beginning. Open **Inspect supporting excerpts**, then its numbered link to read the full source title and exact retained excerpt; source text remains unchanged. Choose **Keep proposed next step**. Return links lead to Account Intel and Strategy. Additional prose planning remains available under Additional planning.

The proposal shares its brief's optimistic version. Stale saves and edits during active work or a pending revision are refused. New typing during a save remains unsubmitted. Cancel restores the last acknowledged values. Tab recovery is account/session/version/baseline-bound; a stale recovery is shown for copying rather than overwriting current work. Acknowledged edits survive reload in the live session; server restart loses them. Recovery storage is best effort, not durable persistence.

This is a user-authored, session-only proposal, not an assignment, approval, accepted account truth, or AI generation. Keeping it performs no research, scheduling, sharing, outreach, or provider execution. There is no action lifecycle, independent action identity, or durable storage. Missouri remains curated proposed context; Utah retains its existing evidence and disposition boundaries.

Focused checks (Node 22):

```sh
node --import tsx --test tests/c3/c3-planning.test.ts
node --import tsx --test tests/c3/c3-planning-client.test.ts
node --import tsx --test tests/c3/c3-service.test.ts
npm run typecheck
```

Presentation assertions check disclosure order, compact inputs, exact retained text and canonical evidence IDs; client checks cover input payloads, recovery, no-change, cancellation and delayed typing. They do not measure screen layout or establish customer acceptance. Independent source/evidence/security review and two-account desktop/mobile browser verification remain necessary for full sprint acceptance.
