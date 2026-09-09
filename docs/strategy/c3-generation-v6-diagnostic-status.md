# C3 generation v6: integrity repair and bounded diagnostic

Status: implementation candidate; fresh-generation quality and successful fresh workflow remain **HOLD**. This is not customer acceptance, graph ratification, launch readiness, or permission for another model call.

## What changed

New generation uses v6: deterministic identity/reference/shape integrity is followed by a separately captured evidence check over every displayed text field. The checker partitions each field into exact consecutive text segments, including factual premises inside questions and recommendations. Canonical UTF-16 offsets are derived from the exact text rather than generated as numeric offsets. Missing, overlapping, inconsistent or unsupported coverage refuses the proposal. Semantic support remains a model judgment, not a deterministic proof of truth or human approval.

The v2–v5 interpreters and original responses remain historical contracts. v5 logic was extracted without changing its behavior. Existing v6 verifier-schema-1 records still reconstruct using schema 1, including prior refusals; new schema-2 partitions do not rewrite those records. Raw response bytes, check responses, hashes, failed-attempt state and ancestry are retained separately. Applying a proposed revision remains explicit. Notes and saved history are not silently rewritten. Exact replay mode does not establish model provenance: explicitly authored examples carry synthetic origin, distinct from historical model recordings.

## What actual testing found

A bounded authored-candidate evaluation used two account contexts and seven actual verifier calls. Three separate malformed integrity controls refused before any provider call. The seven semantic responses passed structural validation. The authored-set results were **2/3 false rejections** among the three positive cases and **0/4 unsupported acceptances** among the four negative cases. These denominators exclude the three local integrity controls. Scripted test checks are not empirical accuracy evidence.

The seeded negative cases included a hidden purchasing premise, an unsupported contracted-vendor rationale, a global-rollout mixed clause, and confusion between publication date and event date. Independent review found these were specifically detected rather than rejected only because of incidental wording. Calibration is still weak: a prospective-outcome phrase was treated inconsistently; the unseen-name control contained an unrelated generic premise; a date verdict showed temporal-scope inconsistency. The original scores were not relabeled. This small sample does not establish broad accuracy, generalization or readiness.

After the evaluation, one separately admitted fresh initial request was submitted through the real browser and local HTTP service. The external command timed out at its existing 100-second limit, returning HTTP 502. The page displayed “The brief was not prepared. Inputs kept.” Audience, intended outcome and date remained visible; no browser page errors were recorded. No model response was received by this path, no verifier or revision was dispatched, and there is no accepted fresh initial → revision → Apply → note → Save → restart → reopen proof. There was no retry, fallback, response healing or invented output.

## Accounting and boundaries

This new mission recorded nine product calls/attempts: eight received and settled checks, followed by one generation attempt with unknown final provider cost. Settled cost is USD1.0549905; the unresolved generation reservation of USD1.716187 remains charged against available headroom rather than reported as zero cost. Earlier mission costs and evidence remain separate and unchanged. Mission budget is HOLD and the live stop marker is present. Unspent budget is not automatic retry permission.

The tested product route remained OpenRouter `openai/gpt-5.6-sol` with the selected OpenAI endpoint, no fallback or extra retrieval. OpenRouter is not a product commitment: direct provider APIs, including Anthropic API and OpenAI API, remain first-class options behind the same provider boundary. Switching gateway/direct routes must not require product-logic rewrites; no route switch is authorized here.

The independently delivered UI release (PR #338) remains separate from this generation candidate. Its improved research details, concise titles, mobile layout, explicit revision application and existing saved-record behavior do not depend on declaring fresh generation ready. This candidate does not enable fresh generation in the owner's preview or deploy itself.

## Verification and review provenance

Canonical `npm run ci` on the final implementation and test bytes passed typecheck, build, all tests and the fixture gate. Separate GPT-6 Astra / openai-codex contexts reviewed the integrated contract, schema-2 change, bridge admission and empirical interpretation. A whole-delta review identified synthetic fixtures incorrectly acquiring historical-replay origin; that finding is fixed with exact admitted synthetic custody, truthful revision labels, and an initial → proposal → Apply → save → restart → reopen regression. Independent real Chromium review exercised synthetic initial, revision, explicit Apply and page reload, not durable Save. Save/restart/reopen was exercised separately by the in-process persistence regression, not that browser observation. A later narrow browser rereview closed the remaining authored-setup wording. These synthetic journeys are not fresh generation. An independent focused test rereview also closed two stale-copy assertions and a negative-index ordering false pass. Required exact-head CI and independent technical review remain prerequisites to merge; merge does not enable or deploy fresh generation.

These are independent agent technical reviews, not human approvals or different-model-family consensus. Qwen review attempts produced no usable verdict and were not counted. Private raw receipts, screenshots and logs are retained outside the repository; this document records only sanitized aggregate observations. Later empirical successes would require new retained evidence, not reinterpretation of the failed request.

current_provider_execution_authorization: none
fresh_generation_readiness: false
fresh_workflow_completed: false
customer_acceptance: false
raw_private_evidence_committed: false
production_deployment_authorized_by_this_record: false
