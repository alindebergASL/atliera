# Own-Data Snapshot (H3) Slice Plan Status

Status: active (plan-only)

This runbook is the H3 slice plan — the consolidation of the `util.types.isProxy` + own-data descriptor-snapshot + (selectively) deep-freeze discipline that currently lives in three independent implementations, into `src/safety/own-data-snapshot.ts`. It is the first H-track artifact after the M3-retro freeze lift (`docs/reviews/m3-retro.md`, PR #275, merged at `a48e5ab`).

**This PR ships the plan, not the code.** `src/safety/own-data-snapshot.ts` does not exist in this PR. No call site is migrated. The implementation slice — which is the slice that actually moves code — is a separate, future PR that is gated behind (1) operator ratification of this plan and (2) the M5a-vs-M4 sequencing call that is operator-direct at the moment the implementation slice would begin. Drafting the map is not driving the road; the implementation slice is the road.

Doctrine alignment (M3 step 3a retro §3, M3 retro §3):

- The generalizable safety property the three call sites independently established is *snapshot-and-revalidate-at-entry for every control-flow field at the trust boundary*. The 3b hardening cycle (three rounds; m3-retro §2) confirmed empirically that this discipline is not inheritable across boundaries; every trust boundary must re-establish it for itself, on every value it did not produce.
- Three independent implementations of substantially the same discipline is the threshold at which consolidation can be argued on evidence rather than on prediction. This plan is the consolidation, scoped exclusively to the discipline the three call sites already share.

Scope guards (operator GO 2026-06-16, three adjustments folded into the six-item scope):

- **Plan-only.** `src/safety/own-data-snapshot.ts` is not introduced in this PR; no call site is migrated; no existing test is moved. The plan ratifies an API surface, a refusal-code rule, a per-site equivalence discipline, and a done-criterion for the future implementation slice.
- **Refactor-only (when the implementation slice eventually lands).** The implementation slice changes only how the three call sites express the snapshot discipline; it changes no behavior the call sites would render differently at any boundary except where this plan explicitly names a divergence and operator ratification chooses one branch over another. No feature, no broadening, no adjacent improvement.
- **Union, never intersection.** The consolidated primitive refuses on the union of everything any of the three sites currently refuses on; consolidation never removes a refusal. (§4 names this as a load-bearing claim.)
- **Per-site reject-path proofs stay at the sites.** The eleven enumerated reject paths (M3 step 3a retro §3) plus the four 3b hardening-cycle additions remain as per-site regression suites; the implementation slice does not relocate them into a single primitive-level test file. (§7.)
- **Equivalence statements per call site.** The implementation slice cannot land without an explicit per-site before/after equivalence statement: "the consolidated primitive produces identical refusal behavior to the current site-local implementation on these inputs, including these edge cases the current tests don't cover." Any current divergence is surfaced for operator ratification, not silently normalized. (§3.)

Operator-decision discipline: every divergence in §3 is an item the operator may ratify to either branch. The plan does not silently pick; it surfaces and recommends, and the operator's ratification on each item is what the implementation slice migrates against.

Artifacts (with commit provenance — Adjustment "commit provenance on the three sites"):

- **Call site 1 — executor (write boundary).** `src/workshop/proposal-durable-graph-write-execution.ts`. Snapshot helpers `snapshotPlainRecord` and `snapshotArray` shipped in **PR #271 (M3 step 3a, squash-merged as `91b7064`)**. The executor was the first call site of the discipline; the M3 step 3a retro §2 records the three executor-side hardening passes that produced its current shape (suffix-drift; NaN-expiry snapshot+revalidate; Proxy-trap refusal before reflection).
- **Call site 2 — reader (read boundary).** `src/workshop/durable-graph-snapshots-reader.ts`. Snapshot helper `snapshotPlainRecord` and `deepFreeze` helper shipped in **PR #274 (M3 step 3b, squash-merged as `b2b7a09`)**. The reader added `deepFreeze` on the validated bundle as a 3b-specific addition the executor does not need (the executor consumes records, doesn't return one).
- **Call site 3 — render-side composer (compose boundary).** `src/workshop/durable-state-render.ts`. Snapshot helpers `snapshotPlainOwnData` and `snapshotPlainArray` shipped across the **3b hardening cycle on PR #274** (pre-merge heads `5ed3762` → `f281ac0` → `1150dc7` → `f895fb4`, squash-merged as `b2b7a09`). The render-side composer added `snapshotPlainArray` in Round 2 to refuse accessor-backed array indices that `Array.isArray + isProxy` does not catch; the root-`readerResult` snapshot at compose entry was Round 3.
- **Plan PR (this artifact).** `docs/runbooks/own-data-snapshot-h3-slice-plan-status.md` + INDEX entry + safety contract test.

Boundary markers (this plan authorizes nothing; even the implementation slice it gates on is refactor-only):

- current_effective_authorization: none
- authorizes_provider_call: false
- authorizes_private_evidence_read: false
- authorizes_graph_ingestion: false
- graph_ingestion_performed: false
- authorizes_durable_write_execution: false
- durable_write_execution_performed: false
- durable_writes_performed: false
- production_writes: false
- readiness_claim: false
- provider_calls_executed_by_this_slice: 0
- provider_spend_by_this_slice: false
- private_evidence_read_by_this_slice: false
- durable_writes_by_this_slice: false
- production_writes_by_this_slice: false
- deployment_executed_by_this_slice: false
- product_readiness_claim: false
- production_readiness_claim: false
- launch_readiness_claim: false
- l0_effect_observed_by_this_slice: false
- introduces_new_source_module: false (this PR creates no `src/` file)
- introduces_new_runtime_behavior: false (this PR is documentation + safety contract test only)

## 1. Proposed consolidated primitive — API surface

Target file (when the implementation slice eventually lands): `src/safety/own-data-snapshot.ts`. The shape below is drawn from the three existing implementations; it is the union of their capabilities, not a redesign.

Proposed exports:

- `snapshotPlainOwnData(value: unknown, label: string): Readonly<Record<string, unknown>>` — descriptor-snapshot a single plain own-data object. Refuses Proxy-backed input, non-object/null/Array input, symbol-keyed input, unsafe-key input (`__proto__`/`constructor`/`prototype`), and accessor-backed properties. Returns a frozen plain object built from descriptor `value` fields. Wraps `Object.getOwnPropertyDescriptors` in try/catch (the reader's belt-and-suspenders for hostile descriptor traps).
- `snapshotPlainArray(value: unknown, label: string, options?: { maxLength?: number }): readonly unknown[]` — descriptor-snapshot an array so accessor-backed indices are refused without firing. Refuses Proxy-backed input, non-array input, symbol-keyed input on the array itself, length read via descriptor (never `value.length` directly — see §3 Q3), accessor-backed indices, missing indices. Optional `maxLength` (call-site choice). Returns a frozen array.
- `deepFreeze<T>(value: T): T` — recursively freeze a plain own-data value. Operates only on objects and arrays already vouched-for as plain own-data (does not invoke getters; does not snapshot). Used by call sites that return a validated value and want it sealed against post-validation mutation (current sole user: reader).
- `OwnDataSnapshotRefusal extends Error` — typed refusal class. Carries `code: OwnDataSnapshotRefusalCode` and `detail: string`. Call sites catch this and translate to their own existing typed refusals (executor → `WorkshopProposalDurableWriteRefusalCode`; reader → `WorkshopProposalDurableSnapshotsReaderRefusalCode`; render → `DurableStateRenderRefusal`). The consolidated primitive does NOT impose its codes on the call sites; the call sites preserve their existing surfaced refusal codes for audit-trail compatibility.
- `OwnDataSnapshotRefusalCode` — the union of refusal conditions any of the three sites currently checks. Enumerated in §2 below.

What this surface deliberately does NOT include:

- No `requireString`/`requireClosedFalse`-style field validators. Those are application-level validation, not snapshot primitives, and live at the call sites. (Avoids §9 scope creep.)
- No application-level safety markers (`provenance_status`, `trust_label`, idempotency-key suffix). Those belong to the call sites' contracts, not to the snapshot module.
- No I/O, no network, no env reads, no provider SDK. The primitive is pure.

## 2. Consolidated refusal codes — the union surface

Per Adjustment 2 (union-never-intersection): the consolidated primitive's refusal code enumeration is the union of every check any of the three sites currently performs. Stated as a load-bearing claim that the safety contract test greps for:

> **Union, never intersection.** The consolidated primitive refuses on the union of everything any of the three sites currently refuses on. Consolidation never removes a refusal. If site A checks a condition site B does not, the consolidated primitive checks it for both. The cost asymmetry justifies this: a false rejection of a hostile-looking-but-benign artifact is loud and caught in test; a dropped refusal is silent and is exactly the failure mode the eleven enumerated reject paths exist to prevent.

Proposed `OwnDataSnapshotRefusalCode` enumeration (the union of what executor/reader/render currently refuse on):

- `proxy_backed` — input is a Proxy (all three sites refuse; first check; never invokes any trap).
- `not_plain_own_data` — input is null, undefined, non-object, or an Array when an object was expected (all three sites refuse).
- `descriptors_unavailable` — `Object.getOwnPropertyDescriptors` threw on the input (currently only the reader catches this; union rule keeps it).
- `symbol_keyed` — input carries symbol-keyed own properties (all three sites refuse on objects; only render refuses on arrays — union rule extends array refusal to consolidated primitive).
- `unsafe_key` — input carries `__proto__`, `constructor`, or `prototype` as own keys (all three sites refuse).
- `accessor_backed` — a key (or array index) has a descriptor with no `value` (accessor get/set or non-enumerable) (all three sites refuse).
- `not_array` — `snapshotPlainArray` invoked on a non-array (all three sites that have an array helper refuse; reader has no array helper, so this is new for the reader's call sites if any).
- `array_length_invalid` — length is not a non-negative integer when read via descriptor (executor uses `Number.isSafeInteger`; render uses `Number.isInteger` — see §3 Q5; consolidated primitive uses the stricter `Number.isSafeInteger`).
- `array_length_exceeds_max` — when `maxLength` is provided and length exceeds it (only executor checks this currently; union rule keeps it as an opt-in).
- `array_index_missing` — `getOwnPropertyDescriptor(arr, i)` returned undefined for `0 ≤ i < length` (only render currently checks this as a distinct condition; executor merges it with accessor-backed; union rule keeps the granular separation — see §3 Q9).

## 3. Per-site equivalence questions — the ratification surface

Per Adjustment 1: the three implementations grew independently and differ in ways nobody has enumerated until now. Each item below is a divergence the plan surfaces explicitly for operator ratification. The implementation slice MUST NOT silently normalize any of these; each requires a yes/no/which-branch ratification.

For each item: **(C)** = current behavior at each site; **(P)** = plan's recommendation, with rationale; **(R)** = ratification needed.

### Q1. Order: descriptor enumeration vs symbol-key check

- **(C)** Executor and reader: enumerate descriptors first, then check `getOwnPropertySymbols`. Render: check `getOwnPropertySymbols` first, then enumerate descriptors.
- **(P)** Adopt the render order (symbols first). Rationale: refusing a symbol-keyed object requires only one read (`getOwnPropertySymbols`); refusing via descriptors requires the full descriptor enumeration first. Earlier refusal is a defense-in-depth win on hostile inputs. Functionally equivalent on legitimate inputs.
- **(R)** Operator ratifies symbols-first OR descriptors-first.

### Q2. `Object.getOwnPropertyDescriptors` try/catch wrapping

- **(C)** Reader wraps in try/catch, refuses `row_not_plain_own_data` with detail "descriptors unavailable". Executor and render call directly (uncaught throw propagates).
- **(P)** Wrap in try/catch in the consolidated primitive; refuse as `descriptors_unavailable`. Rationale: union rule. A sufficiently hostile descriptor trap (on a non-Proxy object with strange prototype chain manipulation) could in principle throw; the reader's belt-and-suspenders is the union-safe choice. The executor and render are not harmed by adopting this (a normal input never throws here).
- **(R)** Operator ratifies wrap OR direct.

### Q3. Array length read: `value.length` vs descriptor

- **(C)** Executor: reads `value.length` directly. Render: reads length via `Object.getOwnPropertyDescriptor(value, "length")` and checks `"value" in descriptor`.
- **(P)** Descriptor read (the render approach). Rationale: `value.length` on a non-Proxy array with a getter installed on `"length"` will fire the getter — exactly the kind of accessor-backed-index gap the render's Round-2 hardening sealed for `"0"`. The executor's current approach has this subtle gap; it has not been exploited because the executor's arming/contract inputs are never arrays at the top level, but the consolidated primitive must not paper over the difference. Functionally equivalent on legitimate arrays.
- **(R)** Operator ratifies descriptor-read OR direct-read. Recommendation is strong: descriptor-read closes a real gap.

### Q4. Symbol-key check on arrays

- **(C)** Render refuses symbol-keyed arrays. Executor does not check. Reader has no array helper.
- **(P)** Refuse symbol-keyed arrays in the consolidated primitive. Union rule. No legitimate array carries symbol keys.
- **(R)** Operator ratifies extending the check to all sites OR keeping executor's array helper without this check (the latter is the intersection branch and contradicts §2's union rule).

### Q5. Length integer-validation: `Number.isSafeInteger` vs `Number.isInteger`

- **(C)** Executor uses `Number.isSafeInteger` (refuses lengths above 2^53 − 1). Render uses `Number.isInteger` (accepts integer-valued floats up to `Number.MAX_VALUE`).
- **(P)** `Number.isSafeInteger` (the stricter check). Rationale: union rule. Above `Number.MAX_SAFE_INTEGER`, integer arithmetic loses precision; an array longer than that is operationally indistinguishable from a corrupted input. Functionally equivalent on legitimate arrays.
- **(R)** Operator ratifies stricter OR looser.

### Q6. `maxLength` parameter

- **(C)** Executor's `snapshotArray` takes a `maxLength` parameter (slice-specific cap). Render's `snapshotPlainArray` takes no cap.
- **(P)** Consolidated primitive accepts `maxLength` as an optional parameter (`options.maxLength`); default unbounded. Call sites pass their own cap when they need defense-in-depth against memory exhaustion. Equivalent on legitimate inputs at all sites; preserves executor's existing protection at its call sites; gives render the same option without forcing it.
- **(R)** Operator ratifies optional-cap OR no-cap (force unbounded everywhere).

### Q7. Missing-index vs accessor-backed-index: granular vs merged

- **(C)** Render separates: `[i] is missing` (descriptor is `undefined`) vs `[i] must be a plain own-data value (no accessors)` (descriptor exists but lacks `value`). Executor merges both into one: "must contain only enumerable own data items".
- **(P)** Keep separate (render's granularity). Rationale: debuggability. Different shapes of bad input deserve different refusal codes; surfaced refusal codes go into the audit trail. Functionally equivalent: both still refuse.
- **(R)** Operator ratifies granular OR merged.

### Q8. Per-field accessor refusal message: specific vs generic

- **(C)** Executor and reader: generic "must be a plain own-data object" (does not name the field with the accessor). Render: "${label}.${key} must be a plain own-data value (no accessors)" (names the field).
- **(P)** Specific (render's form). Debuggability. Adds a key name to the refusal message; no behavior change.
- **(R)** Operator ratifies specific OR generic.

### Q9. Unsafe-key refusal message: with key name vs without

- **(C)** Executor: "contains unsafe key" (no name). Reader and render: "contains unsafe key ${key}" (names the key).
- **(P)** Include the key name. Debuggability. No behavior change.
- **(R)** Operator ratifies with-name OR without.

### Q10. Refusal class typing

- **(C)** Executor throws raw `Error`. Reader throws typed `RowRefusal` (with `code`). Render throws typed `DurableStateRenderRefusal` (with `reason`).
- **(P)** Consolidated primitive throws typed `OwnDataSnapshotRefusal` (with `code: OwnDataSnapshotRefusalCode` and `detail: string`). Call sites catch this and translate to their own existing typed refusal class with their own existing refusal code. The executor stops throwing raw `Error` from the snapshot path and instead catches `OwnDataSnapshotRefusal` and re-throws its own `Error` with the existing refusal codes the call sites already enumerate (`arming_*`, `contract_*`, `approvalPacket_*`). The reader continues to translate to `row_*` codes; the render continues to translate to `DurableStateRenderRefusal`. The call sites' surfaced refusal codes are preserved for audit-trail compatibility.
- **(R)** Operator ratifies typed-primitive-with-call-site-translation OR raw-Error OR primitive-imposes-its-codes-on-call-sites.

### Q11. `deepFreeze` adoption: reader only vs reader + executor

- **(C)** Reader uses `deepFreeze` to seal the validated graph bundle before returning. Executor does not (it consumes records; does not return a snapshot-rooted structure to a caller). Render does not (it composes the result freshly at compose entry).
- **(P)** Expose `deepFreeze` as a primitive in the consolidated module. The reader keeps using it. The executor does NOT adopt it in the implementation slice (it has no equivalent return surface). The render does NOT adopt it. Rationale: each call site uses what it needs; the primitive exists; no behavior change at any site.
- **(R)** Operator ratifies reader-only-deepFreeze OR extends-to-other-sites (the latter would require naming a return surface at those sites; recommendation is reader-only).

### Q12. Per-level explicit snapshot vs single-call deep-snapshot

- **(C)** All three sites use per-level explicit snapshot — they call `snapshotPlainRecord` on the root, then again on `root.boundaries`, then on each nested record they consume. None of the three sites has a `snapshotDeep`-style helper that recursively snapshots a whole tree in one call.
- **(P)** Keep per-level explicit. The discipline of `snapshot-and-revalidate-at-entry-for-every-control-flow-field` is empirically what the 3b hardening cycle proved is the right granularity (Round 2 / 3 closed exactly the cases a recursive deep-snapshot would have hidden behind a single call). A recursive snapshot tempts call sites to snapshot once at entry and trust the result downstream — exactly the inheritance assumption m3-retro §2 names as wrong. The primitive deliberately does NOT offer `snapshotDeep`.
- **(R)** Operator ratifies per-level-only OR adding-recursive-snapshot (recommendation is strong: per-level only).

### Q13. Empty / null / undefined edges (sanity check)

- **(C)** All three sites: refuse `null`, refuse `undefined`, refuse `[]` (when an object was expected), accept `{}` (empty object snapshot — no fields), accept `[]` (when an array was expected — empty array snapshot).
- **(P)** Consolidated primitive: same. No divergence to ratify; recorded for completeness so the equivalence statement covers the edge.
- **(R)** No ratification needed.

## 4. Union-never-intersection rule (load-bearing claim)

Already stated in §2 as the load-bearing claim. Repeated here so the safety contract test has a single greppable surface:

> **Union, never intersection.** The consolidated own-data-snapshot primitive refuses on the union of everything any of the three call sites currently refuses on. Consolidation never removes a refusal. If site A checks a condition site B does not, the consolidated primitive checks it for both.

The safety contract test for this plan asserts the runbook contains this exact sentence verbatim. The implementation-slice's safety contract test (which lands with `src/safety/own-data-snapshot.ts`) asserts the same sentence is present in the consolidated module's header comment.

## 5. Migration plan per call site

When the implementation slice eventually lands, each call site migrates in this shape:

### Executor (`src/workshop/proposal-durable-graph-write-execution.ts`)

- Import `snapshotPlainOwnData`, `snapshotPlainArray`, `OwnDataSnapshotRefusal` from `src/safety/own-data-snapshot.ts`.
- Replace the local `snapshotPlainRecord` calls with `snapshotPlainOwnData`. Wrap in try/catch; translate `OwnDataSnapshotRefusal` to the executor's existing `WorkshopProposalDurableWriteRefusalCode` set (`arming_kind_invalid`, `contract_kind_invalid`, `approvalPacket_kind_invalid`, etc. — the existing per-context codes are preserved).
- Replace the local `snapshotArray` calls with `snapshotPlainArray(value, label, { maxLength: <site-specific cap> })`. Translate refusals identically.
- Per-site equivalence statement required at the implementation-slice PR: "the executor's behavior on the eleven enumerated reject paths (3a retro §3) is unchanged."

### Reader (`src/workshop/durable-graph-snapshots-reader.ts`)

- Import `snapshotPlainOwnData`, `deepFreeze`, `OwnDataSnapshotRefusal`.
- Replace the local `snapshotPlainRecord` with `snapshotPlainOwnData`; translate to `WorkshopProposalDurableSnapshotsReaderRefusalCode` (`row_proxy_backed`, `row_not_plain_own_data`, `row_symbol_keyed`, `row_unsafe_key`, etc.).
- Replace the local `deepFreeze` with the imported one.
- The reader currently has no array helper; the implementation slice introduces `snapshotPlainArray` at the read boundary if and only if a per-site equivalence question (not in this plan; would be a follow-up if surfaced) shows the reader needs one. Recommendation in this plan: the reader does NOT add an array helper as part of the H3 migration; that would be a behavior change outside the refactor scope.
- Per-site equivalence statement: "the reader's behavior on its enumerated refusal codes (twelve of them after `row_target_store_invalid` was removed) is unchanged."

### Render-side composer (`src/workshop/durable-state-render.ts`)

- Import `snapshotPlainOwnData`, `snapshotPlainArray`, `OwnDataSnapshotRefusal`.
- Replace the local helpers; translate to `DurableStateRenderRefusal`.
- Per-site equivalence statement: "the render-side composer's behavior on the four 3b-hardening-cycle hostile probes plus the rejection-card never-emits-`trust-verified` invariant is unchanged."

The implementation slice PR contains the three equivalence statements as explicit prose in its description, each backed by the per-site regression suite running unchanged.

## 6. Negative-control automation framing — the seed fixtures

The roadmap's H3 entry already names the framing: "every doc-contract test ships a violating fixture it must fail on." The seeds for that fixture set are the four hostile-probe shapes the 3b hardening cycle discovered, lifted into a shared fixture surface:

- **Probe 1 (Round 1):** post-read nested mutation. A reader-returned row whose nested `bundle.account_objects[i].provenance_status` is flipped to `"verified"` after the read. Fixture: the consolidated `deepFreeze` blocks the mutation.
- **Probe 2 (Round 1):** getter-backed decision artifact. A non-Proxy decision artifact whose `kind` / `schema_version` are present but whose `decisions[0]` (or another field) is a `Proxy` or accessor-backed. Fixture: the consolidated `snapshotPlainOwnData` refuses without firing the getter.
- **Probe 3 (Round 2):** accessor-backed array index. A non-Proxy array with `Object.defineProperty(arr, "0", { get() { ... } })`. Fixture: the consolidated `snapshotPlainArray` refuses without firing the getter.
- **Probe 4 (Round 3):** root-object getter. A non-Proxy `readerResult`-shaped object with a getter installed on `.rows`. Fixture: the consolidated `snapshotPlainOwnData`, applied at the root, refuses without firing the getter.

The implementation slice's safety contract test ships these four fixtures as `tests/safety/fixtures/own-data-snapshot/` (or similar) and asserts each refuses at the primitive boundary. Per §7, the same fixtures are ALSO exercised at each call site through the primitive — the primitive-level test is necessary but not sufficient.

## 7. Per-site reject-path proofs — Adjustment 3, the load-bearing wiring property

Adjustment 3, stated as load-bearing:

> The property that actually matters post-migration is not "the primitive refuses these shapes." It is "each of the three call sites, now routed through the primitive, still refuses these shapes at its own boundary." A primitive that fail-closes in isolation but is wired into a call site such that the refusal is swallowed or bypassed upstream is broken in exactly the failure mode the eleven paths exist to prevent.

The implementation slice's done-criterion therefore requires the four seed fixtures from §6 plus the eleven enumerated reject paths (3a retro §3) to fail-closed at EACH of the three call sites THROUGH the consolidated primitive — proven by the existing per-site regression suites continuing to exercise the boundary:

- `tests/workshop/proposal-durable-graph-write-execution.test.ts` (executor) — unchanged structure; assertions still attach to the executor's surfaced refusal codes.
- `tests/safety/proposal-durable-state-render-contract.test.ts` (render-side composer) — unchanged structure; assertions still attach to `DurableStateRenderRefusal`.
- Per-site reader tests — unchanged.

The implementation slice may ADD a primitive-level test file (`tests/safety/own-data-snapshot.test.ts`), but it may NOT relocate per-site reject-path proofs into that file. The reject-path proofs stay attached to the sites where the rejection has to happen.

## 8. Done-criterion for the implementation slice (this plan ratifies the criterion)

The implementation slice PR is done when:

1. `src/safety/own-data-snapshot.ts` exists with the API surface ratified in §1 (with whichever branch the operator chose for each Q in §3).
2. The consolidated module's header comment includes the union-never-intersection sentence (verbatim per §4).
3. All three call sites import from `src/safety/own-data-snapshot.ts` and remove their local helpers.
4. Each call site has a per-site equivalence statement in the implementation slice PR description, attesting that its behavior on its existing per-site refusal codes is unchanged.
5. The four seed fixtures from §6 are present under a shared safety-fixtures path.
6. The four seed fixtures plus the eleven enumerated reject paths fail-closed at EACH of the three call sites through the consolidated primitive (per-site regression suites continue to exercise the boundary; not relocated).
7. The full test suite baseline (1,253 at this plan PR head; whatever the count is at the implementation-slice PR head) does not regress.
8. Forbidden-phrases lint clean. Typecheck clean. No new provider SDK / network / env / I/O imports in the consolidated module.

## 9. Non-goals — the "while I'm here" guard

The implementation slice is refactor-only. Explicitly NOT in scope at any point in the H3 implementation:

- No widening of any call site's surfaced refusal-code set beyond what its current per-site regression suite already exercises (Adjustment 1: union is the primitive's surface; call sites preserve their existing codes).
- No new validation at any call site that the call site does not currently perform.
- No new application-level helper (`requireString`, `requireClosedFalse`, idempotency-key shape check, etc.) lifted into the consolidated module.
- No `snapshotDeep` recursive helper (Q12).
- No reader array helper (the reader does not currently have one; adding one is a behavior change).
- No provider call, no graph mutation, no production write, no readiness claim — H3 implementation touches none of these surfaces.
- No adjacent improvement on the reader, executor, or render-side composer (the "while I'm here" temptation; explicitly out of scope).
- No M5a-anticipating change. M5a's eventual durable-state surface may use the consolidated primitive; the implementation slice does not preempt M5a's contract.

## 10. Gating — what authorizes the implementation slice to begin

The implementation slice is correctly gated behind:

- **Operator ratification of this plan.** Specifically, ratification of each Q in §3 (which branch the consolidated primitive adopts), of the union-never-intersection rule in §4, and of the per-site reject-path discipline in §7.
- **The M5a-vs-M4 sequencing decision the M3 retro recorded as closed for the M3-to-M5a step.** The implementation slice does not preempt that decision; it lands when the operator picks it up against the live next-slice queue, not because this plan landed first. Drafting the plan is not driving the road; the M3-retro's M5a-next disposition stays the default and the implementation slice's start time is operator-direct against the queue.

Both gates are operator-direct. This plan PR does not authorize either.

## What this plan PR ships (verification surface)

- This runbook.
- INDEX entry registering this runbook as `active` and naming its plan-only scope.
- Safety contract test (`tests/safety/own-data-snapshot-h3-slice-plan-contract.test.ts`) locking the load-bearing claims in greppable form: union-never-intersection sentence is verbatim; the three call sites and their commit-provenance anchors are named; the boundary markers are present; the implementation-slice gates in §10 are named; the non-goals list in §9 includes the "while I'm here" guard.

The safety contract test does NOT test the consolidated primitive (it does not exist in this PR). It tests the runbook's structure and the doctrine the runbook commits the implementation slice to.
