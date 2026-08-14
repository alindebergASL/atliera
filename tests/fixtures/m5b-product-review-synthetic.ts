import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  M5B_PRODUCT_REVIEW_REQUEST_KIND,
  M5B_PRODUCT_REVIEW_REQUEST_VERSION,
  M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION,
  M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION,
  type M5bProductReviewRequest,
} from "../../src/workshop/m5b-product-review-contract.ts";

export const SYNTHETIC_SOURCE_TEXTS = Object.freeze({
  launch: "<!doctype html><html><body><h1>Fictional product note</h1><p>Citrine Works introduced Relay Planner on July 14, 2026 for regional operations teams.</p><p>This page and company are synthetic test material.</p></body></html>\n",
  pilot: `${JSON.stringify({
    fixtureOnly: true,
    fictionalCompany: "Citrine Works",
    pilotMetric: "Eighteen of twenty-four invited planners completed the fictional pilot scenario.",
    note: "Synthetic JSON evidence for tests only.",
  }, null, 2)}\n`,
  notes: "Fictional research note for Citrine Works.\nThree regional teams requested a shared exception checklist before the next planning session.\nSynthetic text evidence only.\n",
});

export const SYNTHETIC_QUOTES = Object.freeze({
  launch: "Citrine Works introduced Relay Planner on July 14, 2026 for regional operations teams.",
  pilot: "Eighteen of twenty-four invited planners completed the fictional pilot scenario.",
  notes: "Three regional teams requested a shared exception checklist before the next planning session.",
});

