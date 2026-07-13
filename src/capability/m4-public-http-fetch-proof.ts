import { createHash } from "node:crypto";
import { M4_RECORDED_PROOF_SCHEDULE } from "./m4-recorded-proof-schedule.ts";
import { createM4RecordedProofKernel } from "./m4-public-http-fetch-mediation.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import { M4_TARGET_URL } from "./public-http-fetch-policy.ts";
import { extractM4SecEvidence, renderM4SecWorkshopEvidence } from "./m4-sec-extraction.ts";

export const M4_RECORDED_SEC_SUBMISSIONS_BODY =
  '{"cik":"0001048911","sic":"4513","sicDescription":"AIR COURIER SERVICES","name":"FEDEX CORP","tickers":["FDX"],"exchanges":["NYSE"]}';
export const M4_RECORDED_PROOF_PACKET_SHA256 = "6302a43a017af0bf4e4918dec7aea86b9c3c48139f6ae2f20a7ca048520ed4ef" as const;
export const M4_SEC_WORKSHOP_FIXTURE_SHA256 = "a21963592e34335b466970d039383ca68f26994813b7d3a690342d8338d53c46" as const;

export async function generateM4PublicHttpFetchProof(): Promise<Record<string, unknown>> {
  const kernel = createM4RecordedProofKernel(Object.freeze({
    fetchedAt: "2026-07-12T00:00:00.000Z", resolvedAddresses: Object.freeze(["104.16.1.1"]), status: 200,
    contentType: "application/json; charset=utf-8", location: null, connectedAddress: "104.16.1.1",
    finalUrl: M4_TARGET_URL, bodyBase64: Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY, "utf8").toString("base64"), cancelAt: "none",
  }), Object.freeze({ wallClockIso: Object.freeze(["2026-07-11T12:00:02.000Z", "2026-07-11T12:00:02.000Z", "2026-07-11T12:00:02.009Z"]),
    monotonicMs: Object.freeze([1000, 1009]) }));
  const result = await kernel.invoke({ trigger: { kind: "approved_recorded_schedule", scheduleId: M4_RECORDED_PROOF_SCHEDULE.scheduleId },
    input: { targetRef: "sec_fedex_submissions", targetPolicySha256: M4_TARGET_POLICY_SHA256 } });
  if (!result.ok || result.output === null) throw new Error(`M4 recorded proof failed: ${JSON.stringify(result)}`);
  const extraction = extractM4SecEvidence(result.output);
  const workshopHtml = renderM4SecWorkshopEvidence(extraction);
  const workshopSha256 = createHash("sha256").update(workshopHtml, "utf8").digest("hex");
  if (workshopSha256 !== M4_SEC_WORKSHOP_FIXTURE_SHA256) throw new Error("M4 SEC Workshop fixture hash drift");
  const proofCore = {
    kind: "m4-sec-fedex-submissions-gate-a-recorded-proof", schemaVersion: "2",
    generatedAt: "2026-07-12T00:00:01.000Z", fixtureClassification: "recorded_fixture_not_live_fetched",
    currentEffectiveAuthorization: "none", liveAcquisition: false,
    targetPolicy: { ref: M4_TARGET_POLICY_REF, sha256: M4_TARGET_POLICY_SHA256 },
    acquisition: result.output, extraction,
    budgets: { targetRef: M4_CANONICAL_TARGET_POLICY.targetRef, url: M4_TARGET_URL, maxTargets: 1, mediationLevel: "L0",
      targetPolicySha256: M4_TARGET_POLICY_SHA256, redirectLimit: 0, retryBudget: 0, maxDurationMs: 10000,
      maxBodyBytes: 1048576, acceptedContentTypes: ["application/json"], effectivePort: 443, addressFamily: 4,
      onePinnedAddress: true, oneConnectionAttempt: true },
    workshop: { fixturePath: "fixtures/workshop/m4-sec-fedex-submissions-evidence-preview.html",
      htmlSha256: workshopSha256, trustLabel: extraction.trustLabel,
      verificationStatus: extraction.verificationStatus },
    effects: { recordedInertExchangesConsumed: 1, systemSideAcquisitionProofs: 1, liveNetworkEgress: 0, retries: 0,
      providerCalls: 0, privateReads: 0, graphWrites: 0, productionWrites: 0, deployments: 0 },
    capabilityExecutions: result.capabilityExecutions, auditEvents: result.auditEvents,
    accountingIncrements: result.accountingIncrements,
  };
  const proofPacketSha256 = createHash("sha256").update(JSON.stringify(proofCore), "utf8").digest("hex");
  if (proofPacketSha256 !== M4_RECORDED_PROOF_PACKET_SHA256) throw new Error(`M4 SEC proof packet hash drift: ${proofPacketSha256}`);
  return Object.freeze({ ...proofCore, proofPacketSha256 });
}

export async function generateM4SecWorkshopFixture(): Promise<string> {
  const proof = await generateM4PublicHttpFetchProof();
  return renderM4SecWorkshopEvidence(proof.extraction as ReturnType<typeof extractM4SecEvidence>);
}
