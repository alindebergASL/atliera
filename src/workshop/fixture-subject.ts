import type { GraphBundle } from "../graph/types.ts";
import {
  inspectGraphSubject,
  type SubjectScope,
} from "../graph/subject.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import { WorkshopGraphValidationError } from "./view-model.ts";

/**
 * Fixture-only escape hatch for committed corpora whose manifests predate an
 * explicit subject field. Production and caller-supplied preview paths must
 * receive SubjectScope from their own authority boundary instead.
 */
export function deriveFixtureOnlySingleSubjectAfterValidation(
  bundle: GraphBundle,
): SubjectScope {
  const validation = validateGraphBundle(bundle, { mode: "fixture" });
  if (!validation.ok) {
    throw new WorkshopGraphValidationError(validation);
  }

  const inspection = inspectGraphSubject(bundle);
  if (inspection.unique_scope === null) {
    throw new Error(
      "fixture-only Workshop projection requires exactly one team/account subject",
    );
  }
  return inspection.unique_scope;
}
