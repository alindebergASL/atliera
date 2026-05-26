import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createModelProviderRequest } from "../../src/model/provider.ts";
import { ExternalCommandModelProvider } from "../../src/model/external-command-provider.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-external-provider-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeExecutable(path: string, body: string): Promise<void> {
  await writeFile(path, body, "utf8");
  await chmod(path, 0o755);
}

function validationRequest() {
  return createModelProviderRequest({
    operation: "graph.propose",
    mode: "model",
    model: "model_a",
    prompt: "Return empty graph proposal JSON for validation.",
    inputGraphRef: "graph/model-validation-input.json",
    idempotencyKey: "run_model_validation_1",
    maxOutputTokens: 128,
    temperature: 0,
    metadata: { purpose: "provider-validation" },
  });
}

describe("ExternalCommandModelProvider", () => {
  it("passes the sanitized request JSON to an explicit command and parses the provider response", async () => {
    await withTempDir(async (dir) => {
      const command = join(dir, "provider-command.mjs");
      const seenPath = join(dir, "seen-request.json");
      await writeExecutable(command, `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
writeFileSync(${JSON.stringify(seenPath)}, JSON.stringify({
  operation: request.operation,
  mode: request.mode,
  model: request.model,
  idempotencyKey: request.idempotencyKey,
  promptSeen: typeof request.prompt === 'string',
}));
process.stdout.write(JSON.stringify({
  provider: 'provider_a',
  model: request.model,
  idempotencyKey: request.idempotencyKey,
  output: { excerpts: [], claims: [], account_objects: [] },
  usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 },
  cost: { currency: 'USD', amount: 0.001 }
}));
`);

      const provider = new ExternalCommandModelProvider({
        name: "provider_a",
        command: process.execPath,
        args: [command],
        timeoutMs: 2_000,
        env: {},
      });
      const response = await provider.generate(validationRequest());

      assert.equal(response.provider, "provider_a");
      assert.equal(response.model, "model_a");
      assert.deepEqual(response.output, { excerpts: [], claims: [], account_objects: [] });
      assert.deepEqual(JSON.parse(await readFile(seenPath, "utf8")), {
        operation: "graph.propose",
        mode: "model",
        model: "model_a",
        idempotencyKey: "run_model_validation_1",
        promptSeen: true,
      });
    });
  });

  it("fails closed with a stable non-leaking error when command output is not JSON", async () => {
    await withTempDir(async (dir) => {
      const command = join(dir, "bad-json.mjs");
      await writeExecutable(command, `#!/usr/bin/env node
process.stdout.write('provider secret raw body sk-live-value');
`);
      const provider = new ExternalCommandModelProvider({ name: "provider_a", command: process.execPath, args: [command], timeoutMs: 2_000, env: {} });

      await assert.rejects(
        () => provider.generate(validationRequest()),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, "external provider command returned invalid response");
          assert.doesNotMatch(error.message, /sk-live-value|secret|raw body/i);
          return true;
        },
      );
    });
  });

  it("bounds hung provider commands with sanitized timeout failures", async () => {
    await withTempDir(async (dir) => {
      const command = join(dir, "hang.mjs");
      await writeExecutable(command, `#!/usr/bin/env node
setTimeout(() => process.stdout.write('{}'), 5_000);
`);
      const provider = new ExternalCommandModelProvider({ name: "provider_a", command: process.execPath, args: [command], timeoutMs: 250, env: {} });

      await assert.rejects(
        () => provider.generate(validationRequest()),
        /external provider command timed out/,
      );
    });
  });

  it("does not inherit ambient secret-bearing environment by default", async () => {
    await withTempDir(async (dir) => {
      const command = join(dir, "env-probe.mjs");
      const seenPath = join(dir, "seen-env.json");
      await writeExecutable(command, `
import { writeFileSync } from 'node:fs';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
writeFileSync(${JSON.stringify(seenPath)}, JSON.stringify({
  anthropic: process.env.ANTHROPIC_API_KEY ?? null,
  secret: process.env.PROVIDER_SECRET ?? null,
  token: process.env.PROVIDER_TOKEN ?? null,
  pathPresent: typeof process.env.PATH === 'string',
}));
process.stdout.write(JSON.stringify({
  provider: 'provider_a',
  model: request.model,
  idempotencyKey: request.idempotencyKey,
  output: { excerpts: [], claims: [], account_objects: [] },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  cost: { currency: 'USD', amount: 0.001 }
}));
`);
      const previous = {
        ["ANTHROPIC" + "_API_KEY"]: process.env["ANTHROPIC" + "_API_KEY"],
        PROVIDER_SECRET: process.env.PROVIDER_SECRET,
        PROVIDER_TOKEN: process.env.PROVIDER_TOKEN,
      };
      process.env["ANTHROPIC" + "_API_KEY"] = "parent-value";
      process.env.PROVIDER_SECRET = "parent-secret-value";
      process.env.PROVIDER_TOKEN = "parent-token-value";
      try {
        const provider = new ExternalCommandModelProvider({
          name: "provider_a",
          command: process.execPath,
          args: [command],
          timeoutMs: 2_000,
        });
        await provider.generate(validationRequest());
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }

      assert.deepEqual(JSON.parse(await readFile(seenPath, "utf8")), {
        anthropic: null,
        secret: null,
        token: null,
        pathPresent: true,
      });
    });
  });

  it("escalates timeout cleanup for commands that ignore SIGTERM", async () => {
    await withTempDir(async (dir) => {
      const command = join(dir, "ignore-term.mjs");
      const pidPath = join(dir, "child.pid");
      await writeExecutable(command, `
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
`);
      const provider = new ExternalCommandModelProvider({
        name: "provider_a",
        command: process.execPath,
        args: [command],
        timeoutMs: 250,
      });

      await assert.rejects(
        () => provider.generate(validationRequest()),
        /external provider command timed out/,
      );
      const pid = Number(await readFile(pidPath, "utf8"));
      assert.throws(() => process.kill(pid, 0));
    });
  });

  it("rejects unsafe command configuration before spawning", () => {
    assert.throws(
      () => new ExternalCommandModelProvider({ name: "provider_a", command: "node\0bad", timeoutMs: 1_000 }),
      /external provider command rejected/,
    );
    assert.throws(
      () => new ExternalCommandModelProvider({ name: "provider_a", command: "node", args: ["--bad\0arg"], timeoutMs: 1_000 }),
      /external provider command rejected/,
    );
    assert.throws(
      () => new ExternalCommandModelProvider({ name: "provider_a", command: "node", timeoutMs: 249 }),
      /external provider timeout rejected/,
    );
  });
});
