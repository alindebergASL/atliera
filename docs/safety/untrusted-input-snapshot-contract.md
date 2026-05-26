# Untrusted Input Snapshot Boundary Contract

Status: Accepted

## Purpose

Atliera provider, adapter, preflight, and manifest code often receives values from
untrusted boundaries: injected model providers, storage adapters, queue/database
clients, backend rows, operator-supplied JSON, or future plugin/runtime surfaces.
Those values can be plain malformed data, but they can also be getter-backed,
accessor-backed, or Proxy-backed objects that throw or leak sensitive text when a
property is read.

This contract names the safety pattern that existing hardening PRs established.
It is a normative implementation contract for new Atliera provider, adapter,
preflight, and evidence/reporting paths.

## Contract

### 1. Read once into plain snapshots

Untrusted inputs must be read once at the boundary into plain snapshots or plain
data before validation, branching, evidence construction, telemetry, or calls into
injected dependencies. "Read once" means one boundary snapshot pass over the
explicitly needed fields; it does not authorize repeated live-object reads later
in the same path. Snapshot code should copy only the fields the boundary needs
and should prefer own enumerable data properties for map-like metadata.

After the boundary, no live untrusted objects may flow deeper into Atliera logic.
Provider responses, adapter return values, backend rows, request metadata,
approval records, queue payloads, and configuration-like external inputs must be
converted to stable local values first.

### 2. Do not reread live untrusted objects

After a snapshot exists, implementation code must not reread the original live
untrusted object. All subsequent logic operates on the snapshot. This includes:

- success/failure branching
- validation error construction
- ledger entries
- persisted evidence
- manifests and reports
- telemetry/event observers
- calls to injected providers, storage clients, queue clients, or database clients

A first read that succeeds and a second read that throws must not be possible on
load-bearing paths. Tests for new boundaries should include this case when the
input can be adversarial.

### 3. Fail closed on accessor, getter, or Proxy failures

If snapshotting fails because an input has an accessor, getter exception, Proxy
trap, or other property-read failure, the boundary must fail closed with a stable
sanitized error. The stable sanitized error should identify the Atliera failure
category without echoing provider-controlled details.

The raw thrown error, raw exception text, raw backend body, backend details,
prompt text, credential name or value, local path, approval reference value,
process signal, or provider-controlled diagnostic must not appear in returned
errors, logs, telemetry, manifests, or persisted evidence.

### 4. Preserve only exact safe validation errors

Some internal validators intentionally return safe, stable validation messages.
Those messages may be preserved only when the allowlist is exact-match and
non-spoofable. Prefix matching is not allowed when untrusted code can spoof a
message beginning with the safe prefix and append leaked data.

If the source of an error message is ambiguous, provider-controlled,
adapter-controlled, or derived from a getter/proxy failure, sanitize it instead
of preserving it.

### 5. Persist sanitized snapshots only

Persisted evidence, manifests, reports, cost ledgers, adapter records, and run
artifacts must consume sanitized snapshots only. Live untrusted objects must not
flow into persistence layers, observers, or report summarizers.

Evidence and reporting must not leak prompts, credentials, secrets, raw backend
details, local paths, raw approval refs, raw provider responses, or raw adapter
exception text. Refused, failed, estimated, malformed, or dependency-failure
states must not be summarized as successful execution merely because a report
object exists.

### 6. New boundaries must test the class, not only the happy path

When adding or extending a provider, adapter, preflight, manifest, report, queue,
graph, or future plugin/runtime boundary that consumes untrusted data, include
adversarial tests for the relevant shape:

- malformed plain objects
- getter/accessor failures
- Proxy trap failures when practical
- first-read-succeeds / second-read-fails reread regressions
- spoofed validation error strings when safe messages are preserved
- evidence/report persistence that consumes only sanitized snapshot fields

## Normative examples

These existing implementations and tests are normative examples for future work.
New implementations should follow these patterns rather than inventing a looser
alternative.

- Artifact metadata snapshots: caller and backend metadata are copied as own
enumerable string data, unsafe accessors/proxies fail with stable sanitized
errors, and literal data keys are preserved without live object reuse.
- Database queue payload snapshots: queue payloads are snapshotted before
storage/client boundaries so later payload mutation or getter rereads cannot
change persisted job evidence.
- Provider request and provider request metadata snapshots: request fields and
metadata are copied and frozen before injected provider execution so providers
cannot mutate baseline request evidence.
- Provider validation and approval snapshots: validation harness options,
provider responses, and approval records are snapshotted before reporting or
ledger construction, with exact allowlists for safe validation errors.
- Manifest and reporting evidence snapshots: persisted validation reports and
summaries consume sanitized provider/adapter reports rather than live
provider-controlled objects.

## Deviations

Deviations from this contract must be exceptional. A boundary that cannot follow
the read-once snapshot pattern, such as a future streaming protocol, must include
all of the following before merge:

1. explicit documentation of why the normal snapshot boundary does not apply;
2. security review focused on the specific leakage/reread class this contract
   prevents;
3. a specific test proving the deviation does not reintroduce live-object reread,
   raw exception leakage, prompt/credential/backend-detail leakage, or unsafe
   evidence persistence;
4. narrow scope, with the deviation contained to the smallest possible boundary.

A deviation must not become the common path for ordinary provider, adapter,
preflight, manifest, or report code.

## Sequencing discipline

This contract is a capstone guardrail for an already-implemented safety pattern.
It does not replace validation through implementation. Future generic snapshot
hardening PRs should name the specific validation blocker they close before work
starts; otherwise the project should resume the validation sequence rather than
continue open-ended substrate hardening.
