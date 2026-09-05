import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { InMemoryArtifactStore } from "../../src/artifacts/store.ts";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { DisabledC3ModelProvider } from "../../src/c3/provider.ts";
import { startC3Server } from "../../src/c3/service.ts";
import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import type { GraphStore } from "../../src/graph/store.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import { InMemoryJobQueue } from "../../src/jobs/queue.ts";
import type { RuntimeMode } from "../../src/modes/index.ts";
import { createAtlieraRuntime } from "../../src/runtime/composition.ts";
import { handleFakeModeWorkshopRequest } from "../../src/runtime/fake-mode-workshop-server.ts";
import { makeValidBundle, VALID_GRAPH_SUBJECT } from "../fixtures/valid-graph.ts";

class MemoryResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  readonly headers = new Map<string, string | string[]>();
  readonly chunks: Buffer[] = [];
  readonly complete: Promise<void>;
  private resolveComplete!: () => void;
  constructor() {
    super();
    this.complete = new Promise<void>((resolve) => { this.resolveComplete = resolve; });
  }
  setHeader(name: string, value: string | string[]): void { this.headers.set(name.toLowerCase(), value); }
  writeHead(status: number, headers?: Record<string, string | number>): this {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers ?? {})) this.headers.set(name.toLowerCase(), String(value));
    return this;
  }
  end(body?: string | Buffer): this {
    if (body !== undefined) this.chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
    this.writableEnded = true;
    this.resolveComplete();
    return this;
  }
  text(): string { return Buffer.concat(this.chunks).toString("utf8"); }
}

