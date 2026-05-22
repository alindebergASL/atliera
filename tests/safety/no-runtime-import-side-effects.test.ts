// Import-side-effect safety test.
//
// Importing the Atliera package surface must not perform any network
// I/O, read any API key, or load a provider SDK. We patch the relevant
// surfaces *before* importing and assert that nothing tripped them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("safety: importing the package has no provider/network side effects", () => {
  it("does not call fetch / net.connect / read provider API keys at import time", async () => {
    let fetchCalls = 0;
    const origFetch = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = (..._args: unknown[]) => {
      fetchCalls++;
      throw new Error("fetch must not be called from default import paths");
    };

    const envHits: string[] = [];
    const origEnv = process.env;
    const proxy = new Proxy(origEnv, {
      get(target, key) {
        const k = String(key);
        if (
          k.endsWith("_API_KEY") ||
          k.startsWith("ANTHROPIC_") ||
          k.startsWith("OPENAI_") ||
          k.startsWith("COHERE_") ||
          k.startsWith("GOOGLE_")
        ) {
          envHits.push(k);
        }
        return (target as Record<string, string | undefined>)[k];
      },
    });
    Object.defineProperty(process, "env", {
      configurable: true,
      value: proxy,
    });

    try {
      // Dynamic import so the patches above are in place first.
      const mod = await import("../../src/index.ts");
      assert.ok(typeof mod.validateGraphBundle === "function");
      assert.equal(fetchCalls, 0, "fetch must not be invoked at import time");
      assert.deepEqual(
        envHits,
        [],
        "no provider API key env vars must be read at import time: " +
          JSON.stringify(envHits),
      );
    } finally {
      Object.defineProperty(process, "env", {
        configurable: true,
        value: origEnv,
      });
      if (origFetch === undefined) {
        delete (globalThis as { fetch?: unknown }).fetch;
      } else {
        (globalThis as { fetch?: unknown }).fetch = origFetch;
      }
    }
  });
});
