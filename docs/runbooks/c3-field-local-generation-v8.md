# C3 field-local generation contract v8

Status: forward prompt clarification implemented locally; integration review and host gates remain outstanding. No rollout or live consistency improvement is established.

V8 adds one generator paragraph making the existing verifier's field-local factual-premise citation rule explicit. Each field must own supporting evidence IDs for factual rationale and presuppositions, including premises in recommendations, questions and intendedLearning. Other fields, selectedEvidenceRefs and meeting intent cannot supply missing citations. Attributed premises retain date, scope and conditional qualifications; a citation alone does not establish currentness. Pure actions, open questions without factual presuppositions and justified evidence-limit unknowns may still have empty references.

The [dispatcher](../../src/c3/generation-contract.ts) defaults new generation to v8. Recorded verification, revision reconstruction and replay select the original contract. [V7](../../src/c3/generation-contract-v7.ts) and earlier version modules remain unchanged. V8 reuses frozen v7 structural/display helpers; its version-bound verifier retains the same evidence requirements, exact full-field segment coverage, citation ownership and refusal rules. Prior acceptance is never evidence, and no retained output or verdict is repaired.

[Public synthetic tests](../../tests/c3/c3-generation-v8.test.ts) cover the prompt delta, unchanged verifier semantics, citation-optional pure actions, citation-capable recommendation premises, denied borrowing, mixed-clause coverage, receipt identity and frozen v7 request/prompt/accepted/refused-record hashes. Injected verdicts verify deterministic plumbing only; they do not evaluate model judgment or prove better consistency.

The original C/D successful revision → explicit Apply remains missing. This change grants no new paid, provider, source, deployment or rollout authority, and establishes neither customer acceptance nor release approval. Further live evaluation requires separately bounded authorization. See the [standing development policy](../strategy/standing-development-policy.md) for existing engineering authority.

Local validation commands (sequential; real HTTP/browser and full CI belong to integration):

```sh
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/c3/c3-generation-v8.test.ts tests/c3/c3-generation-v7.test.ts tests/c3/c3-generation-v6.test.ts tests/c3/c3-generation-contract.test.ts tests/c3/c3-generation-emission.test.ts tests/c3/c3-generation-discourse.test.ts tests/c3/c3-cli.test.ts tests/c3/c3-working-document.test.ts tests/c3/c3-work-store-recovery.test.ts
```

A sandbox socket refusal is a validation limitation, never a passing HTTP/browser gate.
