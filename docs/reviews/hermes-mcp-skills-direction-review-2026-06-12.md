# Hermes Review of the MCP/Skills Direction (2026-06-12)

## Provenance header (standing format)

Adopted as the standing format for all entries in `docs/reviews/` from this entry forward.

- **Source:** Hermes review of `docs/strategy/mcp-and-skills-direction.md` and `docs/adr/0003-system-capabilities-over-mcp-skills-as-instructions.md`, delivered in chat 2026-06-12.
- **Channel:** chat-side, reports-only. The reviewer reported state of `origin/main` and PR #267 to chat; the entry below is reasoned from that reported state.
- **Reported vs. inspected:** the reviewer reported `f2397fc` on `origin/main`, PR #267 merged, the four Phase 0 test names green locally and on GitHub CI, full local CI 1161/0, and a clean local tree. This file has not independently re-inspected those facts; the verification packet committed alongside this entry (M3 work, next session) is where inspection happens.
- **Custody:** the content below paraphrases and excerpts the chat-delivered text in a fixed structure; verbatim quotation is bounded to short phrases where word choice is doctrinally load-bearing. Long passages are reformatted to fit the review template, not edited for substance.
- **Forbidden-phrase convention for reviews:** when an entry needs to refer to one of the five phrases enforced by `tests/safety/forbidden-phrases.test.ts`, the entry must use the **broken-form convention** — split the phrase across markdown boundaries (a span break, a backtick-split fragment, or a parenthetical) so the literal substring does not appear. This file uses no forbidden phrases at all; the convention is set here as standing practice for future entries.

## What was reviewed

The reviewer assessed two artifacts as a unit: the direction memo (`d86e8d2`) and the Phase 0 implementation that landed it as repository doctrine (PR #267, merged at `f2397fc`). The review covers both the architectural direction and the implementation choices.

## Reviewer verification (reported, not independently inspected here)

- PR #267 merged; merge commit on `main`: `f2397fc`.
- Targeted Phase 0 tests: 5 pass, 0 fail.
- Full local CI: `npm run ci` → 1,161 tests pass, 0 fail; fixture gate pass.
- GitHub CI on PR #267: typecheck, build, test all SUCCESS.
- Reviewer's local repo synced to `f2397fc`; working tree clean.

## Substantive assessment

### 1. The mediation invariant is the right framing
The shift from "the model has zero tools" to *"every model-initiated effect passes through typed validation, budget enforcement, and a defined mediation gate before any system action occurs"* survives skeptical scrutiny in a way the slogan does not. Once model proposals can cause the orchestrator to fetch, write, or schedule, the slogan reads as marketing. The invariant says exactly where authority lives — not in the model, not in the transport, but in typed system gates plus approvals — and is verifiable.

### 2. MCP behind the boundary is the principled compromise
The protocol is adopted as schema and transport for system capabilities, with the orchestrator as the sole client. That preserves ecosystem compatibility and legibility without accepting the default trust model. Ignoring the protocol entirely would have led to a private capability protocol and lost hiring/interoperability leverage; adopting it the default way would have dissolved the trust architecture. The split is the right one.

### 3. SKILL.md as instruction packaging — under the execution-stripped constraint
Using the format for prompt contracts makes sense *because* execution is structurally stripped. The repository already has substantial prompt/contract discipline; a standard package format helps. Allowing scripted or remote/third-party skill packages would have opened a new supply-chain and execution channel; the loader-rejection rule is the kind of constraint Atliera needs. The 26.1% ecosystem-audit vulnerability finding (with script-bundling packages 2.12× more likely vulnerable) makes this a security posture, not an aesthetic preference.

### 4. The permanent refusal is necessary
Pinning the model-transport flags `"false"` permanently is the single most important piece. Without that, every future "just this one integration" would create pressure to bypass the kernel. The forbidden L3 path is similarly important: if L3 existed as an "emergency override," it would eventually be used. Making it impossible by doctrine and CI tests is the right move.

### 5. The L0/L1/L2/L3 gate model is a clean abstraction
The level model gives the team vocabulary for *how much model influence is present* instead of treating all capability use as equivalent. The rule that **L2 is impossible before M3** is especially well-aimed: it makes ratification the structural precondition for any capability path beyond allowlist selection, which aligns with the doctrine spine (agent proposes → system validates → human ratifies → durable state).

### 6. Phase 0 was the right first implementation
ADR + tripwire tests + forbidden-phrase lint + roadmap turns architectural direction into red-build boundaries before anyone adds an MCP client, a loader, or capability code. The "green on day one" character of the tripwires matters because they protect against drift — they do not prove the future system; they pin the current absence of dangerous surfaces.

### 7. Named risk: doctrine-heavy sequencing
The risk is not architectural; it is sequencing. A lot of harness/kernel work is now available — H1, H2, M2.5, M4 acquisition, A3 spec, capability registry, mediation gate, skill loader. It would be easy to spend weeks on the meta-system before closing M3. The memo itself guards against this with *"M3 needs none of this and should not wait."* The reviewer agrees strongly.

### 8. M4-before-M5 — reviewer's lean
The roadmap correctly marks this OPEN. The reviewer leans slightly toward finishing M3, then a narrow curated-source M5 before full M4, unless evidence acquisition is judged absolutely essential to the "real account end-to-end" proof. Reasons:

- M4 introduces a new risk class: fetched-content injection, copyright/PII/takedown posture, sandboxing, allowlisted egress, MCP server supply chain.
- A curated-source M5 would prove the whole doctrine loop sooner: model proposal → validation → human ratification → durable graph write → Workshop from durable state.
- After such a proof, M4 can be justified by a clearer product gap rather than a kernel detour.

If evidence acquisition is judged to be part of "the job," M4-before-M5 is defensible — but the reviewer would not let M4 become a kernel detour before the durable ratification loop closes.

### 9. Recommendation: M3 next
- No-call durable graph-write approval/contract surface
- Then a separately approved local durable graph write
- Then Workshop rendering from durable state

After the M3 retro, decide: M4 first if acquisition is required for the capstone; curated-source M5 first if the goal is to prove the core product loop fastest.

## Bottom line

> The direction is principled, testable, and reversible. It keeps Atliera aligned with industry standards without surrendering the trust boundary. The one thing to guard against is letting the elegance of the H-track pull attention away from finishing the M3 → M5 product proof.

## How this entry is used elsewhere in the repo

- `docs/strategy/roadmap.md` adopts the default sequence M3 → M5a → M4 → M5b, putting the burden of proof on any reordering; the reviewer's lean above is one of the inputs to that default.
- `docs/strategy/roadmap.md` records the H-track freeze rule (frozen until M3 ships, lifted only at the M3 retro) — the reviewer's "sequencing risk" framing is the substantive justification.
- `docs/reviews/phase-0-retro-and-m5-drift.md` is the companion retro file produced in the same change; it records the M5 wording drift against the frozen big-picture review.
