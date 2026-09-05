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
- Normal app boot, Workshop rendering, and the default C3 launch do not invoke `ModelProvider.generate`; C3 defaults to a disabled provider.
- No source call sites currently invoke `ModelAdapter.propose`.
- The only `.propose(` source call site is the C2-01 review-only `AccountIntelligenceProviderBoundary` invocation in `src/account-intelligence/refresh.ts`; it requires an explicitly injected, single-use provider boundary and is not wired to an app server, worker, customer route, persistence path, or default runtime.
- The `.generate(` source call sites are the provider-validation harness, `src/model/provider-validation.ts`; the fail-closed Codex-auth bridge adapter, `src/model/codex-auth-provider-bridge.ts`; the lab/test-only runtime proof harness, `src/validation/live-provider-moderate-proof-verifier.ts`; the review-only C2 boundary, `src/account-intelligence/provider.ts`; and the C3 local service's explicitly injected provider call. C2 snapshots only its local boundary configuration. Provider behavior remains an external mutable effect; C2 validates the response, enforces output/cost/shape limits, and reports provider storage/tool/network behavior as unestablished. None is a default provider-enabled app path.
- C3 is a separate optional operator-command local prototype, not the normal Workshop. It is disabled by default, loopback-only, session-memory-only, accepts no command/path from HTTP, performs no source retrieval or durable write, and requires an operator to configure one local executable. That wrapper owns any credentials in private files and must preserve external reservation/receipt accounting; repository code does not receive provider secrets or claim remote cancellation.
- No source path constructs `ExternalCommandModelProvider` as a default runtime dependency.
- No resident autonomous shell agent is installed or required by the app.
- No worker polling loop currently dequeues jobs to execute model/tool plans.
- runtime/model-mode integration: optional local C3 prototype only; normal Workshop and default C3 remain zero-provider.

## Current validation behavior

Recent `owl-alpha` usage was limited to explicitly approved validation runs. Those runs exercised provider-boundary and product-preview slices under merged approval/status docs, private evidence retention, activation gates, cost ledgers, sanitized graph outputs, manifest/bootstrap verification, and no-spend / no-paid-fallback constraints. The no-spend batch assessment record is `live-product-preview-broader-batch-usefulness-assessment.md`; it preserves `approves_expansion_or_comparison: false` and provider calls made 0 in the assessment path.

That evidence is validation evidence, not default app behavior. It shows bounded approved provider calls can traverse the validation substrate and feed the existing graph-backed Workshop surface. It does not make Atliera's normal runtime materially agentic yet.

C2-01 adds one explicitly authorized, review-only multi-account proposal slice. Its provider boundary is single-use per account, zero-tool, non-durable, and absent from default application composition. The resulting Utah and FedEx outputs remain proposed/unreviewed review evidence; they do not change runtime/model-mode integration, launch readiness, production readiness, or autonomous behavior.

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
- runtime/model-mode integration: optional local C3 prototype only; disabled by default.
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

Any provider path beyond the reviewed optional local C3 command seam, or any tool/web-search enablement, autonomous loop, production write, deployment, or broader runtime/model-mode integration needs a separate reviewed change with explicit authority, safety tests, sanitized status follow-up, and no readiness overclaim.
