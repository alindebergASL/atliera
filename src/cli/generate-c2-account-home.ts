import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { admitAccountResearch } from "../account-intelligence/admission.ts";
import {
  renderC2AccountHome,
  snapshotC2AccountHomeAnnotations,
  type C2AccountHomeAnnotation,
} from "../account-intelligence/account-home.ts";
import type {
  AccountIntelligenceEffectReceipt,
  AdmittedAccountSource,
  ValidatedAccountIntelligence,
} from "../account-intelligence/contracts.ts";
import { snapshotAccountIntelligenceProposal } from "../account-intelligence/proposal.ts";
import { createAccountResearchPlan, snapshotAccountResearchRequest } from "../account-intelligence/research-plan.ts";
import { snapshotAdmittedResearchPolicy } from "../account-intelligence/research-policy.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const BROAD_INPUT = resolve(REPO, "fixtures/account-intelligence/c2-01/broad-account-research-input.json");
const FRESH_PROPOSAL = resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json");
const FRESH_EFFECT_RECEIPT = resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-effect-receipt.json");
const FROZEN_C2_ROOT = resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh");
const UTAH_ACCOUNT_ID = "acc_university_of_utah";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isAtOrBelow(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function utahAccountFromBroadInput(value: unknown): Record<string, unknown> {
  const accounts = record(value, "broad retained input").accounts;
  if (!Array.isArray(accounts)) throw new Error("broad retained input accounts must be an array");
  const account = accounts.find((candidate) => {
    const candidateRecord = record(candidate, "broad retained input account");
    return record(candidateRecord.request, "broad retained input request").accountId === UTAH_ACCOUNT_ID;
  });
  if (account === undefined) throw new Error("broad retained input does not contain the Utah account");
  return record(account, "Utah retained input");
}

function annotationFor(
  sources: readonly AdmittedAccountSource[],
  annotationId: string,
  kind: C2AccountHomeAnnotation["kind"],
  retrievalId: string,
  excerptIndexes: readonly number[],
  text: string,
): C2AccountHomeAnnotation {
  const source = sources.find((candidate) => candidate.retrievalId === retrievalId);
  if (source === undefined) throw new Error(`annotation source ${retrievalId} is not admitted`);
  const evidenceIds = excerptIndexes.map((index) => {
    const excerpt = source.excerpts[index];
    if (excerpt === undefined) throw new Error(`annotation excerpt ${retrievalId}[${String(index)}] is not admitted`);
    return excerpt.evidenceId;
  });
  return { annotationId, kind, sourceId: source.sourceId, evidenceIds, text };
}

function utahRendererAnnotations(sources: readonly AdmittedAccountSource[]): readonly C2AccountHomeAnnotation[] {
  return [
    annotationFor(sources, "utah-funding-table-header-caveat", "source_context_caveat", "retrieval-ut-s2", [1],
      "This excerpt is a table row captured without its column headers; the admitted evidence does not establish what either figure denotes."),
    annotationFor(sources, "utah-redtail-article-date-recheck", "freshness_recheck", "retrieval-owner-redtail-article", [0],
      "Publication, event, and evidence-current-through dates are not established for this retained Redtail source; recheck it before meeting use."),
    annotationFor(sources, "utah-redtail-chpc-date-recheck", "freshness_recheck", "retrieval-owner-redtail-chpc", [1],
      "Publication, event, and evidence-current-through dates are not established for this retained Redtail source; recheck it before meeting use."),
    annotationFor(sources, "utah-uhaiv-date-recheck", "freshness_recheck", "retrieval-owner-ai-vault", [0, 1],
      "Publication, event, and evidence-current-through dates are not established for this retained Utah Health AI Vault source; recheck it before meeting use."),
  ];
}

function assertEffectReceiptMatches(
  value: unknown,
  data: Pick<ValidatedAccountIntelligence, "request" | "discoveries" | "admittedSources">,
  retainedSourceCount: number,
): AccountIntelligenceEffectReceipt {
  const receipt = record(value, "effect receipt") as unknown as AccountIntelligenceEffectReceipt;
  if (receipt.kind !== "atliera.account-intelligence-effect-receipt" || receipt.schemaVersion !== "2" ||
      receipt.accountId !== data.request.accountId || receipt.recordedDiscoveryRecords !== data.discoveries.length ||
      receipt.retainedSourceCandidates !== retainedSourceCount || receipt.admittedSources !== data.admittedSources.length ||
      receipt.excludedSourceCandidates !== retainedSourceCount - data.admittedSources.length ||
      receipt.retainedCanonicalUrls.length !== data.admittedSources.length ||
      receipt.retainedCanonicalUrls.some((url, index) => url !== data.admittedSources[index]!.canonicalUrl)) {
    throw new Error("fresh effect receipt does not match source-derived admission");
  }
  return receipt;
}

export interface C2AccountHomeGenerationReceipt {
  readonly kind: "atliera.c2-account-home-render-receipt";
  readonly schemaVersion: "1";
  readonly accountId: typeof UTAH_ACCOUNT_ID;
  readonly broadInputSha256: string;
  readonly proposalSha256: string;
  readonly historicalEffectReceiptSha256: string;
  readonly admittedSources: number;
  readonly admittedExcerpts: number;
  readonly discoveryRecords: number;
  readonly rendererAnnotations: number;
  readonly providerCallsDuringGeneration: 0;
  readonly ratificationCreated: false;
  readonly htmlSha256: string;
}

/** Re-admits the broad retained Utah packet and renders the committed fresh proposal without provider execution. */
export async function generateFreshUtahC2AccountHome(outputDirectory: string): Promise<Readonly<C2AccountHomeGenerationReceipt>> {
  const output = resolve(outputDirectory);
  if (isAtOrBelow(FROZEN_C2_ROOT, output)) throw new Error("output directory must be outside the frozen C2 history");
  const [broadRaw, proposalRaw, effectReceiptRaw] = await Promise.all([
    readFile(BROAD_INPUT, "utf8"),
    readFile(FRESH_PROPOSAL, "utf8"),
    readFile(FRESH_EFFECT_RECEIPT, "utf8"),
  ]);
  const retained = utahAccountFromBroadInput(JSON.parse(broadRaw));
  const request = snapshotAccountResearchRequest(retained.request);
  const plan = createAccountResearchPlan(request);
  const policy = snapshotAdmittedResearchPolicy(retained.researchPolicy);
  const admitted = admitAccountResearch(request, plan, policy, retained.discoveries, retained.retrievedSources);
  const proposal = snapshotAccountIntelligenceProposal(JSON.parse(proposalRaw), request, admitted.sources);
  const retainedSourceCount = Array.isArray(retained.retrievedSources) ? retained.retrievedSources.length : -1;
  const effectReceipt = assertEffectReceiptMatches(JSON.parse(effectReceiptRaw), {
    request,
    discoveries: admitted.discoveries,
    admittedSources: admitted.sources,
  }, retainedSourceCount);
  const data: ValidatedAccountIntelligence = {
    request,
    plan,
    discoveries: admitted.discoveries,
    admittedSources: admitted.sources,
    researchPolicyReceipt: admitted.policyReceipt,
    proposal,
    effectReceipt,
  };
  const annotations = snapshotC2AccountHomeAnnotations(utahRendererAnnotations(admitted.sources), data);
  const html = renderC2AccountHome(data, annotations).html;
  const receipt: C2AccountHomeGenerationReceipt = {
    kind: "atliera.c2-account-home-render-receipt",
    schemaVersion: "1",
    accountId: UTAH_ACCOUNT_ID,
    broadInputSha256: sha256(broadRaw),
    proposalSha256: sha256(proposalRaw),
    historicalEffectReceiptSha256: sha256(effectReceiptRaw),
    admittedSources: admitted.sources.length,
    admittedExcerpts: admitted.sources.flatMap((source) => source.excerpts).length,
    discoveryRecords: admitted.discoveries.length,
    rendererAnnotations: annotations.length,
    providerCallsDuringGeneration: 0,
    ratificationCreated: false,
    htmlSha256: sha256(html),
  };
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(resolve(output, "university-of-utah.html"), html),
    writeFile(resolve(output, "university-of-utah-validated-result.json"), `${JSON.stringify(data, null, 2)}\n`),
    writeFile(resolve(output, "university-of-utah-renderer-annotations.json"), `${JSON.stringify(annotations, null, 2)}\n`),
    writeFile(resolve(output, "university-of-utah-render-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`),
  ]);
  return Object.freeze(receipt);
}

async function main(): Promise<void> {
  const [outputDirectory, ...extra] = process.argv.slice(2);
  if (outputDirectory === undefined || extra.length !== 0) {
    throw new Error("usage: generate-c2-account-home OUTPUT_DIRECTORY");
  }
  const receipt = await generateFreshUtahC2AccountHome(outputDirectory);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
