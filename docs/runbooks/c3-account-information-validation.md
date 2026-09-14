# C3 account information — local UV1

UV1 separates useful information, source provenance, human assessment, generation checks,
and explicit document saving. An information review never accepts a refused generation.
The local actor is the configured operator; this is not multiuser authentication.
Historical generation contracts and accepted prose remain unchanged.

## Offline synthetic demonstration

From the repository root:

```sh
npm ci
npm run build
node --import tsx scripts/bootstrap-c3-information.ts
```

The bootstrap uses only public authored fixtures and production persistence/admission APIs.
It creates a fresh private directory under the operating-system temporary directory,
outside the repository, and prints an exact `serve-information` command, account URLs,
a candidate identifier, a saved document identifier, and the demonstration sequence.
Its synthetic in-memory source transport exists only in the bootstrap. It is not a
production provider, research result, or model-quality assessment.

Run the printed command. `serve-information PRIVATE_CONFIG_JSON` explicitly loads a
bounded private operator configuration with exact contexts, attempts, custody receipts,
and optional retained research scope. It never scans journals or reads historical private
attempts implicitly. Both model execution and source acquisition are disabled. Restart
with the **same** configuration to retain information reviews and saved briefs. Running
the bootstrap again creates a separate demonstration, not a recovery or migration.

On the primary account, inspect the failed-check candidate and its retained evidence.
Record firsthand validation with a reason. The original incomplete/invalid check remains
visible. To demonstrate later corroboration, edit the synthetic proposition to
“Synthetic pilot began in September 2026.” and time scope to “September 2026”, keeping
the source entity. Earlier validation remains in history, attached to the earlier wording.
Validate the new wording, then assess the first and second synthetic retained reports.
Select Supports, record independently originated support, distinct common-origin groups,
and a rationale for the same proposition, entity and time. This is an attributed **human
assessment**, not automatic truth inferred from a source count. Select the contradictory
report in a later assessment; conflict becomes prominent and earlier validation remains.
Contradictions remain unresolved for that statement revision in UV1, including after later
support or reopening. UV1 has no conflict resolution action; history retains the evidence.
An edit starts a new statement revision and must receive its own support assessment.

Corroboration can coexist with Needs confirmation. Choose Assess time scope separately,
select the attached supporting evidence, and explain each source's dates and relevance to
the exact statement period in Temporal basis. Old or missing dates require explicit reasoning;
matching scope strings or independent origins are not currentness proof. Historical evidence
can address a historical claim. The attributed judgment does not change source dates or
prove truth. Reopen or edit invalidates the active time-scope assessment. Changing supporting
evidence requires an assessment covering that evidence. Older schema-1 assessments contain
no separate temporal basis and display that time scope still needs confirmation.

Open the seeded meeting brief from Saved briefs, return to Account, and choose Add to
working context. Open the session draft and Save. Restart and reopen. Change information
on Account, then reopen the saved brief: its included snapshot remains unchanged while
current changes appear beside it. Refresh working snapshot is a local edit; explicitly
Save to publish the next version. Save a copy keeps the old document and its versions.

Inspect `/healthz` before and after. Both accounts must report disabled providers and zero
generation attempts. The bootstrap prepares the saveable brief offline; browser generation
is neither needed nor available. Do not use the closed historical v8 attempt.

## Browser selectors and behavior

- `[data-information-item]`: statement card, with `data-version` and stable `id`.
- `[data-information-detail] > summary`: View evidence and review.
- `[data-information-form]`: `action`, `reason`, `firsthand`, `text`, `entity`, `timeScope`,
  `effect`, `independence`, `temporal`, `temporalBasis`; evidence checkboxes use `name="evidence"`.
- `[data-information-evidence-choice]`: retained evidence, common-origin group and basis.
  Expand its source detail to inspect the exact retained excerpt and metadata.
- `[data-information-status]`: save/error acknowledgement. Failed requests keep reasoning.
- `[data-information-work="add"]`, `refresh`, `remove`: explicit attachment actions.
- `[data-information-attachments]`: included snapshots and current-status comparison.
- `[data-reopen-work]`, `[data-save-work]`, `[data-save-copy]`: existing document controls.

Use desktop 1440×1100, tablet 1024×900 and mobile 390×844. Check keyboard focus, inline
errors, disclosure controls, horizontal overflow, direct candidate URL, reload, browser
back/forward, account switching and restart. Browser evidence must come from the running
application; renderer/VM tests are not browser verification. Keep screenshots and source
artifacts outside the repository.

