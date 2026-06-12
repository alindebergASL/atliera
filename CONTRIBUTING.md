# Contributing to Atliera

This file carries the normative language and referencing rules every change must follow. It is deliberately short; the architecture lives in `docs/adr/` and `docs/architecture/`, and the milestone chart lives in `docs/strategy/roadmap.md`.

## Vocabulary (normative — ADR 0003)

Three words have fixed meanings in this repository. Using them loosely is how boundaries erode, so reviews treat misuse as a correctness issue, not a style nit.

- **capability** — system-side, registry-entered, orchestrator-invoked. Capabilities act; the model never invokes them. Implemented over MCP with the harness's orchestrator as the sole client (ADR 0003 A1).
- **skill** — an instruction package (SKILL.md): model *input*, never executable. **Warning:** this is narrower than ecosystem usage, where "skills" frequently bundle executable scripts. In Atliera a skill never executes anything; the loader structurally rejects execution affordances (ADR 0003 A2, I-8, I-9).
- **tool** — used only when referring to the pinned-false model-transport flags (`tools`, `web_search`, `plugins`, `mcp`, `retrieval`). These stay `"false"` permanently (ADR 0003 R1).

The one-sentence doctrine: **skills-as-instructions, yes; skills-with-execution, no; tools-as-schemas, yes; tools-as-model-affordances, no.**

A short list of forbidden phrases is enforced in CI by `tests/safety/forbidden-phrases.test.ts`. The list itself is stated in ADR 0003's vocabulary section (it is not repeated here, because only the direction memo and the ADR are allowlisted to contain it). The lint's allowlist is fixed to those two files; **additions to the allowlist require operator sign-off.**

## The reference rule

**Anything in-repo documents reference must live in-repo, or be explicitly marked external-and-nonbinding.**

- If a doc depends on a chart, contract, decision, or review, that artifact must be committed (verbatim if it is a frozen directive/historical record) before or alongside the doc that cites it.
- Citations to specs, papers, audits, or other material outside the repository must be visibly marked as external and nonbinding — they inform, they do not govern.
- The milestone chart specifically has one source of truth: `docs/strategy/roadmap.md`. Reference it; never restate it.

## Standing expectations (unchanged, restated for newcomers)

- The full safety suite is doctrine, not decoration: a red on a `tests/safety/` test is a boundary breach, not a flake.
- Statuses, approvals, and assessments follow the consumable paper-trail discipline indexed in `docs/runbooks/INDEX.md`.
- No provider SDK imports, API-key env reads, or network calls in default paths; sanitized statuses only; raw/private evidence stays outside the repository.
