// Validation report shape.
//
// Hard failures are separated from quality metrics. The aggregator can
// grow over time (Phase 2+ will add accepted-excerpt rate, lens coverage,
// etc.) without breaking the shape that callers already consume.

export type HardFailureCode =
  | "schema_parse_failure"
  | "unknown_field"
  | "invalid_id_format"
  | "wrong_id_prefix"
  | "duplicate_id"
  | "invented_source_document_id"
  | "invented_evidence_excerpt_id"
  | "invented_claim_id"
  | "invented_claim_evidence_id"
  | "invented_account_object_id"
  | "invented_account_object_claim_id"
  | "dangling_reference"
  | "excerpt_text_not_found_in_source"
  | "excerpt_span_out_of_bounds"
  | "excerpt_span_text_mismatch"
  | "accepted_paraphrase"
  | "verified_claim_without_evidence"
  | "verified_object_without_supporting_claim"
  | "lens_unsupported_prose_marked_verified"
  | "production_write_in_validation_mode"
  | "provider_call_outside_model_mode"
  | "provider_sdk_loaded_in_safe_mode";

export interface HardFailure {
  code: HardFailureCode;
  message: string;
  record_kind?: string;
  record_id?: string;
  field?: string;
}

export interface QualityMetrics {
  total_sources: number;
  total_excerpts: number;
  accepted_excerpts: number;
  rejected_excerpts: number;
  proposed_excerpts: number;
  total_claims: number;
  verified_claims: number;
  total_account_objects: number;
  verified_account_objects: number;
}

export interface ValidationReport {
  ok: boolean;
  hard_failures: HardFailure[];
  metrics: QualityMetrics;
}

export function emptyMetrics(): QualityMetrics {
  return {
    total_sources: 0,
    total_excerpts: 0,
    accepted_excerpts: 0,
    rejected_excerpts: 0,
    proposed_excerpts: 0,
    total_claims: 0,
    verified_claims: 0,
    total_account_objects: 0,
    verified_account_objects: 0,
  };
}