## HTTP contracts

Routes live under `/accounts/ACCOUNT_ID`. Obtain the cookie and CSRF token from Account.
POST JSON requires `Origin`, `X-C3-Account`, `X-C3-CSRF`. Document mutations additionally
require the rendered `X-C3-Document`. No client actor, time, filesystem path or final
corroboration designation is accepted.

`POST /api/information/list` with `{}` returns current `items`, retained `evidence`, and
configured `operator`. This observation does not invoke acquisition or generation.

`POST /api/information/change` takes exactly:

```json
{
  "id": "info_<digest>",
  "expectedVersion": 1,
  "additionalEvidenceIds": [],
  "change": {
    "action": "validate",
    "reason": "Why this statement is useful and validated",
    "firsthand": "Specific firsthand basis, or select attached evidence",
    "evidenceIds": []
  }
}
```

Other changes:

- `edit`: `action`, `reason`, `text`, `entity`, `timeScope`.
- `withdraw` or `reopen`: `action`, `reason`.
- `assess-time`: `action`, `reason`, `evidenceIds` (already attached), `entity`, `timeScope`,
  `temporal` (`addresses-scope` or `unresolved`), `basis` (nonblank explanation of dates
  and relevance for each selected source). This is separate from support and origins.
- `assess`: `action`, `reason`, `evidenceIds`, `effect` (`supports`, `contradicts`,
  `does-not-resolve`), `entity`, `timeScope`, `independence` (`unknown`, `established`),
  `origins` (`evidenceId`, `group`, `basis` per assessed independent source).

New evidence IDs must resolve through the server's account/operator-scoped retained
source catalog and may be attached only with an assessment. Existing context is not
rewritten. Independence requires explicit origin/relevance reasoning, distinct documentary
lineages, and matching statement entity/time scope. Structural checks do not prove the
operator's semantic judgment or source independence.

`POST /api/work/information` takes exactly `action` (`add`, `refresh`, `remove`), `id`,
`informationVersion`, `workVersion`, `recordId`. It returns local `attachments`,
`workVersion`, and `saved:false`. `/api/work-state` exposes the attachment snapshot.
Explicit `/api/save` or `/api/save-copy` carries `informationAttachmentsSha256` from the exact compared work-state snapshot
alongside existing record/document/version fields. The small digest avoids copying large
evidence snapshots into a bounded Save request. Exact `informationAttachments` are also
accepted for direct callers whose body fits the existing request limit. Nonempty attachments
require exact snapshot or digest agreement. Refresh alone cannot increment the durable document version.

## Storage and limits

Information versions live in `C3_WORK_STORE_ROOT.information`, a dedicated private sibling
namespace partitioned by configured principal and account. They do not consume work or
research file quotas. Information supports at most 100 items, 100 changes per item,
40 retained evidence snapshots per item, and 2 MB per immutable publication. Kernel locks,
CAS, private owned paths, no-follow reads, checksums, and exact readback protect publication.
A failed acknowledgement never reports Saved; reopen to inspect possible publication.

Information schema 2 adds the separate time-scope assessment action. Schema 1 records and
old assessment shapes remain readable without mutation; a new saved change writes schema 2
and retains prior history. No-change saves keep their existing schema. Attachment envelope
schema 1 continues to hold either information schema, preserving old snapshot bytes and hashes.

Saved-work schema 4 holds separate versioned information attachments with their own exact
source excerpts, metadata and custody identities. Schema 1–3 readers remain supported;
old files are not migrated. The exact successful-record guard remains mandatory. Missing
current storage yields Current status unavailable while saved evidence stays inspectable.
No generic Strategy or Next steps worksheet persistence is added.

## Verification commands

```sh
node --import tsx --test tests/c3/c3-account-information*.test.ts
npm run ci
C3_TEST_REAL_HTTP=1 node --import tsx --test tests/c3/c3-account-information-service.test.ts tests/c3/c3-account-information-work.test.ts tests/c3/c3-multi-account.test.ts tests/c3/c3-service.test.ts
```

If local sockets are denied, record the actual `EPERM` result and have the parent run TCP
and Chromium verification. `C3_HISTORICAL_IN_PROCESS=1` selects the existing historical
service fallback; it does not establish process-restart or TCP acceptance.
