import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildCalmAccountHomeFromTrustedM5bPackage,
  type CalmAccountHomeArtifact,
} from "../../src/workshop/calm-account-home.ts";
import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";

import {
  cloneSynthetic,
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
  writeSyntheticRequest,
  type SyntheticM5bProductReviewScenario,
} from "./m5b-product-review-synthetic.ts";

export const C1_SYNTHETIC_MEETING_PLAN = Object.freeze({
  primaryAudience: "Operations leaders",
  meetingObjective: "Understand how regional teams evaluate exception handling after the product introduction.",
  orderedQuestions: Object.freeze([
    Object.freeze({
      question: "Where do planning exceptions create the most manual coordination today?",
      whyAsked: "Locate the operational constraint without presuming demand.",
      desiredLearning: "The highest-cost exception pattern and who owns it.",
      followUpSignal: "The audience identifies a bounded workflow they want examined.",
    }),
    Object.freeze({
      question: "What would need to remain stable during any workflow change?",
      whyAsked: "Separate the desired improvement from protected operating constraints.",
      desiredLearning: "The controls, handoffs, and service commitments that cannot regress.",
      followUpSignal: "The audience names a protected constraint or evidence requirement.",
    }),
    Object.freeze({
      question: "Which result would justify a focused second conversation?",
      whyAsked: "Set an honest close criterion without assuming a commercial next step.",
      desiredLearning: "The measurable learning or comparison that would make follow-up useful.",
      followUpSignal: "The audience requests one specific comparison or scenario.",
    }),
  ]),
  overallCloseCriterion: "Close without another action unless the audience requests one specific comparison, scenario, or evidence check.",
});

export interface C1SyntheticScenario extends SyntheticM5bProductReviewScenario {
  readonly c1RequestPath: string;
  readonly c1RequestBytes: Buffer;
}

export async function createC1SyntheticScenario(
  root: string,
  options: { readonly withMeetingPlan: boolean },
): Promise<C1SyntheticScenario> {
  const base = await createSyntheticM5bProductReviewScenario(root);
  if (!options.withMeetingPlan) {
    return Object.freeze({
      ...base,
      c1RequestPath: base.requestPath,
      c1RequestBytes: base.requestBytes,
    });
  }
  const request: any = cloneSynthetic(base.request);
  request.meetingPlan = cloneSynthetic(C1_SYNTHETIC_MEETING_PLAN);
  const written = await writeSyntheticRequest(root, "c1-calm-account-home-plan-request.json", request);
  return Object.freeze({
    ...base,
    request,
    requestPath: written.path,
    requestBytes: written.bytes,
    c1RequestPath: written.path,
    c1RequestBytes: written.bytes,
    outputDir: join(root, "c1-plan-package"),
  });
}

export interface PreparedC1SyntheticScenario {
  readonly scenario: C1SyntheticScenario;
  readonly artifact: Readonly<CalmAccountHomeArtifact>;
  readonly trustedPrepareResult: Awaited<ReturnType<typeof prepareM5bProductReview>>;
  readonly artifactSet: {
    readonly sourcePack: unknown;
    readonly candidate: unknown;
    readonly reviewPacket: unknown;
  };
}

export async function prepareC1SyntheticScenario(
  root: string,
  options: { readonly withMeetingPlan: boolean },
): Promise<PreparedC1SyntheticScenario> {
  const scenario = await createC1SyntheticScenario(root, options);
  const trustedPrepareResult = await prepareM5bProductReview({
    requestPath: scenario.c1RequestPath,
    expectedRequestSha256: sha256Fixture(scenario.c1RequestBytes),
    expectedRequestByteSize: scenario.c1RequestBytes.byteLength,
    sourceFiles: scenario.sourceFiles,
    outputDir: scenario.outputDir,
  });
  const artifactSet = {
    sourcePack: JSON.parse(await readFile(join(scenario.outputDir, "sanitized-source-pack.json"), "utf8")),
    candidate: JSON.parse(await readFile(join(scenario.outputDir, "candidate.json"), "utf8")),
    reviewPacket: JSON.parse(await readFile(join(scenario.outputDir, "review-packet.json"), "utf8")),
  };
  const artifact = buildCalmAccountHomeFromTrustedM5bPackage(artifactSet, trustedPrepareResult);
  return Object.freeze({ scenario, artifact, trustedPrepareResult, artifactSet });
}
