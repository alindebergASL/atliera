# Standing development workflow — GPT-6 Astra

## Source and attribution

The following is the user's actual statement received on 2026-09-06, copied verbatim from the Hermes conversation (session `20260906_053839_67e1c689`, user message 656431; external conversation provenance, not a GitHub signature or review). This transcription was prepared by Hermes/Astra. It is not an agent impersonation of the user, a claim that a human published a GitHub event, or a grant of new product effects.

> I am updating Atliera’s standing development workflow for GPT-6 Astra. Apply this to the current C3 work and future authorized development.
> Use GPT-6 Astra as your main model and as the preferred Codex model for substantial engineering work. This supersedes my earlier instruction to keep GPT-5.6 Sol as the coordinator. Preserve useful specialist models and working integrations.
> You own complete, working milestones. Within my existing scope, budget, and merge authority, complete implementation, testing, independent review, fixes, documentation, and merges autonomously. I review significant milestones and consequential product decisions.
> Make reasonable, reversible implementation choices and continue. Resolve routine uncertainty through source inspection, experiments, and tests. Bring me questions when my answer is necessary to settle a consequential decision. Complete all useful authorized work before escalating.
> Update conflicting active repository instructions, agent guidance, and development checks so this policy works in practice. Remove obsolete per-step human-approval requirements through supported mechanisms. Keep meaningful technical checks and truthful review evidence.
> Use Astra for coherent feature implementation, architecture, difficult debugging, integration, and synthesis across code, evidence, and the running application. Give workers clear outcomes and relevant context; avoid fragmenting tightly coupled work into excessive handoffs. Keep concise checkpoints for continuation across sessions.
> Preserve the current effective reasoning setting initially. Adjust effort to task difficulty using supported settings: routine work can use less; difficult architecture, debugging, and consequential reviews may justify more. Maximum effort is not a requirement for every task.
> Proactively delegate independent work when it can improve quality or shorten delivery. Use your MOA setup, Codex, Claude Code, GLM, Qwen Code, and OpenRouter according to the task. While workers run, continue useful coordination or implementation. Keep one integrator responsible for combined behavior and isolate concurrent edits appropriately.
> For substantial changes, automatically initiate independent reviews covering relevant functional behavior, content and evidence, UX/accessibility, and architecture/security. Give reviewers the actual revision, source material, running app, and browser or desktop tools needed to exercise it.
> Hermes/Astra and Codex/Astra provide separate contexts but share a model family. Fresh Astra reviews are valid; use GLM, Claude, or Qwen where another model family adds a useful perspective. Identify the actual model and evidence used. Every change does not need every tool or reviewer.
> Fix material defects and independently verify significant fixes. Run tests appropriate to the change and complete required checks. Broaden or repeat testing when changes, failures, or unresolved risks justify it. Backlog discretionary polish and resolve disagreements through evidence. Reviewer unanimity, perfect scores, and additional feature ideas must not continually move the finish line.
> Continue while producing useful progress. When repeated attempts stop generating new evidence, change strategy, worker, or implementation approach. Handle routine dependency problems, worker failures, merge conflicts, and permitted provider fallbacks yourself. Keep using supported Astra integrations; adopt newer execution features when the installed runtime supports them and they solve a concrete problem.
> For C3, finish the agreed account-to-meeting-preparation journey. Verify audience/outcome targeting, evidence inspection, notes, revision, reopen behavior, sparse/conflicting evidence, no-change cases, cancellation/failure, and desktop/mobile usability. Keep persistence boundaries and evidence claims truthful.

The user's follow-up (message 656435), verbatim:

> Hand me the working milestone with a concise account of what works, what was verified, remaining limitations, and decisions requiring my judgment. Measure success by usable milestones delivered, defects found in actual use, and how little routine intervention you need from me.
> Apply this policy and proceed with the current C3 milestone.

## Agent interpretation — active development guidance

