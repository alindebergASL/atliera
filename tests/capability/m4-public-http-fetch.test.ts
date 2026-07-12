import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getH2CapabilityRegistryEntry, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID, sha256Canonical } from "../../src/capability/h2-registry.ts";
import { M4_RECORDED_PROOF_SCHEDULE, M4_RECORDED_PROOF_SCHEDULE_SHA256 } from "../../src/capability/m4-recorded-proof-schedule.ts";
import { createM4RecordedProofKernel, getM4PublicHttpFetchKernel } from "../../src/capability/m4-public-http-fetch-mediation.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "../../src/capability/m4-target-policy.ts";
import { acquireM4ProofRecordedEvidence, M4_MAX_BODY_BYTES, M4_TARGET_URL, isPublicAddress, validateM4PublicTargetUrl } from "../../src/capability/public-http-fetch-policy.ts";

function exchange(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { fetchedAt: "2026-07-11T11:59:59.000Z", resolvedAddresses: ["104.16.1.1"], status: 200,
    contentType: "text/plain; charset=utf-8", location: null, connectedAddress: "104.16.1.1",
    finalUrl: M4_TARGET_URL, bodyBase64: Buffer.from("recorded").toString("base64"), cancelAt: "none", ...overrides };
}
function clock(): Record<string, unknown> {
  return { wallClockIso: ["2026-07-11T12:00:02.000Z", "2026-07-11T12:00:02.000Z", "2026-07-11T12:00:02.009Z"],
    monotonicMs: [1000, 1009] };
}
function invocation(hash: unknown = M4_TARGET_POLICY_SHA256): Record<string, unknown> {
  return { trigger: { kind: "approved_recorded_schedule", scheduleId: M4_RECORDED_PROOF_SCHEDULE.scheduleId },
    input: { targetRef: "fedex_company_overview", targetPolicySha256: hash } };
}

test("production access is one module singleton and proof construction cannot reset it", async () => {
  const first = getM4PublicHttpFetchKernel();
  createM4RecordedProofKernel(exchange(), clock());
  createM4RecordedProofKernel(exchange({ bodyBase64: "" }), clock());
  assert.equal(getM4PublicHttpFetchKernel(), first);
  assert.equal(getM4PublicHttpFetchKernel(), getM4PublicHttpFetchKernel());
  const result = await first.invoke(invocation());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusalCode, "schedule_not_approved");
});

test("proof surface rejects executable DNS, HTTP, clock, transport, and caller provenance inputs", () => {
  for (const hostile of [
    { ...exchange(), dns: async () => [] }, { ...exchange(), http: async () => ({}) },
    { ...exchange(), transportKind: "live" }, { ...exchange(), transport: { request() {} } },
  ]) assert.throws(() => createM4RecordedProofKernel(hostile, clock()), /unsafe recorded exchange/);
  assert.throws(() => createM4RecordedProofKernel(exchange(), { ...clock(), now: () => new Date() }), /invalid invocation/);
  let getterCalls = 0;
  const hostile = Object.defineProperty({ ...exchange() }, "bodyBase64", { enumerable: true, get() { getterCalls++; return ""; } });
  assert.throws(() => createM4RecordedProofKernel(hostile, clock()), /unsafe recorded exchange/);
  assert.throws(() => acquireM4ProofRecordedEvidence("fedex_company_overview", hostile), /unsafe recorded exchange/);
  assert.equal(getterCalls, 0);
});

