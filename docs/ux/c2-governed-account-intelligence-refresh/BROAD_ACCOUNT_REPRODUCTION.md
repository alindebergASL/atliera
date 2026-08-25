# C2 broad-account finding reproduction

Status: reproduced independently at exact head `88ddcebea64b88e0858c92da52ed3eda8c1f2ab7`, tree `3221efd1b20c963e42ec3fa06c775450f70925f6`.

No research, provider call, or repository mutation preceded this reproduction.

## 1. Renderer discards collection members — confirmed

`src/account-intelligence/account-home.ts:170-173` selects only:

- `establishedContext[0]`
- `meaningfullyChanged[0]`
- `whyChangeMayMatter[0]`
- `stillOpenQuestions[0]`

The committed Utah proposal contains:

- established context: 5
- meaningfully changed: 8
- why change may matter: 4
- still-open questions: 4

FedEx contains 9 / 6 / 4 / 5 respectively.

## 2. Utah coverage is narrow — confirmed

`docs/ux/c2-governed-account-intelligence-refresh/data/university-of-utah-validated-proposal.json` records:

- covered: 2
- partial: 6
- gap: 2

Its thesis is primarily the three-year H.B. 265/Responsible AI reinvestment frame, rather than a broad institution-first account picture.

## 3. Evidence-ID validity is not semantic entailment — confirmed

`src/account-intelligence/proposal.ts:182-211` verifies evidence IDs, entity binding, hostile-source state, secondary-source labels, conflict flags, and funding qualifier retention. It does not prove that generated prose is entailed by an excerpt.

A read-only adversarial probe changed an established statement to:

> Harbor Transit acquired an unrelated pharmaceutical company in Europe.

while retaining the real fixture evidence ID. `snapshotAccountIntelligenceProposal` accepted it as `source-backed fact`.

## 4. Request can propose and authorize source trust — confirmed

At this head, `trustedOfficialHosts` and `primaryAccountEntityId` are fields inside `AccountResearchRequest.admittedContext` (`src/account-intelligence/contracts.ts`, `research-plan.ts`). `admitAccountResearch` consumes that same request policy. No separately supplied controller/authorization boundary exists.

## 5. PR top identity is stale — confirmed

PR #315’s top `## Exact identity` block still names:

- head `12482d918ee23e54609ce4d02b70bfa5f7d66ce2`
- tree `346922cbcf18bbe87f9ea77b47d96f47b5df2822`
- scope 47 files / 8,419 insertions / 4 deletions

A later repair section names the actual head `88ddcebea64b88e0858c92da52ed3eda8c1f2ab7` and tree `3221efd1b20c963e42ec3fa06c775450f70925f6`.

## 6. No completed formal GitHub review verdict — confirmed

`gh pr view 315 --json reviews` returned an empty review list at this head. Prior delegated reports are local review artifacts, not completed GitHub review verdicts.

## Disposition

All six findings are correct. The correction must not claim deterministic semantic entailment for model paraphrases; request-supplied candidate domains must be separated from an independently admitted local/test research policy; broadening requires new bounded public evidence rather than UI-only expansion.

## Foundation stabilization checkpoint

The preserved broad fixture was admitted locally without retrieval, provider execution, persistence, or other effects. Four retained records were excluded rather than granted false authority: one University-hosted URL bound to the separate USHE entity, plus three title/content records that duplicated unrelated canonical URLs.

Admitted corpus status:

| Account | Sources | Exact excerpts | Taxonomy coverage | Explicit gap |
| --- | ---: | ---: | ---: | --- |
| University of Utah | 10 | 33 | 9/10 | `procurement` |
| FedEx Corporation | 9 | 30 | 9/10 | `gaps_contradictions` |

The admitted Utah corpus is broader than H.B. 265. It retains:

- broader AI ecosystem context through Redtail, CHPC, and the Utah Health AI Vault;
- financial context through the annual financial report, strategic reinvestment materials, public-investment statements, and sponsored-project scale;
- governance context through Utah Board of Higher Education minutes and USHE initiative material;
- explicit entity boundaries between the University account and the separate USHE governing body.

Procurement is **not** currently supported at excerpt level after the URL/content-mismatched records were excluded, so it remains a recorded gap. No replacement research or URL retrieval was performed in this checkpoint. FedEx likewise retains an explicit `gaps_contradictions` gap rather than receiving unsupported coverage.

This remains an intermediate C2 foundation checkpoint. Broad model proposals, the final broad Account Home renderer, visual proof, user readiness, and meeting preparation remain incomplete.
