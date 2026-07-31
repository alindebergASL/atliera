import type { GraphBundle } from "./types.ts";

/**
 * The explicit team/account boundary for account-scoped graph consumers.
 *
 * This is intentionally independent of any candidate envelope so later
 * validation boundaries can carry the same subject contract without changing
 * GraphBundle itself.
 */
export interface SubjectScope {
  readonly team_id: string;
  readonly account_id: string;
}

export interface AccountBearingGraphRecord extends SubjectScope {
  readonly record_kind:
    | "source_document"
    | "claim"
    | "account_object"
    | "research_run";
  readonly record_id: string;
}

export interface GraphSubjectInspection {
  /** Teams on account-bearing graph records; audit events are reported separately. */
  readonly team_ids: readonly string[];
  readonly account_ids: readonly string[];
  readonly audit_team_ids: readonly string[];
  /** Present only when both the team and account are unambiguous. */
  readonly unique_scope: SubjectScope | null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function getAccountBearingGraphRecords(
  bundle: GraphBundle,
): AccountBearingGraphRecord[] {
  return [
    ...bundle.sources.map((record) => ({
      record_kind: "source_document" as const,
      record_id: record.id,
      team_id: record.team_id,
      account_id: record.account_id,
    })),
    ...bundle.claims.map((record) => ({
      record_kind: "claim" as const,
      record_id: record.id,
      team_id: record.team_id,
      account_id: record.account_id,
    })),
    ...bundle.account_objects.map((record) => ({
      record_kind: "account_object" as const,
      record_id: record.id,
      team_id: record.team_id,
      account_id: record.account_id,
    })),
    ...bundle.research_runs.map((record) => ({
      record_kind: "research_run" as const,
      record_id: record.id,
      team_id: record.team_id,
      account_id: record.account_id,
    })),
  ];
}

export function inspectGraphSubject(
  bundle: GraphBundle,
): GraphSubjectInspection {
  const accountRecords = getAccountBearingGraphRecords(bundle);
  const teamIds = uniqueSorted(accountRecords.map((record) => record.team_id));
  const accountIds = uniqueSorted(
    accountRecords.map((record) => record.account_id),
  );
  const auditTeamIds = uniqueSorted(
    bundle.audit_events.map((record) => record.team_id),
  );

  return {
    team_ids: teamIds,
    account_ids: accountIds,
    audit_team_ids: auditTeamIds,
    unique_scope:
      teamIds.length === 1 && accountIds.length === 1
        ? {
            team_id: teamIds[0]!,
            account_id: accountIds[0]!,
          }
        : null,
  };
}
