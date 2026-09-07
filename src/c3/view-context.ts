import type { C3AccountContext, C3RetainedSource } from "./context.ts";

/** Read-only common projection, not an admission contract. Legacy contexts pass through unchanged. */
export type C3ViewSource = Pick<C3RetainedSource, "sourceId" | "entity" | "canonicalUrl" | "title" | "publisher" |
  "publicationDate" | "eventDate" | "evidenceCurrentThrough" | "retrievedAt" | "retrievedContentSha256" |
  "retrievedByteSize" | "fullBoundedCleanText"> & {
  readonly untrustedInstructionsDetected: boolean | null;
  readonly excerpts: readonly Pick<C3RetainedSource["excerpts"][number], "evidenceId" | "sourceId" | "exactExcerpt" |
    "exactExcerptSha256" | "sourceCharStart" | "sourceCharEnd">[];
};
export interface C3ViewContext extends Omit<C3AccountContext, "admittedSources" | "proposal" | "ownerDecisionSource" | "custody"> {
  /** Historical property name only: curated sources have NOT been admitted. */
  readonly admittedSources: readonly C3ViewSource[];
  readonly proposal: Pick<C3AccountContext["proposal"], "accountThesis" | "establishedContext" | "meaningfullyChanged" |
    "whyChangeMayMatter" | "stillOpenQuestions" | "recommendedNextMove">;
  readonly ownerDecisionSource: C3AccountContext["ownerDecisionSource"] | null;
  readonly custody: Omit<C3AccountContext["custody"], "policyReceipt"> & { readonly policyReceipt: C3AccountContext["custody"]["policyReceipt"] | null };
  readonly provenance?: { readonly kind: "agent_curated_proposed_template"; readonly modelGenerated: false;
    readonly humanApproved: false; readonly owner: null; readonly meetingDate: null };
}
export interface FrozenC3ViewContext { readonly context: Readonly<C3ViewContext>; readonly canonicalJson: string; readonly sha256: string; }
export function isCuratedContext(context: FrozenC3ViewContext): boolean {
  return context.context.provenance?.kind === "agent_curated_proposed_template";
}
export function assertC3GenerationContext(context: FrozenC3ViewContext): void {
  if (isCuratedContext(context) || context.context.ownerDecisionSource === null || context.context.custody.policyReceipt === null) {
    throw new Error("Agent-curated context is template-only: live generation and recorded-model claims are unavailable");
  }
}
