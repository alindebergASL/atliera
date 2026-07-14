import { closeSync, fstatSync, fsyncSync, ftruncateSync, lstatSync, openSync, realpathSync, writeFileSync,
  writeSync } from "node:fs";
import { join, resolve } from "node:path";

import type { M4MediationResult } from "./m4-public-http-fetch-mediation.ts";
import { extractM4SecEvidence, renderM4SecWorkshopEvidence } from "./m4-sec-extraction.ts";
import {
  M4_GATE_B_EXPECTED_ATTEMPT_OUTPUT,
  M4_GATE_B_EXPECTED_CUSTODY_OUTPUT,
  M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT,
  type M4GateBActivation,
} from "./m4-sec-gate-b-activation.ts";
import { M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";

const ATTEMPT_NAME = M4_GATE_B_EXPECTED_ATTEMPT_OUTPUT.split("/").at(-1)!;
const CUSTODY_NAME = M4_GATE_B_EXPECTED_CUSTODY_OUTPUT.split("/").at(-1)!;
const WORKSHOP_NAME = M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT.split("/").at(-1)!;

type InvokedM4Result = Extract<M4MediationResult, { ok: true; invoked: true }>;
type Identity = Readonly<{ dev: number; ino: number }>;

export interface M4GateBArtifactReservation {
  readonly paths: Readonly<{ attempt: string; custody: string; workshop: string }>;
  assertIntact(): void;
  persistInvokedResult(activation: Readonly<M4GateBActivation>, result: InvokedM4Result): void;
  releaseWithoutInvocation(): void;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try { closeSync(descriptor); } catch { /* fail-closed cleanup */ }
}

function identity(descriptor: number): Identity {
  const value = fstatSync(descriptor);
  return Object.freeze({ dev: value.dev, ino: value.ino });
}

function pathMatches(path: string, expected: Identity, kind: "file" | "directory"): boolean {
  try {
    const value = lstatSync(path);
    return value.dev === expected.dev && value.ino === expected.ino &&
      (kind === "file" ? value.isFile() : value.isDirectory()) && !value.isSymbolicLink();
  } catch { return false; }
}

function writeUtf8AtStart(descriptor: number, content: string): void {
  const bytes = Buffer.from(content, "utf8");
  ftruncateSync(descriptor, 0);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
    if (written <= 0) throw new Error("Gate B artifact write refused");
    offset += written;
  }
  fsyncSync(descriptor);
}

function emptyAndSync(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try { ftruncateSync(descriptor, 0); fsyncSync(descriptor); } catch { /* preserve original failure */ }
}

