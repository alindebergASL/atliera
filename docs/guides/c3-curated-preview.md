# C3 curated account preview

This is a partial two-account input integration in the shared `src/c3` workflow. The legacy Utah path is unchanged. Missouri loads the public curated fixture at `fixtures/account-intelligence/c3-curated/missouri.json`.

Build from the repository root, then start Missouri:

```sh
npm run build
C3_PORT=4331 node dist/c3/atliera-c3.js serve acc_university_of_missouri
```

In a separate terminal, start Utah:

```sh
C3_PORT=4332 node dist/c3/atliera-c3.js serve acc_university_of_utah
```

Open `http://127.0.0.1:4331` for Missouri and `http://127.0.0.1:4332` for Utah. These are separate loopback sessions; the UI does not switch accounts. Omitting the positional account ID defaults to Utah. For a provider-free Utah preview, leave `C3_MODEL_COMMAND` unset.

## Evidence and interpretation

Missouri means University of Missouri / Mizzou in Columbia. University of Missouri System material is separately attributed; systemwide statements do not establish campus authority or procurement intent.

The curated input retains five official public extracted snapshots and 13 exact excerpts, with source hashes and excerpt spans in the loaded context. The retained snapshots contain the full supplied **EXTRACTED TEXT**, not raw HTML or proof of original-source completeness. Acquisition timestamps describe collection, not publication dates or currentness. The snapshots do not prove a current change.

Agent-curated proposed/template content is not human-approved content, an owner disposition, policy admission, or a model generation/recording. Unknown owners and meeting dates remain blank; no budget or purchase intent is assumed. Source acquisition was separate human-directed research, not product retrieval or model activation.

## Available interaction and boundaries

Manual strategy and next-step planning text is editable using session-only state. Acknowledged edits survive reload in the same live session; they are not durable writes. Restarting the server loses its session state. Editing does not share work, assign owners, or send outreach.

Curated model generation and recorded replay are unavailable and refused before provider execution. This preview does not authorize provider activation, model recording, deployment, or other product effects.

The shared interface now includes an [editable structured proposed-next-step bridge](c3-proposed-next-step.md). An in-app account switcher and full two-account sprint/persona acceptance remain later bounded work. Documentation alone grants no deployment, provider, or effects authority.