export function sha256Fixture(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function cloneSynthetic<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function syntheticM4Custody(decodedText: string, canonicalUrl: string, acquiredAt: string): string {
  const decoded = Buffer.from(decodedText, "utf8");
  return `${JSON.stringify({
    kind: "m4-sec-gate-b-custody",
    acquiredAt,
    acquisition: {
      requestedUrl: canonicalUrl,
      finalUrl: canonicalUrl,
      fetchedAt: acquiredAt,
      httpStatus: 200,
      byteCount: decoded.byteLength,
      responseSha256: sha256Fixture(decoded),
      bodyBase64: decoded.toString("base64"),
      quotedBodyText: decodedText,
    },
  }, null, 2)}\n`;
}

export interface SyntheticM5bProductReviewScenario {
  readonly root: string;
  readonly request: M5bProductReviewRequest;
  readonly requestPath: string;
  readonly requestBytes: Buffer;
  readonly outputDir: string;
  readonly sourceFiles: readonly { readonly sourceId: string; readonly path: string }[];
}

export async function writeSyntheticRequest(
  root: string,
  name: string,
  request: unknown,
): Promise<{ path: string; bytes: Buffer; sha256: string }> {
  const path = join(root, name);
  const bytes = Buffer.from(`${JSON.stringify(request, null, 2)}\n`, "utf8");
  await writeFile(path, bytes, { flag: "wx" });
  return { path, bytes, sha256: sha256Fixture(bytes) };
}

export async function createSyntheticM5bProductReviewScenario(
  root: string,
): Promise<SyntheticM5bProductReviewScenario> {
  const sourceDefinitions = [
    {
      sourceId: "src_citrine_launch",
      filename: "citrine-launch.html",
      title: "Citrine Works Relay Planner product note (fictional)",
      content: syntheticM4Custody(SYNTHETIC_SOURCE_TEXTS.launch,
        "https://evidence.example.invalid/citrine/relay-planner", "2026-07-15T09:30:00Z"),
      decodedContent: SYNTHETIC_SOURCE_TEXTS.launch,
      contentEncoding: "m4_public_http_fetch_custody_v1" as const,
      sourceType: "synthetic_product_note",
      url: "https://evidence.example.invalid/citrine/relay-planner",
      acquiredAt: "2026-07-15T09:30:00Z",
      currentThrough: "2026-07-14",
    },
    {
      sourceId: "src_citrine_pilot",
      filename: "citrine-pilot.json",
      title: "Citrine Works fictional pilot metrics",
      content: SYNTHETIC_SOURCE_TEXTS.pilot,
      decodedContent: SYNTHETIC_SOURCE_TEXTS.pilot,
      contentEncoding: "raw_utf8" as const,
      sourceType: "synthetic_metrics",
      url: "https://evidence.example.invalid/citrine/pilot-metrics",
      acquiredAt: "2026-07-17T10:00:00Z",
      currentThrough: null,
    },
    {
      sourceId: "src_citrine_notes",
      filename: "citrine-notes.txt",
      title: "Citrine Works fictional planning notes",
      content: SYNTHETIC_SOURCE_TEXTS.notes,
      decodedContent: SYNTHETIC_SOURCE_TEXTS.notes,
      contentEncoding: "raw_utf8" as const,
      sourceType: "synthetic_research_note",
      url: "https://evidence.example.invalid/citrine/planning-notes",
      acquiredAt: "2026-07-19T11:00:00Z",
      currentThrough: "Notes through 2026-07-18",
    },
  ] as const;
  const sourceFiles: { sourceId: string; path: string }[] = [];
  const sources = [];
  for (const definition of sourceDefinitions) {
    const path = join(root, definition.filename);
    const bytes = Buffer.from(definition.content, "utf8");
    const decodedBytes = Buffer.from(definition.decodedContent, "utf8");
    await writeFile(path, bytes, { flag: "wx" });
    sourceFiles.push({ sourceId: definition.sourceId, path });
    sources.push({
      sourceId: definition.sourceId,
      title: definition.title,
      localPath: path,
      sourceKind: "synthetic_fixture" as const,
      contentEncoding: definition.contentEncoding,
      expectedByteSize: bytes.byteLength,
      rawSha256: sha256Fixture(bytes),
      decodedByteSize: decodedBytes.byteLength,
      decodedSha256: sha256Fixture(decodedBytes),
      canonicalUrl: definition.url,
      acquiredAt: definition.acquiredAt,
      evidenceCurrentThrough: definition.currentThrough,
      publisher: "Citrine Fixture Press",
      sourceType: definition.sourceType,
    });
  }

  const request: M5bProductReviewRequest = {
    kind: M5B_PRODUCT_REVIEW_REQUEST_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_REQUEST_VERSION,
    subject: {
      teamId: "team_atliera_fixture",
      accountId: "acc_citrine_works",
      accountName: "Citrine Works (fictional)",
    },
    authority: {
      ownerAuthorizationId: "owner_fixture_product_review_001",
      currentEffectiveAuthorization: "none",
      ratificationStatus: "unratified",
      armingStatus: "unarmed",
      applyEligibility: false,
    },
    execution: {
      commit: "a".repeat(40),
      tree: "b".repeat(40),
      preparedAt: "2026-08-06T12:00:00Z",
    },
    supersession: {
      supersededPackageResultSha256: "c".repeat(64),
      explanation: M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION,
    },
    customerQuestions: {
      whoIsThisAccount: "Citrine Works is a fictional operations-software company serving regional planning teams.",
      whatMeaningfullyChanged: "It introduced a planning product and recorded early completion plus a repeated checklist need.",
      whatMeaningfullyChangedEvidenceBindingIds: ["evd_citrine_launch"],
      whyDoesItMatter: "The combined evidence suggests a focused meeting can test whether exception handling is the useful entry point.",
      whatNeedsAttention: "The pilot size is small, evidence currency differs by source, and the checklist need may not generalize.",
      safeNextTask: M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION,
    },
    sources,
    evidenceBindings: [
      { evidenceId: "evd_citrine_launch", sourceId: "src_citrine_launch", exactQuote: SYNTHETIC_QUOTES.launch,
        evidenceRole: "material_change" },
      { evidenceId: "evd_citrine_pilot", sourceId: "src_citrine_pilot", exactQuote: SYNTHETIC_QUOTES.pilot,
        evidenceRole: "account_context" },
      { evidenceId: "evd_citrine_notes", sourceId: "src_citrine_notes", exactQuote: SYNTHETIC_QUOTES.notes,
        evidenceRole: "account_context" },
    ],
    proposals: [
      {
        proposalId: "prp_citrine_launch_signal",
        classification: "source_fact",
        lens: "signal",
        title: `Source states: ${SYNTHETIC_QUOTES.launch}`,
        summary: `Source states: ${SYNTHETIC_QUOTES.launch}`,
        evidenceBindingIds: ["evd_citrine_launch"],
        supportingProposalIds: [],
        caveats: [],
        safeTask: null,
      },
      {
        proposalId: "prp_citrine_pilot_fact",
        classification: "source_fact",
        lens: "map",
        title: `Source states: ${SYNTHETIC_QUOTES.pilot}`,
        summary: `Source states: ${SYNTHETIC_QUOTES.pilot}`,
        evidenceBindingIds: ["evd_citrine_pilot"],
        supportingProposalIds: [],
        caveats: [],
        safeTask: null,
      },
      {
        proposalId: "prp_citrine_attention_fact",
        classification: "source_fact",
        lens: "map",
        title: `Source states: ${SYNTHETIC_QUOTES.notes}`,
        summary: `Source states: ${SYNTHETIC_QUOTES.notes}`,
        evidenceBindingIds: ["evd_citrine_notes"],
        supportingProposalIds: [],
        caveats: [],
        safeTask: null,
      },
      {
        proposalId: "prp_citrine_readiness_analysis",
        classification: "analysis",
        lens: "map",
        title: "Exception handling is a plausible discovery focus",
        summary: "Following the product introduction, pilot completion and the repeated checklist request make exception handling a plausible meeting hypothesis.",
        evidenceBindingIds: ["evd_citrine_launch", "evd_citrine_pilot", "evd_citrine_notes"],
        supportingProposalIds: ["prp_citrine_launch_signal", "prp_citrine_pilot_fact",
          "prp_citrine_attention_fact"],
        caveats: ["The pilot is small and the notes do not establish demand across the wider account."],
        safeTask: null,
      },
      {
        proposalId: "prp_citrine_meeting_play",
        classification: "recommendation",
        lens: "play",
        title: "Draft a targeted exception-workflow meeting brief for internal review",
        summary: "Use the cited facts and analysis to frame a draft brief around exception workflows and open questions.",
        evidenceBindingIds: ["evd_citrine_launch", "evd_citrine_pilot", "evd_citrine_notes"],
        supportingProposalIds: ["prp_citrine_readiness_analysis"],
        caveats: ["A reviewer should confirm the audience, evidence currency, and desired meeting outcome before use."],
        safeTask: {
          kind: "draft_targeted_meeting_brief",
          description: M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION,
        },
      },
    ],
  };
  const written = await writeSyntheticRequest(root, "product-review-request.json", request);
  return Object.freeze({
    root,
    request,
    requestPath: written.path,
    requestBytes: written.bytes,
    outputDir: join(root, "prepared-product-review"),
    sourceFiles: Object.freeze(sourceFiles),
  });
}