/** Exclusively claims all Gate B output names before GO consumption or network construction. */
export function reserveM4GateBArtifactOutputs(outputDirectoryInput: string): M4GateBArtifactReservation {
  const outputDirectory = resolve(outputDirectoryInput);
  if (realpathSync(outputDirectory) !== outputDirectory) throw new Error("Gate B artifact reservation refused");
  const paths = Object.freeze({ attempt: join(outputDirectory, ATTEMPT_NAME), custody: join(outputDirectory, CUSTODY_NAME),
    workshop: join(outputDirectory, WORKSHOP_NAME) });
  let directoryDescriptor: number | undefined; let attemptDescriptor: number | undefined;
  let custodyDescriptor: number | undefined; let workshopDescriptor: number | undefined; let settled = false;
  try {
    directoryDescriptor = openSync(outputDirectory, "r");
    attemptDescriptor = openSync(paths.attempt, "wx", 0o600);
    custodyDescriptor = openSync(paths.custody, "wx", 0o600);
    workshopDescriptor = openSync(paths.workshop, "wx", 0o600);
    fsyncSync(directoryDescriptor);
  } catch {
    closeQuietly(workshopDescriptor); closeQuietly(custodyDescriptor); closeQuietly(attemptDescriptor);
    if (directoryDescriptor !== undefined) { try { fsyncSync(directoryDescriptor); } catch { /* fail closed */ } }
    closeQuietly(directoryDescriptor);
    // Deliberately leave any empty names created by this failed reservation. Pathname unlink is racy;
    // fail-closed tombstones require explicit operator inspection/removal before any later attempt.
    throw new Error("Gate B artifact reservation refused");
  }
  const directoryIdentity = identity(directoryDescriptor);
  const attemptIdentity = identity(attemptDescriptor);
  const custodyIdentity = identity(custodyDescriptor);
  const workshopIdentity = identity(workshopDescriptor);

  const assertCanonical = () => {
    if (!pathMatches(outputDirectory, directoryIdentity, "directory") ||
        !pathMatches(paths.attempt, attemptIdentity, "file") ||
        !pathMatches(paths.custody, custodyIdentity, "file") ||
        !pathMatches(paths.workshop, workshopIdentity, "file")) {
      throw new Error("Gate B artifact reservation identity refused");
    }
  };
  const syncDirectory = () => { fsyncSync(directoryDescriptor!); };
  const closeAll = () => {
    closeQuietly(workshopDescriptor); workshopDescriptor = undefined;
    closeQuietly(custodyDescriptor); custodyDescriptor = undefined;
    closeQuietly(attemptDescriptor); attemptDescriptor = undefined;
    closeQuietly(directoryDescriptor); directoryDescriptor = undefined;
  };
  const leaveEvidenceEmpty = () => { emptyAndSync(custodyDescriptor); emptyAndSync(workshopDescriptor); };
  const writeAttemptReceipt = (activation: Readonly<M4GateBActivation>, result: InvokedM4Result,
    status: "failed_no_evidence" | "completed_evidence_persisted" | "effect_completed_artifact_persistence_failed") => {
    if (attemptDescriptor === undefined) throw new Error("Gate B attempt receipt unavailable");
    const receipt = {
      kind: "m4-sec-gate-b-attempt-receipt", status,
      activation: { authorizationId: activation.authorizationId, oneShotConsumptionId: activation.oneShotConsumptionId,
        reviewedAdapterCommit: activation.reviewedAdapterCommit, authorizedAt: activation.authorizedAt,
        validFrom: activation.validFrom, validUntil: activation.validUntil, consumedAt: activation.consumedAt,
        consumptionSha256: activation.consumptionSha256, goSha256: activation.goSha256,
        userAgentSha256: activation.userAgentSha256, userAgentByteLength: activation.userAgentByteLength },
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      evidenceArtifactsPersisted: status === "completed_evidence_persisted",
      failurePhase: status === "effect_completed_artifact_persistence_failed" ? "custody_finalization" :
        result.capabilityExecutions[0].effectTelemetry.failurePhase,
      capabilityExecutions: result.capabilityExecutions,
      auditEvents: result.auditEvents,
      accountingIncrements: result.accountingIncrements,
    };
    writeUtf8AtStart(attemptDescriptor, `${JSON.stringify(receipt, null, 2)}\n`);
  };

  assertCanonical();
  return Object.freeze({
    paths,
    assertIntact() { if (settled) throw new Error("Gate B artifact reservation already settled"); assertCanonical(); },
    persistInvokedResult(activation: Readonly<M4GateBActivation>, result: InvokedM4Result) {
      if (settled) throw new Error("Gate B artifact reservation already settled");
      settled = true;
      const execution = result.capabilityExecutions[0];
      const completed = result.output !== null && execution.outcome === "completed";
      if (!completed) {
        writeAttemptReceipt(activation, result, "failed_no_evidence");
        leaveEvidenceEmpty();
        try { assertCanonical(); syncDirectory(); }
        catch (error) { try { syncDirectory(); } finally { closeAll(); } throw error; }
        closeAll();
        return;
      }
      try {
        assertCanonical();
        const excerpt = extractM4SecEvidence(result.output!);
        const custody = { kind: "m4-sec-gate-b-custody", activation: { authorizationId: activation.authorizationId,
          oneShotConsumptionId: activation.oneShotConsumptionId, reviewedAdapterCommit: activation.reviewedAdapterCommit,
          authorizedAt: activation.authorizedAt, validFrom: activation.validFrom, validUntil: activation.validUntil,
          consumedAt: activation.consumedAt, consumptionSha256: activation.consumptionSha256,
          userAgentSha256: activation.userAgentSha256, userAgentByteLength: activation.userAgentByteLength },
        targetPolicySha256: M4_TARGET_POLICY_SHA256, acquiredAt: result.output!.fetchedAt, acquisition: result.output,
        extraction: excerpt, capabilityExecutions: result.capabilityExecutions, auditEvents: result.auditEvents,
        accountingIncrements: result.accountingIncrements };
        writeFileSync(custodyDescriptor!, `${JSON.stringify(custody, null, 2)}\n`, "utf8");
        writeFileSync(workshopDescriptor!, renderM4SecWorkshopEvidence(excerpt), "utf8");
        fsyncSync(custodyDescriptor!); fsyncSync(workshopDescriptor!); assertCanonical();
        writeAttemptReceipt(activation, result, "completed_evidence_persisted");
        assertCanonical(); syncDirectory(); closeAll();
      } catch (error) {
        leaveEvidenceEmpty();
        try { writeAttemptReceipt(activation, result, "effect_completed_artifact_persistence_failed"); syncDirectory(); }
        catch { /* preserve original failure; storage failure cannot be repaired here */ }
        closeAll();
        throw error;
      }
    },
    releaseWithoutInvocation() {
      if (settled) return;
      settled = true;
      emptyAndSync(attemptDescriptor); leaveEvidenceEmpty();
      try { assertCanonical(); syncDirectory(); } catch { /* fail closed; never unlink a pathname */ }
      closeAll();
    },
  });
}
