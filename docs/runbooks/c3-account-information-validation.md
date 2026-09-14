# C3 account information — local trust loop

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
Contradictions remain open across support, reopening and statement edits until explicitly
judged for the current proposition. Expand the compact open/resolved conflict summary to
inspect each original statement, entity, period, attribution and contradicting evidence.
Choose **Resolve selected conflicts**, select one or more existing open contradictions,
and inspect the displayed current proposition. Choose Evidence correction, Different
proposition/entity/time, or Firsthand assessment. Supply a reason and specific factual basis;
select already attached evidence or record an honest firsthand basis. For this synthetic
exercise only, describe why the report concerns a different synthetic pilot if that is the
scenario you are assessing; this is not a real-account result or an automatic truth check.

The judgment is attributed to the configured operator. It grants neither validation nor
independent corroboration and never accepts a refused generation. The original statement,
contradicting evidence and judgment stay in history. **Restore a resolved conflict** selects
one exact current resolution/contradiction pair and records why it is reversed. Other
conflicts, including later reports, are unaffected. Reopen for confirmation changes review
attention but does not reverse or reapply an explicit resolution.

An edit starts a new statement revision, invalidates active support/validation/time-scope
assessments and expires resolutions for the previous wording. All original conflicts need
review for the edited proposition; none is treated as proof against unrelated new wording.
Their prior scope remains visible. A new explicit judgment can explain the different
proposition, entity or time. Expired judgments remain in history but cannot be restored as
if still active. No-change edits do not expire anything.

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
- `[data-information-conflicts] > summary`: compact open/currently resolved counts with
  progressive original-scope and evidence details.
- Resolution controls: `contradiction` checkboxes, read-only `resolutionText`,
  `resolutionCategory`, `resolutionBasis`, `firsthand` and attached `evidence` choices.
  Restore uses native `restoreTarget` select with an exact contradiction/resolution pair.
  Empty states direct the operator back to existing assessment or open conflict details.
  Native controls support keyboard operation; actual Chromium evidence is required.
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
- `resolve`: `action`, `reason`, `contradictionIds` (1–20 distinct open history identities),
  `text`, `entity`, `timeScope` (exact current proposition), `category` (`evidence-correction`,
  `different-scope`, `firsthand`), `basis` (specific nonblank factual rationale), `firsthand`
  (nonblank for firsthand category), `evidenceIds` (already attached only). At least evidence
  or firsthand basis is required. `additionalEvidenceIds` must be empty.
- `restore-conflict`: `action`, `reason`, `contradictionId`, `resolutionId`. Both must name
  the same currently effective judgment. Foreign, future, missing, duplicate, already
  resolved/restored and expired targets fail before publication; stale versions fail CAS.
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

Changed publications reserve reversal capacity derived from existing history and the
latest existing store records; no registry or migration is involved. Prospective history
length plus the number of currently resolved targets must be at most 100. Each target
needs its own restore entry, even when one judgment resolved several targets. Every
ordinary write obeys this reservation. An exact restore consumes one entry and releases
one reservation; an edit expires the judgments and releases their reservations. Reopen
does not release them. No-change retains the existing version and schema.

The information directory also has a shared 4,090-entry publication budget, across all
accounts/operators using that root, with the existing 4,096-entry listing bound and
housekeeping margin unchanged. Under the publication lock, a changed write requires
directory entries after publication plus all remaining active target reservations to fit
that budget. Unrelated-item and new-item writes cannot consume those reserved slots.
The prospective 2,000,000-byte envelope must also fit every remaining restore, allowing
the maximum legal 1,200-character reason, JSON escaping, operator attribution and ISO
timestamp. Later evidence/review writes must preserve this byte headroom too.

Unsafe new judgments and capacity-consuming reviews are refused before publication with
a capacity error; typed reasoning remains available. Existing schema 1/2 records and
snapshots remain readable unchanged. This contract applies to writes admitted with these
checks; it cannot retroactively supply capacity to an already stranded diagnostic record.
Normal storage availability is still required: reserved logical capacity does not make
writes possible under ENOSPC, I/O failure, corruption, permission loss or external file
changes. No automatic deletion, larger quota, or physical-outage recovery is performed.

Information schema 3 adds explicit resolution and restore actions to the existing history;
there is no separate mutable adjudication registry. A history identity is `ih_` plus the
canonical SHA-256 of `[item.id, accountId, principal, one-based history position, entry]`.
Resolution entries name selected contradiction identities and the exact current proposition;
original scope is recovered from each immutable target entry's statement revision. Restore
names both that contradiction and the exact resolution entry. Edits expire effective
judgments; later contradictions are separate identities. Readers replay actions against the
strict preceding history and verify sequential statement edits, so final-state shape alone
cannot authorize a forged resolution or restore.

Schema 1/2 information and attachment envelope schema 1 remain readable without mutation.
New items and changed publications write information schema 3; no-change saves keep their
existing schema. There is no in-place migration. Strict history prefix, immutable prior
evidence and CAS remain enforced by the existing information store. Replay is structural
validation, not proof of the operator's factual reasoning or cryptographic human identity.

Included schema 1/2 snapshots retain their original revision-local conflict labels and
wording. The current Account view carries historical conflict attention across edits; when
this differs even for the same stored version, the brief explicitly distinguishes current
review from the historical labels and links to Account. Record a review to publish schema 3,
then Refresh working snapshot and explicitly Save. Changed live information is compared
separately; historical snapshots and their hashes are never silently reinterpreted or edited.

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


## Focused retained-information preview UX

Account's **Find information** searches only rendered statement, scope, trust and attached
source text for this account. The 200-character input is processed locally as literal text;
it is not sent to a server or stored in information records. Filtering hides cards in place,
keeping typed review reasoning, and is reapplied after a saved review replaces its card.
The match/total count is announced politely. Clear search restores all cards.

After an Account addition, **Return to brief and Save** opens the existing account-qualified
session draft. Adding information, refreshing snapshots and restoring conflict judgments do
not automatically Save the brief. Saved prose and prior snapshots remain unchanged.

Only the `serve-information` private launch file accepts optional top-level `preview`:
`buildSha` must be exactly 40 lowercase hexadecimal characters supplied and independently
verified by the operator at startup. `mode` must equal
`Isolated operator preview · retained evidence · generation and acquisition off`.
Both fields are required when `preview` is present; additional fields are rejected.
Old launch files without `preview` retain their prior behavior. This display metadata is
shown near the header and in root/account `healthz` responses; it is not a signature,
verified runtime measurement, authentication or authorization. The compact disclosure
states configured-operator identity and that historical replay is not fresh verification.
The launcher still disables generation and acquisition; ordinary/replay launches do not
acquire this preview label.

Focused synthetic checks without sockets:

```sh
C3_TEST_REAL_HTTP=0 node --import tsx --test --experimental-test-isolation=none tests/c3/c3-account-information*.test.ts
npm run build
npm run typecheck
```

These in-process and DOM-double checks do not establish Chromium, screen-reader,
retained-account or customer acceptance. Parent validation owns those checks.
