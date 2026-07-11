# H2 Capability Registry / Mediation / Echo Proof Status

Status: implementation complete in this bounded H2 slice; effective only when this PR merges after independent review.

## Visible result

The deterministic proof artifact is:

`fixtures/validation/h2-echo-mediation-proof.json`

View or regenerate it on stdout from a clean checkout:

```bash
npm ci
npm run --silent h2:echo-proof
```

The committed artifact shows the full system-side path:

**approved L0 schedule → mediation gate → inert echo over the in-process MCP boundary → one `CapabilityExecution` + one `AuditEvent` + one accounting increment**.

Its exact visible result is one completed echo invocation with descriptor SHA-256 `b9f70d3a4b18129022f505bd9b41178fdae40f685a24bfbd0b6977183f4d2fa6`, schedule reference `sched_h2_echo_proof_v1`, 41 sanitized input bytes, 41 sanitized output bytes, 7 ms deterministic duration, zero retries, and zero network/provider/acquisition/private/filesystem/environment/database/subprocess/production/deployment effects.

## Architecture delivered

- `src/capability/h2-registry.ts` contains one immutable system-administered registry entry: `system.inert_echo_v1`. It pins MCP `2025-11-25`, the in-process server identity, canonical descriptor snapshot and SHA-256, L0-only mediation, exact budgets, and a no-effects sandbox profile.
- `src/capability/inert-echo-mcp-server.ts` accepts exactly one bounded plain-data string and returns the same value. It imports no network, filesystem, environment, provider, database, subprocess, or deployment surface.
- `src/capability/orchestrator-mcp-client.ts` is the sole client. Model and agent modules do not import capability-client code.
- `src/capability/h2-mediation-gate.ts` stores approved schedules privately, snapshots and validates schedule data, rederives the live descriptor hash, checks L0 and exact hard budgets, consumes the one-shot allowance before invocation, and emits the execution/audit/accounting records at the choke point.
- Raw model text is not an invocation trigger. Invocation accepts only the approved-schedule trigger shape plus bounded echo input.

## Executable ADR 0003 proof

- I-3: model-side import isolation plus sole-client topology test.
- I-4: missing/unapproved schedules and raw trigger shapes refuse before transport access.
- I-5: live descriptor drift refuses before transport access.
- I-10: retry budget is exactly zero and one approved schedule permits at most one invocation.
- I-11: every actual MCP call produces one execution record, one sanitized `AuditEvent`, and one accounting increment, including a sanitized failed outcome if the in-process transport throws.

Permanent I-1/I-2 transport tripwires remain in force: model transport capability flags stay false, and model-bound code contains no echo capability ID, server identity, descriptor schema, or invocation surface.

## Authority boundary

- current_effective_authorization: none
- h2_network_effects: 0
- h2_system_side_acquisitions: 0
- h2_provider_calls: 0
- h2_private_reads: 0
- h2_filesystem_operations: 0
- h2_environment_reads: 0
- h2_database_operations: 0
- h2_subprocesses: 0
- h2_production_writes: 0
- h2_deployments: 0
- authorizes_m4_implementation: false
- authorizes_live_acquisition: false
- readiness_claim: false

## M4 successor surface

`src/capability/h2-m4-successor-template.ts` and the proof artifact contain only an inert, unregistered, non-executable template for `public_http_fetch_v1`. No fetcher exists. Fork-versus-build is undecided; exact targets are unset; robots, retention, and takedown remain operator decisions. M4 implementation requires a fresh operator/roadmap decision after H2 merges and receives independent review. Any later live acquisition still requires the compact packet and explicit GO.
