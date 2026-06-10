import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

interface RunResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ATL_ENV: "test",
    ARTIFACT_STORE: "memory",
    QUEUE_BACKEND: "memory",
    MODEL_PROVIDER: "fake",
    HOST: "127.0.0.1",
    ...overrides,
  };
}

async function runServerUntilExit(env: NodeJS.ProcessEnv): Promise<RunResult> {
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/fake-mode-workshop-server.ts"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const timeout = setTimeout(() => child.kill("SIGKILL"), 1_500);
  const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
  clearTimeout(timeout);
  return { code, stdout, stderr };
}

async function runServerUntilListening(env: NodeJS.ProcessEnv): Promise<{ child: ReturnType<typeof spawn>; jsonText: string; stderr: () => string }> {
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/fake-mode-workshop-server.ts"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const jsonText = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not print listening JSON; stderr=${stderr}`)), 3_000);
    child.stdout.on("data", () => {
      try {
        JSON.parse(stdout);
        clearTimeout(timeout);
        resolve(stdout);
      } catch {
        // Wait for the rest of the pretty-printed JSON object.
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before listening: code=${code}; stderr=${stderr}; stdout=${stdout}`));
    });
  });
  return { child, jsonText, stderr: () => stderr };
}

test("fake-mode Workshop server CLI requires bearer token unless local dev auth is explicitly disabled", async () => {
  const result = await runServerUntilExit(baseEnv({ ATLIERA_LOCAL_BEARER_TOKEN: undefined, ATLIERA_LOCAL_AUTH_MODE: undefined }));

  assert.equal(result.code, 2);
  assert.match(result.stderr, /ATLIERA_LOCAL_BEARER_TOKEN is required unless auth is explicitly disabled/);
  assert.doesNotMatch(result.stderr, /fixture-auth-token|Bearer wrong-token/i);
});

test("fake-mode Workshop server CLI starts with explicit bearer token and does not print it", async () => {
  const { child, jsonText, stderr } = await runServerUntilListening(baseEnv({ ATLIERA_LOCAL_BEARER_TOKEN: "fixture-auth-token" }));
  try {
    const body = JSON.parse(jsonText) as Record<string, unknown>;
    assert.equal(body.ok, true);
    assert.equal(body.kind, "fake-mode-workshop-server-listening");
    assert.deepEqual(body.routes, ["/healthz", "/workshop"]);
    assert.doesNotMatch(jsonText, /fixture-auth-token/i);
    assert.doesNotMatch(stderr(), /fixture-auth-token/i);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.on("exit", resolve));
  }
});
