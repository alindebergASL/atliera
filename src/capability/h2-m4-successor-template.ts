/** Historical H2 successor surface, updated when the authorized M4 slice superseded it. */
export const H2_M4_SUCCESSOR_TEMPLATE = Object.freeze({
  kind: "h2-m4-successor-status" as const,
  capabilityId: "public_http_fetch_v1" as const,
  status: "superseded-by-authorized-m4-implementation" as const,
  protocolSpecVersion: "2025-11-25" as const,
  fetcherImplementationExists: true as const,
  registered: true as const,
  executable: "recorded-injected-proof-only" as const,
  serverSelection: "minimal-first-party" as const,
  exactTargets: 1 as const,
  liveAcquisitionAuthorized: false as const,
  liveAcquisitionGate: "later-explicit-operator-go" as const,
});

export type H2M4SuccessorTemplate = typeof H2_M4_SUCCESSOR_TEMPLATE;
