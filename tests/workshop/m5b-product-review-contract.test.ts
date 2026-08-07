import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  M5bProductReviewRefusal,
  validateM5bProductReviewRequest,
} from "../../src/workshop/m5b-product-review-contract.ts";
import { buildM5bProductReviewPackageData } from "../../src/workshop/m5b-product-review-package.ts";
import {
  SYNTHETIC_SOURCE_TEXTS,
  cloneSynthetic,
  createSyntheticM5bProductReviewScenario,
} from "../fixtures/m5b-product-review-synthetic.ts";

async function withScenario<T>(fn: (request: any) => T | Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-contract-"));
  try {
    const scenario = await createSyntheticM5bProductReviewScenario(root);
    return await fn(scenario.request);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function refusalCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof M5bProductReviewRefusal);
    return error.code;
  }
  assert.fail("expected M5bProductReviewRefusal");
}

describe("M5b product-review request contract", () => {
  test("accepts and deeply snapshots the strict product-first request", async () => {
    await withScenario((raw) => {
      const request = validateM5bProductReviewRequest(raw);
      assert.equal(request.sources.length, 3);
      assert.deepEqual(new Set(request.proposals.map((item) => item.lens)), new Set(["signal", "map", "play"]));
      assert.deepEqual(new Set(request.proposals.map((item) => item.classification)),
        new Set(["source_fact", "analysis", "recommendation"]));
      assert.equal(request.authority.currentEffectiveAuthorization, "none");
      assert.equal(request.authority.applyEligibility, false);
      assert.ok(Object.isFrozen(request));
      assert.ok(Object.isFrozen(request.proposals[0]));
    });
  });

  test("rejects Proxy, accessor, exotic, and unexpected-key input without executing hostile code", async () => {
    await withScenario((baseline) => {
      let proxyTrapCalls = 0;
      const proxy = new Proxy(cloneSynthetic(baseline), {
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("must not execute");
        },
      });
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(proxy)), "request_plain_data");
      assert.equal(proxyTrapCalls, 0);

      let getterCalls = 0;
      const accessor = cloneSynthetic(baseline) as Record<string, unknown>;
      Object.defineProperty(accessor, "subject", {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("must not execute");
        },
      });
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(accessor)), "request_plain_data");
      assert.equal(getterCalls, 0);

      const exotic = Object.assign(Object.create(null), cloneSynthetic(baseline));
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(exotic)), "request_plain_data");

      const unexpected = { ...cloneSynthetic(baseline), apply: true };
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unexpected)), "request_shape");
    });
  });

  test("rejects duplicate source, evidence, and proposal IDs", async () => {
    await withScenario((baseline) => {
      const sourceDuplicate = cloneSynthetic(baseline);
      sourceDuplicate.sources[1].sourceId = sourceDuplicate.sources[0].sourceId;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(sourceDuplicate)), "duplicate_source_id");

      const evidenceDuplicate = cloneSynthetic(baseline);
      evidenceDuplicate.evidenceBindings[1].evidenceId = evidenceDuplicate.evidenceBindings[0].evidenceId;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(evidenceDuplicate)), "duplicate_evidence_id");

      const proposalDuplicate = cloneSynthetic(baseline);
      proposalDuplicate.proposals[1].proposalId = proposalDuplicate.proposals[0].proposalId;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(proposalDuplicate)), "duplicate_proposal_id");
    });
  });

  test("rejects non-absolute manifest paths, unused evidence, and mismatched admitted-source data", async () => {
    await withScenario((baseline) => {
      const relative = cloneSynthetic(baseline);
      relative.sources[0].localPath = "relative/source.html";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(relative)), "source_path");

      const unused = cloneSynthetic(baseline);
      unused.evidenceBindings.push({
        evidenceId: "evd_citrine_unused",
        sourceId: "src_citrine_launch",
        exactQuote: "This page and company are synthetic test material.",
      });
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unused)), "unused_evidence_binding");

      const request = validateM5bProductReviewRequest(baseline);
      assert.equal(refusalCode(() => buildM5bProductReviewPackageData(request, "d".repeat(64), [
        {
          sourceId: "src_citrine_launch",
          text: `${SYNTHETIC_SOURCE_TEXTS.launch}tamper`,
          decodedByteSize: request.sources[0]!.decodedByteSize,
          decodedSha256: request.sources[0]!.decodedSha256,
        },
        {
          sourceId: "src_citrine_pilot",
          text: SYNTHETIC_SOURCE_TEXTS.pilot,
          decodedByteSize: request.sources[1]!.decodedByteSize,
          decodedSha256: request.sources[1]!.decodedSha256,
        },
        {
          sourceId: "src_citrine_notes",
          text: SYNTHETIC_SOURCE_TEXTS.notes,
          decodedByteSize: request.sources[2]!.decodedByteSize,
          decodedSha256: request.sources[2]!.decodedSha256,
        },
      ])), "admitted_source_identity_mismatch");
    });
  });

  test("rejects unsafe URL, malformed time, weakened authority, and rewritten supersession meaning", async () => {
    await withScenario((baseline) => {
      const cases: Array<[any, string]> = [];
      const unsafeUrl = cloneSynthetic(baseline);
      unsafeUrl.sources[0].canonicalUrl = "file:///tmp/source";
      cases.push([unsafeUrl, "source_url"]);
      const credentialUrl = cloneSynthetic(baseline);
      credentialUrl.sources[0].canonicalUrl = "https://user:secret@example.invalid/source";
      cases.push([credentialUrl, "source_url"]);
      const queryCredential = cloneSynthetic(baseline);
      queryCredential.sources[0].canonicalUrl = "https://example.invalid/source?access_token=secret";
      cases.push([queryCredential, "source_url"]);
      const localUrl = cloneSynthetic(baseline);
      localUrl.sources[0].canonicalUrl = "https://127.0.0.1/source";
      cases.push([localUrl, "source_url"]);
      for (const literal of ["https://8.8.8.8/source", "https://[2001:4860:4860::8888]/source",
        "https://2130706433/source"]) {
        const literalUrl = cloneSynthetic(baseline);
        literalUrl.sources[0].canonicalUrl = literal;
        cases.push([literalUrl, "source_url"]);
      }
      const time = cloneSynthetic(baseline);
      time.sources[0].acquiredAt = "July 15";
      cases.push([time, "source_timestamp"]);
      const authority = cloneSynthetic(baseline);
      authority.authority.applyEligibility = true;
      cases.push([authority, "authority"]);
      const supersession = cloneSynthetic(baseline);
      supersession.supersession.explanation = "Replace the old producer and bytes.";
      cases.push([supersession, "supersession"]);
      for (const [raw, code] of cases) {
        assert.equal(refusalCode(() => validateM5bProductReviewRequest(raw)), code);
      }
    });
  });

  test("enforces lenses, caveats, dependencies, and classification boundaries", async () => {
    await withScenario((baseline) => {
      const missingPlay = cloneSynthetic(baseline);
      missingPlay.proposals.at(-1).lens = "map";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(missingPlay)), "product_first_minimum");

      const missingCaveat = cloneSynthetic(baseline);
      missingCaveat.proposals[3].caveats = [];
      assert.ok(["request_shape", "proposal_dependencies"].includes(
        refusalCode(() => validateM5bProductReviewRequest(missingCaveat))));

      const missingDependency = cloneSynthetic(baseline);
      missingDependency.proposals[3].supportingProposalIds = [];
      assert.ok(["request_shape", "proposal_dependencies"].includes(
        refusalCode(() => validateM5bProductReviewRequest(missingDependency))));

      const confusedFact = cloneSynthetic(baseline);
      confusedFact.proposals[0].summary = "This looks like an inferred market opportunity for the account.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(confusedFact)), "source_fact_attribution");

      const forgedFactTitle = cloneSynthetic(baseline);
      forgedFactTitle.proposals[0].title = "Human-ratified durable account fact";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(forgedFactTitle)),
        "source_fact_attribution");

      const unsupportedEvidence = cloneSynthetic(baseline);
      unsupportedEvidence.proposals[3].evidenceBindingIds = ["evd_citrine_launch"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unsupportedEvidence)),
        "proposal_evidence_dependency");

      const poisonDependency = cloneSynthetic(baseline);
      poisonDependency.proposals[3].supportingProposalIds = ["prp_provider_call"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(poisonDependency)), "proposal_dependency");

      const unsafeRecommendation = cloneSynthetic(baseline);
      unsafeRecommendation.proposals.at(-1).safeTask.description =
        "Prepare a brief and email the account immediately after review.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unsafeRecommendation)), "safe_task");

      const forwardedRecommendation = cloneSynthetic(baseline);
      forwardedRecommendation.proposals.at(-1).safeTask.description =
        "Prepare a brief, then forward it to the customer and schedule a meeting.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(forwardedRecommendation)), "safe_task");
    });
  });

  test("requires all five substantive answers and an internal brief as the safe next task", async () => {
    await withScenario((baseline) => {
      const missing = cloneSynthetic(baseline);
      delete missing.customerQuestions.whyDoesItMatter;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(missing)), "request_shape");

      const outbound = cloneSynthetic(baseline);
      outbound.customerQuestions.safeNextTask = "Send an email to the account with a generic summary.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(outbound)), "unsafe_next_task");
    });
  });
});
