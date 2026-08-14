import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  M5bProductReviewRefusal,
  validateM5bProductReviewRequest,
} from "../../src/workshop/m5b-product-review-contract.ts";
import {
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

  test("rejects non-absolute manifest paths and unused evidence", async () => {
    await withScenario((baseline) => {
      const relative = cloneSynthetic(baseline);
      relative.sources[0].localPath = "relative/source.html";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(relative)), "source_path");

      const unused = cloneSynthetic(baseline);
      unused.evidenceBindings.push({
        evidenceId: "evd_citrine_unused",
        sourceId: "src_citrine_launch",
        exactQuote: "This page and company are synthetic test material.",
        evidenceRole: "account_context",
      });
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unused)), "unused_evidence_binding");
    });
  });

  test("rejects an aggregate source budget overflow", async () => {
    await withScenario((baseline) => {
      const oversized = cloneSynthetic(baseline);
      oversized.sources.push({
        ...cloneSynthetic(oversized.sources[2]),
        sourceId: "src_citrine_fourth",
        title: "Citrine fourth synthetic source",
        localPath: "/tmp/citrine-fourth.txt",
        canonicalUrl: "https://example.invalid/citrine-fourth",
      });
      for (const source of oversized.sources) {
        source.expectedByteSize = 512 * 1024;
        source.decodedByteSize = 512 * 1024;
      }
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(oversized)), "source_budget");
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
      assert.ok(["request_shape", "proposal_dependencies", "material_change_analysis"].includes(
        refusalCode(() => validateM5bProductReviewRequest(missingDependency))));

      const confusedFact = cloneSynthetic(baseline);
      confusedFact.proposals[0].summary = "This looks like an inferred market opportunity for the account.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(confusedFact)), "source_fact_attribution");

      const forgedFactTitle = cloneSynthetic(baseline);
      forgedFactTitle.proposals[0].title = "Human-ratified durable account fact";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(forgedFactTitle)),
        "source_fact_attribution");

      const unsupportedEvidence = cloneSynthetic(baseline);
      unsupportedEvidence.proposals[3].evidenceBindingIds = ["evd_citrine_launch", "evd_citrine_pilot"];
      unsupportedEvidence.proposals[3].supportingProposalIds = ["prp_citrine_launch_signal"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(unsupportedEvidence)),
        "proposal_evidence_dependency");

      const poisonDependency = cloneSynthetic(baseline);
      poisonDependency.proposals[3].supportingProposalIds.push("prp_provider_call");
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

  test("requires a typed material-change Signal to support the Map analysis and every Play", async () => {
    await withScenario((baseline) => {
      const oldVersion = cloneSynthetic(baseline);
      oldVersion.schemaVersion = "1";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(oldVersion)), "request_version");

      const invalidRole = cloneSynthetic(baseline);
      invalidRole.evidenceBindings[0].evidenceRole = "document_metadata";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(invalidRole)), "evidence_binding");

      const noMaterialChange = cloneSynthetic(baseline);
      noMaterialChange.evidenceBindings[0].evidenceRole = "account_context";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(noMaterialChange)),
        "material_change_evidence");

      const questionUsesContext = cloneSynthetic(baseline);
      questionUsesContext.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds = ["evd_citrine_pilot"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(questionUsesContext)),
        "material_change_question");

      const identityOnly = cloneSynthetic(baseline);
      identityOnly.subject.accountName = "FedEx";
      identityOnly.evidenceBindings[0].exactQuote = "FEDEX CORPORATION";
      identityOnly.proposals[0].title = "Source states: FEDEX CORPORATION";
      identityOnly.proposals[0].summary = identityOnly.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(identityOnly)),
        "material_change_identity_only");

      const identityWithQualifier = cloneSynthetic(baseline);
      identityWithQualifier.evidenceBindings[0].exactQuote = "Citrine Works";
      identityWithQualifier.proposals[0].title = "Source states: Citrine Works";
      identityWithQualifier.proposals[0].summary = identityWithQualifier.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(identityWithQualifier)),
        "material_change_identity_only");

      const labeledIdentity = cloneSynthetic(baseline);
      labeledIdentity.subject.accountName = "FedEx";
      labeledIdentity.evidenceBindings[0].exactQuote = "Registrant: FEDEX CORPORATION";
      labeledIdentity.proposals[0].title = "Source states: Registrant: FEDEX CORPORATION";
      labeledIdentity.proposals[0].summary = labeledIdentity.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(labeledIdentity)),
        "material_change_identity_only");

      const corporateNameIdentity = cloneSynthetic(baseline);
      corporateNameIdentity.subject.accountName = "FedEx";
      corporateNameIdentity.evidenceBindings[0].exactQuote = "Corporate name: FEDEX CORPORATION";
      corporateNameIdentity.proposals[0].title = "Source states: Corporate name: FEDEX CORPORATION";
      corporateNameIdentity.proposals[0].summary = corporateNameIdentity.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(corporateNameIdentity)),
        "material_change_identity_only");

      const identityWithTicker = cloneSynthetic(baseline);
      identityWithTicker.subject.accountName = "FedEx";
      identityWithTicker.evidenceBindings[0].exactQuote = "FEDEX CORPORATION ticker NYSE FDX";
      identityWithTicker.proposals[0].title = "Source states: FEDEX CORPORATION ticker NYSE FDX";
      identityWithTicker.proposals[0].summary = identityWithTicker.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(identityWithTicker)),
        "material_change_identity_only");

      for (const quote of [
        "Exact name of registrant: FEDEX CORPORATION",
        "FEDEX CORPORATION / FDX",
        "FEDEX CORPORATION, a Delaware corporation",
        "The exact name of the registrant is FEDEX CORPORATION",
        "The registrant's name is FEDEX CORPORATION",
        "FEDEX CORPORATION is the registrant",
        "CIK 0001048911: FEDEX CORPORATION",
        "Ticker FDX: FEDEX CORPORATION",
        "NYSE: FDX — FEDEX CORPORATION",
      ]) {
        const identityBoilerplate = cloneSynthetic(baseline);
        identityBoilerplate.subject.accountName = "FedEx";
        identityBoilerplate.evidenceBindings[0].exactQuote = quote;
        identityBoilerplate.proposals[0].title = `Source states: ${quote}`;
        identityBoilerplate.proposals[0].summary = identityBoilerplate.proposals[0].title;
        assert.equal(refusalCode(() => validateM5bProductReviewRequest(identityBoilerplate)),
          "material_change_identity_only");
      }

      for (const quote of [
        "Air Courier Services",
        "AIR COURIER SERVICES",
        "air courier services",
        "Air Courier Companies",
        "Industry: Air Courier Services",
        "SIC 4513 / Air Courier Services",
        "The SEC classifies the registrant under SIC 4513, “Air Courier Services.”",
        "Federal Express",
        "FedEx Corporation (Federal Express)",
        "FedEx Corporation (federal express)",
        "FedEx Corporation / Federal Express",
        "FedEx Corporation / federal express",
        "FedEx Corporation | Federal Express",
        "fedex corporation | federal express",
        "FedEx Corporation — Federal Express",
        "FedEx Corporation: Federal Express",
        "FedEx Corporation, Federal Express",
        "FedEx Corporation; Federal Express",
        "Federal Express: FedEx Corporation",
        "Federal Express, FedEx Corporation",
        "Federal Express; FedEx Corporation",
        "FedEx Corporation — FDX",
        "FDX — FEDEX CORPORATION",
        "FEDEX CORPORATION | CIK 0001048911",
        "CIK 0001048911 / FEDEX CORPORATION",
        "Air Courier Services planned",
        "Air Courier Services reported",
        "Air Courier Services updates",
        "FedEx Corporation planned",
        "FedEx Corporation reported",
        "FedEx Corporation updates",
        "FedEx Acquisition Corp",
        "Federal Express Acquisition Corporation",
        "Rise Holdings",
        "Open Systems",
        "Transition Services",
        "Industry: Merger and Acquisition Services",
        "Business category: Acquisition Services",
        "Industry: FedEx acquired TNT",
        "Business category: FedEx acquired TNT",
        "Sector: FedEx acquired TNT",
        "SIC 4513: FedEx acquired TNT",
        "NAICS 492110: FedEx acquired TNT",
        "Expansion Consulting Services",
        "Appointment Services",
        "FedEx Acquisition of America LLC",
        "Acquisition of America Corporation",
        "Rise in Revenue Holdings",
        "Reported Acquisition of America LLC",
        "Company name: Acquisition Services",
        "Legal name: Acquisition Services",
        "Corporate name: Acquisition Services",
        "Registrant: Acquisition Services",
        "Issuer: Acquisition Services",
        "The registrant is Acquisition Services",
        "The issuer is Acquisition Services",
        "Company name: FedEx acquired TNT",
        "The registrant is FedEx acquired TNT",
        "Acquisition of Business Services",
        "Transition to Cloud Services",
        "Partnership for Growth LLC",
        "Sale of America Holdings",
        "Reported Rise in Revenue Holdings",
      ]) {
        const staticContext = cloneSynthetic(baseline);
        staticContext.subject.accountName = "FedEx";
        staticContext.evidenceBindings[0].exactQuote = quote;
        staticContext.proposals[0].title = `Source states: ${quote}`;
        staticContext.proposals[0].summary = staticContext.proposals[0].title;
        assert.equal(refusalCode(() => validateM5bProductReviewRequest(staticContext)),
          "material_change_identity_only");
      }

      const markerOnly = cloneSynthetic(baseline);
      markerOnly.subject.accountName = "FedEx";
      markerOnly.evidenceBindings[0].exactQuote = "Acquisition";
      markerOnly.proposals[0].title = "Source states: Acquisition";
      markerOnly.proposals[0].summary = markerOnly.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(markerOnly)),
        "material_change_uninformative");

      for (const label of [
        "Company name: ",
        "Corporate name = ",
        "Legal name — ",
        "Business name - ",
        "Account name: ",
        "Entity name: ",
        "Issuer name: ",
        "Registrant name: ",
        "Exact company name: ",
        "Exact legal name: ",
        "Exact name of registrant: ",
        "Name of the issuer: ",
        "Name of registrant: ",
        "The exact issuer name is ",
        "Exact legal name of issuer: ",
        "Issuer's name: ",
        "Issuer’s name: ",
        "Registrant's name: ",
        "Registrant’s name: ",
        "Issuer: ",
        "Registrant is ",
        "The issuer is ",
        "The registrant is ",
      ]) {
        for (const value of ["Acquisition of TNT", "FedEx acquired TNT"]) {
          const labeledChange = cloneSynthetic(baseline);
          labeledChange.subject.accountName = "FedEx";
          labeledChange.evidenceBindings[0].exactQuote = `${label}${value}`;
          labeledChange.proposals[0].title = `Source states: ${label}${value}`;
          labeledChange.proposals[0].summary = labeledChange.proposals[0].title;
          assert.equal(refusalCode(() => validateM5bProductReviewRequest(labeledChange)),
            "material_change_identity_only");
        }
      }

      for (const quote of [
        "Service Disruption Across Europe",
        "Network Reconfiguration Under Way",
        "Acquisition of TNT",
        "rise in revenue",
        "FedEx acquired TNT",
        "FedEx pivoted to a new distribution model.",
        "FedEx adopted a new network operating model.",
        "FedEx restructured its air network.",
        "FedEx Corporation | announced the acquisition of Example Co.",
        "FedEx Corporation | is expanding its air network.",
        "FedEx Corporation (announced a network restructuring)",
        "FedEx Corporation — expanded its air courier services network.",
        "FedEx Corporation (Federal Express) announced the acquisition of Example Co.",
      ]) {
        const materialAnnouncement = cloneSynthetic(baseline);
        materialAnnouncement.subject.accountName = "FedEx";
        materialAnnouncement.evidenceBindings[0].exactQuote = quote;
        materialAnnouncement.proposals[0].title = `Source states: ${quote}`;
        materialAnnouncement.proposals[0].summary = materialAnnouncement.proposals[0].title;
        assert.doesNotThrow(() => validateM5bProductReviewRequest(materialAnnouncement));
      }

      const uninformative = cloneSynthetic(baseline);
      uninformative.evidenceBindings[0].exactQuote = "— — — —";
      uninformative.proposals[0].title = "Source states: — — — —";
      uninformative.proposals[0].summary = uninformative.proposals[0].title;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(uninformative)),
        "material_change_uninformative");

      const materialNotSignal = cloneSynthetic(baseline);
      materialNotSignal.proposals[0].lens = "map";
      materialNotSignal.proposals[1].lens = "signal";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(materialNotSignal)),
        "material_change_signal");

      const mapOmitsMaterialSignal = cloneSynthetic(baseline);
      mapOmitsMaterialSignal.proposals[3].evidenceBindingIds = ["evd_citrine_pilot", "evd_citrine_notes"];
      mapOmitsMaterialSignal.proposals[3].supportingProposalIds = ["prp_citrine_pilot_fact",
        "prp_citrine_attention_fact"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(mapOmitsMaterialSignal)),
        "material_change_analysis");

      const mapCrossBindsDifferentMaterialFact = cloneSynthetic(baseline);
      mapCrossBindsDifferentMaterialFact.evidenceBindings[1].evidenceRole = "material_change";
      mapCrossBindsDifferentMaterialFact.proposals[3].evidenceBindingIds = ["evd_citrine_pilot",
        "evd_citrine_notes"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(mapCrossBindsDifferentMaterialFact)),
        "material_change_analysis");

      const questionCrossBindsDifferentMaterialFact = cloneSynthetic(baseline);
      questionCrossBindsDifferentMaterialFact.evidenceBindings[1].evidenceRole = "material_change";
      questionCrossBindsDifferentMaterialFact.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds =
        ["evd_citrine_pilot"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(
        questionCrossBindsDifferentMaterialFact)), "material_change_question");

      const questionAddsDisconnectedMaterialFact = cloneSynthetic(baseline);
      questionAddsDisconnectedMaterialFact.evidenceBindings[1].evidenceRole = "material_change";
      questionAddsDisconnectedMaterialFact.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds =
        ["evd_citrine_launch", "evd_citrine_pilot"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(
        questionAddsDisconnectedMaterialFact)), "material_change_question");

      const playUsesDifferentMaterialFact = cloneSynthetic(baseline);
      playUsesDifferentMaterialFact.evidenceBindings[1].evidenceRole = "material_change";
      playUsesDifferentMaterialFact.proposals[1].lens = "signal";
      playUsesDifferentMaterialFact.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds =
        ["evd_citrine_pilot"];
      playUsesDifferentMaterialFact.proposals.at(-1).evidenceBindingIds =
        ["evd_citrine_launch", "evd_citrine_notes"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(playUsesDifferentMaterialFact)),
        "material_change_play");

      const mixedCustodyUsesSyntheticMaterial = cloneSynthetic(baseline);
      mixedCustodyUsesSyntheticMaterial.sources[1].sourceKind = "exact_public_acquisition_custody";
      mixedCustodyUsesSyntheticMaterial.sources[1].contentEncoding = "exact_sec_archive_custody_v1";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(mixedCustodyUsesSyntheticMaterial)),
        "material_change_source_classification");

      const playOmitsMaterialEvidence = cloneSynthetic(baseline);
      playOmitsMaterialEvidence.proposals.at(-1).evidenceBindingIds = ["evd_citrine_pilot",
        "evd_citrine_notes"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(playOmitsMaterialEvidence)),
        "material_change_play");

      const playCrossBindsDifferentMaterialFact = cloneSynthetic(baseline);
      playCrossBindsDifferentMaterialFact.evidenceBindings[1].evidenceRole = "material_change";
      playCrossBindsDifferentMaterialFact.proposals.at(-1).evidenceBindingIds = ["evd_citrine_pilot",
        "evd_citrine_notes"];
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(playCrossBindsDifferentMaterialFact)),
        "material_change_play");

      const withIdentityContext = cloneSynthetic(baseline);
      withIdentityContext.evidenceBindings[1].evidenceRole = "account_identity";
      assert.equal(validateM5bProductReviewRequest(withIdentityContext).evidenceBindings[1]!.evidenceRole,
        "account_identity");
    });
  });

  test("requires all five substantive answers and an internal brief as the safe next task", async () => {
    await withScenario((baseline) => {
      const missing = cloneSynthetic(baseline);
      delete missing.customerQuestions.whyDoesItMatter;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(missing)), "request_shape");

      const missingChangeBinding = cloneSynthetic(baseline);
      delete missingChangeBinding.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds;
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(missingChangeBinding)), "request_shape");

      const outbound = cloneSynthetic(baseline);
      outbound.customerQuestions.safeNextTask = "Send an email to the account with a generic summary.";
      assert.equal(refusalCode(() => validateM5bProductReviewRequest(outbound)), "unsafe_next_task");
    });
  });
});
