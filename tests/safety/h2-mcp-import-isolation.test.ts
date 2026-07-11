import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");
const CAPABILITY = join(SRC, "capability");
const MODEL_SIDE = [join(SRC, "model"), join(SRC, "agent")];
const MODEL_CAPABILITY_IMPORT =
  /(?:from\s*|import\s*(?:\(\s*)?)["'][^"']*(?:capability|mcp-client)[^"']*["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (path.endsWith(".ts")) out.push(path);
  }
  return out;
}

function text(path: string): string {
  return readFileSync(path, "utf8");
}

test("test_mcp_client_import_isolation", () => {
  for (const forbiddenImport of [
    'import { createH2EchoMediationKernel } from "../capability/h2-mediation-gate.ts";',
    'import "../capability/h2-registry.ts";',
    'await import("../capability/orchestrator-mcp-client.ts");',
  ]) {
    assert.match(forbiddenImport, MODEL_CAPABILITY_IMPORT);
  }

  const modelFiles = MODEL_SIDE.flatMap((dir) => walk(dir));
  for (const path of modelFiles) {
    assert.doesNotMatch(
      text(path),
      MODEL_CAPABILITY_IMPORT,
      `model-side module imports system capability code: ${relative(ROOT, path)}`,
    );
  }

  const allSource = walk(SRC);
  const clientImporters = allSource
    .filter((path) => path !== join(CAPABILITY, "orchestrator-mcp-client.ts"))
    .filter((path) => text(path).includes('from "./orchestrator-mcp-client.ts"'))
    .map((path) => relative(ROOT, path));
  assert.deepEqual(clientImporters, ["src/capability/h2-mediation-gate.ts"]);

  const m4ClientImporters = allSource
    .filter((path) => path !== join(CAPABILITY, "m4-orchestrator-mcp-client.ts"))
    .filter((path) => text(path).includes("m4-orchestrator-mcp-client"))
    .map((path) => relative(ROOT, path));
  assert.deepEqual(m4ClientImporters, ["src/capability/m4-public-http-fetch-mediation.ts"]);

  const clientSource = text(join(CAPABILITY, "orchestrator-mcp-client.ts"));
  assert.doesNotMatch(clientSource, /\.\.\/model\/|\.\.\/agent\//);
  assert.doesNotMatch(clientSource, /@modelcontextprotocol/);
  const m4ClientSource = text(join(CAPABILITY, "m4-orchestrator-mcp-client.ts"));
  assert.doesNotMatch(m4ClientSource, /\.\.\/model\/|\.\.\/agent\//);
  assert.doesNotMatch(m4ClientSource, /@modelcontextprotocol/);
});

test("general index barrel cannot bypass model capability isolation", async () => {
  const priorBypass = 'import { H2_CAPABILITY_REGISTRY } from "../index.ts";';
  assert.doesNotMatch(priorBypass, MODEL_CAPABILITY_IMPORT);

  const rootIndexSource = text(join(SRC, "index.ts"));
  assert.doesNotMatch(rootIndexSource, /capability\//);
  assert.doesNotMatch(rootIndexSource, /H2_CAPABILITY_REGISTRY|getH2EchoMediationKernel|public_http_fetch_v1|M4PublicHttp/);

  const rootExports = await import("../../src/index.ts");
  assert.equal("H2_CAPABILITY_REGISTRY" in rootExports, false);
  assert.equal("getH2EchoMediationKernel" in rootExports, false);
  assert.equal("M4PublicHttpFetchMediationKernel" in rootExports, false);
});

test("inert echo server has no effect-capable imports or runtime surfaces", () => {
  const serverSource = text(join(CAPABILITY, "inert-echo-mcp-server.ts"));
  for (const forbidden of [
    "node:fs",
    "node:http",
    "node:https",
    "node:http2",
    "node:net",
    "node:dgram",
    "node:dns",
    "node:child_process",
    "node:worker_threads",
    "process.env",
    "fetch(",
    "WebSocket",
  ]) {
    assert.ok(!serverSource.includes(forbidden), `inert echo server includes effect surface: ${forbidden}`);
  }

  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const packages = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  assert.ok(!("@modelcontextprotocol/sdk" in packages));
});
