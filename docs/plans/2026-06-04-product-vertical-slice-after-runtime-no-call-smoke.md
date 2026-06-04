# Product Vertical Slice After Runtime No-Call Smoke

## Goal

Move from isolated validation toward one thin product-grade vertical slice while preserving the safety boundaries already learned.

The target slice is:

Given an approved input graph bundle, Atliera produces a Workshop-ready view with Signals, Maps, Plays, evidence summaries, trust labels, a sanitized operator status, and no hidden provider or production side effects.

## Why this is the pivot

The no-call runtime smoke closed the route-chain foundation. The next useful question is not another abstract provider comparison. The next useful question is whether a human can inspect a deterministic Atliera product surface and say whether the product shape is useful.

## Slice definition

Inputs:

- input graph bundle
- deterministic fake-mode runtime configuration
- in-memory graph, artifact, and queue dependencies
- throw-if-called model adapter boundary

Outputs:

- Workshop-ready view
- Signals, Maps, Plays lens structure
- evidence and trust summaries
- optional sanitized HTML render
- operator-facing status facts

Required boundaries:

- deterministic fake-mode first
- provider calls: 0
- provider spend: false
- production writes: false
- runtime server start: false
- client construction: false
- live runtime/model-mode execution: false
- provider comparison: false
- default model selection: false
- provider lock-in: false
- readiness claim: false

## Verification command

`npx tsx --test tests/runtime/workshop-preview.test.ts`

This deterministic product-shape verification exercises the existing runtime Workshop preview path. It verifies that the product-facing view model and sanitized HTML render can be produced from the runtime graph snapshot without calling model adapters, writing graph state, starting a server, constructing clients, reading ambient runtime configuration, or depending on provider access.

## Next boundary

If this deterministic vertical slice stays coherent, the next live step may be a separate tiny runtime/model-mode proof approval and later execution status. That later live proof must be one-call only, route-ref explicit, bounded to the candidate route, and unable to imply product readiness, production readiness, launch readiness, default model selection, provider comparison, provider lock-in, or broader product-preview expansion.
