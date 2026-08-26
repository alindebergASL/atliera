# C2 provider structured-output and output-limit boundary

## Scope

This checkpoint inspected repository-local adapter and request contracts only. It made no provider request, compatibility probe, or model execution.

## Structured output

The accepted `HermesGpt55ModelOnlyProviderPayload` exposes only:

- `model`
- `instructions`
- `input`
- `store: false`
- `stream: true`

It does not expose `response_format`, `text.format`, `json_schema`, or another reviewed strict Structured Outputs projection. Provider-side JSON Schema enforcement is therefore **unestablished** for this adapter and is not claimed.

Proposal shape and semantics remain enforced locally by strict JSON parsing and deterministic proposal validation. The local validator retains exact-key checks, enums, structural bounds, evidence/entity lineage, qualifier retention, commercial-safety rules, freshness rules, consequential review routing, and immutable controller-owned coverage/gaps.

## Output ceiling

The reviewed Codex streaming payload does not transmit `max_output_tokens`; no server-side output-token ceiling is established. The adapter records:

- requested local output-token ceiling;
- transmitted provider ceiling as `null`;
- external enforcement as `unestablished`;
- observed output tokens when reported;
- a bounded local UTF-8 stream-capture limit.

The account-intelligence boundary rejects reported output tokens above the requested local ceiling. The C2-local wrapper in `src/account-intelligence/hermes-gpt55-c2-stream-boundary.ts` counts raw UTF-8 bytes as chunks arrive, closes the upstream async iterator on refusal, and rejects capture beyond 512,000 bytes before the unchanged shared adapter concatenates or parses JSON. The unchanged shared adapter then rejects incomplete, trailing, concatenated, or structurally invalid JSON.

These local controls do not imply provider-side enforcement.
