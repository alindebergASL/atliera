# Targeted preparation from retained direct sources

The account Research inspector can select an exact passage from the latest completed
snapshot, then explicitly validate it and open Prepare. Retrieval and selection remain
separate from admission. Admission creates new agent-proposed documentary statements
through the account-intelligence validator; it does not assert current availability,
human approval, temporal change or durable account truth. Publication, event and
current-through dates remain unknown unless independently established. Conditional
source statements retain their exact qualifiers.

The frozen proposal context contains original acquisition source/snapshot identities,
raw and clean hashes, exact offsets, derived evidence/finding identities and the
unchanged historical context. New findings and historical source counts are shown
separately in Prepare. Generation and independent checking use that context. The
selected fresh evidence must occur in Situation, Opening or a question. Existing
open work retains its original context; refresh and account navigation do not swap it.

A pending selection is session-only. Save uses the existing private work record to
retain the complete original context. Reopen rebuilds and validates the direct-source
admission without using current input or acquiring anything. Revision remains a
proposal until explicit Apply; notes remain session text until explicit Save.

## Explicit operator command configuration

`serve-accounts` remains model-disabled by default. An explicit
`--model-command-config /absolute/private/config.json` selects one account-bound
command. It cannot be combined with recorded replay. Ambient `C3_MODEL_COMMAND`
does not enable this multi-account command. The second account's hold remains in force.
The configuration is an owner-readable private regular JSON file outside the repo:

```json
{
  "accountId": "acc_university_of_utah",
  "principal": "operator-principal",
  "command": "/absolute/private/operator-wrapper",
  "args": [],
  "timeoutMs": 300000,
  "auditRoot": "/absolute/private/generation-attempts"
}
```

Configure `C3_WORK_STORE_ROOT` and `C3_OPERATOR_PRINCIPAL` with the same principal.
The command receives a temporary request-file path as its final argument, and returns
original model content bytes on stdout. It must independently enforce the actual
operator grant, exact requests, finite calls, deadlines, accounting and response
retention. Configuration is not spending authority. No credentials belong in the
file, application environment, request, UI or logs. The command controls credential
resolution only after admission. Generation attempts use the existing private journal.
The CLI does not infer a live-origin receipt from a successful command or provider name;
without separately trusted origin custody, saved origin remains unknown.

## Offline request preparation

This command has no source acquisition, model execution, socket or owner-store writes:

```sh
node dist/c3/atliera-c3.js prepare-targeted-request \
  ACCOUNT_ID PRIVATE_RESEARCH_CONFIG SNAPSHOT_ID SOURCE_ID PASSAGE_SHA256 \
  PRINCIPAL PRIVATE_FORM_JSON NEW_PRIVATE_OUTPUT_DIRECTORY
```

It resolves the latest completed retained snapshot using trusted runtime configuration,
validates admission, and writes `context.json`, the exact command `model-request.json`
bytes, and a preparation summary. The summary distinguishes raw request-byte SHA-256,
canonical request SHA-256 and meeting-form SHA-256. Inputs are inspectable, agent-proposed
preparation, not an invented approval. An operator can compare these exact bytes with
the displayed form and command request before enabling a bounded route.

Use `serve-accounts --research-config PRIVATE_RESEARCH_CONFIG` to inspect retained
research with acquisition disabled. Adding the model-command flag does not enable
source acquisition. Do not reset a consumed source scope or its immutable window.

## Contract migration and verification limits

Direct-source acquisition now has a typed lineage path alongside historical search
records; no search queries/results are fabricated. Existing search contracts keep
their nonempty query bindings. Contract 7 gains a selected-evidence requirement only
for the new direct-source context extension; unchanged historical context requests and
saved records retain their exact reconstruction.

The reviewed client surface adds only `/api/research/prepare` and the displayed
context hash header. Ordinary research actions do not navigate, Apply or Save.
Only explicit validated preparation navigates to the server-provided account route.
The client regression tests cover that exact transition and reject arbitrary routes.

Synthetic tests exercise two accounts, duplicate menus, exact custody, stale/foreign
selections, tampering, generation/checking, revision/Apply/notes/Save and service/store
recreation. Injected checker verdicts are plumbing evidence, not semantic verification.
Actual browser, HTTPS transport, paid output usefulness and process-restart acceptance
require separate host verification. A sandbox socket refusal is not a passing test.
