# Agentic AI Usage Baseline

Status: current bounded baseline for the Atliera app and validation substrate after the broader live product preview batch status. This document records what is materially agentic today, what is only a future-facing contract, and what remains absent from the default product/runtime path.

## Baseline classification

- runtime_agentic_ai_usage: gated-zero-default.
- validation_agentic_ai_usage: bounded-approved-slices.
- agentic_platform_maturity: foundation-layer.
- autonomous_agent_behavior: absent.

Interpretation: Atliera has some agent-facing seams, but default runtime agentic execution is absent and unapproved. The repository has model-provider contracts, prompt contracts, AgentRun records, activation gates, cost-ledger evidence, graph validation, quality gates, manifest/bootstrap packaging, and product Workshop rendering seams. The normal app/runtime path does not yet run an autonomous agent.

## Current runtime behavior

- Normal app boot and Workshop rendering use 0 default-path model/provider calls.
- Normal app boot and Workshop rendering use 0 autonomous tool actions.
- Runtime Workshop preview remains fake-mode/no-write and reports `providerCallsMade: 0` with `productionWrites: false`.
- No app server or worker path currently invokes `ModelProvider.generate`.
- No source call sites currently invoke `ModelAdapter.propose`.
- The only `.generate(` source call sites are the provider-validation harness, `src/model/provider-validation.ts`, and the fail-closed Codex-auth bridge adapter, `src/model/codex-auth-provider-bridge.ts`; neither is a default runtime app path.
- No source path constructs `ExternalCommandModelProvider` as a default runtime dependency.
- No resident autonomous shell agent is installed or required by the app.
- No worker polling loop currently dequeues jobs to execute model/tool plans.
- runtime/model-mode integration: none.

## Current validation behavior

Recent `owl-alpha` usage was limited to explicitly approved validation runs. Those runs exercised provider-boundary and product-preview slices under merged approval/status docs, private evidence retention, activation gates, cost ledgers, sanitized graph outputs, manifest/bootstrap verification, and no-spend / no-paid-fallback constraints. The no-spend batch assessment record is `live-product-preview-broader-batch-usefulness-assessment.md`; it preserves `approves_expansion_or_comparison: false` and provider calls made 0 in the assessment path.

That evidence is validation evidence, not default app behavior. It shows bounded approved provider calls can traverse the validation substrate and feed the existing graph-backed Workshop surface. It does not make Atliera's normal runtime materially agentic yet.

`ExternalCommandModelProvider` is a sealed validation seam for real providers. It isolates provider transport behind an external command and keeps provider SDKs, credentials, raw provider bodies, prompts, and wrapper logs out of the application source and committed repository evidence.

`CodexAuthModelProviderBridge` is a fail-closed bridge gate for the future GPT-5.5 comparison path. It requires an injected model-only Codex-auth transport plus explicit no-tools/no-shell/no-file/no-search/no-plugin/no-retrieval guarantees before it can call that transport. It is not wired into the default app runtime path and does not by itself execute provider calls.

## AgentRun and prompt-contract status

`AgentRunRecord` is orchestration evidence, not a running autonomous loop. It can record and validate a run linkage for packaging/manifest evidence, but it does not by itself poll queues, plan tasks, call tools, call providers, write production data, or operate a resident agent.

Prompt contracts define allowed operation shapes and safety obligations for future proposals. They are not live prompt execution in the product runtime path.

## Tool, search, and side-effect boundaries

- tools_or_plugins_requested: false.
- online_model_variant_requested: false.
- web_search_requested: false.
- provider_or_model_comparison: false.
- production writes: none.
- paid fallback: none.
- runtime/model-mode integration: none.
- launch_readiness_claim: false.
- product_readiness_claim: false.
- production_readiness_claim: false.
- broad_model_quality_claim: false.
- multi_account_readiness_claim: false.

## Practical scorecard

- Product runtime agentic AI: 1/10. The product surface is deterministic and graph-backed, with fake/no-provider default Workshop preview paths.
- Validation/lab agentic AI: 4/10. Real bounded provider calls have been exercised under explicit approvals, but only as validation slices.
- Agentic platform maturity: 5/10. Contracts and seams exist, but autonomous execution is not wired into the app path.
- Autonomous agent behavior: 0/10. No planner loop, tool loop, web-search loop, production-writing agent, or resident runtime agent is present.

## Next-step boundary

Any future provider call, tool/web-search enablement, autonomous loop, production write, deployment, or runtime/model-mode integration needs a separate reviewed change with an explicit approval packet, safety tests, sanitized status follow-up, and no readiness overclaim.