test("canonical target policy hash is independently pinned by registry, schedule, and invocation", async () => {
  const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
  assert.equal(registry.targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(sha256Canonical(M4_CANONICAL_TARGET_POLICY), M4_TARGET_POLICY_SHA256);
  assert.equal(M4_RECORDED_PROOF_SCHEDULE.targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(sha256Canonical(M4_RECORDED_PROOF_SCHEDULE), M4_RECORDED_PROOF_SCHEDULE_SHA256);
  assert.equal(Object.isFrozen(M4_CANONICAL_TARGET_POLICY), true);
  assert.equal(Object.isFrozen(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv4), true);
  assert.equal(Object.isFrozen(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv6), true);
  const addressPolicyMutations: readonly unknown[] = [
    {
      ...M4_CANONICAL_TARGET_POLICY,
      addressPolicy: {
        ...M4_CANONICAL_TARGET_POLICY.addressPolicy,
        allowedCidrs: { ...M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs, ipv4: [] },
      },
    },
    {
      ...M4_CANONICAL_TARGET_POLICY,
      addressPolicy: {
        ...M4_CANONICAL_TARGET_POLICY.addressPolicy,
        allowedCidrs: { ...M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs, ipv6: [] },
      },
    },
    {
      ...M4_CANONICAL_TARGET_POLICY,
      addressPolicy: {
        ...M4_CANONICAL_TARGET_POLICY.addressPolicy,
        deniedCidrs: {
          ...M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs,
          ipv4: M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv4.slice(1),
        },
      },
    },
    {
      ...M4_CANONICAL_TARGET_POLICY,
      addressPolicy: {
        ...M4_CANONICAL_TARGET_POLICY.addressPolicy,
        deniedCidrs: {
          ...M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs,
          ipv6: M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv6.slice(1),
        },
      },
    },
    {
      ...M4_CANONICAL_TARGET_POLICY,
      addressPolicy: {
        ...M4_CANONICAL_TARGET_POLICY.addressPolicy,
        classificationRule: {
          ...M4_CANONICAL_TARGET_POLICY.addressPolicy.classificationRule,
          decision: "accept_if_not_denied",
        },
      },
    },
  ];
  for (const mutation of addressPolicyMutations) {
    assert.notEqual(sha256Canonical(mutation), M4_TARGET_POLICY_SHA256);
  }
  const kernel = createM4RecordedProofKernel(exchange(), clock());
  const refused = await kernel.invoke(invocation("0".repeat(64)));
  assert.equal(refused.ok, false); if (!refused.ok) assert.equal(refused.refusalCode, "invalid_invocation_request");
});

test("scheme, effective port, hostname, and pinned IANA special-purpose boundaries are exact", () => {
  assert.equal(validateM4PublicTargetUrl(M4_TARGET_URL, "investors.fedex.com"), null);
  assert.equal(validateM4PublicTargetUrl(M4_TARGET_URL.replace("https:", "http:"), "investors.fedex.com"), "url_policy_refused");
  assert.equal(validateM4PublicTargetUrl("https://investors.fedex.com:444/path", "investors.fedex.com"), "url_policy_refused");
  for (const address of ["169.254.169.254", "127.0.0.1", "2001:db8::1", "3fff::1", "3fff:0abc::1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  assert.equal(M4_CANONICAL_TARGET_POLICY.addressPolicy.snapshotDate, "2025-10-09");
  assert.ok(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv4.includes("169.254.0.0/16"));
  assert.ok(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv6.includes("3fff::/20"));
  assert.deepEqual(M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs.ipv4, ["0.0.0.0/0"]);
  assert.deepEqual(M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs.ipv6, ["2000::/3"]);
  const policySource = readFileSync(join(import.meta.dirname, "..", "..", "src", "capability", "public-http-fetch-policy.ts"), "utf8");
  assert.doesNotMatch(policySource, /\["(?:0\.0\.0\.0|::|3fff::)",\s*\d+\]/);
  assert.match(policySource, /addressPolicy\.allowedCidrs\.ipv4/);
  assert.match(policySource, /addressPolicy\.allowedCidrs\.ipv6/);
  assert.match(policySource, /addressPolicy\.deniedCidrs\.ipv4/);
  assert.match(policySource, /addressPolicy\.deniedCidrs\.ipv6/);
  assert.match(policySource, /addressPolicy\.classificationRule/);
});

test("recorded cancellation, overflow, and refusal settle once with zero retry and consumed authority", async () => {
  for (const [change, code] of [
    [{ cancelAt: "during_body" }, "timeout_or_cancelled"],
    [{ bodyBase64: Buffer.alloc(M4_MAX_BODY_BYTES + 1).toString("base64") }, "body_limit_refused"],
    [{ status: 503 }, "http_status_refused"],
    [{ contentType: 'text/plain; charset="utf-8' }, "mime_refused"],
  ] as const) {
    const kernel = createM4RecordedProofKernel(exchange(change), clock());
    const result = await kernel.invoke(invocation());
    assert.equal(result.ok, true); if (!result.ok) continue;
    assert.equal(result.output, null);
    assert.equal(result.capabilityExecutions[0].refusalCode, code);
    assert.equal(result.capabilityExecutions[0].retryCount, 0);
    assert.equal(result.accountingIncrements[0].retriesPerformed, 0);
    assert.equal(result.accountingIncrements[0].liveNetworkEgressPerformed, 0);
    const replay = await kernel.invoke(invocation());
    assert.equal(replay.ok, false); if (!replay.ok) assert.equal(replay.refusalCode, "schedule_consumed");
  }
});

test("successful inert evidence derives recorded provenance and policy hash internally", async () => {
  const result = await createM4RecordedProofKernel(exchange(), clock()).invoke(invocation());
  assert.equal(result.ok, true); if (!result.ok || result.output === null) return;
  assert.equal(result.output.targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(result.output.provenance.targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(result.output.provenance.transport, "recorded_inert_exchange");
  assert.equal(result.accountingIncrements[0].liveNetworkEgressPerformed, 0);
  assert.equal(result.capabilityExecutions[0].targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(result.auditEvents[0].payload_json.target_policy_sha256, M4_TARGET_POLICY_SHA256);
});

test("no dormant or imported Node DNS/HTTPS live adapter exists", () => {
  const root = join(import.meta.dirname, "..", "..");
  assert.equal(existsSync(join(root, "scripts", "m4-node-public-http-dependencies.ts")), false);
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
  for (const path of [...files(join(root, "src")), ...files(join(root, "scripts"))]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /m4-node-public-http-dependencies|createNodePublicHttpDependencies/);
    const networkImports = source.match(/\b(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:node:)?(?:dns(?:\/promises)?|https?|http2|tls|net|undici)["']/g) ?? [];
    for (const networkImport of networkImports) {
      const allowedInboundServer = path === join(root, "scripts", "fake-mode-workshop-server.ts") &&
        /node:http["']/.test(networkImport);
      const allowedAddressClassifier = [
        join(root, "src", "capability", "public-http-fetch-policy.ts"),
        join(root, "src", "capability", "m4-orchestrator-mcp-client.ts"),
      ].includes(path) && /node:net["']/.test(networkImport);
      assert.equal(allowedInboundServer || allowedAddressClassifier, true, `${path}: ${networkImport}`);
    }
    if (path === join(root, "scripts", "fake-mode-workshop-server.ts")) {
      assert.equal(networkImports.length, 1);
      assert.match(source, /^import \{ createServer, type ServerResponse \} from "node:http";$/m);
    }
    if (path === join(root, "src", "capability", "public-http-fetch-policy.ts")) {
      assert.equal(networkImports.length, 1);
      assert.match(source, /^import \{ BlockList, isIP \} from "node:net";$/m);
    }
    if (path === join(root, "src", "capability", "m4-orchestrator-mcp-client.ts")) {
      assert.equal(networkImports.length, 1);
      assert.match(source, /^import \{ isIP \} from "node:net";$/m);
    }
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});
