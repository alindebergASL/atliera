import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(
  REPO_ROOT,
  "docs",
  "runbooks",
  "live-provider-broader-batch-workshop-preview-usefulness-assessment.md",
);
const STATUS_DOC = join(
  REPO_ROOT,
  "docs",
  "runbooks",
  "live-provider-broader-batch-workshop-preview-status.md",
);
const INPUT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-provider-broader-batch-workshop-preview-20260605a-usefulness-input.json",
);
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-provider-broader-batch-workshop-preview-20260605a-usefulness-assessment.json",
);

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /\/tmp\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /private evidence path/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /auth header/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?output\s*[:=]/i,
    /raw[_ -]?prompt\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /source_text\s*[:=]/i,
    /account_ref\s*[:=]/i,
    /request[_ -]?id\s*[:=]/i,
    /provider payload\s*[:=]/i,
    /preview[_ -]?html\s*[:=]/i,
    /screenshot\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows|enables)\s+(?:a\s+)?(?:live provider call|provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|graph ingestion|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /graph ingestion (?:is )?(?:approved|authorized|allowed)/i,
    /product-preview expansion (?:is )?(?:approved|authorized|allowed)/i,
    /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
    /default[_ -]?model selection (?:is )?(?:approved|authorized|allowed|established|made)/i,
    /provider lock-in (?:is )?(?:approved|authorized|allowed|established)/i,
    /readiness_claim"?\s*:\s*true/i,
    /approves_expansion_or_comparison"?\s*:\s*true/i,
    /web_search_requested"?\s*:\s*true/i,
    /tools_or_plugins_requested"?\s*:\s*true/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: live-provider broader-batch Workshop preview usefulness assessment", async (t) => {
  await t.test("records a useful no-spend assessment from sanitized facts only", () => {
    const docs = readRepoFile(ASSESSMENT_DOC);

    assert.match(docs, /Live-Provider Broader-Batch Workshop Preview Usefulness Assessment/i);
    assert.match(docs, /Status: applied no-spend assessment/i);
    assert.match(docs, /assessBroaderBatchWorkshopPreviewUsefulness\(\.\.\.\)/i);
    assert.match(docs, /live-provider-broader-batch-workshop-preview-20260605a/i);
    assert.match(docs, /live-provider-broader-batch-workshop-preview-status\.md/i);
    assert.match(docs, /preview_usefulness_classification: `useful`/i);
    assert.match(docs, /reason count: 0/i);
    assert.match(docs, /selected_slot_count: 5/i);
    // The assessment must preserve the honest source ledger and must NOT overload
    // provider_calls_executed as the per-slot count of 5.
    assert.match(docs, /provider_api_requests_attempted 2/i);
    assert.match(docs, /provider_calls_executed 2/i);
    assert.doesNotMatch(docs, /provider_calls_executed:?\s*5\b/i);
    assert.match(docs, /output counts: excerpts 10, claims 10, account_objects 15/i);
    assert.match(docs, /per-account graph-output floor: each selected role has at least one of each graph fact type/i);
    assert.match(docs, /slot_output_counts: each selected role has excerpts 2, claims 2, account_objects 3/i);
    assert.match(docs, /useful_lens_count: 3/i);
    assert.match(docs, /useful_lenses: `signals`, `maps`, `plays`/i);
    assert.match(docs, /selected roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration/i);
    assert.match(docs, /validation chain: passed/i);
    assert.match(docs, /request surface: no tools, no plugins, no online model variant, no web search/i);
    assert.match(docs, /Workshop side-effect boundary: HTML rendered, provider calls made 0, production writes false/i);
    assert.match(docs, /runtime\/model-mode integration: false/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /live_provider_call: false/i);
    assert.match(docs, /provider_spend: false/i);
    assert.match(docs, /provider_or_model_comparison: false/i);
    assert.match(docs, /corpus_expansion: false/i);
    assert.match(docs, /product_preview_expansion: false/i);
    assert.match(docs, /web_search_or_tools: false/i);
    assert.match(docs, /provider-neutral/i);
    assert.match(docs, /replaceable route/i);
    assert.match(docs, /does not approve expansion/i);
    assert.match(docs, /does not approve comparison/i);
    assert.match(docs, /does not approve graph ingestion/i);
    assert.match(docs, /does not request another provider call/i);
    assert.match(docs, /separate approval packet/i);
    assertNoPrivateLeakage("workshop preview assessment doc", docs);
    assertNoScopeBroadening("workshop preview assessment doc", docs);
  });

  await t.test("keeps public fixtures sanitized and scoped to gate inputs and output", () => {
    const input = readRepoFile(INPUT_FIXTURE);
    const assessment = readRepoFile(ASSESSMENT_FIXTURE);
    for (const [label, text] of [
      ["workshop preview assessment input fixture", input],
      ["workshop preview assessment output fixture", assessment],
    ] as const) {
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
      assert.match(text, /live-provider-broader-batch-workshop-preview-20260605a/i);
      assert.doesNotMatch(
        text,
        /raw[_ -]?(?:provider[_ -]?)?response|credential\s*(?:value|contents?)\s*[:=]|authorization\s*[:=]|bearer\s+[A-Za-z0-9._~+/=-]+/i,
      );
    }
    assert.match(input, /"selected_slot_count": 5/i);
    assert.match(input, /"provider_api_requests_attempted": 2/i);
    assert.match(input, /"provider_calls_executed": 2/i);
    assert.match(input, /"rejected_generations": 1/i);
    assert.match(input, /"successful_validated_generations": 1/i);
    assert.match(input, /"slot_output_counts"/i);
    assert.match(input, /"role": "representative-a"/i);
    assert.match(input, /"role": "representative-b"/i);
    assert.match(input, /"role": "edge-case-a"/i);
    assert.match(input, /"role": "edge-case-b"/i);
    assert.match(input, /"role": "calibration"/i);
    assert.match(input, /"excerpts": 2/i);
    assert.match(input, /"account_objects": 3/i);
    assert.match(input, /"useful_lenses": \[\s*"signals",\s*"maps",\s*"plays"\s*\]/i);
    assert.match(assessment, /"slot_output_counts"/i);
    assert.match(assessment, /"selected_slot_count": 5/i);
    assert.match(assessment, /"preview_usefulness_classification": "useful"/i);
    assert.match(assessment, /"approves_expansion_or_comparison": false/i);
    assert.match(assessment, /"reasons": \[\]/i);

    // Cross-document consistency: the assessment output must preserve the source
    // provider ledger exactly and must never claim provider_calls_executed: 5.
    assert.match(assessment, /"provider_api_requests_attempted": 2/i);
    assert.match(assessment, /"provider_calls_executed": 2/i);
    assert.match(assessment, /"rejected_generations": 1/i);
    assert.match(assessment, /"successful_validated_generations": 1/i);
    assert.doesNotMatch(assessment, /"provider_calls_executed":\s*5\b/i);
  });

  await t.test("links the assessment from the source status doc and preserves boundaries", () => {
    const status = readRepoFile(STATUS_DOC);
    assert.match(
      status,
      /live-provider-broader-batch-workshop-preview-usefulness-assessment\.md/i,
      "source status doc must link the usefulness assessment",
    );
    assert.match(
      status,
      /no-spend|approves_expansion_or_comparison: false|workshop_preview_provider_calls: 0/i,
      "source status doc must preserve no-spend assessment context",
    );
    assertNoPrivateLeakage("source status doc", status);
    assertNoScopeBroadening("source status doc", status);
  });

  await t.test("assessment ledger stays consistent with the source status doc ledger", () => {
    const status = readRepoFile(STATUS_DOC);
    const assessment = JSON.parse(readRepoFile(ASSESSMENT_FIXTURE)) as {
      metrics: {
        selected_slot_count: number;
        provider_ledger: {
          provider_api_requests_attempted: number;
          provider_calls_executed: number;
          rejected_generations: number;
          successful_validated_generations: number;
        };
      };
    };

    function readStatusLedgerField(field: string): number {
      const match = status.match(new RegExp(`${field}:\\s*(\\d+)`, "i"));
      assert.ok(match, `source status doc must record ${field}`);
      return Number(match[1]);
    }

    // The source status doc is the system of record for the provider ledger.
    const sourceLedger = {
      provider_api_requests_attempted: readStatusLedgerField("provider_api_requests_attempted"),
      provider_calls_executed: readStatusLedgerField("provider_calls_executed"),
      rejected_generations: readStatusLedgerField("rejected_generations"),
      successful_validated_generations: readStatusLedgerField("successful_validated_generations"),
    };
    assert.deepEqual(
      sourceLedger,
      {
        provider_api_requests_attempted: 2,
        provider_calls_executed: 2,
        rejected_generations: 1,
        successful_validated_generations: 1,
      },
      "source status doc ledger drifted from the assessed counts",
    );

    // The assessment output must preserve those exact counts and must not
    // overload provider_calls_executed with the slot fan-out.
    assert.deepEqual(
      assessment.metrics.provider_ledger,
      sourceLedger,
      "assessment provider ledger must match the source status doc ledger",
    );
    assert.equal(assessment.metrics.selected_slot_count, 5);
    assert.notEqual(
      assessment.metrics.provider_ledger.provider_calls_executed,
      assessment.metrics.selected_slot_count,
      "provider_calls_executed must not be overloaded as the selected slot count",
    );
  });
});