- This supersedes older per-step implementation/review/fix/merge approval language for **already authorized development**, including the current C3 milestone. It does not turn historical HOLDs into completed work or customer acceptance.
- Hermes owns delivery within the existing scope, budget and merge authority. No routine human checkpoint is required. Escalate consequential unresolved product/scope/budget decisions only after completing useful authorized work.
- GPT-6 Astra is the main/preferred substantial-engineering model. Preserve the current effective reasoning setting initially (high in the current controller); use supported effort settings appropriate to the task and preserve useful specialists. This repository does not configure the controller or provider runtime.
- One integrator owns combined behavior; isolate concurrent edits. Independent means a genuinely separate review execution/context supplied with the actual revision and evidence, not another label on the implementer's own work. Same-family Astra reviews are valid and must not be described as model-family diversity or human approval.
- Technical review, exact-revision tests and required checks remain mandatory. For substantial changes cover relevant functional, content/evidence, UX/accessibility and architecture/security risks. Fix material defects, independently verify significant fixes, record real limitations, and avoid endless discretionary polish.
- Existing product-effect permissions, private-data rules, budget caps/ledgers, trust tiers, human content-review/ratification meanings and persistence boundaries remain unchanged. Engineering model use is not permission for a product/provider call. Routine merge authority alone does not authorize bypassing checks; the current supported workflow transition is specifically authorized below and must retain meaningful technical checks.

## Minimal candidate check transition

The candidate verifier implements standing build authority plus external independent technical evidence, not a per-step human approval ceremony. It keeps protected-base enforcement, path/effect classification, frozen-artifact checks, exact-head CI, proposal digests and separate effect authorization. See [governance tiers](governance-tiers.md) and [trust boundary](governance-threat-model.md).

A Tier-2/3 build uses the existing GitHub **COMMENTED review** mechanism, including on an owner-authored PR. The existing pinned account may publish a faithfully attributed independent agent report. No second human account, identity enrollment or self-APPROVED review is required. The actual report must exist before it is published. An agent publisher must explicitly identify the report's actor, actual model, implementer and reviewer contexts, relevant coverage and evidence URI. The external review's `commit_id` must equal the final candidate head; its body repeats the build proposal's decision/scope/purpose/digest and the following fields (placeholders below are not evidence):

```text
Atliera-Review-Kind: independent-technical
Atliera-Review-Actor: agent
Atliera-Implementer-Context: <actual implementation run/context>
Atliera-Reviewer-Context: <actual separate review run/context>
Atliera-Model: <actual reviewer model and execution route>
Atliera-Evidence: <absolute URI to the actual review evidence>
Atliera-Coverage: <relevant checks exercised, findings and significant-fix verification>
Atliera-Verdict: PASS
```

Publish the substantive report with its accessible evidence, not just these fields. If a human actually reviewed, use `human` and `none (human reviewer)` for the actor and model; an agent relay must still identify itself as publisher in the report. This verifier validates attribution/binding, not the semantic quality of a report, its linked contents, model execution or human identity. The integrator must examine those facts and required CI separately. A PASS comment is technical evidence only; it neither approves a product effect nor proves customer acceptance.

## Authorized adoption boundary — completion must be verified

The protected base inspected at `ebf8a9f8e040d87c0c6dcd70f1e6f8ba616bd5b5` runs verifier v2.3.2. It accepts only a committed ratified-v2 manifest bound to the candidate's own commit SHA; it does not consume external review reports. Editing a manifest to name its own new commit changes that commit again. Re-running checks or inventing a signature cannot cure this self-reference.

These candidate changes cannot make their own obsolete protected-base ceremony pass. After Hermes asked which approval the user reserved (workflow/check transition, final C3 merge, or both), Andrew replied verbatim: **"i approve everything!"** This is a direct Telegram authorization to proceed with both within the previously stated scope and budget, not a fabricated GitHub review, permission to conceal failing technical checks, or unlimited authority.

For this transition only, after freezing and independently reviewing the final governance revision and obtaining passing exact-revision technical checks, the integrator may use GitHub's supported required-status-check update to temporarily remove only the obsolete `ceremony` requirement. Retain strict up-to-date `classify` and `Typecheck, build, and test`, leave other protection settings unchanged, merge the reviewed policy PR normally, then restore `ceremony` with its new protected-base independent-technical-review semantics. Verify and retain before/after protection and merge readbacks. Do not post a fabricated success status or agent-authored human approval. If the transition fails, restore the prior requirement and report the concrete failure. No generic future bypass authority is granted.

After a genuinely authorized adoption, subsequent candidates are judged by these protected bytes. Rollback is a reviewed exact revert; no force-reset, protection change or automatic rollback bypass is granted. The final integrated head must be reported separately—this document deliberately does not try to embed its own commit SHA.