const C3_HOST = "127.0.0.1:4317";
const C3_ORIGIN = `http://${C3_HOST}`;
async function c3Request(running: Awaited<ReturnType<typeof startC3Server>>, method: string, url: string, body?: unknown,
  headers: Record<string, string> = {}) {
  const req = new PassThrough() as PassThrough & { method: string; url: string; headers: Record<string, string> };
  req.method = method;
  req.url = url;
  req.headers = { host: C3_HOST, ...headers };
  const res = new MemoryResponse();
  running.server.emit("request", req as unknown as IncomingMessage, res as unknown as ServerResponse);
  req.end(body === undefined ? undefined : JSON.stringify(body));
  await res.complete;
  return res;
}

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DOC_PATH = join(REPO_ROOT, "docs", "architecture", "agentic-ai-usage-baseline.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPositiveReadiness(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /(?:authorizes|allows|approves|enables)\s+(?:web search|openrouter:web_search|`:online`|plugins?|tools?|production writes?|runtime\/model-mode integration)/i,
    /\bagent-ready\b/i,
    /agentic_platform_readiness/i,
    /Agentic platform readiness/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

test("agentic AI usage baseline records current runtime and validation boundaries", async (t) => {
  await t.test("documents the current agentic usage level without readiness or broadening claims", () => {
    const doc = readRepoFile(DOC_PATH);

    assert.match(doc, /# Agentic AI Usage Baseline/i);
    assert.match(doc, /Status: current bounded baseline/i);
    assert.match(doc, /Normal app boot and Workshop rendering use 0 default-path model\/provider calls/i);
    assert.match(doc, /Normal app boot and Workshop rendering use 0 autonomous tool actions/i);
    assert.match(doc, /No resident autonomous shell agent/i);
    assert.match(doc, /Normal app boot, Workshop rendering, and the default C3 launch do not invoke `ModelProvider\.generate`/i);
    assert.match(doc, /No source call sites currently invoke `ModelAdapter\.propose`/i);
    assert.match(doc, /The only `\.propose\(` source call site is the C2-01 review-only `AccountIntelligenceProviderBoundary` invocation/i);
    assert.match(doc, /C2 snapshots only its local boundary configuration/i);
    assert.match(doc, /Provider behavior remains an external mutable effect/i);
    assert.match(doc, /provider storage\/tool\/network behavior as unestablished/i);
    assert.match(doc, /lab\/test-only runtime proof harness/i);
    assert.match(doc, /Codex-auth bridge adapter/i);
    assert.match(doc, /`ExternalCommandModelProvider` is a sealed validation seam/i);
    assert.match(doc, /`AgentRunRecord` is orchestration evidence, not a running autonomous loop/i);
    assert.match(doc, /Recent `owl-alpha` usage was limited to explicitly approved validation runs/i);
    assert.match(doc, /runtime\/model-mode integration: optional local C3 prototype only; normal Workshop and default C3 remain zero-provider/i);
    assert.match(doc, /C3 is a separate optional operator-command local prototype, not the normal Workshop/i);
    assert.match(doc, /tools_or_plugins_requested: false/i);
    assert.match(doc, /web_search_requested: false/i);
    assert.match(doc, /launch_readiness_claim: false/i);
    assert.match(doc, /product_readiness_claim: false/i);
    assert.match(doc, /production_readiness_claim: false/i);
    assert.match(doc, /agentic_platform_maturity: foundation-layer/i);
    assert.match(doc, /runtime_agentic_ai_usage: gated-zero-default/i);
    assert.match(doc, /validation_agentic_ai_usage: bounded-approved-slices/i);
    assert.match(doc, /autonomous_agent_behavior: absent/i);
    assert.match(doc, /Any provider path beyond the reviewed optional local C3 command seam.*needs a separate reviewed change/i);
    assertNoPositiveReadiness("agentic AI usage baseline", doc);
  });

  await t.test("normal Workshop render and disabled C3 boot stay zero-provider; generation returns the explicit disabled failure", async () => {
    let workshopModelCalls = 0;
    let graphReads = 0;
    let graphWrites = 0;
    const bundle = makeValidBundle();
    const graphStore: GraphStore = {
      get snapshot(): GraphBundle { graphReads += 1; return bundle; },
      commit(_bundle: GraphBundle, _mode: RuntimeMode): void { graphWrites += 1; },
    };
    const runtime = createAtlieraRuntime({
      config: parseAtlieraRuntimeConfig({ ATL_ENV: "test", ARTIFACT_STORE: "memory", QUEUE_BACKEND: "memory", MODEL_PROVIDER: "fake" }),
      graphStore,
      artifactStore: new InMemoryArtifactStore(),
      jobQueue: new InMemoryJobQueue(),
      modelAdapter: {
        name: "baseline-fail-if-called",
        async propose() { workshopModelCalls += 1; throw new Error("Workshop render invoked the model adapter"); },
      },
    });
    const workshop = await handleFakeModeWorkshopRequest(runtime, { method: "GET", path: "/workshop" },
      { subject: VALID_GRAPH_SUBJECT });
    assert.equal(workshop.statusCode, 200);
    assert.match(workshop.body, /Atliera Workshop/);
    assert.equal(workshopModelCalls, 0);
    assert.equal(graphReads, 1);
    assert.equal(graphWrites, 0);

    const context = await loadC3AccountContext({
      broadInputPath: join(REPO_ROOT, "fixtures/account-intelligence/c2-01/broad-account-research-input.json"),
      proposalPath: join(REPO_ROOT, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json"),
      ownerDecisionPath: join(REPO_ROOT, "docs/decisions/c2-owner-disposition-record.json"),
      accountId: "acc_university_of_utah",
    });
    const running = await startC3Server({ context, provider: new DisabledC3ModelProvider(), listen: false,
      expectedHost: C3_HOST, now: () => new Date("2026-09-05T00:00:00.000Z") });
    try {
      const zeroCounts = {
        generationAttempted: 0, generationSucceeded: 0, generationRefused: 0,
        generationCancelled: 0, generationFailed: 0,
      };
      assert.deepEqual(running.status(), {
        provider: "disabled", ...zeroCounts, c2Implementation: "complete", ownerDisposition: "recorded",
        customerAvailability: "local_prototype_only",
      });
      const home = await c3Request(running, "GET", "/");
      const cookie = (home.headers.get("set-cookie") as string | undefined)?.split(";", 1)[0];
      const homeHtml = home.text();
      const csrf = homeHtml.match(/name="c3-csrf" content="([^"]+)"/)?.[1];
      assert.equal(home.statusCode, 200);
      assert.ok(cookie);
      assert.ok(csrf);
      assert.match(homeHtml, /Account Home/);
      const prepare = await c3Request(running, "GET", "/?prepare=1", undefined, { cookie });
      assert.equal(prepare.statusCode, 200);
      assert.match(prepare.text(), /Prepare for…/);
      assert.deepEqual(running.status(), {
        provider: "disabled", ...zeroCounts, c2Implementation: "complete", ownerDisposition: "recorded",
        customerAvailability: "local_prototype_only",
      });

      const generated = await c3Request(running, "POST", "/api/generate",
        { audience: "CISO", intendedOutcome: "Understand priorities and agree a next step.",
          durationMinutes: 15, meetingDate: "2026-09-12" },
        { cookie, origin: C3_ORIGIN, "x-c3-csrf": csrf, "content-type": "application/json" });
      const result = JSON.parse(generated.text()) as { error: string; html: string };
      assert.equal(generated.statusCode, 502);
      assert.equal(result.error, "model generation is disabled; an operator must configure C3_MODEL_COMMAND on the local server");
      assert.match(result.html, /value="CISO"/);
      assert.deepEqual(running.status(), {
        provider: "disabled", generationAttempted: 1, generationSucceeded: 0, generationRefused: 0,
        generationCancelled: 0, generationFailed: 1, c2Implementation: "complete", ownerDisposition: "recorded",
        customerAvailability: "local_prototype_only",
      });
    } finally {
      await running.close();
    }
  });
});
