# H2 Capability Registry / Mediation / Echo Proof Status

Status: shipped at `691555292b43a37f4f5ec5bba43978ffcc177a0f` (PR #284).

## Visible result

The deterministic proof artifact is:

`fixtures/validation/h2-echo-mediation-proof.json`

View or regenerate it on stdout from a clean checkout:

```bash
npm ci
npm run --silent h2:echo-proof
```

The committed artifact shows the full system-side path:

**repository-pinned approved L0 schedule → mediation gate → MCP `initialize` / `notifications/initialized` / `tools/list` / `tools/call` → inert echo → one `CapabilityExecution` + one `AuditEvent` + one accounting increment**.

Its exact visible result is one completed echo invocation with descriptor SHA-256 `b9f70d3a4b18129022f505bd9b41178fdae40f685a24bfbd0b6977183f4d2fa6`, schedule reference `sched_h2_echo_proof_v1`, 41 sanitized input bytes, 41 sanitized output bytes, 7 ms deterministic duration, zero retries, and zero network/provider/acquisition/private/filesystem/environment/database/subprocess/production/deployment effects.

## Architecture delivered

- `src/capability/h2-registry.ts` retains `system.inert_echo_v1` as the immutable first system-administered registry entry. M4 adds its reviewed second entry without altering the echo descriptor or behavior.
- `src/capability/h2-approved-schedule.ts` is the only schedule authority. It contains one repository-ratified schedule with a literal canonical SHA-256 pin; runtime input cannot register schedules or claim an approval identity.
- `src/capability/inert-echo-mcp-server.ts` implements the minimal MCP 2025-11-25 lifecycle and tools surface. Its `CallToolResult` carries required `content` plus matching `structuredContent`; the echo still imports no network, filesystem, environment, provider, database, subprocess, or deployment surface.
- `src/capability/orchestrator-mcp-client.ts` is the sole client. It negotiates MCP `2025-11-25`, obtains and deeply snapshots the live descriptor through `tools/list`, requires the conformant result shape, keeps `initialize` non-cancellable, bounds the `initialized` notification, and uses cancellation only for cancellable requests. Model and agent modules do not import capability-client code.
- `src/capability/h2-mediation-gate.ts` checks the repository-pinned authority, atomically reserves the process-local one-shot allowance before asynchronous preflight, restores it on pre-effect refusal, rechecks expiry immediately before `tools/call`, consumes it for every call attempt, and finalizes the execution/audit/accounting records even on timeout, transport failure, or post-call clock failure.
- The general `src/index.ts` barrel exports no capability registry, descriptor, client, or execution surface; system-side exports are isolated under `src/capability/index.ts`.
- Raw model text is not an invocation trigger. Invocation accepts only the approved-schedule trigger shape plus bounded echo input.

## Executable ADR 0003 proof

- I-3: model-side import isolation, general-barrel closure, and sole-client topology tests.
- I-4: the hash-pinned repository authority is the only accepted schedule; missing, forged, or raw trigger shapes refuse before transport access, and no public schedule-registration method exists.
- I-5: the descriptor comes from MCP `tools/list` and is copied into an exact deep plain-data snapshot before hashing; hostile nested proxies, accessors, symbols, custom prototypes, and malformed arrays refuse before `tools/call`.
- I-10: retry budget is exactly zero, concurrent calls share an atomic process-local reservation, expiry is rechecked at the effect boundary, request/notification waits are bounded, and `initialize` is never cancelled.
- I-11: every attempted `tools/call` produces one execution record, one sanitized `AuditEvent`, and one accounting increment, including timeout, malformed result, transport failure, post-call clock throw, and monotonic-clock regression paths.

Permanent I-1/I-2 transport tripwires remain in force: model transport capability flags stay false, and model-bound code contains no echo capability ID, server identity, descriptor schema, or invocation surface.

## Authority boundary

- current_effective_authorization: none
- h2_one_shot_scope: process-local; process restart resets state
- h2_test_factory_scope: isolated deterministic proof/testing only
- durable_or_global_consumption_authorized: false
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
- historical_h2_authorized_m4_implementation: false
- authorizes_live_acquisition: false
- readiness_claim: false

## M4 successor surface

The former `src/capability/h2-m4-successor-template.ts` surface now records that the fresh post-H2 decision selected a minimal first-party implementation and superseded the unregistered draft. The M4 path is executable only with recorded/injected dependencies; live acquisition remains unauthorized and requires the drafted compact packet plus later explicit operator GO.
