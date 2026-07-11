import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { H2_M4_SUCCESSOR_TEMPLATE } from "../../src/capability/h2-m4-successor-template.ts";
import { generateH2EchoMediationProof } from "../../src/capability/h2-proof.ts";
import { H2_CAPABILITY_REGISTRY } from "../../src/capability/h2-registry.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const FIXTURE_PATH = join(ROOT, "fixtures", "validation", "h2-echo-mediation-proof.json");

test("visible H2 proof artifact is deterministic and records the complete one-shot mediation result", async () => {
  const first = await generateH2EchoMediationProof();
  const second = await generateH2EchoMediationProof();
  const committed = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Record<string, unknown>;
  assert.deepEqual(first, second);
  assert.deepEqual(first, committed);

  const executions = first.capabilityExecutions as unknown[];
  const audits = first.auditEvents as unknown[];
  const accounting = first.accountingIncrements as unknown[];
  assert.equal(executions.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(accounting.length, 1);
  assert.deepEqual(first.echoInput, first.echoOutput);
  assert.equal((executions[0] as Record<string, unknown>).outcome, "completed");
  assert.equal((executions[0] as Record<string, unknown>).retryCount, 0);
  assert.deepEqual(first.effects, {
    retries: 0,
    network: 0,
    systemSideAcquisition: 0,
    providerCalls: 0,
    privateReads: 0,
    filesystemOperations: 0,
    environmentReads: 0,
    databaseOperations: 0,
    subprocesses: 0,
    productionWrites: 0,
    deployments: 0,
  });
});

test("historical H2 successor surface records the authorized M4 implementation without live authority", () => {
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.capabilityId, "public_http_fetch_v1");
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.status, "superseded-by-authorized-m4-implementation");
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.fetcherImplementationExists, true);
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.registered, true);
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.executable, "recorded-injected-proof-only");
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.serverSelection, "minimal-first-party");
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.exactTargets, 1);
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.liveAcquisitionAuthorized, false);
  assert.equal(H2_M4_SUCCESSOR_TEMPLATE.liveAcquisitionGate, "later-explicit-operator-go");
  assert.equal(H2_CAPABILITY_REGISTRY.length, 2);
  assert.equal(H2_CAPABILITY_REGISTRY[1].capabilityId, H2_M4_SUCCESSOR_TEMPLATE.capabilityId);
});
