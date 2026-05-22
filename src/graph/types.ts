// Atliera Graph primitive types.
//
// Carried forward from the A.5-A.7 evidence-graph design as a conceptual
// blueprint, re-implemented fresh against Atliera's own naming and module
// boundaries. There is no compatibility shim to any legacy report shape.

export type ISOTimestamp = string;

export type ProvenanceStatus =
  | "verified"
  | "source_document_only"
  | "unverified"
  | "unsupported"
  | "stale";

export type ClaimStatus =
  | "active"
  | "stale"
  | "contradicted"
  | "rejected"
  | "superseded";

export type ExcerptValidationStatus = "accepted" | "rejected" | "proposed";

export type ExcerptKind = "literal" | "paraphrase";

export type ClaimEvidenceRelationship = "supports" | "contradicts" | "context";

export type AccountObjectKind =
  | "account_snapshot"
  | "signal"
  | "stakeholder"
  | "initiative"
  | "risk"
  | "open_question"
  | "play"
  | "recommendation";

export type AccountObjectClaimRelationship = "primary" | "supporting" | "context";

export type ActorType = "model" | "user" | "system" | "import";

export interface SourceDocument {
  id: string;
  team_id: string;
  account_id: string;
  url: string;
  canonical_url: string;
  title: string;
  publisher: string | null;
  source_type: string;
  fetched_at: ISOTimestamp;
  accessed_at: ISOTimestamp;
  content_hash: string;
  raw_text: string;
  reliability: "high" | "medium" | "low" | "unknown";
  status: "active" | "stale" | "unavailable" | "rejected";
}

export interface EvidenceExcerpt {
  id: string;
  source_document_id: string;
  text: string;
  // `kind` records whether the excerpt is meant to be a literal span of
  // the source text or a paraphrase. Only literal excerpts may ever be
  // accepted; paraphrases must stay as proposals or be rejected.
  kind: ExcerptKind;
  char_start: number;
  char_end: number;
  captured_at: ISOTimestamp;
  validation_status: ExcerptValidationStatus;
  rejection_reason: string | null;
}

export interface Claim {
  id: string;
  team_id: string;
  account_id: string;
  claim_type: string;
  text: string;
  normalized_subject: string;
  confidence: "high" | "medium" | "low";
  provenance_status: ProvenanceStatus;
  status: ClaimStatus;
  created_by: ActorType;
  created_at: ISOTimestamp;
}

export interface ClaimEvidence {
  id: string;
  claim_id: string;
  evidence_excerpt_id: string;
  relationship: ClaimEvidenceRelationship;
  rationale: string;
  confidence: "high" | "medium" | "low";
  created_at: ISOTimestamp;
}

export interface AccountObject {
  id: string;
  team_id: string;
  account_id: string;
  object_type: AccountObjectKind;
  title: string;
  summary: string;
  payload_json: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  provenance_status: ProvenanceStatus;
  status: "active" | "stale" | "rejected" | "superseded";
  created_by: ActorType;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
}

export interface AccountObjectClaim {
  id: string;
  account_object_id: string;
  claim_id: string;
  relationship: AccountObjectClaimRelationship;
}

export type ResearchRunMode = "fixture" | "fake" | "model";

export interface ResearchRun {
  id: string;
  team_id: string;
  account_id: string;
  mode: ResearchRunMode;
  provider: string | null;
  model: string | null;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  cost_cap_usd: number;
  observed_cost_usd: number;
  started_at: ISOTimestamp | null;
  completed_at: ISOTimestamp | null;
}

export interface RunArtifact {
  id: string;
  research_run_id: string;
  artifact_type: string;
  payload_json: Record<string, unknown>;
  created_at: ISOTimestamp;
}

export interface AuditEvent {
  id: string;
  team_id: string;
  actor_type: ActorType;
  actor_id: string;
  event_type: string;
  target_type: string;
  target_id: string;
  payload_json: Record<string, unknown>;
  created_at: ISOTimestamp;
}

// A bundle of records produced by one ResearchRun and submitted to the
// validator together. Validators operate over the entire bundle so they
// can resolve references locally without needing a database.
export interface GraphBundle {
  sources: SourceDocument[];
  excerpts: EvidenceExcerpt[];
  claims: Claim[];
  claim_evidence: ClaimEvidence[];
  account_objects: AccountObject[];
  account_object_claims: AccountObjectClaim[];
  research_runs: ResearchRun[];
  run_artifacts: RunArtifact[];
  audit_events: AuditEvent[];
}

// Optional lens-style output (Signals / Maps / Plays) shown in the UI.
// Items must reference graph records by ID. Validators reject lens items
// marked `verified` that don't map to a verified underlying record.
export type LensName = "signals" | "maps" | "plays";

export interface LensItem {
  label: string;
  account_object_id: string | null;
  claim_id: string | null;
  status: "verified" | "inferred" | "unsupported" | "note";
}

export interface LensOutput {
  lens: LensName;
  items: LensItem[];
}
