import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reserveM4GateBArtifactOutputs } from "../src/capability/m4-sec-gate-b-artifacts.ts";
import { consumeM4GateBGo } from "../src/capability/m4-sec-gate-b-activation.ts";
import { createM4SecGateBKernel } from "../src/capability/m4-sec-gate-b-mediation.ts";
import { M4_TARGET_POLICY_SHA256 } from "../src/capability/m4-target-policy.ts";
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
const reservation = reserveM4GateBArtifactOutputs(outputDirectory); // atomically reserve before GO consumption or network
reservation.assertIntact();
let activation;
try {
  activation = consumeM4GateBGo(resolve(goPath), reviewedAdapterCommit, userAgent);
} catch (error) {
  reservation.releaseWithoutInvocation();
  throw error;
}
let result;
try {
  reservation.assertIntact(); // revalidate after GO consumption and immediately before kernel/network construction
  const kernel = createM4SecGateBKernel({ activation, userAgent,
    clock: Object.freeze({ nowIso: () => new Date().toISOString(), monotonicMs: () => Math.floor(performance.now()) }) });
  result = await kernel.invoke({ trigger: { kind: "external_gate_b_one_shot_go",
    authorizationId: activation.authorizationId, oneShotConsumptionId: activation.oneShotConsumptionId },
  input: { targetRef: "sec_fedex_submissions", targetPolicySha256: M4_TARGET_POLICY_SHA256 } });
} catch (error) {
  reservation.releaseWithoutInvocation();
  throw error;
}
if (!result.ok || !result.invoked) {
  reservation.releaseWithoutInvocation();
  throw new Error(`M4 SEC one-shot refused before invocation: ${result.refusalCode}`);
}
reservation.persistInvokedResult(activation, result); // durable for completed and failed live outcomes before any throw
if (result.output === null || result.capabilityExecutions[0].outcome !== "completed") {
  throw new Error(`M4 SEC one-shot failed after invocation: ${result.capabilityExecutions[0].refusalCode}`);
}
