export interface H2M4SuccessorTemplate {
  readonly kind: "unregistered-m4-capability-successor-template";
  readonly capabilityId: "public_http_fetch_v1";
  readonly status: "draft-inert-unregistered";
  readonly protocolSpecVersion: "2025-11-25";
  readonly fetcherImplementationExists: false;
  readonly registered: false;
  readonly executable: false;
  readonly forkVersusBuild: "undecided";
  readonly exactTargets: "unset";
  readonly descriptorDraft: {
    readonly title: "Public HTTP fetch v1";
    readonly input: "ratified-target-reference-shape-unset";
    readonly output: "provenance-custody-shape-unset";
  };
  readonly proposedBudgetDefaults: {
    readonly maxTargets: 1;
    readonly retryBudget: 0;
    readonly maxResponseBytes: 1000000;
    readonly timeoutMs: 10000;
    readonly redirectLimit: 0;
  };
  readonly operatorDecisionsRequired: readonly ["robots", "retention", "takedown"];
  readonly implementationGate: "fresh-operator-roadmap-decision-after-h2-merge-and-independent-review";
  readonly liveAcquisitionGate: "later-compact-packet-and-explicit-go";
}

export const H2_M4_SUCCESSOR_TEMPLATE: H2M4SuccessorTemplate = Object.freeze({
  kind: "unregistered-m4-capability-successor-template",
  capabilityId: "public_http_fetch_v1",
  status: "draft-inert-unregistered",
  protocolSpecVersion: "2025-11-25",
  fetcherImplementationExists: false,
  registered: false,
  executable: false,
  forkVersusBuild: "undecided",
  exactTargets: "unset",
  descriptorDraft: Object.freeze({
    title: "Public HTTP fetch v1",
    input: "ratified-target-reference-shape-unset",
    output: "provenance-custody-shape-unset",
  }),
  proposedBudgetDefaults: Object.freeze({
    maxTargets: 1,
    retryBudget: 0,
    maxResponseBytes: 1000000,
    timeoutMs: 10000,
    redirectLimit: 0,
  }),
  operatorDecisionsRequired: Object.freeze(["robots", "retention", "takedown"]) as readonly [
    "robots",
    "retention",
    "takedown",
  ],
  implementationGate: "fresh-operator-roadmap-decision-after-h2-merge-and-independent-review",
  liveAcquisitionGate: "later-compact-packet-and-explicit-go",
});
