import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { consumeM4GateBGo } from "../src/capability/m4-sec-gate-b-activation.ts";
import { createM4SecGateBKernel } from "../src/capability/m4-sec-gate-b-mediation.ts";
import { M4_TARGET_POLICY_SHA256 } from "../src/capability/m4-target-policy.ts";
import { extractM4SecEvidence, renderM4SecWorkshopEvidence } from "../src/capability/m4-sec-extraction.ts";
import { validateM4SecUserAgent } from "../src/capability/public-http-fetch-policy.ts";

const goPath = process.argv[2];
const userAgent = process.env.ATLIERA_M4_SEC_USER_AGENT;
if (!goPath) throw new Error("private Gate B GO JSON path required");
if (validateM4SecUserAgent(userAgent) === null) throw new Error("M4 SEC User-Agent refused");
const reviewedAdapterCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const checkoutStatus = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (!/^[a-f0-9]{40}$/.test(reviewedAdapterCommit) || checkoutStatus !== "") {
  throw new Error("Gate B requires the exact clean reviewed adapter checkout");
}
const outputDirectory = resolve("artifacts/m4-sec-gate-b");
mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
if (realpathSync(outputDirectory) !== outputDirectory) throw new Error("Gate B output directory refused");
const custodyPath = resolve(outputDirectory, "sec-fedex-submissions-custody.json");
const workshopPath = resolve(outputDirectory, "sec-fedex-submissions-workshop.html");
if (existsSync(custodyPath) || existsSync(workshopPath)) throw new Error("Gate B output already exists");
const activation = consumeM4GateBGo(resolve(goPath), reviewedAdapterCommit); // consumed before DNS, including failed attempts
const kernel = createM4SecGateBKernel({ activation, userAgent,
  clock: Object.freeze({ nowIso: () => new Date().toISOString(), monotonicMs: () => Math.floor(performance.now()) }) });
const result = await kernel.invoke({ trigger: { kind: "external_gate_b_one_shot_go",
  authorizationId: activation.authorizationId, oneShotConsumptionId: activation.oneShotConsumptionId },
input: { targetRef: "sec_fedex_submissions", targetPolicySha256: M4_TARGET_POLICY_SHA256 } });
if (!result.ok || !result.invoked || result.output === null || result.capabilityExecutions.length !== 1 ||
    result.auditEvents.length !== 1 || result.accountingIncrements.length !== 1 ||
    result.capabilityExecutions[0].outcome !== "completed") {
  throw new Error(`M4 SEC one-shot refused: ${result.ok ? result.capabilityExecutions[0]?.refusalCode : result.refusalCode}`);
}
const excerpt = extractM4SecEvidence(result.output);
const custody = { kind: "m4-sec-gate-b-custody", activation: { authorizationId: activation.authorizationId,
  oneShotConsumptionId: activation.oneShotConsumptionId, reviewedAdapterCommit: activation.reviewedAdapterCommit,
  authorizedAt: activation.authorizedAt, validFrom: activation.validFrom, validUntil: activation.validUntil,
  consumedAt: activation.consumedAt, consumptionSha256: activation.consumptionSha256 },
targetPolicySha256: M4_TARGET_POLICY_SHA256, acquiredAt: result.output.fetchedAt, acquisition: result.output,
extraction: excerpt, capabilityExecutions: result.capabilityExecutions, auditEvents: result.auditEvents,
accountingIncrements: result.accountingIncrements };
let custodyDescriptor: number | undefined; let workshopDescriptor: number | undefined;
let custodyCreated = false; let workshopCreated = false;
try {
  custodyDescriptor = openSync(custodyPath, "wx", 0o600); custodyCreated = true;
  workshopDescriptor = openSync(workshopPath, "wx", 0o600); workshopCreated = true;
  writeFileSync(custodyDescriptor, `${JSON.stringify(custody, null, 2)}\n`, "utf8");
  writeFileSync(workshopDescriptor, renderM4SecWorkshopEvidence(excerpt), "utf8");
  fsyncSync(custodyDescriptor); fsyncSync(workshopDescriptor);
  closeSync(custodyDescriptor); custodyDescriptor = undefined;
  closeSync(workshopDescriptor); workshopDescriptor = undefined;
  const outputDirectoryDescriptor = openSync(outputDirectory, "r");
  try { fsyncSync(outputDirectoryDescriptor); } finally { closeSync(outputDirectoryDescriptor); }
} catch (error) {
  if (workshopDescriptor !== undefined) { try { closeSync(workshopDescriptor); } catch { /* cleanup */ } }
  if (custodyDescriptor !== undefined) { try { closeSync(custodyDescriptor); } catch { /* cleanup */ } }
  if (workshopCreated) rmSync(workshopPath, { force: true });
  if (custodyCreated) rmSync(custodyPath, { force: true });
  throw error;
}
